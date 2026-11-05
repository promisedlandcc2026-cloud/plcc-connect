import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BellRing,
  BookOpen,
  Check,
  ChevronLeft,
  Clock,
  Minus,
  Moon,
  Play,
  Plus,
  RotateCcw,
  Square,
  Sun,
  SunMedium,
  Tv,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button, ButtonLink } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { goToHomeSection } from '../lib/homeSectionNav';
import { readAloud, speechSupported, type Reading } from '../lib/bibleSpeech';
import { getAlertsState, turnOnAlerts, updateAlertTopics, type AlertsState, type AlertTopic } from '../lib/phoneAlerts';
import {
  DAILY_TEXT_SIZES,
  PLAN_DAYS,
  PLAN_TITLE,
  addDays,
  bibleLink,
  dayParts,
  fetchDailyWeek,
  kjvTextFor,
  localToday,
  pauseDaysThisWeek,
  pausesOn,
  paragraphs,
  planDaysDone,
  psalmPreview,
  psalmsForDay,
  readPlan,
  readTextSize,
  restartPlan,
  saveTextSize,
  togglePause,
  togglePsalm,
  type DailyDay,
  type DailyWeek,
  type Pause,
  type PlanState,
} from '../lib/dailyClient';

/**
 * Daily — a short devotional, the Psalms reading plan, and three small pauses,
 * for the week between Sundays. (Private journaling lives in Sermon Notes.)
 */

const KICKER = 'text-xs font-black uppercase tracking-[0.18em] text-gold-ink';
const H2 = 'font-display text-[24px] leading-tight font-bold text-ink';

function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning.';
  if (h < 17) return 'Good afternoon.';
  return 'Good evening.';
}

/* ---------------- devotional ---------------- */

const DevotionalCard: React.FC<{
  week: DailyWeek;
  today: string;
  selected: string;
  onSelect: (day: string) => void;
}> = ({ week, today, selected, onSelect }) => {
  const day = week.days.find((d) => d.day === selected) || week.days[0];
  const [verse, setVerse] = useState<string | null>(day.verseText);
  const [size, setSize] = useState(readTextSize);
  const [speaking, setSpeaking] = useState(false);
  const reading = useRef<Reading | null>(null);
  const paras = useMemo(() => paragraphs(day.body), [day.body]);

  useEffect(() => {
    let alive = true;
    setVerse(day.verseText);
    if (!day.verseText) void kjvTextFor(day.ref).then((t) => alive && setVerse(t));
    return () => {
      alive = false;
    };
  }, [day.day, day.ref, day.verseText]);

  const stop = useCallback(() => {
    reading.current?.stop();
    reading.current = null;
    setSpeaking(false);
  }, []);
  useEffect(() => stop, [stop, day.day]);

  const listen = () => {
    if (speaking) return stop();
    const parts = [verse ? `${verse} ${day.ref}.` : `${day.ref}.`, ...paras, day.prayer ? `A prayer for today. ${day.prayer}` : ''].filter(Boolean);
    setSpeaking(true);
    reading.current = readAloud(
      `${day.title}.`,
      parts.map((text, i) => ({ n: i + 1, text })),
      0,
      () => {},
      () => {
        reading.current = null;
        setSpeaking(false);
      }
    );
  };

  const resize = (dir: 1 | -1) => {
    const next = Math.min(DAILY_TEXT_SIZES.length - 1, Math.max(0, size + dir));
    setSize(next);
    saveTextSize(next);
  };

  const isToday = day.day === today;
  const label = isToday ? 'Today’s devotional' : `${dayParts(day.day).long.split(',')[0]}’s devotional`;
  const fontSize = DAILY_TEXT_SIZES[size];

  return (
    <Card as="section" padding="none" className="overflow-hidden" aria-labelledby="daily-devo-title">
      <div className="p-4 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={KICKER}>{label}</p>
          <h2 id="daily-devo-title" className={`${H2} mt-1`}>
            {day.title}
          </h2>
        </div>
        <div className="flex gap-1.5 shrink-0" role="group" aria-label="Reading text size">
          <button
            type="button"
            onClick={() => resize(-1)}
            disabled={size === 0}
            aria-label="Smaller reading text"
            className="h-11 w-11 rounded-xl border border-gray-200 bg-white text-ink flex items-center justify-center disabled:opacity-40"
          >
            <Minus size={16} aria-hidden />
            <span className="text-[13px] font-bold">A</span>
          </button>
          <button
            type="button"
            onClick={() => resize(1)}
            disabled={size === DAILY_TEXT_SIZES.length - 1}
            aria-label="Larger reading text"
            className="h-11 w-11 rounded-xl border border-gray-200 bg-white text-ink flex items-center justify-center disabled:opacity-40"
          >
            <Plus size={16} aria-hidden />
            <span className="text-[17px] font-bold">A</span>
          </button>
        </div>
      </div>

      {/* Mon–Sun */}
      <div className="px-3 pb-3 grid grid-cols-7 gap-1" role="group" aria-label="Choose a day this week">
        {week.days.map((d) => {
          const p = dayParts(d.day);
          const active = d.day === day.day;
          const isT = d.day === today;
          return (
            <button
              key={d.day}
              type="button"
              aria-pressed={active}
              aria-label={`${p.long}${isT ? ' (today)' : ''}`}
              onClick={() => onSelect(d.day)}
              className={`flex flex-col items-center justify-center rounded-xl min-h-[58px] py-1.5 transition-colors ${
                active ? 'bg-burgundy text-white shadow-sm' : 'bg-cream text-ink'
              }`}
            >
              <span className={`text-[11px] font-bold uppercase tracking-wide ${active ? 'text-white/80' : 'text-ink-muted'}`}>{p.dow}</span>
              <span className="text-[18px] font-bold leading-none mt-0.5">{p.num}</span>
              <span className={`mt-1 h-1.5 w-1.5 rounded-full ${isT ? (active ? 'bg-[#F2D98A]' : 'bg-gold') : 'bg-transparent'}`} aria-hidden />
            </button>
          );
        })}
      </div>

      <div className="px-4 pb-4 space-y-4">
        <figure className="rounded-2xl bg-[#FBF5E6] border border-gold/25 px-4 py-4">
          <blockquote className="font-display text-ink leading-snug" style={{ fontSize: fontSize + 3 }}>
            {verse ? `“${verse}”` : <span className="text-ink-muted text-[15px]">Loading the verse…</span>}
          </blockquote>
          <figcaption className="mt-2 text-sm font-bold text-gold-ink">
            <Link to={bibleLink(day.ref)} className="underline underline-offset-4 decoration-gold/50">
              {day.ref}
            </Link>
            {day.verseText ? '' : ' · KJV'}
          </figcaption>
        </figure>

        <div className="space-y-3 text-ink leading-relaxed" style={{ fontSize }}>
          {paras.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {day.question ? (
          <div className="rounded-2xl bg-cream px-4 py-3.5">
            <p className={KICKER}>Carry this with you</p>
            <p className="mt-1.5 text-ink leading-relaxed" style={{ fontSize }}>
              {day.question}
            </p>
          </div>
        ) : null}

        {day.prayer ? (
          <div className="rounded-2xl bg-cream px-4 py-3.5">
            <p className={KICKER}>A prayer for today</p>
            <p className="mt-1.5 font-display italic text-ink leading-relaxed" style={{ fontSize: fontSize + 1 }}>
              {day.prayer}
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 pt-1">
          {speechSupported() ? (
            <Button size="lg" fullWidth onClick={listen}>
              {speaking ? <Square size={18} aria-hidden /> : <Play size={18} aria-hidden />}
              {speaking ? 'Stop listening' : 'Listen'}
            </Button>
          ) : null}
          <ButtonLink to={bibleLink(day.ref)} variant="secondary" size="lg" fullWidth>
            <BookOpen size={18} aria-hidden />
            Read the whole chapter
          </ButtonLink>
        </div>
      </div>
    </Card>
  );
};

/* ---------------- reading plan ---------------- */

const ReadingPlanCard: React.FC<{ today: string }> = ({ today }) => {
  const [plan, setPlan] = useState<PlanState>(() => readPlan(today));
  const [previews, setPreviews] = useState<Record<number, { firstLine: string; minutes: number }>>({});
  const psalms = psalmsForDay(plan.day);

  useEffect(() => {
    let alive = true;
    void Promise.all(psalms.map(async (n) => [n, await psalmPreview(n)] as const)).then((rows) => {
      if (!alive) return;
      const next: Record<number, { firstLine: string; minutes: number }> = {};
      for (const [n, p] of rows) if (p) next[n] = p;
      setPreviews(next);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.day]);

  const doneDays = planDaysDone(plan);
  const pct = Math.round((doneDays / PLAN_DAYS) * 100);
  const doneToday = plan.done.length;
  const finishedToday = Boolean(plan.finishedOn);

  let status: React.ReactNode;
  if (plan.complete) {
    status = (
      <>
        <strong>You read all 150 Psalms. Well done!</strong> Start again any time.
      </>
    );
  } else if (finishedToday) {
    status = (
      <>
        <strong>Day {plan.day} complete — well done.</strong> Tomorrow opens with Psalm {psalms[4] + 1}.
      </>
    );
  } else if (doneToday > 0) {
    status = (
      <>
        <strong>
          {doneToday} of 5 read today.
        </strong>{' '}
        Finish when you can — the plan waits for you.
      </>
    );
  } else {
    status = (
      <>
        <strong>Missed a day?</strong> Pick up right here — the plan moves with you, no catching up required.
      </>
    );
  }

  return (
    <Card as="section" aria-labelledby="daily-plan-title" className="space-y-3">
      <div>
        <p className={KICKER}>Reading plan</p>
        <h2 id="daily-plan-title" className={`${H2} mt-1`}>
          {PLAN_TITLE}
        </h2>
        <p className="mt-1 text-[15px] text-ink-muted">
          Day {plan.day} of {PLAN_DAYS} · Five psalms a day. Tap the circle when you finish one.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="h-2.5 flex-1 rounded-full bg-cream overflow-hidden"
          role="progressbar"
          aria-label="Reading plan progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <span className="block h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm font-bold text-ink tabular-nums">
          {doneDays} of {PLAN_DAYS} days
        </span>
      </div>

      <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
        {psalms.map((n) => {
          const done = plan.done.includes(n);
          const prev = previews[n];
          return (
            <li key={n} className="flex items-center gap-2 pr-2">
              <button
                type="button"
                aria-pressed={done}
                aria-label={`${done ? 'Mark as not read' : 'Mark as read'}: Psalm ${n}`}
                onClick={() => setPlan(togglePsalm(n, today))}
                className="h-14 w-14 shrink-0 flex items-center justify-center"
              >
                <span
                  className={`h-8 w-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                    done ? 'bg-burgundy border-burgundy text-white' : 'border-gray-300 text-transparent'
                  }`}
                >
                  <Check size={18} strokeWidth={3} aria-hidden />
                </span>
              </button>
              <Link to={bibleLink(`Psalm ${n}`)} className="flex-1 min-w-0 py-3">
                <span className={`block text-[16px] font-bold ${done ? 'text-ink-muted line-through decoration-1' : 'text-ink'}`}>Psalm {n}</span>
                {prev ? <span className="block text-sm text-ink-muted truncate">“{prev.firstLine}”</span> : null}
              </Link>
              {prev ? <span className="text-xs font-semibold text-ink-muted shrink-0">{prev.minutes} min</span> : null}
            </li>
          );
        })}
      </ul>

      <p className="text-[15px] text-ink-muted leading-relaxed">{status}</p>
      {plan.complete ? (
        <Button variant="secondary" fullWidth onClick={() => setPlan(restartPlan())}>
          <RotateCcw size={16} aria-hidden /> Start the Psalms again
        </Button>
      ) : null}
    </Card>
  );
};

/* ---------------- this week ---------------- */

const ThisWeekCard: React.FC<{ week: DailyWeek; today: string; selected: string; onSelect: (day: string) => void }> = ({
  week,
  today,
  selected,
  onSelect,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <Card as="section" aria-labelledby="daily-week-title" className="space-y-3">
      <div>
        <p className={KICKER}>{week.seriesTitle ? 'Following Sunday’s message' : 'All seven days'}</p>
        <h2 id="daily-week-title" className={`${H2} mt-1`}>
          {week.seriesTitle ? `This week: “${week.seriesTitle}”` : 'This week’s readings'}
        </h2>
        <p className="mt-1 text-[15px] text-ink-muted">Tap a day to read it.</p>
      </div>
      <ul className="space-y-1.5">
        {week.days.map((d: DailyDay) => {
          const p = dayParts(d.day);
          const active = d.day === selected;
          return (
            <li key={d.day}>
              <button
                type="button"
                onClick={() => {
                  onSelect(d.day);
                  document.getElementById('daily-devo-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 min-h-[56px] text-left ${active ? 'bg-burgundy/[0.07] ring-1 ring-burgundy/20' : 'bg-cream'}`}
              >
                <span className="w-11 shrink-0 text-center">
                  <span className="block text-[11px] font-bold uppercase text-ink-muted">{p.dow}</span>
                  <span className="block text-[18px] font-bold text-ink leading-none">{p.num}</span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-bold text-ink truncate">{d.title}</span>
                  <span className="block text-sm text-ink-muted truncate">
                    {d.ref}
                    {d.day === today ? ' · today' : ''}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Button variant="secondary" fullWidth onClick={() => goToHomeSection(location.pathname, navigate, 'watch-live')}>
        <Tv size={18} aria-hidden /> Watch last Sunday’s message
      </Button>
    </Card>
  );
};

/* ---------------- three small pauses ---------------- */

const PAUSE_COPY: Record<Pause, { time: string; title: string; text: string; icon: React.ReactNode }> = {
  morning: { time: 'Morning', title: 'Verse before phone', text: 'Read today’s verse before messages, news, or social media.', icon: <SunMedium size={20} aria-hidden /> },
  midday: { time: 'Midday', title: 'Two-minute prayer pause', text: 'Stop once — thank God for one thing, and pray for one person by name.', icon: <Sun size={20} aria-hidden /> },
  evening: { time: 'Evening', title: 'One line of gratitude', text: 'Before you sleep, thank God for one thing from today.', icon: <Moon size={20} aria-hidden /> },
};

const PausesCard: React.FC<{ today: string; monday: string }> = ({ today, monday }) => {
  const [done, setDone] = useState<Pause[]>(() => pausesOn(today));
  const week = pauseDaysThisWeek(monday, today);
  const n = done.length;
  const line =
    n === 3
      ? 'All three pauses done today. See you tomorrow morning.'
      : n > 0
        ? `${n} of 3 done today. Small and steady counts.`
        : 'Miss a day and you simply begin again tomorrow.';

  return (
    <Card as="section" aria-labelledby="daily-pauses-title" className="space-y-3">
      <div>
        <p className={KICKER}>Weekday rhythm</p>
        <h2 id="daily-pauses-title" className={`${H2} mt-1`}>
          Three small pauses
        </h2>
        <p className="mt-1 text-[15px] text-ink-muted">Simple habits that fit a real day. Tap Done as you go.</p>
      </div>
      <ul className="space-y-2">
        {(['morning', 'midday', 'evening'] as Pause[]).map((p) => {
          const c = PAUSE_COPY[p];
          const on = done.includes(p);
          return (
            <li key={p} className="flex items-center gap-3 rounded-2xl bg-cream px-3 py-3">
              <span className="h-10 w-10 shrink-0 rounded-xl bg-white text-gold-ink flex items-center justify-center">{c.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted">{c.time}</span>
                <span className="block text-[16px] font-bold text-ink">{c.title}</span>
                <span className="block text-sm text-ink-muted leading-snug">{c.text}</span>
              </span>
              <button
                type="button"
                aria-pressed={on}
                aria-label={`${c.title}: ${on ? 'done' : 'mark done'}`}
                onClick={() => setDone(togglePause(today, p))}
                className={`shrink-0 min-h-[44px] min-w-[76px] rounded-xl px-3 text-sm font-bold transition-colors ${
                  on ? 'bg-burgundy text-white' : 'bg-white border border-gray-200 text-ink'
                }`}
              >
                {on ? (
                  <span className="inline-flex items-center gap-1">
                    <Check size={16} strokeWidth={3} aria-hidden /> Done
                  </span>
                ) : (
                  'Done'
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[15px] text-ink-muted leading-relaxed" role="status">
        <strong className="text-ink">
          {week.withPause} of {week.daysSoFar} day{week.daysSoFar === 1 ? '' : 's'} this week.
        </strong>{' '}
        {line}
      </p>
    </Card>
  );
};

/* ---------------- morning reminder ---------------- */

const ReminderCard: React.FC = () => {
  const { user } = useAuth();
  const [state, setState] = useState<AlertsState | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    void getAlertsState()
      .then(setState)
      .catch(() => setState({ kind: 'not-set-up' }));
  }, [user]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  let control: React.ReactNode = null;
  if (state?.kind === 'on') {
    const on = state.topics.includes('daily');
    control = (
      <Button
        size="lg"
        fullWidth
        variant={on ? 'secondary' : 'primary'}
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const next = new Set<AlertTopic>(state.topics);
            if (on) next.delete('daily');
            else next.add('daily');
            const s = await updateAlertTopics([...next]);
            setState(s);
            setNote({ ok: true, text: on ? 'Morning reminder is off.' : 'Done. We’ll remind you at 7 AM.' });
          })
        }
      >
        <BellRing size={18} aria-hidden />
        {on ? 'Turn off the 7 AM reminder' : 'Remind me at 7 AM'}
      </Button>
    );
  } else if (state?.kind === 'off') {
    control = (
      <Button
        size="lg"
        fullWidth
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const s = await turnOnAlerts(['church', 'prayer', 'community', 'daily']);
            setState(s);
            if (s.kind === 'on') setNote({ ok: true, text: 'Done. We’ll remind you at 7 AM.' });
          })
        }
      >
        <BellRing size={18} aria-hidden />
        {busy ? 'Turning on…' : 'Remind me at 7 AM'}
      </Button>
    );
  } else if (state?.kind === 'needs-install') {
    control = (
      <ButtonLink to="/install" size="lg" fullWidth>
        Add Connect to your Home Screen first
      </ButtonLink>
    );
  } else if (state?.kind === 'blocked') {
    control = (
      <p className="text-[15px] text-[#F3EAD8]">
        Alerts are blocked for PLCC Connect. Turn on notifications for it in your phone’s <b>Settings</b>, then come back here.
      </p>
    );
  }

  const isOn = state?.kind === 'on' && state.topics.includes('daily');

  return (
    <section
      aria-labelledby="daily-reminder-title"
      className="rounded-3xl bg-[#101815] text-[#F3EAD8] px-5 py-6 space-y-4 shadow-[0_12px_30px_rgba(8, 15, 12,0.25)]"
    >
      <p className="font-display text-[21px] leading-snug text-white">
        “Thy word is a lamp unto my feet, and a light unto my path.”
        <span className="block mt-1.5 text-sm font-sans font-bold text-[#E2C67E]">Psalm 119:105 · KJV</span>
      </p>
      <div>
        <h2 id="daily-reminder-title" className="text-[16px] font-bold text-white flex items-center gap-2">
          <Clock size={16} aria-hidden className="text-[#E2C67E]" />
          {isOn ? 'Your morning reminder is on' : 'Start tomorrow at 7 AM'}
        </h2>
        <p className="mt-1 text-[15px] text-[#E8DCC4]">
          {isOn ? 'Each morning at 7 you’ll get a gentle alert with the day’s devotional.' : 'Get a gentle alert each morning with the day’s devotional.'}
        </p>
      </div>
      {control}
      {note ? (
        <p role="status" className={`text-sm font-semibold ${note.ok ? 'text-[#BFE5C8]' : 'text-[#FFC9C9]'}`}>
          {note.text}
        </p>
      ) : null}
    </section>
  );
};

/* ---------------- page ---------------- */

export const MemberDailyPage: React.FC = () => {
  const today = useMemo(() => localToday(), []);
  const [week, setWeek] = useState<DailyWeek | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(today);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    fetchDailyWeek(today)
      .then((w) => {
        if (!alive) return;
        setWeek(w);
        if (!w.days.some((d) => d.day === today)) setSelected(w.days[0]?.day || today);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not load today’s devotional.'));
    return () => {
      alive = false;
    };
  }, [today, attempt]);

  const todayDevo = week?.days.find((d) => d.day === today);
  const monday = week?.monday || addDays(today, -((new Date(`${today}T12:00:00`).getDay() + 6) % 7));

  return (
    <div className="awc-home-shell">
      <header className="px-5 pt-4">
        <Link to="/" className="inline-flex items-center gap-1 -ml-2 rounded-xl pl-1 pr-3 min-h-[44px] text-[15px] font-semibold text-[#F2D98A]">
          <ChevronLeft size={22} aria-hidden /> Home
        </Link>
        <div className="relative mt-2 overflow-hidden rounded-[26px] border border-white/10 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
          <img
            src="/images/daily-hero.webp"
            alt="An open Bible and a warm mug on a wooden table in early morning light"
            className="h-[300px] w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0e1512]/10 via-[#0e1512]/55 to-[#0e1512]/95" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#E2C67E]">{dayParts(today).long}</p>
            <h1 className="mt-1.5 font-display text-[30px] leading-[1.1] font-bold text-white">
              {greeting()} Start the day in the Word.
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-[13px] font-semibold text-[#F3EAD8]">
                <Clock size={14} aria-hidden /> About 4 minutes
              </span>
              {todayDevo ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-[13px] font-semibold text-[#F3EAD8]">
                  <BookOpen size={14} aria-hidden /> {todayDevo.ref.replace(/:.*$/, '')}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="relative mt-7 bg-cream text-ink rounded-t-[30px] px-5 pt-5 space-y-6 pb-[calc(8.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(0,0,0,0.22)]">
        <div className="mx-auto h-1 w-10 rounded-full bg-[#D8CCBF]" aria-hidden />

        {error ? (
          <Card className="space-y-3" role="alert">
            <p className="text-[16px] text-ink">{error}</p>
            <Button variant="subtle" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          </Card>
        ) : !week ? (
          <Card className="h-64 animate-pulse" aria-label="Loading today’s devotional">
            <span className="sr-only">Loading today’s devotional…</span>
          </Card>
        ) : (
          <DevotionalCard week={week} today={today} selected={selected} onSelect={setSelected} />
        )}

        <ReadingPlanCard today={today} />

        {week ? <ThisWeekCard week={week} today={today} selected={selected} onSelect={setSelected} /> : null}

        <PausesCard today={today} monday={monday} />

        <ReminderCard />
      </main>
    </div>
  );
};

export default MemberDailyPage;
