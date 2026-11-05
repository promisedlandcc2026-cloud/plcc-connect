import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { GalleryItem } from '../../lib/galleryClient';

type Props = {
  items: GalleryItem[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
};

const SWIPE_PX = 50;

function preload(item?: GalleryItem) {
  if (!item || item.type !== 'image') return;
  const img = new Image();
  img.src = item.url;
}

/** Shows the cached thumbnail at once, then fades the full photo in over it. */
const Photo: React.FC<{ item: GalleryItem }> = ({ item }) => {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) setLoaded(true);
  }, []);
  const ratio = item.width && item.height ? `${item.width} / ${item.height}` : undefined;
  return (
    <div className="relative max-h-full max-w-full" style={ratio ? { aspectRatio: ratio, height: '100%' } : undefined}>
      {item.thumbnail && item.thumbnail !== item.url ? (
        <img src={item.thumbnail} alt="" aria-hidden className="absolute inset-0 h-full w-full object-contain select-none" draggable={false} />
      ) : null}
      <img
        ref={ref}
        src={item.url}
        alt={item.description || item.title}
        onLoad={() => setLoaded(true)}
        draggable={false}
        className={`relative h-full w-full max-h-full max-w-full object-contain select-none transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
};

export const GalleryLightbox: React.FC<Props> = ({ items, index, onIndexChange }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const touchX = useRef<number | null>(null);
  const open = index !== null && items[index] !== undefined;
  const item = open ? items[index as number] : null;
  const total = items.length;

  const close = useCallback(() => onIndexChange(null), [onIndexChange]);
  const step = useCallback(
    (d: number) => {
      if (index === null || total === 0) return;
      onIndexChange((index + d + total) % total);
    },
    [index, total, onIndexChange]
  );

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      returnFocus.current?.focus?.({ preventScroll: true });
    };
  }, [open, close, step]);

  useEffect(() => {
    if (index === null || total < 2) return;
    preload(items[(index + 1) % total]);
    preload(items[(index - 1 + total) % total]);
  }, [index, items, total]);

  if (!item) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${item.title}, ${(index as number) + 1} of ${total}`}
      className="fixed inset-0 z-[400] flex flex-col bg-wine-deep text-cream"
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > SWIPE_PX) step(dx < 0 ? 1 : -1);
      }}
    >
      <div className="shrink-0 flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))] h-16">
        <p className="text-sm text-cream/70 tabular-nums" aria-live="polite">
          {(index as number) + 1} of {total}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label="Close"
          className="h-11 w-11 rounded-full inline-flex items-center justify-center text-cream/85 active:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <X size={22} aria-hidden />
        </button>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center px-2">
        <div key={item.id} className="h-full w-full flex items-center justify-center">
          {item.type === 'video' ? (
            <video src={item.url} poster={item.thumbnail || undefined} controls autoPlay playsInline className="max-h-full max-w-full bg-black" />
          ) : (
            <Photo item={item} />
          )}
        </div>
        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous"
              className="absolute left-2 h-11 w-11 rounded-full inline-flex items-center justify-center bg-black/35 text-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <ChevronLeft size={26} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next"
              className="absolute right-2 h-11 w-11 rounded-full inline-flex items-center justify-center bg-black/35 text-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <ChevronRight size={26} aria-hidden />
            </button>
          </>
        ) : null}
      </div>

      <div className="shrink-0 px-5 pt-4 pb-[max(20px,env(safe-area-inset-bottom))] text-center">
        {item.credit ? (
          <p className="text-sm text-cream/75">
            Photo by {item.credit.name}.{' '}
            <a href={item.credit.url} target="_blank" rel="noopener noreferrer" className="text-leaf underline underline-offset-4">
              See the full collection
            </a>
          </p>
        ) : (
          <>
            <p className="font-display text-lg text-cream">{item.title}</p>
            {item.description ? <p className="mt-1 text-sm text-cream/70">{item.description}</p> : null}
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
