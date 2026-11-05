import React, { useState, useEffect } from 'react';
import { Play, Share2, Clock, Loader2 } from 'lucide-react';
import {
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
  isYouTubeLiveUrl,
  resolveLatestVideoUrl,
} from '../lib/youtube';
import { YOUTUBE_CHANNEL_URL } from '../data';
import { fetchMemberHomeEvents } from '../lib/memberHomeData';
import { formatServiceWhen, nextScheduledSunday, pickNextService } from '../lib/nextService';

export const WatchLive: React.FC = () => {
  const [rawStreamUrl, setRawStreamUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  // Start from the regular Sunday schedule, then refine from the calendar.
  const [nextService, setNextService] = useState(() => nextScheduledSunday());

  useEffect(() => {
    let alive = true;
    fetchMemberHomeEvents({ limit: 12 })
      .then((events) => {
        if (alive) setNextService(pickNextService(events).startsAt);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    resolveLatestVideoUrl().then((url) => {
      if (!cancelled) {
        setRawStreamUrl(url);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const thumbnailUrl = getYouTubeThumbnailUrl(rawStreamUrl);
  const embedUrl = getYouTubeEmbedUrl(rawStreamUrl, true);
  const isLive = isYouTubeLiveUrl(rawStreamUrl);

  const handleShare = () => {
    if (!rawStreamUrl) return;
    if (navigator.share) {
      navigator.share({
        title: isLive ? 'Watch PLCC Live' : 'Watch PLCC Service',
        url: rawStreamUrl,
      });
    } else {
      navigator.clipboard.writeText(rawStreamUrl);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/5">
      <div className="relative aspect-video bg-gray-900">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/50 bg-gray-900/50 backdrop-blur-sm">
            <Loader2 className="animate-spin" size={32} />
            <p className="text-xs font-black uppercase tracking-[0.2em]">Loading video...</p>
          </div>
        ) : isPlaying ? (
          <>
            <iframe
              src={embedUrl}
              title="PLCC Service Video"
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
            {isLive && (
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                  <span className="text-xs font-bold text-white uppercase tracking-widest">Live</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => setIsPlaying(true)}
            className="absolute inset-0 w-full h-full group focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset"
            aria-label="Play latest service video"
          >
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt="Latest PLCC service video"
                className="w-full h-full object-cover opacity-80 group-hover:opacity-90 transition-opacity"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-burgundy-dark to-black" />
            )}
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 min-w-[64px] min-h-[64px] rounded-full bg-burgundy border-4 border-gold/40 flex items-center justify-center shadow-2xl group-hover:scale-110 group-active:scale-95 transition-transform">
                <Play size={28} fill="white" className="text-white ml-1" />
              </div>
              <span className="text-white text-xs font-black uppercase tracking-[0.2em] drop-shadow">
                Tap to Play
              </span>
            </div>
          </button>
        )}
      </div>

      <div className="p-5 bg-white space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[#1A1A1A] flex items-center gap-2">
            <Play size={16} fill="#1d372c" className="text-burgundy" />
            {isLive ? 'Watch Live' : 'Latest Message'}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              disabled={!rawStreamUrl}
              className="p-2 min-w-[44px] min-h-[44px] bg-gray-50 rounded-full text-gray-400 hover:text-burgundy transition-colors flex items-center justify-center disabled:opacity-40"
              aria-label="Share video"
            >
              <Share2 size={18} />
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-x-3 text-sm">
          <div className="flex items-center gap-2 text-gray-500">
            <Clock size={14} aria-hidden />
            <span>
              {isLive ? (
                <span className="font-bold text-red-700">Live now</span>
              ) : (
                <>
                  Next service: <span className="text-ink font-bold">{formatServiceWhen(nextService)}</span>
                </>
              )}
            </span>
          </div>
          <a
            href={YOUTUBE_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-burgundy font-bold hover:underline transition-all min-h-[44px] inline-flex items-center"
          >
            More videos
          </a>
        </div>
      </div>
    </div>
  );
};
