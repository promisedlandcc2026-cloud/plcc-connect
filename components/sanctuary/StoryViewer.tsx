/**
 * Full-screen story viewer for "Today at PLCC". Tap the right side (or →) for
 * next, the left side (or ←) for back, Escape or the close button to leave.
 * Slides advance on their own every few seconds unless paused or the member
 * has reduce motion on — then they move only when tapped.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { useReducedMotion } from '../../lib/useReducedMotion';

export type StorySlide = {
  key: string;
  /** Background for the whole screen behind this slide. */
  background?: string;
  content: React.ReactNode;
};

type Props = {
  title: string;
  /** Small line next to the progress bars, e.g. "PLCC · Holiday sign-ups". */
  eyebrow: string;
  slides: StorySlide[];
  onClose: () => void;
  /** Called after the last slide (auto or tap) — e.g. jump to the next story. */
  onFinish?: () => void;
  durationMs?: number;
};

const DEFAULT_BG = 'radial-gradient(110% 60% at 20% 0%, #192e24 0%, #0d1914 45%, #0e1512 100%)';

export const StoryViewer: React.FC<Props> = ({ title, eyebrow, slides, onClose, onFinish, durationMs = 7000 }) => {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const autoplay = !reduced && !paused;
  const slide = slides[Math.min(index, slides.length - 1)];

  const next = useCallback(() => {
    if (index + 1 < slides.length) setIndex(index + 1);
    else (onFinish ?? onClose)();
  }, [index, slides.length, onClose, onFinish]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    setIndex(0);
  }, [title]);

  useEffect(() => {
    if (!autoplay) return;
    const t = window.setTimeout(next, durationMs);
    return () => window.clearTimeout(t);
  }, [autoplay, index, next, durationMs]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'Tab') {
      // Keep focus inside the dialog.
      const items = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!items || items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (!slide) return null;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-[320] flex justify-center bg-black"
    >
      <div
        className="relative w-full max-w-[500px] h-full overflow-hidden text-cream flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
        style={{ background: slide.background || DEFAULT_BG }}
      >
        <div className="relative z-20 grid gap-1.5 px-4 pt-4" style={{ gridTemplateColumns: `repeat(${slides.length}, minmax(0, 1fr))` }} aria-hidden>
          {slides.map((s, i) => (
            <div key={s.key} className="h-[3px] rounded-full bg-cream/25 overflow-hidden">
              <div
                key={`${s.key}-${i === index ? 'on' : 'off'}-${paused}`}
                className="awc-story-bar__fill h-full bg-cream rounded-full"
                data-running={i === index && autoplay ? 'true' : 'false'}
                style={
                  {
                    '--awc-story-progress': i < index || (i === index && !autoplay) ? 1 : 0,
                    '--awc-story-ms': `${durationMs}ms`,
                    opacity: i === index && !autoplay ? 0.6 : 1,
                  } as React.CSSProperties
                }
              />
            </div>
          ))}
        </div>

        <div className="relative z-20 flex items-center justify-between gap-2 pl-5 pr-3 pt-2">
          <p className="text-[13px] font-bold text-cream/90 truncate">{eyebrow}</p>
          <div className="flex items-center gap-1">
            {!reduced ? (
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? 'Play stories' : 'Pause stories'}
                className="h-11 w-11 rounded-full bg-black/25 text-cream flex items-center justify-center"
              >
                {paused ? <Play size={18} aria-hidden /> : <Pause size={18} aria-hidden />}
              </button>
            ) : null}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="h-11 w-11 rounded-full bg-black/25 text-cream flex items-center justify-center"
            >
              <X size={20} aria-hidden />
            </button>
          </div>
        </div>

        {/* Tap zones sit under the slide's own buttons and links. */}
        <button
          type="button"
          onClick={prev}
          aria-label="Previous"
          className="absolute left-0 top-24 bottom-40 w-1/3 z-0 focus-visible:outline-none"
          tabIndex={-1}
        />
        <button
          type="button"
          onClick={next}
          aria-label="Next"
          className="absolute right-0 top-24 bottom-40 w-2/3 z-0 focus-visible:outline-none"
          tabIndex={-1}
        />

        <div className="relative z-10 flex-1 min-h-0 flex flex-col pointer-events-none [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_summary]:pointer-events-auto">
          <p className="sr-only" aria-live="polite">
            {`${index + 1} of ${slides.length}`}
          </p>
          {slide.content}
        </div>

        {slides.length > 1 ? (
          <div className="relative z-20 flex justify-between px-4 pb-3">
            <button
              type="button"
              onClick={prev}
              disabled={index === 0}
              className="min-h-[44px] px-3 rounded-full text-[13px] font-bold text-cream/90 inline-flex items-center gap-1 disabled:opacity-0"
            >
              <ChevronLeft size={16} aria-hidden /> Back
            </button>
            <button
              type="button"
              onClick={next}
              className="min-h-[44px] px-3 rounded-full text-[13px] font-bold text-cream/90 inline-flex items-center gap-1"
            >
              {index + 1 < slides.length ? 'Next' : 'Done'} <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
};
