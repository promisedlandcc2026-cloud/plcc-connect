/**
 * Connect Serve bridge — Vault identity + user-scoped Supabase I/O.
 * Uses the caller's Bearer JWT (RLS). Never uses service_role.
 */

import { createClient } from '@supabase/supabase-js';
import {
  parseBearerAuthorization,
  parseVaultSelfUserResponse,
} from './memberIdentity.js';
import { buildVaultSelfUserUrl, parseVaultApiOrigin } from './vaultOrigin.js';
import {
  asUuid,
  applyCapacityAggregateToDto,
  indexCapacityAggregates,
  isMemberVisibleOpportunity,
  sanitizeMySignupDto,
  sanitizeOpportunityDto,
} from './serveSanitize.js';

/**
 * Flat opportunity projection only — no PostgREST embeds.
 *
 * Authenticated embeds of `ministries` evaluate admin policies that subquery
 * `public.users`, which recurse via users_select_policy (42P17). Teams/events
 * embeds are currently safe, but labels are hydrated via sessionless anon
 * catalog reads (same public-read posture as Ministry Hubs) instead.
 */
const OPP_SELECT = `
  id,
  title,
  description,
  role_label,
  location,
  starts_at,
  ends_at,
  capacity,
  requires_approval,
  status,
  ministry_id,
  team_id,
  event_id
`.replace(/\s+/g, ' ').trim();

/**
 * @returns {{ ok: true, url: string, anonKey: string } | { ok: false, reason: string }}
 */
export function parseServeSupabaseEnv(
  env = typeof process !== 'undefined' ? process.env : {}
) {
  const url = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').trim();
  const anonKey = String(
    env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ''
  ).trim();
  if (!url || !anonKey) return { ok: false, reason: 'missing_supabase_env' };
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      return { ok: false, reason: 'invalid_supabase_url' };
    }
  } catch {
    return { ok: false, reason: 'invalid_supabase_url' };
  }
  // Defense: never accept a service_role-shaped key as "anon"
  if (/service_role/i.test(anonKey) || anonKey.includes('service_role')) {
    return { ok: false, reason: 'service_role_rejected' };
  }
  return { ok: true, url, anonKey };
}

/**
 * User-scoped Supabase client — RLS enforced as auth.uid() from JWT.
 * @param {string} url
 * @param {string} anonKey
 * @param {string} accessToken
 */
export function createServeUserClient(url, anonKey, accessToken) {
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Sessionless anon client for public catalog labels (ministries/teams/events).
 * Must NOT send the member JWT — authenticated ministries SELECT recurses on users.
 * @param {string} url
 * @param {string} anonKey
 */
export function createServeCatalogClient(url, anonKey) {
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
function serveCatalogClientFromEnv() {
  const env = parseServeSupabaseEnv();
  if (!env.ok) return null;
  return createServeCatalogClient(env.url, env.anonKey);
}

/**
 * Attach public ministry/team/event labels without authenticated embeds.
 * On catalog failure, leaves relation objects unset (DTO → null) — never throws.
 *
 * @param {object[]} rows
 * @param {import('@supabase/supabase-js').SupabaseClient | null} [catalog]
 * @returns {Promise<object[]>}
 */
export async function attachPublicRelationLabels(rows, catalog = serveCatalogClientFromEnv()) {
  if (!rows?.length) return rows || [];
  if (!catalog) return rows;

  const ministryIds = [
    ...new Set(rows.map((r) => asUuid(r.ministry_id)).filter(Boolean)),
  ];
  const teamIds = [...new Set(rows.map((r) => asUuid(r.team_id)).filter(Boolean))];
  const eventIds = [...new Set(rows.map((r) => asUuid(r.event_id)).filter(Boolean))];

  /** @type {Map<string, { id: string, name: string }>} */
  const ministries = new Map();
  /** @type {Map<string, { id: string, name: string }>} */
  const teams = new Map();
  /** @type {Map<string, { id: string, name: string }>} */
  const events = new Map();

  try {
    const [minRes, teamRes, eventRes] = await Promise.all([
      ministryIds.length
        ? catalog.from('ministries').select('id, name').in('id', ministryIds)
        : Promise.resolve({ data: [], error: null }),
      teamIds.length
        ? catalog.from('teams').select('id, name').in('id', teamIds)
        : Promise.resolve({ data: [], error: null }),
      eventIds.length
        ? catalog.from('events').select('id, name').in('id', eventIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (minRes.error) {
      console.error('[serve] catalog ministries:', minRes.error.code || minRes.error.message);
    } else {
      for (const row of minRes.data || []) {
        const id = asUuid(row.id);
        if (id && row.name) ministries.set(id, { id, name: String(row.name) });
      }
    }
    if (teamRes.error) {
      console.error('[serve] catalog teams:', teamRes.error.code || teamRes.error.message);
    } else {
      for (const row of teamRes.data || []) {
        const id = asUuid(row.id);
        if (id && row.name) teams.set(id, { id, name: String(row.name) });
      }
    }
    if (eventRes.error) {
      console.error('[serve] catalog events:', eventRes.error.code || eventRes.error.message);
    } else {
      for (const row of eventRes.data || []) {
        const id = asUuid(row.id);
        if (id && row.name) events.set(id, { id, name: String(row.name) });
      }
    }
  } catch (err) {
    console.error('[serve] catalog hydrate:', err?.message || 'error');
    return rows;
  }

  return rows.map((row) => {
    const ministryId = asUuid(row.ministry_id);
    const teamId = asUuid(row.team_id);
    const eventId = asUuid(row.event_id);
    return {
      ...row,
      ministry: ministryId ? ministries.get(ministryId) || null : null,
      team: teamId ? teams.get(teamId) || null : null,
      event: eventId ? events.get(eventId) || null : null,
    };
  });
}

/**
 * Resolve approved Connect member via Vault self (same pattern as other bridges).
 * @param {string} token
 * @param {AbortSignal} [signal]
 * @returns {Promise<
 *   | { ok: true, member: object }
 *   | { ok: false, httpStatus: number, code: string, message: string }
 * >}
 */
export async function fetchApprovedServeMember(token, signal) {
  const allowHttpLocal = process.env.NODE_ENV !== 'production';
  const originResult = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, {
    allowHttpLocal,
  });
  if (!originResult.ok) {
    return {
      ok: false,
      httpStatus: 503,
      code: 'bridge_unconfigured',
      message: 'Serve is not available right now. Please try again later.',
    };
  }

  let upstream;
  try {
    upstream = await fetch(buildVaultSelfUserUrl(originResult.origin), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal,
      redirect: 'error',
    });
  } catch (err) {
    const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    return {
      ok: false,
      httpStatus: aborted ? 504 : 502,
      code: 'vault_unavailable',
      message: 'We could not verify your member access right now. Please try again.',
    };
  }

  if (upstream.status === 401) {
    return {
      ok: false,
      httpStatus: 401,
      code: 'unauthorized',
      message: 'Please sign in again to continue.',
    };
  }
  if (upstream.status === 403) {
    return {
      ok: false,
      httpStatus: 403,
      code: 'forbidden',
      message: 'Serve is not available for this account yet.',
    };
  }
  if (upstream.status === 404) {
    return {
      ok: false,
      httpStatus: 404,
      code: 'identity_missing',
      message: 'We could not find a connected PLCC member profile for this sign-in.',
    };
  }
  if (!upstream.ok) {
    return {
      ok: false,
      httpStatus: 502,
      code: 'vault_unavailable',
      message: 'We could not verify your member access right now. Please try again.',
    };
  }

  let body;
  try {
    body = await upstream.json();
  } catch {
    return {
      ok: false,
      httpStatus: 502,
      code: 'invalid_upstream',
      message: 'We could not verify your member access right now. Please try again.',
    };
  }

  const parsed = parseVaultSelfUserResponse(body);
  if (parsed.kind === 'missing') {
    return {
      ok: false,
      httpStatus: 404,
      code: 'identity_missing',
      message: 'We could not find a connected PLCC member profile for this sign-in.',
    };
  }
  if (parsed.kind === 'invalid') {
    return {
      ok: false,
      httpStatus: 502,
      code: 'invalid_upstream',
      message: 'We could not verify your member access right now. Please try again.',
    };
  }

  if (parsed.member.approvalStatus !== 'approved') {
    return {
      ok: false,
      httpStatus: 403,
      code: 'pending_member',
      message: 'Your membership must be approved before you can use Serve.',
    };
  }

  return { ok: true, member: parsed.member };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string[]} opportunityIds
 * @returns {Promise<Map<string, string>>}
 */
export async function fetchMySignupStatusByOpportunity(supabase, userId, opportunityIds) {
  const map = new Map();
  const ids = (opportunityIds || []).filter((id) => asUuid(id));
  if (!ids.length || !asUuid(userId)) return map;

  const { data, error } = await supabase
    .from('serve_signups')
    .select('opportunity_id, status')
    .eq('user_id', userId)
    .in('opportunity_id', ids);

  if (error) throw error;
  for (const row of data || []) {
    const oid = asUuid(row.opportunity_id);
    if (oid && row.status) map.set(oid, String(row.status));
  }
  return map;
}

/**
 * Own-row Serve eligibility under caller JWT RLS.
 * Selects only status + reason_code — never verified_by / DOB / timestamps for Connect.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId  auth uid from Vault self (must match JWT subject)
 * @returns {Promise<
 *   | { ok: true, row: { status: string, reason_code: string | null } | null }
 *   | { ok: false, code: string }
 * >}
 */
export async function fetchOwnServeEligibility(supabase, userId) {
  const uid = asUuid(userId);
  if (!uid) return { ok: false, code: 'invalid_user' };

  const { data, error } = await supabase
    .from('serve_eligibility')
    .select('status, reason_code')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) {
    console.error('[serve] eligibility read:', error.code || error.message || 'error');
    return { ok: false, code: 'eligibility_read_failed' };
  }

  if (!data) return { ok: true, row: null };
  return {
    ok: true,
    row: {
      status: String(data.status || ''),
      reason_code:
        data.reason_code == null || data.reason_code === ''
          ? null
          : String(data.reason_code),
    },
  };
}

/**
 * Batch capacity aggregates via SECURITY DEFINER RPC.
 * On failure / missing RPC → empty map (callers keep null counts; never fake 0).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} opportunityIds
 * @returns {Promise<Map<string, { activeSignupCount: number, remainingSlots: number | null, capacity: number | null }>>}
 */
export async function fetchServeCapacityAggregates(supabase, opportunityIds) {
  const ids = [
    ...new Set((opportunityIds || []).map((id) => asUuid(id)).filter(Boolean)),
  ];
  if (!ids.length) return new Map();
  // RPC batch max is 50 — chunk defensively
  const chunks = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
  /** @type {unknown[]} */
  const allRows = [];
  for (const chunk of chunks) {
    const { data, error } = await supabase.rpc('serve_opportunity_capacity', {
      p_opportunity_ids: chunk,
    });
    if (error) {
      // Missing migration or transient failure — do not invent zeros
      console.error('[serve] capacity rpc:', error.code || error.message || 'error');
      return new Map();
    }
    if (Array.isArray(data)) allRows.push(...data);
  }
  return indexCapacityAggregates(allRows);
}

/**
 * List open member-visible opportunities with capacity aggregates when available.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {{ ministryId?: string | null, teamId?: string | null }} filters
 */
export async function listServeOpportunities(supabase, userId, filters = {}) {
  let q = supabase
    .from('serve_opportunities')
    .select(OPP_SELECT)
    .eq('status', 'open')
    .order('starts_at', { ascending: true, nullsFirst: false });

  if (filters.ministryId) q = q.eq('ministry_id', filters.ministryId);
  if (filters.teamId) q = q.eq('team_id', filters.teamId);

  const { data, error } = await q;
  if (error) throw error;

  const visible = (data || []).filter((r) => isMemberVisibleOpportunity(r));
  const rows = await attachPublicRelationLabels(visible);
  const statusMap = await fetchMySignupStatusByOpportunity(
    supabase,
    userId,
    rows.map((r) => r.id)
  );
  const aggregates = await fetchServeCapacityAggregates(
    supabase,
    rows.map((r) => r.id)
  );

  return rows
    .map((row) => {
      const dto = sanitizeOpportunityDto(row, {
        mySignupStatus: statusMap.get(row.id) || null,
        activeSignupCount: null,
      });
      return applyCapacityAggregateToDto(dto, aggregates);
    })
    .filter(Boolean);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string} opportunityId
 */
export async function getServeOpportunity(supabase, userId, opportunityId) {
  const id = asUuid(opportunityId);
  if (!id) return null;

  const { data, error } = await supabase
    .from('serve_opportunities')
    .select(OPP_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (!isMemberVisibleOpportunity(data)) return null;

  const [hydrated] = await attachPublicRelationLabels([data]);
  const statusMap = await fetchMySignupStatusByOpportunity(supabase, userId, [id]);
  const aggregates = await fetchServeCapacityAggregates(supabase, [id]);
  const dto = sanitizeOpportunityDto(hydrated || data, {
    mySignupStatus: statusMap.get(id) || null,
    activeSignupCount: null,
  });
  return applyCapacityAggregateToDto(dto, aggregates);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
export async function listMyServeSignups(supabase, userId) {
  const uid = asUuid(userId);
  if (!uid) return [];

  const { data: signups, error } = await supabase
    .from('serve_signups')
    .select('id, opportunity_id, status, created_at, cancelled_at, updated_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const oppIds = [...new Set((signups || []).map((s) => s.opportunity_id).filter(Boolean))];
  /** @type {Map<string, object>} */
  const oppById = new Map();
  if (oppIds.length) {
    // Own signup may reference cancelled/completed opps — select by id (may be filtered by open-only RLS).
    const { data: opps, error: oErr } = await supabase
      .from('serve_opportunities')
      .select(OPP_SELECT)
      .in('id', oppIds);
    if (oErr) throw oErr;
    const hydrated = await attachPublicRelationLabels(opps || []);
    for (const o of hydrated) {
      if (o?.id) oppById.set(o.id, o);
    }
  }

  return (signups || [])
    .map((s) => sanitizeMySignupDto(s, oppById.get(s.opportunity_id) || null))
    .filter(Boolean);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} opportunityId
 */
export async function rpcServeSignup(supabase, opportunityId) {
  return supabase.rpc('serve_signup_opportunity', {
    p_opportunity_id: opportunityId,
  });
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} opportunityId
 */
export async function rpcServeCancel(supabase, opportunityId) {
  return supabase.rpc('serve_cancel_signup', {
    p_opportunity_id: opportunityId,
  });
}

export { parseBearerAuthorization };
