/**
 * Publishes the active season / holiday theme to <html data-season="…"> so the
 * --season-* CSS variables in index.css apply app-wide. Mirrors PLCC Canaan's
 * SeasonThemeProvider; re-checks hourly, on tab focus, and when the member
 * signs in or out (the church setting needs a signed-in bridge call).
 */
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getPublishedSeason,
  refreshSeasonTheme,
  subscribeSeason,
  type PublishedSeason,
} from '../../lib/seasons/applyTheme';
import { SEASON_PREVIEW_EVENT } from '../../lib/seasons';

export const SeasonThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    const run = () => {
      void refreshSeasonTheme(userId);
    };
    run();
    const timer = window.setInterval(run, 60 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(SEASON_PREVIEW_EVENT, run);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(SEASON_PREVIEW_EVENT, run);
    };
  }, [userId]);

  return <>{children}</>;
};

export function usePublishedSeason(): PublishedSeason {
  const [published, setPublished] = useState(getPublishedSeason);
  useEffect(() => subscribeSeason(setPublished), []);
  return published;
}
