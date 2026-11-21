/**
 * PLCC Tribes hero sky: the arch banner follows the time of day and the weather.
 *
 *   night  → after sunset / before sunrise (device clock; Uganda is on the
 *            equator, so roughly 6:45 pm to 6:45 am all year)
 *   sunny  → clear or mostly clear
 *   cloudy → overcast, fog, or anything we can't read
 *   rainy  → drizzle, rain, showers, thunderstorms
 *
 * Weather is Kampala's (the church's home), from Open-Meteo: free, no key, no
 * location prompt, ~300 bytes. It is only fetched for members on East Africa
 * time (members abroad get sunny/night from their own clock), at most once per
 * 30 minutes, and never on a phone with Data Saver on. Any failure just falls
 * back to the clock.
 */
import { useEffect, useState } from 'react';

export type TribesSky = 'sunny' | 'cloudy' | 'rainy' | 'night';

export const SKY_IMAGE: Record<TribesSky, string> = {
  sunny: '/brand/sky/sunny.webp',
  cloudy: '/brand/sky/cloudy.webp',
  rainy: '/brand/sky/rainy.webp',
  night: '/brand/sky/night.webp',
};

const KAMPALA = { lat: 0.3476, lon: 32.5825 };
const CACHE_KEY = 'plcc-tribes-sky-v1';
const CACHE_MS = 30 * 60 * 1000;
const EAST_AFRICA_ZONES = new Set([
  'Africa/Kampala',
  'Africa/Nairobi',
  'Africa/Dar_es_Salaam',
  'Africa/Addis_Ababa',
  'Africa/Mogadishu',
  'Africa/Djibouti',
  'Africa/Asmara',
  'Indian/Comoro',
  'Indian/Mayotte',
  'Indian/Antananarivo',
]);

/** Day runs 6:45 am – 6:45 pm on the device clock. */
export function isNightAt(now: Date): boolean {
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins < 6 * 60 + 45 || mins >= 18 * 60 + 45;
}

/** WMO weather code (Open-Meteo) → daytime sky. */
export function skyForWeatherCode(code: number | null | undefined): Exclude<TribesSky, 'night'> {
  if (code == null || !Number.isFinite(code)) return 'sunny';
  if (code <= 1) return 'sunny';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rainy';
  return 'cloudy';
}

/** The sky to show: night always wins; otherwise the weather if we have it. */
export function pickSky(now: Date, weatherCode: number | null | undefined): TribesSky {
  if (isNightAt(now)) return 'night';
  return skyForWeatherCode(weatherCode);
}

function onEastAfricaTime(): boolean {
  try {
    return EAST_AFRICA_ZONES.has(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return false;
  }
}

function dataSaverOn(): boolean {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(conn?.saveData);
}

type Cached = { code: number; at: number };

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    return typeof c?.code === 'number' && typeof c?.at === 'number' ? c : null;
  } catch {
    return null;
  }
}

function writeCache(code: number) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ code, at: Date.now() } satisfies Cached));
  } catch {
    /* private mode / storage full: fine */
  }
}

let inflight: Promise<number | null> | null = null;

async function fetchKampalaWeatherCode(): Promise<number | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${KAMPALA.lat}&longitude=${KAMPALA.lon}&current=weather_code&timezone=Africa%2FKampala`,
        { signal: ctrl.signal },
      );
      clearTimeout(t);
      if (!res.ok) return null;
      const body = (await res.json()) as { current?: { weather_code?: number } };
      const code = body?.current?.weather_code;
      if (typeof code !== 'number') return null;
      writeCache(code);
      return code;
    } catch {
      return null;
    } finally {
      setTimeout(() => {
        inflight = null;
      }, 0);
    }
  })();
  return inflight;
}

/** Current hero sky; re-checks every 10 minutes while the page is open. */
export function useTribesSky(): TribesSky {
  const [code, setCode] = useState<number | null>(() => {
    const c = readCache();
    return c && Date.now() - c.at < 3 * CACHE_MS ? c.code : null;
  });
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      setNow(new Date());
      if (!onEastAfricaTime() || dataSaverOn()) return;
      const c = readCache();
      if (c && Date.now() - c.at < CACHE_MS) {
        setCode(c.code);
        return;
      }
      void fetchKampalaWeatherCode().then((next) => {
        if (alive && next != null) setCode(next);
      });
    };
    refresh();
    const id = window.setInterval(refresh, 10 * 60 * 1000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  return pickSky(now, onEastAfricaTime() ? code : null);
}
