// Load .env if present (Node 20.12+). Silently ignored if file is missing.
try {
  process.loadEnvFile('.env');
} catch {
  void 0;
}

import { DEFAULTS } from './defaults.js';

function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  latitude: Number.parseFloat(env('LATITUDE', '49.5535')),
  longitude: Number.parseFloat(env('LONGITUDE', '25.5948')),
  intervalMs: Number.parseInt(env('INTERVAL_SECONDS', '600'), 10) * 1000,
  sidecarUrl: env('SIDECAR_URL', 'http://127.0.0.1:8765'),
  dayBrightness: Number.parseInt(env('DAY_BRIGHTNESS', String(DEFAULTS.dayBrightness)), 10),
  nightBrightness: Number.parseInt(env('NIGHT_BRIGHTNESS', String(DEFAULTS.nightBrightness)), 10),
};
