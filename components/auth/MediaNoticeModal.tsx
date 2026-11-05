import React, { useEffect, useState } from 'react';
import { Camera, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { MEDIA_NOTICE_VERSION } from '../../lib/authTypes';
import { acknowledgeMediaNotice, MemberSelfError } from '../../lib/memberSelfClient';

const SESSION_DISMISS_KEY = 'awc_media_notice_dismissed';

function hasCurrentMediaAck(mediaNotice: {
  acknowledgedAt: string;
  version: string | null;
} | null): boolean {
  if (!mediaNotice?.acknowledgedAt) return false;
  if (!mediaNotice.version) return true;
  return mediaNotice.version === MEDIA_NOTICE_VERSION;
}

/**
 * Congregation photography / media acknowledgment.
 * Acknowledge persists on the Vault user; “Not now” is session-only and reappears next sign-in.
 */
export const MediaNoticeModal: React.FC = () => {
  const {
    isAuthenticated,
    isLoading: authLoading,
    identity,
    identityLoading,
    memberAccessState,
    applyIdentity,
  } = useAuth();
  const [sessionDismissed, setSessionDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear session dismiss on sign-out so the next visit re-prompts
  useEffect(() => {
    if (!isAuthenticated) {
      try {
        sessionStorage.removeItem(SESSION_DISMISS_KEY);
      } catch {
        /* ignore */
      }
      setSessionDismissed(false);
    }
  }, [isAuthenticated]);

  const ready =
    isAuthenticated &&
    !authLoading &&
    !identityLoading &&
    !!identity &&
    (memberAccessState === 'approved_member' || memberAccessState === 'pending');

  // Wait until pending members finish Connect setup before prompting
  const pastPending = memberAccessState === 'approved_member';
  const acknowledged = hasCurrentMediaAck(identity?.mediaNotice ?? null);
  const open = ready && pastPending && !acknowledged && !sessionDismissed;

  const dismissForSession = () => {
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setSessionDismissed(true);
  };

  const acknowledge = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const member = await acknowledgeMediaNotice();
      applyIdentity(member);
      try {
        sessionStorage.removeItem(SESSION_DISMISS_KEY);
      } catch {
        /* ignore */
      }
      setSessionDismissed(false);
    } catch (err) {
      if (err instanceof MemberSelfError) {
        setError(err.message);
      } else {
        setError('Could not save. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[320] flex items-center justify-center p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] bg-[#0d1a14]/45 backdrop-blur-md"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-notice-title"
        className="relative w-full max-w-lg max-h-[min(90vh,720px)] overflow-y-auto bg-eggshell rounded-[2rem] shadow-2xl border border-white/80"
      >
        <div className="h-1.5 bg-gradient-to-r from-burgundy via-gold to-burgundy" />

        <div className="p-6 md:p-8 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-burgundy/5 text-burgundy flex items-center justify-center shrink-0 border border-burgundy/10">
              <Camera size={22} aria-hidden />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-burgundy/60 mb-1">
                Promised Land Christian Center
              </p>
              <h2
                id="media-notice-title"
                className="text-xl md:text-2xl font-black text-[#0d1a14] tracking-tight leading-snug"
              >
                Photography &amp; Media Notice
              </h2>
            </div>
          </div>

          <div className="rounded-2xl bg-amber-50/80 border border-amber-100 px-4 py-3 text-sm text-amber-950 font-medium leading-relaxed">
            By attending PLCC services and events on church premises, you acknowledge that Promised Land
            Christian Center may photograph or record during or after worship for ministry, outreach,
            and communication purposes. This may include children in public areas of the campus.
          </div>

          <div className="space-y-3 text-sm text-gray-600 font-medium leading-relaxed">
            <p>PLCC may use photographs and video for:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-gray-500">
              <li>Church website and social media ministry outreach</li>
              <li>Internal newsletters and bulletins</li>
              <li>Event recaps and promotional materials</li>
              <li>Archival and historical documentation</li>
            </ul>
            <p>
              Published photos of children require appropriate parental consent under PLCC policy.
              Photography in children&apos;s ministry rooms is restricted to authorized media staff.
            </p>
            <p>
              If you or your family prefer not to appear in church photography, please submit a
              written opt-out request to the Church Office or speak with the Administrator /
              Secretary at the front desk. Your preference will be noted on your member record and
              shared with the Media Team.
            </p>
          </div>

          {error && (
            <p
              className="text-sm font-medium text-red-800 bg-red-50 border border-red-100 rounded-xl px-3 py-2"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={() => void acknowledge()}
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 px-4 min-h-[48px] rounded-xl bg-[#0d1a14] text-amber-100 text-sm font-bold hover:bg-[#14251d] transition-colors disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="animate-spin" size={18} aria-hidden />
              ) : (
                <ShieldCheck size={18} aria-hidden />
              )}
              I acknowledge
            </button>
            <button
              type="button"
              onClick={dismissForSession}
              disabled={saving}
              className="flex-1 py-3.5 px-4 min-h-[48px] rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              Not now
            </button>
          </div>
          <p className="text-xs text-center text-gray-500 font-medium">
            Choosing “Not now” closes this for the current visit. It will appear again the next time
            you sign in until you acknowledge.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MediaNoticeModal;
