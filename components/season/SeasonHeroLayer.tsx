/**
 * Seasonal wash + falling effect behind the burgundy home hub.
 * Must be a direct child of `.awc-home-shell` (see index.css).
 */
import React from 'react';
import SeasonParticles from './SeasonParticles';
import { usePublishedSeason } from './SeasonThemeProvider';

export const SeasonHeroLayer: React.FC = () => {
  const { theme, showEffects } = usePublishedSeason();
  return (
    <>
      {theme.id !== 'brand' ? <div className="season-wash" aria-hidden /> : null}
      {showEffects ? (
        <SeasonParticles effect={theme.effect} className="season-particles" />
      ) : null}
    </>
  );
};

/** "🍂 Welcome home" chip + holiday greeting, same as the Vault home hero. */
export const SeasonGreeting: React.FC<{ align?: 'center' | 'start' }> = ({ align = 'center' }) => {
  const { theme } = usePublishedSeason();
  if (theme.id === 'brand') return null;
  return (
    <div className={`mt-2 flex flex-col gap-1.5 ${align === 'start' ? 'items-start' : 'items-center'}`}>
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/30 text-white text-xs font-black uppercase tracking-[0.2em]"
        style={{ backgroundColor: 'var(--season-accent)' }}
      >
        {theme.mark ? <span aria-hidden>{theme.mark}</span> : null}
        Welcome home
      </span>
      {theme.greeting ? (
        <p className="text-sm font-black text-gold tracking-tight">{theme.greeting}</p>
      ) : null}
    </div>
  );
};
