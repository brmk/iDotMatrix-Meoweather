import type { WeatherSnapshot } from '../../weather/index.js';

export function formatTemperature(temperature: WeatherSnapshot['temperature']): string {
  const sign = temperature < 0 ? '-' : '';
  return `${sign}${Math.abs(temperature)}°C`;
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
