import React from 'react';
import { SKY_IMAGE, useTribesSky, type TribesSky } from '../../lib/tribesSky';

const SKY_LABEL: Record<TribesSky, string> = {
  sunny: 'sunrise over the golden road',
  cloudy: 'clouds over the golden road',
  rainy: 'rain over the golden road',
  night: 'moon over the golden road',
};

/**
 * Woven arch banner whose sky follows the time of day and Kampala's weather
 * (sunny · cloudy · rainy · night). Full-bleed inside a page's px-5 main.
 * Content sits on the dark left side of the artwork.
 */
export const SkyArchHero: React.FC<{
  children: React.ReactNode;
  /** Min height of the banner in px (art is cropped to fit). */
  minHeight?: number;
  className?: string;
  ariaLabel?: string;
  /** Pull out of a px-5 page column (default). Off when the parent has no padding. */
  bleed?: boolean;
}> = ({ children, minHeight = 250, className = '', ariaLabel, bleed = true }) => {
  const sky = useTribesSky();
  return (
    <section
      className={`tribes-arch ${bleed ? '-mx-5' : ''} ${className}`}
      style={{ minHeight }}
      aria-label={ariaLabel}
      data-sky={sky}
    >
      <img
        key={sky}
        src={SKY_IMAGE[sky]}
        alt=""
        aria-hidden
        decoding="async"
        className="tribes-sky-img"
        title={SKY_LABEL[sky]}
      />
      <div className="tribes-arch-content">{children}</div>
    </section>
  );
};
