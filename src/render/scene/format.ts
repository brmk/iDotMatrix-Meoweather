import type { WeatherSnapshot } from '../../weather/index.js';

export function formatTemperature(temperature: WeatherSnapshot['temperature']): string {
  const sign = temperature < 0 ? '-' : '';
  return `${sign}${Math.abs(temperature)}°C`;
}

/** Temperature without the unit, for the shared clock line, e.g. `-12°`. */
export function formatCompactTemperature(temperature: WeatherSnapshot['temperature']): string {
  const sign = temperature < 0 ? '-' : '';
  return `${sign}${Math.abs(temperature)}°`;
}

/** 24-hour local time, e.g. `07:05`. */
export function formatClock(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatHumidity(humidity: number): string {
  return `${humidity}%`;
}

const WIND_ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'] as const;

export function windDirectionArrow(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return WIND_ARROWS[index]!;
}

export function formatWind(speed: number, direction: number): string {
  return `${windDirectionArrow(direction)}${speed}`;
}
