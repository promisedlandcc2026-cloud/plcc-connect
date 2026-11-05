/**
 * Home "Live Huddles": lights up when a voice huddle is running in any chat
 * channel the member can see (or their family huddle), with a one-tap Join,
 * and lets them start a new one by picking a channel.
 * Uses the existing chat + family huddle bridges; polls every 30s while the
 * app is in the foreground. Hides itself if chat is unavailable.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Mic, Radio, Users } from 'lucide-react';
import { fetchChatChannels, fetchHuddleStatuses } from '../../lib/communityChatClient';
import {
  isDmChannel,
  isHuddleChannelLive,
  type CommunityChatChannel,
  type HuddleChannelStatus,
} from '../../lib/communityChatTypes';
import { fetchFamilyHuddleStatus } from '../../lib/familyHuddleClient';
import { liveHuddleRows, huddleRoomPath } from '../../lib/liveHuddles';
import { prefetchCommunityChatChunks } from '../../lib/prefetchMemberChunks';
import { ModalShell } from '../ui/ModalShell';

const POLL_MS = 30_000;

export const LiveHuddles: React.FC = () => {
  const [channels, setChannels] = useState<CommunityChatChannel[] | null>(null);
  const [status, setStatus] = useState<Record<string, HuddleChannelStatus>>({});
  const [family, setFamily] = useState<{ live: boolean; count: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const refresh = useCallback(async (list: CommunityChatChannel[]) => {
    const ids = list.map((c) => c.id);
    const [byChannel, fam] = await Promise.all([
      fetchHuddleStatuses(ids).catch(() => null),
      fetchFamilyHuddleStatus().catch(() => null),
    ]);
    if (byChannel) setStatus(byChannel);
    setFamily(fam && fam.configured ? { live: fam.live, count: fam.participantCount } : null);
  }, []);

  useEffect(() => {
    let alive = true;
    let timer = 0;
    let list: CommunityChatChannel[] = [];
    fetchChatChannels()
      .then((all) => {
        if (!alive) return;
        list = all.filter((c) => !isDmChannel(c));
        setChannels(list);
        void refresh(list);
        timer = window.setInterval(() => {
          if (document.visibilityState === 'visible') void refresh(list);
        }, POLL_MS);
      })
      .catch(() => alive && setFailed(true));
    const onVisible = () => {
      if (document.visibilityState === 'visible' && list.length) void refresh(list);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  if (failed || !channels || channels.length === 0) return null;

  const rows = liveHuddleRows(channels, status);
  const anyLive = rows.length > 0 || Boolean(family?.live);

  return (
    <section
      aria-labelledby="live-huddles-title"
      className="rounded-[22px] border border-[#F2D98A]/20 bg-white/[0.06] p-4 text-cream"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="live-huddles-title" className="flex items-center gap-2 text-[15px] font-bold">
          {anyLive ? (
            <span className="awc-live-dot awc-live-dot--green h-[9px] w-[9px] rounded-full bg-green-500" aria-hidden />
          ) : (
            <Mic size={16} className="text-leaf" aria-hidden />
          )}
          Live Huddles
        </h2>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          onTouchStart={prefetchCommunityChatChunks}
          className="min-h-[40px] rounded-full border border-[#F2D98A]/40 px-3.5 text-[13px] font-bold text-leaf"
        >
          Start one
        </button>
      </div>

      {anyLive ? (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to={huddleRoomPath(r.id, 'join')}
                state={{ channelName: r.name }}
                onTouchStart={prefetchCommunityChatChunks}
                className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-cream px-3.5 py-2.5 text-ink"
              >
                <Radio size={18} className="shrink-0 text-green-700" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{r.name}</span>
                  <span className="block text-xs font-semibold text-[#5A606C]">
                    {r.count > 0 ? `${r.count} in the room` : 'Live now'}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-burgundy px-3.5 py-2 text-[13px] font-bold text-white">Join</span>
              </Link>
            </li>
          ))}
          {family?.live ? (
            <li>
              <Link
                to="/family"
                className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-cream px-3.5 py-2.5 text-ink"
              >
                <Users size={18} className="shrink-0 text-green-700" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">Your family</span>
                  <span className="block text-xs font-semibold text-[#5A606C]">
                    {family.count > 0 ? `${family.count} in the room` : 'Live now'}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-burgundy px-3.5 py-2 text-[13px] font-bold text-white">Join</span>
              </Link>
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm text-cream/80">No one is in a huddle right now. Start one and others can join from here.</p>
      )}

      <ModalShell
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Start a Live Huddle"
        subtitle="Pick where to start it"
        icon={<Mic size={22} className="text-gold" aria-hidden />}
      >
        <p className="mb-3 text-sm text-ink-muted">
          Everyone in the channel sees it’s live and can join from Home or the chat.
        </p>
        <ul className="space-y-2">
          {channels.map((c) => (
            <li key={c.id}>
              <Link
                to={huddleRoomPath(c.id, isHuddleChannelLive(status[c.id]) ? 'join' : 'start')}
                state={{ channelName: c.name }}
                onClick={() => setPickerOpen(false)}
                className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-2.5 text-ink"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{c.name}</span>
                  {isHuddleChannelLive(status[c.id]) ? (
                    <span className="block text-xs font-semibold text-green-700">Live now · join instead</span>
                  ) : c.description ? (
                    <span className="block truncate text-xs text-ink-soft">{c.description}</span>
                  ) : null}
                </span>
                <ChevronRight size={18} className="shrink-0 text-ink-soft" aria-hidden />
              </Link>
            </li>
          ))}
          <li>
            <Link
              to="/family"
              onClick={() => setPickerOpen(false)}
              className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-2.5 text-ink"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">My Family</span>
                <span className="block text-xs text-ink-soft">A private huddle with your household</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-ink-soft" aria-hidden />
            </Link>
          </li>
        </ul>
      </ModalShell>
    </section>
  );
};
