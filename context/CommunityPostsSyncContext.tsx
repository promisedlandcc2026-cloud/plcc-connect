import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import type { CommunityFeedPost } from '../lib/communityFeedTypes';

type CommunityPostsSyncValue = {
  getUpdatedPost: (postId: string) => CommunityFeedPost | undefined;
  isDeleted: (postId: string) => boolean;
  applyUpdatedPost: (post: CommunityFeedPost) => void;
  markDeleted: (postId: string) => void;
  clear: () => void;
};

const CommunityPostsSyncContext = createContext<CommunityPostsSyncValue | null>(null);

/**
 * Small overlay for edit/delete sync across feed and focused post views.
 */
export const CommunityPostsSyncProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, memberAccessState, user } = useAuth();
  const authUserId = user?.id || null;
  const [updates, setUpdates] = useState<Record<string, CommunityFeedPost>>({});
  const [deleted, setDeleted] = useState<Record<string, true>>({});

  const clear = useCallback(() => {
    setUpdates({});
    setDeleted({});
  }, []);

  useEffect(() => {
    if (!isAuthenticated || memberAccessState !== 'approved_member' || !authUserId) {
      clear();
    }
  }, [authUserId, clear, isAuthenticated, memberAccessState]);

  const getUpdatedPost = useCallback(
    (postId: string) => updates[postId],
    [updates]
  );

  const isDeleted = useCallback((postId: string) => Boolean(deleted[postId]), [deleted]);

  const applyUpdatedPost = useCallback((post: CommunityFeedPost) => {
    setDeleted((prev) => {
      if (!prev[post.id]) return prev;
      const next = { ...prev };
      delete next[post.id];
      return next;
    });
    setUpdates((prev) => ({ ...prev, [post.id]: post }));
  }, []);

  const markDeleted = useCallback((postId: string) => {
    setUpdates((prev) => {
      if (!prev[postId]) return prev;
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    setDeleted((prev) => ({ ...prev, [postId]: true }));
  }, []);

  const value = useMemo(
    () => ({
      getUpdatedPost,
      isDeleted,
      applyUpdatedPost,
      markDeleted,
      clear,
    }),
    [applyUpdatedPost, clear, getUpdatedPost, isDeleted, markDeleted]
  );

  return (
    <CommunityPostsSyncContext.Provider value={value}>
      {children}
    </CommunityPostsSyncContext.Provider>
  );
};

export function useCommunityPostsSync(): CommunityPostsSyncValue {
  const ctx = useContext(CommunityPostsSyncContext);
  if (!ctx) {
    throw new Error('useCommunityPostsSync must be used within CommunityPostsSyncProvider');
  }
  return ctx;
}
