import { RAW_SPRITES } from '../../sprites.js';
import type { ParsedSprites, Pixel, RawPetSprites } from './types.js';

export const PET_WIDTH = 5;
export const PET_Y_WALK = 28;
export const PET_Y_PERCH = 17;

const PET_SPRITE_CACHE = new WeakMap<RawPetSprites, ParsedSprites>();

export function parseSpritePixels(rows: string[]): Pixel[] {
  const pixels: Pixel[] = [];
  for (let dy = 0; dy < rows.length; dy++) {
    const row = rows[dy] ?? '';
    for (let dx = 0; dx < row.length; dx++) {
      const ch = row[dx] ?? '.';
      if (ch !== '.') pixels.push([dx, dy, ch]);
    }
  }
  return pixels;
}

function buildParsedSprites(raw: RawPetSprites): ParsedSprites {
  return {
    WALK: [parseSpritePixels(raw.WALK_A), parseSpritePixels(raw.WALK_B)],
    WALK_BLINK: [parseSpritePixels(raw.BLINK_A), parseSpritePixels(raw.BLINK_B)],
    SIT: [parseSpritePixels(raw.SIT_A), parseSpritePixels(raw.SIT_B)],
    LIE: [parseSpritePixels(raw.LIE_A), parseSpritePixels(raw.LIE_B)],
    JUMP: [
      { pix: parseSpritePixels(raw.JUMP_1), yOff: 1 },
      { pix: parseSpritePixels(raw.JUMP_2), yOff: 0 },
      { pix: parseSpritePixels(raw.JUMP_3), yOff: -1 },
      { pix: parseSpritePixels(raw.JUMP_4), yOff: 0 },
    ],
    DREAM: parseSpritePixels(raw.DREAM),
  };
}

export function parsePetSprites(raw: RawPetSprites): ParsedSprites {
  const cached = PET_SPRITE_CACHE.get(raw);
  if (cached) return cached;

  const parsed = buildParsedSprites(raw);
  PET_SPRITE_CACHE.set(raw, parsed);
  return parsed;
}

export const DEFAULT_PET_SPRITES = parsePetSprites(RAW_SPRITES);
