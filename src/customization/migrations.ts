import { DEFAULT_CUSTOMIZATION } from './defaults.js';
import type { Customization } from './schema.js';
import { CURRENT_SCHEMA_VERSION, isValidCustomization } from './schema.js';

type Migration = (old: unknown) => unknown;

// Keyed by source version. Add entries here as the schema evolves.
// e.g. [0]: (old) => ({ ...old, newField: defaultValue })
const MIGRATIONS: Record<number, Migration> = {};

export class MigrationError extends Error {}

export function runMigrations(raw: unknown): { value: Customization; migratedFrom: number | null } {
  const rawObj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const from = typeof rawObj['schemaVersion'] === 'number' ? (rawObj['schemaVersion'] as number) : 0;

  if (from > CURRENT_SCHEMA_VERSION) {
    console.warn(`customization.json schemaVersion=${from} > current=${CURRENT_SCHEMA_VERSION}; using defaults`);
    return { value: structuredClone(DEFAULT_CUSTOMIZATION), migratedFrom: null };
  }

  if (from === CURRENT_SCHEMA_VERSION) {
    if (!isValidCustomization(raw)) {
      throw new MigrationError(`Invalid customization shape at schemaVersion=${from}`);
    }
    return { value: raw as Customization, migratedFrom: null };
  }

  // from < CURRENT_SCHEMA_VERSION — run migration chain
  let current: Record<string, unknown> = { ...rawObj };

  for (let v = from; v < CURRENT_SCHEMA_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (migrate) {
      try {
        current = migrate(current) as Record<string, unknown>;
      } catch (e) {
        throw new MigrationError(`Migration v${v}→v${v + 1} failed: ${String(e)}`);
      }
    }
    current['schemaVersion'] = v + 1;
    if (!isValidCustomization(current)) {
      throw new MigrationError(`Customization invalid after migration to v${v + 1}`);
    }
  }

  return { value: current as unknown as Customization, migratedFrom: from };
}

// Exported for testing: allows injecting a custom migrations map without mutating the module
export function runMigrationsWithTable(
  raw: unknown,
  migrations: Record<number, Migration>,
  currentVersion: number,
): { value: Customization; migratedFrom: number | null } {
  const rawObj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const from = typeof rawObj['schemaVersion'] === 'number' ? (rawObj['schemaVersion'] as number) : 0;

  if (from > currentVersion) {
    return { value: structuredClone(DEFAULT_CUSTOMIZATION), migratedFrom: null };
  }

  if (from === currentVersion) {
    if (!isValidCustomization(raw)) {
      throw new MigrationError(`Invalid customization shape at schemaVersion=${from}`);
    }
    return { value: raw as Customization, migratedFrom: null };
  }

  let current: Record<string, unknown> = { ...rawObj };

  for (let v = from; v < currentVersion; v++) {
    const migrate = migrations[v];
    if (migrate) {
      try {
        current = migrate(current) as Record<string, unknown>;
      } catch (e) {
        throw new MigrationError(`Migration v${v}→v${v + 1} failed: ${String(e)}`);
      }
    }
    current['schemaVersion'] = v + 1;
    if (v + 1 === currentVersion && !isValidCustomization(current)) {
      throw new MigrationError(`Customization invalid after migration to v${v + 1}`);
    }
  }

  return { value: current as unknown as Customization, migratedFrom: from };
}
