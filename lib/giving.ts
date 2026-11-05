/**
 * Giving goes through PLCC Tithe so every gift is confirmed (by Stripe, or by
 * Finance for Zelle / Venmo / Cash App) and recorded in the Digital
 * Contribution Book. Connect only links to it.
 */

const DEFAULT_TITHE_URL = 'https://plcc-tithe.vercel.app';

export type GiveMethod = 'card' | 'bank' | 'zelle' | 'venmo' | 'cashapp';

export function titheBaseUrl(): string {
  const raw = (import.meta.env?.VITE_TITHE_URL as string | undefined)?.trim() || DEFAULT_TITHE_URL;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') return DEFAULT_TITHE_URL;
    return url.origin;
  } catch {
    return DEFAULT_TITHE_URL;
  }
}

/** Link to the giving form, optionally with a method pre-selected. */
export function giveUrl(method?: GiveMethod): string {
  const params = new URLSearchParams({ from: 'connect' });
  if (method) params.set('method', method);
  return `${titheBaseUrl()}/?${params.toString()}`;
}

/** Link to the donor's own history and receipts. */
export function myGivingUrl(): string {
  return `${titheBaseUrl()}/?tab=my-giving&from=connect`;
}
