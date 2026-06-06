import type { Swatch } from '../../customization/schema.js';
import type { Color } from '../types.js';
import type { PetColor } from './types.js';

export type FadeSteps = ReadonlyArray<readonly [number, number, number]>;

export const NIGHT_FACTOR = 0.5;

export function darken(c: Color, factor: number): Color {
  return [Math.round(c[0] * factor), Math.round(c[1] * factor), Math.round(c[2] * factor)];
}

export function resolvePalette(swatches: Swatch[]): { day: PetColor; night: PetColor } {
  const day: PetColor = {};
  const night: PetColor = {};
  for (const swatch of swatches) {
    day[swatch.key] = swatch.day;
    night[swatch.key] = swatch.night ?? darken(swatch.day, NIGHT_FACTOR);
  }
  return { day, night };
}

// Hand-crafted ramps preserved verbatim from the original draw.ts constants.
// These are used when the resolved palette matches the defaults (ensuring pixel-identical output).
// For user-customized swatches, buildFadeSteps generates proportional ramps instead.
export const DEFAULT_PUKE_FADE_STEPS: FadeSteps = [
  [50, 220, 80],
  [42, 185, 68],
  [34, 150, 56],
  [24, 110, 40],
];

export const DEFAULT_POO_FADE_STEPS: FadeSteps = [
  [120, 70, 20],
  [100, 58, 16],
  [80, 46, 12],
  [60, 35, 9],
];

// Proportional factors for custom puke ramp (derived from DEFAULT_PUKE_FADE_STEPS / default base [50,220,80])
const PUKE_FACTORS = [1.0, 0.84, 0.68, 0.5] as const;
// Proportional factors for custom poo ramp (four even steps from 1.0 → 0.5)
const POO_FACTORS = [1.0, 0.833, 0.667, 0.5] as const;

export function buildFadeSteps(base: Color, factors: readonly number[]): FadeSteps {
  return factors.map((f) => [Math.round(base[0] * f), Math.round(base[1] * f), Math.round(base[2] * f)] as const);
}

export function buildPukeFadeSteps(gColor: Color): FadeSteps {
  return buildFadeSteps(gColor, PUKE_FACTORS);
}

export function buildPooFadeSteps(sColor: Color): FadeSteps {
  return buildFadeSteps(sColor, POO_FACTORS);
}
