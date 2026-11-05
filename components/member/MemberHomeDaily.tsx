import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight } from 'lucide-react';
import { fetchDailyWeek, localToday, type DailyDay } from '../../lib/dailyClient';

/** Home: today's devotional at a glance — opens the Daily page. */
export const MemberHomeDaily: React.FC = () => {
  const [day, setDay] = useState<DailyDay | null>(null);

  useEffect(() => {
    let alive = true;
    const today = localToday();
    fetchDailyWeek(today)
      .then((w) => alive && setDay(w.days.find((d) => d.day === today) || null))
      .catch(() => alive && setDay(null));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Link
      to="/daily"
      className="group flex items-center gap-4 rounded-2xl bg-white border border-gray-100 shadow-card px-4 py-4 min-h-[84px] active:scale-[0.99] transition-transform"
      aria-label={day ? `Today’s devotional: ${day.title}, ${day.ref}. Open Daily.` : 'Open today’s devotional'}
    >
      <span className="h-12 w-12 shrink-0 rounded-2xl bg-burgundy text-[#F2D98A] flex items-center justify-center">
        <BookOpen size={22} aria-hidden />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-black uppercase tracking-[0.18em] text-gold-ink">Today’s devotional</span>
        <span className="block font-display text-[19px] leading-tight font-bold text-ink truncate">
          {day ? day.title : 'Start the day in the Word'}
        </span>
        <span className="block text-sm text-ink-muted truncate">{day ? `${day.ref} · About 4 minutes` : 'A short reading, a reflection, and a prayer'}</span>
      </span>
      <ChevronRight size={22} className="text-ink-soft shrink-0" aria-hidden />
    </Link>
  );
};
