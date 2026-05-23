import { renderToFile } from "./render/index.js";
import type { WeatherSnapshot } from "./weather/index.js";

const cases: Array<WeatherSnapshot & { label: string }> = [
  { label: "clear-day",    temperature: 22, weatherCode: 0,  isDay: true,  fetchedAt: new Date() },
  { label: "clear-night",  temperature: 8,  weatherCode: 0,  isDay: false, fetchedAt: new Date() },
  { label: "partly-cloudy",temperature: 15, weatherCode: 2,  isDay: true,  fetchedAt: new Date() },
  { label: "cloudy",       temperature: 10, weatherCode: 3,  isDay: true,  fetchedAt: new Date() },
  { label: "fog",          temperature: 5,  weatherCode: 45, isDay: true,  fetchedAt: new Date() },
  { label: "rain",         temperature: 9,  weatherCode: 61, isDay: true,  fetchedAt: new Date() },
  { label: "heavy-rain",   temperature: 7,  weatherCode: 82, isDay: true,  fetchedAt: new Date() },
  { label: "snow",         temperature: -3, weatherCode: 73, isDay: true,  fetchedAt: new Date() },
  { label: "thunder",      temperature: 14, weatherCode: 95, isDay: true,  fetchedAt: new Date() },
  { label: "minus15",      temperature: -15,weatherCode: 0,  isDay: true,  fetchedAt: new Date() },
];

for (const { label, ...snapshot } of cases) {
  const path = `test_${label}.png`;
  renderToFile(snapshot, path);
  console.log(`Wrote ${path}  (${snapshot.temperature}°C, code=${snapshot.weatherCode})`);
}
