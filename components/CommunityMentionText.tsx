import React from 'react';
import { formatFeedContentForDisplay } from '../lib/communityMentionFormat';
import { parseVerseMessage } from '../lib/verseShare';
import { VerseCard } from './VerseCard';
import { ScriptureCard } from './tribes/ScriptureCard';

type Props = {
  content: string;
  className?: string;
  /** Tribes posts show a shared verse as the framed Scripture card (comments keep the compact card). */
  scripture?: 'feed' | 'full';
};

/**
 * Safe plain-text mention display. Never uses dangerouslySetInnerHTML.
 */
export const CommunityMentionText: React.FC<Props> = ({ content, className, scripture }) => {
  const verse = parseVerseMessage(content);
  if (verse) {
    return (
      <div className="space-y-2">
        {verse.note ? (
          <p className={className || 'text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words text-left'}>
            {formatFeedContentForDisplay(verse.note)}
          </p>
        ) : null}
        {scripture ? <ScriptureCard verse={verse} size={scripture} /> : <VerseCard verse={verse} />}
      </div>
    );
  }
  const display = formatFeedContentForDisplay(content);
  return (
    <p className={className || 'text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words text-left'}>
      {display}
    </p>
  );
};
