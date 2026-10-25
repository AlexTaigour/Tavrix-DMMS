import React, { useState } from 'react';
import { Plus, Minus, Coffee } from 'lucide-react';
import DietaryBadge from './DietaryBadge';

export const MenuCard = ({ item, quantity, onUpdateQuantity, onOpenDetail }) => {
  const soldOut = item.isAvailable === false;
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <article
      className={`group overflow-hidden rounded-2xl border border-espresso/10 bg-white shadow-sm transition-shadow hover:shadow-lg ${
        soldOut ? 'opacity-70' : ''
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-cream">
        <button
          type="button"
          onClick={() => onOpenDetail?.(item.id)}
          aria-label={`View ${item.name} details`}
          className="absolute inset-0 h-full w-full"
        >
          {item.image && !imgFailed ? (
            <img
              src={item.image}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Coffee size={40} className="text-latte" />
            </div>
          )}
        </button>
        {soldOut && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
            <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-bean">
              Sold out
            </span>
          </div>
        )}
      </div>

      <div className="flex min-h-[142px] flex-1 flex-col p-3 sm:min-h-[150px] sm:p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 text-sm font-bold leading-snug text-bean sm:text-base">
            <button
              type="button"
              onClick={() => onOpenDetail?.(item.id)}
              className="min-h-9 text-left"
            >
              <span className="line-clamp-2">{item.name}</span>
            </button>
          </h3>
          <div className="shrink-0 pt-0.5">
            <DietaryBadge dietaryType={item.dietaryType} />
          </div>
        </div>
        <p className="mt-1 min-h-8 text-xs leading-relaxed text-bean/60">
          {item.description && <span className="line-clamp-2">{item.description}</span>}
        </p>

        <div className="mt-auto border-t border-espresso/10 pt-2.5">
          <p className="whitespace-nowrap text-sm font-black text-bean sm:text-base">Rs. {item.price}</p>
          <div className="mt-2 flex h-11 w-full items-center">
            {quantity === 0 ? (
              <button
                type="button"
                disabled={soldOut}
                onClick={() => onUpdateQuantity(item.id, 1)}
                aria-label={`Add ${item.name} to order`}
                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-chiya text-sm font-bold text-white transition-colors hover:bg-espresso active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              >
                <Plus size={17} />
                <span>Add</span>
              </button>
            ) : (
              <div className="flex h-11 w-full items-center justify-between rounded-xl border border-espresso/10 bg-cream">
                <button
                  type="button"
                  disabled={soldOut}
                  onClick={() => onUpdateQuantity(item.id, -1)}
                  aria-label={`Remove one ${item.name}`}
                  className="flex h-full w-11 shrink-0 items-center justify-center rounded-l-xl text-espresso transition-colors hover:bg-white disabled:pointer-events-none"
                >
                  <Minus size={16} />
                </button>
                <span aria-live="polite" className="min-w-0 flex-1 text-center text-sm font-bold text-bean">{quantity}</span>
                <button
                  type="button"
                  disabled={soldOut}
                  onClick={() => onUpdateQuantity(item.id, 1)}
                  aria-label={`Add one ${item.name}`}
                  className="flex h-full w-11 shrink-0 items-center justify-center rounded-r-xl text-espresso transition-colors hover:bg-white disabled:pointer-events-none"
                >
                  <Plus size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};
