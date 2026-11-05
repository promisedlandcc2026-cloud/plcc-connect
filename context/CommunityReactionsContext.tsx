import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import {
  applyOptimisticReactionToggle,
  reactionStateKey,
  toggleCommunityReaction,
  type CommunityReactionTargetType,
} from '../lib/communityReactionClient';
import {
  CommunityFeedError,
  type CommunityFeedReaction,
  type CommunityReactionKey,
} from '../lib/communityFeedTypes';

type CommunityReactionsContextValue = {
  getReactions: (
    targetType: CommunityReactionTargetType,
    targetId: string,
    fallback: CommunityFeedReaction[]
  ) => CommunityFeedReaction[];
  isPending: (targetType: CommunityReactionTargetType, targetId: string) => boolean;
  errorFor: (targetType: CommunityReactionTargetType, targetId: string) => string | null;
  toggleReaction: (
    targetType: CommunityReactionTargetType,
    targetId: string,
    reaction: CommunityReactionKey,
    baseline: CommunityFeedReaction[]
  ) => Promise<void>;
  seedFromPosts: (
    posts: { id: string; reactions: CommunityFeedReaction[]; commentCount?: number }[]
  ) => void;
  seedFromComments: (
    postId: string,
    comments: { id: string; reactions: CommunityFeedReaction[] }[]
  ) => void;
  getCommentCount: (postId: string, fallback: number) => number;
  adjustCommentCount: (postId: string, delta: number) => void;
  removeCommentState: (commentId: string) => void;
  removePostState: (postId: string) => void;
  clear: () => void;
};

const CommunityReactionsContext = createContext<CommunityReactionsContextValue | null>(
  null
);

export const CommunityReactionsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, memberAccessState, user } = useAuth();
  const authUserId = user?.id || null;

  const [overlays, setOverlays] = useState<Record<string, CommunityFeedReaction[]>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  /** commentId → parent postId for cleanup on post delete */
  const commentParentRef = useRef<Record<string, string>>({});
  const inFlightRef = useRef<Set<string>>(new Set());

  const clear = useCallback(() => {
    inFlightRef.current.clear();
    commentParentRef.current = {};
    setOverlays({});
    setCommentCounts({});
    setPending({});
    setErrors({});
  }, []);

  useEffect(() => {
    if (!isAuthenticated || memberAccessState !== 'approved_member' || !authUserId) {
      clear();
    }
  }, [authUserId, clear, isAuthenticated, memberAccessState]);

  const getReactions = useCallback(
    (
      targetType: CommunityReactionTargetType,
      targetId: string,
      fallback: CommunityFeedReaction[]
    ) => overlays[reactionStateKey(targetType, targetId)] ?? fallback,
    [overlays]
  );

  const isPending = useCallback(
    (targetType: CommunityReactionTargetType, targetId: string) =>
      Boolean(pending[reactionStateKey(targetType, targetId)]),
    [pending]
  );

  const errorFor = useCallback(
    (targetType: CommunityReactionTargetType, targetId: string) =>
      errors[reactionStateKey(targetType, targetId)] ?? null,
    [errors]
  );

  const seedFromPosts = useCallback(
    (posts: { id: string; reactions: CommunityFeedReaction[]; commentCount?: number }[]) => {
      setOverlays((prev) => {
        const next = { ...prev };
        for (const p of posts) {
          next[reactionStateKey('post', p.id)] = p.reactions;
        }
        return next;
      });
      setCommentCounts((prev) => {
        const next = { ...prev };
        for (const p of posts) {
          if (typeof p.commentCount === 'number' && Number.isFinite(p.commentCount)) {
            next[p.id] = Math.max(0, Math.floor(p.commentCount));
          }
        }
        return next;
      });
    },
    []
  );

  const seedFromComments = useCallback(
    (postId: string, comments: { id: string; reactions: CommunityFeedReaction[] }[]) => {
      setOverlays((prev) => {
        const next = { ...prev };
        for (const c of comments) {
          commentParentRef.current[c.id] = postId;
          next[reactionStateKey('comment', c.id)] = c.reactions;
        }
        return next;
      });
    },
    []
  );

  const getCommentCount = useCallback(
    (postId: string, fallback: number) =>
      commentCounts[postId] ?? Math.max(0, Math.floor(fallback || 0)),
    [commentCounts]
  );

  const adjustCommentCount = useCallback((postId: string, delta: number) => {
    setCommentCounts((prev) => {
      const base = prev[postId] ?? 0;
      return { ...prev, [postId]: Math.max(0, base + delta) };
    });
  }, []);

  const removeKey = useCallback((key: string) => {
    inFlightRef.current.delete(key);
    setOverlays((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPending((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const removeCommentState = useCallback(
    (commentId: string) => {
      delete commentParentRef.current[commentId];
      removeKey(reactionStateKey('comment', commentId));
    },
    [removeKey]
  );

  const removePostState = useCallback(
    (postId: string) => {
      removeKey(reactionStateKey('post', postId));
      setCommentCounts((prev) => {
        if (!(postId in prev)) return prev;
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      const parents = commentParentRef.current;
      const toRemove: string[] = [];
      for (const [commentId, parent] of Object.entries(parents)) {
        if (parent === postId) toRemove.push(commentId);
      }
      for (const commentId of toRemove) {
        delete parents[commentId];
        removeKey(reactionStateKey('comment', commentId));
      }
    },
    [removeKey]
  );

  const toggleReaction = useCallback(
    async (
      targetType: CommunityReactionTargetType,
      targetId: string,
      reaction: CommunityReactionKey,
      baseline: CommunityFeedReaction[]
    ) => {
      if (!isAuthenticated || memberAccessState !== 'approved_member') {
        throw new CommunityFeedError(
          'not_approved',
          'Reactions are available after your member access is approved.',
          403
        );
      }
      const key = reactionStateKey(targetType, targetId);
      if (inFlightRef.current.has(key)) return;

      inFlightRef.current.add(key);
      setPending((p) => ({ ...p, [key]: true }));
      setErrors((e) => ({ ...e, [key]: null }));

      const previous = overlays[key] ?? baseline;
      const optimistic = applyOptimisticReactionToggle(previous, reaction);
      setOverlays((o) => ({ ...o, [key]: optimistic }));

      try {
        const result = await toggleCommunityReaction(targetType, targetId, reaction);
        setOverlays((o) => ({ ...o, [key]: result.reactions }));
      } catch (err) {
        setOverlays((o) => ({ ...o, [key]: previous }));
        const message =
          err instanceof CommunityFeedError
            ? err.message
            : 'We couldn’t update your reaction right now. Please try again.';
        setErrors((e) => ({ ...e, [key]: message }));
        throw err instanceof CommunityFeedError
          ? err
          : new CommunityFeedError('vault_unavailable', message, 502);
      } finally {
        inFlightRef.current.delete(key);
        setPending((p) => ({ ...p, [key]: false }));
      }
    },
    [isAuthenticated, memberAccessState, overlays]
  );

  const value = useMemo(
    () => ({
      getReactions,
      isPending,
      errorFor,
      toggleReaction,
      seedFromPosts,
      seedFromComments,
      getCommentCount,
      adjustCommentCount,
      removeCommentState,
      removePostState,
      clear,
    }),
    [
      getReactions,
      isPending,
      errorFor,
      toggleReaction,
      seedFromPosts,
      seedFromComments,
      getCommentCount,
      adjustCommentCount,
      removeCommentState,
      removePostState,
      clear,
    ]
  );

  return (
    <CommunityReactionsContext.Provider value={value}>
      {children}
    </CommunityReactionsContext.Provider>
  );
};

export function useCommunityReactions(): CommunityReactionsContextValue {
  const ctx = useContext(CommunityReactionsContext);
  if (!ctx) {
    throw new Error('useCommunityReactions must be used within CommunityReactionsProvider');
  }
  return ctx;
}
