import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarHeart,
  Check,
  HandHeart,
  Loader2,
  MessageCircle,
  Phone,
  Printer,
  RefreshCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  fetchAnsweredPrayers,
  fetchIntercessorPrayers,
  fetchIntercessorsAccess,
  IntercessorsError,
  joinWatchRoom,
  markPrayer,
  removePrayer,
  type IntercessorPrayer,
  type IntercessorsAccess,
} from '../lib/intercessorsClient';
import { fetchHuddleStatuses } from '../lib/communityChatClient';
import { isHuddleChannelLive } from '../lib/communityChatTypes';
import { ConnectVoiceHuddle } from '../components/community/ConnectVoiceHuddle';
import { lastMeetingStart, MEETING_DAYS, nextMeetingDay } from '../api/_utils/intercessorsSanitize.js';

type Range = 'meeting' | 'week' | 'custom';
type Tab = 'requests' | 'praise';

const REFRESH_MS = 20_000;
const PAGE_TITLE = 'Intercessors Prayer Watch';

const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const longFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const stampFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function toInputDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fromInputDate(v: string, endOfDay: boolean): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

function useVisibleInterval(fn: () => void, ms: number, enabled: boolean) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') ref.current();
    }, ms);
    return () => window.clearInterval(id);
  }, [ms, enabled]);
}

/* —— Left: Live Huddle ——————————————————————————————————————————————— */

const HuddlePanel: React.FC<{
  roomId: string | null;
  roomName: string;
  meetingToday: boolean;
  joined: boolean;
  setJoined: (v: boolean) => void;
}> = ({ roomId, roomName, meetingToday, joined, setJoined }) => {
  const [live, setLive] = useState(false);
  const [count, setCount] = useState(0);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!roomId) return;
    try {
      const byChannel = await fetchHuddleStatuses([roomId]);
      const st = byChannel[roomId];
      setLive(isHuddleChannelLive(st));
      setCount(st?.participantCount || 0);
    } catch {
      /* status is a nicety; Join still works */
    }
  }, [roomId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);
  useVisibleInterval(() => void loadStatus(), REFRESH_MS, !joined && !!roomId);

  if (!roomId) {
    return (
      <div className="rounded-3xl bg-wine text-white p-5">
        <p className="text-sm">The Intercessor Channel was not found in Community chat.</p>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="h-[340px] lg:h-[calc(100dvh-210px)] lg:min-h-[480px]">
        <ConnectVoiceHuddle
          embedded
          audioOnly
          prayerWatch
          channelId={roomId}
          channelName={roomName}
          mode={live ? 'join' : 'start'}
          onClose={() => {
            setJoined(false);
            void loadStatus();
          }}
        />
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-wine text-white p-5 sm:p-6 flex flex-col gap-4 lg:min-h-[320px]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-leaf">Live Huddle</p>
        {live ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" aria-hidden /> Live · {count} praying
          </span>
        ) : (
          <span className="text-xs text-white/70">No one on the call yet</span>
        )}
      </div>
      <div>
        <h2 className="font-display text-2xl font-bold leading-tight">{roomName}</h2>
        <p className="text-sm text-white/75 mt-1">
          {meetingToday
            ? 'Prayer meeting today. Join the call and pray through the requests together.'
            : 'Join the call anytime. The prayer requests stay open while you pray.'}
        </p>
      </div>
      <button
        type="button"
        disabled={joining}
        onClick={() => {
          setJoining(true);
          setJoinError(null);
          joinWatchRoom()
            .then(() => setJoined(true))
            .catch((err) => setJoinError(err instanceof IntercessorsError ? err.message : 'We couldn’t open the prayer call.'))
            .finally(() => setJoining(false));
        }}
        className="min-h-[56px] rounded-2xl bg-gold text-ink font-black text-lg inline-flex items-center justify-center gap-2 disabled:opacity-60"
      >
        <Phone size={20} aria-hidden /> {live ? 'Join the Prayer Call' : 'Start the Prayer Call'}
      </button>
      <Link
        to={`/community/chat/${roomId}`}
        state={{ channelName: roomName }}
        className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-2xl border border-white/20 text-sm font-bold text-white/90"
      >
        <MessageCircle size={16} aria-hidden /> Open the room chat
      </Link>
      {joinError && <p className="text-sm font-semibold text-leaf" role="alert">{joinError}</p>}
    </div>
  );
};

/* —— Right: Prayer requests / Praise reports ——————————————————————————— */

const PrayerCard: React.FC<{
  p: IntercessorPrayer;
  index: number;
  isNew: boolean;
  canLead: boolean;
  busy: boolean;
  praise?: boolean;
  onMark: (action: 'prayed' | 'answered', value: boolean) => void;
  onRemove: () => void;
}> = ({ p, index, isNew, canLead, busy, praise, onMark, onRemove }) => {
  const prayed = !!p.prayedAt;
  const [confirmRemove, setConfirmRemove] = useState(false);
  return (
    <li
      className={`print-card rounded-2xl border p-4 shadow-card transition-colors ${
        prayed && !praise ? 'bg-[#F1FAF3] border-[#86C79A]' : 'bg-white border-black/10'
      } ${isNew ? 'animate-in slide-in-from-top-2 fade-in duration-500 ring-2 ring-gold' : ''}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-bold text-ink">
          {index + 1}. {p.name}
          {isNew && (
            <span className="ml-2 align-middle rounded-full bg-gold px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-ink print:hidden">
              New
            </span>
          )}
        </p>
        <p className="text-xs text-ink-soft shrink-0">{p.createdAt ? stampFmt.format(new Date(p.createdAt)) : ''}</p>
      </div>
      {p.category && p.category !== 'Other' && (
        <p className="text-xs font-bold uppercase tracking-widest text-burgundy mt-0.5">{p.category}</p>
      )}
      <p className="mt-2 text-[15px] leading-relaxed text-ink whitespace-pre-wrap">{p.content}</p>
      {p.privateToIntercessors ? (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-burgundy/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-burgundy">
          🤝 Private to the Intercessors · please keep it in this room
        </p>
      ) : (
        !p.onWall && !praise && <p className="mt-2 text-xs text-ink-soft">From a visitor. Not on the Prayer Wall yet.</p>
      )}
      {praise && p.answeredAt && (
        <p className="mt-2 text-xs font-bold text-[#1F7A3A]">Answered {dayFmt.format(new Date(p.answeredAt))}. Praise God!</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
        {!praise && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onMark('prayed', !prayed)}
            aria-pressed={prayed}
            className={`min-h-[40px] px-3.5 rounded-full text-sm font-bold inline-flex items-center gap-1.5 ${
              prayed ? 'bg-[#1F7A3A] text-white' : 'bg-burgundy/10 text-burgundy'
            }`}
          >
            {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : prayed ? <Check size={15} aria-hidden /> : <HandHeart size={15} aria-hidden />}
            {prayed ? `Prayed${p.prayedBy ? ` · ${p.prayedBy}` : ''}` : 'Mark Prayed'}
          </button>
        )}
        {canLead && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onMark('answered', !praise)}
            className="min-h-[40px] px-3.5 rounded-full text-sm font-bold inline-flex items-center gap-1.5 border border-black/10 bg-white text-ink"
          >
            <Sparkles size={15} aria-hidden /> {praise ? 'Undo answered' : 'Answered'}
          </button>
        )}
        {canLead && !confirmRemove && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmRemove(true)}
            className="min-h-[40px] px-3.5 rounded-full text-sm font-bold inline-flex items-center gap-1.5 text-ink-muted ml-auto"
          >
            <Trash2 size={15} aria-hidden /> Remove
          </button>
        )}
      </div>
      {canLead && confirmRemove && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-[#FDECEC] border border-[#F3B8B8] px-3 py-2.5 print:hidden" role="alert">
          <p className="flex-1 min-w-[180px] text-sm font-semibold text-[#203b2f]">
            Remove this prayer request for good? It also comes off the Prayer Wall.
          </p>
          <button
            type="button"
            onClick={() => setConfirmRemove(false)}
            className="min-h-[40px] px-3.5 rounded-full text-sm font-bold bg-white border border-black/10 text-ink"
          >
            Keep it
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setConfirmRemove(false);
              onRemove();
            }}
            className="min-h-[40px] px-3.5 rounded-full text-sm font-bold bg-[#B42318] text-white"
          >
            Yes, remove
          </button>
        </div>
      )}
    </li>
  );
};

/**
 * Intercessors Prayer Watch — the Live Huddle on the left, every shared prayer request on the right.
 * On phones the call sits on top and the requests scroll underneath.
 * Only members of the Intercessor Channel (and the prayer team) can open it.
 */
export const IntercessorsPrayerWatchPage: React.FC = () => {
  const now = useMemo(() => new Date(), []);
  const lastMeeting = useMemo(() => lastMeetingStart(now), [now]);
  const nextMeeting = useMemo(() => nextMeetingDay(now), [now]);
  const meetingToday = MEETING_DAYS.includes(now.getDay());

  const [access, setAccess] = useState<IntercessorsAccess | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('requests');
  const [range, setRange] = useState<Range>('meeting');
  const [customFrom, setCustomFrom] = useState(toInputDate(lastMeeting));
  const [customTo, setCustomTo] = useState(toInputDate(now));
  const [items, setItems] = useState<IntercessorPrayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [joined, setJoined] = useState(false);
  const seenRef = useRef<Set<string> | null>(null);

  const span = useMemo(() => {
    const end = new Date();
    if (range === 'week') return { from: new Date(end.getTime() - 7 * 86400000), to: end };
    if (range === 'custom') {
      const from = fromInputDate(customFrom, false) || lastMeeting;
      const to = fromInputDate(customTo, true) || end;
      return from <= to ? { from, to } : { from: to, to: from };
    }
    return { from: lastMeeting, to: end };
  }, [range, customFrom, customTo, lastMeeting]);

  useEffect(() => {
    fetchIntercessorsAccess()
      .then(setAccess)
      .catch((err) => setAccessError(err instanceof IntercessorsError ? err.message : 'We couldn’t open the Prayer Watch.'));
  }, []);

  const load = useCallback(
    async (quiet = false) => {
      if (!access?.allowed) return;
      if (!quiet) setLoading(true);
      setError(null);
      try {
        // Live refresh of the meeting window reaches up to "now".
        const to = range === 'custom' ? span.to : new Date();
        const data = tab === 'praise' ? await fetchAnsweredPrayers() : await fetchIntercessorPrayers(span.from, to);
        setItems(data.items);
        if (tab === 'requests') {
          const ids = new Set(data.items.map((i) => i.id));
          if (seenRef.current && quiet) {
            const fresh = data.items.filter((i) => !seenRef.current!.has(i.id)).map((i) => i.id);
            if (fresh.length) setNewIds((prev) => new Set([...prev, ...fresh]));
          }
          seenRef.current = new Set([...(seenRef.current || []), ...ids]);
        }
      } catch (err) {
        if (!quiet) setError(err instanceof IntercessorsError ? err.message : 'We couldn’t load the requests. Please try again.');
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [access, tab, span, range]
  );

  useEffect(() => {
    void load();
  }, [load]);
  useVisibleInterval(() => void load(true), REFRESH_MS, !!access?.allowed);

  const onMark = async (p: IntercessorPrayer, action: 'prayed' | 'answered', value: boolean) => {
    setBusyId(p.id);
    setNotice(null);
    // Show it right away; the next refresh confirms.
    if (action === 'prayed') {
      setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, prayedAt: value ? new Date().toISOString() : null, prayedBy: value ? 'You' : null } : x)));
    } else {
      setItems((prev) => prev.filter((x) => x.id !== p.id));
    }
    try {
      await markPrayer(action, p.id, value);
      if (action === 'answered') setNotice(value ? `Moved to Praise reports: ${p.name}'s request.` : 'Moved back to the prayer requests.');
    } catch (err) {
      setNotice(err instanceof IntercessorsError ? err.message : 'That change was not saved. Please try again.');
    } finally {
      setBusyId(null);
      void load(true);
    }
  };

  const onRemove = async (p: IntercessorPrayer) => {
    setBusyId(p.id);
    setNotice(null);
    setItems((prev) => prev.filter((x) => x.id !== p.id));
    try {
      await removePrayer(p.id);
      setNotice(`Removed ${p.name}'s prayer request.`);
    } catch (err) {
      setNotice(err instanceof IntercessorsError ? err.message : 'That request was not removed. Please try again.');
    } finally {
      setBusyId(null);
      void load(true);
    }
  };

  const roomName = access?.ministryName || 'Intercessor Channel';
  const rangeLabel = `${dayFmt.format(span.from)} – ${dayFmt.format(span.to)}`;
  const prayedCount = items.filter((i) => i.prayedAt).length;

  const chip = (id: Range, label: string) => (
    <button
      key={id}
      type="button"
      aria-pressed={range === id}
      onClick={() => setRange(id)}
      className={`min-h-[40px] px-3.5 rounded-full border text-sm font-bold ${
        range === id ? 'border-burgundy bg-burgundy/10 text-burgundy' : 'border-black/10 bg-white text-ink'
      }`}
    >
      {label}
    </button>
  );

  return (
    <main className="flex-1 px-4 sm:px-6 pt-6 pb-28 print:p-0">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #prayer-watch-print, #prayer-watch-print * { visibility: visible !important; }
          #prayer-watch-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0 12mm; }
          #prayer-watch-print .print-card { break-inside: avoid; box-shadow: none !important; background: #fff !important; border-color: #999 !important; }
          @page { margin: 14mm 0; }
        }
      `}</style>

      <div className="flex flex-col gap-4 print:hidden">
        <Link to="/prayer" className="self-start inline-flex items-center gap-2 min-h-[44px] text-burgundy font-bold">
          <ArrowLeft size={18} aria-hidden /> Prayer
        </Link>
        <header>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-burgundy">{roomName}</p>
          <h1 className="font-display text-[30px] leading-tight font-bold text-ink">{PAGE_TITLE}</h1>
          <p className="text-sm text-ink-muted mt-1">
            Next meeting: <b>{longFmt.format(nextMeeting)}</b>. Private requests for the Pastor are never shown here.
          </p>
        </header>
        {meetingToday && access?.allowed && !joined && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-gold/20 border border-gold px-4 py-3">
            <CalendarHeart size={20} className="text-burgundy shrink-0" aria-hidden />
            <p className="flex-1 min-w-[180px] font-bold text-ink">Prayer meeting today</p>
            <button
              type="button"
              onClick={() => {
                joinWatchRoom()
                  .then(() => setJoined(true))
                  .catch((err) => setNotice(err instanceof IntercessorsError ? err.message : 'We couldn’t open the prayer call.'));
              }}
              className="min-h-[44px] px-4 rounded-full bg-burgundy text-white text-sm font-bold inline-flex items-center gap-2"
            >
              <Phone size={16} aria-hidden /> Join now
            </button>
          </div>
        )}
      </div>

      {accessError ? (
        <p className="mt-6 rounded-2xl bg-white border border-burgundy/20 p-4 text-sm font-semibold text-burgundy" role="alert">
          {accessError}
        </p>
      ) : !access ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 size={16} className="animate-spin" aria-hidden /> Opening the Prayer Watch…
        </p>
      ) : !access.allowed ? (
        <div className="mt-6 rounded-2xl bg-white border border-black/10 p-5 text-ink">
          <p className="font-bold">The Prayer Watch is for the members of the {roomName}.</p>
          <p className="text-sm text-ink-muted mt-1">
            {access.setUp
              ? 'If you are an intercessor, ask the head of the Intercessors to add you to the room.'
              : 'There is no Intercessor Channel in Community chat yet.'}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-5 items-start">
          {/* Left: Live Huddle (sticks to the top on phones once the call is on) */}
          <section
            aria-label="Live Huddle"
            className={`print:hidden ${joined ? 'sticky top-[env(safe-area-inset-top,0px)] z-20' : ''} lg:sticky lg:top-4`}
          >
            <HuddlePanel roomId={access.roomId} roomName={roomName} meetingToday={meetingToday} joined={joined} setJoined={setJoined} />
          </section>

          {/* Right: requests */}
          <section aria-label="Prayer requests" className="min-w-0">
            <div className="grid grid-cols-2 gap-1.5 rounded-full bg-white border border-black/10 p-1.5 print:hidden" role="tablist">
              {(['requests', 'praise'] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`min-h-[44px] rounded-full font-extrabold text-sm ${tab === t ? 'bg-gold text-ink' : 'text-ink'}`}
                >
                  {t === 'requests' ? 'Prayer requests' : 'Praise reports'}
                </button>
              ))}
            </div>

            {tab === 'requests' && (
              <div className="mt-3 flex flex-col gap-3 print:hidden">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Which requests">
                  {chip('meeting', `Since last meeting (${dayFmt.format(lastMeeting)})`)}
                  {chip('week', 'Last 7 days')}
                  {chip('custom', 'Pick dates')}
                </div>
                {range === 'custom' && (
                  <div className="flex flex-wrap gap-3">
                    <label className="flex flex-col text-xs font-bold uppercase tracking-widest text-ink-muted gap-1">
                      From
                      <input
                        id="watch-from"
                        type="date"
                        value={customFrom}
                        max={customTo}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium normal-case tracking-normal text-ink"
                      />
                    </label>
                    <label className="flex flex-col text-xs font-bold uppercase tracking-widest text-ink-muted gap-1">
                      To
                      <input
                        id="watch-to"
                        type="date"
                        value={customTo}
                        min={customFrom}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium normal-case tracking-normal text-ink"
                      />
                    </label>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-sm font-bold text-ink">
                    {loading ? 'Loading…' : `${items.length} request${items.length === 1 ? '' : 's'} · ${prayedCount} prayed`}
                  </p>
                  <button
                    type="button"
                    onClick={() => void load()}
                    aria-label="Refresh the requests"
                    className="min-h-[44px] w-11 rounded-full border border-black/10 bg-white inline-flex items-center justify-center text-ink-muted"
                  >
                    <RefreshCcw size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    disabled={loading || items.length === 0}
                    className="min-h-[44px] px-4 rounded-full bg-burgundy text-white text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    <Printer size={16} aria-hidden /> Print
                  </button>
                </div>
              </div>
            )}

            {notice && (
              <p className="mt-3 rounded-xl bg-white border border-black/10 px-4 py-2.5 text-sm text-ink print:hidden" role="status">
                {notice}
              </p>
            )}

            <div id="prayer-watch-print" className="mt-4">
              <div className="hidden print:block mb-5">
                <p style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>{PAGE_TITLE}</p>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: '2px 0' }}>
                  {tab === 'praise' ? 'Praise reports' : 'Prayer requests'}
                </h1>
                <p style={{ fontSize: 12 }}>
                  {tab === 'praise' ? '' : `${rangeLabel} · `}For the meeting on {longFmt.format(nextMeeting)} · {items.length} item{items.length === 1 ? '' : 's'}
                </p>
              </div>

              {loading ? (
                <p className="flex items-center gap-2 text-sm text-ink-muted print:hidden">
                  <Loader2 size={16} className="animate-spin" aria-hidden /> Loading…
                </p>
              ) : error ? (
                <div className="rounded-2xl bg-white border border-burgundy/20 p-4 print:hidden" role="alert">
                  <p className="text-sm font-semibold text-burgundy">{error}</p>
                  <button type="button" onClick={() => void load()} className="mt-2 text-sm font-bold text-burgundy underline">
                    Try again
                  </button>
                </div>
              ) : items.length === 0 ? (
                <p className="rounded-2xl bg-white border border-black/10 p-5 text-sm text-ink-muted print:hidden">
                  {tab === 'praise'
                    ? 'No answered prayers yet. When the head of the Intercessors marks a request Answered, it shows here.'
                    : `No prayer requests for ${rangeLabel}. New ones appear here on their own.`}
                </p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {items.map((p, i) => (
                    <PrayerCard
                      key={p.id}
                      p={p}
                      index={i}
                      isNew={newIds.has(p.id)}
                      canLead={access.canLead}
                      busy={busyId === p.id}
                      praise={tab === 'praise'}
                      onMark={(action, value) => void onMark(p, action, value)}
                      onRemove={() => void onRemove(p)}
                    />
                  ))}
                </ol>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
};

export default IntercessorsPrayerWatchPage;
