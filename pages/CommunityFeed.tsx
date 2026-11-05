import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Loader2,
  MessageCircle,
  PenSquare,
  Pin,
  RefreshCcw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useHuddleLive } from '../context/HuddleLiveContext';
import { HuddleLiveDot } from '../components/huddle/HuddleLiveDot';
import {
  CommunityFeedError,
  type CommunityFeedPost,
} from '../lib/communityFeedTypes';
import { fetchCommunityFeedPage } from '../lib/communityFeedClient';
import { Button, ButtonLink } from '../components/ui/Button';
import { MemberPageHeader } from '../components/member/MemberPageHeader';
import { CommunityPostComposer } from '../components/CommunityPostComposer';
import { CommunityPostOwnerActions } from '../components/CommunityPostOwnerActions';
import { CommunityMentionText } from '../components/CommunityMentionText';
import { CommunityReactionBar } from '../components/CommunityReactionBar';
import { useCommunityReactions } from '../context/CommunityReactionsContext';
import { useCommunityPostsSync } from '../context/CommunityPostsSyncContext';

const PAGE_SIZE = 20;

function formatRelativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(then).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function AuthorAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  const initials = name.trim().charAt(0).toUpperCase() || 'M';

  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="w-11 h-11 rounded-full object-cover border border-gray-100 bg-gray-50"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className="w-11 h-11 rounded-full bg-burgundy/10 text-burgundy flex items-center justify-center text-sm font-bold"
      aria-hidden
    >
      {initials}
    </div>
  );
}

const PostCard: React.FC<{
  post: CommunityFeedPost;
  onUpdated: (post: CommunityFeedPost) => void;
  onDeleted: (postId: string) => void;
}> = ({ post, onUpdated, onDeleted }) => {
  const navigate = useNavigate();
  const { getCommentCount } = useCommunityReactions();
  const [imageFailed, setImageFailed] = useState(false);
  const commentCount = getCommentCount(post.id, post.commentCount);

  const openPost = () => {
    const selection = typeof window !== 'undefined' ? window.getSelection() : null;
    if (selection && selection.toString().trim()) return;
    navigate(`/community/post/${post.id}`);
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={openPost}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPost();
        }
      }}
      className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 space-y-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-burgundy/40"
      aria-label={`Open post by ${post.author.name}`}
    >
      <header className="flex items-start gap-3">
        <AuthorAvatar name={post.author.name} avatarUrl={post.author.avatarUrl} />
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-[#1A1A1A] truncate">{post.author.name}</h2>
            {post.pinned && (
              <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-gold-ink">
                <Pin size={10} aria-hidden />
                Pinned
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {post.categoryLabel}
            {post.createdAt ? ` · ${formatRelativeTime(post.createdAt)}` : ''}
            {post.edited ? ' · Edited' : ''}
          </p>
        </div>
        <CommunityPostOwnerActions post={post} onUpdated={onUpdated} onDeleted={onDeleted} />
      </header>

      {post.content ? (
        <CommunityMentionText content={post.content} />
      ) : null}

      {post.imageUrl && !imageFailed ? (
        <div className="rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
          <img
            src={post.imageUrl}
            alt={post.imageAlt || 'Community photo'}
            className="w-full max-h-[420px] object-cover"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        </div>
      ) : null}

      {(commentCount > 0) && (
        <footer className="flex items-center gap-4 pt-1 text-xs font-semibold text-gray-500">
          <span className="inline-flex items-center gap-1" aria-label={`${commentCount} comments`}>
            <MessageCircle size={12} aria-hidden />
            {commentCount}
          </span>
        </footer>
      )}

      <CommunityReactionBar postId={post.id} reactions={post.reactions} compact />
    </div>
  );
};

const FeedPostList: React.FC<{
  posts: CommunityFeedPost[];
  onUpdated: (post: CommunityFeedPost) => void;
  onDeleted: (postId: string) => void;
}> = ({ posts, onUpdated, onDeleted }) => (
  <>
    {posts.map((post) => (
      <PostCard key={post.id} post={post} onUpdated={onUpdated} onDeleted={onDeleted} />
    ))}
  </>
);

/**
 * Community feed for approved members — list + create posts.
 * Not a moderation surface.
 */
export const CommunityFeedPage: React.FC = () => {
  const { identity, memberAccessState, isAuthenticated, user } = useAuth();
  const { anyLive } = useHuddleLive();
  const { seedFromPosts, removePostState } = useCommunityReactions();
  const { getUpdatedPost, isDeleted, applyUpdatedPost, markDeleted } = useCommunityPostsSync();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<CommunityFeedPost[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [skippedHint, setSkippedHint] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const authUserId = user?.id || null;
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const nextOffsetRef = useRef(0);

  const clearFeed = useCallback(() => {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    inFlightRef.current = false;
    nextOffsetRef.current = 0;
    setPosts([]);
    setHasMore(false);
    setError(null);
    setErrorCode(null);
    setSkippedHint(false);
    setLoading(false);
    setLoadingMore(false);
    setRefreshing(false);
    setComposerOpen(false);
  }, []);

  const insertCreatedPost = useCallback(
    (post: CommunityFeedPost) => {
      applyUpdatedPost(post);
      setPosts((prev) => {
        if (prev.some((p) => p.id === post.id)) return prev;
        const pinned = prev.filter((p) => p.pinned);
        const unpinned = prev.filter((p) => !p.pinned);
        return [...pinned, post, ...unpinned];
      });
      seedFromPosts([post]);
      setError(null);
      setErrorCode(null);
      nextOffsetRef.current += 1;
    },
    [applyUpdatedPost, seedFromPosts]
  );

  const handlePostUpdated = useCallback(
    (post: CommunityFeedPost) => {
      applyUpdatedPost(post);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
      seedFromPosts([post]);
    },
    [applyUpdatedPost, seedFromPosts]
  );

  const handlePostDeleted = useCallback(
    (postId: string) => {
      markDeleted(postId);
      removePostState(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      nextOffsetRef.current = Math.max(0, nextOffsetRef.current - 1);
    },
    [markDeleted, removePostState]
  );

  const loadPage = useCallback(
    async (mode: 'initial' | 'refresh' | 'more') => {
      if (!isAuthenticated || memberAccessState !== 'approved_member') return;
      if (inFlightRef.current) return;

      const requestId = ++requestIdRef.current;
      const uid = authUserId;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      inFlightRef.current = true;

      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setLoadingMore(true);
      setError(null);
      setErrorCode(null);

      const pageOffset = mode === 'more' ? nextOffsetRef.current : 0;

      try {
        const page = await fetchCommunityFeedPage({
          limit: PAGE_SIZE,
          offset: pageOffset,
          signal: controller.signal,
        });
        if (requestId !== requestIdRef.current) return;
        if (uid !== authUserId) return;

        setPosts((prev) => (mode === 'more' ? [...prev, ...page.posts] : page.posts));
        seedFromPosts(page.posts);
        nextOffsetRef.current = pageOffset + page.posts.length;
        setHasMore(page.hasMore);
        setSkippedHint(page.skipped > 0);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (requestId !== requestIdRef.current) return;
        if (err instanceof CommunityFeedError) {
          setError(err.message);
          setErrorCode(err.code);
          if (err.sessionInvalid) {
            navigate('/sign-in', { replace: true, state: { returnTo: '/community' } });
          }
        } else {
          setError('Community is temporarily unavailable. Please try again.');
          setErrorCode('vault_unavailable');
        }
      } finally {
        if (requestId === requestIdRef.current) {
          inFlightRef.current = false;
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [authUserId, isAuthenticated, memberAccessState, navigate, seedFromPosts]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      clearFeed();
      return;
    }
    if (memberAccessState !== 'approved_member') {
      clearFeed();
      return;
    }
    void loadPage('initial');
    return () => {
      requestIdRef.current += 1;
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when auth identity changes
  }, [authUserId, isAuthenticated, memberAccessState]);

  return (
    <main className="flex-1 px-5 pt-8 pb-28">
      <MemberPageHeader
        title="Community"
        subtitle="Share updates, celebrate, and pray with your church family."
        action={
          <div className="flex items-center gap-2">
            <ButtonLink
              to="/community/chat"
              variant="secondary"
              size="sm"
              aria-label={anyLive ? 'Chat, live huddle' : 'Chat'}
            >
              <span className="relative inline-flex">
                <MessageCircle size={16} aria-hidden />
                {anyLive ? (
                  <span className="absolute -right-1 -top-1">
                    <HuddleLiveDot size="sm" label="" />
                  </span>
                ) : null}
              </span>
              Chat
            </ButtonLink>
            <Button
              variant="subtle"
              size="sm"
              onClick={() => void loadPage('refresh')}
              disabled={loading || refreshing || memberAccessState !== 'approved_member'}
              aria-label="Refresh Community feed"
            >
              <RefreshCcw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden />
            </Button>
          </div>
        }
      />


      {memberAccessState === 'approved_member' && (
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="w-full mb-5 flex items-center gap-3 rounded-3xl border border-gray-100 bg-white shadow-sm px-4 py-3 text-left min-h-[56px] focus:outline-none focus-visible:ring-2 focus-visible:ring-burgundy/40"
          aria-label="Create a Community post"
        >
          {identity?.avatarUrl ? (
            <img
              src={identity.avatarUrl}
              alt=""
              className="w-10 h-10 rounded-full object-cover border border-gray-100"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full bg-burgundy/10 text-burgundy flex items-center justify-center text-sm font-bold"
              aria-hidden
            >
              {(identity?.name || 'M').trim().charAt(0).toUpperCase()}
            </div>
          )}
          <span className="flex-1 text-sm text-gray-500">Share with the PLCC Community…</span>
          <PenSquare size={18} className="text-burgundy shrink-0" aria-hidden />
        </button>
      )}

      <CommunityPostComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={insertCreatedPost}
      />

      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-20" role="status">
          <Loader2 className="animate-spin text-burgundy" size={28} aria-hidden />
          <p className="text-sm text-gray-500">Loading Community…</p>
        </div>
      )}

      {!loading && error && (
        <div className="bg-white border border-red-100 rounded-3xl p-5 space-y-3 text-left" role="alert">
          <p className="text-sm text-red-900 leading-relaxed">{error}</p>
          {errorCode !== 'forbidden' && (
            <Button type="button" variant="secondary" onClick={() => void loadPage('refresh')}>
              Try again
            </Button>
          )}
          <Link to="/" className="block text-sm font-bold text-burgundy underline min-h-[44px]">
            Back to Connect
          </Link>
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-3xl p-8 text-center space-y-3">
          <p className="text-sm text-gray-600 leading-relaxed">
            No Community posts to show yet. When posts are shared in PLCC Community, they will appear
            here.
          </p>
          <Button type="button" variant="secondary" onClick={() => void loadPage('refresh')}>
            Refresh
          </Button>
        </div>
      )}

      {!loading && posts.length > 0 && (
        <div className="space-y-4">
          {skippedHint && (
            <p className="text-xs text-gray-500">
              Some items could not be shown and were skipped.
            </p>
          )}
          <FeedPostList
            posts={posts
              .filter((p) => !isDeleted(p.id))
              .map((p) => getUpdatedPost(p.id) ?? p)}
            onUpdated={handlePostUpdated}
            onDeleted={handlePostDeleted}
          />

          {hasMore && (
            <Button
              type="button"
              variant="secondary"
              fullWidth
              className="min-h-[52px]"
              disabled={loadingMore}
              onClick={() => void loadPage('more')}
            >
              {loadingMore ? (
                <span role="status" className="inline-flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} aria-hidden />
                  Loading more…
                </span>
              ) : (
                'Load more'
              )}
            </Button>
          )}
        </div>
      )}
    </main>
  );
};
