/**
 * Order of service for the Sunday live Home.
 *
 * Source: Vault's run of show (public.event_run_of_show) for the service event
 * on the calendar, read with the member's own session. Only the member-safe
 * columns are selected — never staff owner/notes. When Vault has no run of
 * show (or the event isn't on the calendar) the typical Sunday order is shown
 * without times, so nothing is invented.
 */
import { supabase, isSupabaseConfigured } from './supabase';
import { buildServiceSteps, TYPICAL_SUNDAY_ORDER, type ServiceStep } from './sanctuary';

export type OrderOfService = { steps: ServiceStep[]; fromVault: boolean };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function typicalOrder(): OrderOfService {
  return {
    fromVault: false,
    steps: TYPICAL_SUNDAY_ORDER.map((title, i) => ({ id: `typical-${i}`, title, timeLabel: null, startsAt: null })),
  };
}

export async function fetchOrderOfService(eventId: string | null, serviceStart: Date): Promise<OrderOfService> {
  if (!eventId || !UUID_RE.test(eventId) || !isSupabaseConfigured) return typicalOrder();
  const { data, error } = await supabase
    .from('event_run_of_show')
    .select('id, title, start_time, duration_minutes, sort_order')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .limit(24);
  if (error || !Array.isArray(data) || data.length === 0) return typicalOrder();
  const steps = buildServiceSteps(
    data as Array<{ id: string; title: string; start_time?: string | null; duration_minutes?: number | null }>,
    serviceStart
  );
  return steps.length ? { steps, fromVault: true } : typicalOrder();
}
