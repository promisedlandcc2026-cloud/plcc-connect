/**
 * Phase 2.6C.4B / 2.6D.3 — reusable Family directory row (no raw IDs, no credentials).
 * Guardian dependents with opaque cardRef may link to /family/card/:cardRef (credential fetched on that page)
 * and /family/kids/:cardRef (Kids View + PLCC Bucks wallet).
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Sparkles, UserRound } from 'lucide-react';
import { cardInitials } from '../../lib/memberCardUi';
import { familyRelationshipLabel } from '../../lib/familyUi';
import { isDependentCardRef } from '../../lib/dependentCardRef';
import { prefetchCardChunk, prefetchDependentCardChunk } from '../../lib/prefetchMemberChunks';

export type FamilyMemberCardVariant = 'self' | 'adult' | 'dependent';

type Props = {
  variant: FamilyMemberCardVariant;
  displayName: string;
  avatarUrl?: string | null;
  relationship?: string | null;
  /** Dependent only: guardian authorization metadata (no QR). */
  cardAccess?: 'guardian' | 'none';
  /** Dependent only: opaque AWCD join key when cardAccess=guardian. */
  cardRef?: string | null;
};

function Avatar({
  name,
  avatarUrl,
  decorative,
}: {
  name: string;
  avatarUrl?: string | null;
  decorative?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const initials = cardInitials(name);

  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt={decorative ? '' : `Photo of ${name}`}
        aria-hidden={decorative || undefined}
        className="h-12 w-12 rounded-2xl object-cover border border-burgundy/15 bg-white shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className="h-12 w-12 rounded-2xl bg-gold-cream text-burgundy border border-gold/30 flex items-center justify-center text-sm font-black shrink-0"
      aria-hidden
    >
      {initials}
    </div>
  );
}

export const FamilyMemberCard: React.FC<Props> = ({
  variant,
  displayName,
  avatarUrl = null,
  relationship = null,
  cardAccess = 'none',
  cardRef = null,
}) => {
  const rel = relationship ? familyRelationshipLabel(relationship) : null;
  const showChildCardAction =
    variant === 'dependent' && cardAccess === 'guardian' && isDependentCardRef(cardRef);

  return (
    <article className="rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        {variant === 'dependent' ? (
          <div
            className="h-12 w-12 rounded-2xl bg-burgundy/5 text-burgundy border border-burgundy/10 flex items-center justify-center shrink-0"
            aria-hidden
          >
            <UserRound size={20} />
          </div>
        ) : (
          <Avatar
            name={displayName}
            avatarUrl={variant === 'self' || variant === 'adult' ? avatarUrl : null}
          />
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-bold text-[#1A1A1A] truncate">{displayName}</p>
          {variant === 'self' ? (
            <p className="text-xs text-gray-500">PLCC Member</p>
          ) : rel ? (
            <p className="text-xs text-gray-500">{rel}</p>
          ) : (
            <p className="text-xs text-gray-500">Family member</p>
          )}

          {variant === 'dependent' && cardAccess === 'guardian' ? (
            <div className="pt-1">
              <p className="inline-flex text-xs font-black uppercase tracking-widest text-burgundy bg-burgundy/5 border border-burgundy/10 rounded-lg px-2 py-1">
                Family card access authorized
              </p>
            </div>
          ) : null}

          {variant === 'dependent' && cardAccess !== 'guardian' ? (
            <p className="pt-1 text-xs text-gray-500 leading-relaxed">
              Check-in card not available yet. Ask church staff to enable Family card access for
              this child.
            </p>
          ) : null}
        </div>
      </div>

      {variant === 'self' ? (
        <Link
          to="/card"
          onFocus={() => prefetchCardChunk()}
          onMouseEnter={() => prefetchCardChunk()}
          onTouchStart={() => prefetchCardChunk()}
          className="mt-3 inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-burgundy text-white text-sm font-bold active:scale-[0.99] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
        >
          <CreditCard size={18} aria-hidden />
          View My PLCC Card
        </Link>
      ) : null}

      {showChildCardAction ? (
        <Link
          to={`/family/card/${cardRef}`}
          onFocus={() => prefetchDependentCardChunk()}
          onMouseEnter={() => prefetchDependentCardChunk()}
          onTouchStart={() => prefetchDependentCardChunk()}
          className="mt-3 inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-burgundy text-white text-sm font-bold active:scale-[0.99] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
        >
          <CreditCard size={18} aria-hidden />
          View Child Card &amp; Code
        </Link>
      ) : null}

      {showChildCardAction ? (
        <Link
          to={`/family/kids/${cardRef}`}
          className="mt-2 inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-burgundy/20 bg-gold-cream text-burgundy text-sm font-bold active:scale-[0.99] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
        >
          <Sparkles size={18} aria-hidden />
          Kids View &amp; PLCC Bucks
        </Link>
      ) : null}
    </article>
  );
};
