import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Loader2, Armchair, CircleDollarSign, Clock3, Coffee, ShoppingBag, RefreshCw } from 'lucide-react';
import { fetchTableBoard } from '../api/client';
import { getSocket } from '../api/socket';
import { minutesSince } from '../utils/format';
import TableBillModal from './TableBillModal';

const STATE_STYLES = {
  free: {
    card: 'bg-white border-gray-100 hover:border-green-300',
    chip: 'bg-green-100 text-green-700',
    label: 'Free',
  },
  dining: {
    card: 'bg-amber-50 border-amber-200 hover:border-amber-400',
    chip: 'bg-amber-500 text-white',
    label: 'Dining',
  },
  awaiting: {
    card: 'bg-purple-50 border-purple-200 hover:border-purple-400 ring-4 ring-purple-500/10',
    chip: 'bg-purple-600 text-white animate-pulse',
    label: 'To pay',
  },
  // awaiting for too long — bill forgotten or party about to walk out
  overdue: {
    card: 'bg-red-50 border-red-400 hover:border-red-500 ring-4 ring-red-500/20',
    chip: 'bg-red-600 text-white animate-pulse',
    label: 'Unpaid!',
  },
};

const OVERDUE_MINUTES = 15;

// Live floor overview: one tile per table, click an occupied one to see the
// combined bill and take payment. Board state is server-derived, so events
// still trigger a refetch — but only events that can change the board
// (order:new, served/cancelled, settle), debounced to coalesce bursts.
export default function TableBoard() {
  const [board, setBoard] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [billTable, setBillTable] = useState(null);
  const [, forceTick] = useState(0); // re-evaluate overdue timers every 30s
  const debounceRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      setBoard(await fetchTableBoard());
      setLoadError('');
    } catch (err) {
      setLoadError(err.message || 'Could not load the floor overview.');
    }
  }, []);

  // Trailing debounce: a settle burst (settled + status events together)
  // triggers a single fetch.
  const refreshSoon = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(refresh, 300);
  }, [refresh]);

  useEffect(() => {
    refresh();
    const socket = getSocket();
    // accepted/preparing/cooked don't change table state or totals — skip them
    const onStatus = ({ status }) => {
      if (status === 'served' || status === 'cancelled') refreshSoon();
    };
    socket.on('order:new', refreshSoon);
    socket.on('order:status', onStatus);
    socket.on('orders:settled', refreshSoon);
    socket.io.on('reconnect', refresh);
    const tick = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => {
      socket.off('order:new', refreshSoon);
      socket.off('order:status', onStatus);
      socket.off('orders:settled', refreshSoon);
      socket.io.off('reconnect', refresh);
      clearInterval(tick);
      clearTimeout(debounceRef.current);
    };
  }, [refresh, refreshSoon]);

  if (!board) {
    return (
      <div className="rounded-2xl border border-espresso/10 bg-white px-6 py-14 text-center shadow-sm">
        {loadError ? (
          <>
            <p role="alert" className="font-bold text-red-700">{loadError}</p>
            <button onClick={refresh} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-chiya px-4 py-2 font-bold text-white">
              <RefreshCw size={16} /> Try again
            </button>
          </>
        ) : (
          <div className="flex justify-center py-2">
            <Loader2 className="animate-spin text-chiya" size={36} />
          </div>
        )}
      </div>
    );
  }

  const summary = [
    { label: 'Tables available', value: board.filter((table) => table.state === 'free' && table.tableNo !== 'TA').length, icon: Armchair, color: 'bg-green-50 text-green-700' },
    { label: 'Currently dining', value: board.filter((table) => table.state === 'dining').length, icon: Coffee, color: 'bg-amber-50 text-amber-700' },
    { label: 'Bills to collect', value: board.filter((table) => table.state === 'awaiting').length, icon: CircleDollarSign, color: 'bg-purple-50 text-purple-700' },
    { label: 'Takeaway queue', value: board.find((table) => table.tableNo === 'TA')?.orderCount || 0, icon: ShoppingBag, color: 'bg-chiya/10 text-chiya' },
  ];

  return (
    <>
      <section aria-label="Floor summary" className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {summary.map(({ label, value, icon: Icon, color }) => (
          <article key={label} className="flex items-center gap-3 rounded-2xl border border-espresso/10 bg-white p-3.5 shadow-sm sm:p-4">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${color}`}><Icon size={18} /></span>
            <div className="min-w-0"><p className="truncate text-xs font-semibold text-bean/50">{label}</p><p className="mt-0.5 text-lg font-black text-bean">{value}</p></div>
          </article>
        ))}
      </section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-lg font-black text-bean">Floor overview</h2><p className="mt-0.5 text-xs text-bean/50">Select an occupied table to review its bill.</p></div>
        <div className="flex flex-wrap gap-2 text-[10px] font-bold text-bean/60 sm:text-xs">
          {[
            ['bg-green-100', 'Available'],
            ['bg-amber-100', 'Dining'],
            ['bg-purple-100', 'To pay'],
            ['bg-red-100', 'Overdue'],
          ].map(([color, label]) => <span key={label} className="inline-flex items-center gap-1.5"><i className={`h-2 w-2 rounded-full ${color}`} />{label}</span>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {board.map((t) => {
          // escalate "awaiting" tables whose last order was served >15m ago
          const overdue =
            t.state === 'awaiting' &&
            t.tableNo !== 'TA' &&
            minutesSince(t.allServedSince || t.oldestAt) >= OVERDUE_MINUTES;
          const state = overdue ? 'overdue' : t.state;
          const s = STATE_STYLES[state];
          const occupied = t.state !== 'free';
          const isTakeaway = t.tableNo === 'TA';
          return (
            <button
              key={t.tableNo}
              onClick={() => occupied && setBillTable(t.tableNo)}
              disabled={!occupied}
              className={`min-h-[142px] rounded-2xl border p-3.5 text-left transition-all sm:p-4 ${s.card} ${
                occupied ? 'cursor-pointer shadow-sm hover:shadow-md active:scale-[0.98]' : 'cursor-default'
              }`}
              aria-label={`${isTakeaway ? 'Takeaway' : `Table ${t.tableNo}`}: ${occupied ? `${t.orderCount} orders, Rs. ${t.total}, ${s.label}` : 'Available'}`}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isTakeaway ? <ShoppingBag size={18} className="text-chiya" /> : <Armchair size={18} className={occupied ? 'text-espresso' : 'text-gray-300'} />}
                  <span className="text-xl font-black text-bean">{isTakeaway ? 'Takeaway' : `Table ${t.tableNo}`}</span>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${s.chip}`}>
                  {isTakeaway && occupied ? `${t.orderCount} open` : s.label}
                </span>
              </div>
              {occupied ? (
                <>
                  <p className="text-2xl font-black text-bean">Rs. {t.total}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-bean/50">
                    <Clock3 size={12} /> {t.orderCount} {t.orderCount === 1 ? 'order' : 'orders'} <span className="text-bean/25">·</span> {minutesSince(t.oldestAt)}m
                  </p>
                  {state === 'overdue' ? (
                    <p className="mt-2 rounded-lg bg-red-100 px-2.5 py-2 text-xs font-bold text-red-700">
                      Payment overdue · {minutesSince(t.allServedSince || t.oldestAt)}m
                    </p>
                  ) : t.state === 'awaiting' ? (
                    <p className="mt-2 text-xs font-bold text-purple-700">Tap to collect payment →</p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm font-semibold text-green-700">Ready for guests</p>
              )}
            </button>
          );
        })}
      </div>

      {billTable && (
        <TableBillModal tableNo={billTable} onClose={() => setBillTable(null)} />
      )}
    </>
  );
}
