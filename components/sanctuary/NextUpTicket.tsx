/**
 * Sanctuary "Next up" ticket: the next gathering as a cream ticket with a
 * countdown ring, a tear line, "I'll be there" and Directions.
 * "I'll be there" saves to attendance_plans (see lib/attendancePlanClient).
 */
import React, { useEffect, useState } from 'react';
import { Check, MapPinned, Navigation, PlayCircle } from 'lucide-react';
import { CHURCH_INFO } from '../../data';
import { formatEventDateShort, formatEventTime } from '../../lib/memberHomeEvents';
import { formatServiceWhen } from '../../lib/nextService';
import { directionsUrl, type NextUp } from '../../lib/nextUp';
import { countdownTo, localDateKey, nextUpStartsAt, planKeyFor } from '../../lib/sanctuary';
import { fetchPlan, setPlan, type PlanState } from '../../lib/attendancePlanClient';
import { useNow } from '../../lib/useNow';
import { EventDetailModule } from '../EventDetailModule';
import { PlanVisitModule } from '../PlanVisitModule';
import { CountdownRing } from './CountdownRing';
import type { ChurchEvent } from '../../types';

type Props = {
  next: NextUp | null;
  liveUrl: string | null;
  /** Visitors get "Plan a visit" instead of "I'll be there" (which needs a member login). */
  visitor?: boolean;
};

export const NextUpTicket: React.FC<Props> = ({ next, liveUrl, visitor = false }) => {
  const now = useNow(30_000);
  const [selected, setSelected] = useState<ChurchEvent | null>(null);
  const [plan, setPlanState] = useState<PlanState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visitOpen, setVisitOpen] = useState(false);

  const planKey = next && !visitor ? planKeyFor(next, now) : null;

  useEffect(() => {
    if (!planKey) return;
    let alive = true;
    setPlanState(null);
    fetchPlan(planKey)
      .then((p) => alive && setPlanState(p))
      .catch(() => alive && setPlanState({ going: false, source: 'device' }));
    return () => {
      alive = false;
    };
  }, [planKey]);

  if (!next) {
    return <div className="h-[214px] rounded-[26px] bg-white/10 animate-pulse motion-reduce:animate-none" aria-hidden />;
  }

  const startsAt = nextUpStartsAt(next, now);
  const countdown = countdownTo(startsAt, now);
  const title = next.kind === 'event' ? next.event.title : next.title;
  const when =
    next.kind === 'event'
      ? `${formatEventDateShort(next.event.starts_at, next.event.date)} · ${formatEventTime(next.event.starts_at, next.event.time)}`
      : formatServiceWhen(startsAt, now);
  const where = next.kind === 'event' && next.event.location ? next.event.location : CHURCH_INFO.address.split(',')[0];
  const label = liveUrl ? 'Live now' : countdown.started ? 'Happening now' : 'Next up';
  const going = Boolean(plan?.going);

  const toggle = async () => {
    if (!planKey || saving) return;
    setSaving(true);
    setError(null);
    try {
      const nextState = await setPlan(
        {
          planKey,
          eventId: next.kind === 'event' ? String(next.event.id) : null,
          serviceDate: localDateKey(startsAt),
          title,
        },
        !going
      );
      setPlanState(nextState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save that.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section aria-labelledby="next-up-title" className="awc-ticket">
        <div className="awc-ticket__top flex items-start justify-between gap-3 px-5 pt-[18px] pb-3.5">
          <button
            type="button"
            disabled={next.kind !== 'event'}
            onClick={() => next.kind === 'event' && setSelected(next.event)}
            className="min-w-0 text-left disabled:cursor-default"
          >
            <span
              className={`block text-xs font-extrabold uppercase tracking-[0.12em] ${liveUrl ? 'text-red-700' : 'text-burgundy'}`}
            >
              {label}
            </span>
            <h2 id="next-up-title" className="mt-1 font-display text-[26px] leading-[1.1] font-bold text-ink">
              {title}
            </h2>
            <span className="mt-1.5 block text-sm font-semibold text-[#3B3F47]">{when}</span>
            <span className="mt-0.5 block text-sm text-[#5A606C]">{where}</span>
          </button>
          <CountdownRing countdown={countdown} />
        </div>

        <div className="awc-ticket__bottom">
          <div className="awc-ticket__tear" aria-hidden />

          <div className="grid grid-cols-2 gap-2.5 px-[18px] pt-3.5 pb-[18px]">
            {liveUrl ? (
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] rounded-2xl bg-red-700 text-white text-[15px] font-bold inline-flex items-center justify-center gap-1.5"
              >
                <PlayCircle size={17} aria-hidden /> Watch live
              </a>
            ) : visitor ? (
              <button
                type="button"
                onClick={() => setVisitOpen(true)}
                className="min-h-[48px] rounded-2xl bg-burgundy text-white text-[15px] font-bold inline-flex items-center justify-center gap-1.5"
              >
                <MapPinned size={17} aria-hidden /> Plan a visit
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void toggle()}
                disabled={saving || !plan}
                aria-pressed={going}
                className={`min-h-[48px] rounded-2xl text-[15px] font-bold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60 ${
                  going ? 'bg-white border-[1.5px] border-burgundy text-burgundy' : 'bg-burgundy text-white'
                }`}
              >
                {going ? (
                  <>
                    <Check size={17} strokeWidth={2.6} aria-hidden /> You’re going
    </>
              ) : (
                'I’ll be there'
              )}
            </button>
          )}
          <a
            href={directionsUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[48px] rounded-2xl border-[1.5px] border-burgundy/25 text-burgundy text-[15px] font-bold inline-flex items-center justify-center gap-1.5"
          >
            <Navigation size={16} aria-hidden /> Directions
          </a>
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {going ? `You’re going to ${title}.` : ''}
        </p>
        {error ? (
          <p role="alert" className="px-5 pb-4 -mt-2 text-xs font-semibold text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </section>
    {/* Outside the ticket: its drop-shadow filter would trap a fixed overlay. */}
    <EventDetailModule event={selected} isOpen={Boolean(selected)} onClose={() => setSelected(null)} />
    {visitor ? <PlanVisitModule isOpen={visitOpen} onClose={() => setVisitOpen(false)} /> : null}
    </>
  );
};
