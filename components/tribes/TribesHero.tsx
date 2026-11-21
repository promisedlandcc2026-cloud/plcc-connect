import React from 'react';
import { TribesMark } from './TribesMark';
import { SkyArchHero } from './SkyArchHero';

/** Thin gold rule with the official mark in the middle — shared by the hero and the Scripture card. */
export const GoldRuleMark: React.FC<{ size?: number; tone?: 'dark' | 'light'; className?: string }> = ({
  size = 32,
  tone = 'light',
  className = '',
}) => {
  const line = tone === 'light' ? 'bg-[#E4C36A]/60' : 'bg-[#C9A35A]/60';
  const ink = tone === 'light' ? 'text-[#E4C36A]' : 'text-[#B8893A]';
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden>
      <span className={`h-px w-14 ${line}`} />
      <span style={{ height: size }} className="inline-flex"><TribesMark className={`h-full w-auto ${ink}`} /></span>
      <span className={`h-px w-14 ${line}`} />
    </div>
  );
};

/** Sky arch welcome band: "One family. Many nations. One purpose." */
export const TribesHero: React.FC = () => (
  <SkyArchHero minHeight={236} ariaLabel="PLCC Tribes community feed">
    <div className="px-6 pb-6 pt-9 text-center">
      <h1
        id="tribes-hero-title"
        className="font-display text-[30px] font-bold leading-[1.12] tracking-[-0.01em] text-[#F6E7B8] [text-shadow:0_2px_12px_rgba(0,0,0,0.55)] min-[360px]:text-[33px]"
      >
        One family.
        <br />
        Many nations.
        <br />
        One purpose.
      </h1>
      <GoldRuleMark className="mt-4" size={30} />
    </div>
  </SkyArchHero>
);
