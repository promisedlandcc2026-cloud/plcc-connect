import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { AWC_CHAT_ORIGIN, awcChatUrl } from '../../lib/awcChatMove';

/** Connect's Chat now lives in PLCC Chat — open it signed in, keeping the room. */
export const OpenAwcChat: React.FC = () => {
  const { channelId } = useParams();
  const location = useLocation();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => setSlow(true), 8000);
    void awcChatUrl(channelId, location.search).then((url) => {
      if (!cancelled) window.location.replace(url);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <div className="w-10 h-10 rounded-full border-4 border-burgundy/20 border-t-burgundy animate-spin" aria-hidden />
      <p className="text-base font-bold text-ink" role="status">Opening PLCC Chat…</p>
      {slow ? (
        <a
          href={`${AWC_CHAT_ORIGIN}/community/chat`}
          className="mt-2 inline-flex min-h-[48px] items-center rounded-xl bg-burgundy px-5 text-base font-bold text-white"
        >
          Open PLCC Chat
        </a>
      ) : null}
    </main>
  );
};
