import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Pin, RefreshCcw, Users } from 'lucide-react';
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
import { TribesHeader, TribesSubBar } from '../components/tribes/TribesHeader';
import { ReportPostMenu, ReportPostRow, TribesPostActions } from '../components/tribes/TribesPostActions';
import { isScripturePost } from '../lib/scripturePost';
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
  const { seedFromPosts, removePostState } = useCommunityReactions();
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

  const isScripture = displayPost ? isScripturePost(displayPost) : false;

  const focusCommentComposer = useCallback(() => {
    const el = document.getElementById('community-comment-composer') as HTMLTextAreaElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
  }, []);

  // "Comment" on a feed card opens /community/post/:id#comment.
  const wantsComment = location.hash === '#comment';
  const postReady = Boolean(displayPost && !loading && !error);
  useEffect(() => {
    if (!wantsComment || !postReady) return;
    const t = window.setTimeout(focusCommentComposer, 150);
    return () => window.clearTimeout(t);
  }, [focusCommentComposer, postReady, wantsComment]);

  return (
    <main className="tribes-page flex-1 px-5 pb-28">
      <TribesHeader />
      <TribesSubBar
        title={isScripture ? 'Scripture' : 'Post'}
        backTo={fromNotifications ? '/notifications' : '/community'}
        backLabel={fromNotifications ? 'Notifications' : 'Tribes'}
      />
      <div className="h-4" />

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
              Back to Tribes
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
        <div className="space-y-4">
          <article className="rounded-2xl border border-[#E8DCC2] bg-[#FDF9EF] p-4 pb-2 space-y-3 shadow-[0_1px_2px_rgba(18,35,28,0.05),0_6px_18px_rgba(18,35,28,0.06)]">
            {displayPost.pinned && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3E2B3] px-2.5 py-1 text-xs font-bold text-[#12231c]">
                <Pin size={12} aria-hidden className="fill-current" />
                Pinned
              </span>
            )}
            <header className="flex items-start gap-3">
              <AuthorAvatar name={displayPost.author.name} avatarUrl={displayPost.author.avatarUrl} />
              <div className="min-w-0 flex-1 text-left">
                <h2 className="text-[17px] font-bold text-[#12231c] truncate">{displayPost.author.name}</h2>
                <p className="text-[14px] text-[#4B5563]">
                  {isScripture ? 'Scripture' : displayPost.categoryLabel}
                  {displayPost.createdAt ? ` · ${formatRelativeTime(displayPost.createdAt)}` : ''}
                  {displayPost.edited ? ' · Edited' : ''}
                </p>
              </div>
              <CommunityPostOwnerActions
                post={displayPost}
                onUpdated={handlePostUpdated}
                onDeleted={handlePostDeleted}
              />
              <ReportPostMenu post={displayPost} />
            </header>

            {displayPost.content ? (
              <CommunityMentionText
                content={displayPost.content}
                scripture="full"
                className="text-[16px] text-[#1A1A1A] leading-relaxed whitespace-pre-wrap break-words text-left"
              />
            ) : null}

            {displayPost.imageUrl && !imageFailed ? (
              <div className="-mx-1 rounded-xl overflow-hidden border border-[#E8DCC2] bg-[#F3EBD8]">
                <img
                  src={displayPost.imageUrl}
                  alt={displayPost.imageAlt || 'Community photo'}
                  className="w-full max-h-[520px] object-cover"
                  onError={() => setImageFailed(true)}
                />
              </div>
            ) : null}

            <TribesPostActions post={displayPost} onComment={focusCommentComposer} />
          </article>

          <ReportPostRow post={displayPost} />

          <CommunityCommentsSection
            postId={displayPost.id}
            focusCommentId={focusCommentId}
          />
        </div>
      )}
    </main>
  );
};
