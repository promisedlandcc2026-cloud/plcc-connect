
import React, { useState, useEffect } from 'react';
import { Bell, ChevronRight, Loader2 } from 'lucide-react';
import { AllAnnouncementsModule } from './AllAnnouncementsModule';
import { AnnouncementDetailModule } from './AnnouncementDetailModule';
import { AnnouncementImage } from './AnnouncementImage';
import { ANNOUNCEMENTS as FALLBACK_ANNOUNCEMENTS } from '../data';
import { fetchMemberHomeAnnouncements } from '../lib/memberHomeData';

export const Announcements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllView, setShowAllView] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const rows = await fetchMemberHomeAnnouncements({ limit: 20 });
      setAnnouncements(
        rows.map((r) => ({
          id: r.id,
          title: r.title,
          content: r.summary,
          description: r.summary,
          created_at: r.raw.created_at,
          event_date: r.raw.event_date,
          date: r.dateLabel,
          image_url: r.imageUrl,
          imageUrl: r.imageUrl,
        }))
      );
    } catch (err) {
      console.error('Error fetching announcements:', err);
      setAnnouncements(FALLBACK_ANNOUNCEMENTS);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-bold text-[#1A1A1A] flex items-center gap-2">
          <Bell size={20} className="text-burgundy" /> Announcements
        </h2>
        <div className="flex items-center gap-4">
          {loading && <Loader2 size={16} className="animate-spin text-gray-500" />}
          <button
            onClick={() => setShowAllView(true)}
            className="text-xs font-bold text-burgundy uppercase tracking-widest flex items-center gap-1 transition-transform active:translate-x-1"
          >
            View All <ChevronRight size={12} />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {announcements.slice(0, 2).map(item => {
          const displayDate = item.event_date
            ? new Date(item.event_date).toLocaleDateString()
            : new Date(item.created_at).toLocaleDateString();

          const displayDescription = item.content || item.description || '';
          const displayImage = item.image_url || item.imageUrl;

          return (
            <div
              key={item.id}
              onClick={() => setSelectedAnnouncement({
                ...item,
                date: displayDate,
                description: displayDescription,
                imageUrl: displayImage
              })}
              className="bg-white rounded-3xl overflow-hidden border border-gray-50 shadow-sm transition-all active:scale-[0.98] cursor-pointer hover:border-burgundy/20"
            >
              <AnnouncementImage src={displayImage} alt={item.title} />
              <div className="p-5">
                <span className="text-xs font-bold text-gold uppercase tracking-widest">{displayDate}</span>
                <h3 className="font-bold text-[#1A1A1A] text-base mt-1 mb-2 leading-tight">{item.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{displayDescription}</p>
              </div>
            </div>
          );
        })}
        {!loading && announcements.length === 0 && (
          <p className="text-xs text-center text-gray-500 py-4">No recent announcements.</p>
        )}
      </div>

      <AllAnnouncementsModule
        isOpen={showAllView}
        onClose={() => setShowAllView(false)}
        announcements={announcements.map(item => ({
          ...item,
          date: item.event_date
            ? new Date(item.event_date).toLocaleDateString()
            : new Date(item.created_at).toLocaleDateString(),
          description: item.content || item.description || '',
          imageUrl: item.image_url || item.imageUrl
        }))}
        onSelect={(item) => {
          setSelectedAnnouncement(item);
          setShowAllView(false);
        }}
      />

      <AnnouncementDetailModule
        announcement={selectedAnnouncement}
        onClose={() => setSelectedAnnouncement(null)}
      />
    </div>
  );
};
