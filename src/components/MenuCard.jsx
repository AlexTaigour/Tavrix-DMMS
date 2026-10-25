import React, { useState } from 'react';
import { Plus, Minus, Coffee } from 'lucide-react';
import DietaryBadge from './DietaryBadge';

export const MenuCard = ({ item, quantity, onUpdateQuantity, onOpenDetail }) => {
  const soldOut = item.isAvailable === false;
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <article
      className={`bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col border border-espresso/10 group transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${soldOut ? 'opacity-65' : ''}`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
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
            <div className="flex h-full w-full items-center justify-center bg-cream">
              <Coffee size={48} className="text-latte" />
            </div>
          )}
        </button>
        {soldOut && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-wider text-bean">Sold Out</span>
          </div>
        )}
        {quantity > 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-bean/20">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-chiya text-xl font-bold text-white shadow-lg">
              {quantity}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-grow flex-col p-3 md:p-4">
        <h3 className="min-h-10 font-bold text-sm leading-snug text-bean md:text-base">
          <button type="button" onClick={() => onOpenDetail?.(item.id)} className="flex min-h-11 items-center gap-2 text-left">
            <DietaryBadge dietaryType={item.dietaryType} />
            <span>{item.name}</span>
          </button>
        </h3>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-base font-black text-chiya">Rs. {item.price}</p>
          {quantity === 0 ? (
            <button
              disabled={soldOut}
              onClick={() => onUpdateQuantity(item.id, 1)}
              aria-label={`Add ${item.name} to order`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-chiya text-sm font-bold text-white transition-colors hover:bg-espresso active:scale-95 disabled:pointer-events-none disabled:opacity-50"
            >
              <Plus size={17} />
            </button>
          ) : (
            <div className="flex items-center gap-1 rounded-full border border-espresso/10 bg-cream px-1">
              <button
                disabled={soldOut}
                onClick={() => onUpdateQuantity(item.id, -1)}
                aria-label={`Remove one ${item.name}`}
                className="flex h-11 w-11 items-center justify-center rounded-full text-espresso transition-colors hover:bg-white active:scale-90 disabled:pointer-events-none"
              >
                <Minus size={15} />
              </button>
              <span className="font-black text-bean text-sm min-w-4 text-center">{quantity}</span>
              <button
                disabled={soldOut}
                onClick={() => onUpdateQuantity(item.id, 1)}
                aria-label={`Add one ${item.name}`}
                className="flex h-11 w-11 items-center justify-center rounded-full text-espresso transition-colors hover:bg-white active:scale-90 disabled:pointer-events-none"
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
