import { set } from '../canvas.js';
import { getActive } from './active.js';
import { resolvePetBehaviorDraw, resolveTailOffset, resolveTailX } from './behaviors.js';
import { PET_WIDTH, PET_Y_WALK, parsePetSprites } from './sprites.js';
import type { ParsedSprites, PetColor, PetState, Pixel, RawPetSprites } from './types.js';

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
  const dream = getActive().dream;

  if (phase < 3) set(buf, zX, PET_Y_WALK - 1, dream);
  if (phase >= 3 && phase < 6) set(buf, zX + 1, PET_Y_WALK - 2, dream);
  if (phase >= 6 && phase < 9) set(buf, zX + 2, PET_Y_WALK - 3, dream);
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
  const { pukeSteps } = getActive();
  for (const item of state.pukeItems) {
    set(buf, item.x, item.y, pukeSteps[pukeFadeIndex(item.ttl)]);
  }
}

function drawPooResidue(buf: Uint8Array, state: PetState): void {
  const { pooSteps } = getActive();
  for (const item of state.pooItems) {
    set(buf, item.x, item.y, pooSteps[pooFadeIndex(item.ttl)]);
  }
}

function drawPetCore(buf: Uint8Array, state: PetState, sprites: ParsedSprites): void {
  const active = getActive();
  const colors = state.isDay ? active.day : active.night;
  const mirror = !state.facingRight;
  const { pixels, baseY, drawTail } = resolvePetBehaviorDraw(state, sprites);

  blit(buf, pixels, state.x, baseY, mirror, colors);
  if (state.behavior === 'dream') drawDream(buf, state);
  if (state.behavior === 'burp') drawBurp(buf, state, colors['g']);
  drawPukeResidue(buf, state);
  drawPooResidue(buf, state);

  if (!drawTail) return;

  const tailY = resolveTailOffset(state);
  const tailColor = colors['s'];
  set(buf, resolveTailX(state), baseY + tailY, tailColor);
}

export function drawPet(buf: Uint8Array, state: PetState): void {
  drawPetCore(buf, state, getActive().sprites);
}

export function drawPetWithSprites(buf: Uint8Array, state: PetState, rawSprites: RawPetSprites): void {
  drawPetCore(buf, state, parsePetSprites(rawSprites));
}

export { PET_WIDTH, PET_Y_PERCH, PET_Y_WALK } from './sprites.js';
