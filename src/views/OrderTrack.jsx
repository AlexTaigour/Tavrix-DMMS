import React, { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Coffee, ArrowLeft, CheckCircle2, Clock3, ShoppingBag, Armchair, Radio, PackageCheck, CircleAlert, Receipt, Boxes, RadioTower, Gamepad2, ChevronDown, Lock } from 'lucide-react';
import { trackOrder } from '../api/client';
import { getSocket } from '../api/socket';
import StatusTimeline from '../components/StatusTimeline';
import ServiceCallButtons from '../components/ServiceCallButtons';
import GamesPanel from '../components/GamesPanel';
import BrewingLoader from '../components/BrewingLoader';
import { formatRs } from '../utils/format';
import { rememberOrder } from '../utils/trackedOrders';

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

const GAME_ACCESS_STATUSES = new Set(['accepted', 'preparing', 'cooked']);

export default function OrderTrack() {
  const { publicCode } = useParams();
  const location = useLocation();
  const returnTo = location.state?.returnTo;
  const menuUrl = typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//')
    ? returnTo
    : '/';
  const [order, setOrder] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let live = true;
    const load = () =>
      trackOrder(publicCode)
        .then((o) => {
          if (!live) return;
          setOrder(o);
          rememberOrder(o.publicCode);
        })
        .catch(() => live && setNotFound(true));
    load();

    const socket = getSocket();
    let hasConnected = socket.connected;
    socket.emit('track', publicCode);
    // refetch on status push — keeps history timestamps in sync too
    const onStatus = (p) => { if (p.publicCode === publicCode) load(); };
    const onConnect = () => {
      socket.emit('track', publicCode);
      if (hasConnected) load();
      else hasConnected = true;
    };
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
        <Link to={menuUrl} className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-chiya px-5 py-2.5 font-bold text-white">Back to menu</Link>
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
  const gamesAvailable = GAME_ACCESS_STATUSES.has(order.status);

  return (
    <div className="min-h-screen bg-[#fff8f6] px-3 pb-8 pt-3 sm:px-5 sm:pb-10 sm:pt-6">
      <div className="mx-auto max-w-5xl">
        <nav aria-label="Order navigation" className="mb-3 flex items-center justify-between sm:mb-5">
          <Link to={menuUrl} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-espresso/10 bg-white px-4 text-sm font-bold text-bean shadow-sm transition-colors hover:border-espresso/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chiya">
            <ArrowLeft size={17} /> <span>Menu</span>
          </Link>
          <Link to="/orders" state={{ returnTo: menuUrl }} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-chiya px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chiya focus-visible:ring-offset-2">
            <Receipt size={16} /> My orders
          </Link>
        </nav>

        {gamesAvailable ? (
          <a
            href="#games-heading"
            className="mb-3 flex min-h-14 items-center gap-3 rounded-2xl bg-bean px-3.5 py-3 text-white shadow-sm transition-colors hover:bg-[#3b3333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chiya focus-visible:ring-offset-2 sm:mb-4 sm:px-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-amber-300"><Gamepad2 size={20} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black leading-tight">Play a game while you wait</span>
              <span className="mt-0.5 block text-[11px] font-medium text-white/65">Jump to the games below</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1.5 text-[10px] font-black text-white">
              Play <ChevronDown size={13} />
            </span>
          </a>
        ) : order.status === 'pending' ? (
          <div className="mb-3 flex items-center gap-2 rounded-2xl border border-espresso/10 bg-white px-3.5 py-3 text-xs font-semibold text-bean/60 sm:mb-4">
            <Lock size={15} className="shrink-0 text-chiya" />
            <span>Games unlock once your order is confirmed. Find them below.</span>
          </div>
        ) : null}

        <motion.main
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[26px] border border-espresso/10 bg-white shadow-[0_12px_40px_rgba(70,30,30,0.07)] sm:rounded-3xl"
        >
          <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-7 sm:py-5">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-chiya">Order tracking</p>
              <h1 className="mt-0.5 text-lg font-black tracking-tight text-bean sm:text-xl">Your order</h1>
              <p className="truncate font-mono text-xs font-bold text-bean/45">{order.publicCode}</p>
            </div>
            <div className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#fff8f6] px-3 py-2 text-xs font-black text-bean sm:text-sm">
              {isTakeaway ? <ShoppingBag size={16} className="text-chiya" /> : <Armchair size={16} className="text-chiya" />}
              <span>{isTakeaway ? 'Takeaway' : `Table ${order.table}`}</span>
            </div>
          </header>

          {isTakeaway && order.queueNo != null && (
            <div className="mx-3 mb-3 flex items-center justify-between gap-3 rounded-2xl bg-chiya px-4 py-3 text-white sm:mx-6 sm:mb-4 sm:px-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><ShoppingBag size={20} /></span>
                <div><p className="text-[10px] font-black uppercase tracking-wider text-white/75">Pickup token</p><p className="text-sm font-bold">Show at the counter</p></div>
              </div>
              <span className="text-3xl font-black">#{order.queueNo}</span>
            </div>
          )}

          {message && (
            <motion.section
              key={order.status}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              aria-live="polite"
              className={`mx-3 rounded-2xl p-4 sm:mx-6 sm:p-5 ${
                isCancelled ? 'bg-red-50 text-red-950' : ['cooked', 'served'].includes(order.status) ? 'bg-emerald-50 text-emerald-950' : 'bg-gradient-to-br from-rose-50 to-orange-50 text-bean'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${isCancelled ? 'bg-red-100 text-red-700' : ['cooked', 'served'].includes(order.status) ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-chiya shadow-sm'}`}>
                  <MessageIcon size={23} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.13em] opacity-60">Current status</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-bean/65">
                      <RadioTower size={11} className="text-emerald-600" /> Live
                    </span>
                  </div>
                  <h2 className="text-xl font-black leading-tight sm:text-2xl">{message.title}</h2>
                  <p className="mt-1 text-sm font-medium leading-relaxed opacity-75">{message.text}</p>
                </div>
              </div>
            </motion.section>
          )}

          {order.queue && ['pending', 'accepted', 'preparing'].includes(order.status) && (
            <section aria-label="Estimated wait" className="mx-3 mt-3 grid grid-cols-2 divide-x divide-white/15 rounded-2xl bg-bean px-4 py-3.5 text-white sm:mx-6 sm:mt-4 sm:px-5">
              <div className="pr-3">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/55">Estimated wait</p>
                <p className="mt-0.5 text-2xl font-black leading-none">~{order.queue.estMinutes}<span className="ml-1 text-xs font-bold text-white/65">min</span></p>
              </div>
              <div className="pl-4">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/55">Kitchen queue</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-bold leading-tight">
                  <Boxes size={15} className="shrink-0 text-orange-300" />
                  {order.queue.ahead === 0 ? 'You’re next' : `${order.queue.ahead} ${order.queue.ahead === 1 ? 'order' : 'orders'} ahead`}
                </p>
              </div>
            </section>
          )}

          <div className="grid gap-4 px-3 py-4 sm:px-6 sm:py-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section aria-labelledby="progress-heading" className="min-w-0 rounded-2xl border border-espresso/10 bg-white p-3.5 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 id="progress-heading" className="text-sm font-black text-bean">Order progress</h2>
                <span className="text-[10px] font-bold text-bean/40">Updates automatically</span>
              </div>
              <StatusTimeline order={order} />
            </section>

            <section aria-labelledby="items-heading" className="min-w-0 rounded-2xl border border-espresso/10 bg-[#fffaf8] p-3.5 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 id="items-heading" className="text-sm font-black text-bean">Order summary</h2>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-bean/55">{order.items.length} {order.items.length === 1 ? 'item' : 'items'}</span>
              </div>
              <div className="divide-y divide-espresso/10">
                {order.items.map((it) => (
                  <div key={it.id} className="flex items-start justify-between gap-3 py-3 first:pt-1 last:pb-1">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="inline-flex min-w-8 shrink-0 justify-center rounded-lg bg-white px-2 py-1 text-xs font-black text-chiya">{it.qty}×</span>
                      <span className="break-words text-sm font-semibold text-bean">{it.name}</span>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-bean/65">{formatRs(it.qty * it.price)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-espresso/10 pt-3 text-sm font-black text-bean">
                <span>Total</span><span className="text-base text-chiya">{formatRs(order.total)}</span>
              </div>
            </section>
          </div>

          {!isTakeaway && order.status !== 'cancelled' && (
            <section aria-label="Need anything?" className="border-t border-espresso/10 px-3 py-4 sm:px-6 sm:py-5">
              <div className="mb-2">
                <h2 className="text-sm font-black text-bean">Need anything?</h2>
                <p className="text-xs text-bean/55">Send a quick request to our team.</p>
              </div>
              <ServiceCallButtons table={order.table} />
            </section>
          )}

          <GamesPanel order={order} />

          <footer className="border-t border-espresso/10 bg-[#fff8f6] px-4 py-3 text-center text-[11px] font-medium text-bean/45 sm:px-6">
            Order updates are live. You can keep this page open.
          </footer>
        </motion.main>
      </div>
    </div>
  );
}
