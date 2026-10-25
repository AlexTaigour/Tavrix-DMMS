import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, LogOut, Coffee, Plus, LayoutDashboard, KeyRound, Armchair, ClipboardList, CheckCircle2, ChefHat, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOrdersLive } from '../hooks/useOrdersLive';
import { useSound } from '../hooks/useSound';
import OrderCard from '../components/OrderCard';
import AnimatedList from '../components/reactbits/AnimatedList';
import NewOrderModal from '../components/NewOrderModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import TableBoard from '../components/TableBoard';
import ServiceCallsBar from '../components/ServiceCallsBar';
import BrewingLoader from '../components/BrewingLoader';

export default function StaffView() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { enabled, toggle, chime } = useSound();
  const { orders: liveOrders, loading, applyStatusLocal } = useOrdersLive({ onNewOrder: chime });
  const [showChangePw, setShowChangePw] = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [tab, setTab] = useState('orders'); // orders | tables
  const [filter, setFilter] = useState('all');

  const orders = liveOrders || [];
  const visible = useMemo(() => {
    if (filter === 'ready') return orders.filter((o) => o.status === 'cooked');
    return orders;
  }, [orders, filter]);

  const readyCount = orders.filter((o) => o.status === 'cooked').length;
  const newCount = orders.filter((o) => o.status === 'pending').length;
  const cookingCount = orders.filter((o) => ['accepted', 'preparing'].includes(o.status)).length;

  return (
    <div className="min-h-screen bg-[#fff8f6] text-bean">
      <header className="sticky top-0 z-40 border-b border-espresso/10 bg-white/95 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-chiya p-2.5 text-white shadow-sm">
            <Coffee size={20} />
          </div>
          <div>
            <h1 className="text-base font-black leading-tight text-bean md:text-lg">Counter</h1>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-bean/45">
              {user?.displayName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 hidden items-center gap-1.5 rounded-full bg-green-50 px-3 py-2 text-xs font-bold text-green-700 sm:inline-flex">
            <Radio size={14} /> Live
          </span>
          {user?.role === 'owner' && (
            <button
              onClick={() => navigate('/owner')}
              className="rounded-xl p-3 text-bean/60 transition-colors hover:bg-cream hover:text-bean"
              title="Owner dashboard"
              aria-label="Owner dashboard"
            >
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

      <main className="mx-auto max-w-[1600px] p-4 md:p-8">
        <ServiceCallsBar />
        {/* Orders = per-order workflow; Tables = floor overview + take payment */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-espresso/10 bg-white p-1 shadow-sm">
          <button
            onClick={() => setTab('orders')}
            className={`flex min-h-11 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${tab === 'orders' ? 'bg-chiya text-white shadow-sm' : 'text-bean/65 hover:bg-cream'}`}
          >
            <ClipboardList size={16} /> Orders
          </button>
          <button
            onClick={() => setTab('tables')}
            className={`flex min-h-11 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${tab === 'tables' ? 'bg-chiya text-white shadow-sm' : 'text-bean/65 hover:bg-cream'}`}
          >
            <Armchair size={16} /> Tables
          </button>
          </div>
          {tab === 'orders' && (
            <button
              onClick={() => setShowNewOrder(true)}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-chiya px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-700"
            >
              <Plus size={18} /> New Order
            </button>
          )}
        </div>

        {tab === 'tables' ? (
          <TableBoard />
        ) : (
          <>
        <section aria-label="Live order summary" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Active orders', value: orders.length, icon: ClipboardList, color: 'bg-chiya/10 text-chiya' },
            { label: 'New', value: newCount, icon: Radio, color: 'bg-amber-50 text-amber-700' },
            { label: 'In kitchen', value: cookingCount, icon: ChefHat, color: 'bg-blue-50 text-blue-700' },
            { label: 'Ready to serve', value: readyCount, icon: CheckCircle2, color: 'bg-purple-50 text-purple-700' },
          ].map(({ label, value, icon: Icon, color }) => (
            <article key={label} className="flex items-center gap-3 rounded-2xl border border-espresso/10 bg-white p-4 shadow-sm">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon size={19} /></span>
              <div><p className="text-xs font-semibold text-bean/50">{label}</p><p className="mt-0.5 text-xl font-black text-bean">{value}</p></div>
            </article>
          ))}
        </section>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-bean">Order queue</h2>
            <p className="mt-0.5 text-xs text-bean/50">Updates live as orders move through service.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`min-h-10 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${filter === 'all' ? 'bg-bean text-white' : 'border border-espresso/10 bg-white text-bean/65 hover:bg-cream'}`}
            >
              All <span className="ml-1 opacity-70">{orders.length}</span>
            </button>
            <button
              onClick={() => setFilter('ready')}
              className={`min-h-10 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${filter === 'ready' ? 'bg-purple-700 text-white' : 'border border-purple-100 bg-white text-purple-700 hover:bg-purple-50'}`}
            >
              Ready <span className="ml-1 opacity-70">{readyCount}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <BrewingLoader tone="light" label="Loading orders" />
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-espresso/20 bg-white px-6 py-16 text-center">
            <Coffee size={32} className="mx-auto mb-3 text-bean/30" />
            <p className="font-bold text-bean">{filter === 'ready' ? 'Nothing waiting to be served' : 'No active orders right now'}</p>
            <p className="mt-1 text-sm text-bean/50">{filter === 'ready' ? 'Ready orders will appear here.' : 'New customer orders will show up here automatically.'}</p>
          </div>
        ) : (
          <AnimatedList
            items={visible}
            keyOf={(o) => o.id}
            className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5"
            renderItem={(order) => <OrderCard order={order} role={user?.role === 'owner' ? 'owner' : 'staff'} onStatusLocal={applyStatusLocal} />}
          />
        )}
          </>
        )}
      </main>

      {showNewOrder && <NewOrderModal onClose={() => setShowNewOrder(false)} />}
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </div>
  );
}
