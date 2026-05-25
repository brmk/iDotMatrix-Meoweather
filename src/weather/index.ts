import { config } from '../config.js';

export interface WeatherSnapshot {
  temperature: number; // Celsius, integer rounded
  weatherCode: number; // WMO weather interpretation code
  isDay: boolean;
  fetchedAt: Date;
}

const CACHE_MS = 10 * 60 * 1000; // 10 minutes

let cached: WeatherSnapshot | null = null;

export async function fetchWeather(): Promise<WeatherSnapshot> {
  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_MS) {
    return cached;
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(config.latitude));
  url.searchParams.set('longitude', String(config.longitude));
  url.searchParams.set('current', 'temperature_2m,weather_code,is_day');
  url.searchParams.set('temperature_unit', 'celsius');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo fetch failed: HTTP ${res.status}`);

  const json = (await res.json()) as {
    current: { temperature_2m: number; weather_code: number; is_day: number };
  };

  const { temperature_2m, weather_code, is_day } = json.current;
  cached = {
    temperature: Math.round(temperature_2m),
    weatherCode: weather_code,
    isDay: is_day === 1,
    fetchedAt: new Date(),
  };

  return cached;
}

// Invalidate cache (useful for testing)
export function clearCache(): void {
  cached = null;
}
