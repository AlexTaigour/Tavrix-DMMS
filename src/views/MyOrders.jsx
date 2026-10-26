import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Armchair, CheckCircle2, CircleAlert, Clock3, PackageCheck, ShoppingBag } from 'lucide-react';
import { trackOrder } from '../api/client';
import { getSocket } from '../api/socket';
import StatusBadge from '../components/StatusBadge';
import BrewingLoader from '../components/BrewingLoader';
import { formatDateTime, formatRs } from '../utils/format';
import { getTrackedOrders } from '../utils/trackedOrders';
import { groupPendingOrders } from '../utils/groupPendingOrders';

export default function MyOrders() {
  const location = useLocation();
  const returnTo = location.state?.returnTo;
  const menuUrl = typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//')
    ? returnTo
    : '/';
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const displayOrders = groupPendingOrders(orders.filter((entry) => entry.order).map((entry) => ({
    ...entry.order,
    trackingCode: entry.code,
    trackedAt: entry.at,
  })));
  const unavailableOrders = orders.filter((entry) => !entry.order);

  useEffect(() => {
    let live = true;
    const load = async () => {
      const tracked = getTrackedOrders();
      const results = await Promise.all(
        tracked.map(async ({ code, at }) => {
          try {
            return { code, at, order: await trackOrder(code), error: null };
          } catch (error) {
            return { code, at, order: null, error: error.message };
          }
        })
      );
      if (live) {
        setOrders(results.reverse());
        setLoading(false);
      }
    };

    load();
    const socket = getSocket();
    const tracked = getTrackedOrders();
    tracked.forEach(({ code }) => socket.emit('track', code));
    const onStatus = (event) => {
      if (tracked.some(({ code }) => code === event.publicCode)) load();
    };
    const onConnect = () => {
      getTrackedOrders().forEach(({ code }) => socket.emit('track', code));
      load();
    };
    socket.on('order:status', onStatus);
    socket.on('connect', onConnect);
    const interval = setInterval(load, 60_000);
    return () => {
      live = false;
      socket.off('order:status', onStatus);
      socket.off('connect', onConnect);
      clearInterval(interval);
    };
  }, []);

  if (loading) return <BrewingLoader fullscreen tone="light" label="Fetching your orders" />;

  return (
    <div className="min-h-screen bg-[#fff8f6] px-4 pb-8 pt-4 sm:pt-8">
      <div className="mx-auto max-w-3xl">
        <Link to={menuUrl} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-bean/65 transition-colors hover:bg-white hover:text-chiya">
          <ArrowLeft size={17} /> Back to menu
        </Link>
        <header className="mb-5">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-chiya">Order tracking</p>
          <h1 className="text-3xl font-black tracking-tight text-bean">My orders</h1>
          <p className="mt-1 text-sm text-bean/55">Check the live status of your recent orders.</p>
        </header>

        {orders.length === 0 ? (
          <div className="rounded-3xl border border-espresso/10 bg-white p-8 text-center shadow-sm">
            <PackageCheck size={34} className="mx-auto text-chiya" />
            <h2 className="mt-3 font-black text-bean">No saved orders yet</h2>
            <p className="mt-1 text-sm text-bean/55">Place an order or enter its tracking code from the menu page.</p>
            <Link to={menuUrl} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-chiya px-5 py-2.5 font-bold text-white">Go to menu</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {displayOrders.map(({ orders: groupedOrders, items, total }) => {
              const isGrouped = groupedOrders.length > 1;
              const order = groupedOrders[0];
              return (
              <article key={order.id || order.trackingCode} className="rounded-2xl border border-espresso/10 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        {isGrouped ? (
                          <>
                            <p className="text-sm font-black text-bean">{groupedOrders.length} pending orders combined</p>
                            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
                              {groupedOrders.map((entry) => (
                                <Link key={entry.trackingCode} to={`/track/${encodeURIComponent(entry.trackingCode)}`} state={{ returnTo: menuUrl }} className="inline-flex min-h-8 items-center rounded-lg border border-chiya/20 bg-rose-50 px-2.5 font-mono text-xs font-bold text-chiya transition-colors hover:border-chiya/40 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chiya focus-visible:ring-offset-2">
                                  {entry.publicCode}
                                </Link>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="font-mono text-sm font-black text-bean">{order.publicCode}</p>
                        )}
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-bean/55">
                          <Clock3 size={13} /> {formatDateTime(order.createdAt || new Date(order.trackedAt).toISOString())}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={order.status} />
                        {isGrouped && <span className="rounded-full bg-cream px-3 py-1 text-[10px] font-black uppercase tracking-widest text-bean/65">{groupedOrders.length} tickets</span>}
                        {order.paid && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-green-800">
                            <CheckCircle2 size={13} /> Billed
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-espresso/10 pt-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-bean/70">
                        {order.orderType === 'takeaway' ? <ShoppingBag size={16} /> : <Armchair size={16} />}
                        {order.orderType === 'takeaway' ? 'Takeaway' : `Table ${order.table}`}
                        <span className="text-bean/35">·</span>
                        <span>{items.map((item) => `${item.qty}× ${item.name}`).join(', ')}</span>
                      </div>
                      <span className="font-bold text-bean">{formatRs(total)}</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      {isGrouped ? (
                        <div className="flex flex-wrap gap-2">
                          {groupedOrders.map((entry) => (
                            <Link key={entry.trackingCode} to={`/track/${encodeURIComponent(entry.trackingCode)}`} state={{ returnTo: menuUrl }} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-chiya px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chiya focus-visible:ring-offset-2 active:scale-[0.98]">
                              Track {entry.publicCode} <ArrowRight size={14} />
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <Link to={`/track/${encodeURIComponent(order.trackingCode)}`} state={{ returnTo: menuUrl }} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-chiya px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chiya focus-visible:ring-offset-2 active:scale-[0.98]">
                          Track order <ArrowRight size={14} />
                        </Link>
                      )}
                    </div>
              </article>
            )})}
            {unavailableOrders.map(({ code, error }) => (
              <article key={code} className="rounded-2xl border border-espresso/10 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-2 text-sm text-bean/65">
                      <CircleAlert size={17} className="mt-0.5 shrink-0 text-chiya" />
                      <div><p className="font-mono font-bold text-bean">{code}</p><p className="mt-1">Could not load this order: {error}</p></div>
                    </div>
                  </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
