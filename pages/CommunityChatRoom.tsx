import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Radio, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  CommunityChatError,
  isHuddleChannelLive,
  type CommunityChatMessage,
} from '../lib/communityChatTypes';
import {
  fetchChatMessages,
  fetchHuddleStatuses,
  markChatChannelRead,
  sendChatMessage,
} from '../lib/communityChatClient';
import { dmDisplayName } from '../lib/dmRecents';
import { ConnectVoiceHuddle } from '../components/community/ConnectVoiceHuddle';
import { Button } from '../components/ui/Button';
import { parseHuddleIntent } from '../lib/liveHuddles';
import { fetchIntercessorsAccess } from '../lib/intercessorsClient';

const POLL_MS = 5000;
const HUDDLE_POLL_MS = 10_000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LocationState = {
  partnerName?: string;
  channelName?: string;
  isDm?: boolean;
};

function formatTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const CommunityChatRoomPage: React.FC = () => {
  const { channelId = '' } = useParams();
  const location = useLocation();
  const locState = (location.state || {}) as LocationState;
  const { user, memberAccessState } = useAuth();
  const [messages, setMessages] = useState<CommunityChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [huddleLive, setHuddleLive] = useState(false);
  const [huddleCount, setHuddleCount] = useState(0);
  const [huddleOpen, setHuddleOpen] = useState(false);
  const [huddleMode, setHuddleMode] = useState<'join' | 'start'>('join');
  const bottomRef = useRef<HTMLDivElement>(null);
  const validChannel = UUID_RE.test(channelId);
  /** Arrived from Home "Live Huddles": show a one-tap card (the tap is what lets the mic start). */
  const [huddleIntent, setHuddleIntent] = useState(() => parseHuddleIntent(location.search));
  /** True when this room is the Intercessor Channel and the member can open the Prayer Watch. */
  const [isPrayerWatchRoom, setIsPrayerWatchRoom] = useState(false);

  const isDm =
    Boolean(locState.isDm) ||
    Boolean(locState.partnerName) ||
    Boolean(dmDisplayName(channelId, ''));

  const roomTitle =
    locState.partnerName ||
    locState.channelName ||
    dmDisplayName(channelId, '') ||
    (isDm ? 'Direct message' : 'Channel');

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!validChannel || memberAccessState !== 'approved_member') return;
      if (!opts?.quiet) setLoading(true);
      try {
        const list = await fetchChatMessages(channelId);
        setMessages(list);
        setError(null);
        void markChatChannelRead(channelId).catch(() => {
          /* non-blocking */
        });
      } catch (err) {
        if (!opts?.quiet) {
          const message =
            err instanceof CommunityChatError
              ? err.message
              : 'Chat is temporarily unavailable. Please try again.';
          setError(message);
        }
      } finally {
        if (!opts?.quiet) setLoading(false);
      }
    },
    [channelId, memberAccessState, validChannel]
  );

  const loadHuddle = useCallback(
    async (signal?: AbortSignal) => {
      if (!validChannel || memberAccessState !== 'approved_member' || isDm) {
        setHuddleLive(false);
        setHuddleCount(0);
        return;
      }
      try {
        const byChannel = await fetchHuddleStatuses([channelId], { signal });
        const status = byChannel[channelId];
        setHuddleLive(isHuddleChannelLive(status));
        setHuddleCount(status?.participantCount || 0);
      } catch {
        /* omit Join bar rather than fail the room */
      }
    },
    [channelId, isDm, memberAccessState, validChannel]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isDm || !validChannel || memberAccessState !== 'approved_member') return;
    let alive = true;
    fetchIntercessorsAccess()
      .then((a) => alive && setIsPrayerWatchRoom(a.allowed && a.roomId === channelId))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [channelId, isDm, memberAccessState, validChannel]);

  useEffect(() => {
    if (!validChannel || memberAccessState !== 'approved_member') return;

    let timer: number | null = null;
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void load({ quiet: true });
    };
    const start = () => {
      if (timer != null) return;
      timer = window.setInterval(tick, POLL_MS);
    };
    const stop = () => {
      if (timer != null) {
        window.clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void load({ quiet: true });
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load, memberAccessState, validChannel]);

  useEffect(() => {
    if (!validChannel || memberAccessState !== 'approved_member' || isDm) return;
    const controller = new AbortController();
    let timer: number | null = null;

    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void loadHuddle(controller.signal);
    };
    const start = () => {
      if (timer != null) return;
      timer = window.setInterval(tick, HUDDLE_POLL_MS);
    };
    const stop = () => {
      if (timer != null) {
        window.clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadHuddle(controller.signal);
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') {
      void loadHuddle(controller.signal);
      start();
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      controller.abort();
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isDm, loadHuddle, memberAccessState, validChannel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const onSend = async () => {
    const content = draft.trim();
    if (!content || sending || !validChannel) return;
    setSending(true);
    setError(null);
    try {
      const created = await sendChatMessage(channelId, content);
      setDraft('');
      setMessages((prev) => [...prev, created]);
    } catch (err) {
      const message =
        err instanceof CommunityChatError
          ? err.message
          : 'Could not send. Please try again.';
      setError(message);
    } finally {
      setSending(false);
    }
  };

  const openHuddle = (mode: 'join' | 'start') => {
    setHuddleMode(mode);
    setHuddleOpen(true);
    setHuddleIntent(null);
  };

  if (!validChannel) {
    return (
      <main className="flex-1 px-5 pt-10 pb-28">
        <Link
          to="/community/chat"
          className="inline-flex items-center gap-2 text-burgundy text-sm font-bold min-h-[44px]"
        >
          <ArrowLeft size={18} aria-hidden />
          Channels
        </Link>
        <p className="mt-6 text-sm text-burgundy">That channel link is not valid.</p>
      </main>
    );
  }

  return (
    <main className="flex-1 px-5 pt-8 pb-28 flex flex-col min-h-[70vh]">
      <div className="flex items-center justify-between gap-2 mb-4">
        <Link
          to="/community/chat"
          className="inline-flex items-center gap-2 text-burgundy text-sm font-bold min-h-[44px]"
        >
          <ArrowLeft size={18} aria-hidden />
          Channels
        </Link>
        {!isDm && !huddleLive && !huddleOpen ? (
          <button
            type="button"
            onClick={() => openHuddle('start')}
            className="inline-flex items-center gap-1.5 text-burgundy text-sm font-bold min-h-[44px] px-2"
          >
            <Radio size={16} aria-hidden />
            Start huddle
          </button>
        ) : null}
      </div>

      {isPrayerWatchRoom ? (
        <Link
          to="/intercessors"
          className="mb-3 flex items-center justify-center gap-2 min-h-[44px] rounded-2xl bg-gold/20 border border-gold text-sm font-bold text-[#1A1A1A]"
        >
          Open the Intercessors Prayer Watch
        </Link>
      ) : null}

      <h1 className="text-lg font-bold text-[#1A1A1A] mb-3 truncate flex items-center gap-2">
        {roomTitle}
        {huddleLive && !isDm ? (
          <span
            className="shrink-0 w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
            role="status"
            aria-label="Live huddle"
          />
        ) : null}
      </h1>

      {huddleIntent && !huddleOpen && !isDm ? (
        <div className="mb-4 rounded-2xl bg-wine p-4 text-cream shadow-lg">
          <p className="text-sm font-semibold text-cream/85">
            {huddleLive || huddleIntent === 'join'
              ? 'A Live Huddle is running in this channel.'
              : 'Start a Live Huddle here. Others in this channel can join from Home.'}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => openHuddle(huddleLive || huddleIntent === 'join' ? 'join' : 'start')}
              className="min-h-[48px] rounded-xl bg-leaf text-wine text-sm font-extrabold inline-flex items-center justify-center gap-1.5"
            >
              <Radio size={16} aria-hidden />
              {huddleLive || huddleIntent === 'join' ? 'Join huddle' : 'Start huddle'}
            </button>
            <button
              type="button"
              onClick={() => setHuddleIntent(null)}
              className="min-h-[48px] rounded-xl border border-cream/40 text-sm font-bold"
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}

      {huddleLive && !huddleOpen && !isDm ? (
        <div className="sticky top-0 z-20 mb-4 -mx-1 px-1">
          <button
            type="button"
            onClick={() => openHuddle('join')}
            className="w-full flex items-center justify-between gap-3 rounded-2xl bg-burgundy text-white px-4 py-3 shadow-lg min-h-[52px]"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Radio size={18} className="text-gold shrink-0" aria-hidden />
              <span className="text-left min-w-0">
                <span className="block text-xs font-black uppercase tracking-widest text-gold-ink">
                  Live now
                </span>
                <span className="block text-sm font-bold truncate">
                  Join huddle
                  {huddleCount > 0 ? ` · ${huddleCount} in room` : ''}
                </span>
              </span>
            </span>
            <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-emerald-500 text-white text-xs font-black uppercase tracking-wider px-2 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" aria-hidden />
              Live
            </span>
          </button>
        </div>
      ) : null}

      <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500 gap-2">
            <Loader2 className="animate-spin" size={18} aria-hidden />
            Loading messages…
          </div>
        ) : error && messages.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
            <p className="text-sm text-burgundy font-medium">{error}</p>
            <Button type="button" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-12">
            No messages yet. Say hello to get started.
          </p>
        ) : (
          messages.map((msg) => {
            const mine = Boolean(user?.id && msg.author.id === user.id);
            return (
              <article
                key={msg.id}
                className={`rounded-2xl px-4 py-3 max-w-[90%] ${
                  mine
                    ? 'ml-auto bg-burgundy text-white'
                    : 'mr-auto bg-white border border-gray-100 shadow-sm'
                }`}
              >
                <p
                  className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                    mine ? 'text-white/70' : 'text-gray-500'
                  }`}
                >
                  {msg.author.name} · {formatTime(msg.createdAt)}
                </p>
                {msg.parent && !msg.parent.isDeleted && msg.parent.content ? (
                  <p
                    className={`text-xs italic mb-2 border-l-2 pl-2 ${
                      mine ? 'border-white/30 text-white/80' : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    {msg.parent.name}: {msg.parent.content}
                  </p>
                ) : null}
                <p
                  className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    mine ? '' : 'text-[#1A1A1A]'
                  }`}
                >
                  {msg.isDeleted ? 'Message removed' : msg.content}
                </p>
              </article>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && messages.length > 0 ? (
        <p className="text-xs text-burgundy mb-2">{error}</p>
      ) : null}

      <form
        className="sticky bottom-20 bg-eggshell/95 backdrop-blur-sm pt-2 pb-2 flex gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void onSend();
        }}
      >
        {!isDm && !huddleOpen ? (
          <button
            type="button"
            onClick={() => openHuddle(huddleLive ? 'join' : 'start')}
            className={`relative min-h-[48px] min-w-[48px] rounded-2xl flex items-center justify-center ${
              huddleLive ? 'bg-emerald-600 text-white' : 'bg-gold/25 text-burgundy'
            }`}
            aria-label={huddleLive ? 'Join live huddle' : 'Start a live huddle'}
            data-chat-huddle-button="true"
          >
            <Radio size={20} aria-hidden />
            {huddleLive ? (
              <span
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-white animate-pulse"
                aria-hidden
              />
            ) : null}
          </button>
        ) : null}
        <label className="sr-only" htmlFor="chat-draft">
          Message
        </label>
        <textarea
          id="chat-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Write a message…"
          className="flex-1 resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-burgundy/30"
          maxLength={4000}
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="min-h-[48px] min-w-[48px] rounded-2xl bg-burgundy text-white flex items-center justify-center disabled:opacity-40"
          aria-label="Send message"
        >
          {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
        </button>
      </form>

      {huddleOpen ? (
        <ConnectVoiceHuddle
          channelId={channelId}
          channelName={roomTitle}
          audioOnly={isPrayerWatchRoom}
          mode={huddleMode}
          onClose={() => {
            setHuddleOpen(false);
            void loadHuddle();
          }}
        />
      ) : null}
    </main>
  );
};
