import { describe, expect, it } from 'vitest';
import type { WeatherSnapshot } from '../weather/index.js';
import { ANIM } from './icons/registry.js';
import { CLOCK_COLOR, compactTemperatureWidth } from './scene/clock-line.js';
import { formatClock, formatCompactTemperature, formatTemperature } from './scene/format.js';
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

  it('formats the compact temperature without the unit', () => {
    expect(formatCompactTemperature(23)).toBe('23°');
    expect(formatCompactTemperature(-24)).toBe('-24°');
  });

  it('puts the temperature flush left and the clock flush right on the bottom line', () => {
    const lit = (px: Uint8Array, x: number, y: number) => px[(y * 32 + x) * 3]! + px[(y * 32 + x) * 3 + 1]! + px[(y * 32 + x) * 3 + 2]! > 0;
    const column = (px: Uint8Array, x: number) => [21, 22, 23, 24, 25].some((y) => lit(px, x, y));
    // cloudy icon never reaches the text line, so the line holds only clock and temperature
    const snapshot = makeSnapshot({ temperature: -24, weatherCode: 3, isDay: true });
    const px = renderAnimationFrames(snapshot, '07:58')[0]!.pixels;

    expect(compactTemperatureWidth('-24°')).toBe(13);
    expect(column(px, 0)).toBe(true);
    expect(column(px, 12)).toBe(true);
    expect(column(px, 13)).toBe(false);
    expect(column(px, 14)).toBe(false);
    expect(column(px, 15)).toBe(true);
    expect(column(px, 31)).toBe(true);
    expect(Array.from(px.subarray((21 * 32 + 15) * 3, (21 * 32 + 15) * 3 + 3))).toEqual(CLOCK_COLOR);
    expect(px).not.toEqual(renderAnimationFrames(snapshot)[0]!.pixels);
  });

  it('pads the line by 1px when the temperature leaves room for it', () => {
    const lit = (px: Uint8Array, x: number, y: number) => px[(y * 32 + x) * 3]! + px[(y * 32 + x) * 3 + 1]! + px[(y * 32 + x) * 3 + 2]! > 0;
    const column = (px: Uint8Array, x: number) => [21, 22, 23, 24, 25].some((y) => lit(px, x, y));
    const px = renderAnimationFrames(makeSnapshot({ temperature: 23, weatherCode: 3, isDay: true }), '07:58')[0]!.pixels;

    expect(column(px, 0)).toBe(false);
    expect(column(px, 1)).toBe(true);
    expect(column(px, 30)).toBe(true);
    expect(column(px, 31)).toBe(false);
  });

  it('keeps the temperature-only line when no clock is given', () => {
    const snapshot = makeSnapshot({ temperature: 18, weatherCode: 3, isDay: true });
    expect(renderAnimationFrames(snapshot)[0]!.pixels).toEqual(renderFrame(describeScene(snapshot), 0));
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
