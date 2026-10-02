import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PET_BEHAVIOR_CONFIG } from '../pet/config.js';
import { RAW_SPRITES } from '../sprites.js';
import { DEFAULT_CUSTOMIZATION } from './defaults.js';
import { loadCustomization, resetCustomization, saveCustomization } from './index.js';
import { MigrationError, runMigrations, runMigrationsWithTable } from './migrations.js';
import { CURRENT_SCHEMA_VERSION, isValidCustomization } from './schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'customization-test-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function configPath(): string {
  return join(tmpDir, 'customization.json');
}

function write(data: unknown): void {
  writeFileSync(configPath(), JSON.stringify(data, null, 2), 'utf8');
}

function read(): unknown {
  return JSON.parse(readFileSync(configPath(), 'utf8'));
}

// A fully valid customization object without schemaVersion (v0 legacy fixture)
const LEGACY_FIXTURE = {
  palette: [
    { key: 'o', day: [255, 155, 30], night: [130, 75, 15] },
    { key: 'g', day: [50, 220, 80], night: [20, 100, 35] },
    { key: 's', day: [184, 74, 10], night: [95, 38, 5] },
    { key: 'l', day: [255, 205, 130], night: [130, 105, 65] },
    { key: 'r', day: [225, 145, 65], night: [115, 74, 33] },
  ],
  sprites: { ...RAW_SPRITES },
  behavior: PET_BEHAVIOR_CONFIG,
};

// ---------------------------------------------------------------------------
// loadCustomization
// ---------------------------------------------------------------------------

describe('loadCustomization', () => {
  it('returns defaults when no file exists', () => {
    const result = loadCustomization(configPath());
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.palette).toHaveLength(DEFAULT_CUSTOMIZATION.palette.length);
    expect(result.palette.map((s) => s.key)).toEqual(DEFAULT_CUSTOMIZATION.palette.map((s) => s.key));
    // Not the same object reference
    expect(result).not.toBe(DEFAULT_CUSTOMIZATION);
  });

  it('round-trips: saved value is returned on next load', () => {
    const custom = {
      ...DEFAULT_CUSTOMIZATION,
      palette: [
        { key: 'o', day: [1, 2, 3] as [number, number, number] },
        { key: 'g', day: [4, 5, 6] as [number, number, number] },
        { key: 's', day: [7, 8, 9] as [number, number, number] },
        { key: 'l', day: [10, 11, 12] as [number, number, number] },
        { key: 'r', day: [13, 14, 15] as [number, number, number] },
      ],
    };
    saveCustomization(custom, configPath());
    const loaded = loadCustomization(configPath());
    expect(loaded.palette[0]?.day).toEqual([1, 2, 3]);
    expect(loaded.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('migrates a legacy v0 file: stamps version, rewrites file, creates backup', () => {
    write(LEGACY_FIXTURE);

    const result = loadCustomization(configPath());

    // In-memory result is stamped with current version
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.palette).toHaveLength(5);

    // File on disk is rewritten with schemaVersion
    const onDisk = read() as { schemaVersion: number };
    expect(onDisk.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);

    // Backup was created
    const bakPath = join(tmpDir, 'customization.bak.v0.json');
    expect(existsSync(bakPath)).toBe(true);
  });

  it('returns defaults and creates corrupt backup for invalid JSON', () => {
    writeFileSync(configPath(), 'not valid json {{{', 'utf8');

    const result = loadCustomization(configPath());

    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.palette.map((s) => s.key)).toEqual(DEFAULT_CUSTOMIZATION.palette.map((s) => s.key));

    const corruptPath = join(tmpDir, 'customization.corrupt.json');
    expect(existsSync(corruptPath)).toBe(true);
  });

  it('returns defaults and does NOT rewrite a future-version file', () => {
    const futureFile = { schemaVersion: 999, ...LEGACY_FIXTURE };
    write(futureFile);

    const result = loadCustomization(configPath());

    // Defaults in memory
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);

    // Original file is untouched
    const onDisk = read() as { schemaVersion: number };
    expect(onDisk.schemaVersion).toBe(999);

    // No backup was created (file was not mutated)
    const bakPath = join(tmpDir, 'customization.bak.v999.json');
    expect(existsSync(bakPath)).toBe(false);
  });

  it('fills missing sprite keys from defaults after partial load', () => {
    const partial = {
      ...DEFAULT_CUSTOMIZATION,
      sprites: { ...RAW_SPRITES, WALK_A: ['xxxxx'] },
    };
    saveCustomization(partial, configPath());
    const loaded = loadCustomization(configPath());
    expect(loaded.sprites.WALK_A).toEqual(['xxxxx']);
    // Other sprite keys preserved from file (merged over defaults)
    expect(loaded.sprites.WALK_B).toEqual(RAW_SPRITES.WALK_B);
  });
});

// ---------------------------------------------------------------------------
// saveCustomization
// ---------------------------------------------------------------------------

describe('saveCustomization', () => {
  it('persists palette patch and stamps current schema version', () => {
    const newPalette = [
      { key: 'o', day: [0, 0, 0] as [number, number, number] },
      { key: 'g', day: [1, 1, 1] as [number, number, number] },
      { key: 's', day: [2, 2, 2] as [number, number, number] },
      { key: 'l', day: [3, 3, 3] as [number, number, number] },
      { key: 'r', day: [4, 4, 4] as [number, number, number] },
    ];
    const saved = saveCustomization({ palette: newPalette }, configPath());
    expect(saved.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(saved.palette[0]?.day).toEqual([0, 0, 0]);
  });
});

// ---------------------------------------------------------------------------
// resetCustomization
// ---------------------------------------------------------------------------

describe('resetCustomization', () => {
  it('deletes the file and returns defaults', () => {
    saveCustomization(DEFAULT_CUSTOMIZATION, configPath());
    expect(existsSync(configPath())).toBe(true);

    const result = resetCustomization(configPath());
    expect(existsSync(configPath())).toBe(false);
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.palette.map((s) => s.key)).toEqual(DEFAULT_CUSTOMIZATION.palette.map((s) => s.key));
  });

  it('is a no-op when file does not exist', () => {
    expect(() => resetCustomization(configPath())).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// isValidCustomization — edge cases
// ---------------------------------------------------------------------------

describe('isValidCustomization', () => {
  it('returns false for non-object inputs', () => {
    expect(isValidCustomization(null)).toBe(false);
    expect(isValidCustomization('string')).toBe(false);
    expect(isValidCustomization(42)).toBe(false);
  });

  it('returns false when schemaVersion is missing', () => {
    expect(isValidCustomization({ palette: [], sprites: {}, behavior: {} })).toBe(false);
  });

  it('returns false when palette is not an array', () => {
    expect(isValidCustomization({ schemaVersion: 1, palette: 'bad', sprites: {}, behavior: {} })).toBe(false);
  });

  it('returns false when a swatch key is multi-char', () => {
    const bad = {
      schemaVersion: 1,
      palette: [{ key: 'oo', day: [1, 2, 3] }],
      sprites: {},
      behavior: {},
    };
    expect(isValidCustomization(bad)).toBe(false);
  });

  it('returns false when a swatch has an invalid day color', () => {
    const bad = {
      schemaVersion: 1,
      palette: [{ key: 'o', day: 'red' }],
      sprites: {},
      behavior: {},
    };
    expect(isValidCustomization(bad)).toBe(false);
  });

  it('returns false when a swatch has an invalid night color', () => {
    const bad = {
      schemaVersion: 1,
      palette: [{ key: 'o', day: [1, 2, 3], night: 'dark' }],
      sprites: {},
      behavior: {},
    };
    expect(isValidCustomization(bad)).toBe(false);
  });

  it('returns false when a reserved role is missing from palette', () => {
    const paletteWithoutG = [
      { key: 'o', day: [1, 2, 3] },
      { key: 's', day: [1, 2, 3] },
      { key: 'l', day: [1, 2, 3] },
      { key: 'r', day: [1, 2, 3] },
    ];
    expect(isValidCustomization({ schemaVersion: 1, palette: paletteWithoutG, sprites: {}, behavior: {} })).toBe(false);
  });

  it('returns false when sprites is an array', () => {
    const c = { schemaVersion: 1, palette: DEFAULT_CUSTOMIZATION.palette, sprites: [], behavior: {} };
    expect(isValidCustomization(c)).toBe(false);
  });

  it('returns false when behavior is an array', () => {
    const c = { schemaVersion: 1, palette: DEFAULT_CUSTOMIZATION.palette, sprites: {}, behavior: [] };
    expect(isValidCustomization(c)).toBe(false);
  });

  it('returns false when a palette entry is not an object', () => {
    const bad = { schemaVersion: 1, palette: ['not-an-object'], sprites: {}, behavior: {} };
    expect(isValidCustomization(bad)).toBe(false);
  });

  it('returns true for a valid DEFAULT_CUSTOMIZATION', () => {
    expect(isValidCustomization(DEFAULT_CUSTOMIZATION)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runMigrations — direct tests
// ---------------------------------------------------------------------------

describe('runMigrations', () => {
  it('throws MigrationError when current-version file has invalid shape', () => {
    const invalid = { schemaVersion: CURRENT_SCHEMA_VERSION, palette: 'bad', sprites: {}, behavior: {} };
    expect(() => runMigrations(invalid)).toThrow(MigrationError);
  });

  it('throws MigrationError when a v0 file is structurally invalid after stamp', () => {
    // Valid JSON but missing required customization fields — migration stamps v1, then validation fails
    const broken = { someField: 'value' };
    expect(() => runMigrations(broken)).toThrow(MigrationError);
  });
});

// ---------------------------------------------------------------------------
// loadCustomization — migration failure path
// ---------------------------------------------------------------------------

describe('loadCustomization — migration failure', () => {
  it('returns defaults and backs up when migration produces invalid shape', () => {
    // Write a structurally invalid v0 file (valid JSON, but not a valid Customization)
    writeFileSync(configPath(), JSON.stringify({ someField: 'not a customization' }), 'utf8');

    const result = loadCustomization(configPath());
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);

    // Corrupt backup created
    const corruptPath = join(tmpDir, 'customization.corrupt.json');
    expect(existsSync(corruptPath)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// saveCustomization — validation failure
// ---------------------------------------------------------------------------

describe('saveCustomization — invalid patch', () => {
  it('throws when the patch produces an invalid customization', () => {
    // Force an invalid shape by overriding palette with a bad value
    expect(() => saveCustomization({ palette: [{ key: 'bad-key', day: [0, 0, 0] }] }, configPath())).toThrow('saveCustomization: resulting value is invalid');
  });
});

// ---------------------------------------------------------------------------
// runMigrationsWithTable — chain test with injected migrations
// ---------------------------------------------------------------------------

describe('runMigrationsWithTable', () => {
  it('applies a 2-step chain in order and validates at the final step', () => {
    // Build a v0 object that becomes valid after 2 migrations bring it to v2
    const v0Object = {
      ...LEGACY_FIXTURE,
      // no schemaVersion
    };

    // Migration 0→1: identity (just stamps version — handled by runner)
    // Migration 1→2: identity (just stamps version — handled by runner)
    const fakeMigrations: Record<number, (old: unknown) => unknown> = {};

    const result = runMigrationsWithTable(v0Object, fakeMigrations, 2);
    expect(result.migratedFrom).toBe(0);
    expect(result.value.schemaVersion).toBe(2);
  });

  it('applies a migration function that transforms the object', () => {
    const v0Object = { ...LEGACY_FIXTURE };

    // Migration 0→1 adds an extra swatch (for test purposes we keep valid reserved roles)
    const fakeMigrations: Record<number, (old: unknown) => unknown> = {
      0: (old: unknown) => {
        const o = old as Record<string, unknown>;
        return {
          ...o,
          customField: 'added',
        };
      },
    };

    const result = runMigrationsWithTable(v0Object, fakeMigrations, 1);
    expect(result.migratedFrom).toBe(0);
    // The extra field is present (not stripped by migration runner)
    expect((result.value as unknown as Record<string, unknown>)['customField']).toBe('added');
  });

  it('throws MigrationError when a migration function throws', () => {
    const v0Object = { ...LEGACY_FIXTURE };
    const fakeMigrations: Record<number, (old: unknown) => unknown> = {
      0: () => {
        throw new Error('boom');
      },
    };

    expect(() => runMigrationsWithTable(v0Object, fakeMigrations, 1)).toThrow(MigrationError);
  });

  it('returns defaults for a future-version object', () => {
    const future = { schemaVersion: 99, ...LEGACY_FIXTURE };
    const result = runMigrationsWithTable(future, {}, 1);
    expect(result.migratedFrom).toBeNull();
    expect(result.value.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('returns value with migratedFrom: null for a valid current-version object', () => {
    const valid = { ...DEFAULT_CUSTOMIZATION };
    const result = runMigrationsWithTable(valid, {}, CURRENT_SCHEMA_VERSION);
    expect(result.migratedFrom).toBeNull();
    expect(result.value.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('throws MigrationError when current-version object has invalid shape', () => {
    const invalid = { schemaVersion: 1, palette: 'bad', sprites: {}, behavior: {} };
    expect(() => runMigrationsWithTable(invalid, {}, 1)).toThrow(MigrationError);
  });

  it('throws MigrationError when migration produces invalid final shape', () => {
    const v0Object = { ...LEGACY_FIXTURE };
    const fakeMigrations: Record<number, (old: unknown) => unknown> = {
      0: () => ({ schemaVersion: 1, palette: 'destroyed', sprites: {}, behavior: {} }),
    };
    expect(() => runMigrationsWithTable(v0Object, fakeMigrations, 1)).toThrow(MigrationError);
  });
});
