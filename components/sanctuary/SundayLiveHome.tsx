/**
 * Sunday, service is live: Home becomes the in-service view — live pill,
 * stream card, "I'm here" (room-code check-in), "My notes", and the order of
 * service with the current part highlighted (from Vault's run of show).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, PenLine, Play, ScanLine } from 'lucide-react';
import { YOUTUBE_CHANNEL_URL } from '../../data';
import { getYouTubeThumbnailUrl } from '../../lib/youtube';
import { fetchOrderOfService, typicalOrder, type OrderOfService } from '../../lib/orderOfServiceClient';
import { currentStepIndex, formatStepTime } from '../../lib/sanctuary';
import { fetchMemberHomeLatestSermon, type HomeSermonPreview } from '../../lib/memberHomeData';
import { notesNewPath, startContextFromSermonPreview } from '../../lib/sermonNotesUi';
import { SCAN_IN_ROUTE } from '../../lib/checkinPointsClient';
import { prefetchNotesChunks } from '../../lib/prefetchMemberChunks';
import { useNow } from '../../lib/useNow';
import { useScreenWakeLock } from '../../lib/useScreenWakeLock';

type Props = {
  title: string;
  startsAt: Date;
  /** Calendar event id for the service, when Vault has one (run of show). */
  eventId: string | null;
  liveUrl: string | null;
};

export const SundayLiveHome: React.FC<Props> = ({ title, startsAt, eventId, liveUrl }) => {
  const now = useNow(60_000);
  // In-service view: keep the screen on while the member follows along.
  useScreenWakeLock(true);
  const [order, setOrder] = useState<OrderOfService>(typicalOrder);
  const [sermon, setSermon] = useState<HomeSermonPreview | null>(null);

  const startMs = startsAt.getTime();

  useEffect(() => {
    let alive = true;
    fetchOrderOfService(eventId, new Date(startMs))
      .then((o) => alive && setOrder(o))
      .catch(() => undefined);
    fetchMemberHomeLatestSermon()
      .then((s) => alive && setSermon(s))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [eventId, startMs]);

  const current = useMemo(() => currentStepIndex(order.steps, now), [order, now]);
  const started = now.getTime() >= startsAt.getTime();
  const watchHref = liveUrl || `${YOUTUBE_CHANNEL_URL}/live`;
  const thumb = liveUrl ? getYouTubeThumbnailUrl(liveUrl) : '';
  const nowTitle = current >= 0 ? order.steps[current].title : null;

  return (
    <div className="space-y-5">
      <div>
        <p className="inline-flex items-center gap-2 h-9 rounded-full border border-red-400/50 bg-red-600/15 px-3.5 text-[13px] font-extrabold tracking-[0.08em] text-cream">
          <span className="awc-live-dot h-[9px] w-[9px] rounded-full bg-red-500" aria-hidden />
          {liveUrl ? 'LIVE NOW' : started ? 'IN SERVICE' : 'STARTING SOON'}
        </p>
        <p className="mt-4 text-sm font-medium text-cream/80">
          {title} · {started ? 'started' : 'starts'} {formatStepTime(startsAt)}
        </p>
        <h1 className="mt-1.5 font-display text-[38px] leading-[1.05] font-bold text-cream">
          Welcome to <span className="italic text-leaf">service.</span>
        </h1>
      </div>

      <section
        aria-label="Live stream"
        className="relative h-[196px] overflow-hidden rounded-3xl border border-[#F2D98A]/30 bg-gradient-to-br from-wine to-[#0E0205] shadow-[0_20px_44px_rgba(0,0,0,0.45)]"
      >
        {thumb ? <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" /> : null}
        <a
          href={watchHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Watch the service on YouTube"
          className="absolute left-1/2 top-1/2 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#F2D98A] bg-burgundy/90 text-white"
        >
          <Play size={28} fill="currentColor" aria-hidden />
        </a>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/75 to-transparent px-4 py-3">
          <span className="text-sm font-bold">Watch on YouTube</span>
          {nowTitle ? <span className="truncate text-[13px] font-semibold text-cream/85">{nowTitle}</span> : null}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        <Link
          to={SCAN_IN_ROUTE}
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-[18px] bg-leaf text-[15px] font-extrabold text-wine"
        >
          <ScanLine size={18} aria-hidden /> I’m here
        </Link>
        <Link
          to={notesNewPath(startContextFromSermonPreview(sermon))}
          onFocus={prefetchNotesChunks}
          onTouchStart={prefetchNotesChunks}
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-[18px] border border-[#F2D98A]/40 bg-white/[0.06] text-[15px] font-bold text-cream"
        >
          <PenLine size={18} aria-hidden /> My notes
        </Link>
      </div>

      <section aria-labelledby="order-of-service-title">
        <h2 id="order-of-service-title" className="mx-1 mb-2.5 text-[15px] font-bold text-cream/90">
          Order of service
        </h2>
        <ol className="flex flex-col gap-1.5">
          {order.steps.map((step, i) => {
            const isNow = i === current;
            const done = current >= 0 && i < current;
            if (isNow) {
              return (
                <li
                  key={step.id}
                  aria-current="step"
                  className="flex items-center gap-3 rounded-2xl bg-cream p-3 text-ink shadow-[0_10px_24px_rgba(0,0,0,0.3)]"
                >
                  <span className="h-[18px] w-[18px] shrink-0 rounded-full bg-burgundy shadow-[0_0_0_4px_rgba(29, 55, 44,0.18)]" aria-hidden />
                  {step.timeLabel ? <span className="w-[68px] shrink-0 text-[13px] font-bold text-burgundy">{step.timeLabel}</span> : null}
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[15px] font-extrabold">{step.title}</span>
                    <span className="text-xs font-semibold text-[#5A606C]">Happening now</span>
                  </span>
                </li>
              );
            }
            return (
              <li
                key={step.id}
                className={`flex items-center gap-3 rounded-[14px] px-3 py-2 ${done ? 'text-cream/75' : 'text-cream'}`}
              >
                {done ? (
                  <Check size={18} strokeWidth={2.4} className="shrink-0 text-leaf" aria-label="Done" />
                ) : (
                  <span className="h-[18px] w-[18px] shrink-0 rounded-full border-2 border-cream/55" aria-hidden />
                )}
                {step.timeLabel ? <span className="w-[68px] shrink-0 text-[13px] font-semibold">{step.timeLabel}</span> : null}
                <span className="text-sm">{step.title}</span>
              </li>
            );
          })}
        </ol>
        {!order.fromVault ? (
          <p className="mx-1 mt-2 text-xs text-cream/70">Our usual Sunday order. Times appear when the team posts today’s run of show.</p>
        ) : null}
      </section>
    </div>
  );
};
