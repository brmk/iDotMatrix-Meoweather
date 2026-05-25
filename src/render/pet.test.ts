import { describe, expect, it } from 'vitest';
import { RAW_SPRITES } from '../sprites.js';
import { mkBuf } from './canvas.js';
import { resolvePetBehaviorDraw, resolveTailOffset, resolveTailX } from './pet/behaviors.js';
import { PET_DAY, PET_NIGHT } from './pet/colors.js';
import { drawPet, drawPetWithSprites } from './pet/draw.js';
import { parsePetSprites, parseSpritePixels, PET_Y_PERCH, PET_Y_WALK } from './pet/sprites.js';
import type { PetState } from './pet/types.js';

function makeState(overrides: Partial<PetState> = {}): PetState {
  return {
    x: 10,
    facingRight: true,
    behavior: 'walk',
    walkFrame: 0,
    behaviorFrame: 0,
    tailPhase: 0,
    isDay: true,
    eyesClosed: false,
    perchY: PET_Y_WALK,
    pukeItems: [],
    pooItems: [],
    ...overrides,
  };
}

function readPixel(buf: Uint8Array, x: number, y: number): [number, number, number] {
  const index = (y * 32 + x) * 3;
  return [buf[index] ?? 0, buf[index + 1] ?? 0, buf[index + 2] ?? 0];
}

describe('render/pet sprites', () => {
  it('parses only non-empty sprite pixels', () => {
    expect(parseSpritePixels(['.o', 'g.'])).toEqual([
      [1, 0, 'o'],
      [0, 1, 'g'],
    ]);
  });

  it('reuses parsed sprites for the same raw sprite object', () => {
    expect(parsePetSprites(RAW_SPRITES)).toBe(parsePetSprites(RAW_SPRITES));
  });
});

describe('render/pet drawing', () => {
  it('uses day colors for daytime walking sprites', () => {
    const buf = mkBuf();
    drawPet(buf, makeState({ isDay: true, behavior: 'walk', x: 0 }));

    expect(readPixel(buf, 2, PET_Y_WALK + 1)).toEqual([...PET_DAY.g]);
  });

  it('uses night colors for nighttime walking sprites', () => {
    const buf = mkBuf();
    drawPet(buf, makeState({ isDay: false, behavior: 'walk', x: 0 }));

    expect(readPixel(buf, 2, PET_Y_WALK + 1)).toEqual([...PET_NIGHT.g]);
  });

  it('mirrors custom sprite pixels when facing left', () => {
    const buf = mkBuf();
    const customSprites = {
      ...RAW_SPRITES,
      WALK_A: ['o....'],
    };

    drawPetWithSprites(buf, makeState({ facingRight: false, x: 4, walkFrame: 0 }), customSprites);

    expect(readPixel(buf, 8, PET_Y_WALK)).toEqual([...PET_DAY.o]);
    expect(readPixel(buf, 4, PET_Y_WALK)).toEqual([0, 0, 0]);
  });

  it('draws the dream indicator at the expected phase positions', () => {
    const baseState = makeState({ behavior: 'dream', x: 5 });

    const phase0 = mkBuf();
    drawPet(phase0, { ...baseState, behaviorFrame: 0 });
    expect(readPixel(phase0, 7, PET_Y_WALK - 1)).toEqual([160, 160, 255]);

    const phase3 = mkBuf();
    drawPet(phase3, { ...baseState, behaviorFrame: 3 });
    expect(readPixel(phase3, 8, PET_Y_WALK - 2)).toEqual([160, 160, 255]);

    const phase6 = mkBuf();
    drawPet(phase6, { ...baseState, behaviorFrame: 6 });
    expect(readPixel(phase6, 9, PET_Y_WALK - 3)).toEqual([160, 160, 255]);
  });

  it('draws the burp stream once, then leaves a fading floor pixel', () => {
    const baseState = makeState({ behavior: 'burp', x: 5, facingRight: true });

    const phase1 = mkBuf();
    drawPet(phase1, { ...baseState, behaviorFrame: 1, pukeItems: [{ x: 10, y: PET_Y_WALK + 3, ttl: 15 }] });
    expect(readPixel(phase1, 9, PET_Y_WALK + 2)).toEqual([...PET_DAY.g]);
    expect(readPixel(phase1, 10, PET_Y_WALK + 3)).toEqual([50, 220, 80]);

    const phase5 = mkBuf();
    drawPet(phase5, { ...baseState, behaviorFrame: 5, pukeItems: [{ x: 10, y: PET_Y_WALK + 3, ttl: 9 }] });
    expect(readPixel(phase5, 11, PET_Y_WALK + 3)).toEqual([0, 0, 0]);
    expect(readPixel(phase5, 10, PET_Y_WALK + 3)).toEqual([42, 185, 68]);

    const phase13 = mkBuf();
    drawPet(phase13, { ...baseState, behavior: 'walk', behaviorFrame: 0, pukeItems: [{ x: 10, y: PET_Y_WALK + 3, ttl: 3 }] });
    expect(readPixel(phase13, 10, PET_Y_WALK + 3)).toEqual([24, 110, 40]);

    const cleared = mkBuf();
    drawPet(cleared, { ...baseState, behavior: 'walk', behaviorFrame: 0 });
    expect(readPixel(cleared, 10, PET_Y_WALK + 3)).toEqual([0, 0, 0]);
  });
});

describe('render/pet behavior resolution', () => {
  const sprites = parsePetSprites(RAW_SPRITES);

  it('resolves sit, lie, jump, perch, dream, and burp poses explicitly', () => {
    expect(resolvePetBehaviorDraw(makeState({ behavior: 'sit', behaviorFrame: 20 }), sprites)).toMatchObject({
      baseY: PET_Y_WALK,
      drawTail: false,
      pixels: sprites.SIT[1],
    });

    expect(resolvePetBehaviorDraw(makeState({ behavior: 'lie', behaviorFrame: 30 }), sprites)).toMatchObject({
      baseY: PET_Y_WALK + 1,
      drawTail: true,
      pixels: sprites.LIE[1],
    });

    expect(resolvePetBehaviorDraw(makeState({ behavior: 'jump', behaviorFrame: 5 }), sprites)).toMatchObject({
      baseY: PET_Y_WALK - 1,
      drawTail: true,
      pixels: sprites.JUMP[2]!.pix,
    });

    expect(resolvePetBehaviorDraw(makeState({ behavior: 'perch', perchY: PET_Y_PERCH, eyesClosed: true }), sprites)).toMatchObject({
      baseY: PET_Y_PERCH,
      drawTail: true,
      pixels: sprites.WALK_BLINK[0],
    });

    expect(resolvePetBehaviorDraw(makeState({ behavior: 'dream' }), sprites)).toMatchObject({
      baseY: PET_Y_WALK,
      drawTail: false,
      pixels: sprites.DREAM,
    });

    expect(resolvePetBehaviorDraw(makeState({ behavior: 'burp', behaviorFrame: 4 }), sprites)).toMatchObject({
      baseY: PET_Y_WALK,
      drawTail: false,
      pixels: sprites.BURP[1],
    });
  });

  it('resolves tail helpers from direction and phase', () => {
    expect(resolveTailOffset(makeState({ tailPhase: 0 }))).toBe(1);
    expect(resolveTailOffset(makeState({ tailPhase: 1 }))).toBe(2);
    expect(resolveTailX(makeState({ x: 4, facingRight: true }))).toBe(4);
    expect(resolveTailX(makeState({ x: 4, facingRight: false }))).toBe(8);
  });
});
