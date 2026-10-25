import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, EyeOff, Eye, X, Utensils, Search } from 'lucide-react';
import { fetchMenu, createMenuItem, updateMenuItem, deleteMenuItem } from '../../api/client';
import DietaryBadge from '../../components/DietaryBadge';

const CATEGORIES = ['Chiya', 'Coffee', 'Snack', 'Khaja', 'Sweets', 'Others'];
const EMPTY = { name: '', category: 'Chiya', price: '', image: '', description: '', cookMinutes: '', isAvailable: true, dietaryType: 'unspecified' };

const menuSaveError = (error) => {
  if (/dietary_type|dietary type/i.test(error.message || '')) {
    return 'Menu database needs the dietary-type update. Run server/menu-dietary-type.sql in Supabase SQL Editor, then restart the backend.';
  }
  return error.message;
};

export default function MenuTab() {
  const [menu, setMenu] = useState([]);
  const [modal, setModal] = useState(null); // {mode:'add'} | {mode:'edit', item}
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const refresh = () => fetchMenu().then(setMenu).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const openAdd = () => { setForm(EMPTY); setError(''); setModal({ mode: 'add' }); };
  const openEdit = (item) => {
    setForm({
      name: item.name, category: item.category, price: String(item.price), image: item.image,
      description: item.description || '',
      cookMinutes: item.cookMinutes == null ? '' : String(item.cookMinutes),
      isAvailable: item.isAvailable,
      dietaryType: item.dietaryType || 'unspecified',
    });
    setError('');
    setModal({ mode: 'edit', item });
  };

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const payload = {
      name: form.name,
      category: form.category,
      price: Math.round(Number(form.price)),
      image: form.image,
      description: form.description,
      cookMinutes: form.cookMinutes === '' ? null : Math.round(Number(form.cookMinutes)),
      isAvailable: form.isAvailable,
      dietaryType: form.dietaryType,
    };
    try {
      if (modal.mode === 'add') await createMenuItem(payload);
      else await updateMenuItem(modal.item.id, payload);
      await refresh();
      setModal(null);
    } catch (err) {
      setError(menuSaveError(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleAvailable = async (item) => {
    try {
      await updateMenuItem(item.id, {
        name: item.name, category: item.category, price: item.price, image: item.image,
        description: item.description || '', cookMinutes: item.cookMinutes ?? null,
        isAvailable: !item.isAvailable,
        dietaryType: item.dietaryType || 'unspecified',
      });
      refresh();
    } catch (err) {
      alert(menuSaveError(err));
    }
  };

  const shownMenu = menu.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()));
  const availableCount = menu.filter((item) => item.isAvailable).length;

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    try {
      await deleteMenuItem(item.id);
      refresh();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-chiya">Cafe catalogue</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-bean sm:text-3xl">Menu</h2>
          <p className="mt-1 text-sm text-bean/55">Manage items, dietary labels and availability.</p>
        </div>
        <button onClick={openAdd} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-chiya px-4 text-sm font-bold text-white shadow-sm transition hover:bg-espresso active:scale-95 sm:px-5">
          <Plus size={18} /> New Item
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-2xl border border-espresso/10 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-bean/45">Total items</p>
          <p className="mt-1 text-2xl font-black text-bean">{menu.length}</p>
        </div>
        <div className="rounded-2xl border border-espresso/10 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-bean/45">Available</p>
          <p className="mt-1 text-2xl font-black text-green-700">{availableCount}</p>
        </div>
      </div>

      <label className="relative mb-4 block sm:max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-bean/40" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search menu items"
          aria-label="Search menu items"
          className="min-h-11 w-full rounded-xl border border-espresso/10 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-chiya focus:ring-2 focus:ring-chiya/10"
        />
      </label>

      <div className="space-y-3 md:hidden">
        {shownMenu.map((item) => (
          <article key={item.id} className={`rounded-2xl border border-espresso/10 bg-white p-4 shadow-sm ${!item.isAvailable ? 'opacity-70' : ''}`}>
            <div className="flex items-start gap-3">
              {item.image ? (
                <img src={item.image} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-cream text-chiya"><Utensils size={20} /></div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-bold leading-snug text-bean">{item.name}</h3>
                <p className="mt-1 text-xs text-bean/55">{item.category} <span className="px-1">·</span> Rs. {item.price}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-bean/65">
                  <DietaryBadge dietaryType={item.dietaryType} />
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-espresso/10 pt-3">
              <button
                onClick={() => toggleAvailable(item)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-bold ${
                  item.isAvailable ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {item.isAvailable ? <Eye size={15} /> : <EyeOff size={15} />}
                {item.isAvailable ? 'Available' : 'Sold out'}
              </button>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`} className="flex h-11 w-11 items-center justify-center rounded-xl text-bean/65 hover:bg-cream hover:text-espresso"><Edit size={17} /></button>
                <button onClick={() => remove(item)} aria-label={`Delete ${item.name}`} className="flex h-11 w-11 items-center justify-center rounded-xl text-chiya hover:bg-rose-50"><Trash2 size={17} /></button>
              </div>
            </div>
          </article>
        ))}
        {!shownMenu.length && (
          <p className="rounded-2xl border border-dashed border-espresso/20 bg-white p-8 text-center text-sm text-bean/55">
            No menu items match “{search}”.
          </p>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-espresso/10 bg-white shadow-sm md:block">
        <table className="w-full text-left min-w-[760px]">
          <thead className="bg-cream text-espresso uppercase text-[10px] font-black">
            <tr>
              <th className="px-6 py-5">Item</th>
              <th className="px-6 py-5">Category</th>
              <th className="px-6 py-5">Diet</th>
              <th className="px-6 py-5">Price</th>
              <th className="px-6 py-5">Status</th>
              <th className="px-6 py-5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shownMenu.map((item) => (
              <tr key={item.id} className={`border-b border-gray-50 ${!item.isAvailable ? 'opacity-50' : ''}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {item.image ? (
                      <img src={item.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-cream" />
                    )}
                    <span className="font-black text-bean">{item.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm">{item.category}</td>
                <td className="px-6 py-4 text-sm">
                  {item.dietaryType === 'veg' ? '● Vegetarian' : item.dietaryType === 'non_veg' ? '● Non-vegetarian' : 'Not set'}
                </td>
                <td className="px-6 py-4 font-bold">Rs. {item.price}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => toggleAvailable(item)}
                    className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-full ${item.isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {item.isAvailable ? <Eye size={13} /> : <EyeOff size={13} />}
                    {item.isAvailable ? 'Available' : 'Sold out'}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(item)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit size={17} /></button>
                    <button onClick={() => remove(item)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={17} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shownMenu.length && <p className="p-8 text-center text-sm text-bean/55">No menu items match “{search}”.</p>}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form onSubmit={save} className="max-h-[90vh] max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl bg-white p-5 sm:p-8">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-bean">{modal.mode === 'add' ? 'Add Item' : 'Edit Item'}</h3>
              <button type="button" onClick={() => setModal(null)} className="p-2 bg-gray-100 rounded-full"><X size={16} /></button>
            </div>
            <input
              placeholder="Item name" required maxLength={100}
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full p-3 rounded-xl border border-gray-200"
            />
            <input
              placeholder="Image URL (optional)" maxLength={2000}
              value={form.image}
              onChange={(e) => setForm((p) => ({ ...p, image: e.target.value }))}
              className="w-full p-3 rounded-xl border border-gray-200"
            />
            <input
              type="number" placeholder="Price (Rs.)" required min={0} step={1}
              value={form.price}
              onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
              className="w-full p-3 rounded-xl border border-gray-200"
            />
            <textarea
              placeholder="Description (optional — shown to customers)" maxLength={500}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full p-3 rounded-xl border border-gray-200 h-20 resize-none"
            />
            <input
              type="number" placeholder="Cook time in minutes (optional)" min={1} max={240} step={1}
              value={form.cookMinutes}
              onChange={(e) => setForm((p) => ({ ...p, cookMinutes: e.target.value }))}
              className="w-full p-3 rounded-xl border border-gray-200"
            />
            <select
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              className="w-full p-3 rounded-xl border border-gray-200"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="block space-y-1 text-sm font-bold text-bean">
              Dietary type
              <select
                value={form.dietaryType}
                onChange={(e) => setForm((p) => ({ ...p, dietaryType: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 p-3 font-normal"
              >
                <option value="unspecified">Not set</option>
                <option value="veg">Vegetarian</option>
                <option value="non_veg">Non-vegetarian</option>
              </select>
            </label>
            <label className="flex items-center gap-2 font-bold text-sm text-bean">
              <input
                type="checkbox"
                checked={form.isAvailable}
                onChange={(e) => setForm((p) => ({ ...p, isAvailable: e.target.checked }))}
              />
              Available for ordering
            </label>
            {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setModal(null)} className="px-6 py-2 bg-gray-200 rounded-2xl font-bold">Cancel</button>
              <button type="submit" disabled={busy} className="px-6 py-2 bg-espresso text-white rounded-2xl font-black disabled:opacity-50">
                {modal.mode === 'add' ? 'Add' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
