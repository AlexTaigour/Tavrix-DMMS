import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Clock3, History, Loader2, ReceiptText, XCircle } from 'lucide-react';
import { fetchOrderHistory } from '../../api/client';
import { getSocket } from '../../api/socket';
import { formatDateTime, formatRs, formatTime } from '../../utils/format';
import StatusBadge from '../../components/StatusBadge';

const METHOD_LABELS = {
  cash: 'Cash', esewa: 'eSewa', khalti: 'Khalti', fonepay: 'Fonepay', card: 'Card', credit: 'Udhaaro',
};

const toDayInput = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const PRESETS = [
  { key: 'today', label: 'Today', days: 0 },
  { key: 'yesterday', label: 'Yesterday', days: 1 },
  { key: '7d', label: 'Last 7 days', days: 6 },
];

// Owner's order history: who ordered what, when, and when it was paid.
// Items + payment arrive embedded on each order — expansion is client-only.
export default function OrderHistoryTab() {
  const [preset, setPreset] = useState('today');
  const [fromDay, setFromDay] = useState(() => toDayInput(new Date()));
  const [toDay, setToDay] = useState(() => toDayInput(new Date()));
  const [orders, setOrders] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // half-open [from, to): from = start of fromDay, to = start of the day after toDay
  const fromIso = new Date(`${fromDay}T00:00:00`).toISOString();
  const toIso = new Date(new Date(`${toDay}T00:00:00`).getTime() + 864e5).toISOString();

  const load = useCallback(() => {
    setOrders(null);
    setExpandedId(null);
    fetchOrderHistory(fromIso, toIso)
      .then(setOrders)
      .catch(() => setOrders({ error: true }));
  }, [fromIso, toIso]);

  useEffect(load, [load]);

  // Live: a settle can flip rows in the visible range from Unpaid → Paid.
  // Refetch (server-derived payment join) but only when the range covers now.
  const rangeCoversNow = useRef(false);
  rangeCoversNow.current = new Date(fromIso) <= new Date() && new Date() < new Date(toIso);
  useEffect(() => {
    const socket = getSocket();
    let timer = null;
    const onSettled = () => {
      if (!rangeCoversNow.current) return;
      clearTimeout(timer);
      timer = setTimeout(load, 300); // debounce settle bursts
    };
    socket.on('orders:settled', onSettled);
    return () => {
      clearTimeout(timer);
      socket.off('orders:settled', onSettled);
    };
  }, [load]);

  const applyPreset = (p) => {
    setPreset(p.key);
    const end = new Date();
    end.setDate(end.getDate() - (p.key === 'yesterday' ? 1 : 0));
    const start = new Date(end);
    start.setDate(start.getDate() - (p.key === '7d' ? p.days : 0));
    setFromDay(toDayInput(start));
    setToDay(toDayInput(end));
  };

  const onDateChange = (setter) => (e) => {
    setPreset('custom');
    setter(e.target.value);
  };
  const paidCount = orders && !orders.error ? orders.filter((order) => order.paid && order.payment).length : 0;
  const cancelledCount = orders && !orders.error ? orders.filter((order) => order.status === 'cancelled').length : 0;
  const openCount = orders && !orders.error
    ? orders.filter((order) => !order.paid && order.status !== 'cancelled').length
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-espresso/10 bg-white p-5 shadow-sm xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-chiya">
            <History size={15} /> Sales records
          </div>
          <h2 className="text-2xl font-black tracking-tight text-bean sm:text-3xl">Order History</h2>
          <p className="mt-1 text-sm text-bean/55">Review orders, payment status, and customer details by date.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#fff8f6] p-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p)}
              className={`min-h-10 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                preset === p.key
                  ? 'bg-chiya text-white shadow-sm'
                  : 'bg-white text-bean/70 hover:bg-cream'
              }`}
            >
              {p.label}
            </button>
          ))}
          <input
            type="date"
            value={fromDay}
            max={toDay}
            onChange={onDateChange(setFromDay)}
            aria-label="Start date"
            className="min-h-10 rounded-lg border border-espresso/10 bg-white px-3 py-2 text-sm font-semibold text-bean outline-none focus:border-chiya"
          />
          <span className="text-xs font-semibold text-bean/45">to</span>
          <input
            type="date"
            value={toDay}
            min={fromDay}
            onChange={onDateChange(setToDay)}
            aria-label="End date"
            className="min-h-10 rounded-lg border border-espresso/10 bg-white px-3 py-2 text-sm font-semibold text-bean outline-none focus:border-chiya"
          />
        </div>
      </div>

      {orders && !orders.error && (
        <section aria-label="Order summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Orders in range', value: orders.length, icon: ReceiptText, color: 'bg-chiya/10 text-chiya' },
            { label: 'Paid orders', value: paidCount, icon: CheckCircle2, color: 'bg-green-50 text-green-700' },
            { label: 'Open bills', value: openCount, icon: Clock3, color: 'bg-amber-50 text-amber-700' },
            { label: 'Cancelled', value: cancelledCount, icon: XCircle, color: 'bg-gray-100 text-gray-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <article key={label} className="flex items-center gap-3 rounded-2xl border border-espresso/10 bg-white p-4 shadow-sm">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon size={19} /></span>
              <div><p className="text-xs font-semibold text-bean/50">{label}</p><p className="mt-0.5 text-xl font-black text-bean">{value}</p></div>
            </article>
          ))}
        </section>
      )}

      {!orders ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-espresso" size={40} />
        </div>
      ) : orders.error ? (
        <p className="text-red-500 font-bold">Failed to load order history.</p>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-espresso/20 bg-white px-6 py-16 text-center">
          <History size={28} className="mx-auto mb-3 text-bean/30" />
          <p className="font-bold text-bean">No orders in this date range</p>
          <p className="mt-1 text-sm text-bean/50">Choose another date range to view past orders.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-espresso/10 bg-white shadow-sm">
          <table className="w-full text-left min-w-[860px]">
            <thead className="bg-cream text-espresso uppercase text-[10px] font-black tracking-widest">
              <tr>
                <th className="px-5 py-4">Time</th>
                <th className="px-5 py-4">Code</th>
                <th className="px-5 py-4">Customer</th>
                <th className="px-5 py-4">Table</th>
                <th className="px-5 py-4">Items</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Payment</th>
                <th className="px-5 py-4 text-right">Total</th>
                <th className="px-3 py-4" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <React.Fragment key={o.id}>
                  <tr
                    onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}
                    className="border-b border-gray-50 hover:bg-cream/40 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5 font-bold text-bean whitespace-nowrap">{formatTime(o.createdAt)}</td>
                    <td className="px-5 py-3.5 text-xs font-black text-gray-400">{o.publicCode}</td>
                    <td className="px-5 py-3.5 font-bold text-bean">{o.name || 'Walk-in'}</td>
                    <td className="px-5 py-3.5 font-black text-espresso">
                      {o.table === 'TA' ? `Takeaway${o.queueNo ? ` #${o.queueNo}` : ''}` : o.table}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 font-bold max-w-[220px]">
                      <span className="line-clamp-1">
                        {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={o.status} /></td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {o.paid && o.payment ? (
                        <span className="text-green-600 font-black text-xs">
                          Paid {formatTime(o.payment.createdAt)} · {METHOD_LABELS[o.payment.method] || o.payment.method}
                        </span>
                      ) : o.status === 'cancelled' ? (
                        <span className="text-gray-300 font-black text-xs">—</span>
                      ) : (
                        <span className="text-amber-500 font-black text-xs">Unpaid</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-black text-bean whitespace-nowrap">{formatRs(o.total)}</td>
                    <td className="px-3 py-3.5">
                      <ChevronDown
                        size={16}
                        className={`text-gray-300 transition-transform ${expandedId === o.id ? 'rotate-180' : ''}`}
                      />
                    </td>
                  </tr>
                  {expandedId === o.id && (
                    <tr className="border-b border-gray-50 bg-cream/30">
                      <td colSpan={9} className="px-5 py-5">
                        <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Items</p>
                            {o.items.map((it) => (
                              <div key={it.id} className="flex justify-between py-1.5 border-b border-gray-100 last:border-0 text-sm">
                                <span className="font-bold text-bean">{it.qty}× {it.name}</span>
                                <span className="font-black text-espresso">{formatRs(it.price * it.qty)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between pt-2 text-sm">
                              <span className="font-black text-bean uppercase text-xs tracking-widest">Total</span>
                              <span className="font-black text-chiya">{formatRs(o.total)}</span>
                            </div>
                            {o.note && (
                              <p className="mt-3 text-xs font-bold text-gray-500 bg-white rounded-xl px-3 py-2">📝 {o.note}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Details</p>
                            <div className="text-sm space-y-1.5 font-bold text-gray-500">
                              <p>Ordered: <span className="text-bean">{formatDateTime(o.createdAt)}</span></p>
                              {o.phone && <p>Phone: <span className="text-bean">{o.phone}</span></p>}
                              <p>Source: <span className="text-bean capitalize">{o.source}</span></p>
                            </div>
                            {o.paid && o.payment ? (
                              <div className="mt-3 bg-green-50 rounded-2xl px-4 py-3 text-sm space-y-1 font-bold text-green-800">
                                <p className="text-[10px] font-black uppercase tracking-widest text-green-500">Payment</p>
                                <p>Paid: {formatDateTime(o.payment.createdAt)}</p>
                                <p>Method: {METHOD_LABELS[o.payment.method] || o.payment.method}</p>
                                {o.payment.discount > 0 && <p>Discount: {formatRs(o.payment.discount)}</p>}
                                {o.payment.takenBy && <p>Taken by: {o.payment.takenBy}</p>}
                              </div>
                            ) : o.status !== 'cancelled' ? (
                              <p className="mt-3 bg-amber-50 text-amber-600 rounded-2xl px-4 py-3 text-xs font-black">
                                Not paid yet — bill is still open.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
