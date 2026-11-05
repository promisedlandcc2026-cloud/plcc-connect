/**
 * Home shortcuts — Sanctuary glass rows (2 × 4) on the wine shell: routes,
 * scrolls, sign-in-gated links, and the Give modal.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpenText,
  ChevronRight,
  BookUser,
  Calendar,
  Church,
  HandHeart,
  Heart,
  Images,
  Megaphone,
  PlaySquare,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { GiveModule } from '../GiveModule';
import { rememberReturnTo } from '../../lib/authReturnPath';
import {
  prefetchBibleChunk,
  prefetchCommunityChunks,
  prefetchGalleryChunk,
} from '../../lib/prefetchMemberChunks';

/** PLCC has no Ark yet. To show it, set VITE_ARK_ENABLED=true in Vercel. */
const ARK_ENABLED = import.meta.env.VITE_ARK_ENABLED === 'true';

type HubVariant = 'member' | 'public';

type HubTile =
  | { kind: 'route'; to: string; label: string; icon: LucideIcon; onPrefetch?: () => void; wide?: boolean }
  | { kind: 'scroll'; sectionId: string; label: string; icon: LucideIcon }
  | { kind: 'modal'; modal: 'give'; label: string; icon: LucideIcon }
  /** PLCC Ark: its own site at /ark, opened with a full page load (same sign-in). */
  | { kind: 'ark'; label: string }
  | {
      kind: 'auth';
      to: string;
      returnTo: string;
      label: string;
      icon: LucideIcon;
    };

type HomeHubGridProps = {
  variant?: HubVariant;
};

const MEMBER_TILES: HubTile[] = [
  { kind: 'route', to: '/bible', label: 'Bible', icon: BookOpenText, onPrefetch: prefetchBibleChunk, wide: true },
  ...(ARK_ENABLED ? [{ kind: 'ark' as const, label: 'PLCC Ark' }] : []),
  { kind: 'scroll', sectionId: 'announcements', label: 'Announcements', icon: Megaphone },
  { kind: 'route', to: '/events', label: 'Events', icon: Calendar },
  { kind: 'scroll', sectionId: 'watch-live', label: 'Watch Live', icon: PlaySquare },
  { kind: 'modal', modal: 'give', label: 'Give', icon: Heart },
  { kind: 'route', to: '/prayer', label: 'Prayer Request', icon: HandHeart },
  {
    kind: 'route',
    to: '/community',
    label: 'Community',
    icon: Users,
    onPrefetch: prefetchCommunityChunks,
  },
  { kind: 'route', to: '/ministries', label: 'Ministries', icon: Church },
  { kind: 'route', to: '/directory', label: 'Directory', icon: BookUser },
  { kind: 'route', to: '/gallery', label: 'Gallery', icon: Images, onPrefetch: prefetchGalleryChunk, wide: true },
];

const PUBLIC_TILES: HubTile[] = [
  { kind: 'scroll', sectionId: 'announcements', label: 'Announcements', icon: Megaphone },
  { kind: 'scroll', sectionId: 'events', label: 'Events', icon: Calendar },
  { kind: 'scroll', sectionId: 'watch-live', label: 'Watch Live', icon: PlaySquare },
  { kind: 'modal', modal: 'give', label: 'Give', icon: Heart },
  { kind: 'scroll', sectionId: 'prayer-wall', label: 'Prayer Request', icon: HandHeart },
  {
    kind: 'auth',
    to: '/sign-in',
    returnTo: '/community',
    label: 'Community',
    icon: Users,
  },
  { kind: 'scroll', sectionId: 'ministries', label: 'Ministries', icon: Church },
  {
    kind: 'auth',
    to: '/sign-in',
    returnTo: '/directory',
    label: 'Directory',
    icon: BookUser,
  },
];

/** Emoji shown on each shortcut tile (keyed by tile label). */
const TILE_EMOJI: Record<string, string> = {
  Bible: '📖',
  Announcements: '📣',
  Events: '📅',
  'Watch Live': '📺',
  Give: '💝',
  'Prayer Request': '🙏',
  Community: '💬',
  Ministries: '⛪',
  Directory: '📒',
  Gallery: '📸',
};

function scrollToSection(sectionId: string) {
  const el = document.getElementById(sectionId);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const tileClassName =
  'flex items-center gap-3 rounded-[18px] bg-white/[0.06] border border-[#F2D98A]/20 px-3.5 min-h-[56px] text-left text-cream active:scale-[0.97] transition-transform motion-reduce:transition-none hover:bg-white/10';

/** PLCC Ark: its own site at /ark (same sign-in), opened with a full page load. */
const ArkTile: React.FC = () => (
  <a
    href="/ark/"
    className="col-span-2 flex items-center gap-3 rounded-[18px] bg-[#0b100e] border-[1.5px] border-[#F2D98A] px-3.5 min-h-[64px] text-left active:scale-[0.98] transition-transform motion-reduce:transition-none"
  >
    <svg width="30" height="30" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <path d="M3 20h28l-4 8H7z" fill="#F2D98A" />
      <rect x="10" y="10" width="14" height="10" fill="#7DE3D0" />
      <rect x="14" y="5" width="6" height="5" fill="#F2D98A" />
    </svg>
    <span className="min-w-0 flex-1">
      <span className="block text-[13px] font-extrabold tracking-[0.12em] text-[#F2D98A]">PLCC ARK</span>
      <span className="block mt-0.5 text-xs font-semibold text-cream/85">Play, climb the board, earn PLCC Bucks</span>
    </span>
    <ChevronRight size={18} className="shrink-0 text-[#F2D98A]" aria-hidden />
  </a>
);

export const HomeHubGrid: React.FC<HomeHubGridProps> = ({ variant = 'public' }) => {
  const navigate = useNavigate();
  const [giveOpen, setGiveOpen] = useState(false);
  const tiles = variant === 'member' ? MEMBER_TILES : PUBLIC_TILES;

  return (
    <section id="actions" className="scroll-mt-24" aria-labelledby="home-shortcuts-title">
      <h2 id="home-shortcuts-title" className="mb-2.5 px-1 text-[15px] font-bold text-cream/90">
        🧭 Explore PLCC
      </h2>
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map((tile) => {
          const key = tile.label;
          if (tile.kind === 'ark') {
            return <ArkTile key={key} />;
          }

          if (tile.kind === 'route') {
            return (
              <Link
                key={key}
                to={tile.to}
                onFocus={() => tile.onPrefetch?.()}
                onMouseEnter={() => tile.onPrefetch?.()}
                onTouchStart={() => tile.onPrefetch?.()}
                className={tile.wide ? `${tileClassName} col-span-2` : tileClassName}
              >
                <span className="shrink-0 text-xl leading-none" aria-hidden>{TILE_EMOJI[tile.label]}</span>
                <span className="min-w-0 text-sm font-semibold leading-tight">
                  {tile.label}
                </span>
              </Link>
            );
          }

          if (tile.kind === 'auth') {
            return (
              <Link
                key={key}
                to={tile.to}
                state={{ returnTo: tile.returnTo }}
                onClick={() => rememberReturnTo(tile.returnTo)}
                className={tileClassName}
              >
                <span className="shrink-0 text-xl leading-none" aria-hidden>{TILE_EMOJI[tile.label]}</span>
                <span className="min-w-0 text-sm font-semibold leading-tight">
                  {tile.label}
                </span>
              </Link>
            );
          }

          if (tile.kind === 'modal') {
            return (
              <button
                key={key}
                type="button"
                onClick={() => setGiveOpen(true)}
                className={tileClassName}
              >
                <span className="shrink-0 text-xl leading-none" aria-hidden>{TILE_EMOJI[tile.label]}</span>
                <span className="min-w-0 text-sm font-semibold leading-tight">
                  {tile.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (!document.getElementById(tile.sectionId)) {
                  navigate('/');
                }
                window.setTimeout(() => scrollToSection(tile.sectionId), 50);
              }}
              className={tileClassName}
            >
              <span className="shrink-0 text-xl leading-none" aria-hidden>{TILE_EMOJI[tile.label]}</span>
              <span className="min-w-0 text-sm font-semibold leading-tight">
                {tile.label}
              </span>
            </button>
          );
        })}
      </div>
      <GiveModule isOpen={giveOpen} onClose={() => setGiveOpen(false)} />
    </section>
  );
};
