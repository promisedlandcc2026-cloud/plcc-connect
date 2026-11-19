import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronRight, Flag, Loader2, MessageCircle, MoreHorizontal, Share2, ThumbsUp } from 'lucide-react';
import type { CommunityFeedPost, CommunityReactionKey } from '../../lib/communityFeedTypes';
import { useCommunityReactions } from '../../context/CommunityReactionsContext';
import { useAuth } from '../../context/AuthContext';
import { CommunityReactionBar } from '../CommunityReactionBar';
import { kaLinkVerseShareUrl } from '../../lib/awcChatMove';
import { kaLinkVerseSharePath, scriptureOf } from '../../lib/scripturePost';
import { openReport } from '../../lib/report';

const LIKE: CommunityReactionKey = 'like';
const OTHER_REACTIONS: CommunityReactionKey[] = ['love', 'pray', 'praise'];

const ACTION =
  'inline-flex min-h-[48px] grow basis-0 items-center justify-center gap-2 rounded-xl px-2 text-[15px] font-semibold text-[#1d372c] hover:bg-[#1d372c]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d372c]/40 disabled:opacity-60';

/** Opens the shared Report dialog for a Tribes post (same flow as the rest of PLCC). */
export function reportPost(post: CommunityFeedPost) {
  openReport({
    kind: 'content',
    contentType: 'feed_post',
    contentId: post.id,
    authorName: post.author.name,
    authorId: post.author.id,
    contentPreview: post.content ? post.content.slice(0, 280) : null,
    context: 'Tribes',
  });
}

/**
 * Like · Comment · (Scripture) Share to Ka Link, plus the other church
 * reactions (❤️ 🙏 🙌) above. Like is the existing 'like' reaction.
 */
export const TribesPostActions: React.FC<{
  post: CommunityFeedPost;
  onComment: () => void;
}> = ({ post, onComment }) => {
  const { memberAccessState } = useAuth();
  const { getReactions, isPending, errorFor, toggleReaction, getCommentCount } = useCommunityReactions();
  const commentCount = getCommentCount(post.id, post.commentCount);
  const [sharing, setSharing] = useState(false);
  const approved = memberAccessState === 'approved_member';
  const reactions = getReactions('post', post.id, post.reactions);
  const like = reactions.find((r) => r.key === LIKE);
  const liked = Boolean(like?.reactedByMe);
  const likeCount = like?.count ?? 0;
  const pending = isPending('post', post.id);
  const verse = scriptureOf(post.content);
  const sharePath = verse ? kaLinkVerseSharePath(verse.url) : null;
  const error = errorFor('post', post.id);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div onClick={stop} onKeyDown={stop} className="space-y-2">
      <CommunityReactionBar postId={post.id} reactions={post.reactions} compact only={OTHER_REACTIONS} />
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 border-t border-[#E8DCC2] pt-1 pb-1">
        <button
          type="button"
          className={`${ACTION} min-w-[96px] ${liked ? 'text-[#12301f]' : ''}`}
          aria-pressed={liked}
          aria-label={`Like, ${likeCount}`}
          disabled={!approved || pending}
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              await toggleReaction('post', post.id, LIKE, post.reactions);
            } catch {
              /* shown via errorFor */
            }
          }}
        >
          <ThumbsUp size={20} aria-hidden fill={liked ? 'currentColor' : 'none'} strokeWidth={liked ? 2 : 1.8} />
          <span>Like</span>
          {likeCount > 0 ? <span className="tabular-nums text-[13px] text-[#4B5563]">{likeCount}</span> : null}
        </button>
        <button
          type="button"
          className={`${ACTION} min-w-[124px]`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onComment();
          }}
        >
          <MessageCircle size={20} aria-hidden strokeWidth={1.8} />
          <span>Comment</span>
          {commentCount > 0 ? <span className="tabular-nums text-[13px] text-[#4B5563]">{commentCount}</span> : null}
        </button>
        {sharePath && approved ? (
          <div className="flex min-w-[172px] grow basis-[172px]">
            <button
              type="button"
              disabled={sharing}
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                setSharing(true);
                try {
                  window.location.assign(await kaLinkVerseShareUrl(sharePath));
                } finally {
                  window.setTimeout(() => setSharing(false), 8000);
                }
              }}
              className="tribes-gold-btn inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#C9A35A] px-2 text-[14px] font-bold text-[#12231c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d372c]/50 disabled:opacity-70"
            >
              {sharing ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Share2 size={18} aria-hidden />}
              <span className="whitespace-nowrap">Share to Ka Link</span>
            </button>
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="text-left text-xs text-red-700" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
};

/** Full-width "Report post" row (single-post view), for posts that aren't yours. */
export const ReportPostRow: React.FC<{ post: CommunityFeedPost }> = ({ post }) => {
  if (post.authoredByMe) return null;
  return (
    <button
      type="button"
      onClick={() => reportPost(post)}
      className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-[#E8DCC2] bg-[#FBF7EE] px-4 text-left text-[16px] font-semibold text-[#12231c] hover:bg-[#F6EEDB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d372c]/40"
    >
      <Flag size={20} aria-hidden />
      <span className="flex-1">Report post</span>
      <ChevronRight size={20} aria-hidden />
    </button>
  );
};

/** ⋯ menu on someone else's post in the feed — Report post. (Your own posts keep Edit / Delete.) */
export const ReportPostMenu: React.FC<{ post: CommunityFeedPost }> = ({ post }) => {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (post.authoredByMe || post.canEditOwnPost || post.canDeleteOwnPost) return null;

  return (
    <div ref={ref} className="relative shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label="Post options"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#12231c] hover:bg-[#1d372c]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d372c]/40"
      >
        <MoreHorizontal size={22} aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-12 z-20 min-w-[180px] overflow-hidden rounded-2xl border border-[#E8DCC2] bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            autoFocus
            onClick={() => {
              setOpen(false);
              reportPost(post);
            }}
            className="flex min-h-[48px] w-full items-center gap-3 px-4 text-left text-[15px] font-semibold text-[#12231c] hover:bg-[#FBF7EE] focus:bg-[#FBF7EE] focus:outline-none"
          >
            <Flag size={18} aria-hidden />
            Report post
          </button>
        </div>
      ) : null}
    </div>
  );
};
