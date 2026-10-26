import React, { useState } from 'react';
import { Clock, Printer, ShoppingBag, Armchair, Loader2 } from 'lucide-react';
import StatusBadge, { ACTIONS } from './StatusBadge';
import { formatDateTime } from '../utils/format';
import { printBill } from '../utils/printBill';
import { setOrderStatus } from '../api/client';
import { toast } from './Toast';

// Shared order card for staff + owner views. Kitchen has its own compact KDS card.
export default function OrderCard({ order, role, onStatusLocal }) {
  const [busy, setBusy] = useState(false);
  const actions = ACTIONS[role]?.[order.status] || [];

  const doAction = async (to, target = order) => {
    if (busy) return;
    setBusy(true);
    // Optimistic: the card updates instantly; the save happens in the
    // background and the socket push re-confirms (idempotent re-apply).
    const undo = onStatusLocal?.(target.id, to);
    try {
      await setOrderStatus(target.id, to);
    } catch (err) {
      undo?.(); // conditional — a concurrent user's pushed status wins
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };
  const grouped = order.orders?.length > 1;

  return (
    <article className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${order.status === 'pending' ? 'border-amber-200' : order.status === 'cooked' ? 'border-purple-200' : 'border-espresso/10'}`}>
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <StatusBadge status={order.status} />
            <h3 className="mt-2 truncate text-lg font-black text-bean">{order.name || 'Walk-in'}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs font-semibold text-bean/50">
              <Clock size={12} /> {formatDateTime(order.createdAt)} <span className="text-bean/25">·</span> {grouped ? `${order.orders.length} pending tickets` : order.publicCode}
              {order.source === 'staff' && <span className="ml-1 rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold text-bean/60">Counter order</span>}
            </p>
          </div>
          <div className="flex min-w-[76px] shrink-0 flex-col items-center justify-center rounded-xl border border-chiya/15 bg-rose-50 px-3 py-2">
            {order.orderType === 'takeaway' ? (
              <>
                <ShoppingBag size={15} className="mb-1 text-chiya" />
                <p className="text-[10px] font-bold uppercase text-bean/50">Token</p>
                <p className="text-xl font-black text-chiya">#{order.queueNo ?? '–'}</p>
              </>
            ) : (
              <>
                <Armchair size={15} className="mb-1 text-chiya" />
                <p className="text-[10px] font-bold uppercase text-bean/50">Table</p>
                <p className="text-xl font-black text-chiya">{order.table}</p>
              </>
            )}
          </div>
        </div>

        {order.note && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">Customer note</p>
            <p className="mt-1 break-words text-sm font-medium text-amber-950">{order.note}</p>
          </div>
        )}

        <div className="mb-4 space-y-2 rounded-xl bg-[#fff8f6] p-3.5">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
              <span className="font-semibold text-bean"><span className="mr-2 inline-block min-w-7 rounded-md bg-white px-1.5 py-0.5 text-center text-xs font-black text-chiya">{item.qty}×</span>{item.name}</span>
              <span className="shrink-0 font-semibold text-bean/60">Rs. {item.price * item.qty}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-bean/45">Order total</p>
            <p className="text-xl font-black text-bean">Rs. {order.total}</p>
          </div>
          {!grouped && (
            <div className="flex gap-2 flex-wrap justify-end">
              <button
                onClick={() => printBill(order)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-espresso/10 bg-white text-bean/60 transition-colors hover:bg-cream hover:text-bean"
                title="Print bill"
                aria-label="Print bill"
              >
                <Printer size={20} />
              </button>
              {actions.map((a) => (
                <button
                  key={a.to}
                  onClick={() => doAction(a.to)}
                  disabled={busy}
                  className={`min-h-11 rounded-xl px-4 py-2 text-xs font-bold text-white transition-colors disabled:opacity-50 ${a.style}`}
                >
                  {busy ? <><Loader2 size={14} className="mr-1 inline animate-spin" />Updating</> : a.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {grouped && (
          <div className="mt-4 space-y-2 border-t border-espresso/10 pt-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-bean/45">Separate tickets · actions apply per order</p>
            {order.orders.map((ticket) => (
              <div key={ticket.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-cream/50 px-3 py-2">
                <span className="font-mono text-xs font-bold text-bean">{ticket.publicCode}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => printBill(ticket)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-espresso/10 bg-white px-2.5 text-xs font-bold text-bean/65 hover:text-bean"
                    aria-label={`Print bill for ${ticket.publicCode}`}
                  >
                    <Printer size={14} /> Receipt
                  </button>
                  {(ACTIONS[role]?.[ticket.status] || []).map((action) => (
                    <button
                      key={action.to}
                      onClick={() => doAction(action.to, ticket)}
                      disabled={busy}
                      className={`min-h-9 rounded-lg px-3 text-xs font-bold text-white disabled:opacity-50 ${action.style}`}
                    >
                      {busy ? 'Updating…' : action.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
