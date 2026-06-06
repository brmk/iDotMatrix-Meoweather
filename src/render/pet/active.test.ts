import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_CUSTOMIZATION } from '../../customization/defaults.js';
import type { Customization } from '../../customization/schema.js';
import { getActive, initActiveFromCustomization, setActiveCustomization } from './active.js';
import { PET_DAY, PET_DREAM_COLOR, PET_NIGHT } from './colors.js';

afterEach(() => {
  // Restore defaults after each test so state doesn't leak.
  initActiveFromCustomization(DEFAULT_CUSTOMIZATION);
});

describe('getActive', () => {
  it('lazy-seeds from DEFAULT_CUSTOMIZATION before any explicit init', () => {
    const active = getActive();
    expect(active.day['o']).toEqual(PET_DAY['o']);
    expect(active.night['o']).toEqual(PET_NIGHT['o']);
  });

  it('dream is always PET_DREAM_COLOR', () => {
    expect(getActive().dream).toEqual(PET_DREAM_COLOR);
  });
});

describe('initActiveFromCustomization / setActiveCustomization', () => {
  it('updates day/night palette after init', () => {
    const modified: Customization = {
      ...DEFAULT_CUSTOMIZATION,
      palette: DEFAULT_CUSTOMIZATION.palette.map((s) => (s.key === 'o' ? { ...s, day: [0, 0, 255] as [number, number, number] } : s)),
    };
    initActiveFromCustomization(modified);
    expect(getActive().day['o']).toEqual([0, 0, 255]);
  });

  it('setActiveCustomization is an alias for initActiveFromCustomization', () => {
    const modified: Customization = {
      ...DEFAULT_CUSTOMIZATION,
      palette: DEFAULT_CUSTOMIZATION.palette.map((s) => (s.key === 'g' ? { ...s, day: [255, 0, 0] as [number, number, number] } : s)),
    };
    setActiveCustomization(modified);
    expect(getActive().day['g']).toEqual([255, 0, 0]);
  });

  it('stores behavior config from customization', () => {
    expect(getActive().behavior).toBe(DEFAULT_CUSTOMIZATION.behavior);
  });

  it('dream remains PET_DREAM_COLOR regardless of customization', () => {
    initActiveFromCustomization(DEFAULT_CUSTOMIZATION);
    expect(getActive().dream).toEqual(PET_DREAM_COLOR);
  });
});
