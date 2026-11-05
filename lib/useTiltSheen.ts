import { useEffect, useState, type RefObject } from 'react';
import { useReducedMotion } from './useReducedMotion';

export type SheenMode = 'tilt' | 'ambient' | 'static';

/**
 * Wallet-card gold sheen. Follows the phone's tilt where the browser shares
 * orientation without a prompt (Android), the pointer on desktop, and drifts
 * gently otherwise (iOS). Static when the member has reduce motion on.
 * Writes --sheen-x / --sheen-y on the element (see .awc-wallet in index.css).
 */
export function useTiltSheen(ref: RefObject<HTMLElement | null>, ready = true): SheenMode {
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<SheenMode>(reduced ? 'static' : 'ambient');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      setMode('static');
      return;
    }
    setMode('ambient');
    let frame = 0;
    const put = (x: number, y: number) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--sheen-x', `${Math.round(Math.min(100, Math.max(0, x)))}%`);
        el.style.setProperty('--sheen-y', `${Math.round(Math.min(100, Math.max(0, y)))}%`);
      });
    };

    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      setMode('tilt');
      put(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
    };
    el.addEventListener('pointermove', onPointer);

    const DOE = (typeof window !== 'undefined' ? window.DeviceOrientationEvent : undefined) as
      | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> })
      | undefined;
    const needsPrompt = Boolean(DOE && typeof DOE.requestPermission === 'function');
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      setMode('tilt');
      put(50 + (e.gamma / 45) * 50, ((e.beta - 20) / 60) * 100);
    };
    if (DOE && !needsPrompt) window.addEventListener('deviceorientation', onTilt);

    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', onPointer);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, [ref, reduced, ready]);

  return mode;
}
