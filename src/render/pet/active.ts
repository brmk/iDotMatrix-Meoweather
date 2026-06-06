import { DEFAULT_CUSTOMIZATION } from '../../customization/defaults.js';
import type { Customization } from '../../customization/schema.js';
import type { PetBehaviorConfig } from '../../pet/config.js';
import type { Color } from '../types.js';
import { PET_DAY, PET_DREAM_COLOR } from './colors.js';
import { buildPooFadeSteps, buildPukeFadeSteps, DEFAULT_POO_FADE_STEPS, DEFAULT_PUKE_FADE_STEPS, resolvePalette, type FadeSteps } from './palette.js';
import { parsePetSprites } from './sprites.js';
import type { ParsedSprites, PetColor } from './types.js';

interface ActiveCustomization {
  sprites: ParsedSprites;
  day: PetColor;
  night: PetColor;
  dream: Color;
  behavior: PetBehaviorConfig;
  pukeSteps: FadeSteps;
  pooSteps: FadeSteps;
}

function colorEq(a: Color | undefined, b: Color | undefined): boolean {
  if (!a || !b) return false;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function buildActive(c: Customization): ActiveCustomization {
  const { day, night } = resolvePalette(c.palette);

  const gDefault = PET_DAY['g'];
  const sDefault = PET_DAY['s'];
  const pukeSteps = colorEq(day['g'], gDefault) ? DEFAULT_PUKE_FADE_STEPS : buildPukeFadeSteps(day['g']!);
  const pooSteps = colorEq(day['s'], sDefault) ? DEFAULT_POO_FADE_STEPS : buildPooFadeSteps(day['s']!);

  return {
    sprites: parsePetSprites(c.sprites),
    day,
    night,
    dream: PET_DREAM_COLOR,
    behavior: c.behavior,
    pukeSteps,
    pooSteps,
  };
}

let _active: ActiveCustomization | null = null;

export function getActive(): ActiveCustomization {
  if (!_active) {
    _active = buildActive(DEFAULT_CUSTOMIZATION);
  }
  return _active;
}

export function initActiveFromCustomization(c: Customization): void {
  _active = buildActive(c);
}

export const setActiveCustomization = initActiveFromCustomization;
