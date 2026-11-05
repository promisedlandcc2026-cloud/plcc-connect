/**
 * Connect seasonal theme publisher.
 * Same rules as PLCC Canaan lib/seasons/applyTheme.ts, but the church setting
 * (organization_settings.system_settings.seasonal) comes through Connect's
 * same-origin bridge: GET /api/checkin-points?resource=season.
 *
 * Visitors have no token, so they get the last church setting seen on this
 * device (cached after any signed-in load) or the Vault default (automatic).
 */
import { getValidAccessToken } from '../authAccessToken';
import {
  DEFAULT_SEASONAL_SETTINGS,
  getActiveTheme,
  parseSeasonalSettings,
  readMemberEffectsOff,
  type ActiveTheme,
  type SeasonalSettings,
} from './index';
import { fetchKampalaWeather, type TodayWeather } from './weather';

export type PublishedSeason = {
  theme: ActiveTheme;
  showEffects: boolean;
};

export const SEASONAL_CACHE_KEY = 'awc_connect_seasonal';
export const SEASON_ROUTE = '/api/checkin-points?resource=season';

const listeners = new Set<(published: PublishedSeason) => void>();
let published: PublishedSeason = {
  theme: getActiveTheme(new Date(), readCachedSeasonal()),
  showEffects: false,
};

export function getPublishedSeason(): PublishedSeason {
  return published;
}

export function subscribeSeason(listener: (published: PublishedSeason) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readCachedSeasonal(): SeasonalSettings {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_SEASONAL_SETTINGS;
    const raw = localStorage.getItem(SEASONAL_CACHE_KEY);
    return raw ? parseSeasonalSettings(JSON.parse(raw)) : DEFAULT_SEASONAL_SETTINGS;
  } catch {
    return DEFAULT_SEASONAL_SETTINGS;
  }
}

function writeCachedSeasonal(settings: SeasonalSettings): void {
  try {
    localStorage.setItem(SEASONAL_CACHE_KEY, JSON.stringify(settings));
  } catch {
    /* private mode — theme still works for this visit */
  }
}

async function loadChurchSeasonalSettings(): Promise<SeasonalSettings> {
  const cached = readCachedSeasonal();
  let token: string | null = null;
  try {
    token = await getValidAccessToken();
  } catch {
    token = null;
  }
  if (!token) return cached;
  try {
    const res = await fetch(SEASON_ROUTE, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return cached;
    const body = (await res.json().catch(() => null)) as
      | { seasonal?: unknown; source?: string }
      | null;
    if (!body || body.source !== 'church') return cached;
    const settings = parseSeasonalSettings(body.seasonal);
    writeCachedSeasonal(settings);
    return settings;
  } catch {
    return cached;
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function publishSeason(
  settings: SeasonalSettings,
  userId: string | null,
  date = new Date(),
  weather: TodayWeather | null = null,
) {
  let theme = getActiveTheme(date, settings);
  // Automatic and not a holiday: show Kampala's live weather (rain, sun, clouds…).
  if (weather && settings.mode === 'automatic' && (theme.id === 'rainy' || theme.id === 'dry')) {
    theme = {
      ...theme,
      mark: weather.mark,
      effect: weather.effect,
      weatherLabel:
        weather.tempC !== null ? `${weather.label} · ${weather.tempC}°C in Kampala` : `${weather.label} in Kampala`,
    };
  }
  const showEffects =
    settings.effects && !readMemberEffectsOff(userId) && !prefersReducedMotion() && theme.effect !== 'none';
  published = { theme, showEffects };
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.season = theme.id;
    document.documentElement.dataset.seasonEffects = showEffects ? theme.effect : 'none';
  }
  listeners.forEach((listener) => listener(published));
  return published;
}

export async function refreshSeasonTheme(userId: string | null): Promise<PublishedSeason> {
  // Paint immediately from cache, then settle on the church setting.
  publishSeason(readCachedSeasonal(), userId);
  const church = await loadChurchSeasonalSettings();
  publishSeason(church, userId);
  const weather = church.mode === 'automatic' ? await fetchKampalaWeather() : null;
  return publishSeason(church, userId, new Date(), weather);
}
