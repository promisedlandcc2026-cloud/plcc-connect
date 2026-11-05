import React from 'react';
import { formatFeedContentForDisplay } from '../lib/communityMentionFormat';

type Props = {
  content: string;
  className?: string;
};

/**
 * Safe plain-text mention display. Never uses dangerouslySetInnerHTML.
 */
export const CommunityMentionText: React.FC<Props> = ({ content, className }) => {
  const display = formatFeedContentForDisplay(content);
  return (
    <p className={className || 'text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words text-left'}>
      {display}
    </p>
  );
};
