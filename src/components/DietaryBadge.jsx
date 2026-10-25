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
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-bean/40" aria-hidden="true">
          <span className="h-1 w-1 rounded-full bg-bean/40" />
        </span>
      ) : (
        <span
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
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
