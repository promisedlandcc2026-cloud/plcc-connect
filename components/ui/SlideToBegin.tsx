import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * "Slide to begin" — drag the burgundy knob to the end to continue.
 * Easy for everyone: a plain tap (or Enter / Space) slides it for you, and it
 * is a real button for screen readers. Let go early and it springs back.
 */
export const SlideToBegin: React.FC<{ label?: string; onComplete: () => void }> = ({
  label = 'Slide to begin',
  onComplete,
}) => {
  const trackRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ startX: number; startOffset: number; moved: boolean; id: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [done, setDone] = useState(false);

  const KNOB = 56;
  const PAD = 4;
  const maxOffset = () => Math.max(0, (trackRef.current?.clientWidth || 300) - KNOB - PAD * 2);

  const finish = useCallback(() => {
    if (done) return;
    setDone(true);
    setAnimating(true);
    setOffset(maxOffset());
    try {
      navigator.vibrate?.(15);
    } catch {
      /* not supported */
    }
    window.setTimeout(onComplete, 280);
  }, [done, onComplete]);

  // Keep the knob at the end if the screen is rotated after finishing.
  useEffect(() => {
    if (!done) return;
    const onResize = () => setOffset(maxOffset());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [done]);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (done) return;
    drag.current = { startX: e.clientX, startOffset: offset, moved: false, id: e.pointerId };
    setAnimating(false);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 6) d.moved = true;
    setOffset(Math.min(maxOffset(), Math.max(0, d.startOffset + dx)));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    const max = maxOffset();
    if (!d.moved) return finish(); // a tap slides it for you
    if (offset >= max * 0.8) return finish();
    setAnimating(true);
    setOffset(0); // let go early: spring back
  };

  const onPointerCancel = () => {
    drag.current = null;
    setAnimating(true);
    setOffset(0);
  };

  const progress = (() => {
    const max = maxOffset();
    return max ? offset / max : 0;
  })();

  return (
    <button
      ref={trackRef}
      type="button"
      aria-label={`${label} — or tap to begin`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          finish();
        }
      }}
      // Keyboard "click" (Enter/Space) is handled above; pointer taps in onPointerUp.
      onClick={(e) => {
        if (e.detail === 0) finish();
      }}
      className="relative w-full h-16 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm overflow-hidden select-none touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1A1A]"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Gold fill that follows the knob */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 rounded-full bg-gold/25"
        style={{
          width: `${offset + KNOB + PAD * 2}px`,
          transition: animating ? 'width 260ms cubic-bezier(.2,.8,.2,1)' : 'none',
        }}
      />
      {/* Label with a soft shine that sweeps toward the end */}
      <span
        aria-hidden
        className="awc-slide-shine absolute inset-0 flex items-center justify-center pl-14 text-[15px] font-black uppercase tracking-[0.2em]"
        style={{ opacity: Math.max(0, 1 - progress * 1.6) }}
      >
        {label}
      </span>
      {/* Knob */}
      <span
        aria-hidden
        className="absolute top-1 left-1 h-14 w-14 rounded-full bg-burgundy text-white flex items-center justify-center shadow-[0_6px_20px_rgba(0,0,0,0.35)]"
        style={{
          transform: `translateX(${offset}px)`,
          transition: animating ? 'transform 260ms cubic-bezier(.2,.8,.2,1)' : 'none',
        }}
      >
        <ChevronRight size={28} strokeWidth={2.75} className={done ? '' : 'awc-slide-nudge'} />
      </span>
    </button>
  );
};
