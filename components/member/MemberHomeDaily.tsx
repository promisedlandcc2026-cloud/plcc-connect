import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight } from 'lucide-react';
import { TribesMark } from '../tribes/TribesMark';
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
      className="tribes-gold-card group relative block overflow-hidden rounded-[26px] bg-[#F4B23E] px-5 pb-5 pt-5 active:scale-[0.99] transition-transform motion-reduce:transition-none"
      aria-label={day ? `Today’s devotional: ${day.title}, ${day.ref}. Open Daily.` : 'Open today’s devotional'}
    >
      <TribesMark className="pointer-events-none absolute -bottom-7 -right-5 h-36 w-auto opacity-[0.14]" />
      <span className="relative flex items-center justify-between gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.2em]">Word for today</span>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1A120C]/10">
          <BookOpen size={18} aria-hidden />
        </span>
      </span>
      <span className="relative mt-3 block font-display text-[25px] font-bold leading-[1.12]">
        {day ? day.title : 'Start the day in the Word'}
      </span>
      <span className="relative mt-2 flex items-center justify-between gap-2 text-[13px] font-bold">
        <span className="truncate">{day ? `${day.ref} · About 4 minutes` : 'A short reading, a reflection, and a prayer'}</span>
        <ChevronRight size={20} className="shrink-0" aria-hidden />
      </span>
    </Link>
  );
};
