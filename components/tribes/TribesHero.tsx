import React from 'react';

/** Thin gold rule with the official mark in the middle — shared by the hero and the Scripture card. */
export const GoldRuleMark: React.FC<{ size?: number; tone?: 'dark' | 'light'; className?: string }> = ({
  size = 32,
  tone = 'light',
  className = '',
}) => {
  const line = tone === 'light' ? 'bg-[#E4C36A]/70' : 'bg-[#C9A35A]/70';
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden>
      <span className={`h-px w-14 ${line}`} />
      <img src="/awc_connect_logo.png" alt="" width={size} height={size} className="rounded-full" style={{ width: size, height: size }} />
      <span className={`h-px w-14 ${line}`} />
    </div>
  );
};

/** Woven-pattern welcome band: "One family. Many nations. One purpose." */
export const TribesHero: React.FC = () => (
  <section className="tribes-weave -mx-5 px-6 pb-6 pt-7 text-center" aria-labelledby="tribes-hero-title">
    <h1
      id="tribes-hero-title"
      className="font-display text-[30px] font-bold leading-[1.12] text-[#F6E7B8] xs:text-[32px] sm:text-[36px]"
    >
      One family.
      <br />
      Many nations.
      <br />
      One purpose.
    </h1>
    <GoldRuleMark className="mt-4" size={34} />
    <p className="sr-only">PLCC Tribes community feed</p>
  </section>
);
