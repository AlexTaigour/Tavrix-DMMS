import React, { useEffect, useMemo, useState } from 'react';
import { X, Minus, Plus, ShoppingCart, Search, Loader2, AlertCircle } from 'lucide-react';
import { fetchMenu, fetchTables, placeOrder } from '../api/client';

// Staff walk-in order entry: compact menu picker, no image-heavy cards.
export default function NewOrderModal({ onClose }) {
  const [menu, setMenu] = useState([]);
  const [tables, setTables] = useState([]);
  const [cart, setCart] = useState({});
  const [form, setForm] = useState({ name: 'Walk-in', phone: '000000', table: '', orderType: 'dine', note: '' });
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [mobilePanel, setMobilePanel] = useState('menu');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchMenu(), fetchTables()]).then(([m, t]) => {
      setMenu(m.filter((i) => i.isAvailable));
      setTables(t);
    }).catch((err) => setError(err.message || 'Could not load the menu. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => ['All', ...new Set(menu.map((i) => i.category))], [menu]);
  const shown = menu.filter((item) => (
    (category === 'All' || item.category === category)
    && item.name.toLowerCase().includes(search.trim().toLowerCase())
  ));
  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ item: menu.find((m) => m.id === Number(id)), qty }))
    .filter((l) => l.item);
  const total = lines.reduce((s, l) => s + l.item.price * l.qty, 0);

  const bump = (id, delta) =>
    setCart((p) => {
      const next = (p[id] || 0) + delta;
      if (next <= 0) {
        const { [id]: _, ...rest } = p;
        return rest;
      }
      return { ...p, [id]: Math.min(next, 20) };
    });

  const takeaway = form.orderType === 'takeaway';

  const submit = async () => {
    if ((!takeaway && !form.table) || !lines.length || busy) return;
    setBusy(true);
    setError('');
    try {
      await placeOrder({
        name: form.name || 'Walk-in',
        phone: form.phone || '000000',
        orderType: form.orderType,
        table: takeaway ? undefined : form.table,
        note: form.note,
        items: lines.map((l) => ({ menuItemId: l.item.id, qty: l.qty })),
      });
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bean/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-espresso/10 bg-[#fff8f6] shadow-2xl sm:max-h-[92vh] sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-espresso/10 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-chiya">Counter service</p>
            <h2 className="mt-0.5 flex items-center gap-2 text-lg font-black text-bean sm:text-xl">
              <ShoppingCart size={19} /> New Order
            </h2>
          </div>
          <button onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl bg-cream text-bean/70 transition-colors hover:bg-rose-50 hover:text-chiya" aria-label="Close new order">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
          <nav aria-label="New order sections" className="mb-4 grid grid-cols-2 gap-2 md:hidden">
            <button
              onClick={() => setMobilePanel('menu')}
              aria-pressed={mobilePanel === 'menu'}
              className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-bold ${mobilePanel === 'menu' ? 'border-chiya bg-chiya text-white' : 'border-espresso/10 bg-white text-bean/65'}`}
            >
              Menu
            </button>
            <button
              onClick={() => setMobilePanel('details')}
              aria-pressed={mobilePanel === 'details'}
              className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-bold ${mobilePanel === 'details' ? 'border-chiya bg-chiya text-white' : 'border-espresso/10 bg-white text-bean/65'}`}
            >
              Order details{lines.length > 0 && ` · ${lines.reduce((count, line) => count + line.qty, 0)}`}
            </button>
          </nav>
          <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr] md:gap-5">
          {/* menu picker */}
          <div className={`${mobilePanel === 'menu' ? 'block' : 'hidden'} min-w-0 md:block`}>
            <label className="mb-3 flex min-h-11 items-center gap-2 rounded-xl border border-espresso/10 bg-white px-3 text-bean/45 focus-within:border-chiya">
              <Search size={17} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a menu item"
                className="w-full bg-transparent text-sm font-medium text-bean outline-none placeholder:text-bean/40"
              />
            </label>
            <div className="mb-3 flex gap-2 overflow-x-auto scrollbar-hide">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`min-h-10 shrink-0 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${category === c ? 'bg-chiya text-white' : 'border border-espresso/10 bg-white text-bean/70 hover:bg-cream'}`}
                >
                  {c}
                </button>
              ))}
            </div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-white py-12 text-sm font-semibold text-bean/50">
                <Loader2 size={18} className="animate-spin text-chiya" /> Loading menu
              </div>
            ) : error && menu.length === 0 ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                <AlertCircle size={17} className="mb-2" />{error}
              </div>
            ) : shown.length ? (
              <div className="space-y-2">
              {shown.map((item) => (
                <div key={item.id} className="flex min-h-[68px] items-center justify-between gap-3 rounded-xl border border-espresso/5 bg-white px-3 py-2.5 shadow-sm">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-bean">{item.name}</p>
                    <p className="mt-0.5 text-xs font-bold text-chiya">Rs. {item.price}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => bump(item.id, -1)} disabled={!cart[item.id]} aria-label={`Remove one ${item.name}`} className="flex h-10 w-10 items-center justify-center rounded-xl border border-espresso/10 bg-white text-bean disabled:opacity-30">
                      <Minus size={14} />
                    </button>
                    <span className="w-5 text-center text-sm font-black text-bean">{cart[item.id] || 0}</span>
                    <button onClick={() => bump(item.id, 1)} aria-label={`Add one ${item.name}`} className="flex h-10 w-10 items-center justify-center rounded-xl bg-chiya text-white transition-colors hover:bg-red-700">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-espresso/15 bg-white px-4 py-10 text-center text-sm font-semibold text-bean/50">
                No available items match this search.
              </div>
            )}
          </div>

          {/* order details */}
          <div className={`${mobilePanel === 'details' ? 'block' : 'hidden'} space-y-3 rounded-2xl border border-espresso/10 bg-white p-4 shadow-sm md:block md:p-5`}>
            <div>
              <p className="text-sm font-black text-bean">Order details</p>
              <p className="mt-0.5 text-xs text-bean/50">Choose where this order is going.</p>
            </div>
            <input
              placeholder="Customer name (optional)"
              aria-label="Customer name"
              className="min-h-11 w-full rounded-xl border border-espresso/10 bg-white px-3 py-2 text-sm outline-none focus:border-chiya"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              placeholder="Phone (optional)"
              aria-label="Customer phone"
              className="min-h-11 w-full rounded-xl border border-espresso/10 bg-white px-3 py-2 text-sm outline-none focus:border-chiya"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            />
            <div>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {['dine', 'takeaway'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm((p) => ({ ...p, orderType: t }))}
                    className={`min-h-11 rounded-xl border text-sm font-bold transition-colors ${form.orderType === t ? 'border-bean bg-bean text-white' : 'border-espresso/10 bg-white text-bean/65 hover:bg-cream'}`}
                  >
                    {t === 'dine' ? '🪑 Dine in' : '🥡 Takeaway'}
                  </button>
                ))}
              </div>
              {!takeaway && (
                <>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-bean/50">Select table</p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {tables.map((t) => (
                      <button
                        key={t}
                        onClick={() => setForm((p) => ({ ...p, table: t }))}
                        className={`min-h-10 rounded-xl border text-sm font-bold transition-colors ${form.table === t ? 'border-chiya bg-chiya text-white' : 'border-espresso/10 bg-white text-bean hover:bg-cream'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <textarea
              placeholder="Note"
              aria-label="Order note"
              className="min-h-20 w-full resize-y rounded-xl border border-espresso/10 bg-white p-3 text-sm outline-none focus:border-chiya"
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
            />
            <div className="space-y-1 rounded-xl bg-[#fff8f6] p-3">
              <p className="mb-2 flex items-center justify-between text-xs font-bold text-bean/55">
                <span>Order summary</span><span>{lines.reduce((count, line) => count + line.qty, 0)} items</span>
              </p>
              {lines.length === 0 && <p className="py-2 text-center text-xs font-medium text-bean/40">Add items from the menu</p>}
              {lines.map((l) => (
                <div key={l.item.id} className="flex justify-between text-xs font-bold">
                  <span>{l.qty}× {l.item.name}</span>
                  <span>Rs. {l.qty * l.item.price}</span>
                </div>
              ))}
              <div className="mt-2 flex justify-between border-t border-espresso/10 pt-2 font-black">
                <span>Total</span>
                <span>Rs. {total}</span>
              </div>
              </div>
            </div>
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
            <button
              onClick={submit}
              disabled={(!takeaway && !form.table) || !lines.length || busy || loading}
              className="min-h-12 w-full rounded-xl bg-chiya py-3 font-black text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Placing order…' : `Place order · Rs. ${total}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
