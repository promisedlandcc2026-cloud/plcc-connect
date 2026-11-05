
import React from 'react';
import { X, ChevronRight, Calendar } from 'lucide-react';
import { AnnouncementImage } from './AnnouncementImage';

interface Announcement {
  id: string;
  title: string;
  date: string;
  description: string;
  imageUrl?: string;
}

interface AllAnnouncementsModuleProps {
  isOpen: boolean;
  onClose: () => void;
  announcements: Announcement[];
  onSelect: (announcement: Announcement) => void;
}

export const AllAnnouncementsModule: React.FC<AllAnnouncementsModuleProps> = ({
  isOpen,
  onClose,
  announcements,
  onSelect
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-eggshell">
      <div className="w-full h-full max-w-[500px] bg-white flex flex-col animate-in slide-in-from-bottom duration-500">
        {/* Header */}
        <div className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-bold text-[#1A1A1A]">All Updates</h2>
            <p className="text-xs text-burgundy font-bold uppercase tracking-[0.2em]">PLCC News & Media</p>
          </div>
          <button
            onClick={onClose}
            className="p-3 bg-gray-50 rounded-full text-gray-500 hover:text-black transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6 pb-32">
          {announcements.length > 0 ? (
            announcements.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelect(item)}
                className="group cursor-pointer"
              >
                <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-3 shadow-sm border border-gray-100">
                  <AnnouncementImage
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    fallbackClassName="w-full h-full bg-gray-50 flex items-center justify-center text-gray-200"
                    iconSize={40}
                  />
                  <div className="absolute top-3 left-3">
                    <span className="bg-burgundy text-white text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg">
                      {item.date}
                    </span>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-[#1A1A1A] group-hover:text-burgundy transition-colors flex items-center justify-between">
                  {item.title}
                  <ChevronRight size={18} className="text-gold" />
                </h3>
                <p className="text-sm text-gray-500 line-clamp-2 mt-1 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-500">
                <Calendar size={32} />
              </div>
              <div>
                <p className="font-bold text-[#1A1A1A]">No updates at this time</p>
                <p className="text-xs text-gray-500">Check back later for more church news.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
