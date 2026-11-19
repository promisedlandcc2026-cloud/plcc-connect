/**
 * Visitor bottom bar — PLCC Tribes ivory bar (same look as the member bar):
 * Home · Watch · Events · Prayer · Visit, full labels, and a gold underline on
 * the section you last jumped to.
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
      className={`pointer-events-none fixed bottom-0 left-1/2 z-[110] w-full max-w-[500px] -translate-x-1/2 transition-transform duration-300 ease-out motion-reduce:transition-none ${
        dockHidden ? 'translate-y-full' : 'translate-y-0'
      }`}
    >
      <nav
        aria-label="Main"
        className="awc-dock pointer-events-auto grid grid-cols-5 items-stretch px-1 pb-[env(safe-area-inset-bottom)]"
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
              className={`awc-dock-tab relative flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1 pt-1.5 pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A35A] active:bg-[#1d372c]/[0.05] ${
                active ? 'text-[#12301f]' : 'text-[#5B6658] hover:text-[#12301f]'
              }`}
            >
              <Icon size={23} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
              <span className={`max-w-full truncate text-[12px] leading-none tracking-[-0.01em] ${active ? 'font-bold' : 'font-semibold'}`}>{item.label}</span>
              <span aria-hidden className={`awc-dock-mark absolute bottom-1 h-[3px] rounded-full bg-[#C9A35A] ${active ? 'w-8 opacity-100' : 'w-0 opacity-0'}`} />
            </button>
          );
        })}
      </nav>
    </div>
  );
};
