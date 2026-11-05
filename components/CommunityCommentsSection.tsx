import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import {
  createCommunityComment,
  deleteCommunityComment,
  editCommunityComment,
  fetchCommunityComments,
} from '../lib/communityCommentClient';
import {
  COMMENT_MAX_CHARS,
  CommunityCommentsError,
  type ConnectCommunityComment,
} from '../lib/communityCommentTypes';
import { useCommunityReactions } from '../context/CommunityReactionsContext';
import { CommunityMentionText } from './CommunityMentionText';
import { CommunityMentionTextarea } from './CommunityMentionTextarea';
import { CommunityReactionBar } from './CommunityReactionBar';
import { Button } from './ui/Button';

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
  });
}

function CommentAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  const initials = name.trim().charAt(0).toUpperCase() || 'M';
  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="w-9 h-9 rounded-full object-cover border border-gray-100 bg-gray-50"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className="w-9 h-9 rounded-full bg-burgundy/10 text-burgundy flex items-center justify-center text-xs font-bold"
      aria-hidden
    >
      {initials}
    </div>
  );
}

type Props = {
  postId: string;
  focusCommentId?: string | null;
};

export const CommunityCommentsSection: React.FC<Props> = ({ postId, focusCommentId }) => {
  const {
    adjustCommentCount,
    seedFromComments,
    removeCommentState,
  } = useCommunityReactions();
  const [comments, setComments] = useState<ConnectCommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [focusMiss, setFocusMiss] = useState(false);
  const [truncated, setTruncated] = useState(false);

  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const writeLockRef = useRef(false);
  const highlightRef = useRef<HTMLElement | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      const requestId = ++requestIdRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setListError(null);

      try {
        const list = await fetchCommunityComments(postId, { signal: controller.signal });
        if (requestId !== requestIdRef.current) return;
        setComments(list.comments);
        seedFromComments(postId, list.comments);
        setTruncated(list.truncated);
        if (focusCommentId) {
          const found = list.comments.some((c) => c.id === focusCommentId);
          setFocusMiss(!found);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (requestId !== requestIdRef.current) return;
        setListError(
          err instanceof CommunityCommentsError
            ? err.message
            : 'Comments are temporarily unavailable. Please try again.'
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [focusCommentId, postId, seedFromComments]
  );

  useEffect(() => {
    void load('initial');
    return () => {
      requestIdRef.current += 1;
      abortRef.current?.abort();
    };
  }, [load]);

  useEffect(() => {
    if (!focusCommentId || loading) return;
    const el = document.getElementById(`comment-${focusCommentId}`);
    if (!el) return;
    highlightRef.current = el;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [comments, focusCommentId, loading]);

  const onSubmit = async () => {
    if (writeLockRef.current || submitting) return;
    const content = draft.trim();
    if (!content) {
      setComposeError('Please write a comment before sending.');
      return;
    }
    if (content.length > COMMENT_MAX_CHARS) {
      setComposeError(`Comments can be up to ${COMMENT_MAX_CHARS} characters.`);
      return;
    }
    writeLockRef.current = true;
    setSubmitting(true);
    setComposeError(null);
    try {
      const created = await createCommunityComment(postId, content);
      setComments((prev) => [...prev, created]);
      seedFromComments(postId, [created]);
      adjustCommentCount(postId, 1);
      setDraft('');
    } catch (err) {
      setComposeError(
        err instanceof CommunityCommentsError
          ? err.message
          : 'We couldn’t save your comment. Please try again.'
      );
    } finally {
      writeLockRef.current = false;
      setSubmitting(false);
    }
  };

  const onSaveEdit = async (commentId: string) => {
    if (writeLockRef.current || editSaving) return;
    const content = editDraft.trim();
    if (!content) {
      setEditError('Please write a comment before saving.');
      return;
    }
    writeLockRef.current = true;
    setEditSaving(true);
    setEditError(null);
    try {
      const updated = await editCommunityComment(commentId, content);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                ...updated,
                // Edit is text-only — preserve reaction summary if upstream omits it.
                reactions: updated.reactions?.length ? updated.reactions : c.reactions,
              }
            : c
        )
      );
      setEditingId(null);
      setEditDraft('');
    } catch (err) {
      setEditError(
        err instanceof CommunityCommentsError
          ? err.message
          : 'We couldn’t update your comment. Please try again.'
      );
    } finally {
      writeLockRef.current = false;
      setEditSaving(false);
    }
  };

  const onConfirmDelete = async (commentId: string) => {
    if (writeLockRef.current || deletingId) return;
    writeLockRef.current = true;
    setDeletingId(commentId);
    setDeleteError(null);
    try {
      await deleteCommunityComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      removeCommentState(commentId);
      adjustCommentCount(postId, -1);
      setConfirmDeleteId(null);
    } catch (err) {
      setDeleteError(
        err instanceof CommunityCommentsError
          ? err.message
          : 'We couldn’t delete your comment. Please try again.'
      );
    } finally {
      writeLockRef.current = false;
      setDeletingId(null);
    }
  };

  return (
    <section className="mt-6 space-y-4" aria-label="Comments">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-[#1A1A1A]">Comments</h2>
        <button
          type="button"
          onClick={() => void load('refresh')}
          disabled={loading || refreshing}
          className="text-xs font-bold text-burgundy min-h-[44px] px-2"
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {focusMiss && (
        <p className="text-sm text-gray-600 rounded-2xl bg-gold/10 border border-gold/20 p-3" role="status">
          That comment is no longer available, but you can still read the post.
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 py-6" role="status">
          <Loader2 className="animate-spin" size={18} aria-hidden />
          Loading comments…
        </div>
      )}

      {listError && (
        <p className="text-sm text-red-700" role="alert">
          {listError}
        </p>
      )}

      {!loading && !listError && comments.length === 0 && (
        <p className="text-sm text-gray-500">No comments yet. Be the first to share a kind word.</p>
      )}

      <ul className="space-y-3">
        {comments.map((c) => {
          const focused = focusCommentId === c.id;
          return (
            <li
              key={c.id}
              id={`comment-${c.id}`}
              className={`rounded-3xl border p-4 bg-white text-left ${
                focused ? 'border-burgundy ring-2 ring-burgundy/20' : 'border-gray-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <CommentAvatar name={c.author.name} avatarUrl={c.author.avatarUrl} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-[#1A1A1A]">{c.author.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatRelativeTime(c.createdAt)}
                      {c.edited ? ' · Edited' : ''}
                    </p>
                  </div>

                  {editingId === c.id ? (
                    <div className="space-y-2">
                      <CommunityMentionTextarea
                        value={editDraft}
                        onChange={setEditDraft}
                        maxLength={COMMENT_MAX_CHARS}
                        rows={3}
                        aria-label="Edit comment"
                        className="w-full rounded-2xl border border-gray-200 p-3 text-sm text-gray-800"
                      />
                      <p className="text-xs text-gray-500">
                        {editDraft.trim().length}/{COMMENT_MAX_CHARS}
                      </p>
                      {editError && (
                        <p className="text-xs text-red-700" role="alert">
                          {editError}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          disabled={editSaving}
                          onClick={() => void onSaveEdit(c.id)}
                        >
                          {editSaving ? 'Saving…' : 'Save'}
                        </Button>
                        <button
                          type="button"
                          className="min-h-[44px] px-3 text-sm font-bold text-gray-500"
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft('');
                            setEditError(null);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <CommunityMentionText
                      content={c.content}
                      className="text-sm text-gray-800 whitespace-pre-wrap break-words"
                    />
                  )}

                  {editingId !== c.id && (
                    <CommunityReactionBar
                      targetType="comment"
                      targetId={c.id}
                      reactions={c.reactions || []}
                      compact
                    />
                  )}

                  {(c.canEdit || c.canDelete) && editingId !== c.id && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {c.canEdit && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-bold text-burgundy min-h-[40px]"
                          onClick={() => {
                            setEditingId(c.id);
                            setEditDraft(c.content);
                            setEditError(null);
                          }}
                        >
                          <Pencil size={12} aria-hidden />
                          Edit
                        </button>
                      )}
                      {c.canDelete && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-bold text-red-700 min-h-[40px]"
                          onClick={() => {
                            setConfirmDeleteId(c.id);
                            setDeleteError(null);
                          }}
                        >
                          <Trash2 size={12} aria-hidden />
                          Delete
                        </button>
                      )}
                    </div>
                  )}

                  {confirmDeleteId === c.id && (
                    <div className="rounded-2xl bg-red-50 border border-red-100 p-3 space-y-2">
                      <p className="text-sm text-red-900">
                        Delete this comment? This cannot be undone.
                      </p>
                      {deleteError && (
                        <p className="text-xs text-red-700" role="alert">
                          {deleteError}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          disabled={deletingId === c.id}
                          onClick={() => void onConfirmDelete(c.id)}
                        >
                          {deletingId === c.id ? 'Deleting…' : 'Delete'}
                        </Button>
                        <button
                          type="button"
                          className="min-h-[44px] px-3 text-sm font-bold text-gray-500"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {truncated && (
        <p className="text-xs text-gray-500 text-center">
          Showing the most recent comments available for this post.
        </p>
      )}

      <div className="rounded-3xl border border-gray-100 bg-white p-4 space-y-2">
        <label htmlFor="community-comment-composer" className="text-sm font-bold text-[#1A1A1A]">
          Write a comment
        </label>
        <CommunityMentionTextarea
          id="community-comment-composer"
          value={draft}
          onChange={setDraft}
          rows={3}
          maxLength={COMMENT_MAX_CHARS}
          disabled={submitting}
          placeholder="Share an encouraging word…"
          aria-label="Write a comment"
          className="w-full rounded-2xl border border-gray-200 p-3 text-sm text-gray-800"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            {draft.trim().length}/{COMMENT_MAX_CHARS}
          </p>
          <Button type="button" disabled={submitting} onClick={() => void onSubmit()}>
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden />
                <span className="ml-2">Sending…</span>
              </>
            ) : (
              'Post comment'
            )}
          </Button>
        </div>
        {composeError && (
          <p className="text-xs text-red-700" role="alert">
            {composeError}
          </p>
        )}
      </div>
    </section>
  );
};
