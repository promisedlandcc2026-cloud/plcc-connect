import React from 'react';
import type { CommunityFeedReaction, CommunityReactionKey } from '../lib/communityFeedTypes';
import type { CommunityReactionTargetType } from '../lib/communityReactionClient';
import { useCommunityReactions } from '../context/CommunityReactionsContext';
import { useAuth } from '../context/AuthContext';

const ORDER: CommunityReactionKey[] = ['love', 'pray', 'praise', 'like'];

const LABELS: Record<CommunityReactionKey, string> = {
  love: 'Love',
  pray: 'Pray',
  praise: 'Praise',
  like: 'Like',
};

const EMOJI: Record<CommunityReactionKey, string> = {
  love: '❤️',
  pray: '🙏',
  praise: '🙌',
  like: '👍',
};

function normalizeReactions(reactions: CommunityFeedReaction[]): CommunityFeedReaction[] {
  const byKey = new Map(reactions.map((r) => [r.key, r]));
  return ORDER.map((key) => {
    const existing = byKey.get(key);
    return (
      existing || {
        key,
        emoji: EMOJI[key],
        count: 0,
        reactedByMe: false,
      }
    );
  });
}

type Props = {
  targetType?: CommunityReactionTargetType;
  /** Required target id (post or comment). */
  targetId?: string;
  /** Legacy post id prop — treated as targetType=post when targetId omitted. */
  postId?: string;
  reactions: CommunityFeedReaction[];
  compact?: boolean;
  /** Show only these reactions (Tribes shows Like in its own action row). */
  only?: CommunityReactionKey[];
  /** Tribes look: small quiet chips, counts only when someone has reacted. */
  quiet?: boolean;
};

/**
 * Read/write reaction bar — Vault allow-list only.
 * stopPropagation so feed card navigation / comment menus are not triggered.
 */
export const CommunityReactionBar: React.FC<Props> = ({
  targetType,
  targetId,
  postId,
  reactions: fallback,
  compact = false,
  only,
  quiet = false,
}) => {
  const resolvedType: CommunityReactionTargetType = targetType ?? 'post';
  const resolvedId = targetId || postId || '';
  const { memberAccessState } = useAuth();
  const { getReactions, isPending, errorFor, toggleReaction } = useCommunityReactions();
  const approved = memberAccessState === 'approved_member';
  const reactions = normalizeReactions(
    resolvedId ? getReactions(resolvedType, resolvedId, fallback) : fallback
  ).filter((r) => !only || only.includes(r.key as CommunityReactionKey));
  const pending = resolvedId ? isPending(resolvedType, resolvedId) : false;
  const error = resolvedId ? errorFor(resolvedType, resolvedId) : null;

  const onToggle = async (key: CommunityReactionKey, e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!approved || pending || !resolvedId) return;
    try {
      await toggleReaction(resolvedType, resolvedId, key, fallback);
    } catch {
      // Error surfaced via errorFor
    }
  };

  return (
    <div
      className={compact ? 'space-y-1' : 'space-y-2'}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className={`flex items-center gap-1.5 ${quiet ? "flex-nowrap" : "flex-wrap"}`} role="group" aria-label="Reactions">
        {reactions.map((r) => {
          const key = r.key as CommunityReactionKey;
          const selected = Boolean(r.reactedByMe);
          const label = LABELS[key] || r.key;
          return (
            <button
              key={r.key}
              type="button"
              disabled={!approved || pending || !resolvedId}
              onClick={(e) => void onToggle(key, e)}
              aria-pressed={selected}
              aria-label={
                selected
                  ? `${label}, selected, ${r.count}`
                  : `${label}, ${r.count}`
              }
              className={
                quiet
                  ? `inline-flex items-center justify-center gap-1 min-h-[40px] min-w-[44px] px-2.5 rounded-full border text-sm font-semibold transition-colors ${
                      selected
                        ? 'bg-[#1d372c]/[0.07] border-[#1d372c]/40 text-[#12231c]'
                        : 'bg-transparent border-[#E8DCC2] text-[#4B5563] hover:bg-[#1d372c]/[0.04]'
                    } ${pending || !approved ? 'opacity-60 cursor-not-allowed' : ''}`
                  : `inline-flex items-center gap-1 min-h-[40px] min-w-[40px] px-2.5 rounded-2xl border text-sm font-semibold transition-colors ${
                      selected
                        ? 'bg-burgundy/10 border-burgundy text-burgundy ring-1 ring-burgundy/30'
                        : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-burgundy/30'
                    } ${pending || !approved ? 'opacity-60 cursor-not-allowed' : ''}`
              }
            >
              <span aria-hidden className={quiet ? 'text-[15px] leading-none' : undefined}>{r.emoji || EMOJI[key]}</span>
              {!quiet || r.count > 0 ? <span className="text-xs font-bold tabular-nums">{r.count}</span> : null}
              <span className="sr-only">{label}</span>
            </button>
          );
        })}
      </div>
      {error && (
        <p className="text-xs text-red-700 text-left" role="status">
          {error}
        </p>
      )}
    </div>
  );
};
