/**
 * Auto-hiding bottom dock for reading screens (the Bible reader).
 *
 * While a reading screen is open, scrolling DOWN tucks the bottom dock away so
 * there's more room for the text; scrolling UP (even a little), reaching the
 * top, or reaching the end of the page brings it right back. Everywhere else
 * the dock always stays put.
 */
import { useEffect, useSyncExternalStore } from 'react';

let hidden = false;
let readers = 0;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (hidden === next) return;
  hidden = next;
  listeners.forEach((l) => l());
}

/** Exported for tests: decides the next state from one scroll step. */
export function nextHidden(
  current: boolean,
  s: { y: number; lastY: number; viewport: number; pageHeight: number }
): boolean {
  const NEAR_TOP = 80;
  const NEAR_END = 48;
  const STEP = 6; // ignore tiny jitters
  if (s.y <= NEAR_TOP) return false;
  if (s.y + s.viewport >= s.pageHeight - NEAR_END) return false;
  if (s.y > s.lastY + STEP) return true;
  if (s.y < s.lastY - STEP) return false;
  return current;
}

let lastY = 0;
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const y = Math.max(0, window.scrollY);
    const next = nextHidden(hidden, {
      y,
      lastY,
      viewport: window.innerHeight,
      pageHeight: document.documentElement.scrollHeight,
    });
    if (Math.abs(y - lastY) > 6 || next !== hidden) lastY = y;
    set(next);
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const getSnapshot = () => hidden;
const getServerSnapshot = () => false;

/** Docks call this: true while the dock should be tucked away. */
export function useDockHidden(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Show the dock again right now (e.g. when it receives keyboard focus). */
export function showDock() {
  set(false);
}

/**
 * Reading screens call this to turn auto-hide on while they're open.
 * Pass enabled=false to keep the dock showing (e.g. while a sheet is open).
 */
export function useAutoHideDock(enabled = true): boolean {
  useEffect(() => {
    if (!enabled) return;
    readers += 1;
    lastY = window.scrollY;
    if (readers === 1) window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      readers -= 1;
      if (readers === 0) window.removeEventListener('scroll', onScroll);
      set(false);
    };
  }, [enabled]);
  return useDockHidden();
}
