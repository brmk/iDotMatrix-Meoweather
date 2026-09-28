import { describe, expect, it } from 'vitest';
import type { WeatherSnapshot } from '../weather/index.js';
import { ANIM } from './icons/registry.js';
import { formatClock, formatTemperature } from './scene/format.js';
import { describeScene, render, renderAnimationFrames, renderFrame } from './scene/frame.js';
import { applyNightTint } from './scene/tint.js';

function makeSnapshot(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    temperature: 0,
    weatherCode: 0,
    isDay: true,
    humidity: 50,
    windSpeed: 10,
    windDirection: 0,
    fetchedAt: new Date('2026-05-25T00:00:00.000Z'),
    ...overrides,
  };
}

describe('render/scene', () => {
  it('formats positive and negative temperatures consistently', () => {
    expect(formatTemperature(7)).toBe('7°C');
    expect(formatTemperature(-12)).toBe('-12°C');
  });

  it('formats the clock as zero-padded 24-hour local time', () => {
    expect(formatClock(new Date(2026, 8, 27, 7, 5))).toBe('07:05');
    expect(formatClock(new Date(2026, 8, 27, 23, 59))).toBe('23:59');
  });

  it('replaces the temperature line with the given text', () => {
    const snapshot = makeSnapshot({ temperature: 18, weatherCode: 3, isDay: true });
    const withClock = renderAnimationFrames(snapshot, '12:34');
    const expected = renderFrame({ ...describeScene(snapshot), temperatureText: '12:34' }, 0);
    expect(withClock[0]!.pixels).toEqual(expected);
    expect(withClock[0]!.pixels).not.toEqual(renderAnimationFrames(snapshot)[0]!.pixels);
  });

  it('derives icon and temperature text from the snapshot once', () => {
    expect(describeScene(makeSnapshot({ temperature: -3, weatherCode: 2, isDay: false, humidity: 60, windSpeed: 8 }))).toEqual({
      icon: 'clear-night',
      temperatureText: '-3°C',
      isDay: false,
      humidity: 60,
      windSpeed: 8,
    });
  });

  it('applies the same frame composition path to static and animated rendering', () => {
    const snapshot = makeSnapshot({ temperature: 18, weatherCode: 3, isDay: true });
    const scene = describeScene(snapshot);

    expect(render(snapshot)).toEqual(renderFrame(scene, 0));
  });

  it('uses icon animation metadata to build the frame list', () => {
    const snapshot = makeSnapshot({ temperature: 6, weatherCode: 61, isDay: true });
    const frames = renderAnimationFrames(snapshot);

    expect(frames).toHaveLength(ANIM.rain.count);
    expect(new Set(frames.map((frame) => frame.delayMs))).toEqual(new Set([ANIM.rain.delayMs]));
  });

  it('night tint dims green and blue channels only', () => {
    const pixels = Uint8Array.from([100, 200, 180]);
    applyNightTint(pixels);

    expect(Array.from(pixels)).toEqual([100, 170, 81]);
  });
});
