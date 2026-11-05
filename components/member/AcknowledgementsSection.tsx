import React from 'react';
import { Camera, CheckCircle2, CircleAlert } from 'lucide-react';
import { MEDIA_NOTICE_VERSION, type MediaNoticeAck } from '../../lib/authTypes';

function formatAckDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function isCurrentAck(mediaNotice: MediaNoticeAck | null | undefined): boolean {
  if (!mediaNotice?.acknowledgedAt) return false;
  if (!mediaNotice.version) return true;
  return mediaNotice.version === MEDIA_NOTICE_VERSION;
}

type Props = {
  mediaNotice: MediaNoticeAck | null | undefined;
};

/**
 * Member-facing acknowledgements (photography / media notice).
 * Persisted on Vault users.notification_prefs via the member-self bridge.
 */
export const AcknowledgementsSection: React.FC<Props> = ({ mediaNotice }) => {
  const acknowledged = isCurrentAck(mediaNotice);

  return (
    <section aria-labelledby="profile-acknowledgements-heading" className="space-y-3">
      <div className="space-y-1">
        <h2 id="profile-acknowledgements-heading" className="text-sm font-black text-[#1A1A1A]">
          Acknowledgements
        </h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          Notices you have agreed to on Connect. These stay with your PLCC member record.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-burgundy/5 text-burgundy flex items-center justify-center shrink-0 border border-burgundy/10">
          <Camera size={18} aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-bold text-[#1A1A1A]">Photography &amp; Media Notice</p>
          {acknowledged && mediaNotice ? (
            <p className="text-xs text-gray-600 leading-relaxed inline-flex items-start gap-1.5">
              <CheckCircle2 size={14} className="text-burgundy shrink-0 mt-0.5" aria-hidden />
              <span>Acknowledged on {formatAckDate(mediaNotice.acknowledgedAt)}</span>
            </p>
          ) : (
            <p className="text-xs text-gray-600 leading-relaxed inline-flex items-start gap-1.5">
              <CircleAlert size={14} className="text-amber-700 shrink-0 mt-0.5" aria-hidden />
              <span>Not yet acknowledged. You will be prompted when you use Connect as a member.</span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default AcknowledgementsSection;
