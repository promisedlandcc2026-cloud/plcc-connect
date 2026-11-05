/**
 * Phase 2.7D.10 — Member personal attendance & family check-in history.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { MemberPageHeader } from '../components/member/MemberPageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import {
  fetchMyAttendanceHistory,
  fetchMyChildrenCustodyHistory,
  type MyAttendanceItem,
  type MyCustodyItem,
} from '../lib/attendanceHistoryClient';
import { cardInitials } from '../lib/memberCardUi';

function formatClock(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function formatDayLabel(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const today = new Date();
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((startOf(today) - startOf(d)) / 86_400_000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function sessionTypeLabel(type: string): string {
  const t = (type || '').trim().toLowerCase();
  if (!t || t === 'session') return 'Session';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function ChildAvatar({ name }: { name: string }) {
  return (
    <div
      className="h-11 w-11 rounded-2xl bg-burgundy/5 text-burgundy border border-burgundy/10 flex items-center justify-center text-xs font-black shrink-0"
      aria-hidden
    >
      {cardInitials(name)}
    </div>
  );
}

export const MemberAttendanceHistoryPage: React.FC = () => {
  const [mine, setMine] = useState<MyAttendanceItem[]>([]);
  const [family, setFamily] = useState<MyCustodyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, c] = await Promise.all([
        fetchMyAttendanceHistory(40),
        fetchMyChildrenCustodyHistory(40),
      ]);
      setMine(a);
      setFamily(c);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not load history.';
      setError(message);
      setMine([]);
      setFamily([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="flex-1 px-5 pt-10 pb-28 max-w-[500px] w-full mx-auto">
      <MemberPageHeader
        title="My Attendance"
        eyebrow="Check-in history"
        subtitle="Your session check-ins, and your children’s session or Kids Check-In times."
        backTo="/account"
        backLabel="Account"
      />

      {loading ? <LoadingState message="Loading attendance…" /> : null}

      {!loading && error ? (
        <ErrorState message={error} onRetry={() => void load()} retryLabel="Retry" />
      ) : null}

      {!loading && !error ? (
        <div className="space-y-8">
          <section aria-labelledby="my-checkins-heading" className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarCheck size={16} className="text-gold shrink-0" aria-hidden />
              <h2 id="my-checkins-heading" className="text-sm font-black text-[#1A1A1A]">
                You
              </h2>
            </div>

            {mine.length === 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-white px-4 py-2 shadow-sm">
                <EmptyState
                  message="No check-ins yet"
                  hint="When you scan your PLCC card at a session, it will show up here."
                />
              </div>
            ) : (
              <ul className="space-y-2">
                {mine.map((row, i) => {
                  const isLatest = i === 0;
                  return (
                    <li key={`${row.checkedInAt}-${i}`}>
                      <article className="rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-burgundy truncate">{row.sessionTitle}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {sessionTypeLabel(row.sessionType)}
                              {' · '}
                              {formatDayLabel(row.checkedInAt)}
                              {' · '}
                              {formatClock(row.checkedInAt)}
                            </p>
                          </div>
                          {isLatest ? (
                            <span className="shrink-0 text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1">
                              Checked in
                            </span>
                          ) : null}
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="children-checkins-heading" className="space-y-3">
            <div className="space-y-1">
              <h2 id="children-checkins-heading" className="text-sm font-black text-[#1A1A1A]">
                Your children
              </h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                Session scans and Kids Check-In both appear here.
              </p>
            </div>

            {family.length === 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-white px-4 py-2 shadow-sm">
                <EmptyState
                  message="No children’s check-ins yet"
                  hint="After a child is checked in with their card or at Kids Check-In, you’ll see it here."
                />
              </div>
            ) : (
              <ul className="space-y-2">
                {family.map((row, i) => {
                  const isKids = row.kind === 'custody';
                  const open = isKids && row.isOpen;
                  return (
                    <li key={`${row.kind}-${row.checkedInAt}-${i}`}>
                      <article className="rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm">
                        <div className="flex items-start gap-3">
                          <ChildAvatar name={row.childDisplayName} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-bold text-burgundy truncate">
                                {row.childDisplayName}
                              </p>
                              <span
                                className={
                                  open
                                    ? 'shrink-0 text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1'
                                    : 'shrink-0 text-xs font-black uppercase tracking-widest text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1'
                                }
                              >
                                {isKids ? (open ? 'Kids · In' : 'Kids Check-In') : 'Session'}
                              </span>
                            </div>
                            <p className="text-[13px] text-gray-700 mt-0.5 truncate">
                              {row.sessionTitle}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {open
                                ? `Still checked in · since ${formatDayLabel(row.checkedInAt)} ${formatClock(row.checkedInAt)}`
                                : isKids && row.checkedOutAt
                                  ? `In ${formatClock(row.checkedInAt)} · Out ${formatClock(row.checkedOutAt)} · ${formatDayLabel(row.checkedInAt)}`
                                  : `${formatDayLabel(row.checkedInAt)} · ${formatClock(row.checkedInAt)}`}
                            </p>
                          </div>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
};

export default MemberAttendanceHistoryPage;
