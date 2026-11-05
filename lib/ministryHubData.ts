/**
 * Member Ministry Hubs — reuse Vault `ministries` + `teams` (+ optional membership).
 * No invented schema. Events/announcements are not ministry-scoped in live data.
 */

import { supabase } from './supabase';
import { supabasePublic } from './supabasePublic';
import { findMinistryBySlug, slugifyMinistryName } from './ministrySlug';

export type MinistryTeam = {
  id: string;
  name: string;
  description: string | null;
  iconName: string | null;
  category: string | null;
};

export type MinistryHub = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  teams: MinistryTeam[];
  /** True only when membership was resolved from live data for this user. */
  isMember: boolean;
};

function asRecord(row: unknown): Record<string, unknown> {
  return row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
}

export function normalizeMinistryRow(
  row: unknown,
  teams: MinistryTeam[] = [],
  memberMinistryIds?: Set<string>
): MinistryHub {
  const r = asRecord(row);
  const id = String(r.id ?? '');
  const name = String(r.name || 'Ministry').trim() || 'Ministry';
  const description = r.description != null && String(r.description).trim()
    ? String(r.description).trim()
    : null;
  return {
    id,
    name,
    slug: slugifyMinistryName(name),
    description,
    teams: [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    isMember: Boolean(memberMinistryIds?.has(id)),
  };
}

export function normalizeTeamRow(row: unknown): MinistryTeam & { ministryId: string | null } {
  const r = asRecord(row);
  return {
    id: String(r.id ?? ''),
    name: String(r.name || 'Team').trim() || 'Team',
    description: r.description != null && String(r.description).trim()
      ? String(r.description).trim()
      : null,
    iconName: r.icon_name ? String(r.icon_name) : null,
    category: r.category ? String(r.category) : null,
    ministryId: r.ministry_id ? String(r.ministry_id) : null,
  };
}

/**
 * Live catalog: public-readable `ministries` + nested teams by ministry_id.
 * Uses sessionless anon client (same public-read pattern as announcements).
 */
export async function fetchMinistryCatalog(): Promise<MinistryHub[]> {
  const [ministriesRes, teamsRes] = await Promise.all([
    supabasePublic.from('ministries').select('id,name,description').order('name', { ascending: true }),
    supabasePublic
      .from('teams')
      .select('id,name,description,ministry_id,icon_name,category')
      .order('name', { ascending: true }),
  ]);

  if (ministriesRes.error) {
    console.error('[ministry-hubs]', ministriesRes.error.code, ministriesRes.error.message);
    throw ministriesRes.error;
  }
  if (teamsRes.error) {
    console.error('[ministry-hubs teams]', teamsRes.error.code, teamsRes.error.message);
  }

  const teamsByMinistry = new Map<string, MinistryTeam[]>();
  for (const raw of teamsRes.data || []) {
    const t = normalizeTeamRow(raw);
    if (!t.id || !t.ministryId) continue;
    const list = teamsByMinistry.get(t.ministryId) || [];
    list.push({
      id: t.id,
      name: t.name,
      description: t.description,
      iconName: t.iconName,
      category: t.category,
    });
    teamsByMinistry.set(t.ministryId, list);
  }

  return (ministriesRes.data || [])
    .map((row) => {
      const id = String(asRecord(row).id ?? '');
      return normalizeMinistryRow(row, teamsByMinistry.get(id) || [], undefined);
    })
    .filter((m) => m.id && m.name);
}

/**
 * Membership personalization — only when live rows resolve for the signed-in user.
 * Prefers `team_members.user_id` → `teams.ministry_id` (auth-aligned).
 * Also uses verified `user_member_links` → `member_ministries`.
 * Returns empty Set (not fake data) when unreadable.
 */
export async function fetchMyMinistryIds(): Promise<{
  ids: Set<string>;
  available: boolean;
}> {
  const ids = new Set<string>();
  let available = false;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return { ids, available: false };

    const teamMembership = await supabase
      .from('team_members')
      .select('team_id, user_id, teams(ministry_id)')
      .eq('user_id', userId);

    if (!teamMembership.error && teamMembership.data) {
      available = true;
      for (const row of teamMembership.data) {
        const r = asRecord(row);
        const teams = r.teams;
        const ministryId =
          teams && typeof teams === 'object' && !Array.isArray(teams)
            ? String(asRecord(teams).ministry_id || '')
            : '';
        if (ministryId) ids.add(ministryId);
      }
    } else if (teamMembership.error) {
      console.error('[ministry-hubs membership]', teamMembership.error.code, teamMembership.error.message);
    }

    // Prefer CRM link: user_member_links → member_ministries
    const link = await supabase
      .from('user_member_links')
      .select('member_id, status')
      .eq('user_id', userId)
      .eq('status', 'verified')
      .maybeSingle();

    const linkedMemberId =
      !link.error && link.data ? String(asRecord(link.data).member_id || '') : '';

    if (linkedMemberId) {
      const viaLink = await supabase
        .from('member_ministries')
        .select('ministry_id')
        .eq('member_id', linkedMemberId);
      if (!viaLink.error && viaLink.data) {
        available = true;
        for (const row of viaLink.data) {
          const mid = String(asRecord(row).ministry_id || '');
          if (mid) ids.add(mid);
        }
      }
    }

    // Secondary: member_ministries when member_id equals auth user id (legacy align).
    const direct = await supabase
      .from('member_ministries')
      .select('ministry_id')
      .eq('member_id', userId);

    if (!direct.error && direct.data) {
      available = true;
      for (const row of direct.data) {
        const mid = String(asRecord(row).ministry_id || '');
        if (mid) ids.add(mid);
      }
    }

    return { ids, available };
  } catch (err) {
    console.error('[ministry-hubs membership]', err);
    return { ids, available: false };
  }
}

export async function fetchMinistryDirectory(): Promise<{
  ministries: MinistryHub[];
  myMinistries: MinistryHub[];
  exploreMinistries: MinistryHub[];
  membershipAvailable: boolean;
}> {
  const [catalog, membership] = await Promise.all([
    fetchMinistryCatalog(),
    fetchMyMinistryIds(),
  ]);

  const ministries = catalog.map((m) => ({
    ...m,
    isMember: membership.ids.has(m.id),
  }));

  const myMinistries = membership.available
    ? ministries.filter((m) => m.isMember)
    : [];
  const exploreMinistries = membership.available
    ? ministries.filter((m) => !m.isMember)
    : ministries;

  return {
    ministries,
    myMinistries,
    exploreMinistries,
    membershipAvailable: membership.available,
  };
}

export async function fetchMinistryBySlug(slug: string): Promise<MinistryHub | null> {
  const { ministries } = await fetchMinistryDirectory();
  return findMinistryBySlug(ministries, slug);
}

/** Events are not ministry-scoped in live Connect schema — never invent matches. */
export function ministryEventsSupported(): boolean {
  return false;
}

/** Leaders require member PII joins — not exposed on Connect hubs. */
export function ministryLeadersSupported(): boolean {
  return false;
}
