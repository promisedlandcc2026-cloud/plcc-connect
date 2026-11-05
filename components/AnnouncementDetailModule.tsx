
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Share2, ArrowLeft } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  date: string;
  description: string;
  imageUrl?: string;
}

interface AnnouncementDetailModuleProps {
  announcement: Announcement | null;
  onClose: () => void;
}

export const AnnouncementDetailModule: React.FC<AnnouncementDetailModuleProps> = ({
  announcement,
  onClose
}) => {
  const [failedForId, setFailedForId] = useState<string | null>(null);

  if (!announcement) return null;

  const showImage = Boolean(
    announcement.imageUrl && failedForId !== announcement.id
  );

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: announcement.title,
        text: announcement.description,
        url: window.location.href,
      });
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-white">
      <div className="w-full h-full max-w-[500px] flex flex-col animate-in fade-in slide-in-from-right duration-300 overflow-y-auto no-scrollbar pb-20">
        {/* Sticky Top Bar */}
        <div className="fixed top-0 left-0 right-0 max-w-[500px] mx-auto z-20 px-4 pt-12 pb-4 flex items-center justify-between pointer-events-none">
          <button
            onClick={onClose}
            className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full shadow-lg flex items-center justify-center text-[#1A1A1A] pointer-events-auto active:scale-95 transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <button
            onClick={handleShare}
            className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full shadow-lg flex items-center justify-center text-[#1A1A1A] pointer-events-auto active:scale-95 transition-all"
          >
            <Share2 size={20} />
          </button>
        </div>

        {/* Image Header */}
        <div className="relative w-full min-h-[300px] max-h-[65vh] bg-[#1A1A1A] shrink-0 flex items-center justify-center overflow-hidden">
          {showImage ? (
            <>
              <img
                src={announcement.imageUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-20 scale-110"
                onError={() => setFailedForId(announcement.id)}
              />
              <img
                src={announcement.imageUrl}
                alt={announcement.title}
                className="relative z-10 max-w-full max-h-full object-contain shadow-2xl"
                onError={() => setFailedForId(announcement.id)}
              />
            </>
          ) : (
            <div className="w-full h-full min-h-[300px] flex items-center justify-center text-gray-200 bg-[#1A1A1A]">
              <span className="text-4xl font-black opacity-10">PLCC</span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent z-20"></div>
        </div>

        {/* Content */}
        <div className="bg-white -mt-12 rounded-t-[40px] relative z-10 p-8 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-gold/10 text-burgundy px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
              <Calendar size={12} />
              {announcement.date}
            </div>
          </div>

          <h1 className="text-3xl font-bold text-[#1A1A1A] leading-tight mb-6">
            {announcement.title}
          </h1>

          <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed space-y-4">
            {(announcement.description || '').split('\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          {/* Call to Action */}
          <div className="mt-12 pt-8 border-t border-gray-100">
            <button
              onClick={onClose}
              className="w-full h-14 bg-burgundy text-white rounded-2xl font-bold shadow-xl shadow-burgundy/20 active:scale-95 transition-all"
            >
              Back to Feed
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
