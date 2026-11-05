/**
 * Phase 2.9A — member team/ministry join application status (RPC).
 */

import { supabase, isSupabaseConfigured } from './supabase';

export type MyTeamApplication = {
  id: string;
  teamId: string;
  teamName: string;
  ministryId: string | null;
  status: 'new' | 'approved' | 'rejected' | 'archived' | string;
  createdAt: string;
};

export async function fetchMyTeamApplications(
  ministryId?: string | null
): Promise<MyTeamApplication[]> {
  if (!isSupabaseConfigured) return [];
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user?.id) return [];

  const { data, error } = await supabase.rpc('get_my_team_applications', {
    p_ministry_id: ministryId || null,
  });
  if (error) {
    console.error('[ministry-join]', error.code, error.message);
    return [];
  }
  const items = Array.isArray((data as any)?.items) ? (data as any).items : [];
  return items.map((r: any) => ({
    id: String(r.id || ''),
    teamId: String(r.teamId || ''),
    teamName: String(r.teamName || r.teamId || 'Team'),
    ministryId: r.ministryId ? String(r.ministryId) : null,
    status: String(r.status || 'new'),
    createdAt: String(r.createdAt || ''),
  })).filter((r: MyTeamApplication) => r.id);
}

export function applicationStatusLabel(status: string): string {
  switch (String(status || '').toLowerCase()) {
    case 'new':
      return 'Request pending';
    case 'approved':
      return 'Request approved';
    case 'rejected':
      return 'Request not approved';
    case 'archived':
      return 'Request archived';
    default:
      return 'Request submitted';
  }
}
