/**
 * Phase 2.7D.10 — Connect personal attendance / custody / event status (RPC only).
 */
import { supabase } from './supabase';

export type MyAttendanceItem = {
  sessionTitle: string;
  sessionType: string;
  sessionStartsAt: string;
  checkedInAt: string;
  source: string;
};

export type MyCustodyItem = {
  kind: 'session' | 'custody';
  childDisplayName: string;
  sessionTitle: string;
  sessionType: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  isOpen: boolean;
};

async function requireSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Sign in to view attendance.');
}

export async function fetchMyAttendanceHistory(limit = 50): Promise<MyAttendanceItem[]> {
  await requireSession();
  const { data, error } = await supabase.rpc('get_my_attendance_history', {
    p_limit: limit,
  });
  if (error) throw new Error(error.message || 'Could not load attendance history.');
  const items = Array.isArray((data as any)?.items) ? (data as any).items : [];
  return items.map((r: any) => ({
    sessionTitle: String(r.sessionTitle || 'Session'),
    sessionType: String(r.sessionType || ''),
    sessionStartsAt: String(r.sessionStartsAt || ''),
    checkedInAt: String(r.checkedInAt || ''),
    source: String(r.source || ''),
  }));
}

export async function fetchMyChildrenCustodyHistory(limit = 50): Promise<MyCustodyItem[]> {
  await requireSession();
  const { data, error } = await supabase.rpc('get_my_children_custody_history', {
    p_limit: limit,
  });
  if (error) throw new Error(error.message || 'Could not load family attendance history.');
  const items = Array.isArray((data as any)?.items) ? (data as any).items : [];
  return items.map((r: any) => ({
    kind: r.kind === 'custody' ? 'custody' : 'session',
    childDisplayName: String(r.childDisplayName || 'Child'),
    sessionTitle: String(r.sessionTitle || 'Session'),
    sessionType: String(r.sessionType || ''),
    checkedInAt: String(r.checkedInAt || ''),
    checkedOutAt: r.checkedOutAt ? String(r.checkedOutAt) : null,
    isOpen: Boolean(r.isOpen),
  }));
}

export async function fetchMyEventAttendanceStatus(eventId: string): Promise<{
  checkedIn: boolean;
  reconciledAt: string | null;
}> {
  await requireSession();
  const { data, error } = await supabase.rpc('get_my_event_attendance_status', {
    p_event_id: eventId,
  });
  if (error) throw new Error(error.message || 'Could not load event status.');
  return {
    checkedIn: Boolean((data as any)?.checkedIn),
    reconciledAt: (data as any)?.reconciledAt ? String((data as any).reconciledAt) : null,
  };
}
