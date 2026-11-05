import type { CommunityFeedReaction } from './communityFeedTypes';

export type ConnectCommunityCommentAuthor = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type ConnectCommunityComment = {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  edited: boolean;
  author: ConnectCommunityCommentAuthor;
  canEdit: boolean;
  canDelete: boolean;
  reactions: CommunityFeedReaction[];
};

export type CommunityCommentsList = {
  comments: ConnectCommunityComment[];
  postId: string;
  hasMore: boolean;
  truncated: boolean;
  skipped: number;
};

export type CommunityCommentsErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'vault_unavailable'
  | 'bridge_unconfigured'
  | 'invalid_upstream'
  | 'invalid_query'
  | 'invalid_body'
  | 'empty'
  | 'too_long'
  | 'conflict'
  | 'network'
  | 'malformed_response'
  | 'session_missing'
  | 'not_approved';

export class CommunityCommentsError extends Error {
  code: CommunityCommentsErrorCode;
  status: number;
  sessionInvalid: boolean;

  constructor(
    code: CommunityCommentsErrorCode,
    message: string,
    status: number,
    sessionInvalid = false
  ) {
    super(message);
    this.name = 'CommunityCommentsError';
    this.code = code;
    this.status = status;
    this.sessionInvalid = sessionInvalid;
  }
}

export const COMMENT_MAX_CHARS = 2000;
