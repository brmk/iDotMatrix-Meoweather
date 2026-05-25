import { set } from '../canvas.js';
import { resolvePetBehaviorDraw, resolveTailOffset, resolveTailX } from './behaviors.js';
import { PET_DAY, PET_DREAM_COLOR, PET_NIGHT } from './colors.js';
import { DEFAULT_PET_SPRITES, PET_WIDTH, PET_Y_PERCH, PET_Y_WALK, parsePetSprites } from './sprites.js';
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

  if (phase < 3) set(buf, zX, PET_Y_WALK - 2, PET_DREAM_COLOR);
  if (phase >= 3 && phase < 6) set(buf, zX + 1, PET_Y_WALK - 4, PET_DREAM_COLOR);
  if (phase >= 6 && phase < 9) set(buf, zX + 2, PET_Y_WALK - 6, PET_DREAM_COLOR);
}

function drawPetCore(buf: Uint8Array, state: PetState, sprites: ParsedSprites): void {
  const colors = state.isDay ? PET_DAY : PET_NIGHT;
  const mirror = !state.facingRight;
  const { pixels, baseY, drawTail } = resolvePetBehaviorDraw(state, sprites);

  blit(buf, pixels, state.x, baseY, mirror, colors);
  if (state.behavior === 'dream') drawDream(buf, state);

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
