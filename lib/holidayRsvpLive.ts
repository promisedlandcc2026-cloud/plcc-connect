/**
 * Holiday sign-ups are listed in code (lib/holidayRsvps.ts), but the event itself lives
 * in the Vault's events table. When staff delete a holiday event, or delete its RSVP, in the
 * Vault, Connect should stop featuring it. This checks the table and returns the ids that are gone.
 * If the check fails (offline, error), nothing is hidden.
 */
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { HOLIDAY_RSVPS, featuredHolidayRsvp, type HolidayRsvp } from './holidayRsvps';

const TTL_MS = 60_000;
let cache: { at: number; removed: ReadonlySet<string> } | null = null;
const NONE: ReadonlySet<string> = new Set();

/** Ids of holiday events that no longer exist in the Vault's events table. */
export async function fetchRemovedHolidayIds(): Promise<ReadonlySet<string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.removed;
  const ids = HOLIDAY_RSVPS.map((r) => r.eventId);
  const { data, error } = await supabase.from('events').select('id, rsvp_enabled').in('id', ids);
  if (error || !Array.isArray(data)) throw error || new Error('events lookup failed');
  // Gone = deleted from the calendar, or its RSVP was deleted in the Vault (RSVP turned off).
  const present = new Set(
    data
      .filter((row) => (row as { rsvp_enabled?: boolean | null }).rsvp_enabled !== false)
      .map((row) => String((row as { id: unknown }).id))
  );
  const removed = new Set(ids.filter((id) => !present.has(id)));
  cache = { at: Date.now(), removed };
  return removed;
}

/** Holiday event ids deleted in the Vault. Rechecked when Connect is reopened or comes back into view. */
export function useRemovedHolidayIds(): ReadonlySet<string> {
  const [removed, setRemoved] = useState<ReadonlySet<string>>(cache?.removed ?? NONE);

  useEffect(() => {
    let alive = true;
    const check = () => {
      fetchRemovedHolidayIds()
        .then((r) => {
          if (alive) setRemoved(r);
        })
        .catch(() => {
          /* keep what we have — never hide a sign-up because of a failed check */
        });
    };
    check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return removed;
}

/** The holiday sign-up to feature right now, skipping any the Vault has deleted. */
export function useFeaturedHolidayRsvp(now?: Date): HolidayRsvp | null {
  const removedIds = useRemovedHolidayIds();
  return featuredHolidayRsvp(now, { removedIds });
}
