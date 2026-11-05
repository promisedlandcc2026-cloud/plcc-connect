/**
 * Design kit — section headings inside a screen (Home feed, page sections).
 * Sentence case, ink color, with an optional "See all" style action.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, type LucideIcon } from 'lucide-react';

type SectionAction = { to: string; label: string } | { onClick: () => void; label: string };

interface SectionHeaderProps {
  title: string;
  id?: string;
  icon?: LucideIcon;
  /** Legacy: any node on the right. Prefer `link`. */
  action?: React.ReactNode;
  link?: SectionAction;
  className?: string;
}

const linkCls =
  'inline-flex items-center gap-0.5 min-h-[44px] px-1 text-sm font-semibold text-burgundy';

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  id,
  icon: Icon,
  action,
  link,
  className = 'mb-1',
}) => (
  <div className={`flex items-center justify-between gap-3 px-0.5 ${className}`}>
    <h2 id={id} className="text-lg font-bold text-ink flex items-center gap-2 tracking-tight">
      {Icon ? <Icon size={18} className="text-burgundy" aria-hidden /> : null}
      {title}
    </h2>
    {link && 'to' in link ? (
      <Link to={link.to} className={linkCls}>
        {link.label}
        <ChevronRight size={16} aria-hidden />
      </Link>
    ) : null}
    {link && 'onClick' in link ? (
      <button type="button" onClick={link.onClick} className={linkCls}>
        {link.label}
        <ChevronRight size={16} aria-hidden />
      </button>
    ) : null}
    {action}
  </div>
);
