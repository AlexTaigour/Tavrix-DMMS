import { supabase, sb, nowIso } from '../db.js';
import { emitOrdersSettled } from '../sockets.js';
import { httpError } from './orderService.js';

// A table's "tab" = every order on that table that is unpaid (payment_id NULL)
// and not cancelled. Settling pays the whole tab in one payment record.
// Takeaway orders live on the virtual table 'TA' and settle the same way.

export const TAKEAWAY_TABLE = 'TA';

const unpaidQuery = () =>
  supabase
    .from('orders')
    .select('*')
    .is('payment_id', null)
    .neq('status', 'cancelled');

// One board row per configured table: derived state + running total.
//   free     — no unpaid orders
//   dining   — unpaid orders exist, not all served yet
//   awaiting — every unpaid order is served → ready to pay & leave
// A virtual 'TA' row is appended whenever unpaid takeaway orders exist.
export async function getBoard(tables) {
  const rows = sb(await unpaidQuery().order('created_at'));
  const byTable = new Map();
  for (const r of rows) {
    if (!byTable.has(r.table_no)) byTable.set(r.table_no, []);
    byTable.get(r.table_no).push(r);
  }
  const shapeRow = (tableNo) => {
    const orders = byTable.get(tableNo) || [];
    const state = !orders.length
      ? 'free'
      : orders.every((o) => o.status === 'served')
        ? 'awaiting'
        : 'dining';
    return {
      tableNo,
      state,
      orderCount: orders.length,
      total: orders.reduce((s, o) => s + o.total, 0),
      oldestAt: orders[0]?.created_at ?? null,
      // when the last order went to 'served' the party is likely done — used
      // by the idle-table alert on the board
      allServedSince:
        state === 'awaiting'
          ? orders.reduce((max, o) => (o.created_at > max ? o.created_at : max), orders[0].created_at)
          : null,
    };
  };
  const board = tables.map(shapeRow);
  if (byTable.has(TAKEAWAY_TABLE)) board.push(shapeRow(TAKEAWAY_TABLE));
  return board;
}

// Combined bill for one table: unpaid orders with their items + grand total.
// Items arrive embedded on each order row — one round trip for the whole bill.
export async function getTableBill(tableNo) {
  const rows = sb(
    await supabase
      .from('orders')
      .select('*, order_items(id, name, price, qty)')
      .is('payment_id', null)
      .neq('status', 'cancelled')
      .eq('table_no', tableNo)
      .order('created_at')
      .order('id', { referencedTable: 'order_items' })
  );
  if (!rows.length) return { tableNo, orders: [], total: 0 };

  const orders = rows.map((r) => ({
    id: r.id,
    publicCode: r.public_code,
    name: r.customer_name,
    queueNo: r.queue_no ?? null,
    status: r.status,
    total: r.total,
    createdAt: r.created_at,
    items: (r.order_items ?? []).map((it) => ({
      id: it.id,
      name: it.name,
      price: it.price,
      qty: it.qty,
    })),
  }));
  return { tableNo, orders, total: orders.reduce((s, o) => s + o.total, 0) };
}

// Settle a table's tab in one payment. `opts.orderIds` (optional) restricts the
// settle to a subset of the unpaid orders — split bills, or freeing a tab that
// mixed two parties. Discounts/charges adjust the collected amount; method
// 'credit' books the total into the udhaaro ledger instead of the cash drawer.
export async function settleTable(tableNo, opts, user) {
  const { method, orderIds: onlyOrderIds, discount = 0, discountPercent, extraCharge = 0, note = '', creditCustomer } = opts;

  let rows;
  try {
    rows = sb(await unpaidQuery().eq('table_no', tableNo));
  } catch (err) {
    console.error(`Error fetching unpaid orders for table ${tableNo}:`, err);
    throw err;
  }
  if (!rows.length) throw httpError(409, 'Nothing to settle — this table has no unpaid orders');

  if (onlyOrderIds) {
    const unpaid = new Set(rows.map((r) => r.id));
    const missing = onlyOrderIds.filter((id) => !unpaid.has(id));
    if (missing.length) {
      throw httpError(409, 'Some selected orders were just settled or cancelled — refresh the bill');
    }
    rows = rows.filter((r) => onlyOrderIds.includes(r.id));
  }

  const orderIds = rows.map((r) => r.id);
  const subtotal = rows.reduce((s, r) => s + r.total, 0);
  const discountAmt =
    discountPercent !== undefined && discountPercent !== null
      ? Math.round((subtotal * discountPercent) / 100)
      : discount;
  if (discountAmt > subtotal) throw httpError(400, 'Discount exceeds the bill subtotal');
  const total = subtotal - discountAmt + extraCharge;

  const payment = sb(
    await supabase
      .from('payments')
      .insert({
        table_no: tableNo,
        method,
        subtotal,
        discount: discountAmt,
        extra_charge: extraCharge,
        note,
        total,
        taken_by: user.id,
        created_at: nowIso(),
      })
      .select('*')
      .single()
  );

  // Record credit before marking orders settled, so a failed ledger write
  // cannot make the customer's order look billed without recording the debt.
  if (method === 'credit') {
    try {
      sb(
        await supabase.from('credit_entries').insert({
          customer_name: creditCustomer.name,
          customer_phone: creditCustomer.phone,
          amount: total,
          method: 'credit',
          payment_id: payment.id,
          taken_by: user.id,
          note,
          created_at: nowIso(),
        })
      );
    } catch (err) {
      const cleanup = await supabase.from('payments').delete().eq('id', payment.id);
      if (cleanup.error) {
        console.error(`Credit ledger failed and payment ${payment.id} cleanup failed:`, cleanup.error.message);
        throw httpError(500, 'Credit could not be recorded. Contact the owner before retrying this bill.');
      }
      throw err;
    }
  }

  // Optimistic guard: only claim orders still unpaid and not cancelled (a
  // cancel may race in between read and claim). If any order was grabbed by a
  // concurrent settle or cancelled, roll the payment back and let staff retry
  // with a fresh bill (no transactions over REST).
  const claimed = sb(
    await supabase
      .from('orders')
      .update({ payment_id: payment.id })
      .in('id', orderIds)
      .is('payment_id', null)
      .neq('status', 'cancelled')
      .select('id')
  );
  if (claimed.length !== orderIds.length) {
    const restore = claimed.length
      ? await supabase
          .from('orders')
          .update({ payment_id: null })
          .in('id', claimed.map((order) => order.id))
          .eq('payment_id', payment.id)
          .select('id')
      : { data: [], error: null };
    if (restore.error || restore.data.length !== claimed.length) {
      console.error(`Settlement ${payment.id} order rollback was incomplete:`, restore.error?.message || 'order count mismatch');
      throw httpError(500, 'Settlement conflicted and could not be fully rolled back. Contact the owner.');
    }
    if (method === 'credit') {
      const ledgerCleanup = await supabase.from('credit_entries').delete().eq('payment_id', payment.id);
      if (ledgerCleanup.error) {
        console.error(`Settlement ${payment.id} credit rollback failed:`, ledgerCleanup.error.message);
        throw httpError(500, 'Settlement conflicted and credit cleanup failed. Contact the owner.');
      }
    }
    const paymentCleanup = await supabase.from('payments').delete().eq('id', payment.id);
    if (paymentCleanup.error) {
      console.error(`Settlement ${payment.id} payment rollback failed:`, paymentCleanup.error.message);
      throw httpError(500, 'Settlement conflicted and payment cleanup failed. Contact the owner.');
    }
    throw httpError(409, 'This table was just settled by someone else — refresh');
  }

  emitOrdersSettled({ tableNo, orderIds, paymentId: payment.id });
  return {
    payment: {
      id: payment.id,
      tableNo: payment.table_no,
      method: payment.method,
      subtotal: payment.subtotal,
      discount: payment.discount,
      extraCharge: payment.extra_charge,
      total: payment.total,
      takenBy: user.displayName,
      createdAt: payment.created_at,
    },
    orderIds,
  };
}
