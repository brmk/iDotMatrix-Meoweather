import { RAW_SPRITES, type SpriteKey } from '../sprites.js';
import { set } from './canvas.js';

export const PET_WIDTH = 5;
export const PET_Y_WALK = 28;
export const PET_Y_PERCH = 17;

type Pixel = [number, number, string];
type PetColor = Record<string, [number, number, number]>;

export const PET_DAY: PetColor = {
  o: [255, 155, 30],
  g: [50, 220, 80],
  s: [184, 74, 10],
  l: [255, 205, 130],
  r: [225, 145, 65],
};

export const PET_NIGHT: PetColor = {
  o: [130, 75, 15],
  g: [20, 100, 35],
  s: [95, 38, 5],
  l: [130, 105, 65],
  r: [115, 74, 33],
};

export function parseSpr(rows: string[]): Pixel[] {
  const out: Pixel[] = [];
  for (let dy = 0; dy < rows.length; dy++) {
    const row = rows[dy] ?? '';
    for (let dx = 0; dx < row.length; dx++) {
      const ch = row[dx] ?? '.';
      if (ch !== '.') out.push([dx, dy, ch]);
    }
  }
  return out;
}

export function blit(buf: Uint8Array, pixels: Pixel[], x: number, y: number, mirror: boolean, colors: PetColor): void {
  for (const [dx, dy, ch] of pixels) {
    const px = mirror ? x + (PET_WIDTH - 1 - dx) : x + dx;
    const c = colors[ch];
    if (c) set(buf, px, y + dy, c[0], c[1], c[2]);
  }
}

export type PetBehavior = 'walk' | 'sit' | 'lie' | 'jump' | 'perch' | 'dream';

// Adding a new behavior: (1) add to PetBehavior, (2) add entry to BEHAVIOR_DRAWERS below.
export interface PetState {
  x: number;
  facingRight: boolean;
  behavior: PetBehavior;
  walkFrame: number;
  behaviorFrame: number;
  tailPhase: number;
  isDay: boolean;
  eyesClosed: boolean;
  perchY: number;
}

const TAIL_Y = [1, 2, 1, 2];

interface ParsedSprites {
  WALK: [Pixel[], Pixel[]];
  WALK_BLINK: [Pixel[], Pixel[]];
  SIT: [Pixel[], Pixel[]];
  LIE: [Pixel[], Pixel[]];
  JUMP: Array<{ pix: Pixel[]; yOff: number }>;
  DREAM: Pixel[];
}

function parseSprites(raw: Record<SpriteKey, string[]>): ParsedSprites {
  return {
    WALK: [parseSpr(raw.WALK_A), parseSpr(raw.WALK_B)],
    WALK_BLINK: [parseSpr(raw.BLINK_A), parseSpr(raw.BLINK_B)],
    SIT: [parseSpr(raw.SIT_A), parseSpr(raw.SIT_B)],
    LIE: [parseSpr(raw.LIE_A), parseSpr(raw.LIE_B)],
    JUMP: [
      { pix: parseSpr(raw.JUMP_1), yOff: 1 },
      { pix: parseSpr(raw.JUMP_2), yOff: 0 },
      { pix: parseSpr(raw.JUMP_3), yOff: -1 },
      { pix: parseSpr(raw.JUMP_4), yOff: 0 },
    ],
    DREAM: parseSpr(raw.DREAM),
  };
}

type BehaviorDrawResult = { pixels: Pixel[]; baseY: number; drawTail: boolean };
type BehaviorDrawer = (s: PetState, sp: ParsedSprites) => BehaviorDrawResult;

const BEHAVIOR_DRAWERS: Record<PetBehavior, BehaviorDrawer> = {
  walk: (s, sp) => ({
    pixels: s.eyesClosed ? sp.WALK_BLINK[s.walkFrame % 2]! : sp.WALK[s.walkFrame % 2]!,
    baseY: PET_Y_WALK,
    drawTail: true,
  }),
  sit: (s, sp) => ({
    pixels: sp.SIT[Math.floor(s.behaviorFrame / 20) % 2]!,
    baseY: PET_Y_WALK,
    drawTail: false,
  }),
  lie: (s, sp) => ({
    pixels: sp.LIE[Math.floor(s.behaviorFrame / 30) % 2]!,
    baseY: PET_Y_WALK + 1,
    drawTail: true,
  }),
  jump: (s, sp) => {
    const ji = Math.min(Math.floor(s.behaviorFrame / 2), sp.JUMP.length - 1);
    const jf = sp.JUMP[ji]!;
    return { pixels: jf.pix, baseY: PET_Y_WALK + jf.yOff, drawTail: true };
  },
  perch: (s, sp) => ({
    pixels: s.eyesClosed ? sp.WALK_BLINK[s.walkFrame % 2]! : sp.WALK[s.walkFrame % 2]!,
    baseY: s.perchY,
    drawTail: true,
  }),
  dream: (_s, sp) => ({
    pixels: sp.DREAM,
    baseY: PET_Y_WALK,
    drawTail: false,
  }),
};

function drawDream(buf: Uint8Array, s: PetState): void {
  const zX = s.x + 2;
  const phase = s.behaviorFrame % 12;
  const [r, g, b] = [160, 160, 255] as const;
  if (phase < 3) set(buf, zX, PET_Y_WALK - 2, r, g, b);
  if (phase >= 3 && phase < 6) set(buf, zX + 1, PET_Y_WALK - 4, r, g, b);
  if (phase >= 6 && phase < 9) set(buf, zX + 2, PET_Y_WALK - 6, r, g, b);
}

function drawPetCore(buf: Uint8Array, s: PetState, sp: ParsedSprites): void {
  const colors = s.isDay ? PET_DAY : PET_NIGHT;
  const mirror = !s.facingRight;
  const { pixels, baseY, drawTail } = BEHAVIOR_DRAWERS[s.behavior](s, sp);
  blit(buf, pixels, s.x, baseY, mirror, colors);
  if (s.behavior === 'dream') drawDream(buf, s);
  if (drawTail) {
    const tailX = s.facingRight ? s.x : s.x + PET_WIDTH - 1;
    const ty = TAIL_Y[s.tailPhase]!;
    const tc = colors['s']!;
    set(buf, tailX, baseY + ty, tc[0], tc[1], tc[2]);
  }
}

const DEFAULT_SPRITES = parseSprites(RAW_SPRITES);

export function drawPet(buf: Uint8Array, s: PetState): void {
  drawPetCore(buf, s, DEFAULT_SPRITES);
}

export function drawPetWithSprites(buf: Uint8Array, s: PetState, rawSprites: Record<SpriteKey, string[]>): void {
  drawPetCore(buf, s, parseSprites(rawSprites));
}
