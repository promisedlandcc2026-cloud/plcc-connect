import { supabase } from './supabase';
import { LATEST_YOUTUBE_VIDEO, YOUTUBE_CHANNEL_ID } from '../data';

const CACHE_KEY = 'awc_latest_youtube_v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function getYouTubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|live\/))([^?&"'>]+)/);
  return match ? match[1] : null;
}

export function getYouTubeEmbedUrl(url: string, autoplay = false): string {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return url;
  return `https://www.youtube.com/embed/${videoId}?rel=0${autoplay ? '&autoplay=1' : ''}`;
}

export function getYouTubeThumbnailUrl(url: string): string {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return '';
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function isYouTubeLiveUrl(url: string): boolean {
  return /youtube\.com\/live\//.test(url);
}

function readCache(): string | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { url, expiresAt } = JSON.parse(raw) as { url: string; expiresAt: number };
    if (Date.now() > expiresAt) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function writeCache(url: string) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ url, expiresAt: Date.now() + CACHE_TTL_MS })
    );
  } catch {
    // ignore quota / private mode
  }
}

/** Pull the newest public upload from the PLCC YouTube channel RSS feed (no channel login needed). */
async function fetchLatestFromYouTubeChannel(): Promise<string | null> {
  try {
    const response = await fetch('/api/latest-youtube');
    if (!response.ok) return null;
    const data = (await response.json()) as { url?: string };
    return data.url ?? null;
  } catch (err) {
    console.error('Error fetching latest YouTube video:', err);
    return null;
  }
}

/**
 * Resolve which YouTube video to feature in Watch Service.
 * Priority: env override → auto-fetch from @khiireofficial → data.ts fallback → Supabase.
 */
export async function resolveLatestVideoUrl(): Promise<string> {
  const envUrl = import.meta.env.VITE_LATEST_YOUTUBE_URL?.trim();
  if (envUrl) return envUrl;

  const cached = readCache();
  if (cached) return cached;

  const fromChannel = await fetchLatestFromYouTubeChannel();
  if (fromChannel) {
    writeCache(fromChannel);
    return fromChannel;
  }

  if (LATEST_YOUTUBE_VIDEO.trim()) return LATEST_YOUTUBE_VIDEO.trim();

  try {
    const { data, error } = await supabase
      .from('videos')
      .select('url')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data?.url) return data.url;
  } catch (err) {
    console.error('Error fetching video from Supabase:', err);
  }

  return `https://www.youtube.com/channel/${YOUTUBE_CHANNEL_ID}`;
}
