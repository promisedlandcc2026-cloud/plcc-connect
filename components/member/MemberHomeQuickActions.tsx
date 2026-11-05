import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Church,
  CreditCard,
  HandHeart,
  Heart,
  Tv,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { GiveModule } from '../GiveModule';
import { MemberHomeSection } from './MemberHomeSection';
import {
  prefetchCardChunk,
  prefetchCommunityChunks,
  prefetchServeChunks,
} from '../../lib/prefetchMemberChunks';

type Action =
  | { kind: 'route'; to: string; label: string; icon: LucideIcon; onPrefetch?: () => void }
  | { kind: 'scroll'; sectionId: string; label: string; icon: LucideIcon }
  | { kind: 'modal'; modal: 'give'; label: string; icon: LucideIcon }
  | { kind: 'soon'; label: string; icon: LucideIcon };

const ACTIONS: Action[] = [
  {
    kind: 'route',
    to: '/community',
    label: 'Community',
    icon: Users,
    onPrefetch: prefetchCommunityChunks,
  },
  { kind: 'route', to: '/prayer', label: 'Prayer', icon: Heart },
  { kind: 'modal', modal: 'give', label: 'Give', icon: Wallet },
  { kind: 'route', to: '/events', label: 'Events', icon: Calendar },
  { kind: 'scroll', sectionId: 'watch-live', label: 'Watch', icon: Tv },
  {
    kind: 'route',
    to: '/card',
    label: 'My Card',
    icon: CreditCard,
    onPrefetch: prefetchCardChunk,
  },
  {
    kind: 'route',
    to: '/serve',
    label: 'Serve',
    icon: HandHeart,
    onPrefetch: prefetchServeChunks,
  },
  { kind: 'route', to: '/ministries', label: 'Ministries', icon: Church },
];

/** Emoji shown on each quick action (keyed by label). */
const ACTION_EMOJI: Record<string, string> = {
  Community: '💬',
  Prayer: '🙏',
  Give: '💝',
  Events: '📅',
  Watch: '📺',
  'My Card': '🪪',
  Serve: '🤲',
  Ministries: '⛪',
};

export const MemberHomeQuickActions: React.FC = () => {
  const navigate = useNavigate();
  const [giveOpen, setGiveOpen] = useState(false);

  const scrollTo = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <MemberHomeSection id="actions" title="⚡ Quick Actions">
      <div className="grid grid-cols-4 gap-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const key = action.label;

          if (action.kind === 'soon') {
            return (
              <div
                key={key}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-gray-200 bg-white/70 px-1 py-3 min-h-[88px] opacity-70"
                aria-disabled="true"
              >
                <Icon size={18} className="text-gray-500" aria-hidden />
                <span className="text-xs font-bold text-gray-500 text-center leading-tight">
                  {action.label}
                </span>
                <span className="text-xs font-black uppercase tracking-widest text-gold-ink">
                  Soon
                </span>
              </div>
            );
          }

          if (action.kind === 'route') {
            return (
              <Link
                key={key}
                to={action.to}
                onFocus={() => action.onPrefetch?.()}
                onMouseEnter={() => action.onPrefetch?.()}
                onTouchStart={() => action.onPrefetch?.()}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-gray-100 bg-white shadow-sm px-1 py-3 min-h-[88px] active:scale-95 transition-transform"
              >
                <span className="text-[22px] leading-none" aria-hidden>{ACTION_EMOJI[action.label]}</span>
                <span className="text-xs font-bold text-[#1A1A1A] text-center leading-tight">
                  {action.label}
                </span>
              </Link>
            );
          }

          if (action.kind === 'modal') {
            return (
              <button
                key={key}
                type="button"
                onClick={() => setGiveOpen(true)}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-gray-100 bg-white shadow-sm px-1 py-3 min-h-[88px] active:scale-95 transition-transform"
              >
                <span className="text-[22px] leading-none" aria-hidden>{ACTION_EMOJI[action.label]}</span>
                <span className="text-xs font-bold text-[#1A1A1A] text-center leading-tight">
                  {action.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (!document.getElementById(action.sectionId)) {
                  navigate('/');
                }
                window.setTimeout(() => scrollTo(action.sectionId), 50);
              }}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-gray-100 bg-white shadow-sm px-1 py-3 min-h-[88px] active:scale-95 transition-transform"
            >
              <span className="text-[22px] leading-none" aria-hidden>{ACTION_EMOJI[action.label]}</span>
              <span className="text-xs font-bold text-[#1A1A1A] text-center leading-tight">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
      <GiveModule isOpen={giveOpen} onClose={() => setGiveOpen(false)} />
    </MemberHomeSection>
  );
};
