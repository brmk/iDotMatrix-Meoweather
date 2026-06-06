import type { PetBehaviorConfig } from '../pet/config.js';
import type { RawPetSprites } from '../render/pet/types.js';
import type { Color } from '../render/types.js';

export interface Swatch {
  key: string;
  day: Color;
  night?: Color;
}

// Forward slot for Phase 7 — intentionally empty until that phase defines fields
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SceneTheme {}

export interface GeoCoord {
  lat: number;
  lon: number;
}

export interface Customization {
  schemaVersion: number;
  palette: Swatch[];
  sprites: RawPetSprites;
  behavior: PetBehaviorConfig;
  scene?: SceneTheme;
  location?: GeoCoord;
}

export const CURRENT_SCHEMA_VERSION = 1;

// Semantic roles referenced by key in draw.ts — recolorable but never removable
const RESERVED_ROLES = ['o', 'g', 's', 'l', 'r'] as const;

export function isValidCustomization(x: unknown): x is Customization {
  if (typeof x !== 'object' || x === null) return false;
  const c = x as Record<string, unknown>;

  if (typeof c['schemaVersion'] !== 'number') return false;

  if (!Array.isArray(c['palette'])) return false;
  for (const swatch of c['palette'] as unknown[]) {
    if (typeof swatch !== 'object' || swatch === null) return false;
    const s = swatch as Record<string, unknown>;
    if (typeof s['key'] !== 'string' || s['key'].length !== 1) return false;
    if (!isColor(s['day'])) return false;
    if (s['night'] !== undefined && !isColor(s['night'])) return false;
  }

  const keys = new Set((c['palette'] as Array<{ key: string }>).map((s) => s.key));
  for (const role of RESERVED_ROLES) {
    if (!keys.has(role)) return false;
  }

  if (typeof c['sprites'] !== 'object' || c['sprites'] === null || Array.isArray(c['sprites'])) return false;
  if (typeof c['behavior'] !== 'object' || c['behavior'] === null || Array.isArray(c['behavior'])) return false;

  return true;
}

function isColor(x: unknown): x is Color {
  return Array.isArray(x) && x.length === 3 && x.every((n) => typeof n === 'number');
}
