/**
 * Connect Serve bridge — pure sanitizers, gates, and RPC error mapping.
 * No I/O. Fail closed on PII / roster / spoofed ownership fields.
 */

export const SERVE_SIGNUP_ACTIVE = Object.freeze(['pending', 'confirmed']);

/**
 * Cancel of an existing signup remains allowed regardless of eligibility.
 * Phase 2.3F.8: signup is authorized by staff-verified serve_eligibility only
 * (temporary global SERVE_ELIGIBILITY_ENABLED block removed).
 */

/** Stable member-safe eligibility reason codes (no DOB). */
export const SERVE_ELIGIBILITY_REASONS = Object.freeze({
  eligible: 'eligible',
  minor: 'minor',
  profile_incomplete: 'profile_incomplete',
  unavailable: 'unavailable',
  not_ready: 'not_ready',
  not_verified: 'not_verified',
  ineligible: 'ineligible',
  suspended: 'suspended',
});

/** Stored DB statuses (absence of row = not_verified). */
export const SERVE_ELIGIBILITY_ROW_STATUSES = Object.freeze([
  'eligible',
  'ineligible',
  'suspended',
]);

/** Member-safe reason codes Connect may emit (never arbitrary DB free text). */
export const SERVE_MEMBER_SAFE_REASON_CODES = Object.freeze([
  'not_verified',
  'adult_verified',
  'under_18',
  'policy_ineligible',
  'temporarily_suspended',
]);

const SAFE_REASONS_BY_STATUS = Object.freeze({
  eligible: Object.freeze(['adult_verified']),
  ineligible: Object.freeze(['under_18', 'policy_ineligible']),
  suspended: Object.freeze(['temporarily_suspended']),
  not_verified: Object.freeze(['not_verified']),
});

const DEFAULT_REASON_BY_STATUS = Object.freeze({
  eligible: 'adult_verified',
  ineligible: 'policy_ineligible',
  suspended: 'temporarily_suspended',
  not_verified: 'not_verified',
});

const IDENTITY_SPOOF_KEYS = Object.freeze([
  'userId',
  'user_id',
  'memberId',
  'member_id',
  'eligibilityUserId',
  'role',
  'approvalStatus',
  'approval_status',
  'created_by',
  'createdBy',
  'canServe',
  'eligibilitySatisfied',
  'signupEnabled',
  'eligibility',
  'eligibilityStatus',
  'status',
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function asUuid(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!UUID_RE.test(t)) return null;
  return t;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function asNullableString(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length ? t : null;
}

/**
 * remainingSlots from trusted capacity + active (pending|confirmed).
 * capacity null → null (unlimited). Never negative.
 * @param {unknown} capacity
 * @param {unknown} activeCount
 * @returns {number | null}
 */
export function remainingSlots(capacity, activeCount) {
  if (capacity == null || capacity === '') return null;
  const cap = typeof capacity === 'number' ? capacity : Number(capacity);
  if (!Number.isFinite(cap)) return null;
  if (activeCount == null || activeCount === '') return null;
  const active = typeof activeCount === 'number' ? activeCount : Number(activeCount);
  if (!Number.isFinite(active)) return null;
  return Math.max(0, Math.trunc(cap) - Math.trunc(active));
}

/**
 * Count active statuses only. Ignores member_id.
 * @param {Array<{ opportunity_id?: string, status?: string }>} signups
 * @returns {Map<string, number>}
 */
export function aggregateActiveSignupCounts(signups) {
  const active = new Map();
  for (const s of signups || []) {
    if (!SERVE_SIGNUP_ACTIVE.includes(String(s?.status || ''))) continue;
    const oppId = asUuid(s?.opportunity_id);
    if (!oppId) continue;
    active.set(oppId, (active.get(oppId) || 0) + 1);
  }
  return active;
}

/**
 * List rule: status open AND (no ends_at OR ends_at >= now).
 * Past-ended open rows are excluded. starts_at may be in the past (ongoing).
 * @param {object} row
 * @param {string} [nowIso]
 * @returns {boolean}
 */
export function isMemberVisibleOpportunity(row, nowIso = new Date().toISOString()) {
  if (!row || typeof row !== 'object') return false;
  if (String(row.status || '') !== 'open') return false;
  const ends = asNullableString(row.ends_at);
  if (ends && ends < nowIso) return false;
  return true;
}

/**
 * Reject client ownership / role spoof fields on mutation bodies.
 * @param {unknown} body
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function rejectClientIdentitySpoof(body) {
  if (body == null) return { ok: true };
  if (typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, code: 'invalid_request', message: 'Invalid request body.' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  for (const k of IDENTITY_SPOOF_KEYS) {
    if (Object.prototype.hasOwnProperty.call(b, k) && b[k] != null && b[k] !== '') {
      return {
        ok: false,
        code: 'identity_spoof_rejected',
        message: 'Client identity fields are not accepted.',
      };
    }
  }
  return { ok: true };
}

/**
 * Reject explicit identity spoof fields on Serve GET query strings.
 * Prefer reject over ignore when a caller supplies another member's id.
 * @param {unknown} query
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function rejectServeQueryIdentitySpoof(query) {
  if (query == null) return { ok: true };
  if (typeof query !== 'object' || Array.isArray(query)) {
    return { ok: false, code: 'invalid_request', message: 'Invalid request.' };
  }
  /** @type {Record<string, unknown>} */
  const q = query;
  for (const k of IDENTITY_SPOOF_KEYS) {
    if (Object.prototype.hasOwnProperty.call(q, k) && q[k] != null && q[k] !== '') {
      return {
        ok: false,
        code: 'identity_spoof_rejected',
        message: 'Client identity fields are not accepted.',
      };
    }
  }
  return { ok: true };
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, action: 'signup' | 'cancel', opportunityId: string } | { ok: false, code: string, message: string }}
 */
export function parseServeMutationBody(body) {
  const spoof = rejectClientIdentitySpoof(body);
  if (!spoof.ok) return spoof;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, code: 'invalid_request', message: 'Invalid request body.' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  const action = String(b.action || '')
    .trim()
    .toLowerCase();
  if (action !== 'signup' && action !== 'cancel') {
    return { ok: false, code: 'invalid_action', message: 'Unknown Serve action.' };
  }
  const opportunityId = asUuid(b.opportunityId ?? b.opportunity_id);
  if (!opportunityId) {
    return {
      ok: false,
      code: 'invalid_opportunity_id',
      message: 'A valid opportunityId is required.',
    };
  }
  return { ok: true, action, opportunityId };
}

/**
 * @param {unknown} query
 * @returns {{ ok: true, ministryId: string | null, teamId: string | null } | { ok: false, code: string, message: string }}
 */
export function parseServeListFilters(query) {
  const q = query && typeof query === 'object' ? query : {};
  /** @type {Record<string, unknown>} */
  const raw = q;
  let ministryId = null;
  let teamId = null;
  if (raw.ministryId != null && raw.ministryId !== '') {
    ministryId = asUuid(raw.ministryId);
    if (!ministryId) {
      return {
        ok: false,
        code: 'invalid_ministry_id',
        message: 'ministryId must be a valid UUID.',
      };
    }
  }
  if (raw.teamId != null && raw.teamId !== '') {
    teamId = asUuid(raw.teamId);
    if (!teamId) {
      return {
        ok: false,
        code: 'invalid_team_id',
        message: 'teamId must be a valid UUID.',
      };
    }
  }
  return { ok: true, ministryId, teamId };
}

/**
 * Map relation embed to { id, name } | null. Never pass emails.
 * @param {unknown} rel
 * @returns {{ id: string, name: string } | null}
 */
function sanitizeNamedRelation(rel) {
  if (!rel || typeof rel !== 'object' || Array.isArray(rel)) return null;
  /** @type {Record<string, unknown>} */
  const r = rel;
  const id = asUuid(r.id);
  const name = asNullableString(r.name);
  if (!name) return null;
  return { id: id || undefined, name };
}

/**
 * Map event embed — Vault events use `name`; DTO exposes as title.
 * @param {unknown} rel
 * @returns {{ id?: string, title: string } | null}
 */
function sanitizeEventRelation(rel) {
  if (!rel || typeof rel !== 'object' || Array.isArray(rel)) return null;
  /** @type {Record<string, unknown>} */
  const r = rel;
  const id = asUuid(r.id);
  const title = asNullableString(r.title) || asNullableString(r.name);
  if (!title) return null;
  return { id: id || undefined, title };
}

/**
 * Member-safe opportunity DTO. Never includes roster, created_by, emails, member_id.
 * activeSignupCount / remainingSlots may be null when cross-user counts are unavailable under RLS.
 *
 * @param {object} row
 * @param {{ mySignupStatus?: string | null, activeSignupCount?: number | null }} [extra]
 */
export function sanitizeOpportunityDto(row, extra = {}) {
  if (!row || typeof row !== 'object') return null;
  /** @type {Record<string, unknown>} */
  const r = row;
  const id = asUuid(r.id);
  if (!id) return null;
  const title = asNullableString(r.title);
  if (!title) return null;

  const capacity =
    r.capacity == null || r.capacity === ''
      ? null
      : Number.isFinite(Number(r.capacity))
        ? Math.trunc(Number(r.capacity))
        : null;

  const activeRaw = extra.activeSignupCount;
  const activeSignupCount =
    activeRaw == null || activeRaw === ''
      ? null
      : Number.isFinite(Number(activeRaw))
        ? Math.trunc(Number(activeRaw))
        : null;

  const mySignupStatus =
    extra.mySignupStatus == null || extra.mySignupStatus === ''
      ? null
      : asNullableString(extra.mySignupStatus);

  return {
    id,
    title,
    description: asNullableString(r.description),
    roleLabel: asNullableString(r.role_label),
    location: asNullableString(r.location),
    startsAt: asNullableString(r.starts_at),
    endsAt: asNullableString(r.ends_at),
    capacity,
    activeSignupCount,
    remainingSlots: remainingSlots(capacity, activeSignupCount),
    requiresApproval: r.requires_approval === true,
    status: asNullableString(r.status) || 'open',
    ministry: sanitizeNamedRelation(r.ministry),
    team: sanitizeNamedRelation(r.team),
    event: sanitizeEventRelation(r.event),
    mySignupStatus,
  };
}

/**
 * My Serving row — self signup + safe opportunity fields only.
 * @param {object} signup
 * @param {object | null} opportunity
 */
export function sanitizeMySignupDto(signup, opportunity) {
  if (!signup || typeof signup !== 'object') return null;
  /** @type {Record<string, unknown>} */
  const s = signup;
  const id = asUuid(s.id);
  const opportunityId = asUuid(s.opportunity_id);
  if (!id || !opportunityId) return null;

  const oppDto = opportunity ? sanitizeOpportunityDto(opportunity, {}) : null;

  return {
    id,
    opportunityId,
    status: asNullableString(s.status),
    createdAt: asNullableString(s.created_at),
    cancelledAt: asNullableString(s.cancelled_at),
    opportunity: oppDto
      ? {
          id: oppDto.id,
          title: oppDto.title,
          startsAt: oppDto.startsAt,
          endsAt: oppDto.endsAt,
          location: oppDto.location,
          status: oppDto.status,
          ministry: oppDto.ministry,
          team: oppDto.team,
          event: oppDto.event,
          requiresApproval: oppDto.requiresApproval,
        }
      : { id: opportunityId, title: null, status: null },
  };
}

/**
 * Gate signup using staff-verified serve_eligibility row (or absence).
 * @param {{ status?: unknown, reason_code?: unknown, reasonCode?: unknown } | null | undefined} row
 * @returns {{ ok: true, eligibility: object } | { ok: false, code: string, message: string, httpStatus: number, reason?: string, eligibility: object }}
 */
export function assertSignupEligibilityGate(row = null) {
  const decision = decideServeSignupAuthorization({ ok: true, row: row ?? null });
  if (decision.allow) {
    return { ok: true, eligibility: decision.eligibility };
  }
  return {
    ok: false,
    code: decision.code,
    message: decision.message,
    httpStatus: decision.httpStatus,
    reason: decision.reason,
    eligibility: decision.eligibility,
  };
}

/**
 * Server-side signup authorization from own eligibility load result.
 * Does not call the signup RPC — callers invoke RPC only when allow=true.
 *
 * @param {{ ok: false } | { ok: true, row: object | null }} eligibilityLoad
 * @returns {{
 *   allow: boolean,
 *   httpStatus?: number,
 *   code?: string,
 *   message?: string,
 *   reason?: string,
 *   eligibility: ReturnType<typeof toMemberEligibilitySummary>
 * }}
 */
export function decideServeSignupAuthorization(eligibilityLoad) {
  if (!eligibilityLoad || eligibilityLoad.ok !== true) {
    return {
      allow: false,
      httpStatus: 502,
      code: 'serve_unavailable',
      message: 'Serve is temporarily unavailable. Please try again.',
      eligibility: toMemberEligibilitySummary(null),
    };
  }

  const eligibility = toMemberEligibilitySummary(eligibilityLoad.row);
  if (eligibility.status === 'eligible') {
    return { allow: true, eligibility };
  }

  if (eligibility.status === 'ineligible') {
    return {
      allow: false,
      httpStatus: 403,
      code: 'serve_ineligible',
      message: 'You are not eligible to sign up for Serve opportunities.',
      reason: SERVE_ELIGIBILITY_REASONS.ineligible,
      eligibility,
    };
  }

  if (eligibility.status === 'suspended') {
    return {
      allow: false,
      httpStatus: 403,
      code: 'serve_suspended',
      message: 'Serve self-signup is temporarily suspended for your account.',
      reason: SERVE_ELIGIBILITY_REASONS.suspended,
      eligibility,
    };
  }

  return {
    allow: false,
    httpStatus: 403,
    code: 'serve_not_verified',
    message: 'Serve eligibility has not been verified yet.',
    reason: SERVE_ELIGIBILITY_REASONS.not_verified,
    eligibility,
  };
}

/**
 * Sanitize own serve_eligibility row → member-safe summary.
 * Absence of row = not_verified (not an error).
 * Never includes verified_by, verified_at, DOB, user_id, or free-text reasons.
 *
 * eligibilitySatisfied = status === 'eligible'
 * signupEnabled = status === 'eligible' (server-derived; mirrors eligibility after 2.3F.8 activation)
 *
 * @param {{ status?: unknown, reason_code?: unknown, reasonCode?: unknown } | null | undefined} row
 * @returns {{
 *   status: 'not_verified' | 'eligible' | 'ineligible' | 'suspended',
 *   eligibilitySatisfied: boolean,
 *   signupEnabled: boolean,
 *   reasonCode: string
 * }}
 */
export function toMemberEligibilitySummary(row) {
  if (!row || typeof row !== 'object') {
    return {
      status: 'not_verified',
      eligibilitySatisfied: false,
      signupEnabled: false,
      reasonCode: 'not_verified',
    };
  }

  const statusRaw = String(row.status || '')
    .trim()
    .toLowerCase();
  /** @type {'not_verified' | 'eligible' | 'ineligible' | 'suspended'} */
  const status =
    statusRaw === 'eligible' || statusRaw === 'ineligible' || statusRaw === 'suspended'
      ? statusRaw
      : 'not_verified';

  const rawReason = row.reasonCode ?? row.reason_code;
  let reasonCode =
    rawReason == null || rawReason === ''
      ? DEFAULT_REASON_BY_STATUS[status]
      : String(rawReason).trim().toLowerCase();

  const allowed = SAFE_REASONS_BY_STATUS[status];
  if (!allowed.includes(reasonCode)) {
    reasonCode = DEFAULT_REASON_BY_STATUS[status];
  }

  const eligibilitySatisfied = status === 'eligible';
  return {
    status,
    eligibilitySatisfied,
    signupEnabled: eligibilitySatisfied,
    reasonCode,
  };
}

/**
 * Member-safe eligibility summary for API responses (never includes DOB).
 * Pass the caller's own serve_eligibility row, or null when no row.
 * @param {{ status?: unknown, reason_code?: unknown, reasonCode?: unknown } | null | undefined} [row]
 */
export function serveEligibilitySummary(row = null) {
  return toMemberEligibilitySummary(row);
}

/**
 * True if an eligibility summary object leaked forbidden privacy fields.
 * @param {unknown} summary
 * @returns {boolean}
 */
export function eligibilitySummaryHasForbiddenFields(summary) {
  if (!summary || typeof summary !== 'object') return true;
  const forbidden = [
    'verified_by',
    'verifiedBy',
    'verified_at',
    'verifiedAt',
    'user_id',
    'userId',
    'member_id',
    'memberId',
    'birthday',
    'dob',
    'date_of_birth',
    'dateOfBirth',
    'created_at',
    'updated_at',
  ];
  for (const k of forbidden) {
    if (Object.prototype.hasOwnProperty.call(summary, k)) return true;
  }
  return dtoHasForbiddenPrivacyFields(summary);
}

/**
 * Merge capacity aggregate rows into a Map keyed by opportunity_id.
 * Missing / invalid rows are omitted — callers must NOT fabricate zero.
 * @param {unknown} rows
 * @returns {Map<string, { activeSignupCount: number, remainingSlots: number | null, capacity: number | null }>}
 */
export function indexCapacityAggregates(rows) {
  const map = new Map();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    /** @type {Record<string, unknown>} */
    const r = row;
    const id = asUuid(r.opportunity_id ?? r.opportunityId);
    if (!id) continue;
    const activeRaw = r.active_signup_count ?? r.activeSignupCount;
    if (activeRaw == null || activeRaw === '') continue;
    const active = Number(activeRaw);
    if (!Number.isFinite(active)) continue;
    const capRaw = r.capacity;
    const capacity =
      capRaw == null || capRaw === ''
        ? null
        : Number.isFinite(Number(capRaw))
          ? Math.trunc(Number(capRaw))
          : null;
    const remRaw = r.remaining_slots ?? r.remainingSlots;
    let rem = null;
    if (capacity == null) {
      rem = null;
    } else if (remRaw == null || remRaw === '') {
      rem = remainingSlots(capacity, active);
    } else if (Number.isFinite(Number(remRaw))) {
      rem = Math.max(0, Math.trunc(Number(remRaw)));
    } else {
      rem = remainingSlots(capacity, active);
    }
    map.set(id, {
      activeSignupCount: Math.trunc(active),
      remainingSlots: rem,
      capacity,
    });
  }
  return map;
}

/**
 * Apply aggregate to DTO. If aggregate missing → keep null counts (never fake 0).
 * @param {object | null} dto
 * @param {Map<string, { activeSignupCount: number, remainingSlots: number | null }>} aggregates
 */
export function applyCapacityAggregateToDto(dto, aggregates) {
  if (!dto || !dto.id) return dto;
  const agg = aggregates && aggregates.get(dto.id);
  if (!agg) {
    return {
      ...dto,
      activeSignupCount: null,
      remainingSlots: null,
    };
  }
  return {
    ...dto,
    activeSignupCount: agg.activeSignupCount,
    remainingSlots: agg.remainingSlots,
  };
}

/**
 * Cancel is allowed even when eligibility gate is off (reduces commitment).
 * @returns {{ ok: true }}
 */
export function assertCancelAllowed() {
  return { ok: true };
}

/**
 * Map Postgres / PostgREST RPC errors to stable member-safe API errors.
 * @param {unknown} error
 * @returns {{ httpStatus: number, code: string, message: string }}
 */
export function mapServeRpcError(error) {
  const msg = String(
    (error && typeof error === 'object' && /** @type {any} */ (error).message) ||
      (error && typeof error === 'object' && /** @type {any} */ (error).details) ||
      error ||
      ''
  ).toLowerCase();

  const codeHint = String(
    (error && typeof error === 'object' && /** @type {any} */ (error).code) || ''
  ).toLowerCase();

  const blob = `${msg} ${codeHint}`;

  if (blob.includes('not_authenticated') || blob.includes('jwt') || codeHint === '42501') {
    return {
      httpStatus: 401,
      code: 'not_authenticated',
      message: 'Please sign in again to continue.',
    };
  }
  if (blob.includes('user_not_linked')) {
    return {
      httpStatus: 403,
      code: 'user_not_linked',
      message: 'Your account is not linked for Serve yet.',
    };
  }
  if (blob.includes('opportunity_not_found')) {
    return {
      httpStatus: 404,
      code: 'opportunity_not_found',
      message: 'That Serve opportunity was not found.',
    };
  }
  if (blob.includes('opportunity_not_open')) {
    return {
      httpStatus: 409,
      code: 'opportunity_not_open',
      message: 'That Serve opportunity is not open for signup.',
    };
  }
  if (blob.includes('opportunity_full')) {
    return {
      httpStatus: 409,
      code: 'opportunity_full',
      message: 'That Serve opportunity is full.',
    };
  }
  if (blob.includes('serve_eligibility_not_ready')) {
    return {
      httpStatus: 403,
      code: 'serve_eligibility_not_ready',
      message: 'Serve signup is not available yet.',
    };
  }

  return {
    httpStatus: 502,
    code: 'serve_unavailable',
    message: 'Serve is temporarily unavailable. Please try again.',
  };
}

/**
 * Ensure DTO has no forbidden keys (test helper / defense).
 * @param {unknown} dto
 * @returns {boolean}
 */
export function dtoHasForbiddenPrivacyFields(dto) {
  if (!dto || typeof dto !== 'object') return false;
  const json = JSON.stringify(dto);
  const forbidden = [
    'created_by',
    'createdBy',
    'password',
    'password_hash',
    'member_id',
    'memberId',
    'access_token',
    'refresh_token',
    'service_role',
    'phone',
    'roster',
    'signups',
    'email',
  ];
  // Allow null mySignupStatus etc.; flag only exact forbidden property names in tree
  const walk = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    if (Array.isArray(obj)) return obj.some(walk);
    for (const [k, v] of Object.entries(obj)) {
      if (forbidden.includes(k)) return true;
      if (walk(v)) return true;
    }
    return false;
  };
  void json;
  return walk(dto);
}

/**
 * Count Connect top-level api/*.js handlers (excludes _utils).
 * @param {string[]} filenames
 * @returns {number}
 */
export function countApiJsHandlers(filenames) {
  return (filenames || []).filter(
    (f) => typeof f === 'string' && f.endsWith('.js') && !f.includes('/')
  ).length;
}
