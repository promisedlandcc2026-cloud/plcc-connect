/**
 * One sermon study guide (RhemaNotes via Vault): message overview, key points,
 * scripture, the weekday plan by day, and "Take notes on this message".
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, Maximize2, PenLine, Quote, X } from 'lucide-react';
import { MemberPageHeader } from '../components/member/MemberPageHeader';
import { ErrorState, LoadingState } from '../components/ui/States';
import { buttonClass } from '../components/ui/Button';
import { fetchStudyGuide, formatGuideDate, type StudyGuide, type StudyGuideDay } from '../lib/studyGuidesClient';

const List: React.FC<{ title: string; items: string[] }> = ({ title, items }) => {
  const rows = items.map((i) => i.trim()).filter(Boolean);
  if (!rows.length) return null;
  return (
    <section className="mt-7">
      <h2 className="mb-2.5 text-xs font-extrabold uppercase tracking-[0.14em] text-gold-ink">{title}</h2>
      <ul className="space-y-2">
        {rows.map((item, i) => (
          <li key={`${title}-${i}`} className="flex gap-2.5 text-[15px] leading-relaxed text-ink">
            <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-burgundy" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

const DayPanel: React.FC<{ day: StudyGuideDay }> = ({ day }) => {
  const blocks: Array<[string, string]> = [
    ['Scripture', [day.scriptureReference, day.scriptureText].filter(Boolean).join('\n\n')],
    ['Observation', day.observation],
    ['Application', day.application],
    ['Prayer', day.prayer],
    ['Challenge', day.challenge],
    ['Group discussion', day.groupDiscussion],
  ];
  return (
    <div className="space-y-4 rounded-2xl border border-[#EEE5DA] bg-white p-4">
      <h3 className="font-display text-xl font-bold text-ink">
        Day {day.dayNumber}
        {day.title ? `: ${day.title}` : ''}
      </h3>
      {blocks
        .filter(([, t]) => t.trim())
        .map(([label, text]) => (
          <div key={label}>
            <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.12em] text-burgundy">{label}</p>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{text}</p>
          </div>
        ))}
    </div>
  );
};

export const MemberStudyGuidePage: React.FC = () => {
  const { token = '' } = useParams<{ token: string }>();
  const [guide, setGuide] = useState<StudyGuide | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dayNumber, setDayNumber] = useState(1);

  const load = async () => {
    setError(null);
    setGuide(null);
    try {
      const g = await fetchStudyGuide(token);
      setGuide(g);
      setDayNumber(g.days[0]?.dayNumber || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That study guide is not available.');
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const day = guide?.days.find((d) => d.dayNumber === dayNumber) || guide?.days[0] || null;
  const verse = guide ? [guide.keyVerseReference, guide.keyVerse].filter(Boolean).join(' — ') : '';

  return (
    <main className="flex-1 px-5 pt-10 pb-28">
      <MemberPageHeader
        title={guide?.title || 'Study guide'}
        eyebrow="Sermon study guide"
        subtitle={guide ? [guide.speaker, formatGuideDate(guide.publishedAt)].filter(Boolean).join(' · ') || undefined : undefined}
        backTo="/notes"
        backLabel="Notes"
      />

      {!guide && !error ? <LoadingState message="Opening study guide…" /> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {guide ? (
        <article>
          {guide.coverUrl ? (
            <GuideImage src={guide.coverUrl} title={guide.title} />
          ) : null}
          {verse ? (
            <p className="flex items-start gap-2 rounded-2xl bg-wine p-4 text-[15px] font-semibold leading-relaxed text-cream">
              <Quote size={16} className="mt-1 shrink-0 text-leaf" aria-hidden />
              {verse}
            </p>
          ) : null}
          {guide.theme ? <p className="mt-4 text-[15px] font-semibold text-burgundy">{guide.theme}</p> : null}

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <Link
              to={`/notes/new?${new URLSearchParams({ source: 'manual', title: `Notes — ${guide.title}`.slice(0, 200) })}`}
              className={buttonClass({ className: 'w-full' })}
            >
              <PenLine size={17} aria-hidden /> Take notes
            </Link>
            {guide.shareUrl ? (
              <a
                href={guide.shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass({ variant: 'secondary', className: 'w-full' })}
              >
                RhemaNotes <ExternalLink size={15} aria-hidden />
              </a>
            ) : null}
          </div>

          {guide.summary ? (
            <section className="mt-7">
              <h2 className="mb-2.5 text-xs font-extrabold uppercase tracking-[0.14em] text-gold-ink">Summary</h2>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{guide.summary}</p>
            </section>
          ) : null}
          {guide.centralMessage ? (
            <section className="mt-7">
              <h2 className="mb-2.5 text-xs font-extrabold uppercase tracking-[0.14em] text-gold-ink">Central message</h2>
              <p className="font-display text-xl font-bold leading-snug text-ink">{guide.centralMessage}</p>
            </section>
          ) : null}
          <List title="Key points" items={guide.keyPoints} />
          <List title="Scripture" items={guide.scriptures.map((s) => [s.reference, s.note].filter(Boolean).join(' — '))} />

          {guide.days.length ? (
            <section className="mt-7">
              <h2 className="mb-2.5 text-xs font-extrabold uppercase tracking-[0.14em] text-gold-ink">Weekday study plan</h2>
              <div className="no-scrollbar -mx-5 mb-3 flex gap-2 overflow-x-auto px-5" role="tablist" aria-label="Days">
                {guide.days.map((d) => {
                  const active = day?.dayNumber === d.dayNumber;
                  return (
                    <button
                      key={d.dayNumber}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setDayNumber(d.dayNumber)}
                      className={`min-h-[44px] shrink-0 rounded-full px-4 text-sm font-bold ${
                        active ? 'bg-burgundy text-white' : 'border border-burgundy/20 bg-white text-burgundy'
                      }`}
                    >
                      Day {d.dayNumber}
                    </button>
                  );
                })}
              </div>
              {day ? <DayPanel day={day} /> : null}
            </section>
          ) : null}

          <List title="Apply it" items={guide.applications} />
          <List title="Pray" items={guide.prayers} />
          <List title="Reflect" items={guide.reflections} />
          <List title="Quotes" items={guide.quotes} />
        </article>
      ) : null}
    </main>
  );
};

/* Shows the whole image (no cropping) and opens it full screen when tapped. */
function GuideImage({ src, title }: { src: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (failed) return null;
  const alt = title ? `Image for ${title}` : 'Study guide image';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="View full image"
        className="group relative mb-5 block w-full overflow-hidden rounded-2xl border border-[#EEE5DA] bg-[#F4EEE6] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A35A]/40"
      >
        <img
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          className="mx-auto block h-auto max-h-[75vh] w-full object-contain"
        />
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[13px] font-medium text-white opacity-90 group-hover:opacity-100">
          <Maximize2 size={14} aria-hidden="true" />
          Tap to enlarge
        </span>
      </button>

      {open
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={alt}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 p-3 md:p-8"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close image"
                autoFocus
                className="absolute right-3 top-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50 md:right-5 md:top-5"
              >
                <X size={24} />
              </button>
              <img
                src={src}
                alt={alt}
                onClick={(e) => e.stopPropagation()}
                className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
              />
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-[14px] font-medium text-white hover:bg-white/25 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
              >
                Open original
                <ExternalLink size={14} />
              </a>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
