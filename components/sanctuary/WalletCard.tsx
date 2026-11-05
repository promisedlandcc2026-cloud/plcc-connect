/**
 * Wallet-style PLCC Card for the Me tab: looks like a real pass, with a gold
 * sheen that follows the phone's tilt. Tapping opens the full card (/card)
 * with the large QR for check-in. Same card RPC as the card page.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { fetchMyDigitalCard } from '../../lib/memberCardClient';
import type { MemberDigitalCard } from '../../lib/memberCardTypes';
import { prefetchCardChunk } from '../../lib/prefetchMemberChunks';
import { useTiltSheen } from '../../lib/useTiltSheen';

export const WalletCard: React.FC<{ fallbackName: string }> = ({ fallbackName }) => {
  const ref = useRef<HTMLDivElement>(null);
  const sheen = useTiltSheen(ref);
  const [card, setCard] = useState<MemberDigitalCard | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchMyDigitalCard()
      .then((c) => alive && setCard(c))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const name = card?.displayName || fallbackName;

  return (
    <div ref={ref} className="awc-wallet h-[214px] rounded-[26px]" data-sheen={sheen}>
      <div className="awc-wallet__sheen" aria-hidden />
      <svg
        aria-hidden
        width="220"
        height="220"
        viewBox="0 0 220 220"
        className="pointer-events-none absolute -left-14 -bottom-24 opacity-[0.18]"
      >
        <path d="M10 220 V110 A100 100 0 0 1 210 110 V220" fill="none" stroke="#F2D98A" strokeWidth="1.5" />
        <path d="M40 220 V118 A70 70 0 0 1 180 118 V220" fill="none" stroke="#F2D98A" strokeWidth="1" />
      </svg>
      <div className="flex h-full justify-between gap-3 p-5">
        <Link
          to="/card"
          onFocus={prefetchCardChunk}
          onTouchStart={prefetchCardChunk}
          aria-label="Open my PLCC Card"
          className="flex min-w-0 flex-col justify-between rounded-xl after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf"
        >
          <span>
            <span className="block font-display text-xl font-bold text-[#F2D98A]">PLCC</span>
            <span className="mt-0.5 block text-xs font-semibold text-cream/80">Member card · check-in pass</span>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-lg font-bold">{name}</span>
            <span className="mt-1 block font-mono text-[13px] font-semibold tracking-[0.08em] text-cream/85">
              {card ? card.cardNumber : failed ? 'Tap to open' : '•••• ••••'}
            </span>
          </span>
        </Link>
        <div className="flex shrink-0 flex-col items-center justify-center gap-2" aria-hidden>
          <span className="flex h-28 w-28 items-center justify-center rounded-2xl bg-white p-3">
            {card ? (
              <QRCode value={card.qrPayload} size={88} fgColor="#1A1A1A" bgColor="#FFFFFF" />
            ) : (
              <span className="h-full w-full animate-pulse rounded-lg bg-[#F1EAE1] motion-reduce:animate-none" />
            )}
          </span>
          <span className="text-xs font-semibold text-cream/85">Tap to enlarge</span>
        </div>
      </div>
    </div>
  );
};
