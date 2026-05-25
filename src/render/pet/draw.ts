import { set } from '../canvas.js';
import { resolvePetBehaviorDraw, resolveTailOffset, resolveTailX } from './behaviors.js';
import { PET_DAY, PET_DREAM_COLOR, PET_NIGHT } from './colors.js';
import { DEFAULT_PET_SPRITES, PET_WIDTH, PET_Y_PERCH, PET_Y_WALK, parsePetSprites } from './sprites.js';
import type { ParsedSprites, PetColor, PetState, Pixel, RawPetSprites } from './types.js';

const PUKE_FADE_STEPS: ReadonlyArray<readonly [number, number, number]> = [
  [50, 220, 80],
  [42, 185, 68],
  [34, 150, 56],
  [24, 110, 40],
];

const POO_FADE_STEPS: ReadonlyArray<readonly [number, number, number]> = [
  [120, 70, 20],
  [100, 58, 16],
  [80, 46, 12],
  [60, 35, 9],
];

function blit(buf: Uint8Array, pixels: Pixel[], x: number, y: number, mirror: boolean, colors: PetColor): void {
  for (const [dx, dy, colorKey] of pixels) {
    const px = mirror ? x + (PET_WIDTH - 1 - dx) : x + dx;
    const color = colors[colorKey];
    if (color) set(buf, px, y + dy, color);
  }
}

function drawDream(buf: Uint8Array, state: PetState): void {
  const zX = state.x + 2;
  const phase = state.behaviorFrame % 12;

  if (phase < 3) set(buf, zX, PET_Y_WALK - 1, PET_DREAM_COLOR);
  if (phase >= 3 && phase < 6) set(buf, zX + 1, PET_Y_WALK - 2, PET_DREAM_COLOR);
  if (phase >= 6 && phase < 9) set(buf, zX + 2, PET_Y_WALK - 3, PET_DREAM_COLOR);
}

function drawBurp(buf: Uint8Array, state: PetState, tailColor: readonly [number, number, number]): void {
  const phase = state.behaviorFrame;
  const mouthX = state.facingRight ? state.x + PET_WIDTH - 1 : state.x;
  const dir = state.facingRight ? 1 : -1;
  const streamX = mouthX + dir;

  if (phase < 3) {
    set(buf, mouthX, PET_Y_WALK + 2, tailColor);
    set(buf, streamX, PET_Y_WALK + 3, tailColor);
  }
}

function pukeFadeIndex(ttl: number): number {
  if (ttl >= 12) return 0;
  if (ttl >= 8) return 1;
  if (ttl >= 4) return 2;
  return 3;
}

function pooFadeIndex(ttl: number): number {
  if (ttl >= 14) return 0;
  if (ttl >= 10) return 1;
  if (ttl >= 5) return 2;
  return 3;
}

function drawPukeResidue(buf: Uint8Array, state: PetState): void {
  for (const item of state.pukeItems) {
    set(buf, item.x, item.y, PUKE_FADE_STEPS[pukeFadeIndex(item.ttl)]!);
  }
}

function drawPooResidue(buf: Uint8Array, state: PetState): void {
  for (const item of state.pooItems) {
    set(buf, item.x, item.y, POO_FADE_STEPS[pooFadeIndex(item.ttl)]!);
  }
}

function drawPetCore(buf: Uint8Array, state: PetState, sprites: ParsedSprites): void {
  const colors = state.isDay ? PET_DAY : PET_NIGHT;
  const mirror = !state.facingRight;
  const { pixels, baseY, drawTail } = resolvePetBehaviorDraw(state, sprites);

  blit(buf, pixels, state.x, baseY, mirror, colors);
  if (state.behavior === 'dream') drawDream(buf, state);
  if (state.behavior === 'burp') drawBurp(buf, state, colors.g);
  drawPukeResidue(buf, state);
  drawPooResidue(buf, state);

  if (!drawTail) return;

  const tailY = resolveTailOffset(state);
  const tailColor = colors['s']!;
  set(buf, resolveTailX(state), baseY + tailY, tailColor);
}

export function drawPet(buf: Uint8Array, state: PetState): void {
  drawPetCore(buf, state, DEFAULT_PET_SPRITES);
}

export function drawPetWithSprites(buf: Uint8Array, state: PetState, rawSprites: RawPetSprites): void {
  drawPetCore(buf, state, parsePetSprites(rawSprites));
}

export { PET_WIDTH, PET_Y_PERCH, PET_Y_WALK };
