import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { BrightnessConfig, NightHours, PowerSchedule } from './control-state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, '..', 'runtime.json');

export interface RuntimeConfig {
  brightness?: BrightnessConfig;
  nightHours?: NightHours | null;
  powerSchedule?: PowerSchedule | null;
}

export function loadRuntimeConfig(): RuntimeConfig {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as RuntimeConfig;
  } catch (err) {
    console.error('runtime.json parse failed, ignoring:', err);
    return {};
  }
}

export function saveRuntimeConfig(patch: Partial<RuntimeConfig>): void {
  const current = loadRuntimeConfig();
  const next = { ...current, ...patch };
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2) + '\n', 'utf8');
  } catch (err) {
    console.error('runtime.json write failed:', err);
  }
}
