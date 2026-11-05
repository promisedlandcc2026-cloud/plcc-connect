import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Calendar,
  Church,
  HandHeart,
  Loader2,
  MessageCircle,
  Users,
} from 'lucide-react';
import { MemberPageHeader } from '../components/member/MemberPageHeader';
import { JoinTeamModule } from '../components/JoinTeamModule';
import { fetchMinistryBySlug, type MinistryHub } from '../lib/ministryHubData';
import { fetchChatChannels } from '../lib/communityChatClient';
import type { CommunityChatChannel } from '../lib/communityChatTypes';
import {
  applicationStatusLabel,
  fetchMyTeamApplications,
  type MyTeamApplication,
} from '../lib/ministryJoinClient';

/**
 * Phase 2.9A — ministry hub with membership + join-request status.
 * Reuses Community chat ACL and Join Team applications; no new group comms.
 */
export const MemberMinistryHubPage: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [ministry, setMinistry] = useState<MinistryHub | null>(null);
  const [chatChannel, setChatChannel] = useState<CommunityChatChannel | null>(null);
  const [applications, setApplications] = useState<MyTeamApplication[]>([]);
  const [joinOpen, setJoinOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadApplications = useCallback(async (ministryId: string) => {
    setApplications(await fetchMyTeamApplications(ministryId));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setLoadError(false);
      setChatChannel(null);
      setApplications([]);
      try {
        const hub = await fetchMinistryBySlug(slug);
        if (cancelled) return;
        setMinistry(hub);
        if (!hub) {
          setLoading(false);
          return;
        }

        try {
          const channels = await fetchChatChannels();
          if (cancelled) return;
          const match = channels.find((ch) => ch.ministryId && ch.ministryId === hub.id);
          setChatChannel(match || null);
        } catch {
          setChatChannel(null);
        }

        try {
          const apps = await fetchMyTeamApplications(hub.id);
          if (!cancelled) setApplications(apps);
        } catch {
          if (!cancelled) setApplications([]);
        }
      } catch {
        if (!cancelled) {
          setMinistry(null);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const pendingApps = applications.filter((a) => a.status === 'new');
  const latestApp = applications[0] || null;

  if (loading) {
    return (
      <main className="flex-1 px-5 pt-10 pb-28">
        <MemberPageHeader
          title="Ministry"
          backTo="/ministries"
          backLabel="Ministries"
        />
        <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          Opening ministry hub…
        </div>
      </main>
    );
  }

  if (!ministry) {
    return (
      <main className="flex-1 px-5 pt-10 pb-28">
        <MemberPageHeader
          title="Ministry unavailable"
          subtitle={
            loadError
              ? 'We could not load this ministry right now.'
              : 'That ministry hub could not be found.'
          }
          backTo="/ministries"
          backLabel="Ministries"
        />
        <Link
          to="/ministries"
          className="inline-flex items-center justify-center min-h-[48px] rounded-2xl bg-burgundy text-white text-sm font-bold px-5"
        >
          Back to Ministries
        </Link>
      </main>
    );
  }

  return (
    <main className="flex-1 px-5 pt-10 pb-28 space-y-8">
      <MemberPageHeader
        title={ministry.name}
        eyebrow="Ministry Hub"
        subtitle={ministry.description || 'Stay connected with this area of church life.'}
        backTo="/ministries"
        backLabel="Ministries"
      />

      <header className="flex items-start gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-burgundy text-gold">
          <Church size={26} aria-hidden />
        </span>
        <div className="min-w-0 pt-1">
          {ministry.isMember ? (
            <p className="text-xs font-black uppercase tracking-widest text-burgundy mb-1">
              You serve here
            </p>
          ) : null}
          <p className="text-sm text-gray-600 leading-relaxed">
            {ministry.teams.length > 0
              ? `${ministry.teams.length} team${ministry.teams.length === 1 ? '' : 's'} in this ministry`
              : 'Explore how this ministry serves PLCC'}
          </p>
        </div>
      </header>

      {ministry.teams.length > 0 ? (
        <section aria-labelledby="hub-teams-heading" className="space-y-3">
          <h2
            id="hub-teams-heading"
            className="text-xs font-black uppercase tracking-[0.18em] text-burgundy px-0.5"
          >
            Teams
          </h2>
          <ul className="space-y-2">
            {ministry.teams.map((team) => (
              <li
                key={team.id}
                className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm"
              >
                <p className="text-sm font-bold text-[#1A1A1A]">{team.name}</p>
                {team.description ? (
                  <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                    {team.description}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="hub-next-heading" className="space-y-3">
        <h2
          id="hub-next-heading"
          className="text-xs font-black uppercase tracking-[0.18em] text-burgundy px-0.5"
        >
          Next Up
        </h2>
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white/70 px-4 py-5 flex items-start gap-3">
          <Calendar size={18} className="text-gray-500 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm text-gray-600">No upcoming ministry events.</p>
            <p className="mt-1 text-xs text-gray-500 leading-relaxed">
              Events appear here when they are linked to this ministry.
            </p>
            <Link
              to="/events"
              className="inline-flex mt-3 text-xs font-black uppercase tracking-widest text-burgundy min-h-[44px] items-center"
            >
              View all events
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="hub-updates-heading" className="space-y-3">
        <h2
          id="hub-updates-heading"
          className="text-xs font-black uppercase tracking-[0.18em] text-burgundy px-0.5"
        >
          Latest Updates
        </h2>
        <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm space-y-2">
          <p className="text-sm text-gray-600 leading-relaxed">
            Church-wide updates live in Community. Ministry-scoped announcement posts are not
            separated in Connect yet.
          </p>
          <Link
            to="/community"
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-burgundy min-h-[44px]"
          >
            <Users size={14} aria-hidden />
            Open Community
          </Link>
        </div>
      </section>

      <section aria-labelledby="hub-connect-heading" className="space-y-3">
        <h2
          id="hub-connect-heading"
          className="text-xs font-black uppercase tracking-[0.18em] text-burgundy px-0.5"
        >
          Connect
        </h2>
        <ul className="space-y-2">
          <li>
            <Link
              to="/community"
              className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5 min-h-[56px] shadow-sm active:scale-[0.99] transition-transform"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-burgundy/10 text-burgundy">
                <Users size={18} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#1A1A1A]">Community</p>
                <p className="text-xs text-gray-500">Feed and ministry updates</p>
              </div>
            </Link>
          </li>
          <li>
            {chatChannel ? (
              <Link
                to={`/community/chat/${chatChannel.id}`}
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5 min-h-[56px] shadow-sm active:scale-[0.99] transition-transform"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-burgundy/10 text-burgundy">
                  <MessageCircle size={18} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#1A1A1A]">Chat</p>
                  <p className="text-xs text-gray-500 truncate">{chatChannel.name}</p>
                </div>
              </Link>
            ) : (
              <Link
                to="/community/chat"
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5 min-h-[56px] shadow-sm active:scale-[0.99] transition-transform"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-burgundy/10 text-burgundy">
                  <MessageCircle size={18} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#1A1A1A]">Chat</p>
                  <p className="text-xs text-gray-500">Open Community chat channels</p>
                </div>
              </Link>
            )}
          </li>
          {/intercess/i.test(ministry.name || '') && (
            <li>
              <Link
                to="/intercessors"
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5 min-h-[56px] shadow-sm active:scale-[0.99] transition-transform"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-burgundy/10 text-burgundy">
                  <HandHeart size={18} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#1A1A1A]">Intercessors Prayer Watch</p>
                  <p className="text-xs text-gray-500">Live Huddle and every prayer request, side by side</p>
                </div>
              </Link>
            </li>
          )}
        </ul>
      </section>

      <section aria-labelledby="hub-serve-heading" className="space-y-3">
        <h2
          id="hub-serve-heading"
          className="text-xs font-black uppercase tracking-[0.18em] text-burgundy px-0.5"
        >
          Serve
        </h2>
        <Link
          to={`/serve?ministryId=${encodeURIComponent(ministry.id)}`}
          className="flex items-start gap-3 rounded-2xl border border-burgundy/15 bg-white px-4 py-4 min-h-[56px] active:scale-[0.99] transition-transform"
        >
          <HandHeart size={18} className="text-burgundy shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#1A1A1A]">Serve with this ministry</p>
            <p className="mt-1 text-xs text-gray-500 leading-relaxed">
              View open Serve opportunities linked to {ministry.name}.
            </p>
          </div>
        </Link>
      </section>

      <section aria-labelledby="hub-join-heading" className="space-y-3">
        <h2
          id="hub-join-heading"
          className="text-xs font-black uppercase tracking-[0.18em] text-burgundy px-0.5"
        >
          Membership
        </h2>

        {ministry.isMember ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-4">
            <p className="text-sm font-bold text-emerald-900">You serve with this ministry</p>
            <p className="mt-1 text-xs text-emerald-800/80 leading-relaxed">
              Your membership is on file. Use Serve and Chat below when opportunities are open.
            </p>
          </div>
        ) : pendingApps.length > 0 ? (
          <div className="rounded-2xl border border-gold/20 bg-gold/5 px-4 py-4 space-y-2">
            <p className="text-sm font-bold text-burgundy">
              {applicationStatusLabel(pendingApps[0].status)}
            </p>
            <ul className="space-y-1">
              {pendingApps.slice(0, 3).map((app) => (
                <li key={app.id} className="text-xs text-gray-600">
                  {app.teamName}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 leading-relaxed">
              Leadership will review your request. You can submit another team interest if needed.
            </p>
            <button
              type="button"
              onClick={() => setJoinOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-2xl bg-white border border-burgundy/15 text-burgundy text-sm font-bold"
            >
              Request another team
            </button>
          </div>
        ) : latestApp && latestApp.status !== 'new' ? (
          <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4 space-y-3 shadow-sm">
            <p className="text-sm font-bold text-[#1A1A1A]">
              {applicationStatusLabel(latestApp.status)} · {latestApp.teamName}
            </p>
            <button
              type="button"
              onClick={() => setJoinOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-2xl bg-burgundy text-white text-sm font-bold"
            >
              Request to join a team
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setJoinOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-2xl bg-burgundy text-white text-sm font-bold active:scale-[0.99] transition-transform"
            >
              Request to join
            </button>
            <p className="text-xs text-gray-500 text-center leading-relaxed px-2">
              Choose a team in this ministry. A leader will review your request, and your contact
              details stay private.
            </p>
          </div>
        )}
      </section>

      <JoinTeamModule
        isOpen={joinOpen}
        onClose={() => setJoinOpen(false)}
        initialMinistry={ministry.name}
        ministryId={ministry.id}
        onSubmitted={() => {
          void loadApplications(ministry.id);
        }}
      />
    </main>
  );
};
