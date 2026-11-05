import React from 'react';
import type { Countdown } from '../../lib/sanctuary';

type Props = {
  countdown: Countdown;
  size?: number;
  stroke?: number;
  /** Ring color; defaults to PLCC burgundy. */
  color?: string;
  track?: string;
};

/** Countdown ring for the Next-up ticket. The fill eases in (off under reduce motion). */
export const CountdownRing: React.FC<Props> = ({
  countdown,
  size = 82,
  stroke = 6,
  color = '#1d372c',
  track = '#EADFD3',
}) => {
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - countdown.fraction);
  return (
    <div role="img" aria-label={countdown.spoken} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          className="awc-ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-xl font-extrabold" style={{ color }}>
          {countdown.big}
        </span>
        {countdown.small ? (
          <span className="mt-1 text-xs font-semibold text-[#5A606C]">{countdown.small}</span>
        ) : null}
      </div>
    </div>
  );
};
