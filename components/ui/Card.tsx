/**
 * Design kit — surfaces.
 * Card: the white rounded panel used for every grouped piece of content.
 */
import React from 'react';

type CardProps = {
  children: React.ReactNode;
  className?: string;
  /** Inner padding: none for lists that bring their own rows. */
  padding?: 'none' | 'sm' | 'md';
  onClick?: () => void;
  as?: 'div' | 'section' | 'article' | 'li';
} & Omit<React.HTMLAttributes<HTMLElement>, 'onClick'>;

const PADDING = { none: '', sm: 'p-3', md: 'p-4' } as const;

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  onClick,
  as: Tag = 'div',
  ...rest
}) => {
  const base = `bg-white border border-gray-100 rounded-2xl shadow-card ${PADDING[padding]}`;
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} w-full text-left active:scale-[0.99] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${className}`}
      >
        {children}
      </button>
    );
  }
  return (
    <Tag className={`${base} ${className}`} {...rest}>
      {children}
    </Tag>
  );
};
