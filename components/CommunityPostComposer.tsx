import React, { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  CommunityFeedError,
  type CommunityFeedPost,
} from '../lib/communityFeedTypes';
import {
  COMMUNITY_POST_MAX_CHARS,
  createCommunityPost,
} from '../lib/communityPostClient';
import {
  isAcceptedCommunityPostImageFile,
  prepareCommunityPostImageFile,
  type PreparedCommunityPostImage,
} from '../lib/communityPostImagePrepare';
import { CommunityMentionTextarea } from './CommunityMentionTextarea';
import { Button } from './ui/Button';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (post: CommunityFeedPost) => void;
};

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

/**
 * Mobile-friendly Community post composer (approved members only).
 * Draft stays in memory until Vault confirms create — never localStorage.
 */
export const CommunityPostComposer: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const { identity, memberAccessState, user } = useAuth();
  const titleId = useId();
  const textareaId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const postingRef = useRef(false);

  const [content, setContent] = useState('');
  const [pendingImage, setPendingImage] = useState<PreparedCommunityPostImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preparingImage, setPreparingImage] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authUserId = user?.id || null;
  const approved = memberAccessState === 'approved_member';
  const displayName = identity?.name || 'Member';
  const avatarUrl = identity?.avatarUrl || null;
  const hasDraft = Boolean(content.trim() || pendingImage);

  const revokePreview = () => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const clearDraft = () => {
    setContent('');
    setPendingImage(null);
    revokePreview();
    setError(null);
    setPreparingImage(false);
    postingRef.current = false;
    setPosting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Clear private draft on auth-user change or when no longer approved
  useEffect(() => {
    clearDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional identity boundary
  }, [authUserId, approved]);

  // Revoke object URL on unmount
  useEffect(() => {
    return () => {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasDraft || postingRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [open, hasDraft]);

  if (!open || !approved) return null;

  const requestClose = () => {
    if (postingRef.current) return;
    if (hasDraft) {
      const ok = window.confirm('Discard this draft? Your unsaved post will be lost.');
      if (!ok) return;
    }
    clearDraft();
    onClose();
  };

  const onPickPhoto = async (file: File | null) => {
    if (!file || postingRef.current) return;
    setError(null);
    if (!isAcceptedCommunityPostImageFile(file)) {
      setError('Please choose a JPG, PNG, or WebP image.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setPreparingImage(true);
    try {
      const prepared = await prepareCommunityPostImageFile(file);
      revokePreview();
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setPendingImage(prepared);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not prepare photo');
      // Keep text draft — only clear pending image
      setPendingImage(null);
      revokePreview();
    } finally {
      setPreparingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = () => {
    if (postingRef.current) return;
    setPendingImage(null);
    revokePreview();
    setError(null);
  };

  const submit = async () => {
    if (postingRef.current || preparingImage) return;
    const text = content.trim();
    if (!text && !pendingImage) {
      setError('Write something or add a photo before posting.');
      return;
    }
    if (text.length > COMMUNITY_POST_MAX_CHARS) {
      setError('That post is too long. Please shorten it and try again.');
      return;
    }

    postingRef.current = true;
    setPosting(true);
    setError(null);

    try {
      const post = await createCommunityPost({
        content: text,
        image: pendingImage
          ? { mimeType: pendingImage.mimeType, fileBase64: pendingImage.fileBase64 }
          : undefined,
      });
      clearDraft();
      onCreated(post);
      onClose();
    } catch (err) {
      if (err instanceof CommunityFeedError) {
        setError(err.message);
        if (err.sessionInvalid) {
          // Keep draft; parent may navigate to sign-in
        }
      } else {
        setError(
          'We couldn’t publish your post. Your draft is still here so you can try again.'
        );
      }
    } finally {
      postingRef.current = false;
      setPosting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-xl border border-gray-100">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-gray-100">
          <h2 id={titleId} className="text-base font-bold text-[#1A1A1A]">
            New post
          </h2>
          <button
            type="button"
            onClick={requestClose}
            disabled={posting}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            aria-label="Close composer"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="p-4 space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-start gap-3">
            <AuthorAvatar name={displayName} avatarUrl={avatarUrl} />
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-bold text-[#1A1A1A] truncate">{displayName}</p>
              <p className="text-xs text-gray-500">Share with the PLCC Community</p>
            </div>
          </div>

          <div>
            <label htmlFor={textareaId} className="sr-only">
              Post text
            </label>
            <CommunityMentionTextarea
              id={textareaId}
              value={content}
              onChange={setContent}
              maxLength={COMMUNITY_POST_MAX_CHARS}
              rows={5}
              disabled={posting}
              placeholder="What’s on your heart?"
              aria-label="Post text"
              className="w-full resize-y min-h-[120px] rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-[#1A1A1A] placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-burgundy/40 disabled:opacity-60"
            />
            <p className="mt-1 text-right text-xs text-gray-500 tabular-nums" aria-live="polite">
              {content.length}/{COMMUNITY_POST_MAX_CHARS}
            </p>
          </div>

          {previewUrl && (
            <div className="relative rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
              <img
                src={previewUrl}
                alt="Selected photo preview"
                className="w-full max-h-[280px] object-contain bg-gray-50"
              />
              <button
                type="button"
                onClick={removeImage}
                disabled={posting}
                className="absolute top-2 right-2 inline-flex items-center justify-center min-h-[40px] min-w-[40px] rounded-full bg-black/60 text-white disabled:opacity-50"
                aria-label="Remove photo"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => void onPickPhoto(e.target.files?.[0] || null)}
          />

          {error && (
            <p className="text-sm text-red-900 leading-relaxed" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={posting || preparingImage}
              className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-2xl bg-gray-100 text-gray-700 text-xs font-bold disabled:opacity-50"
            >
              {preparingImage ? (
                <Loader2 className="animate-spin" size={16} aria-hidden />
              ) : (
                <ImagePlus size={16} aria-hidden />
              )}
              {pendingImage ? 'Change photo' : 'Add photo'}
            </button>
            <div className="flex-1" />
            <Button type="button" variant="secondary" onClick={requestClose} disabled={posting}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={posting || preparingImage || (!content.trim() && !pendingImage)}
            >
              {posting ? (
                <span role="status" className="inline-flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} aria-hidden />
                  Posting…
                </span>
              ) : (
                'Post'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
