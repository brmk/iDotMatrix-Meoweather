import { renderToFile } from './render/index.js';
import type { WeatherSnapshot } from './weather/index.js';

const cases: Array<WeatherSnapshot & { label: string }> = [
  { label: 'clear-day', temperature: 22, weatherCode: 0, isDay: true, humidity: 45, windSpeed: 12, windDirection: 45, fetchedAt: new Date() },
  { label: 'clear-night', temperature: 8, weatherCode: 0, isDay: false, humidity: 70, windSpeed: 5, windDirection: 270, fetchedAt: new Date() },
  { label: 'partly-cloudy', temperature: 15, weatherCode: 2, isDay: true, humidity: 60, windSpeed: 18, windDirection: 135, fetchedAt: new Date() },
  { label: 'cloudy', temperature: 10, weatherCode: 3, isDay: true, humidity: 80, windSpeed: 22, windDirection: 315, fetchedAt: new Date() },
  { label: 'fog', temperature: 5, weatherCode: 45, isDay: true, humidity: 95, windSpeed: 3, windDirection: 180, fetchedAt: new Date() },
  { label: 'rain', temperature: 9, weatherCode: 61, isDay: true, humidity: 88, windSpeed: 25, windDirection: 225, fetchedAt: new Date() },
  { label: 'heavy-rain', temperature: 7, weatherCode: 82, isDay: true, humidity: 92, windSpeed: 40, windDirection: 200, fetchedAt: new Date() },
  { label: 'snow', temperature: -3, weatherCode: 73, isDay: true, humidity: 85, windSpeed: 15, windDirection: 90, fetchedAt: new Date() },
  { label: 'thunder', temperature: 14, weatherCode: 95, isDay: true, humidity: 75, windSpeed: 35, windDirection: 0, fetchedAt: new Date() },
  { label: 'minus15', temperature: -15, weatherCode: 0, isDay: true, humidity: 55, windSpeed: 8, windDirection: 337, fetchedAt: new Date() },
];

for (const { label, ...snapshot } of cases) {
  const path = `test_${label}.png`;
  renderToFile(snapshot, path);
  console.log(`Wrote ${path}  (${snapshot.temperature}°C, code=${snapshot.weatherCode})`);
}
