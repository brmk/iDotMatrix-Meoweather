import type { WeatherSnapshot } from '../../weather/index.js';

export function formatTemperature(temperature: WeatherSnapshot['temperature']): string {
  const sign = temperature < 0 ? '-' : '';
  return `${sign}${Math.abs(temperature)}°C`;
}
