import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Coffee, ArrowLeft, Timer, CheckCircle2, Clock3, ShoppingBag, Armchair, Radio, PackageCheck, CircleAlert } from 'lucide-react';
import { trackOrder } from '../api/client';
import { getSocket } from '../api/socket';
import StatusTimeline from '../components/StatusTimeline';
import ServiceCallButtons from '../components/ServiceCallButtons';
import BlurText from '../components/reactbits/BlurText';
import BrewingLoader from '../components/BrewingLoader';
import { formatRs } from '../utils/format';

// What the customer actually wants to know at each step.
const STATUS_MESSAGE = {
  pending: { icon: Radio, title: 'Order received', text: 'The kitchen will confirm your order shortly.' },
  accepted: { icon: CheckCircle2, title: 'Order confirmed', text: 'Your order is in the queue and will be started soon.' },
  preparing: { icon: Coffee, title: 'Being prepared', text: 'The kitchen is preparing your order now.' },
  cooked: { icon: PackageCheck, title: 'Ready', text: 'Your order is ready. Our staff will bring it to your table.' },
  served: { icon: Coffee, title: 'Enjoy your order', text: 'Your order has been served. We hope you enjoy it!' },
  cancelled: { icon: Clock3, title: 'Order cancelled', text: 'Please speak with our team if you have questions about this order.' },
};

const TAKEAWAY_MESSAGE = {
  cooked: { icon: PackageCheck, title: 'Ready for pickup', text: 'Please collect your order at the counter.' },
  served: { icon: ShoppingBag, title: 'Picked up', text: 'Thanks for stopping by. See you again!' },
};

export default function OrderTrack() {
  const { publicCode } = useParams();
  const [order, setOrder] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let live = true;
    const load = () =>
      trackOrder(publicCode)
        .then((o) => {
          if (!live) return;
          setOrder(o);
          try {
            localStorage.setItem('tvx_last_order', JSON.stringify({ code: o.publicCode, at: Date.now() }));
          } catch {
            // Tracking remains available for this visit if storage is unavailable.
          }
        })
        .catch(() => live && setNotFound(true));
    load();

    const socket = getSocket();
    socket.emit('track', publicCode);
    // refetch on status push — keeps history timestamps in sync too
    const onStatus = (p) => { if (p.publicCode === publicCode) load(); };
    const onConnect = () => { socket.emit('track', publicCode); load(); };
    socket.on('order:status', onStatus);
    socket.on('connect', onConnect);
    // the queue ahead of us moves without our own status changing
    const queueTick = setInterval(load, 60_000);
    return () => {
      live = false;
      socket.off('order:status', onStatus);
      socket.off('connect', onConnect);
      clearInterval(queueTick);
    };
  }, [publicCode]);

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#fff8f6] px-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-chiya"><CircleAlert size={28} /></span>
        <p className="text-lg font-black text-bean">We couldn’t find that order</p>
        <p className="max-w-sm text-sm text-bean/55">Check the tracking link or ask our team for help.</p>
        <Link to="/" className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-chiya px-5 py-2.5 font-bold text-white">Back to menu</Link>
      </div>
    );
  }
  if (!order) {
    return <BrewingLoader fullscreen tone="light" label="Fetching your order" />;
  }

  const isTakeaway = order.orderType === 'takeaway';
  const message =
    (isTakeaway && TAKEAWAY_MESSAGE[order.status]) || STATUS_MESSAGE[order.status];
  const MessageIcon = message?.icon || Coffee;
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="min-h-screen bg-[#fff8f6] px-4 pb-8 pt-4 sm:pt-8">
      <div className="mx-auto max-w-5xl">
      <Link to="/" className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-bean/65 transition-colors hover:bg-white hover:text-chiya sm:mb-6">
        <ArrowLeft size={17} /> Back to menu
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-3xl border border-espresso/10 bg-white shadow-sm"
      >
        <header className="border-b border-espresso/10 bg-white px-5 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-chiya">Live order status</p>
              <BlurText as="h1" text="Track your order" className="block text-2xl font-black tracking-tight text-bean sm:text-3xl" />
              <p className="mt-1 font-mono text-sm font-bold text-bean/50">{order.publicCode}</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-[#fff8f6] px-3 py-2 text-sm font-bold text-bean">
              {isTakeaway ? <ShoppingBag size={17} className="text-chiya" /> : <Armchair size={17} className="text-chiya" />}
              <span>{isTakeaway ? 'Takeaway' : `Table ${order.table}`}</span>
            </div>
          </div>
          {isTakeaway && order.queueNo != null && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-chiya px-4 py-3 text-white sm:px-5">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-white/75">Pickup token</p><p className="mt-0.5 text-sm font-bold">Show this number at the counter</p></div>
              <span className="text-3xl font-black">#{order.queueNo}</span>
            </div>
          )}
        </header>

        {message && (
          <motion.div
            key={order.status}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-start gap-3 px-5 py-5 sm:px-8 ${
              isCancelled ? 'bg-red-50 text-red-800' : order.status === 'cooked' ? 'bg-green-50 text-green-900' : 'bg-rose-50/70 text-bean'
            }`}
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isCancelled ? 'bg-red-100 text-red-700' : order.status === 'cooked' ? 'bg-green-100 text-green-700' : 'bg-white text-chiya'}`}><MessageIcon size={21} /></span>
            <div><h2 className="font-black">{message.title}</h2><p className="mt-0.5 text-sm font-medium opacity-75">{message.text}</p></div>
          </motion.div>
        )}

        {order.queue && (
          <div className="mx-5 mt-4 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-blue-900 sm:mx-8">
            <Timer size={21} className="shrink-0 text-blue-700" />
            <div className="min-w-0">
              <p className="text-sm font-bold">{order.queue.ahead === 0 ? 'You are next in the kitchen' : `${order.queue.ahead} ${order.queue.ahead === 1 ? 'order' : 'orders'} ahead of you`}</p>
              <p className="mt-0.5 text-xs font-medium text-blue-800/70">Estimated wait · about {order.queue.estMinutes} min</p>
            </div>
          </div>
        )}

        <div className="grid gap-6 px-5 py-5 sm:px-8 sm:py-7 lg:grid-cols-[1fr_0.9fr]">
          <section>
            <h2 className="mb-4 text-sm font-black text-bean">Order progress</h2>
            <div className="rounded-2xl border border-espresso/10 bg-white px-4 py-4 sm:px-5">
              <StatusTimeline order={order} />
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-sm font-black text-bean">Your items</h2>
            <div className="rounded-2xl bg-[#fff8f6] p-4 sm:p-5">
              <div className="space-y-3">
                {order.items.map((it) => (
                  <div key={it.id} className="flex justify-between gap-3 text-sm">
                    <span className="font-semibold text-bean"><span className="mr-2 inline-block min-w-7 rounded-md bg-white px-1.5 py-0.5 text-center text-xs font-black text-chiya">{it.qty}×</span>{it.name}</span>
                    <span className="shrink-0 font-medium text-bean/55">{formatRs(it.qty * it.price)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between border-t border-espresso/10 pt-3 font-black text-bean">
                <span>Total</span><span>{formatRs(order.total)}</span>
              </div>
            </div>
          </section>
        </div>

        {!isTakeaway && order.status !== 'cancelled' && (
          <div className="border-t border-espresso/10 px-5 py-5 sm:px-8">
            <ServiceCallButtons table={order.table} />
          </div>
        )}

        <footer className="border-t border-espresso/10 bg-[#fff8f6] px-5 py-3 text-center text-xs font-medium text-bean/45 sm:px-8">
          Order status updates automatically. You can keep this page open.
        </footer>
      </motion.div>
      </div>
    </div>
  );
}
