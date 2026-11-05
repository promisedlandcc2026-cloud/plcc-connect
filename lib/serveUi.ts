/**
 * Member Serve UI — pure display helpers (no I/O).
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ServeEligibilityStatus =
  | 'not_verified'
  | 'eligible'
  | 'ineligible'
  | 'suspended';

export type ServeEligibilitySummary = {
  status: ServeEligibilityStatus;
  eligibilitySatisfied: boolean;
  signupEnabled: boolean;
  reasonCode: string;
};

export type ServeOpportunity = {
  id: string;
  title: string;
  description: string | null;
  roleLabel: string | null;
  location: string | null;
  startsAt: string | null;
  endsAt: string | null;
  capacity: number | null;
  activeSignupCount: number | null;
  remainingSlots: number | null;
  requiresApproval: boolean;
  status: string;
  ministry: { id?: string; name: string } | null;
  team: { id?: string; name: string } | null;
  event: { id?: string; title: string } | null;
  mySignupStatus: string | null;
};

export type ServeMyItem = {
  id: string;
  opportunityId: string;
  status: string | null;
  createdAt: string | null;
  cancelledAt: string | null;
  opportunity: {
    id: string;
    title: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
    location?: string | null;
    status?: string | null;
    ministry?: { id?: string; name: string } | null;
    team?: { id?: string; name: string } | null;
    event?: { id?: string; title: string } | null;
    requiresApproval?: boolean;
  };
};

export function asServeUuid(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!UUID_RE.test(t)) return null;
  return t;
}

/** Capacity label from API remainingSlots only — never recompute. */
export function formatRemainingSlots(remainingSlots: number | null | undefined): string {
  if (remainingSlots == null) return 'Open availability';
  const n = Number(remainingSlots);
  if (!Number.isFinite(n) || n <= 0) return 'Full';
  if (n === 1) return '1 spot left';
  return `${Math.trunc(n)} spots left`;
}

export function canShowSignupCta(
  eligibility: ServeEligibilitySummary | null | undefined,
  opportunity: Pick<ServeOpportunity, 'mySignupStatus' | 'remainingSlots'> | null | undefined
): boolean {
  if (!eligibility || !opportunity) return false;
  if (!eligibility.signupEnabled || eligibility.status !== 'eligible') return false;
  const mine = String(opportunity.mySignupStatus || '').toLowerCase();
  if (mine === 'pending' || mine === 'confirmed') return false;
  if (opportunity.remainingSlots === 0) return false;
  return true;
}

export function canShowCancelCta(signupStatus: string | null | undefined): boolean {
  const s = String(signupStatus || '').toLowerCase();
  return s === 'pending' || s === 'confirmed';
}

export function eligibilityNoticeCopy(eligibility: ServeEligibilitySummary): {
  title: string;
  body: string;
  tone: 'ok' | 'warn' | 'blocked';
} {
  switch (eligibility.status) {
    case 'eligible':
      return {
        title: 'You’re verified to serve.',
        body: 'You can sign up for open Serve opportunities.',
        tone: 'ok',
      };
    case 'ineligible':
      return {
        title: 'Serve eligibility unavailable',
        body:
          eligibility.reasonCode === 'under_18'
            ? 'This Serve opportunity is currently limited to verified adult members.'
            : 'Your Serve eligibility is currently unavailable.',
        tone: 'blocked',
      };
    case 'suspended':
      return {
        title: 'Serve self-signup suspended',
        body: 'Your Serve self-signup is temporarily suspended.',
        tone: 'blocked',
      };
    default:
      return {
        title: 'Serve eligibility not reviewed',
        body: 'Your Serve eligibility has not been reviewed yet. Contact church leadership if you need help.',
        tone: 'warn',
      };
  }
}

export function eligibilityBlockedCopy(eligibility: ServeEligibilitySummary): string {
  if (eligibility.status === 'ineligible' && eligibility.reasonCode === 'under_18') {
    return 'This Serve opportunity is currently limited to verified adult members.';
  }
  if (eligibility.status === 'ineligible') {
    return 'Your Serve eligibility is currently unavailable.';
  }
  if (eligibility.status === 'suspended') {
    return 'Your Serve self-signup is temporarily suspended.';
  }
  return 'Serve eligibility has not been verified yet. Contact church leadership.';
}

export function mapServeMemberError(
  code: string | undefined,
  fallback = 'Serve is temporarily unavailable. Please try again.'
): string {
  switch (String(code || '')) {
    case 'serve_not_verified':
      return 'Your Serve eligibility has not been verified yet.';
    case 'serve_ineligible':
      return 'You are not currently eligible for Serve self-signup.';
    case 'serve_suspended':
      return 'Your Serve self-signup is temporarily suspended.';
    case 'opportunity_full':
      return 'This opportunity just filled up.';
    case 'opportunity_not_open':
      return 'This opportunity is no longer open.';
    case 'opportunity_not_found':
      return 'That Serve opportunity was not found.';
    case 'serve_unavailable':
    case 'timeout':
    case 'network':
      return 'Serve is temporarily unavailable. Please try again.';
    case 'unauthorized':
    case 'session_missing':
      return 'Please sign in again to continue.';
    case 'pending_member':
      return 'Your membership must be approved before you can use Serve.';
    default:
      return fallback;
  }
}

export function formatServeWhen(startsAt: string | null | undefined, endsAt?: string | null): string {
  if (!startsAt) return 'Schedule TBA';
  const start = new Date(startsAt);
  if (!Number.isFinite(start.getTime())) return 'Schedule TBA';
  const datePart = start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timePart = start.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (!endsAt) return `${datePart} · ${timePart}`;
  const end = new Date(endsAt);
  if (!Number.isFinite(end.getTime())) return `${datePart} · ${timePart}`;
  const endTime = end.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart} · ${timePart}–${endTime}`;
}

export function signupStatusLabel(status: string | null | undefined): string {
  switch (String(status || '').toLowerCase()) {
    case 'pending':
      return 'Pending Approval';
    case 'confirmed':
      return 'Confirmed';
    case 'cancelled':
      return 'Cancelled';
    case 'declined':
      return 'Declined';
    default:
      return 'Not signed up';
  }
}

export function isActiveSignupStatus(status: string | null | undefined): boolean {
  const s = String(status || '').toLowerCase();
  return s === 'pending' || s === 'confirmed';
}

/** Build signup POST body — never include identity/eligibility fields. */
export function buildSignupRequestBody(opportunityId: string): {
  action: 'signup';
  opportunityId: string;
} {
  return { action: 'signup', opportunityId };
}

export function buildCancelRequestBody(opportunityId: string): {
  action: 'cancel';
  opportunityId: string;
} {
  return { action: 'cancel', opportunityId };
}
