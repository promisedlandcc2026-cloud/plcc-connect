import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { PrayerModule } from '../PrayerModule';
import { MemberHomeSection } from './MemberHomeSection';
import { ErrorState, LoadingState } from '../ui/States';
import { fetchMemberHomePrayers, type HomePrayerPreview } from '../../lib/memberHomeData';
import { truncateText } from '../../lib/memberHomeEvents';

export const MemberHomePrayer: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prayers, setPrayers] = useState<HomePrayerPreview[]>([]);
  const [submitOpen, setSubmitOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setPrayers(await fetchMemberHomePrayers({ limit: 2 }));
    } catch {
      setError('Could not load prayer requests.');
      setPrayers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <MemberHomeSection
      id="prayer-wall"
      title="Prayer"
      action={{ to: '/prayer', label: 'Prayer wall' }}
    >
      {loading ? <LoadingState message="Loading prayer…" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error
        ? prayers.map((prayer) => (
            <div
              key={prayer.id}
              className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-1"
            >
              <p className="text-xs font-black uppercase tracking-widest text-gray-500">
                {prayer.memberName}
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">
                {truncateText(prayer.content, 140)}
              </p>
            </div>
          ))
        : null}
      <button
        type="button"
        onClick={() => setSubmitOpen(true)}
        className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-2xl bg-burgundy text-white text-sm font-bold"
      >
        <Heart size={16} aria-hidden />
        Submit Prayer Request
      </button>
      <PrayerModule isOpen={submitOpen} onClose={() => { setSubmitOpen(false); void load(); }} />
    </MemberHomeSection>
  );
};
