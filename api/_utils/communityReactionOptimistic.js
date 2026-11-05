/**
 * Pure reaction helpers shared by Connect client + tests.
 * Matches Vault UNIQUE (target_type, target_id, user_id, reaction) toggle.
 */

/** @typedef {'post'|'comment'} CommunityReactionTargetType */

/**
 * @param {CommunityReactionTargetType} targetType
 * @param {string} targetId
 */
export function reactionStateKey(targetType, targetId) {
  return `${targetType}:${targetId}`;
}

const DEFAULT_KEYS = /** @type {const} */ (['love', 'pray', 'praise', 'like']);

const EMOJI = {
  love: '❤️',
  pray: '🙏',
  praise: '🙌',
  like: '👍',
};

/**
 * @param {{ key: string, emoji: string, count: number, reactedByMe: boolean }[]} reactions
 * @param {string} reaction
 */
export function applyOptimisticReactionToggle(reactions, reaction) {
  const list = reactions.length
    ? reactions.map((r) => ({ ...r }))
    : DEFAULT_KEYS.map((key) => ({
        key,
        emoji: EMOJI[key],
        count: 0,
        reactedByMe: false,
      }));

  const idx = list.findIndex((r) => r.key === reaction);
  if (idx < 0) {
    list.push({
      key: reaction,
      emoji: EMOJI[reaction] || '',
      count: 1,
      reactedByMe: true,
    });
    return list;
  }
  const cur = list[idx];
  if (cur.reactedByMe) {
    list[idx] = {
      ...cur,
      reactedByMe: false,
      count: Math.max(0, cur.count - 1),
    };
  } else {
    list[idx] = {
      ...cur,
      reactedByMe: true,
      count: cur.count + 1,
    };
  }
  return list;
}
