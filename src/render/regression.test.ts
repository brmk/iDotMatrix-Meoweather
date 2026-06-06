import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { WeatherSnapshot } from '../weather/index.js';
import { renderAnimation, renderToPng } from './index.js';
import { drawPet } from './pet/draw.js';
import { PET_Y_WALK } from './pet/sprites.js';
import type { PetState } from './pet/types.js';
import { render } from './scene/frame.js';

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

function hashBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('render regressions', () => {
  it('keeps representative static frame outputs stable', () => {
    expect(
      hashBytes(
        render(
          makeSnapshot({
            temperature: 22,
            weatherCode: 0,
            isDay: true,
          }),
        ),
      ),
    ).toBe('672ea1ee1e9c70e9f2ec90c15e72917cf739980b2e18c4cf6369521e75b78e5f');

    expect(
      hashBytes(
        render(
          makeSnapshot({
            temperature: -3,
            weatherCode: 45,
            isDay: false,
          }),
        ),
      ),
    ).toBe('debc926bbdc9c40b5cc79d71b93c7f37157471c7cc34028c55e3056a0f90ec02');
  });

  it('keeps representative PNG exports structurally valid', () => {
    const png = renderToPng(
      makeSnapshot({
        temperature: 22,
        weatherCode: 0,
        isDay: true,
      }),
    );

    expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.length).toBeGreaterThan(100);
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
      '6fe3bbf447a51ef9fb19ab7cf9b9ceef691662b1a15857c7c9dd4a59af4c3e97',
      'efcc75e46f949b4a440c05fed04cad6db1a94fed3a6e2eb9f6548afca639cf4b',
      '18581348ad5e0c41a555c2f3da09cdb77af7d56cf7ddf95ae1b3378f2fd4c035',
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

    expect(hashBytes(composite)).toBe('ed4baf08a63940dfb20e18cd242a2008eb72bb6a9947ec291dd18425c7456895');
  });
});
