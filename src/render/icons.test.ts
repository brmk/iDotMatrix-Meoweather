import { describe, expect, it } from 'vitest';
import { ANIM, drawAnimatedIcon, ICON_REGISTRY, listRegisteredIcons } from './icons/registry.js';
import { ICON_TYPES } from './icons/types.js';
import { codeToIcon } from './icons/weather-map.js';

describe('render/icons weather map', () => {
  it.each([
    { code: 0, isDay: true, icon: 'clear-day' },
    { code: 1, isDay: false, icon: 'clear-night' },
    { code: 2, isDay: true, icon: 'partly-cloudy' },
    { code: 2, isDay: false, icon: 'clear-night' },
    { code: 3, isDay: true, icon: 'cloudy' },
    { code: 45, isDay: true, icon: 'fog' },
    { code: 48, isDay: false, icon: 'fog' },
    { code: 51, isDay: true, icon: 'rain' },
    { code: 67, isDay: false, icon: 'rain' },
    { code: 71, isDay: true, icon: 'snow' },
    { code: 77, isDay: false, icon: 'snow' },
    { code: 80, isDay: true, icon: 'rain' },
    { code: 82, isDay: true, icon: 'heavy-rain' },
    { code: 85, isDay: true, icon: 'snow' },
    { code: 95, isDay: false, icon: 'thunder' },
    { code: 99, isDay: true, icon: 'thunder' },
    { code: 999, isDay: true, icon: 'thunder' },
    { code: -5, isDay: false, icon: 'clear-night' },
  ])('maps code $code / isDay=$isDay to $icon', ({ code, isDay, icon }) => {
    expect(codeToIcon(code, isDay)).toBe(icon);
  });
});

describe('render/icons registry', () => {
  it('registers every declared icon type exactly once', () => {
    expect(Object.keys(ICON_REGISTRY).sort()).toEqual([...ICON_TYPES].sort());
    expect([...listRegisteredIcons()].sort()).toEqual([...ICON_TYPES].sort());
  });

  it('keeps ANIM metadata in sync with the registry', () => {
    for (const icon of ICON_TYPES) {
      expect(ANIM[icon]).toEqual({
        count: ICON_REGISTRY[icon].count,
        delayMs: ICON_REGISTRY[icon].delayMs,
      });
    }
  });

  it('stores valid animation metadata for each icon', () => {
    for (const icon of ICON_TYPES) {
      expect(ICON_REGISTRY[icon].count).toBeGreaterThan(0);
      expect(ICON_REGISTRY[icon].delayMs).toBeGreaterThan(0);
      expect(typeof ICON_REGISTRY[icon].draw).toBe('function');
    }
  });

  it('drawAnimatedIcon delegates to a registered drawer', () => {
    const buf = new Uint8Array(32 * 32 * 3);
    expect(() => drawAnimatedIcon(buf, 'clear-day', 0)).not.toThrow();
  });
});
