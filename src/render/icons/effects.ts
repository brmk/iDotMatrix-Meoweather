import { fillCircle, fillRect, set } from '../canvas.js';
import { CLOUD_COLORS, ICON_LAYOUT, SKY_COLORS, WEATHER_EFFECT_COLORS } from './palette.js';
import { drawCloud } from './primitives.js';

const SUN_RAY_DIRECTIONS: Array<readonly [number, number]> = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

const MOON_STARS: Array<readonly [number, number, number]> = [
  [ICON_LAYOUT.moonCenter[0] + 10, ICON_LAYOUT.moonCenter[1] - 4, 0],
  [ICON_LAYOUT.moonCenter[0] - 9, ICON_LAYOUT.moonCenter[1] - 2, 2],
  [ICON_LAYOUT.moonCenter[0] + 8, ICON_LAYOUT.moonCenter[1] + 5, 4],
  [ICON_LAYOUT.moonCenter[0] + 11, ICON_LAYOUT.moonCenter[1] + 1, 1],
];

const PARTLY_CLOUDY_SUN_LEVELS = [255, 210, 175, 210] as const;
const CLOUD_SWAY = [0, 0, 1, 1, 0, 0, -1, -1] as const;
const FOG_LINES = [
  { y: 3, len: 20, xStart: 4 },
  { y: 6, len: 18, xStart: 6 },
  { y: 9, len: 22, xStart: 3 },
  { y: 12, len: 17, xStart: 7 },
  { y: 15, len: 19, xStart: 5 },
] as const;
const LIGHT_RAIN_TRACKS = [
  { x: 9, phase: 0 },
  { x: 15, phase: 3 },
  { x: 21, phase: 6 },
] as const;
const HEAVY_RAIN_TRACKS = [
  { x: 8, phase: 0 },
  { x: 12, phase: 3 },
  { x: 16, phase: 6 },
  { x: 20, phase: 1 },
  { x: 24, phase: 4 },
  { x: 10, phase: 7 },
] as const;
const SNOW_X_DRIFT = [0, 0, 1, 1, 0, 0, -1, -1, 0, 0, 1, -1] as const;
const SNOW_FLAKES = [
  { baseX: 9, phase: 0 },
  { baseX: 15, phase: 4 },
  { baseX: 21, phase: 8 },
  { baseX: 12, phase: 2 },
  { baseX: 24, phase: 6 },
] as const;
const THUNDER_BOLT_PIXELS = [
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
] as const;

export function drawAnimatedSun(buf: Uint8Array, frame: number): void {
  const [cx, cy] = ICON_LAYOUT.sunCenter;
  fillCircle(buf, cx, cy, 5, SKY_COLORS.sunCore);

  const active = new Set([0, 1, 2, 3].map((offset) => (frame + offset) % SUN_RAY_DIRECTIONS.length));
  for (let i = 0; i < SUN_RAY_DIRECTIONS.length; i++) {
    const [dx, dy] = SUN_RAY_DIRECTIONS[i]!;
    const len = Math.sqrt(dx * dx + dy * dy);
    set(buf, Math.round(cx + (dx * 7) / len), Math.round(cy + (dy * 7) / len), SKY_COLORS.sunRayBase);
    if (active.has(i)) {
      set(buf, Math.round(cx + (dx * 9) / len), Math.round(cy + (dy * 9) / len), SKY_COLORS.sunRayHighlight);
    }
  }
}

export function drawAnimatedMoon(buf: Uint8Array, frame: number): void {
  const [cx, cy] = ICON_LAYOUT.moonCenter;
  fillCircle(buf, cx, cy, 6, SKY_COLORS.moon);
  fillCircle(buf, cx + 3, cy - 2, 5, SKY_COLORS.moonMask);

  for (const [sx, sy, phase] of MOON_STARS) {
    const state = (frame + phase) % 6;
    const color = state < 2 ? SKY_COLORS.starBright : state < 4 ? SKY_COLORS.starDim : SKY_COLORS.starOff;
    set(buf, sx, sy, color);
  }
}

export function drawAnimatedPartlyCloudy(buf: Uint8Array, frame: number): void {
  const lv = PARTLY_CLOUDY_SUN_LEVELS[frame % PARTLY_CLOUDY_SUN_LEVELS.length]!;
  const sr = lv;
  const sg = Math.round((lv * 200) / 255);
  const sunGlow = [sr, sg + 20, 0] as const;
  fillCircle(buf, 9, 6, 4, [sr, sg, 0]);
  set(buf, 9, 0, sunGlow);
  set(buf, 9, 1, sunGlow);
  set(buf, 3, 6, sunGlow);
  set(buf, 4, 6, sunGlow);

  const xOff = frame >= 4 ? 1 : 0;
  fillCircle(buf, 14 + xOff, 11, 3, CLOUD_COLORS.standard);
  fillCircle(buf, 19 + xOff, 9, 4, CLOUD_COLORS.standard);
  fillCircle(buf, 24 + xOff, 11, 3, CLOUD_COLORS.standard);
  fillRect(buf, 11 + xOff, 12, 27 + xOff, 15, CLOUD_COLORS.standard);
}

export function drawAnimatedCloud(buf: Uint8Array, frame: number): void {
  const xOff = CLOUD_SWAY[frame % CLOUD_SWAY.length]!;
  drawCloud(buf, ICON_LAYOUT.cloudY, CLOUD_COLORS.standard, xOff);
}

export function drawAnimatedFog(buf: Uint8Array, frame: number): void {
  for (const line of FOG_LINES) {
    for (let i = 0; i < line.len; i++) {
      if ((i + frame + line.y) % 4 < 3) set(buf, line.xStart + i, line.y, WEATHER_EFFECT_COLORS.fog);
    }
  }
}

export function drawAnimatedRain(buf: Uint8Array, frame: number, heavy: boolean): void {
  drawCloud(buf, ICON_LAYOUT.cloudY, heavy ? CLOUD_COLORS.heavyRain : CLOUD_COLORS.rain);
  const tracks = heavy ? HEAVY_RAIN_TRACKS : LIGHT_RAIN_TRACKS;
  const areaHeight = 9;

  for (const { x, phase } of tracks) {
    const y = ICON_LAYOUT.precipY + ((frame + phase) % areaHeight);
    set(buf, x, y, WEATHER_EFFECT_COLORS.rainDrop);
    if (y + 1 < ICON_LAYOUT.precipY + areaHeight) set(buf, x, y + 1, WEATHER_EFFECT_COLORS.rainDropTail);
  }
}

export function drawAnimatedSnow(buf: Uint8Array, frame: number): void {
  drawCloud(buf, ICON_LAYOUT.cloudY, CLOUD_COLORS.standard);
  const areaHeight = 9;
  const cycle = SNOW_X_DRIFT.length;

  for (const { baseX, phase } of SNOW_FLAKES) {
    const yPos = ICON_LAYOUT.precipY + ((frame + phase) % areaHeight);
    const xDrift = SNOW_X_DRIFT[(frame + phase) % cycle]!;
    const fx = baseX + xDrift;
    set(buf, fx, yPos, WEATHER_EFFECT_COLORS.snowCore);
    set(buf, fx - 1, yPos, WEATHER_EFFECT_COLORS.snowEdge);
    set(buf, fx + 1, yPos, WEATHER_EFFECT_COLORS.snowEdge);
    set(buf, fx, yPos - 1, WEATHER_EFFECT_COLORS.snowEdge);
    set(buf, fx, yPos + 1, WEATHER_EFFECT_COLORS.snowEdge);
  }
}

export function drawAnimatedThunder(buf: Uint8Array, frame: number): void {
  const isFlash = frame === 6 || frame === 7;
  drawCloud(buf, ICON_LAYOUT.cloudY, isFlash ? CLOUD_COLORS.thunderFlash : CLOUD_COLORS.thunder);

  if (!isFlash) return;

  const boltColor = frame === 6 ? WEATHER_EFFECT_COLORS.thunderBoltBright : WEATHER_EFFECT_COLORS.thunderBoltDim;
  for (const [x, dy] of THUNDER_BOLT_PIXELS) {
    set(buf, x, ICON_LAYOUT.precipY + dy, boltColor);
  }
}

// ---- Compact variants (icons fit within Y=0..13 for 3-row info layout) ----

const COMPACT_PRECIP_Y = 8;
const COMPACT_PRECIP_AREA = 5;

const COMPACT_MOON_STARS: Array<readonly [number, number, number]> = [
  [26, 1, 0],
  [7, 3, 2],
  [24, 10, 4],
  [27, 6, 1],
];

const COMPACT_FOG_LINES = [
  { y: 0, len: 20, xStart: 4 },
  { y: 3, len: 18, xStart: 6 },
  { y: 6, len: 22, xStart: 3 },
  { y: 9, len: 17, xStart: 7 },
  { y: 12, len: 19, xStart: 5 },
] as const;

export function drawCompactSun(buf: Uint8Array, frame: number): void {
  const cx = 16,
    cy = 5;
  fillCircle(buf, cx, cy, 4, SKY_COLORS.sunCore);

  const active = new Set([0, 1, 2, 3].map((offset) => (frame + offset) % SUN_RAY_DIRECTIONS.length));
  for (let i = 0; i < SUN_RAY_DIRECTIONS.length; i++) {
    const [dx, dy] = SUN_RAY_DIRECTIONS[i]!;
    const len = Math.sqrt(dx * dx + dy * dy);
    set(buf, Math.round(cx + (dx * 6) / len), Math.round(cy + (dy * 6) / len), SKY_COLORS.sunRayBase);
    if (active.has(i)) {
      set(buf, Math.round(cx + (dx * 8) / len), Math.round(cy + (dy * 8) / len), SKY_COLORS.sunRayHighlight);
    }
  }
}

export function drawCompactMoon(buf: Uint8Array, frame: number): void {
  fillCircle(buf, 16, 5, 5, SKY_COLORS.moon);
  fillCircle(buf, 19, 3, 4, SKY_COLORS.moonMask);
  for (const [sx, sy, phase] of COMPACT_MOON_STARS) {
    const state = (frame + phase) % 6;
    const color = state < 2 ? SKY_COLORS.starBright : state < 4 ? SKY_COLORS.starDim : SKY_COLORS.starOff;
    set(buf, sx, sy, color);
  }
}

export function drawCompactPartlyCloudy(buf: Uint8Array, frame: number): void {
  const lv = PARTLY_CLOUDY_SUN_LEVELS[frame % PARTLY_CLOUDY_SUN_LEVELS.length]!;
  const sr = lv;
  const sg = Math.round((lv * 200) / 255);
  const sunGlow = [sr, sg + 20, 0] as const;
  fillCircle(buf, 9, 4, 3, [sr, sg, 0]);
  set(buf, 9, 0, sunGlow);
  set(buf, 3, 4, sunGlow);
  set(buf, 4, 4, sunGlow);

  const xOff = frame >= 4 ? 1 : 0;
  fillCircle(buf, 14 + xOff, 8, 2, CLOUD_COLORS.standard);
  fillCircle(buf, 19 + xOff, 7, 3, CLOUD_COLORS.standard);
  fillCircle(buf, 24 + xOff, 8, 2, CLOUD_COLORS.standard);
  fillRect(buf, 12 + xOff, 9, 26 + xOff, 12, CLOUD_COLORS.standard);
}

export function drawCompactCloud(buf: Uint8Array, frame: number): void {
  const xOff = CLOUD_SWAY[frame % CLOUD_SWAY.length]!;
  drawCloud(buf, 0, CLOUD_COLORS.standard, xOff);
}

export function drawCompactFog(buf: Uint8Array, frame: number): void {
  for (const line of COMPACT_FOG_LINES) {
    for (let i = 0; i < line.len; i++) {
      if ((i + frame + line.y) % 4 < 3) set(buf, line.xStart + i, line.y, WEATHER_EFFECT_COLORS.fog);
    }
  }
}

export function drawCompactRain(buf: Uint8Array, frame: number, heavy: boolean): void {
  drawCloud(buf, 0, heavy ? CLOUD_COLORS.heavyRain : CLOUD_COLORS.rain);
  const tracks = heavy ? HEAVY_RAIN_TRACKS : LIGHT_RAIN_TRACKS;
  for (const { x, phase } of tracks) {
    const y = COMPACT_PRECIP_Y + ((frame + phase) % COMPACT_PRECIP_AREA);
    set(buf, x, y, WEATHER_EFFECT_COLORS.rainDrop);
    if (y + 1 < COMPACT_PRECIP_Y + COMPACT_PRECIP_AREA) set(buf, x, y + 1, WEATHER_EFFECT_COLORS.rainDropTail);
  }
}

export function drawCompactSnow(buf: Uint8Array, frame: number): void {
  drawCloud(buf, 0, CLOUD_COLORS.standard);
  const cycle = SNOW_X_DRIFT.length;
  for (const { baseX, phase } of SNOW_FLAKES) {
    const yPos = COMPACT_PRECIP_Y + ((frame + phase) % COMPACT_PRECIP_AREA);
    const xDrift = SNOW_X_DRIFT[(frame + phase) % cycle]!;
    const fx = baseX + xDrift;
    set(buf, fx, yPos, WEATHER_EFFECT_COLORS.snowCore);
    set(buf, fx - 1, yPos, WEATHER_EFFECT_COLORS.snowEdge);
    set(buf, fx + 1, yPos, WEATHER_EFFECT_COLORS.snowEdge);
    set(buf, fx, yPos - 1, WEATHER_EFFECT_COLORS.snowEdge);
    set(buf, fx, yPos + 1, WEATHER_EFFECT_COLORS.snowEdge);
  }
}

export function drawCompactThunder(buf: Uint8Array, frame: number): void {
  const isFlash = frame === 6 || frame === 7;
  drawCloud(buf, 0, isFlash ? CLOUD_COLORS.thunderFlash : CLOUD_COLORS.thunder);
  if (!isFlash) return;
  const boltColor = frame === 6 ? WEATHER_EFFECT_COLORS.thunderBoltBright : WEATHER_EFFECT_COLORS.thunderBoltDim;
  for (const [x, dy] of THUNDER_BOLT_PIXELS) {
    set(buf, x, COMPACT_PRECIP_Y + dy, boltColor);
  }
}
