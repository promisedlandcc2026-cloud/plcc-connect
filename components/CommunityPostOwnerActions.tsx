import React, { useEffect, useId, useRef, useState } from 'react';
import { Loader2, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import {
  CommunityFeedError,
  type CommunityFeedPost,
} from '../lib/communityFeedTypes';
import {
  COMMUNITY_POST_MAX_CHARS,
  deleteOwnCommunityPost,
  editOwnCommunityPost,
} from '../lib/communityPostClient';
import { CommunityMentionTextarea } from './CommunityMentionTextarea';
import { Button } from './ui/Button';

type Props = {
  post: CommunityFeedPost;
  onUpdated: (post: CommunityFeedPost) => void;
  onDeleted: (postId: string) => void;
};

/**
 * Self-only edit/delete menu for Community posts.
 * Never shows pin/moderate actions. Server re-verifies ownership.
 */
export const CommunityPostOwnerActions: React.FC<Props> = ({
  post,
  onUpdated,
  onDeleted,
}) => {
  const menuId = useId();
  const textareaId = useId();
  const pendingRef = useRef(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canManage = Boolean(post.canEditOwnPost || post.canDeleteOwnPost);

  useEffect(() => {
    if (!editing) setDraft(post.content);
  }, [post.content, editing]);

  if (!canManage) return null;

  const closeMenu = () => setMenuOpen(false);

  const requestCancelEdit = () => {
    if (saving) return;
    if (draft.trim() !== post.content.trim()) {
      const ok = window.confirm('Discard unsaved changes to this post?');
      if (!ok) return;
    }
    setEditing(false);
    setDraft(post.content);
    setError(null);
  };

  const saveEdit = async () => {
    if (pendingRef.current || saving) return;
    const text = draft.trim();
    if (!text) {
      setError('Write something before saving.');
      return;
    }
    if (text.length > COMMUNITY_POST_MAX_CHARS) {
      setError('That post is too long. Please shorten it and try again.');
      return;
    }
    if (text === post.content.trim()) {
      setEditing(false);
      setError(null);
      return;
    }

    pendingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const updated = await editOwnCommunityPost(post.id, text);
      onUpdated(updated);
      setEditing(false);
      setDraft(updated.content);
    } catch (err) {
      setError(
        err instanceof CommunityFeedError
          ? err.message
          : 'We couldn’t update that post right now. Please try again.'
      );
    } finally {
      pendingRef.current = false;
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (pendingRef.current || deleting) return;
    const ok = window.confirm(
      'Delete this post? It will be removed from the PLCC Community, including access to its conversation.'
    );
    if (!ok) return;

    pendingRef.current = true;
    setDeleting(true);
    setError(null);
    closeMenu();
    try {
      await deleteOwnCommunityPost(post.id);
      onDeleted(post.id);
    } catch (err) {
      setError(
        err instanceof CommunityFeedError
          ? err.message
          : 'We couldn’t update that post right now. Please try again.'
      );
    } finally {
      pendingRef.current = false;
      setDeleting(false);
    }
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        aria-label="Post actions"
        disabled={deleting || saving}
        onClick={() => setMenuOpen((o) => !o)}
        className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full text-gray-500 hover:bg-gray-50 disabled:opacity-50"
      >
        {deleting ? (
          <Loader2 className="animate-spin" size={18} aria-hidden />
        ) : (
          <MoreHorizontal size={18} aria-hidden />
        )}
      </button>

      {menuOpen && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 rounded-2xl border border-gray-100 bg-white shadow-lg py-1"
        >
          {post.canEditOwnPost && (
            <button
              type="button"
              role="menuitem"
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-[#1A1A1A] hover:bg-gray-50 min-h-[44px]"
              onClick={() => {
                closeMenu();
                setEditing(true);
                setDraft(post.content);
                setError(null);
              }}
            >
              <Pencil size={14} aria-hidden />
              Edit Post
            </button>
          )}
          {post.canDeleteOwnPost && (
            <button
              type="button"
              role="menuitem"
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-red-700 hover:bg-red-50 min-h-[44px]"
              onClick={() => void confirmDelete()}
            >
              <Trash2 size={14} aria-hidden />
              Delete Post
            </button>
          )}
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Edit post"
        >
          <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-xl border border-gray-100">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-gray-100">
              <h2 className="text-base font-bold text-[#1A1A1A]">Edit post</h2>
              <button
                type="button"
                onClick={requestCancelEdit}
                disabled={saving}
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                aria-label="Close editor"
              >
                <X size={20} aria-hidden />
              </button>
            </div>

            <div className="p-4 space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div>
                <label htmlFor={textareaId} className="sr-only">
                  Post text
                </label>
                <CommunityMentionTextarea
                  id={textareaId}
                  value={draft}
                  onChange={setDraft}
                  maxLength={COMMUNITY_POST_MAX_CHARS}
                  rows={5}
                  disabled={saving}
                  aria-label="Post text"
                  className="w-full resize-y min-h-[120px] rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-[#1A1A1A] focus:outline-none focus-visible:ring-2 focus-visible:ring-burgundy/40 disabled:opacity-60"
                />
                <p
                  className="mt-1 text-right text-xs text-gray-500 tabular-nums"
                  aria-live="polite"
                >
                  {draft.length}/{COMMUNITY_POST_MAX_CHARS}
                </p>
              </div>

              {post.imageUrl && (
                <div className="rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
                  <img
                    src={post.imageUrl}
                    alt={post.imageAlt || 'Current post photo'}
                    className="w-full max-h-[220px] object-contain"
                  />
                  <p className="text-xs text-gray-500 px-3 py-2">
                    Photo stays as-is when you edit text. Changing photos isn’t available yet.
                  </p>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-900 leading-relaxed" role="alert">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 justify-end">
                <Button type="button" variant="secondary" onClick={requestCancelEdit} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void saveEdit()}
                  disabled={saving || !draft.trim()}
                >
                  {saving ? (
                    <span role="status" className="inline-flex items-center gap-2">
                      <Loader2 className="animate-spin" size={16} aria-hidden />
                      Saving…
                    </span>
                  ) : (
                    'Save'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!editing && error && (
        <p className="mt-2 text-xs text-red-800 leading-relaxed" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
