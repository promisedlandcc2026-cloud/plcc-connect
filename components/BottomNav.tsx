/**
 * Visitor bottom bar — the Sanctuary floating glass dock (same look as the
 * member dock): Home · Watch · Events · Prayer · Visit, full labels, and a
 * gold-leaf pill on the section you last jumped to.
 */
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Calendar, HandHeart, Home, MapPin, PlayCircle, type LucideIcon } from 'lucide-react';
import { showDock, useDockHidden } from '../lib/dockAutoHide';

type DockItem = { id: string; label: string; icon: LucideIcon };

const ITEMS: DockItem[] = [
  { id: 'top', label: 'Home', icon: Home },
  { id: 'watch-live', label: 'Watch', icon: PlayCircle },
  { id: 'events', label: 'Events', icon: Calendar },
  { id: 'prayer-wall', label: 'Prayer', icon: HandHeart },
  { id: 'connect-hub', label: 'Visit', icon: MapPin },
];

function scrollToSection(id: string) {
  const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto';
  if (id === 'top') {
    window.scrollTo({ top: 0, behavior });
    return;
  }
  document.getElementById(id)?.scrollIntoView({ behavior, block: 'start' });
}

export const BottomNav: React.FC = () => {
  const [activeId, setActiveId] = useState<string>('top');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => {
      if (location.pathname === '/' && window.scrollY < 50) setActiveId('top');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.pathname]);

  const go = (id: string) => {
    setActiveId(id);
    if (location.pathname !== '/') {
      navigate('/');
      window.setTimeout(() => scrollToSection(id), 120);
      return;
    }
    scrollToSection(id);
  };

  const onHome = location.pathname === '/';
  const dockHidden = useDockHidden();

  return (
    <div
      onFocusCapture={showDock}
      className={`pointer-events-none fixed bottom-[max(12px,env(safe-area-inset-bottom))] left-1/2 z-[110] w-full max-w-[500px] -translate-x-1/2 px-3 transition-transform duration-300 ease-out motion-reduce:transition-none ${
        dockHidden ? 'translate-y-[calc(100%+max(12px,env(safe-area-inset-bottom))+8px)]' : 'translate-y-0'
      }`}
    >
      <nav
        aria-label="Main"
        className="awc-dock pointer-events-auto grid h-[68px] grid-cols-5 items-center rounded-[34px] px-1"
      >
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = onHome && activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item.id)}
              aria-current={active ? 'true' : undefined}
              className={`flex h-14 min-w-0 flex-col items-center justify-center gap-[3px] rounded-[28px] transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf ${
                active ? 'bg-leaf text-wine' : 'text-cream/85 hover:text-cream'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.9} aria-hidden />
              <span className="max-w-full truncate text-xs font-bold leading-none tracking-[-0.01em]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
