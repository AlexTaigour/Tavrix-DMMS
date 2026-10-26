import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, LogOut, ChefHat, Loader2, LayoutDashboard, KeyRound, PackageX, X, Radio, Clock3, ClipboardList } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOrdersLive } from '../hooks/useOrdersLive';
import { useSound } from '../hooks/useSound';
import { setOrderStatus, fetchMenu, setMenuItemAvailability } from '../api/client';
import { getSocket } from '../api/socket';
import AnimatedList from '../components/reactbits/AnimatedList';
import BrewingLoader from '../components/BrewingLoader';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { toast } from '../components/Toast';
import { minutesSince } from '../utils/format';
import { groupPendingOrders } from '../utils/groupPendingOrders';

// KDS column definitions: which statuses land in which lane, and the primary
// action for each card.
const LANES = [
  { key: 'new', title: 'New', statuses: ['pending'], accent: 'border-chiya', action: { to: 'accepted', label: 'Accept order', style: 'bg-chiya hover:bg-red-700' } },
  { key: 'accepted', title: 'Accepted', statuses: ['accepted'], accent: 'border-amber-400', action: { to: 'preparing', label: 'Start preparing', style: 'bg-espresso hover:bg-bean' } },
  { key: 'preparing', title: 'Preparing', statuses: ['preparing'], accent: 'border-green-500', action: { to: 'cooked', label: 'Mark ready', style: 'bg-green-700 hover:bg-green-800' } },
];

const LATE_MINUTES = 15;

function formatElapsed(minutes) {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
}

function KdsCard({ order, action, onStatusLocal }) {
  const [busy, setBusy] = useState(false);
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const mins = minutesSince(order.createdAt);

  const act = async (to, selectedOrders = order.orders) => {
    if (busy) return;
    setBusy(true);
    const targets = selectedOrders?.length ? selectedOrders : [order];
    const undos = new Map(targets.map((target) => [target.id, onStatusLocal?.(target.id, to)]));
    const results = await Promise.allSettled(targets.map((target) => setOrderStatus(target.id, to)));
    const failures = results.flatMap((result, index) => {
      if (result.status === 'fulfilled') return [];
      undos.get(targets[index].id)?.();
      return [targets[index].publicCode];
    });
    if (failures.length) {
      toast(
        failures.length === targets.length
          ? `Could not update ${failures.join(', ')}`
          : `Some orders updated; could not update ${failures.join(', ')}`
      );
    }
    setBusy(false);
  };

  const isLate = mins >= LATE_MINUTES;
  const isTakeaway = order.orderType === 'takeaway';
  const grouped = order.orders.length > 1;

  return (
    <article className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${isLate ? 'border-red-300' : 'border-espresso/10'}`}>
      {isLate && <div className="h-1 bg-red-500" />}
      <div className="p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={`mb-1 inline-flex rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wider ${isTakeaway ? 'bg-cream text-espresso' : 'bg-rose-50 text-chiya'}`}>
            {isTakeaway ? 'Takeaway' : 'Dine in'}
          </span>
          <p className="text-3xl font-black leading-tight text-bean">
            {isTakeaway ? `#${order.queueNo ?? '–'}` : `Table ${order.table}`}
          </p>
          <p className="mt-1 truncate text-xs font-semibold text-bean/55">
            {order.name || 'Walk-in'} <span className="px-1 text-bean/25">·</span>
            {grouped ? `${order.orders.length} pending orders` : order.publicCode}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-black ${isLate ? 'bg-red-50 text-red-700' : 'bg-cream text-bean/70'}`}>
          <Clock3 size={13} /> {formatElapsed(mins)}
        </span>
      </div>
      {grouped && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-amber-800">Separate tickets · cancel individually</p>
          <div className="space-y-1">
            {order.orders.map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono font-bold text-bean">{ticket.publicCode}</span>
                <button
                  type="button"
                  onClick={() => window.confirm(`Cancel order ${ticket.publicCode}?`) && act('cancelled', [ticket])}
                  disabled={busy}
                  className="font-bold text-red-700 hover:underline disabled:opacity-50"
                >
                  Cancel ticket
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <ul className="mb-3 space-y-2.5 rounded-xl bg-[#fff8f6] p-3.5">
        {order.items.map((it) => (
          <li key={it.id} className="flex items-start gap-2.5 text-lg font-bold leading-snug text-bean">
            <span className="min-w-10 rounded-lg bg-chiya px-2 py-1 text-center text-sm font-black text-white">{it.qty}×</span>
            <span className="pt-0.5">{it.name}</span>
          </li>
        ))}
      </ul>
      {order.note && (
        <p className="mb-3 break-words rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-950">
          <span className="mb-0.5 block text-[10px] font-black uppercase tracking-wider text-amber-700">Kitchen note</span>
          {order.note}
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => act(action.to)}
          disabled={busy}
          className={`min-h-14 flex-1 rounded-xl py-3 text-base font-black text-white transition-transform active:scale-[0.98] disabled:opacity-50 ${action.style}`}
        >
          {busy ? 'Updating…' : grouped ? `${action.label.replace(' order', '')} ${order.orders.length} orders` : action.label}
        </button>
        {!grouped && (
          <button
            onClick={() => window.confirm('Cancel this order?') && act('cancelled', [order])}
            disabled={busy}
            className="min-h-14 min-w-14 rounded-xl border border-espresso/10 bg-white px-4 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            aria-label={`Cancel order ${order.publicCode}`}
            title="Cancel order"
          >
            ✕
          </button>
        )}
      </div>
      </div>
    </article>
  );
}

// Quick "86 board": kitchen flips items sold-out/back without owner access.
// Instantly removes the item from the customer menu everywhere.
function StockModal({ onClose }) {
  const [menu, setMenu] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = () => fetchMenu().then(setMenu).catch(() => {});
  useEffect(() => {
    load();
    const socket = getSocket();
    socket.on('menu:updated', load);
    return () => socket.off('menu:updated', load);
  }, []);

  const flip = async (item) => {
    if (busyId) return;
    setBusyId(item.id);
    try {
      await setMenuItemAvailability(item.id, !item.isAvailable);
      // menu:updated socket push reloads the list
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-slate-800">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <PackageX size={20} className="text-red-400" /> Out of Stock
          </h2>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-slate-300">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {!menu ? (
            <Loader2 className="animate-spin text-chiya mx-auto my-10" size={28} />
          ) : (
            menu.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                  item.isAvailable ? 'bg-slate-800' : 'bg-red-500/10 border border-red-500/30'
                }`}
              >
                <div>
                  <p className={`font-bold ${item.isAvailable ? 'text-white' : 'text-red-300 line-through'}`}>
                    {item.name}
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">{item.category}</p>
                </div>
                <button
                  onClick={() => flip(item)}
                  disabled={busyId === item.id}
                  className={`px-4 py-2 rounded-xl font-black text-xs active:scale-95 transition-all disabled:opacity-50 ${
                    item.isAvailable
                      ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                      : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                  }`}
                >
                  {busyId === item.id ? '…' : item.isAvailable ? 'Mark sold out' : 'Back in stock'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function KitchenView() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { enabled, toggle, chime } = useSound('tvx_sound_kds');
  const { orders: liveOrders, loading, applyStatusLocal } = useOrdersLive({ onNewOrder: chime });
  const [showChangePw, setShowChangePw] = useState(false);
  const [showStock, setShowStock] = useState(false);
  const [selectedLane, setSelectedLane] = useState('new');
  const orders = liveOrders || [];
  const displayOrders = groupPendingOrders(orders);
  const newCount = orders.filter((order) => order.status === 'pending').length;
  const activeCount = orders.filter((order) => ['pending', 'accepted', 'preparing'].includes(order.status)).length;
  const lateCount = orders.filter((order) => ['pending', 'accepted', 'preparing'].includes(order.status)
    && minutesSince(order.createdAt) >= LATE_MINUTES).length;

  return (
    <div className="min-h-screen bg-[#fff8f6] text-bean">
      <header className="sticky top-0 z-40 border-b border-espresso/10 bg-white/95 px-4 py-3 text-bean backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-chiya p-2.5 text-white shadow-sm">
            <ChefHat size={20} />
          </div>
          <div>
            <h1 className="text-base font-black leading-tight md:text-lg">Kitchen</h1>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-bean/45">{user?.displayName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 hidden items-center gap-1.5 rounded-full bg-green-50 px-3 py-2 text-xs font-bold text-green-700 sm:inline-flex">
            <Radio size={14} /> Live
          </span>
          <button onClick={() => setShowStock(true)} className="rounded-xl p-3 text-bean/60 transition-colors hover:bg-cream hover:text-chiya" title="Mark items sold out" aria-label="Mark items sold out">
            <PackageX size={18} />
          </button>
          {user?.role === 'owner' && (
            <button onClick={() => navigate('/owner')} className="rounded-xl p-3 text-bean/60 transition-colors hover:bg-cream hover:text-bean" title="Owner dashboard" aria-label="Owner dashboard">
              <LayoutDashboard size={18} />
            </button>
          )}
          <button onClick={toggle} className="rounded-xl p-3 text-bean/60 transition-colors hover:bg-cream hover:text-bean" title="Sound alerts" aria-label="Toggle sound alerts">
            {enabled ? <Bell size={18} /> : <BellOff size={18} className="text-red-400" />}
          </button>
          <button onClick={() => setShowChangePw(true)} className="rounded-xl p-3 text-bean/60 transition-colors hover:bg-cream hover:text-bean" title="Change my password" aria-label="Change my password">
            <KeyRound size={18} />
          </button>
          <button onClick={() => logout().then(() => navigate('/login'))} className="rounded-xl p-3 text-chiya transition-colors hover:bg-rose-50" title="Logout" aria-label="Logout">
            <LogOut size={18} />
          </button>
        </div>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <BrewingLoader tone="light" label="Loading kitchen orders" />
        </div>
      ) : (
        <main className="mx-auto flex h-[calc(100dvh-4.5rem)] max-w-[1800px] flex-col overflow-hidden p-4 md:p-6">
          <section aria-label="Kitchen queue summary" className="mb-5 grid shrink-0 gap-3 sm:grid-cols-3">
            {[
              { label: 'Orders in kitchen', value: activeCount, icon: ClipboardList, color: 'bg-chiya/10 text-chiya' },
              { label: 'New orders', value: newCount, icon: Radio, color: 'bg-amber-50 text-amber-700' },
              { label: 'Running late', value: lateCount, icon: Clock3, color: lateCount ? 'bg-red-50 text-red-700' : 'bg-cream text-bean/45' },
            ].map(({ label, value, icon: Icon, color }) => (
              <article key={label} className="flex items-center gap-3 rounded-2xl border border-espresso/10 bg-white p-4 shadow-sm">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon size={19} /></span>
                <div><p className="text-xs font-semibold text-bean/50">{label}</p><p className="mt-0.5 text-xl font-black text-bean">{value}</p></div>
              </article>
            ))}
          </section>
          <div className="mb-4 shrink-0">
            <h2 className="text-lg font-black text-bean">Kitchen queue</h2>
            <p className="mt-0.5 text-xs text-bean/55">Work oldest tickets first. Orders are flagged after {LATE_MINUTES} minutes.</p>
          </div>
          <nav aria-label="Kitchen order stages" className="mb-4 flex shrink-0 gap-2 overflow-x-auto pb-1 md:hidden">
            {LANES.map((lane) => {
              const count = displayOrders.filter((order) => lane.statuses.includes(order.status)).length;
              const active = selectedLane === lane.key;
              return (
                <button
                  key={lane.key}
                  onClick={() => setSelectedLane(lane.key)}
                  aria-pressed={active}
                  className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${active ? 'border-chiya bg-chiya text-white shadow-sm' : 'border-espresso/10 bg-white text-bean/70'}`}
                >
                  {lane.title}<span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-white/20 text-white' : 'bg-cream text-bean/65'}`}>{count}</span>
                </button>
              );
            })}
          </nav>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-3">
          {LANES.map((lane) => {
            const laneOrders = displayOrders
              .filter((o) => lane.statuses.includes(o.status))
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt)); // oldest first
            return (
              <section
                key={lane.key}
                aria-label={`${lane.title} orders`}
                className={`${lane.key === selectedLane ? 'flex' : 'hidden md:flex'} min-h-0 flex-col overflow-hidden rounded-2xl border border-espresso/10 border-t-4 bg-white shadow-sm ${lane.accent}`}
              >
                <h2 className="flex shrink-0 items-center justify-between rounded-t-xl bg-white px-4 py-4 text-sm font-black uppercase tracking-widest text-bean">
                  <span>{lane.title} orders</span>
                  <span className="rounded-full bg-cream px-3 py-1 text-xs text-bean/70">{laneOrders.length}</span>
                </h2>
                {laneOrders.length ? (
                  <AnimatedList
                    items={laneOrders}
                    keyOf={(o) => o.id}
                    className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 pb-3 pt-1 [scrollbar-gutter:stable] md:px-4"
                    renderItem={(order) => <KdsCard order={order} action={lane.action} onStatusLocal={applyStatusLocal} />}
                  />
                ) : (
                  <div className="px-4 pb-6 pt-8 text-center">
                    <ChefHat size={24} className="mx-auto mb-2 text-bean/25" />
                    <p className="text-sm font-bold text-bean/65">No {lane.title.toLowerCase()} orders</p>
                    <p className="mt-1 text-xs text-bean/40">New tickets appear here automatically.</p>
                  </div>
                )}
              </section>
            );
          })}
          </div>
        </main>
      )}

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
      {showStock && <StockModal onClose={() => setShowStock(false)} />}
    </div>
  );
}
