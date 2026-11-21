/**
 * Design kit — page header for member screens (PLCC Tribes, Nov 2026).
 * The Tribes bar, then the woven sky arch with a gold serif title, a short
 * gold rule and the subtitle. Back link only on sub-pages (tab pages are
 * reached from the bottom bar), optional action on the right.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { TribesHeader } from '../tribes/TribesHeader';
import { SkyArchHero } from '../tribes/SkyArchHero';

type MemberPageHeaderProps = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  /** e.g. a Refresh or Add button, shown on the banner's right */
  action?: React.ReactNode;
};

export const MemberPageHeader: React.FC<MemberPageHeaderProps> = ({
  title,
  eyebrow,
  subtitle,
  backTo = '/',
  backLabel = 'Home',
  action,
}) => {
  const showBack = backTo !== '/';
  return (
    <header className="-mt-10 mb-5">
      <TribesHeader />
      <SkyArchHero minHeight={subtitle ? 236 : 200}>
        <div className="flex min-h-[44px] items-center justify-between gap-3 px-3 pt-3">
          {showBack ? (
            <Link
              to={backTo}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-[#022716]/70 pl-1.5 pr-3.5 text-[15px] font-semibold text-[#F4ECDB] ring-1 ring-[#D9B45E]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4C36A]"
            >
              <ChevronLeft size={22} aria-hidden />
              {backLabel}
            </Link>
          ) : (
            <span />
          )}
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        <div className="max-w-[62%] px-7 pb-7 pt-3 min-[400px]:px-9">
          {eyebrow ? (
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E4C36A]">{eyebrow}</p>
          ) : null}
          <h1
            className={`${eyebrow ? 'mt-1' : ''} tribes-gold-text font-display text-[40px] font-bold leading-[1.02] tracking-[-0.01em] min-[380px]:text-[46px]`}
          >
            {title}
          </h1>
          <span aria-hidden className="mt-3 block h-[3px] w-12 rounded-full bg-[#E4C36A]" />
          {subtitle ? (
            <p className="mt-3 text-[15px] font-medium leading-snug text-[#F4ECDB]">{subtitle}</p>
          ) : null}
        </div>
      </SkyArchHero>
    </header>
  );
};
