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

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-espresso/10 pt-2.5">
          <p className="text-sm font-black text-bean sm:text-base">Rs. {item.price}</p>
          {quantity === 0 ? (
            <button
              type="button"
              disabled={soldOut}
              onClick={() => onUpdateQuantity(item.id, 1)}
              aria-label={`Add ${item.name} to order`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-chiya text-white transition-colors hover:bg-espresso active:scale-95 disabled:pointer-events-none disabled:opacity-50 sm:h-11 sm:w-11"
            >
              <Plus size={18} />
            </button>
          ) : (
            <div className="flex shrink-0 items-center rounded-full border border-espresso/10 bg-cream">
              <button
                type="button"
                disabled={soldOut}
                onClick={() => onUpdateQuantity(item.id, -1)}
                aria-label={`Remove one ${item.name}`}
                className="flex h-10 w-9 items-center justify-center rounded-l-full text-espresso transition-colors hover:bg-white disabled:pointer-events-none sm:h-11 sm:w-10"
              >
                <Minus size={15} />
              </button>
              <span className="min-w-5 text-center text-sm font-bold text-bean">{quantity}</span>
              <button
                type="button"
                disabled={soldOut}
                onClick={() => onUpdateQuantity(item.id, 1)}
                aria-label={`Add one ${item.name}`}
                className="flex h-10 w-9 items-center justify-center rounded-r-full text-espresso transition-colors hover:bg-white disabled:pointer-events-none sm:h-11 sm:w-10"
              >
                <Plus size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
