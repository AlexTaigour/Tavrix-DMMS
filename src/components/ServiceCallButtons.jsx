import React, { useEffect, useState } from 'react';
import { ConciergeBell, ReceiptText, Check, Loader2 } from 'lucide-react';
import { createServiceCall } from '../api/client';

// "Call waiter" / "Ask for bill" — shown on the tracking page for dine-in
// orders. The server debounces repeat presses (one open call per kind/table).
export default function ServiceCallButtons({ table }) {
  const [sent, setSent] = useState({}); // kind -> true
  const [busy, setBusy] = useState('');

  // Let the customer call again after a while (staff may have resolved it).
  useEffect(() => {
    if (!Object.keys(sent).length) return;
    const t = setTimeout(() => setSent({}), 120_000);
    return () => clearTimeout(t);
  }, [sent]);

  const call = async (kind) => {
    if (busy || sent[kind]) return;
    setBusy(kind);
    try {
      await createServiceCall(table, kind);
      setSent((p) => ({ ...p, [kind]: true }));
    } catch {
      // non-fatal — the customer can always wave
    } finally {
      setBusy('');
    }
  };

  const btn = (kind, Icon, label, sentLabel) => (
    <button
      type="button"
      onClick={() => call(kind)}
      disabled={busy === kind || sent[kind]}
      className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-black transition-all active:scale-[0.98] sm:rounded-2xl sm:py-3.5 sm:text-sm ${
        sent[kind]
          ? 'bg-green-50 text-green-600 border-2 border-green-200'
          : 'bg-white text-espresso border-2 border-espresso/15 hover:border-chiya shadow-sm'
      }`}
    >
      {busy === kind ? (
        <Loader2 size={16} className="shrink-0 animate-spin" />
      ) : sent[kind] ? (
        <Check size={16} className="shrink-0" />
      ) : (
        <Icon size={16} className="shrink-0" />
      )}
      <span className="truncate">{sent[kind] ? sentLabel : label}</span>
    </button>
  );

  return (
    <div className="mt-3 flex gap-2 sm:gap-3">
      {btn('waiter', ConciergeBell, 'Call waiter', 'Staff notified')}
      {btn('bill', ReceiptText, 'Ask for bill', 'Bill requested')}
    </div>
  );
}
