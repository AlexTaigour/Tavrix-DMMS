import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Armchair, CheckCircle2, CircleAlert, Clock3, PackageCheck, ShoppingBag, Trash2 } from 'lucide-react';
import { trackOrder } from '../api/client';
import { getSocket } from '../api/socket';
import StatusBadge from '../components/StatusBadge';
import BrewingLoader from '../components/BrewingLoader';
import { formatDateTime, formatRs } from '../utils/format';
import { getTrackedOrders, removeTrackedOrders } from '../utils/trackedOrders';
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

  const removeSavedOrder = (code) => {
    removeTrackedOrders([code]);
    setOrders((current) => current.filter((entry) => entry.code !== code));
  };

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
      const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
      const expiredCodes = results
        .filter(({ order }) => {
          const createdAt = Date.parse(order?.createdAt);
          return Number.isFinite(createdAt) && createdAt < cutoff;
        })
        .map(({ code }) => code);
      removeTrackedOrders(expiredCodes);
      const expiredCodeSet = new Set(expiredCodes);
      const recentResults = results.filter(({ code }) => !expiredCodeSet.has(code));
      if (live) {
        setOrders(recentResults.reverse());
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
    <div className="min-h-screen bg-[#fff8f6] px-4 pb-10 pt-4 sm:px-6 sm:pt-8">
      <div className="mx-auto max-w-2xl">
        <Link to={menuUrl} className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-espresso/10 bg-white px-4 text-sm font-bold text-bean/70 shadow-sm transition-colors hover:text-chiya focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chiya">
          <ArrowLeft size={17} /> Back to menu
        </Link>

        <header className="mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-bean to-[#542021] p-5 text-white shadow-[0_12px_30px_rgba(70,30,30,0.12)] sm:mb-6 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-orange-200">
                <PackageCheck size={25} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">Order updates</p>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">My orders</h1>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1.5 text-[10px] font-bold text-white/85">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
              Live updates
            </span>
          </div>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">
            Follow your recent orders from the kitchen to your table or pickup.
          </p>
        </header>

        {orders.length === 0 ? (
          <section className="rounded-3xl border border-espresso/10 bg-white px-5 py-9 text-center shadow-sm sm:px-8">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-chiya">
              <PackageCheck size={30} />
            </span>
            <h2 className="mt-4 text-lg font-black text-bean">No saved orders yet</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-bean/55">
              Place an order or enter its tracking code from the menu page to see updates here.
            </p>
            <Link to={menuUrl} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-chiya px-5 font-bold text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chiya focus-visible:ring-offset-2">
              Browse the menu <ArrowRight size={16} />
            </Link>
          </section>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3 px-1">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-chiya">Your activity</p>
                <h2 className="mt-0.5 text-lg font-black text-bean">Recent orders</h2>
              </div>
              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-bean/55 shadow-sm">
                {orders.length} saved {orders.length === 1 ? 'order' : 'orders'}
              </span>
            </div>

            {displayOrders.map(({ orders: groupedOrders, items, total }) => {
              const isGrouped = groupedOrders.length > 1;
              const order = groupedOrders[0];
              return (
                <article key={order.id || order.trackingCode} className="overflow-hidden rounded-3xl border border-espresso/10 bg-white shadow-[0_8px_24px_rgba(70,30,30,0.06)]">
                  <div className="border-b border-espresso/10 bg-gradient-to-r from-rose-50/80 to-white px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-bean/45">
                          {isGrouped ? `${groupedOrders.length} pending orders combined` : 'Order number'}
                        </p>
                        {isGrouped ? (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {groupedOrders.map((entry) => (
                              <span key={entry.trackingCode} className="rounded-lg border border-chiya/15 bg-white px-2 py-1 font-mono text-[11px] font-bold text-chiya">
                                {entry.publicCode}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-0.5 break-all font-mono text-base font-black tracking-wide text-bean">{order.publicCode}</p>
                        )}
                        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-bean/50">
                          <Clock3 size={13} />
                          {formatDateTime(order.createdAt || new Date(order.trackedAt).toISOString())}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={order.status} />
                        {order.paid && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-green-800">
                            <CheckCircle2 size={13} /> Billed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-cream px-3 text-xs font-bold text-bean/75">
                        {order.orderType === 'takeaway' ? <ShoppingBag size={15} className="text-chiya" /> : <Armchair size={15} className="text-chiya" />}
                        {order.orderType === 'takeaway' ? 'Takeaway' : `Table ${order.table}`}
                      </span>
                      <span className="inline-flex min-h-9 items-center rounded-xl border border-espresso/10 px-3 text-xs font-semibold text-bean/55">
                        {items.length} {items.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    <ul className="mt-3 divide-y divide-espresso/10">
                      {items.map((item) => (
                        <li key={`${item.menuItemId ?? item.id ?? item.name}-${item.price}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-1 last:pb-1">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="inline-flex h-7 min-w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 px-1.5 text-[11px] font-black text-chiya">
                              {item.qty}×
                            </span>
                            <span className="break-words text-sm font-semibold text-bean">{item.name}</span>
                          </div>
                          <span className="shrink-0 text-sm font-bold text-bean/65">{formatRs(item.qty * item.price)}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3 flex flex-col gap-3 border-t border-espresso/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-bean/45">Order total</p>
                        <p className="mt-0.5 text-lg font-black text-bean">{formatRs(total)}</p>
                      </div>
                      {isGrouped ? (
                        <div className="grid gap-2 sm:flex sm:flex-wrap">
                          {groupedOrders.map((entry) => (
                            <Link key={entry.trackingCode} to={`/track/${encodeURIComponent(entry.trackingCode)}`} state={{ returnTo: menuUrl }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-chiya px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chiya focus-visible:ring-offset-2 active:scale-[0.98]">
                              Track {entry.publicCode} <ArrowRight size={14} />
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <Link to={`/track/${encodeURIComponent(order.trackingCode)}`} state={{ returnTo: menuUrl }} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-chiya px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chiya focus-visible:ring-offset-2 active:scale-[0.98] sm:w-auto">
                          Track order <ArrowRight size={15} />
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}

            {unavailableOrders.map(({ code, error }) => (
              <article key={code} className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-950">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-red-600">
                    <CircleAlert size={19} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-black">{code}</p>
                    <p className="mt-1 break-words text-sm font-semibold">Could not load this order: {error}</p>
                  </div>
                </div>
                <div className="mt-3 border-t border-red-200/80 pt-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
                  <p className="text-xs leading-relaxed text-red-900/70">Removing it only clears this saved tracking code from this device.</p>
                  <button
                    type="button"
                    onClick={() => removeSavedOrder(code)}
                    className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 text-sm font-bold text-red-800 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 sm:mt-0 sm:w-auto sm:shrink-0"
                  >
                    <Trash2 size={15} /> Remove from My Orders
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
