import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Images, Play } from 'lucide-react';
import { MemberPageHeader } from '../components/member/MemberPageHeader';
import { EmptyState, ErrorState, SkeletonRows } from '../components/ui/States';
import { GalleryLightbox } from '../components/gallery/GalleryLightbox';
import { LEAH_GALLERY_URL, loadGallery, type GalleryFeed, type GalleryItem } from '../lib/galleryClient';

type Filter = 'all' | 'leah' | 'church' | 'video';
const PAGE = 30;

/**
 * Gallery — the same photos and videos as the church website's Gallery:
 * Leah's photography (updates when she adds photos), church moments and videos.
 */
export const MemberGalleryPage: React.FC = () => {
  const [feed, setFeed] = useState<GalleryFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(() => {
    setError(null);
    loadGallery()
      .then(setFeed)
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filters: { key: Filter; label: string; count: number }[] = feed
    ? [
        { key: 'all', label: 'All', count: feed.leah.length + feed.church.length + feed.videos.length },
        { key: 'leah', label: 'By Leah', count: feed.leah.length },
        { key: 'church', label: 'Church moments', count: feed.church.length },
        { key: 'video', label: 'Videos', count: feed.videos.length },
      ]
    : [];

  const showVideoRow = filter === 'all' && (feed?.videos.length ?? 0) > 0;
  const wall = useMemo<GalleryItem[]>(() => {
    if (!feed) return [];
    if (filter === 'leah') return feed.leah;
    if (filter === 'church') return feed.church;
    if (filter === 'video') return feed.videos;
    return [...feed.leah, ...feed.church];
  }, [feed, filter]);

  // The viewer pages through exactly what's on screen, in on-screen order.
  const viewerItems = useMemo(() => (showVideoRow && feed ? [...feed.videos, ...wall] : wall), [showVideoRow, feed, wall]);
  const offset = showVideoRow && feed ? feed.videos.length : 0;
  const visible = wall.slice(0, shown);

  const choose = (f: Filter) => {
    setFilter(f);
    setShown(PAGE);
  };

  return (
    <main className="flex-1 px-5 pt-10 pb-40">
      <MemberPageHeader title="Gallery" eyebrow="Church life" subtitle="Worship, fellowship and family at PLCC." backTo="/me" backLabel="Me" />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !feed ? (
        <SkeletonRows rows={6} />
      ) : (
        <>
          <div role="tablist" aria-label="Filter gallery" className="-mx-5 px-5 mb-5 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filters.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => choose(f.key)}
                  className={`shrink-0 h-10 px-4 rounded-full text-[14px] font-bold border transition-colors ${
                    active ? 'bg-burgundy border-burgundy text-white' : 'bg-white border-gray-200 text-ink'
                  }`}
                >
                  {f.label}
                  <span className={`ml-1.5 text-[12px] tabular-nums ${active ? 'text-white/75' : 'text-ink-soft'}`}>{f.count}</span>
                </button>
              );
            })}
          </div>

          {showVideoRow ? (
            <section aria-labelledby="gallery-videos" className="mb-7">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 id="gallery-videos" className="text-[17px] font-extrabold text-ink">
                  Videos
                </h2>
                <button type="button" onClick={() => choose('video')} className="text-sm font-semibold text-burgundy">
                  See all {feed.videos.length}
                </button>
              </div>
              <div className="-mx-5 px-5 scroll-px-5 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {feed.videos.map((v, i) => (
                  <VideoCard key={v.id} item={v} onOpen={() => setOpen(i)} className="w-[220px] shrink-0 snap-start" />
                ))}
              </div>
            </section>
          ) : null}

          {showVideoRow ? <h2 className="mb-3 text-[17px] font-extrabold text-ink">Photos</h2> : null}

          {wall.length === 0 ? (
            <EmptyState icon={Images} message="No photos here yet" hint="New church photos appear here as soon as they’re added to the website." />
          ) : filter === 'video' ? (
            <div className="grid grid-cols-1 gap-4">
              {visible.map((v, i) => (
                <VideoCard key={v.id} item={v} onOpen={() => setOpen(offset + i)} />
              ))}
            </div>
          ) : (
            <div className="columns-2 gap-2">
              {visible.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setOpen(offset + i)}
                  className="mb-2 block w-full break-inside-avoid overflow-hidden rounded-xl bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  style={{ aspectRatio: p.width && p.height ? `${p.width} / ${p.height}` : '4 / 5' }}
                  aria-label={p.credit ? `Open photo by ${p.credit.name}` : `Open ${p.title}`}
                >
                  <img src={p.thumbnail || p.url} alt={p.credit ? '' : p.description || p.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {wall.length > visible.length ? (
            <div className="mt-6 flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE)}
                className="h-12 px-7 rounded-2xl bg-burgundy text-white text-[15px] font-bold active:bg-burgundy-dark"
              >
                Show more photos
              </button>
              <p className="text-xs text-ink-soft tabular-nums">
                Showing {visible.length} of {wall.length}
              </p>
            </div>
          ) : null}

          {feed.leah.length > 0 && filter !== 'video' && filter !== 'church' ? (
            <p className="mt-6 text-center text-[13px] text-ink-soft">
              Photography by Leah.{' '}
              <a href={LEAH_GALLERY_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-burgundy underline underline-offset-4">
                See her full collection
              </a>
            </p>
          ) : null}
        </>
      )}

      <GalleryLightbox items={viewerItems} index={open} onIndexChange={setOpen} />
    </main>
  );
};

const VideoCard: React.FC<{ item: GalleryItem; onOpen: () => void; className?: string }> = ({ item, onOpen, className = '' }) => (
  <button type="button" onClick={onOpen} className={`text-left focus:outline-none group ${className}`} aria-label={`Play video: ${item.title}`}>
    <span className="relative block aspect-video overflow-hidden rounded-xl bg-wine group-focus-visible:ring-2 group-focus-visible:ring-gold">
      {item.thumbnail ? <img src={item.thumbnail} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : null}
      <span className="absolute left-2.5 bottom-2.5 h-9 w-9 rounded-full bg-white text-burgundy inline-flex items-center justify-center shadow">
        <Play size={14} fill="currentColor" className="ml-0.5" aria-hidden />
      </span>
    </span>
    <span className="mt-1.5 block text-[14px] font-bold text-ink leading-snug">{item.title}</span>
    {item.description ? <span className="block text-[13px] text-ink-soft line-clamp-1">{item.description}</span> : null}
  </button>
);
