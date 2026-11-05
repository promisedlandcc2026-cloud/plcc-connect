/**
 * "I'll be there" — the member's own attendance plan for the Next-up gathering.
 *
 * Store: public.attendance_plans (self-only RLS, see
 * docs/supabase/connect_attendance_plans.sql). Authenticated anon-key client
 * only; never elevated credentials.
 *
 * Until that table exists the plan is kept on this phone and moved to the
 * table automatically the next time Home loads after the SQL is applied, so
 * the button never fails for members.
 */
import { supabase, isSupabaseConfigured } from './supabase';

export type PlanSource = 'cloud' | 'device';

export type PlanState = {
  going: boolean;
  source: PlanSource;
};

export type PlanInput = {
  planKey: string;
  eventId: string | null;
  serviceDate: string;
  title: string | null;
};

const PLAN_KEY_RE = /^(event:[0-9a-f-]{36}|sunday:\d{4}-\d{2}-\d{2})$/;
const LOCAL_PREFIX = 'awc_attendance_plans:';

export function isValidPlanKey(key: string): boolean {
  return PLAN_KEY_RE.test(key);
}

/** Missing table / schema cache → keep the plan on the device. */
export function isMissingStoreError(error: { code?: string; message?: string } | null | undefined): boolean {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || /attendance_plans/i.test(message);
}

type LocalPlan = PlanInput & { savedAt: string };

function localKey(userId: string): string {
  return `${LOCAL_PREFIX}${userId}`;
}

function readLocal(userId: string): LocalPlan[] {
  try {
    const raw = localStorage.getItem(localKey(userId));
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list)
      ? (list as LocalPlan[]).filter((p) => p && typeof p.planKey === 'string' && isValidPlanKey(p.planKey))
      : [];
  } catch {
    return [];
  }
}

function writeLocal(userId: string, list: LocalPlan[]): void {
  try {
    if (list.length) localStorage.setItem(localKey(userId), JSON.stringify(list.slice(-20)));
    else localStorage.removeItem(localKey(userId));
  } catch {
    /* storage blocked — the plan just won't persist on this device */
  }
}

async function currentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** Push plans saved on this phone into the table once it exists. Best-effort. */
async function flushLocal(userId: string): Promise<void> {
  const pending = readLocal(userId);
  if (!pending.length) return;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = pending.filter((p) => p.serviceDate >= today);
  if (upcoming.length) {
    const { error } = await supabase.from('attendance_plans').upsert(
      upcoming.map((p) => ({
        user_id: userId,
        plan_key: p.planKey,
        event_id: p.eventId,
        service_date: p.serviceDate,
        title: p.title,
      })),
      { onConflict: 'user_id,plan_key', ignoreDuplicates: true }
    );
    if (error) return;
  }
  writeLocal(userId, []);
}

export async function fetchPlan(planKey: string): Promise<PlanState> {
  const userId = await currentUserId();
  if (!userId || !isValidPlanKey(planKey)) return { going: false, source: 'device' };

  const { data, error } = await supabase
    .from('attendance_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('plan_key', planKey)
    .maybeSingle();

  if (error) {
    const local = readLocal(userId).some((p) => p.planKey === planKey);
    return { going: local, source: 'device' };
  }
  await flushLocal(userId).catch(() => undefined);
  const local = readLocal(userId).some((p) => p.planKey === planKey);
  return { going: Boolean(data) || local, source: 'cloud' };
}

export async function setPlan(input: PlanInput, going: boolean): Promise<PlanState> {
  if (!isValidPlanKey(input.planKey)) throw new Error('This gathering can’t be saved yet.');
  const userId = await currentUserId();
  if (!userId) throw new Error('Please sign in again to continue.');

  const title = input.title ? input.title.slice(0, 200) : null;
  const { error } = going
    ? await supabase.from('attendance_plans').upsert(
        {
          user_id: userId,
          plan_key: input.planKey,
          event_id: input.eventId,
          service_date: input.serviceDate,
          title,
        },
        { onConflict: 'user_id,plan_key', ignoreDuplicates: true }
      )
    : await supabase.from('attendance_plans').delete().eq('user_id', userId).eq('plan_key', input.planKey);

  const others = readLocal(userId).filter((p) => p.planKey !== input.planKey);
  if (!error) {
    writeLocal(userId, others);
    return { going, source: 'cloud' };
  }
  if (!isMissingStoreError(error)) {
    throw new Error('Couldn’t save that. Check your connection and try again.');
  }
  writeLocal(userId, going ? [...others, { ...input, title, savedAt: new Date().toISOString() }] : others);
  return { going, source: 'device' };
}
