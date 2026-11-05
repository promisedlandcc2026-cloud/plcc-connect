/**
 * Design kit — loading, empty and error states. Readable (no tiny caps), calm,
 * and every dead end can offer a next step.
 */
import React from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { Button } from './Button';

export const LoadingState: React.FC<{ message?: string }> = ({ message = 'Loading…' }) => (
  <div className="py-10 flex flex-col items-center justify-center gap-3" role="status">
    <Loader2 size={26} className="text-burgundy animate-spin" aria-hidden />
    <p className="text-sm text-ink-soft">{message}</p>
  </div>
);

/** Shimmer blocks for content that is about to appear. */
export const SkeletonRows: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="space-y-2" role="status" aria-label="Loading">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="h-16 rounded-2xl bg-gray-200/60 animate-pulse" />
    ))}
  </div>
);

export const EmptyState: React.FC<{
  message: string;
  hint?: string;
  icon?: LucideIcon;
  action?: { label: string; onClick: () => void };
}> = ({ message, hint, icon: Icon, action }) => (
  <div className="py-10 text-center px-4 flex flex-col items-center">
    {Icon ? (
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-burgundy/[0.07] text-burgundy">
        <Icon size={22} aria-hidden />
      </span>
    ) : null}
    <p className="text-[15px] font-semibold text-ink">{message}</p>
    {hint ? <p className="mt-1.5 text-sm text-ink-soft leading-relaxed max-w-xs">{hint}</p> : null}
    {action ? (
      <Button variant="secondary" size="sm" className="mt-4" onClick={action.onClick}>
        {action.label}
      </Button>
    ) : null}
  </div>
);

export const ErrorState: React.FC<{
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}> = ({ message, onRetry, retryLabel = 'Try again' }) => (
  <div
    className="py-6 px-4 rounded-2xl bg-red-50 border border-red-100 text-center flex flex-col items-center gap-3"
    role="alert"
  >
    <p className="text-sm text-red-900 leading-relaxed">{message}</p>
    {onRetry ? (
      <Button variant="subtle" size="sm" className="bg-white border border-red-200 text-red-900" onClick={onRetry}>
        {retryLabel}
      </Button>
    ) : null}
  </div>
);
