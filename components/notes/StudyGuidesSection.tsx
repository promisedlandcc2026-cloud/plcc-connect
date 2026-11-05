/**
 * "From PLCC" — sermon study guides the church published in RhemaNotes
 * (the same list as Sermon Notes in PLCC Canaan). Sits above My notes.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenText, ChevronRight } from 'lucide-react';
import { fetchStudyGuides, formatGuideDate, type StudyGuideCard } from '../../lib/studyGuidesClient';
import { ErrorState, LoadingState } from '../ui/States';

export const StudyGuidesSection: React.FC = () => {
  const [guides, setGuides] = useState<StudyGuideCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setGuides(null);
    try {
      setGuides(await fetchStudyGuides());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sermon study guides are temporarily unavailable.');
      setGuides([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section aria-labelledby="study-guides-title" className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="study-guides-title" className="font-display text-[22px] font-bold text-ink">
          From PLCC
        </h2>
        <span className="text-xs font-semibold text-ink-soft">Sermon study guides</span>
      </div>

      {guides === null ? <LoadingState message="Loading sermon study guides…" /> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!error && guides && guides.length === 0 ? (
        <p className="rounded-2xl border border-[#EEE5DA] bg-white p-4 text-sm text-ink-muted">
          Study guides for each message will appear here when the church publishes them.
        </p>
      ) : null}

      {guides && guides.length > 0 ? (
        <ul className="space-y-2.5">
          {guides.map((g) => (
            <li key={g.id}>
              <Link
                to={`/notes/guide/${g.shareToken}`}
                className="flex items-start gap-3 rounded-2xl border border-[#EEE5DA] bg-white p-4 shadow-[0_6px_18px_rgba(26,26,26,0.04)] active:scale-[0.99] transition-transform motion-reduce:transition-none"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-burgundy text-[#F2D98A]">
                  <BookOpenText size={20} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold leading-snug text-ink">{g.title}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-ink-soft">
                    {[g.speaker, formatGuideDate(g.publishedAt)].filter(Boolean).join(' · ')}
                  </span>
                  {g.theme ? <span className="mt-1 block text-[13px] font-semibold text-burgundy">{g.theme}</span> : null}
                  {g.dayCount ? (
                    <span className="mt-1.5 inline-block rounded-full bg-[#F7EFD9] px-2.5 py-0.5 text-xs font-bold text-gold-ink">
                      {g.dayCount}-day study guide
                    </span>
                  ) : null}
                </span>
                <ChevronRight size={18} className="mt-3 shrink-0 text-ink-soft" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};
