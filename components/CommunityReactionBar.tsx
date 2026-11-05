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
}) => {
  const resolvedType: CommunityReactionTargetType = targetType ?? 'post';
  const resolvedId = targetId || postId || '';
  const { memberAccessState } = useAuth();
  const { getReactions, isPending, errorFor, toggleReaction } = useCommunityReactions();
  const approved = memberAccessState === 'approved_member';
  const reactions = normalizeReactions(
    resolvedId ? getReactions(resolvedType, resolvedId, fallback) : fallback
  );
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
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Reactions">
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
              className={`inline-flex items-center gap-1 min-h-[40px] min-w-[40px] px-2.5 rounded-2xl border text-sm font-semibold transition-colors ${
                selected
                  ? 'bg-burgundy/10 border-burgundy text-burgundy ring-1 ring-burgundy/30'
                  : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-burgundy/30'
              } ${pending || !approved ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <span aria-hidden>{r.emoji || EMOJI[key]}</span>
              <span className="text-xs font-bold tabular-nums">{r.count}</span>
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
