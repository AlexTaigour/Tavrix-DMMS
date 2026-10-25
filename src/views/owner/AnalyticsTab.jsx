import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, Clock3, ClipboardList,
  Loader2, Menu as MenuIcon, ReceiptText, RefreshCw, ShoppingBag, TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { analytics } from '../../api/client';
import CountUp from '../../components/reactbits/CountUp';
import { formatRs } from '../../utils/format';

const RANGES = {
  Today: () => new Date(new Date().setHours(0, 0, 0, 0)),
  Week: () => new Date(Date.now() - 7 * 864e5),
  Month: () => new Date(Date.now() - 30 * 864e5),
  '6 Months': () => new Date(Date.now() - 182 * 864e5),
  Year: () => new Date(Date.now() - 365 * 864e5),
  'All Time': () => null,
};

function Metric({ label, value, prefix = '', note, icon: Icon, tone = 'red' }) {
  const tones = {
    red: 'bg-rose-50 text-chiya',
    green: 'bg-green-50 text-green-700',
    neutral: 'bg-[#f5f1ef] text-bean',
    amber: 'bg-amber-50 text-amber-700',
  };

  return (
    <article className="rounded-2xl border border-espresso/10 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-bean/55">{label}</p>
          <CountUp value={value} prefix={prefix} className="mt-2 block text-2xl font-black tracking-tight text-bean sm:text-3xl" />
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon size={19} />
        </span>
      </div>
      {note && <p className="mt-3 text-xs leading-relaxed text-bean/50">{note}</p>}
    </article>
  );
}

function QuickLink({ to, icon: Icon, title, description }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-espresso/10 bg-white p-3 transition hover:border-chiya/30 hover:bg-rose-50/40"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream text-espresso transition group-hover:bg-rose-100 group-hover:text-chiya">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-bean">{title}</span>
        <span className="mt-0.5 block text-xs text-bean/50">{description}</span>
      </span>
      <ArrowRight size={16} className="shrink-0 text-bean/30 transition group-hover:translate-x-0.5 group-hover:text-chiya" />
    </Link>
  );
}

export default function AnalyticsTab() {
  const [range, setRange] = useState('Today');
  const [data, setData] = useState(null);
  const [retry, setRetry] = useState(0);

  const from = useMemo(() => {
    const date = RANGES[range]();
    return date ? date.toISOString() : undefined;
  }, [range]);

  useEffect(() => {
    let live = true;
    setData(null);
    Promise.all([
      analytics.summary(from),
      analytics.salesByDay(from),
      analytics.topItems(from),
      analytics.peakHours(from),
      analytics.prepTimes(from),
    ]).then(([summary, salesByDay, topItems, peakHours, prepTimes]) => {
      if (live) setData({ summary, salesByDay, topItems, peakHours, prepTimes });
    }).catch((error) => {
      if (live) setData({ error: error.message || 'Could not load the owner overview.' });
    });
    return () => { live = false; };
  }, [from, retry]);

  const period = range === 'Today' ? 'today' : range === 'Week' ? 'the last 7 days' : range === 'Month' ? 'the last 30 days' : range.toLowerCase();

  if (!data) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-medium text-bean/55">
          <Loader2 className="animate-spin text-chiya" size={22} /> Preparing your overview…
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
        <p className="font-bold text-bean">We couldn’t load the owner overview</p>
        <p className="mt-2 text-sm text-bean/55">{data.error}</p>
        <button
          onClick={() => setRetry((current) => current + 1)}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-chiya px-4 text-sm font-bold text-white hover:bg-espresso"
        >
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    );
  }

  const { summary, salesByDay, topItems, peakHours, prepTimes } = data;
  const bestSeller = topItems[0];
  const totalAttempts = summary.orderCount + summary.cancelledCount;
  const cancellationRate = totalAttempts
    ? Math.round((summary.cancelledCount / totalAttempts) * 100)
    : 0;
  const chartData = salesByDay.map((day) => ({
    ...day,
    label: new Date(`${day.day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }));
  const busiestHour = peakHours.reduce(
    (busiest, current) => current.orders > (busiest?.orders || 0) ? current : busiest,
    null
  );
  const busiestHourLabel = busiestHour?.orders
    ? new Date(2000, 0, 1, busiestHour.hour).toLocaleTimeString(undefined, { hour: 'numeric' })
    : null;

  return (
    <div className="mx-auto max-w-[1500px]">
      <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-chiya">Your cafe at a glance</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-bean sm:text-3xl">
            {range === 'Today' ? 'Today’s overview' : 'Business overview'}
          </h2>
          <p className="mt-1 text-sm text-bean/55">Sales, collections, and what’s working {period}.</p>
        </div>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-espresso/10 bg-white px-3 shadow-sm">
          <CalendarDays size={17} className="text-chiya" />
          <span className="sr-only">Report range</span>
          <select
            value={range}
            onChange={(event) => setRange(event.target.value)}
            className="min-h-10 bg-transparent pr-2 text-sm font-semibold text-bean outline-none"
          >
            {Object.keys(RANGES).map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </section>

      <section aria-label="Business performance" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Sales"
          value={summary.revenue}
          prefix="Rs. "
          icon={TrendingUp}
          tone="red"
          note={`Order value, excluding cancelled orders ${period}.`}
        />
        <Metric
          label="Collected"
          value={summary.collected}
          prefix="Rs. "
          icon={ArrowDownLeft}
          tone="green"
          note="Payments actually recorded in this period."
        />
        <Metric
          label="Orders"
          value={summary.orderCount}
          icon={ShoppingBag}
          tone="neutral"
          note={summary.cancelledCount ? `${summary.cancelledCount} cancelled · ${cancellationRate}% of all orders` : `Completed and active orders ${period}.`}
        />
        <Metric
          label="Average order"
          value={summary.avgOrderValue}
          prefix="Rs. "
          icon={ReceiptText}
          tone="amber"
          note={prepTimes.avgPrepMinutes == null ? 'Average spend per non-cancelled order.' : `Average spend · ${prepTimes.avgPrepMinutes} min average prep`}
        />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <section className="rounded-2xl border border-espresso/10 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-bean">Sales trend</h3>
              <p className="mt-1 text-xs text-bean/50">Daily sales totals · {period}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {prepTimes.avgPrepMinutes != null && (
                <span className="rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-espresso">
                  Avg prep {prepTimes.avgPrepMinutes} min
                </span>
              )}
              {busiestHourLabel && (
                <span className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-chiya">
                  Busiest {busiestHourLabel}
                </span>
              )}
            </div>
          </div>
          {chartData.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#f0e9e6" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#847a76' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#847a76' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: '#fff8f6' }}
                  formatter={(value, name) => [name === 'revenue' ? formatRs(value) : value, name === 'revenue' ? 'Sales' : 'Orders']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #eee5e1', fontSize: 12 }}
                />
                <Bar dataKey="revenue" name="revenue" fill="#c62832" radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] flex-col items-center justify-center rounded-xl bg-[#fffaf8] text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-chiya"><TrendingUp size={20} /></span>
              <p className="mt-3 text-sm font-semibold text-bean">No sales in this period yet</p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-bean/50">Once orders come in, your daily sales trend will appear here.</p>
            </div>
          )}
        </section>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
          <section className="rounded-2xl border border-espresso/10 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-bean">Top sellers</h3>
                <p className="mt-1 text-xs text-bean/50">Most ordered items · {period}</p>
              </div>
              <ShoppingBag size={17} className="text-chiya" />
            </div>
            {bestSeller ? (
              <div className="space-y-4">
                {topItems.slice(0, 5).map((item, index) => {
                  const maxQty = bestSeller.qty || 1;
                  return (
                    <div key={item.name}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-semibold text-bean">
                          <span className="mr-2 text-xs font-bold text-bean/35">{String(index + 1).padStart(2, '0')}</span>
                          {item.name}
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-bean/55">{item.qty} sold</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-cream">
                        <div className="h-full rounded-full bg-chiya" style={{ width: `${(item.qty / maxQty) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl bg-[#fffaf8] px-4 py-6 text-center">
                <p className="text-sm font-semibold text-bean">Your best sellers will show here</p>
                <p className="mt-1 text-xs text-bean/50">Items rank here after they’re ordered.</p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-espresso/10 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="mb-3 font-bold text-bean">Owner shortcuts</h3>
            <div className="grid gap-2">
              <QuickLink to="/owner/day-report" icon={ClipboardList} title="Close the day" description="Reconcile sales and payments" />
              <QuickLink to="/owner/menu" icon={MenuIcon} title="Manage your menu" description="Update prices and availability" />
              <QuickLink to="/owner/history" icon={Clock3} title="Review orders" description="Find orders and payment history" />
            </div>
          </section>
        </div>
      </div>

      {summary.cancelledCount > 0 && (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ArrowUpRight size={17} className="shrink-0" />
          {summary.cancelledCount} {summary.cancelledCount === 1 ? 'order was' : 'orders were'} cancelled {period}.
        </div>
      )}
    </div>
  );
}
