import React from 'react';
import { SectionHeader } from '../ui/SectionHeader';

type MemberHomeSectionProps = {
  id?: string;
  title: string;
  children: React.ReactNode;
  action?: { to: string; label: string } | { onClick: () => void; label: string };
  /** Small status/label shown at the right of the header (e.g. a badge). */
  aside?: React.ReactNode;
  className?: string;
};

/** Home feed section: kit SectionHeader + content. */
export const MemberHomeSection: React.FC<MemberHomeSectionProps> = ({
  id,
  title,
  children,
  action,
  aside,
  className = '',
}) => (
  <section
    id={id}
    className={`scroll-mt-24 space-y-2 ${className}`}
    aria-labelledby={id ? `${id}-heading` : undefined}
  >
    <SectionHeader title={title} id={id ? `${id}-heading` : undefined} link={action} action={aside} className="" />
    {children}
  </section>
);
