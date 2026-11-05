/**
 * Personalized greeting helpers for My PLCC Home (Phase 2.1).
 * Uses local browser time — never hardcode daypart.
 */

export type Daypart = 'Good morning' | 'Good afternoon' | 'Good evening';

/** Extract a first name for greeting — never email / role. */
export function firstNameFromDisplayName(name: string | null | undefined): string | null {
  if (name == null) return null;
  const trimmed = String(name).trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) return null;
  const first = trimmed.split(/\s+/)[0];
  if (!first || first.length > 40) return null;
  return first;
}

export function daypartGreeting(now: Date = new Date()): Daypart {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * "Good morning, Jerless" or "Welcome back" when no usable first name.
 */
export function memberHomeGreeting(
  displayName: string | null | undefined,
  now: Date = new Date()
): string {
  const first = firstNameFromDisplayName(displayName);
  if (!first) return 'Welcome back';
  return `${daypartGreeting(now)}, ${first}`;
}
