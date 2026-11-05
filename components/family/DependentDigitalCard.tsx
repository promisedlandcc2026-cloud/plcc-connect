/**
 * Phase 2.6D.3 — view-only guardian child membership card surface.
 * Renders sanitized GuardianDependentCard fields only. No rotate/revoke/share.
 */
import React from 'react';
import QRCode from 'react-qr-code';
import { UserRound } from 'lucide-react';
import { AWCLogo } from '../ui/AWCLogo';
import type { GuardianDependentCard } from '../../lib/dependentCardTypes';
import {
  DEPENDENT_CARD_PICKUP_DISCLAIMER,
  DEPENDENT_CARD_PRIVACY_COPY,
  DEPENDENT_CARD_SCREENSHOT_COPY,
  dependentCardStatusLabel,
} from '../../lib/dependentCardUi';
import { formatCardDate } from '../../lib/memberCardUi';

type Props = {
  card: GuardianDependentCard;
};

export const DependentDigitalCard: React.FC<Props> = ({ card }) => {
  return (
    <div className="flex flex-col gap-5">
      <article
        className="relative overflow-hidden rounded-[1.75rem] border-2 border-gold/30 bg-gradient-to-br from-[#0d1a14] via-[#12231c] to-[#101814] text-white shadow-[0_16px_40px_rgba(13, 26, 20,0.28)]"
        aria-label="PLCC child membership card"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 10%, rgba(201, 163, 90,0.35), transparent 45%), radial-gradient(circle at 90% 80%, rgba(255,255,255,0.08), transparent 40%)',
          }}
          aria-hidden
        />

        <div className="relative px-5 pt-5 pb-6 flex flex-col items-center text-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <AWCLogo size={56} className="drop-shadow-md brightness-110" />
            <p className="text-xs font-black uppercase tracking-[0.22em] text-gold">
              Promised Land Christian Center
            </p>
          </div>

          <div
            className="h-20 w-20 rounded-2xl bg-gold-cream text-burgundy border-2 border-gold/40 flex items-center justify-center"
            aria-hidden
          >
            <UserRound size={36} strokeWidth={2.2} />
          </div>

          <div>
            <p className="text-xl font-bold leading-tight">{card.displayName}</p>
            <p className="mt-1 text-sm font-semibold text-gold">{card.label}</p>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-white/70">
              PLCC Child Member
            </p>
          </div>

          <div className="w-full rounded-2xl bg-white/10 border border-white/15 px-4 py-3">
            <p className="text-xs font-black uppercase tracking-widest text-gold/90">
              Card No.
            </p>
            <p className="mt-1 font-mono text-lg font-bold tracking-wider text-white">
              {card.cardNumber}
            </p>
          </div>

          {card.accessCode ? (
            <div className="w-full rounded-2xl bg-white/10 border border-white/15 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-widest text-gold/90">
                Check-in code
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-[0.35em] text-white">
                {card.accessCode}
              </p>
              <p className="mt-1 text-xs text-white/65 leading-relaxed">
                Desk / kiosk backup code. Not pickup authorization.
              </p>
            </div>
          ) : null}

          <div className="w-full max-w-[260px] rounded-2xl bg-white p-4 shadow-inner">
            <QRCode
              value={card.qrPayload}
              size={228}
              style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
              viewBox="0 0 256 256"
              fgColor="#0d1a14"
              bgColor="#FFFFFF"
              title="PLCC child membership card QR code"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
            <p>
              <span className="font-black uppercase tracking-widest text-gold/90">Status </span>
              <span className="font-bold">{dependentCardStatusLabel(card.cardStatus)}</span>
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

      <p
        className="rounded-2xl border border-burgundy/15 bg-burgundy/5 px-4 py-3 text-sm font-semibold text-burgundy leading-relaxed"
        role="note"
      >
        {DEPENDENT_CARD_PICKUP_DISCLAIMER}
      </p>

      <p className="text-sm text-gray-600 leading-relaxed">{DEPENDENT_CARD_PRIVACY_COPY}</p>
      <p className="text-sm text-gray-500 leading-relaxed">{DEPENDENT_CARD_SCREENSHOT_COPY}</p>
    </div>
  );
};
