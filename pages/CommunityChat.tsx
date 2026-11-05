import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCcw,
  Search,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useHuddleLive } from '../context/HuddleLiveContext';
import {
  CommunityChatError,
  isDmChannel,
  isHuddleChannelLive,
  type ChatDirectoryMember,
  type CommunityChatChannel,
} from '../lib/communityChatTypes';
import {
  fetchChatChannels,
  fetchChatUnread,
  openDirectMessage,
  searchChatDirectory,
} from '../lib/communityChatClient';
import { HuddleLiveBadge } from '../components/huddle/HuddleLiveDot';
import { dmDisplayName, listDmRecents, rememberDmRecent } from '../lib/dmRecents';
import { Button } from '../components/ui/Button';
import { MemberPageHeader } from '../components/member/MemberPageHeader';

const SEARCH_DEBOUNCE_MS = 280;

function visibilityLabel(visibility: string | null): string {
  const v = String(visibility || '').toLowerCase();
  if (v === 'dm') return 'Direct';
  if (v === 'open' || v === 'public') return 'Open';
  if (v === 'ministry') return 'Ministry';
  if (v === 'leadership') return 'Leadership';
  if (v === 'private') return 'Private';
  if (v === 'event') return 'Event';
  return 'Channel';
}

export const CommunityChatPage: React.FC = () => {
  const { identity, memberAccessState } = useAuth();
  const navigate = useNavigate();
  const [channels, setChannels] = useState<CommunityChatChannel[]>([]);
  const [unreadByChannel, setUnreadByChannel] = useState<Record<string, number>>({});
  const { byChannel: huddleByChannel } = useHuddleLive();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dmRecents, setDmRecents] = useState(() => listDmRecents());

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<ChatDirectoryMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [openingPartnerId, setOpeningPartnerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (memberAccessState !== 'approved_member') return;
    setLoading(true);
    setError(null);
    try {
      const [list, unread] = await Promise.all([
        fetchChatChannels(),
        fetchChatUnread().catch(() => ({ count: 0, byChannel: {} })),
      ]);
      setChannels(list);
      setUnreadByChannel(unread.byChannel);
      setDmRecents(listDmRecents());
    } catch (err) {
      const message =
        err instanceof CommunityChatError
          ? err.message
          : 'Chat is temporarily unavailable. Please try again.';
      setError(message);
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }, [memberAccessState]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!newChatOpen) return;
    const q = searchQ.trim();
    if (!q) {
      setSearchResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      void searchChatDirectory(q, { signal: controller.signal })
        .then((members) => {
          if (!controller.signal.aborted) setSearchResults(members);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          setSearchResults([]);
          setSearchError(
            err instanceof CommunityChatError
              ? err.message
              : 'Could not search members. Please try again.'
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [newChatOpen, searchQ]);

  const groupChannels = useMemo(
    () => channels.filter((c) => !isDmChannel(c)),
    [channels]
  );

  const closeNewChat = () => {
    setNewChatOpen(false);
    setSearchQ('');
    setSearchResults([]);
    setSearchError(null);
    setOpeningPartnerId(null);
  };

  const startDm = async (partner: ChatDirectoryMember) => {
    if (openingPartnerId) return;
    setOpeningPartnerId(partner.id);
    setSearchError(null);
    try {
      const { channel } = await openDirectMessage(partner.id);
      rememberDmRecent({ channelId: channel.id, partner });
      setDmRecents(listDmRecents());
      closeNewChat();
      navigate(`/community/chat/${channel.id}`, {
        state: { partnerName: partner.name, isDm: true },
      });
    } catch (err) {
      setSearchError(
        err instanceof CommunityChatError
          ? err.message
          : 'Could not open that conversation. Please try again.'
      );
      setOpeningPartnerId(null);
    }
  };

  const renderChannelRow = (
    channel: CommunityChatChannel,
    title: string,
    opts?: { isDm?: boolean }
  ) => {
    const unread = unreadByChannel[channel.id] || 0;
    const huddle = huddleByChannel[channel.id];
    const live = isHuddleChannelLive(huddle) && !opts?.isDm;
    return (
      <li key={channel.id}>
        <Link
          to={`/community/chat/${channel.id}`}
          state={{
            channelName: title,
            partnerName: opts?.isDm ? title : undefined,
            isDm: Boolean(opts?.isDm),
          }}
          className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-burgundy/20 transition-colors min-h-[64px]"
        >
          <div className="w-11 h-11 rounded-xl bg-burgundy/10 text-burgundy flex items-center justify-center shrink-0">
            {opts?.isDm ? <User size={18} aria-hidden /> : <MessageCircle size={18} aria-hidden />}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-sm font-bold text-[#1A1A1A] truncate">{title}</p>
              {live ? <HuddleLiveBadge count={huddle?.participantCount} /> : null}
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              {visibilityLabel(opts?.isDm ? 'dm' : channel.visibility)}
              {live && huddle?.participantCount
                ? ` · ${huddle.participantCount} in huddle`
                : ''}
              {!live && !opts?.isDm && channel.description
                ? ` · ${channel.description}`
                : ''}
            </p>
          </div>
          {unread > 0 ? (
            <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-burgundy text-white text-xs font-black leading-[22px] text-center">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Link>
      </li>
    );
  };

  return (
    <main className="flex-1 px-5 pt-8 pb-28">
      <div className="flex items-center justify-between gap-2 mb-6">
        <Link
          to="/community"
          className="inline-flex items-center gap-2 text-burgundy text-sm font-bold min-h-[44px]"
        >
          <ArrowLeft size={18} aria-hidden />
          Feed
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setNewChatOpen(true)}
            className="inline-flex items-center gap-1.5 text-burgundy text-sm font-bold min-h-[44px] px-2"
            aria-label="New chat"
          >
            <Plus size={16} aria-hidden />
            New
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 text-burgundy text-sm font-bold min-h-[44px] px-2"
            aria-label="Refresh channels"
          >
            <RefreshCcw size={16} aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      <MemberPageHeader
        title="Chat"
        backTo="/community"
        backLabel="Community"
        subtitle={`${identity?.name ? `Signed in as ${identity.name}. ` : ''}Message members, open shared channels, and start or join a Live Huddle.`}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500 gap-2">
          <Loader2 className="animate-spin" size={18} aria-hidden />
          Loading channels…
        </div>
      ) : error ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
          <p className="text-sm text-burgundy font-medium">{error}</p>
          <Button type="button" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {dmRecents.length > 0 ? (
            <section>
              <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2 px-1">
                Direct
              </h2>
              <ul className="space-y-2">
                {dmRecents.map((dm) =>
                  renderChannelRow(
                    {
                      id: dm.channelId,
                      name: dm.partnerName,
                      description: null,
                      visibility: 'dm',
                      type: 'private',
                      ministryId: null,
                    },
                    dm.partnerName,
                    { isDm: true }
                  )
                )}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2 px-1">
              Channels
            </h2>
            {groupChannels.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 text-sm text-gray-500">
                No group channels are available yet. Use New to message a member.
              </div>
            ) : (
              <ul className="space-y-2">
                {groupChannels.map((channel) =>
                  renderChannelRow(
                    channel,
                    isDmChannel(channel)
                      ? dmDisplayName(channel.id, channel.name)
                      : channel.name
                  )
                )}
              </ul>
            )}
          </section>
        </div>
      )}

      {newChatOpen ? (
        <div
          className="fixed inset-0 z-[300] flex flex-col justify-end bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="New chat"
        >
          <button
            type="button"
            className="flex-1 cursor-default"
            aria-label="Close"
            onClick={closeNewChat}
          />
          <div className="bg-eggshell rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="text-lg font-bold text-[#1A1A1A]">New chat</h2>
              <button
                type="button"
                onClick={closeNewChat}
                className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center text-gray-500"
                aria-label="Close new chat"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-5 pb-3">
              <label className="sr-only" htmlFor="chat-member-search">
                Search members
              </label>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                  aria-hidden
                />
                <input
                  id="chat-member-search"
                  type="search"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Type a name (e.g. Sheevon)…"
                  autoFocus
                  className="w-full h-12 rounded-2xl border border-gray-200 bg-white pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-burgundy/20"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-4 min-h-[12rem]">
              {searching ? (
                <div className="flex items-center justify-center gap-2 py-10 text-gray-500 text-sm">
                  <Loader2 className="animate-spin" size={16} />
                  Searching…
                </div>
              ) : searchError ? (
                <p className="text-sm text-burgundy py-6 text-center">{searchError}</p>
              ) : !searchQ.trim() ? (
                <p className="text-sm text-gray-500 py-6 text-center">
                  Type a name to find someone to message.
                  <span className="block mt-1 text-xs text-gray-500">
                    You don’t need @ here — that’s only for tagging in a channel.
                  </span>
                </p>
              ) : searchResults.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">
                  No members match that name.
                </p>
              ) : (
                <ul className="space-y-2">
                  {searchResults.map((member) => (
                    <li key={member.id}>
                      <button
                        type="button"
                        disabled={openingPartnerId === member.id}
                        onClick={() => void startDm(member)}
                        className="w-full flex items-center gap-3 rounded-2xl bg-white border border-gray-100 p-3 text-left min-h-[56px] disabled:opacity-60"
                      >
                        <div className="w-10 h-10 rounded-full bg-burgundy/10 text-burgundy flex items-center justify-center shrink-0 overflow-hidden">
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User size={18} aria-hidden />
                          )}
                        </div>
                        <span className="text-sm font-bold text-[#1A1A1A] truncate flex-1">
                          {member.name}
                        </span>
                        {openingPartnerId === member.id ? (
                          <Loader2 className="animate-spin text-burgundy" size={16} />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
};
