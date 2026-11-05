import React, { useEffect, useState } from 'react';
import { AnnouncementDetailModule } from '../AnnouncementDetailModule';
import { MemberHomeSection } from './MemberHomeSection';
import { ErrorState, LoadingState } from '../ui/States';
import {
  fetchMemberHomeAnnouncements,
  type HomeAnnouncement,
} from '../../lib/memberHomeData';
import { truncateText } from '../../lib/memberHomeEvents';
import type { Announcement } from '../../types';

export const MemberHomeAnnouncements: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<HomeAnnouncement[]>([]);
  const [selected, setSelected] = useState<Announcement | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchMemberHomeAnnouncements({ limit: 3 }));
    } catch {
      setError('Could not load announcements.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (!loading && !error && items.length === 0) {
    return <section id="announcements" className="scroll-mt-24 sr-only" aria-hidden />;
  }

  return (
    <MemberHomeSection id="announcements" title="Announcements">
      {loading ? <LoadingState message="Loading announcements…" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() =>
                  setSelected({
                    id: item.id,
                    title: item.title,
                    description: item.summary,
                    date: item.dateLabel,
                    imageUrl: item.imageUrl || undefined,
                  })
                }
                className="w-full text-left rounded-2xl border border-gray-100 bg-white p-4 shadow-sm active:scale-[0.99] transition-transform"
              >
                {item.dateLabel ? (
                  <p className="text-xs font-semibold text-ink-muted mb-1">
                    {item.dateLabel}
                  </p>
                ) : null}
                <p className="text-sm font-bold text-[#1A1A1A]">{item.title}</p>
                {item.summary ? (
                  <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                    {truncateText(item.summary, 120)}
                  </p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <AnnouncementDetailModule
        announcement={selected}
        onClose={() => setSelected(null)}
      />
    </MemberHomeSection>
  );
};
