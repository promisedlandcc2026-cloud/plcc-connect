import React, { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { Button, ButtonLink } from '../components/ui/Button';
import { useScreenWakeLock } from '../lib/useScreenWakeLock';
import { useTiltSheen } from '../lib/useTiltSheen';
import { RefreshCw, ScanLine } from 'lucide-react';
import { MemberPageHeader } from '../components/member/MemberPageHeader';
import { AWCLogo } from '../components/ui/AWCLogo';
import { ErrorState, LoadingState } from '../components/ui/States';
import {
  fetchMyDigitalCard,
  MemberCardClientError,
  rotateMyDigitalCard,
} from '../lib/memberCardClient';
import type { MemberDigitalCard } from '../lib/memberCardTypes';
import {
  CARD_PRIVACY_COPY,
  CARD_SCREENSHOT_COPY,
  ROTATE_CONFIRM_COPY,
  cardInitials,
  cardStatusLabel,
  formatCardDate,
  mapMemberCardError,
  mapMemberCardRotateError,
} from '../lib/memberCardUi';

function CardAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const initials = cardInitials(name);

  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt={`Photo of ${name}`}
        className="h-20 w-20 rounded-2xl object-cover border-2 border-gold/40 bg-white"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className="h-20 w-20 rounded-2xl bg-gold-cream text-burgundy border-2 border-gold/40 flex items-center justify-center text-2xl font-black"
      aria-hidden
    >
      {initials}
    </div>
  );
}

/**
 * My PLCC Card — login-backed digital membership credential for approved members.
 * QR is rendered locally from opaque qrPayload; never logged or persisted in browser storage.
 */
export const MemberCardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<MemberDigitalCard | null>(null);
  const [rotating, setRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [rotateSuccess, setRotateSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRotateError(null);
    setRotateSuccess(false);
    try {
      // get_my_member_digital_card lazily mints when no card exists.
      setCard(await fetchMyDigitalCard());
    } catch (err) {
      const code = err instanceof MemberCardClientError ? err.code : 'unavailable';
      setError(mapMemberCardError(code));
      setCard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRegenerate = async () => {
    if (rotating || !card) return;
    const ok = window.confirm(ROTATE_CONFIRM_COPY);
    if (!ok) return;

    setRotating(true);
    setRotateError(null);
    setRotateSuccess(false);
    try {
      const next = await rotateMyDigitalCard();
      setCard(next);
      setRotateSuccess(true);
    } catch (err) {
      const code = err instanceof MemberCardClientError ? err.code : 'unavailable';
      setRotateError(mapMemberCardRotateError(code));
      // Keep existing card + QR visible — server remains authoritative.
    } finally {
      setRotating(false);
    }
  };

  useScreenWakeLock(Boolean(card));
  const cardRef = useRef<HTMLElement>(null);
  const sheen = useTiltSheen(cardRef, Boolean(card));

  return (
    <main className="flex-1 px-5 pt-10 pb-28">
      <MemberPageHeader
        title="My PLCC Card"
        eyebrow="Membership"
        subtitle="Your membership card and QR. Show it to a leader when you check in, and you earn points."
        backTo="/me"
        backLabel="Me"
      />

      {loading ? (
        <LoadingState message="Preparing your PLCC card…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : card ? (
        <div className="flex flex-col gap-5">
          <article
            ref={cardRef}
            data-sheen={sheen}
            className="awc-wallet rounded-[1.75rem] border-2 border-gold/30 text-white"
            aria-label="PLCC digital membership card"
          >
            <div className="awc-wallet__sheen" aria-hidden />

            <div className="relative px-5 pt-5 pb-6 flex flex-col items-center text-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <AWCLogo size={56} className="drop-shadow-md brightness-110" />
                <p className="text-xs font-black uppercase tracking-[0.22em] text-gold">
                  Promised Land Christian Center
                </p>
              </div>

              <CardAvatar name={card.displayName} avatarUrl={card.avatarUrl} />

              <div>
                <p className="text-xl font-bold leading-tight">{card.displayName}</p>
                <p className="mt-1 text-sm font-semibold text-gold">{card.label}</p>
              </div>

              <div className="w-full rounded-2xl bg-white/10 border border-white/15 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-widest text-gold/90">
                  Card No.
                </p>
                <p className="mt-1 font-mono text-lg font-bold tracking-wider text-white">
                  {card.cardNumber}
                </p>
              </div>

              <div className="w-full max-w-[260px] rounded-2xl bg-white p-4 shadow-inner">
                <QRCode
                  value={card.qrPayload}
                  size={228}
                  style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                  viewBox="0 0 256 256"
                  fgColor="#0d1a14"
                  bgColor="#FFFFFF"
                  title="Your private PLCC membership QR code"
                />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
                <p>
                  <span className="font-black uppercase tracking-widest text-gold/90">Status </span>
                  <span className="font-bold">{cardStatusLabel(card.cardStatus)}</span>
                </p>
                <span className="text-white/30" aria-hidden>
                  ·
                </span>
                <p>
                  <span className="font-black uppercase tracking-widest text-gold/90">Issued </span>
                  <span className="font-bold">{formatCardDate(card.issuedAt)}</span>
                </p>
                {card.rotatedAt ? (
                  <>
                    <span className="text-white/30" aria-hidden>
                      ·
                    </span>
                    <p>
                      <span className="font-black uppercase tracking-widest text-gold/90">
                        Regenerated{' '}
                      </span>
                      <span className="font-bold">{formatCardDate(card.rotatedAt)}</span>
                    </p>
                  </>
                ) : null}
              </div>
            </div>
          </article>

          <p className="text-sm text-gray-600 leading-relaxed">{CARD_PRIVACY_COPY}</p>
          <p className="text-sm text-gray-500 leading-relaxed">{CARD_SCREENSHOT_COPY}</p>

          {rotateSuccess ? (
            <p className="text-sm font-semibold text-burgundy" role="status">
              Your QR code has been regenerated.
            </p>
          ) : null}
          {rotateError ? (
            <p className="text-sm font-semibold text-red-700" role="alert">
              {rotateError}
            </p>
          ) : null}

          <ButtonLink to="/scan-in" variant="primary" fullWidth>
            <ScanLine size={18} aria-hidden />
            Leader showing a room code? Scan it
          </ButtonLink>

          <Button
            variant="secondary"
            fullWidth
            onClick={() => void onRegenerate()}
            disabled={rotating || card.cardStatus === 'revoked'}
          >
            <RefreshCw size={18} className={rotating ? 'animate-spin' : ''} aria-hidden />
            {rotating ? 'Regenerating…' : 'Regenerate QR'}
          </Button>
        </div>
      ) : null}
    </main>
  );
};
