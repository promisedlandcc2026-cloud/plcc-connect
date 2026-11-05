export type CommunityFeedAuthor = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type CommunityFeedReaction = {
  key: string;
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

export type CommunityReactionKey = 'love' | 'pray' | 'praise' | 'like';

export type CommunityReactionResult = {
  targetType: 'post' | 'comment';
  targetId: string;
  /** Present for post reactions (backward compatible). */
  postId?: string;
  action: 'insert' | 'delete';
  reactions: CommunityFeedReaction[];
};

export type CommunityFeedPost = {
  id: string;
  category: string;
  categoryLabel: string;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  edited: boolean;
  pinned: boolean;
  author: CommunityFeedAuthor;
  imageUrl: string | null;
  imageAlt: string | null;
  commentCount: number;
  reactions: CommunityFeedReaction[];
  /** Presentation only — server re-verifies ownership on every mutation. */
  authoredByMe: boolean;
  canEditOwnPost: boolean;
  canDeleteOwnPost: boolean;
};

export type CommunityFeedPage = {
  posts: CommunityFeedPost[];
  pageSize: number;
  offset: number;
  hasMore: boolean;
  skipped: number;
};

export type CommunityFeedErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'vault_unavailable'
  | 'bridge_unconfigured'
  | 'invalid_upstream'
  | 'invalid_query'
  | 'method_not_allowed'
  | 'network'
  | 'malformed_response'
  | 'session_missing'
  | 'not_approved';

export class CommunityFeedError extends Error {
  code: CommunityFeedErrorCode;
  status: number;
  sessionInvalid: boolean;

  constructor(
    code: CommunityFeedErrorCode,
    message: string,
    status: number,
    sessionInvalid = false
  ) {
    super(message);
    this.name = 'CommunityFeedError';
    this.code = code;
    this.status = status;
    this.sessionInvalid = sessionInvalid;
  }
}
