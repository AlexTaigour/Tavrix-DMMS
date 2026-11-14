import React from 'react';
import { motion } from 'motion/react';
import { Check, X } from 'lucide-react';
import { STATUS_META, TIMELINE_STEPS } from './StatusBadge';
import { formatTime } from '../utils/format';

// Customer-facing vertical stepper. Cancelled renders as a terminal red state.
export default function StatusTimeline({ order }) {
  const cancelled = order.status === 'cancelled';
  const currentIdx = TIMELINE_STEPS.indexOf(order.status);
  const reachedAt = {};
  for (const h of order.history || []) reachedAt[h.toStatus] = h.changedAt;

  return (
    <div>
      <ol aria-label="Order status timeline" className="grid grid-cols-5 gap-0">
      {TIMELINE_STEPS.map((step, i) => {
        const done = !cancelled && i < currentIdx;
        const active = !cancelled && i === currentIdx;
        const meta = STATUS_META[step];
        return (
          <li key={step} aria-current={active ? 'step' : undefined} className="relative flex min-w-0 flex-col items-center text-center">
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`absolute left-0 top-4 z-0 h-0.5 w-1/2 ${!cancelled && i <= currentIdx ? 'bg-green-500' : 'bg-gray-200'}`}
              />
            )}
            {i < TIMELINE_STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={`absolute right-0 top-4 z-0 h-0.5 w-1/2 ${!cancelled && i < currentIdx ? 'bg-green-500' : 'bg-gray-200'}`}
              />
            )}
            <div className="relative z-10 flex min-h-[3.75rem] flex-col items-center">
              <motion.div
                initial={false}
                animate={{
                  scale: active ? 1.08 : 1,
                  backgroundColor: done ? '#22c55e' : active ? '#c62832' : '#e5e7eb',
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm sm:h-9 sm:w-9"
              >
                {done ? (
                  <Check size={16} />
                ) : (
                  <span className={`text-xs font-black ${active ? '' : 'text-gray-400'}`}>{i + 1}</span>
                )}
              </motion.div>
            </div>
            <div className="w-full px-0.5">
              <p className={`break-words text-[10px] font-black leading-tight sm:text-xs ${active ? 'text-chiya' : done ? 'text-bean' : 'text-gray-400'}`}>
                {meta.label}
                {active && (
                  <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    aria-label="Current step"
                    className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-chiya align-middle"
                  />
                )}
              </p>
              {reachedAt[step] && (
                <p className="mt-1 text-[9px] font-bold leading-tight text-gray-400 sm:text-[10px]">{formatTime(reachedAt[step])}</p>
              )}
            </div>
          </li>
        );
      })}
      </ol>
      {cancelled && (
        <div role="status" className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-red-800">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
            <X size={18} />
          </div>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <p className="text-xs font-black">Order cancelled</p>
            {reachedAt.cancelled && (
              <p className="shrink-0 text-[10px] font-bold text-red-700/60">{formatTime(reachedAt.cancelled)}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
