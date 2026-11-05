/**
 * Design kit — list rows. Icon tile + title + optional subtitle + trailing.
 * Use for menus (More, Profile tools), settings, and simple lists.
 * Renders as a router Link (`to`), an external link (`href`), or a button (`onClick`).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ExternalLink, type LucideIcon } from 'lucide-react';

type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Emoji shown in the icon tile instead of the icon. */
  emoji?: string;
  /** Small count badge on the icon (e.g. unread). */
  badge?: number | null;
  trailing?: React.ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  onPrefetch?: () => void;
  className?: string;
};

export const ListRow: React.FC<ListRowProps> = ({
  title,
  subtitle,
  icon: Icon,
  emoji,
  badge,
  trailing,
  to,
  href,
  onClick,
  onPrefetch,
  className = '',
}) => {
  const body = (
    <>
      {Icon || emoji ? (
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-burgundy/[0.07] text-burgundy">
          {emoji ? (
            <span className="text-xl leading-none" aria-hidden>
              {emoji}
            </span>
          ) : Icon ? (
            <Icon size={20} aria-hidden />
          ) : null}
          {badge ? (
            <span className="absolute -right-1.5 -top-1.5 min-w-[20px] h-5 px-1 rounded-full bg-burgundy text-white text-xs font-bold leading-5 text-center ring-2 ring-white">
              {badge > 99 ? '99+' : badge}
            </span>
          ) : null}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink leading-snug">{title}</span>
        {subtitle ? (
          <span className="block text-sm text-ink-soft leading-snug mt-0.5">{subtitle}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-gray-500">
        {trailing ?? (href ? <ExternalLink size={16} aria-hidden /> : <ChevronRight size={18} aria-hidden />)}
      </span>
    </>
  );

  const cls = `flex w-full items-center gap-3 px-4 py-3 min-h-[64px] text-left active:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold ${className}`;
  const prefetch = onPrefetch
    ? { onFocus: onPrefetch, onMouseEnter: onPrefetch, onTouchStart: onPrefetch }
    : {};

  if (to) {
    return (
      <Link to={to} className={cls} {...prefetch}>
        {body}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {body}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
};

/** A card that groups rows with hairline dividers (iOS-style inset group). */
export const ListGroup: React.FC<{ children: React.ReactNode; label?: string; className?: string }> = ({
  children,
  label,
  className = '',
}) => (
  <div className={className}>
    {label ? (
      <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">{label}</p>
    ) : null}
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card divide-y divide-gray-100">
      {children}
    </div>
  </div>
);
