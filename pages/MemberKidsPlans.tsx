/**
 * Read-only Kids Plans archive — Connect bridge to Vault kids-plans.
 * Upload/delete stay in Vault Events → Kids Plans.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { MemberPageHeader } from '../components/member/MemberPageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { fetchKidsPlans } from '../lib/kidsPlansClient';
import { KidsPlansError, type KidsPlan } from '../lib/kidsPlansTypes';

function formatServiceDate(isoDate: string): string {
  if (!isoDate) return '';
  try {
    const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
    return d.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

function fileKindLabel(contentType: string | null, fileName: string | null): string {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('pdf') || (fileName || '').toLowerCase().endsWith('.pdf')) return 'PDF';
  if (ct.startsWith('image/')) return 'Image';
  return 'File';
}

export const MemberKidsPlansPage: React.FC = () => {
  const currentYear = String(new Date().getFullYear());
  const [year, setYear] = useState(currentYear);
  const [classroom, setClassroom] = useState('');
  const [plans, setPlans] = useState<KidsPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const yearOptions = useMemo(() => {
    const y = Number(currentYear);
    return [String(y), String(y - 1), String(y - 2)];
  }, [currentYear]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const rows = await fetchKidsPlans({
        year: year.trim() || undefined,
        classroom: classroom.trim() || undefined,
      });
      setPlans(rows);
    } catch (err: unknown) {
      setPlans([]);
      if (err instanceof KidsPlansError && err.code === 'forbidden') {
        setForbidden(true);
        setError(err.message);
      } else {
        const message =
          err instanceof Error ? err.message : 'Could not load Kids Plans.';
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [year, classroom]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="flex-1 px-5 pt-10 pb-28 max-w-[500px] w-full mx-auto">
      <MemberPageHeader
        title="Kids Plans"
        eyebrow="Classroom archive"
        subtitle="Sunday classroom plans from kids ministry. Tap a plan to open the image or PDF."
        backTo="/me"
        backLabel="Me"
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 min-w-0">
          <span className="block text-xs font-black uppercase tracking-widest text-burgundy/70 mb-1.5">
            Year
          </span>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-[#1A1A1A]"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-[1.4] min-w-0">
          <span className="block text-xs font-black uppercase tracking-widest text-burgundy/70 mb-1.5">
            Classroom
          </span>
          <input
            type="search"
            value={classroom}
            onChange={(e) => setClassroom(e.target.value)}
            placeholder="All classrooms"
            maxLength={80}
            className="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-[#1A1A1A] placeholder:text-gray-400"
          />
        </label>
      </div>

      <div className="mt-6">
        {loading ? <LoadingState message="Loading Kids Plans…" /> : null}

        {!loading && error ? (
          forbidden ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-5 space-y-2">
              <p className="text-sm font-bold text-burgundy">Access needed</p>
              <p className="text-sm text-gray-600 leading-relaxed">{error}</p>
            </div>
          ) : (
            <ErrorState message={error} onRetry={() => void load()} retryLabel="Retry" />
          )
        ) : null}

        {!loading && !error && plans.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white px-4 py-2 shadow-sm">
            <EmptyState
              message="No plans for this filter"
              hint="Try another year or classroom, or ask kids ministry whether a plan has been posted."
            />
          </div>
        ) : null}

        {!loading && !error && plans.length > 0 ? (
          <ul className="space-y-3">
            {plans.map((plan) => {
              const title = plan.title || plan.fileName || 'Classroom plan';
              const kind = fileKindLabel(plan.contentType, plan.fileName);
              const canOpen = Boolean(plan.signedUrl);
              return (
                <li key={plan.id}>
                  <article className="rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div
                        className="h-10 w-10 rounded-xl bg-burgundy/5 text-burgundy border border-burgundy/10 flex items-center justify-center shrink-0"
                        aria-hidden
                      >
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-burgundy truncate">{title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatServiceDate(plan.serviceDate)}
                          {' · '}
                          {plan.classroom}
                          {' · '}
                          {kind}
                        </p>
                        {plan.notes ? (
                          <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">
                            {plan.notes}
                          </p>
                        ) : null}
                        {canOpen ? (
                          <a
                            href={plan.signedUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-3 min-h-[40px] px-3 rounded-xl bg-burgundy text-white text-xs font-bold"
                          >
                            Open
                            <ExternalLink size={14} aria-hidden />
                          </a>
                        ) : (
                          <p className="text-xs text-gray-500 mt-2">
                            File preview is not available for this plan.
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </main>
  );
};
