import { copyFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PetBehaviorConfig } from '../pet/config.js';
import type { RawPetSprites } from '../render/pet/types.js';
import { DEFAULT_CUSTOMIZATION } from './defaults.js';
import { MigrationError, runMigrations } from './migrations.js';
import type { Customization, Swatch } from './schema.js';
import { CURRENT_SCHEMA_VERSION, isValidCustomization } from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const CONFIG_PATH = resolve(__dirname, '..', '..', 'customization.json');

export function loadCustomization(configPath = CONFIG_PATH): Customization {
  if (!existsSync(configPath)) {
    return structuredClone(DEFAULT_CUSTOMIZATION);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.error('customization.json parse failed, using defaults:', err);
    _backupCorrupt(configPath);
    return structuredClone(DEFAULT_CUSTOMIZATION);
  }

  let migrationResult: ReturnType<typeof runMigrations>;
  try {
    migrationResult = runMigrations(raw);
  } catch (err) {
    if (err instanceof MigrationError) {
      console.error('customization.json migration failed, using defaults:', err.message);
    } else {
      console.error('customization.json load error, using defaults:', err);
    }
    _backupCorrupt(configPath);
    return structuredClone(DEFAULT_CUSTOMIZATION);
  }

  const { value, migratedFrom } = migrationResult;
  const merged = _deepMerge(DEFAULT_CUSTOMIZATION, value);

  if (migratedFrom !== null) {
    const bakPath = resolve(dirname(configPath), `customization.bak.v${migratedFrom}.json`);
    try {
      copyFileSync(configPath, bakPath);
      writeFileSync(configPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
    } catch (err) {
      console.error('customization.json backup/rewrite failed:', err);
    }
  }

  return merged;
}

export function saveCustomization(patch: Partial<Customization>, configPath = CONFIG_PATH): Customization {
  const current = loadCustomization(configPath);
  const next: Customization = {
    ...current,
    ...patch,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
  if (!isValidCustomization(next)) {
    throw new Error('saveCustomization: resulting value is invalid');
  }
  writeFileSync(configPath, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

export function resetCustomization(configPath = CONFIG_PATH): Customization {
  if (existsSync(configPath)) {
    unlinkSync(configPath);
  }
  return structuredClone(DEFAULT_CUSTOMIZATION);
}

function _backupCorrupt(configPath: string): void {
  const corruptPath = resolve(dirname(configPath), 'customization.corrupt.json');
  try {
    if (existsSync(configPath)) {
      copyFileSync(configPath, corruptPath);
    }
  } catch (err) {
    console.error('Failed to back up corrupt customization.json:', err);
  }
}

function _deepMerge(base: Customization, loaded: Customization): Customization {
  const sprites: RawPetSprites = { ...base.sprites, ...(loaded.sprites as object) } as RawPetSprites;

  const baseBehavior = base.behavior;
  const loadedBehavior = loaded.behavior as Partial<PetBehaviorConfig> | undefined;

  const behavior: PetBehaviorConfig = {
    ...baseBehavior,
    ...loadedBehavior,
    day: {
      ...baseBehavior.day,
      ...loadedBehavior?.day,
      transitions: {
        ...baseBehavior.day.transitions,
        ...loadedBehavior?.day?.transitions,
      },
    },
    night: {
      ...baseBehavior.night,
      ...loadedBehavior?.night,
      transitions: {
        ...baseBehavior.night.transitions,
        ...loadedBehavior?.night?.transitions,
      },
    },
  };

  const palette: Swatch[] = Array.isArray(loaded.palette) && loaded.palette.length > 0 ? loaded.palette : base.palette;

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    palette,
    sprites,
    behavior,
    scene: loaded.scene ?? base.scene,
    location: loaded.location ?? base.location,
  };
}
