import { fillCircle, fillRect, set } from './canvas.js';
import type { Color } from './types.js';

export type IconType = 'clear-day' | 'clear-night' | 'partly-cloudy' | 'cloudy' | 'fog' | 'rain' | 'heavy-rain' | 'snow' | 'thunder';

// Adding a new icon type: (1) add to IconType, (2) add entry to ICON_REGISTRY below.
interface IconDef {
  count: number;
  delayMs: number;
  draw(buf: Uint8Array, frame: number): void;
}

const CLOUD_Y = 1;
const PRECIP_Y = 11;

function drawCloud(buf: Uint8Array, yBase: number, r: number, g: number, b: number, xOff = 0): void {
  const color: Color = [r, g, b];
  fillCircle(buf, 10 + xOff, yBase + 4, 4, color);
  fillCircle(buf, 16 + xOff, yBase + 2, 5, color);
  fillCircle(buf, 22 + xOff, yBase + 4, 4, color);
  fillRect(buf, 6 + xOff, yBase + 5, 26 + xOff, yBase + 8, color);
}

function drawAnimatedSun(buf: Uint8Array, cx: number, cy: number, frame: number): void {
  fillCircle(buf, cx, cy, 5, [255, 200, 0]);
  const dirs: Array<[number, number]> = [
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
  ];
  const active = new Set([0, 1, 2, 3].map((o) => (frame + o) % 8));
  for (let i = 0; i < dirs.length; i++) {
    const [dx, dy] = dirs[i]!;
    const len = Math.sqrt(dx * dx + dy * dy);
    set(buf, Math.round(cx + (dx * 7) / len), Math.round(cy + (dy * 7) / len), [255, 220, 50]);
    if (active.has(i)) {
      set(buf, Math.round(cx + (dx * 9) / len), Math.round(cy + (dy * 9) / len), [255, 240, 100]);
    }
  }
}

function drawAnimatedMoon(buf: Uint8Array, cx: number, cy: number, frame: number): void {
  fillCircle(buf, cx, cy, 6, [220, 230, 255]);
  fillCircle(buf, cx + 3, cy - 2, 5, [0, 0, 0]);
  const stars: Array<[number, number, number]> = [
    [cx + 10, cy - 4, 0],
    [cx - 9, cy - 2, 2],
    [cx + 8, cy + 5, 4],
    [cx + 11, cy + 1, 1],
  ];
  for (const [sx, sy, phase] of stars) {
    const state = (frame + phase) % 6;
    const [r, g, b] = state < 2 ? [210, 220, 255] : state < 4 ? [90, 95, 120] : [30, 32, 45];
    set(buf, sx, sy, [r, g, b]);
  }
}

function drawAnimatedPartlyCloudy(buf: Uint8Array, frame: number): void {
  const levels = [255, 210, 175, 210];
  const lv = levels[frame % 4]!;
  const sr = lv;
  const sg = Math.round((lv * 200) / 255);
  const sb = 0;
  fillCircle(buf, 9, 6, 4, [sr, sg, sb]);
  set(buf, 9, 0, [sr, sg + 20, sb]);
  set(buf, 9, 1, [sr, sg + 20, sb]);
  set(buf, 3, 6, [sr, sg + 20, sb]);
  set(buf, 4, 6, [sr, sg + 20, sb]);
  const xOff = frame >= 4 ? 1 : 0;
  const [cr, cg, cb] = [160, 165, 175];
  fillCircle(buf, 14 + xOff, 11, 3, [cr, cg, cb]);
  fillCircle(buf, 19 + xOff, 9, 4, [cr, cg, cb]);
  fillCircle(buf, 24 + xOff, 11, 3, [cr, cg, cb]);
  fillRect(buf, 11 + xOff, 12, 27 + xOff, 15, [cr, cg, cb]);
}

const CLOUD_SWAY = [0, 0, 1, 1, 0, 0, -1, -1];

function drawAnimatedCloud(buf: Uint8Array, frame: number): void {
  const xOff = CLOUD_SWAY[frame % CLOUD_SWAY.length]!;
  drawCloud(buf, CLOUD_Y, 160, 165, 175, xOff);
}

function drawAnimatedFog(buf: Uint8Array, frame: number): void {
  const lines = [
    { y: 3, len: 20, xStart: 4 },
    { y: 6, len: 18, xStart: 6 },
    { y: 9, len: 22, xStart: 3 },
    { y: 12, len: 17, xStart: 7 },
    { y: 15, len: 19, xStart: 5 },
  ];
  for (const line of lines) {
    for (let i = 0; i < line.len; i++) {
      if ((i + frame + line.y) % 4 < 3) {
        set(buf, line.xStart + i, line.y, [150, 150, 160]);
      }
    }
  }
}

function drawAnimatedRain(buf: Uint8Array, frame: number, heavy: boolean): void {
  drawCloud(buf, CLOUD_Y, heavy ? 100 : 130, heavy ? 105 : 135, heavy ? 115 : 145);
  const tracks = heavy
    ? [
        { x: 8, phase: 0 },
        { x: 12, phase: 3 },
        { x: 16, phase: 6 },
        { x: 20, phase: 1 },
        { x: 24, phase: 4 },
        { x: 10, phase: 7 },
      ]
    : [
        { x: 9, phase: 0 },
        { x: 15, phase: 3 },
        { x: 21, phase: 6 },
      ];
  const areaH = 9;
  for (const { x, phase } of tracks) {
    const y = PRECIP_Y + ((frame + phase) % areaH);
    set(buf, x, y, [80, 140, 255]);
    if (y + 1 < PRECIP_Y + areaH) set(buf, x, y + 1, [60, 110, 220]);
  }
}

const SNOW_X_DRIFT = [0, 0, 1, 1, 0, 0, -1, -1, 0, 0, 1, -1];

function drawAnimatedSnow(buf: Uint8Array, frame: number): void {
  drawCloud(buf, CLOUD_Y, 160, 165, 175);
  const flakes = [
    { baseX: 9, phase: 0 },
    { baseX: 15, phase: 4 },
    { baseX: 21, phase: 8 },
    { baseX: 12, phase: 2 },
    { baseX: 24, phase: 6 },
  ];
  const areaH = 9;
  const cycle = SNOW_X_DRIFT.length;
  for (const { baseX, phase } of flakes) {
    const yPos = PRECIP_Y + ((frame + phase) % areaH);
    const xDrift = SNOW_X_DRIFT[(frame + phase) % cycle]!;
    const fx = baseX + xDrift;
    set(buf, fx, yPos, [200, 220, 255]);
    set(buf, fx - 1, yPos, [150, 170, 210]);
    set(buf, fx + 1, yPos, [150, 170, 210]);
    set(buf, fx, yPos - 1, [150, 170, 210]);
    set(buf, fx, yPos + 1, [150, 170, 210]);
  }
}

function drawAnimatedThunder(buf: Uint8Array, frame: number): void {
  const isFlash = frame === 6 || frame === 7;
  const [cr, cg, cb] = isFlash ? [190, 195, 210] : [80, 85, 95];
  drawCloud(buf, CLOUD_Y, cr, cg, cb);
  if (isFlash) {
    const boltPixels = [
      [17, 0],
      [16, 1],
      [15, 1],
      [14, 2],
      [13, 2],
      [15, 3],
      [14, 4],
      [13, 4],
      [12, 5],
      [11, 6],
    ];
    const [lr, lg, lb] = frame === 6 ? [255, 255, 50] : [200, 200, 20];
    for (const [x, dy] of boltPixels) {
      set(buf, x!, PRECIP_Y + dy!, [lr, lg, lb]);
    }
  }
}

const ICON_REGISTRY: Record<IconType, IconDef> = {
  'clear-day': {
    count: 8,
    delayMs: 150,
    draw: (buf, f) => drawAnimatedSun(buf, 16, 8, f),
  },
  'clear-night': {
    count: 6,
    delayMs: 280,
    draw: (buf, f) => drawAnimatedMoon(buf, 16, 8, f),
  },
  'partly-cloudy': { count: 8, delayMs: 180, draw: drawAnimatedPartlyCloudy },
  cloudy: { count: 8, delayMs: 220, draw: drawAnimatedCloud },
  fog: { count: 8, delayMs: 160, draw: drawAnimatedFog },
  rain: {
    count: 8,
    delayMs: 140,
    draw: (buf, f) => drawAnimatedRain(buf, f, false),
  },
  'heavy-rain': {
    count: 8,
    delayMs: 110,
    draw: (buf, f) => drawAnimatedRain(buf, f, true),
  },
  snow: { count: 12, delayMs: 170, draw: drawAnimatedSnow },
  thunder: { count: 10, delayMs: 160, draw: drawAnimatedThunder },
};

export const ANIM: Record<IconType, { count: number; delayMs: number }> = Object.fromEntries(
  (Object.entries(ICON_REGISTRY) as Array<[IconType, IconDef]>).map(([k, v]) => [k, { count: v.count, delayMs: v.delayMs }]),
) as Record<IconType, { count: number; delayMs: number }>;

export function drawAnimatedIcon(buf: Uint8Array, icon: IconType, frame: number): void {
  ICON_REGISTRY[icon].draw(buf, frame);
}

export function codeToIcon(code: number, isDay: boolean): IconType {
  if (code <= 1) return isDay ? 'clear-day' : 'clear-night';
  if (code === 2) return isDay ? 'partly-cloudy' : 'clear-night';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code === 82) return 'heavy-rain';
  if (code >= 80 && code <= 82) return 'rain';
  if (code >= 85 && code <= 86) return 'snow';
  if (code >= 95) return 'thunder';
  return isDay ? 'clear-day' : 'clear-night';
}
