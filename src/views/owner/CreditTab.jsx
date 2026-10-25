import React, { useEffect, useState, useCallback } from 'react';
import { NotebookPen, Loader2, ChevronDown, ChevronUp, HandCoins, X } from 'lucide-react';
import { fetchCreditLedger, fetchCreditHistory, repayCredit } from '../../api/client';
import { formatRs, formatDateTime } from '../../utils/format';

const METHODS = ['cash', 'esewa', 'khalti', 'fonepay', 'card'];

// Udhaaro (credit) ledger: outstanding balance per customer, drill-down
// history, and repayment entry.
export default function CreditTab() {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null); // phone of expanded customer
  const [history, setHistory] = useState({}); // phone -> entries
  const [repay, setRepay] = useState(null); // customer being repaid
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    fetchCreditLedger().then(setData).catch(() => setData({ error: true }));
  }, []);

  useEffect(refresh, [refresh]);

  const toggleOpen = (phone) => {
    setOpen((cur) => (cur === phone ? null : phone));
    if (!history[phone]) {
      fetchCreditHistory(phone)
        .then((h) => setHistory((p) => ({ ...p, [phone]: h })))
        .catch(() => {});
    }
  };

  const submitRepay = async () => {
    const amt = Math.round(Number(amount));
    if (!repay || busy || !amt || amt <= 0) return;
    setBusy(true);
    setError('');
    try {
      await repayCredit({ phone: repay.phone, name: repay.name, amount: amt, method, note: '' });
      setRepay(null);
      setAmount('');
      setHistory({});
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-espresso" size={40} />
      </div>
    );
  }
  if (data.error) return <p className="text-red-500 font-bold">Failed to load the ledger.</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-espresso/10 bg-white p-5 shadow-sm">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-chiya">
            <NotebookPen size={15} /> Customer accounts
          </div>
          <h2 className="text-2xl font-black tracking-tight text-bean sm:text-3xl">Udhaaro Ledger</h2>
          <p className="mt-1 text-sm text-bean/55">Track outstanding balances and record repayments.</p>
        </div>
        <div className="rounded-xl bg-amber-50 px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800/60">Total outstanding</p>
          <p className="mt-0.5 text-2xl font-black text-amber-700">{formatRs(data.totalOutstanding)}</p>
        </div>
      </div>

      {!data.customers.length ? (
        <div className="rounded-2xl border border-dashed border-espresso/20 bg-white px-6 py-16 text-center">
          <NotebookPen size={32} className="mx-auto mb-3 text-bean/30" />
          <p className="font-bold text-bean">No outstanding credit</p>
          <p className="mt-1 text-sm text-bean/50">Customer balances will appear here when credit is recorded.</p>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {data.customers.map((c) => (
            <div key={c.phone} className="overflow-hidden rounded-2xl border border-espresso/10 bg-white shadow-sm">
              <button
                onClick={() => toggleOpen(c.phone)}
                className="flex min-h-[76px] w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-[#fff8f6]"
              >
                <div>
                  <p className="font-black text-bean">{c.name}</p>
                  <p className="text-xs text-gray-400 font-bold">{c.phone} · last {formatDateTime(c.lastAt)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <p className={`text-xl font-black ${c.balance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {formatRs(c.balance)}
                  </p>
                  {open === c.phone ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>

              {open === c.phone && (
                <div className="border-t border-espresso/10 bg-[#fff8f6] px-5 py-4">
                  <button
                    onClick={() => { setRepay(c); setAmount(String(Math.max(0, c.balance))); setError(''); }}
                    className="mb-3 flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-black text-sm transition-colors active:scale-95"
                  >
                    <HandCoins size={16} /> Record repayment
                  </button>
                  {!history[c.phone] ? (
                    <Loader2 className="animate-spin text-espresso mx-auto" size={20} />
                  ) : (
                    <div className="space-y-1.5">
                      {history[c.phone].map((e) => (
                        <div key={e.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-4 py-2.5">
                          <div>
                            <span className={`font-black ${e.amount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                              {e.amount > 0 ? 'Credit taken' : `Repaid (${e.method})`}
                            </span>
                            <span className="text-gray-400 font-bold text-xs ml-2">
                              {formatDateTime(e.createdAt)}{e.takenBy ? ` · ${e.takenBy}` : ''}
                            </span>
                          </div>
                          <span className="font-black">{formatRs(Math.abs(e.amount))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {repay && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setRepay(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-bean">Repayment — {repay.name}</h3>
              <button onClick={() => setRepay(null)} className="p-2 bg-gray-100 rounded-full"><X size={14} /></button>
            </div>
            <p className="text-xs text-gray-400 font-bold mb-3">Owes {formatRs(repay.balance)}</p>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount Rs."
              className="w-full p-3 rounded-xl border-2 border-gray-200 font-bold outline-none focus:border-chiya mb-3"
            />
            <div className="grid grid-cols-5 gap-1.5 mb-4">
              {METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`py-2 rounded-lg font-bold text-[10px] uppercase ${method === m ? 'bg-espresso text-white' : 'border-2 border-gray-100 text-gray-500'}`}
                >
                  {m}
                </button>
              ))}
            </div>
            {error && <p className="text-red-500 text-xs font-bold text-center mb-3">{error}</p>}
            <button
              onClick={submitRepay}
              disabled={busy || !Number(amount)}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3.5 rounded-xl font-black disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              Record {formatRs(Number(amount) || 0)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
