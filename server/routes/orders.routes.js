import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, optionalAuth, verifyTableQrToken } from '../auth.js';
import { orderGate } from '../orderGate.js';
import { validate, createOrderSchema, statusSchema } from '../validate.js';
import { createOrder, transitionOrder, listOrders, getOrderByCode, getQueueInfo } from '../services/orderService.js';

const publicOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many orders. Please wait a bit and try again.' },
});

export default function ordersRouter(tables) {
  const router = Router();

  // Public — customers order anonymously; a logged-in staff cookie marks the
  // order source as 'staff'. Dine-in orders must carry the signed table token
  // from that table's QR code; the URL's table label alone is not trusted.
  router.post('/', publicOrderLimiter, optionalAuth, orderGate, validate(createOrderSchema), async (req, res, next) => {
    try {
      if (!req.user && req.body.orderType !== 'takeaway') {
        const qrTable = verifyTableQrToken(req.body.tableQrToken);
        if (!qrTable || !tables.includes(qrTable)) {
          return res.status(403).json({ error: 'Scan the QR code at your table to place a dine-in order.' });
        }
        if (qrTable !== req.body.table) {
          return res.status(403).json({ error: 'This QR code is for a different table. Please scan the QR code at your table.' });
        }
      }
      res.status(201).json(await createOrder(req.body, req.user));
    } catch (err) {
      next(err);
    }
  });

  // Public — customer live tracking by unguessable code.
  router.get('/track/:publicCode', async (req, res, next) => {
    try {
      const order = await getOrderByCode(req.params.publicCode, { includeHistory: true });
      if (!order) return res.status(404).json({ error: 'Order not found' });
      // don't leak customer phone to anyone holding the code URL
      const { phone, ...safe } = order;
      safe.queue = await getQueueInfo(order); // null once cooking is done
      res.json(safe);
    } catch (err) {
      next(err);
    }
  });

  // Owner-only order history: date-ranged, includes payment details.
  // Registered before the param routes so 'history' is never captured as an id.
  router.get('/history', requireAuth('owner'), async (req, res, next) => {
    try {
      const from = typeof req.query.from === 'string' ? req.query.from : undefined;
      const to = typeof req.query.to === 'string' ? req.query.to : undefined;
      res.json(await listOrders({ scope: 'history', from, to }));
    } catch (err) {
      next(err);
    }
  });

  router.get('/', requireAuth('staff', 'kitchen', 'owner'), async (req, res, next) => {
    try {
      const scope = req.query.status === 'all' ? 'all' : 'active';
      res.json(await listOrders({ scope }));
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id/status', requireAuth('staff', 'kitchen', 'owner'), validate(statusSchema), async (req, res, next) => {
    try {
      if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Order not found' });
      res.json(await transitionOrder(Number(req.params.id), req.body.status, req.user));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
