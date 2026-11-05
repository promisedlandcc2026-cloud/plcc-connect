import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, HandHeart } from 'lucide-react';
import { PrayerWall } from '../components/PrayerWall';
import { MemberPageHeader } from '../components/member/MemberPageHeader';
import { fetchIntercessorsAccess } from '../lib/intercessorsClient';

/** Shows the Intercessors' Prayer List link only to people who can open it. */
const IntercessorsLink: React.FC = () => {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetchIntercessorsAccess()
      .then((a) => alive && a.allowed && setName(a.ministryName || 'Intercessor Channel'))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  if (!name) return null;
  return (
    <Link
      to="/intercessors"
      className="mb-6 flex items-center gap-3 rounded-2xl bg-white border border-burgundy/15 p-4 shadow-sm"
    >
      <span className="w-10 h-10 rounded-xl bg-burgundy flex items-center justify-center shrink-0">
        <HandHeart size={20} className="text-gold" aria-hidden />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-[#1A1A1A]">Intercessors Prayer Watch</span>
        <span className="block text-xs text-gray-500">{name} · Live Huddle and every prayer request, side by side</span>
      </span>
      <ChevronRight size={18} className="text-gray-400" aria-hidden />
    </Link>
  );
};

/** Member Prayer destination — reuses existing PrayerWall + shared prayer_requests data. */
export const MemberPrayerPage: React.FC = () => (
  <main className="flex-1 px-5 pt-10 pb-28">
    <MemberPageHeader
      title="Prayer"
      subtitle="Share a request, or stand in agreement with others."
    />
    <IntercessorsLink />
    <PrayerWall />
  </main>
);
