import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { WeatherSnapshot } from '../weather/index.js';
import { renderAnimation, renderToPng } from './index.js';
import { drawPet } from './pet/draw.js';
import { PET_Y_WALK } from './pet/sprites.js';
import type { PetState } from './pet/types.js';

function makeSnapshot(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    temperature: 0,
    weatherCode: 0,
    isDay: true,
    fetchedAt: new Date('2026-05-25T00:00:00.000Z'),
    ...overrides,
  };
}

function hashBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('render regressions', () => {
  it('keeps representative static PNG outputs stable', () => {
    expect(
      hashBytes(
        renderToPng(
          makeSnapshot({
            temperature: 22,
            weatherCode: 0,
            isDay: true,
          }),
        ),
      ),
    ).toBe('80456e03643e45a430affe3633d1806d70cf15c16e8a7f6546f40907c92a8871');

    expect(
      hashBytes(
        renderToPng(
          makeSnapshot({
            temperature: -3,
            weatherCode: 45,
            isDay: false,
          }),
        ),
      ),
    ).toBe('05ade2012a290ef32b28039acb9615d5e433bcd6ce8f8965a39b0f34ff00f0c2');
  });

  it('keeps representative thunder animation frames stable', () => {
    const frames = renderAnimation(
      makeSnapshot({
        temperature: 14,
        weatherCode: 95,
        isDay: false,
      }),
    );

    expect([0, 6, 7].map((frame) => hashBytes(frames[frame]!.pixels))).toEqual([
      'f9b2741235b1df083ac4c47aa6f3ea380f2236a8d29015aef861f340a9d60e3e',
      '86f95878c05ecb8f641c7b7c865846b6abd5128d01e3efab167a4b5b8f88b4d2',
      '8414480d9da3e17b687ab853d7e4c8a548e69a39fed08933c0f2776973fd8085',
    ]);
  });

  it('keeps a representative pet-overlay frame stable', () => {
    const weatherFrame = renderAnimation(
      makeSnapshot({
        temperature: 9,
        weatherCode: 3,
        isDay: true,
      }),
    )[0]!;

    const pet: PetState = {
      x: 3,
      facingRight: true,
      behavior: 'walk',
      walkFrame: 1,
      behaviorFrame: 0,
      tailPhase: 2,
      isDay: true,
      eyesClosed: false,
      perchY: PET_Y_WALK,
      pukeItems: [],
      pooItems: [],
    };

    const composite = new Uint8Array(weatherFrame.pixels);
    drawPet(composite, pet);

    expect(hashBytes(composite)).toBe('63ae977e14049731b2d5136581427449045382cda291a1048b2c2031e8f5c113');
  });
});
