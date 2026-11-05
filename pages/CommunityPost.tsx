import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Loader2,
  MessageCircle,
  Pin,
  RefreshCcw,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  CommunityFeedError,
  type CommunityFeedPost,
} from '../lib/communityFeedTypes';
import {
  fetchCommunityPost,
  isValidCommunityPostId,
} from '../lib/communityPostClient';
import { Button } from '../components/ui/Button';
import { CommunityReactionBar } from '../components/CommunityReactionBar';
import { CommunityCommentsSection } from '../components/CommunityCommentsSection';
import { CommunityPostOwnerActions } from '../components/CommunityPostOwnerActions';
import { CommunityMentionText } from '../components/CommunityMentionText';
import { useCommunityReactions } from '../context/CommunityReactionsContext';
import { useCommunityPostsSync } from '../context/CommunityPostsSyncContext';

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
        className="w-12 h-12 rounded-full object-cover border border-gray-100 bg-gray-50"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className="w-12 h-12 rounded-full bg-burgundy/10 text-burgundy flex items-center justify-center text-sm font-bold"
      aria-hidden
    >
      {initials}
    </div>
  );
}

type LocationState = { fromNotifications?: boolean } | null;

/**
 * Focused read-only Community post view for approved members.
 */
export const CommunityPostPage: React.FC = () => {
  const { postId = '' } = useParams<{ postId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusCommentRaw = searchParams.get('comment');
  const focusCommentId =
    focusCommentRaw &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      focusCommentRaw
    )
      ? focusCommentRaw
      : null;
  const { isAuthenticated, memberAccessState, user } = useAuth();
  const { seedFromPosts, getCommentCount, removePostState } = useCommunityReactions();
  const { getUpdatedPost, isDeleted, applyUpdatedPost, markDeleted } = useCommunityPostsSync();
  const fromNotifications = Boolean((location.state as LocationState)?.fromNotifications);

  const [post, setPost] = useState<CommunityFeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  const authUserId = user?.id || null;
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const clearPost = useCallback(() => {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setPost(null);
    setError(null);
    setErrorCode(null);
    setImageFailed(false);
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    if (!isAuthenticated || memberAccessState !== 'approved_member') {
      clearPost();
      return;
    }

    if (!isValidCommunityPostId(postId)) {
      setPost(null);
      setLoading(false);
      setError('That post link is not valid.');
      setErrorCode('invalid_query');
      return;
    }

    const requestId = ++requestIdRef.current;
    const uid = authUserId;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setErrorCode(null);
    setImageFailed(false);

    try {
      const next = await fetchCommunityPost(postId, { signal: controller.signal });
      if (requestId !== requestIdRef.current) return;
      if (uid !== authUserId) return;
      setPost(next);
      seedFromPosts([next]);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (requestId !== requestIdRef.current) return;
      setPost(null);
      if (err instanceof CommunityFeedError) {
        setError(err.message);
        setErrorCode(err.code);
        if (err.sessionInvalid) {
          navigate('/sign-in', {
            replace: true,
            state: { returnTo: `/community/post/${postId}` },
          });
        }
      } else {
        setError('Community is temporarily unavailable. Please try again.');
        setErrorCode('vault_unavailable');
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [
    authUserId,
    clearPost,
    isAuthenticated,
    memberAccessState,
    navigate,
    postId,
    seedFromPosts,
  ]);

  useEffect(() => {
    if (!isAuthenticated || memberAccessState !== 'approved_member' || !authUserId) {
      clearPost();
      return;
    }
    void load();
    return () => {
      abortRef.current?.abort();
    };
  }, [authUserId, clearPost, isAuthenticated, load, memberAccessState]);

  useEffect(() => {
    if (!postId || !isValidCommunityPostId(postId)) return;
    if (isDeleted(postId)) {
      navigate('/community', { replace: true });
      return;
    }
    const updated = getUpdatedPost(postId);
    if (updated) {
      setPost(updated);
    }
  }, [getUpdatedPost, isDeleted, navigate, postId]);

  const handlePostUpdated = useCallback(
    (updated: CommunityFeedPost) => {
      applyUpdatedPost(updated);
      setPost(updated);
      seedFromPosts([updated]);
    },
    [applyUpdatedPost, seedFromPosts]
  );

  const handlePostDeleted = useCallback(
    (id: string) => {
      markDeleted(id);
      removePostState(id);
      navigate('/community', { replace: true });
    },
    [markDeleted, navigate, removePostState]
  );

  const displayPost = post
    ? getUpdatedPost(post.id) ?? post
    : null;

  const canRetry =
    errorCode === 'vault_unavailable' ||
    errorCode === 'network' ||
    errorCode === 'bridge_unconfigured' ||
    errorCode === 'rate_limited' ||
    errorCode === 'malformed_response';

  return (
    <main className="flex-1 px-5 pt-10 pb-28">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {fromNotifications ? (
            <Link
              to="/notifications"
              className="inline-flex items-center gap-2 text-burgundy text-sm font-bold min-h-[44px]"
            >
              <Bell size={16} aria-hidden />
              Notifications
            </Link>
          ) : null}
          <Link
            to="/community"
            className="inline-flex items-center gap-2 text-burgundy text-sm font-bold min-h-[44px]"
          >
            <ArrowLeft size={18} aria-hidden />
            Community
          </Link>
        </div>
      </div>

      <header className="text-left mb-6">
        <p className="text-xs font-black uppercase tracking-widest text-gold-ink mb-1">
          PLCC Community
        </p>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Post</h1>
      </header>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-500" role="status">
          <Loader2 className="animate-spin" size={22} aria-hidden />
          Loading this post…
        </div>
      )}

      {!loading && error && (
        <div
          className="rounded-3xl bg-white border border-gray-100 p-6 text-left space-y-4"
          role="alert"
        >
          <Users className="text-gray-500" size={28} aria-hidden />
          <h2 className="text-lg font-bold text-[#1A1A1A]">
            {errorCode === 'invalid_query' ? 'Invalid link' : 'Post unavailable'}
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">{error}</p>
          <div className="flex flex-col gap-2">
            {canRetry && (
              <Button type="button" onClick={() => void load()} className="w-full">
                <RefreshCcw size={16} aria-hidden />
                <span className="ml-2">Try again</span>
              </Button>
            )}
            <Link
              to="/community"
              className="inline-flex items-center justify-center min-h-[48px] rounded-2xl border border-gray-200 text-sm font-bold text-burgundy"
            >
              Back to Community
            </Link>
            {fromNotifications && (
              <Link
                to="/notifications"
                className="inline-flex items-center justify-center min-h-[48px] rounded-2xl border border-gray-200 text-sm font-bold text-burgundy"
              >
                Back to Notifications
              </Link>
            )}
          </div>
        </div>
      )}

      {!loading && displayPost && !error && !isDeleted(displayPost.id) && (
        <article className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4">
          <header className="flex items-start gap-3">
            <AuthorAvatar name={displayPost.author.name} avatarUrl={displayPost.author.avatarUrl} />
            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-[#1A1A1A] truncate">
                  {displayPost.author.name}
                </h2>
                {displayPost.pinned && (
                  <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-gold-ink">
                    <Pin size={10} aria-hidden />
                    Pinned
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {displayPost.categoryLabel}
                {displayPost.createdAt ? ` · ${formatRelativeTime(displayPost.createdAt)}` : ''}
                {displayPost.edited ? ' · Edited' : ''}
              </p>
            </div>
            <CommunityPostOwnerActions
              post={displayPost}
              onUpdated={handlePostUpdated}
              onDeleted={handlePostDeleted}
            />
          </header>

          {displayPost.content ? (
            <CommunityMentionText content={displayPost.content} />
          ) : null}

          {displayPost.imageUrl && !imageFailed ? (
            <div className="rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
              <img
                src={displayPost.imageUrl}
                alt={displayPost.imageAlt || 'Community photo'}
                className="w-full max-h-[520px] object-cover"
                onError={() => setImageFailed(true)}
              />
            </div>
          ) : null}

          {getCommentCount(displayPost.id, displayPost.commentCount) > 0 && (
            <div className="flex items-center gap-4 pt-1 text-xs font-semibold text-gray-500">
              <span
                className="inline-flex items-center gap-1"
                aria-label={`${getCommentCount(displayPost.id, displayPost.commentCount)} comments`}
              >
                <MessageCircle size={12} aria-hidden />
                {getCommentCount(displayPost.id, displayPost.commentCount)}
              </span>
            </div>
          )}

          <CommunityReactionBar
            postId={displayPost.id}
            reactions={displayPost.reactions}
          />

          <CommunityCommentsSection
            postId={displayPost.id}
            focusCommentId={focusCommentId}
          />
        </article>
      )}
    </main>
  );
};
