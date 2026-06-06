import { describe, expect, it } from 'vitest';
import { DEFAULT_CUSTOMIZATION } from '../../customization/defaults.js';
import { PET_DAY, PET_NIGHT } from './colors.js';
import { DEFAULT_POO_FADE_STEPS, DEFAULT_PUKE_FADE_STEPS, NIGHT_FACTOR, darken, resolvePalette } from './palette.js';

describe('darken', () => {
  it('scales each channel by factor', () => {
    expect(darken([200, 100, 50], 0.5)).toEqual([100, 50, 25]);
  });

  it('rounds fractional results', () => {
    expect(darken([100, 100, 100], 0.333)).toEqual([33, 33, 33]);
  });

  it('NIGHT_FACTOR is 0.5', () => {
    expect(NIGHT_FACTOR).toBe(0.5);
  });
});

describe('resolvePalette', () => {
  it('reproduces PET_DAY and PET_NIGHT exactly for default swatches', () => {
    const { day, night } = resolvePalette(DEFAULT_CUSTOMIZATION.palette);
    for (const key of ['o', 'g', 's', 'l', 'r'] as const) {
      expect(day[key]).toEqual(PET_DAY[key]);
      expect(night[key]).toEqual(PET_NIGHT[key]);
    }
  });

  it('auto-darkens when swatch has no night color', () => {
    const swatches = [{ key: 'x', day: [100, 200, 80] as [number, number, number] }];
    const { night } = resolvePalette(swatches);
    expect(night['x']).toEqual(darken([100, 200, 80], NIGHT_FACTOR));
  });

  it('uses explicit night when provided', () => {
    const swatches = [{ key: 'y', day: [100, 100, 100] as [number, number, number], night: [10, 20, 30] as [number, number, number] }];
    const { night } = resolvePalette(swatches);
    expect(night['y']).toEqual([10, 20, 30]);
  });
});

describe('default fade step constants', () => {
  it('DEFAULT_PUKE_FADE_STEPS has 4 steps starting with PET_DAY.g', () => {
    expect(DEFAULT_PUKE_FADE_STEPS).toHaveLength(4);
    expect(DEFAULT_PUKE_FADE_STEPS[0]).toEqual(PET_DAY['g']);
  });

  it('DEFAULT_POO_FADE_STEPS has 4 steps', () => {
    expect(DEFAULT_POO_FADE_STEPS).toHaveLength(4);
    expect(DEFAULT_POO_FADE_STEPS[0]).toEqual([120, 70, 20]);
  });
});
