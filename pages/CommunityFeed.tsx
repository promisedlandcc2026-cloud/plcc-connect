import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Pencil, Pin, RefreshCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  CommunityFeedError,
  type CommunityFeedPost,
} from '../lib/communityFeedTypes';
import { fetchCommunityFeedPage } from '../lib/communityFeedClient';
import { Button } from '../components/ui/Button';
import { TribesHeader } from '../components/tribes/TribesHeader';
import { TribesHero } from '../components/tribes/TribesHero';
import { ReportPostMenu, TribesPostActions } from '../components/tribes/TribesPostActions';
import {
  FEED_VIEW_PARAM,
  feedViewFromParams,
  filterFeedPosts,
  isScripturePost,
  type FeedView,
} from '../lib/scripturePost';
import { CommunityPostComposer } from '../components/CommunityPostComposer';
import { fetchVerse, passageFromParams, type SharedVerse } from '../lib/verseShare';
import { CommunityPostOwnerActions } from '../components/CommunityPostOwnerActions';
import { CommunityMentionText } from '../components/CommunityMentionText';
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
  const [imageFailed, setImageFailed] = useState(false);
  const scripture = isScripturePost(post);

  const openPost = (hash = '') => {
    const selection = typeof window !== 'undefined' ? window.getSelection() : null;
    if (!hash && selection && selection.toString().trim()) return;
    navigate(`/community/post/${post.id}${hash}`);
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => openPost()}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPost();
        }
      }}
      className="rounded-2xl border border-[#E8DCC2] bg-[#FDF9EF] px-3.5 pt-3.5 pb-1 space-y-3 cursor-pointer shadow-[0_1px_2px_rgba(18,35,28,0.05),0_6px_18px_rgba(18,35,28,0.06)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1d372c]/40"
      aria-label={`Open ${scripture ? 'Scripture post' : 'post'} by ${post.author.name}`}
    >
      {post.pinned && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3E2B3] px-2.5 py-1 text-xs font-bold text-[#12231c]">
          <Pin size={12} aria-hidden className="fill-current" />
          Pinned
        </span>
      )}
      <header className="flex items-start gap-3">
        <AuthorAvatar name={post.author.name} avatarUrl={post.author.avatarUrl} />
        <div className="min-w-0 flex-1 text-left">
          <h2 className="text-[16px] font-bold text-[#12231c] truncate">{post.author.name}</h2>
          <p className="text-[13px] text-[#4B5563]">
            {scripture ? 'Scripture' : post.categoryLabel}
            {post.createdAt ? ` · ${formatRelativeTime(post.createdAt)}` : ''}
            {post.edited ? ' · Edited' : ''}
          </p>
        </div>
        <CommunityPostOwnerActions post={post} onUpdated={onUpdated} onDeleted={onDeleted} />
        <ReportPostMenu post={post} />
      </header>

      {post.content ? (
        <CommunityMentionText
          content={post.content}
          scripture="feed"
          className="text-[15px] text-[#1A1A1A] leading-relaxed whitespace-pre-wrap break-words text-left"
        />
      ) : null}

      {post.imageUrl && !imageFailed ? (
        <div className="-mx-1 rounded-xl overflow-hidden border border-[#E8DCC2] bg-[#F3EBD8]">
          <img
            src={post.imageUrl}
            alt={post.imageAlt || 'Community photo'}
            className="w-full max-h-[420px] object-cover"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        </div>
      ) : null}

      <TribesPostActions post={post} onComment={() => openPost('#comment')} />
    </div>
  );
};

/** All posts | Scripture — the two feed views. */
const FeedFilter: React.FC<{ view: FeedView; onChange: (v: FeedView) => void }> = ({ view, onChange }) => (
  <div className="flex rounded-xl border border-[#1d372c]/70 bg-[#FDF9EF] p-0.5" role="group" aria-label="Show posts">
    {(
      [
        ['all', 'All posts'],
        ['scripture', 'Scripture'],
      ] as const
    ).map(([value, label]) => {
      const active = view === value;
      return (
        <button
          key={value}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(value)}
          className={`flex-1 min-h-[44px] rounded-[10px] text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A35A] ${
            active ? 'bg-[#1d372c] text-[#F6EFDD] shadow-sm' : 'text-[#12231c] hover:bg-[#1d372c]/5'
          }`}
        >
          {label}
        </button>
      );
    })}
  </div>
);

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
  const { memberAccessState, isAuthenticated, user } = useAuth();
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
  // "Post to Tribes" from the church Bible reader: /community?share=verse&t=…&b=…&c=…&v=…
  const [searchParams, setSearchParams] = useSearchParams();
  const [shareVerse, setShareVerse] = useState<SharedVerse | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  // All posts | Scripture, kept in the URL (?view=scripture) so Back and refresh keep it.
  const view = feedViewFromParams(searchParams);
  const setView = useCallback(
    (next: FeedView) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === 'scripture') p.set(FEED_VIEW_PARAM, 'scripture');
          else p.delete(FEED_VIEW_PARAM);
          return p;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const authUserId = user?.id || null;

  useEffect(() => {
    if (searchParams.get('share') !== 'verse') return;
    const passage = passageFromParams(searchParams);
    const next = new URLSearchParams(searchParams);
    ['share', 't', 'b', 'c', 'v'].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
    if (!passage) {
      setShareError('That verse link isn’t complete. Please go back to the Bible and try again.');
      return;
    }
    fetchVerse(passage)
      .then(setShareVerse)
      .catch((e) => setShareError(e instanceof Error ? e.message : 'Could not load that verse.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (shareVerse) setComposerOpen(true);
  }, [shareVerse, authUserId]);
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

  const visiblePosts = filterFeedPosts(
    posts.filter((p) => !isDeleted(p.id)).map((p) => getUpdatedPost(p.id) ?? p),
    view
  );

  return (
    <main className="tribes-page flex-1 px-5 pb-28">
      <TribesHeader />
      <TribesHero />

      {memberAccessState === 'approved_member' && (
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="tribes-gold-btn mt-5 mb-4 flex w-full min-h-[54px] items-center justify-center gap-3 rounded-2xl border border-[#C9A35A] text-[18px] font-bold text-[#12231c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1d372c]/50"
          aria-label="Create a Tribes post"
        >
          <Pencil size={22} aria-hidden />
          Create post
        </button>
      )}

      <div className="mb-4 flex items-center gap-2">
        <div className="flex-1">
          <FeedFilter view={view} onChange={setView} />
        </div>
        <button
          type="button"
          onClick={() => void loadPage('refresh')}
          disabled={loading || refreshing || memberAccessState !== 'approved_member'}
          aria-label="Refresh Tribes feed"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#1d372c] hover:bg-[#1d372c]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d372c]/40 disabled:opacity-50"
        >
          <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''} aria-hidden />
        </button>
      </div>

      {shareError ? (
        <p role="alert" className="rounded-2xl border border-burgundy/20 bg-burgundy/5 px-4 py-3 text-sm font-medium text-burgundy">
          {shareError}
        </p>
      ) : null}

      <CommunityPostComposer
        open={composerOpen}
        onClose={() => {
          setComposerOpen(false);
          setShareVerse(null);
        }}
        onCreated={insertCreatedPost}
        verse={shareVerse}
        onRemoveVerse={() => setShareVerse(null)}
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
            Back to Home
          </Link>
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="rounded-2xl border border-[#E8DCC2] bg-[#FDF9EF] p-8 text-center space-y-3">
          <p className="text-sm text-[#4B5563] leading-relaxed">
            No posts to show yet. When the PLCC family shares in Tribes, posts will appear here.
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
          {view === 'scripture' && visiblePosts.length === 0 ? (
            <div className="rounded-2xl border border-[#E8DCC2] bg-[#FDF9EF] p-6 text-center" role="status">
              <p className="text-sm text-[#4B5563] leading-relaxed">
                {hasMore
                  ? 'No Scripture posts in the latest posts. Load more to look further back.'
                  : 'No Scripture posts yet. Share a verse from the Bible with “Post to Tribes”.'}
              </p>
            </div>
          ) : null}
          <FeedPostList
            posts={visiblePosts}
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
