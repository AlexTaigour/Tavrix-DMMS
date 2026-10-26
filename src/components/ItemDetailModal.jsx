import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, Plus, Minus, Coffee, Clock } from 'lucide-react';
import DietaryBadge from './DietaryBadge';

// Large item view: image, name, description, estimated cook time, order button.
// Same bottom-sheet-on-mobile / centered-card-on-desktop pattern as the
// checkout sheet in CustomerView. Stays open after adding so a customer can
// bump the quantity without reopening.
export default function ItemDetailModal({ item, quantity, onUpdateQuantity, onClose }) {
  const [imgFailed, setImgFailed] = useState(false);
  const touchStart = useRef(null);
  const soldOut = item.isAvailable === false;

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center sm:px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 500 }}
        animate={{ y: 0 }}
        exit={{ y: 500 }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(event) => {
          if (event.target.closest('button, input, textarea, select')) {
            touchStart.current = null;
            return;
          }
          const touch = event.touches[0];
          touchStart.current = {
            x: touch.clientX,
            y: touch.clientY,
            scrollTop: event.currentTarget.scrollTop,
          };
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start || start.scrollTop > 0 || event.currentTarget.scrollTop > 0) return;
          const touch = event.changedTouches[0];
          const deltaY = touch.clientY - start.y;
          const deltaX = touch.clientX - start.x;
          if (deltaY > 80 && deltaY > Math.abs(deltaX) * 1.25) onClose();
        }}
        onTouchCancel={() => { touchStart.current = null; }}
        className="max-h-[92vh] w-full max-w-md touch-pan-y overflow-y-auto overscroll-contain rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="relative">
          {item.image && !imgFailed ? (
            <img
              src={item.image}
              alt={item.name}
              onError={() => setImgFailed(true)}
              className={`w-full h-56 object-cover rounded-t-3xl ${soldOut ? 'grayscale' : ''}`}
            />
          ) : (
            <div className="w-full h-56 bg-cream rounded-t-3xl flex items-center justify-center">
              <Coffee size={64} className="text-latte" />
            </div>
          )}
          <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-white/70 rounded-full" />
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md text-bean z-10 active:scale-90 transition-transform"
          >
            <X size={18} />
          </button>
          {soldOut && (
            <div className="absolute inset-0 bg-black/40 rounded-t-3xl flex items-center justify-center">
              <span className="bg-white text-bean px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-wider">
                Sold Out
              </span>
            </div>
          )}
        </div>

        <div className="p-6 space-y-4">
          <div className="flex justify-between items-start gap-3">
            <div>
              <div className="flex items-center gap-2">
                <DietaryBadge dietaryType={item.dietaryType} />
                <h2 className="text-2xl font-black text-bean leading-tight">{item.name}</h2>
              </div>
              <span className="inline-block mt-1.5 bg-cream text-espresso px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                {item.category}
              </span>
            </div>
            <p className="text-2xl font-black text-chiya whitespace-nowrap">Rs. {item.price}</p>
          </div>

          {item.description && (
            <p className="text-sm text-gray-500 font-medium leading-relaxed">{item.description}</p>
          )}

          {item.cookMinutes != null && (
            <div className="flex items-center gap-2 bg-cream rounded-2xl px-4 py-3 text-espresso">
              <Clock size={16} className="text-chiya shrink-0" />
              <span className="text-sm font-bold">
                Estimated cooking time: <span className="font-black">~{item.cookMinutes} min</span>
              </span>
            </div>
          )}

          {soldOut ? (
            <button
              disabled
              className="w-full py-4 rounded-2xl font-black bg-gray-100 text-gray-400 cursor-not-allowed"
            >
              Sold out — not available right now
            </button>
          ) : quantity === 0 ? (
            <button
              onClick={() => onUpdateQuantity(item.id, 1)}
              className="w-full py-4 rounded-2xl font-black bg-chiya text-white shadow-lg hover:bg-espresso transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Plus size={20} /> Add to order
            </button>
          ) : (
            <div className="flex items-center justify-between bg-cream rounded-2xl px-3 py-2 border border-espresso/10">
              <button
                onClick={() => onUpdateQuantity(item.id, -1)}
                aria-label={`Remove one ${item.name}`}
                className="p-3 rounded-full text-espresso hover:bg-white transition-colors active:scale-90"
              >
                <Minus size={20} />
              </button>
              <span className="font-black text-bean text-xl">{quantity} in order</span>
              <button
                onClick={() => onUpdateQuantity(item.id, 1)}
                aria-label={`Add one ${item.name}`}
                className="p-3 rounded-full text-espresso hover:bg-white transition-colors active:scale-90"
              >
                <Plus size={20} />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
