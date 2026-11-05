/**
 * Connect Serve bridge (member-safe):
 *   GET  /api/serve?resource=opportunities[&ministryId=&teamId=]
 *   GET  /api/serve?resource=opportunity&id=
 *   GET  /api/serve?resource=my
 *   GET  /api/serve?resource=eligibility
 *   POST /api/serve  { action: "signup"|"cancel", opportunityId }
 *
 * Auth: Bearer JWT → Vault self approved-member gate → user-scoped Supabase (RLS).
 * Eligibility summary is read-only (own row). Signup requires status === eligible
 * (staff-verified). Cancel allowed for existing signups regardless of eligibility.
 * Never logs tokens. Never uses elevated DB keys in the browser. No admin CRUD.
 */
import {
  createServeUserClient,
  fetchApprovedServeMember,
  fetchOwnServeEligibility,
  getServeOpportunity,
  listMyServeSignups,
  listServeOpportunities,
  parseServeSupabaseEnv,
  rpcServeCancel,
  rpcServeSignup,
} from './_utils/serveClient.js';
import { parseBearerAuthorization } from './_utils/memberIdentity.js';
import {
  asUuid,
  assertCancelAllowed,
  decideServeSignupAuthorization,
  mapServeRpcError,
  parseServeListFilters,
  parseServeMutationBody,
  rejectServeQueryIdentitySpoof,
  serveEligibilitySummary,
} from './_utils/serveSanitize.js';

const UPSTREAM_TIMEOUT_MS = 12000;

function setPrivateNoStore(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
}

function json(res, status, body) {
  setPrivateNoStore(res);
  res.status(status).json(body);
}

/**
 * Load own eligibility once per request. Distinguishes no-row from read failure.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<
 *   | { ok: true, eligibility: ReturnType<typeof serveEligibilitySummary> }
 *   | { ok: false }
 * >}
 */
async function loadOwnEligibilitySummary(supabase, userId) {
  const result = await fetchOwnServeEligibility(supabase, userId);
  if (!result.ok) return { ok: false };
  return { ok: true, eligibility: serveEligibilitySummary(result.row) };
}

/**
 * @param {any} req
 * @param {any} res
 */
export default async function handler(req, res) {
  setPrivateNoStore(res);

  const method = String(req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, {
      ok: false,
      code: 'method_not_allowed',
      message: 'This endpoint only supports GET and POST.',
    });
  }

  const auth = parseBearerAuthorization(req.headers?.authorization);
  if (!auth.ok) {
    return json(res, 401, {
      ok: false,
      code: 'unauthorized',
      message: 'Please sign in again to continue.',
    });
  }

  const supabaseEnv = parseServeSupabaseEnv(process.env);
  if (!supabaseEnv.ok) {
    console.error('[serve] supabase env:', supabaseEnv.reason);
    return json(res, 503, {
      ok: false,
      code: 'bridge_unconfigured',
      message: 'Serve is not available right now. Please try again later.',
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const memberResult = await fetchApprovedServeMember(auth.token, controller.signal);
    if (!memberResult.ok) {
      return json(res, memberResult.httpStatus, {
        ok: false,
        code: memberResult.code,
        message: memberResult.message,
      });
    }

    const supabase = createServeUserClient(
      supabaseEnv.url,
      supabaseEnv.anonKey,
      auth.token
    );
    const userId = memberResult.member.id;

    if (method === 'GET') {
      const spoof = rejectServeQueryIdentitySpoof(req.query || {});
      if (!spoof.ok) {
        return json(res, 400, {
          ok: false,
          code: spoof.code,
          message: spoof.message,
        });
      }

      const resource = String(req.query?.resource || 'opportunities')
        .trim()
        .toLowerCase();

      if (resource === 'eligibility') {
        const loaded = await loadOwnEligibilitySummary(supabase, userId);
        if (!loaded.ok) {
          return json(res, 502, {
            ok: false,
            code: 'serve_unavailable',
            message: 'Serve is temporarily unavailable. Please try again.',
          });
        }
        return json(res, 200, {
          ok: true,
          eligibility: loaded.eligibility,
        });
      }

      // One eligibility read for list/detail/my — never N queries.
      const eligibilityLoaded = await loadOwnEligibilitySummary(supabase, userId);
      const eligibility = eligibilityLoaded.ok ? eligibilityLoaded.eligibility : null;

      if (resource === 'opportunities') {
        const filters = parseServeListFilters(req.query || {});
        if (!filters.ok) {
          return json(res, 400, {
            ok: false,
            code: filters.code,
            message: filters.message,
          });
        }
        const opportunities = await listServeOpportunities(supabase, userId, {
          ministryId: filters.ministryId,
          teamId: filters.teamId,
        });
        const body = { ok: true, opportunities };
        if (eligibility) body.eligibility = eligibility;
        return json(res, 200, body);
      }

      if (resource === 'opportunity') {
        const id = asUuid(req.query?.id);
        if (!id) {
          return json(res, 400, {
            ok: false,
            code: 'invalid_opportunity_id',
            message: 'A valid opportunity id is required.',
          });
        }
        const opportunity = await getServeOpportunity(supabase, userId, id);
        if (!opportunity) {
          return json(res, 404, {
            ok: false,
            code: 'opportunity_not_found',
            message: 'That Serve opportunity was not found.',
          });
        }
        const body = { ok: true, opportunity };
        if (eligibility) body.eligibility = eligibility;
        return json(res, 200, body);
      }

      if (resource === 'my') {
        // Always auth member — query identity overrides already rejected above.
        const items = await listMyServeSignups(supabase, userId);
        const body = { ok: true, items };
        if (eligibility) body.eligibility = eligibility;
        return json(res, 200, body);
      }

      return json(res, 400, {
        ok: false,
        code: 'invalid_resource',
        message: 'Unknown Serve resource.',
      });
    }

    // POST mutations
    const parsed = parseServeMutationBody(req.body || {});
    if (!parsed.ok) {
      return json(res, 400, {
        ok: false,
        code: parsed.code,
        message: parsed.message,
      });
    }

    if (parsed.action === 'signup') {
      const eligibilityResult = await fetchOwnServeEligibility(supabase, userId);
      const decision = decideServeSignupAuthorization(eligibilityResult);
      if (!decision.allow) {
        return json(res, decision.httpStatus, {
          ok: false,
          code: decision.code,
          message: decision.message,
          ...(decision.reason ? { reason: decision.reason } : {}),
          eligibility: decision.eligibility,
        });
      }
      const { data, error } = await rpcServeSignup(supabase, parsed.opportunityId);
      if (error) {
        const mapped = mapServeRpcError(error);
        return json(res, mapped.httpStatus, {
          ok: false,
          code: mapped.code,
          message: mapped.message,
          eligibility: decision.eligibility,
        });
      }
      return json(res, 200, {
        ok: true,
        action: 'signup',
        result: data && typeof data === 'object' ? sanitizeRpcResult(data) : data,
        eligibility: decision.eligibility,
      });
    }

    if (parsed.action === 'cancel') {
      assertCancelAllowed();
      const { data, error } = await rpcServeCancel(supabase, parsed.opportunityId);
      if (error) {
        const mapped = mapServeRpcError(error);
        return json(res, mapped.httpStatus, {
          ok: false,
          code: mapped.code,
          message: mapped.message,
        });
      }
      return json(res, 200, {
        ok: true,
        action: 'cancel',
        result: data && typeof data === 'object' ? sanitizeRpcResult(data) : data,
      });
    }

    return json(res, 400, {
      ok: false,
      code: 'invalid_action',
      message: 'Unknown Serve action.',
    });
  } catch (err) {
    const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    console.error('[serve] error:', aborted ? 'timeout' : err?.message || 'unknown');
    return json(res, aborted ? 504 : 502, {
      ok: false,
      code: aborted ? 'timeout' : 'serve_unavailable',
      message: 'Serve is temporarily unavailable. Please try again.',
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Strip unexpected RPC payload keys — keep member-safe fields only.
 * @param {Record<string, unknown>} data
 */
function sanitizeRpcResult(data) {
  const out = {};
  if (data.ok === true || data.ok === false) out.ok = data.ok;
  if (typeof data.signupStatus === 'string') out.signupStatus = data.signupStatus;
  if (typeof data.opportunityId === 'string') out.opportunityId = data.opportunityId;
  if (data.remainingSlots === null || typeof data.remainingSlots === 'number') {
    out.remainingSlots = data.remainingSlots;
  }
  if (data.idempotent === true) out.idempotent = true;
  return out;
}
