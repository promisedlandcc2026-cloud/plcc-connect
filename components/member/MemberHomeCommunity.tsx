import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Pin } from 'lucide-react';
import { MemberHomeSection } from './MemberHomeSection';
import { ErrorState, LoadingState } from '../ui/States';
import { fetchCommunityFeedPage } from '../../lib/communityFeedClient';
import { CommunityFeedError, type CommunityFeedPost } from '../../lib/communityFeedTypes';
import { formatFeedContentForDisplay } from '../../lib/communityMentionFormat';
import { truncateText } from '../../lib/memberHomeEvents';

const PREVIEW_LIMIT = 3;

function AuthorAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || 'M').trim().charAt(0).toUpperCase();
  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="h-9 w-9 rounded-xl object-cover border border-gray-100"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className="h-9 w-9 rounded-xl bg-burgundy/10 text-burgundy flex items-center justify-center text-sm font-bold"
      aria-hidden
    >
      {initial}
    </div>
  );
}

export const MemberHomeCommunity: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<CommunityFeedPost[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchCommunityFeedPage({ limit: PREVIEW_LIMIT, offset: 0 });
      setPosts(page.posts.slice(0, PREVIEW_LIMIT));
    } catch (err) {
      const message =
        err instanceof CommunityFeedError
          ? err.message
          : 'Could not load Community right now.';
      setError(message);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Nothing to show yet — keep Home short instead of an empty block.
  if (!loading && !error && posts.length === 0) return null;

  return (
    <MemberHomeSection
      title="From the church family"
      action={{ to: '/community', label: 'See all' }}
    >
      {loading ? <LoadingState message="Loading Community…" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error
        ? posts.map((post) => {
            const reactionTotal = post.reactions.reduce((sum, r) => sum + r.count, 0);
            return (
              <Link
                key={post.id}
                to={`/community/post/${post.id}`}
                className="block rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden active:scale-[0.99] transition-transform"
              >
                {post.imageUrl ? (
                  <img
                    src={post.imageUrl}
                    alt={post.imageAlt || ''}
                    className="h-32 w-full object-cover"
                  />
                ) : null}
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <AuthorAvatar name={post.author.name} avatarUrl={post.author.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#1A1A1A] truncate">
                        {post.author.name}
                      </p>
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                        {post.categoryLabel}
                      </p>
                    </div>
                    {post.pinned ? (
                      <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-gold-ink">
                        <Pin size={10} aria-hidden />
                        Pinned
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {truncateText(formatFeedContentForDisplay(post.content), 160)}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {reactionTotal > 0 ? <span>{reactionTotal} reactions</span> : null}
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle size={12} aria-hidden />
                      {post.commentCount}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })
        : null}
    </MemberHomeSection>
  );
};
