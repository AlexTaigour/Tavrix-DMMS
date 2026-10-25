import React from 'react';

const DIETARY_LABELS = {
  veg: 'Vegetarian',
  non_veg: 'Non-vegetarian',
  unspecified: 'Dietary type not set',
};

export default function DietaryBadge({ dietaryType = 'unspecified' }) {
  const type = DIETARY_LABELS[dietaryType] ? dietaryType : 'unspecified';

  return (
    <span
      role="img"
      aria-label={DIETARY_LABELS[type]}
      title={DIETARY_LABELS[type]}
    >
      {type === 'unspecified' ? (
        <span className="inline-flex min-h-6 items-center gap-1 rounded border border-dashed border-bean/35 px-1.5 text-[10px] font-semibold leading-none text-bean/55" aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-bean/40" />
          {DIETARY_LABELS[type]}
        </span>
      ) : (
        <span
          className={`inline-flex min-h-6 shrink-0 items-center gap-1.5 rounded border px-1.5 text-[10px] font-bold leading-none ${
            type === 'veg' ? 'border-green-700' : 'border-chiya'
          }`}
          aria-hidden="true"
        >
          {type === 'veg' ? (
            <span className="h-2 w-2 rounded-full bg-green-700" />
          ) : (
            <span
              className="h-2.5 w-2.5 bg-chiya"
              style={{ clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }}
            />
          )}

        </span>
      )}
    </span>
  );
}
