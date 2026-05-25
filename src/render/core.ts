import type { WeatherSnapshot } from "../weather/index.js";
import { RAW_SPRITES } from "../sprites.js";

const W = 32;
const H = 32;

// ---- Pixel buffer helpers ----

export function mkBuf(): Uint8Array {
  return new Uint8Array(W * H * 3); // all black
}




export function set(
  buf: Uint8Array,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number
) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
}

function fillCircle(
  buf: Uint8Array,
  cx: number,
  cy: number,
  rad: number,
  r: number,
  g: number,
  b: number
) {
  const r2 = rad * rad;
  for (let dy = -rad; dy <= rad; dy++) {
    for (let dx = -rad; dx <= rad; dx++) {
      if (dx * dx + dy * dy <= r2) set(buf, cx + dx, cy + dy, r, g, b);
    }
  }
}

function fillRect(
  buf: Uint8Array,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  g: number,
  b: number
) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      set(buf, x, y, r, g, b);
    }
  }
}

// ---- 3×5 pixel font ----

const FONT: Record<string, number[]> = {
  "0": [0b111, 0b101, 0b101, 0b101, 0b111],
  "1": [0b110, 0b010, 0b010, 0b010, 0b111],
  "2": [0b111, 0b001, 0b111, 0b100, 0b111],
  "3": [0b111, 0b001, 0b111, 0b001, 0b111],
  "4": [0b101, 0b101, 0b111, 0b001, 0b001],
  "5": [0b111, 0b100, 0b111, 0b001, 0b111],
  "6": [0b111, 0b100, 0b111, 0b101, 0b111],
  "7": [0b111, 0b001, 0b001, 0b001, 0b001],
  "8": [0b111, 0b101, 0b111, 0b101, 0b111],
  "9": [0b111, 0b101, 0b111, 0b001, 0b111],
  "-": [0b000, 0b000, 0b111, 0b000, 0b000],
  "°": [0b110, 0b110, 0b000, 0b000, 0b000],
  C: [0b111, 0b100, 0b100, 0b100, 0b111],
};

function drawChar(
  buf: Uint8Array,
  ch: string,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number
) {
  const glyph = FONT[ch];
  if (!glyph) return;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if (glyph[row] & (0b100 >> col)) set(buf, x + col, y + row, r, g, b);
    }
  }
}

function drawText(
  buf: Uint8Array,
  text: string,
  y: number,
  r: number,
  g: number,
  b: number
) {
  const totalW = text.length * 4 - 1;
  let x = Math.floor((W - totalW) / 2);
  for (const ch of text) {
    drawChar(buf, ch, x, y, r, g, b);
    x += 4;
  }
}

// ---- Static icon helpers (used by animated versions) ----

function drawCloud(
  buf: Uint8Array,
  yBase: number,
  r: number,
  g: number,
  b: number,
  xOff = 0
) {
  fillCircle(buf, 10 + xOff, yBase + 4, 4, r, g, b);
  fillCircle(buf, 16 + xOff, yBase + 2, 5, r, g, b);
  fillCircle(buf, 22 + xOff, yBase + 4, 4, r, g, b);
  fillRect(buf, 6 + xOff, yBase + 5, 26 + xOff, yBase + 8, r, g, b);
}

// ---- WMO code → icon type ----

export type IconType =
  | "clear-day"
  | "clear-night"
  | "partly-cloudy"
  | "cloudy"
  | "fog"
  | "rain"
  | "heavy-rain"
  | "snow"
  | "thunder";

export function codeToIcon(code: number, isDay: boolean): IconType {
  if (code <= 1) return isDay ? "clear-day" : "clear-night";
  if (code === 2) return isDay ? "partly-cloudy" : "clear-night";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code === 82) return "heavy-rain";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 85 && code <= 86) return "snow";
  if (code >= 95) return "thunder";
  return isDay ? "clear-day" : "clear-night";
}

const CLOUD_Y = 1;
const PRECIP_Y = 11;

// ---- Animated icon draw functions ----

function drawAnimatedSun(buf: Uint8Array, cx: number, cy: number, frame: number) {
  fillCircle(buf, cx, cy, 5, 255, 200, 0);

  const dirs: Array<[number, number]> = [
    [0, -1], [1, -1], [1, 0], [1, 1],
    [0, 1], [-1, 1], [-1, 0], [-1, -1],
  ];

  const active = new Set([0, 1, 2, 3].map(o => (frame + o) % 8));

  for (let i = 0; i < dirs.length; i++) {
    const [dx, dy] = dirs[i]!;
    const len = Math.sqrt(dx * dx + dy * dy);
    set(buf, Math.round(cx + dx * 7 / len), Math.round(cy + dy * 7 / len), 255, 220, 50);
    if (active.has(i)) {
      set(buf, Math.round(cx + dx * 9 / len), Math.round(cy + dy * 9 / len), 255, 240, 100);
    }
  }
}

function drawAnimatedMoon(buf: Uint8Array, cx: number, cy: number, frame: number) {
  fillCircle(buf, cx, cy, 6, 220, 230, 255);
  fillCircle(buf, cx + 3, cy - 2, 5, 0, 0, 0);

  const stars: Array<[number, number, number]> = [
    [cx + 10, cy - 4, 0],
    [cx - 9,  cy - 2, 2],
    [cx + 8,  cy + 5, 4],
    [cx + 11, cy + 1, 1],
  ];

  for (const [sx, sy, phase] of stars) {
    const state = (frame + phase) % 6;
    const [r, g, b] =
      state < 2 ? [210, 220, 255] :
      state < 4 ? [90, 95, 120] :
                  [30, 32, 45];
    set(buf, sx, sy, r, g, b);
  }
}

function drawAnimatedPartlyCloudy(buf: Uint8Array, frame: number) {
  const levels = [255, 210, 175, 210];
  const lv = levels[frame % 4]!;
  const sr = lv;
  const sg = Math.round(lv * 200 / 255);
  const sb = 0;

  fillCircle(buf, 9, 6, 4, sr, sg, sb);
  set(buf, 9, 0, sr, sg + 20, sb);
  set(buf, 9, 1, sr, sg + 20, sb);
  set(buf, 3, 6, sr, sg + 20, sb);
  set(buf, 4, 6, sr, sg + 20, sb);

  const xOff = frame >= 4 ? 1 : 0;
  const [cr, cg, cb] = [160, 165, 175];
  fillCircle(buf, 14 + xOff, 11, 3, cr, cg, cb);
  fillCircle(buf, 19 + xOff, 9, 4, cr, cg, cb);
  fillCircle(buf, 24 + xOff, 11, 3, cr, cg, cb);
  fillRect(buf, 11 + xOff, 12, 27 + xOff, 15, cr, cg, cb);
}

const CLOUD_SWAY = [0, 0, 1, 1, 0, 0, -1, -1];

function drawAnimatedCloud(buf: Uint8Array, frame: number) {
  const xOff = CLOUD_SWAY[frame % CLOUD_SWAY.length]!;
  drawCloud(buf, CLOUD_Y, 160, 165, 175, xOff);
}

function drawAnimatedFog(buf: Uint8Array, frame: number) {
  const lines = [
    { y: 3,  len: 20, xStart: 4  },
    { y: 6,  len: 18, xStart: 6  },
    { y: 9,  len: 22, xStart: 3  },
    { y: 12, len: 17, xStart: 7  },
    { y: 15, len: 19, xStart: 5  },
  ];

  for (const line of lines) {
    for (let i = 0; i < line.len; i++) {
      if ((i + frame + line.y) % 4 < 3) {
        const x = line.xStart + i;
        set(buf, x, line.y, 150, 150, 160);
      }
    }
  }
}

function drawAnimatedRain(buf: Uint8Array, frame: number, heavy: boolean) {
  drawCloud(buf, CLOUD_Y, heavy ? 100 : 130, heavy ? 105 : 135, heavy ? 115 : 145);

  const tracks = heavy
    ? [
        { x: 8,  phase: 0 },
        { x: 12, phase: 3 },
        { x: 16, phase: 6 },
        { x: 20, phase: 1 },
        { x: 24, phase: 4 },
        { x: 10, phase: 7 },
      ]
    : [
        { x: 9,  phase: 0 },
        { x: 15, phase: 3 },
        { x: 21, phase: 6 },
      ];

  const areaH = 9;

  for (const { x, phase } of tracks) {
    const y = PRECIP_Y + (frame + phase) % areaH;
    set(buf, x, y, 80, 140, 255);
    if (y + 1 < PRECIP_Y + areaH) {
      set(buf, x, y + 1, 60, 110, 220);
    }
  }
}

const SNOW_X_DRIFT = [0, 0, 1, 1, 0, 0, -1, -1, 0, 0, 1, -1];

function drawAnimatedSnow(buf: Uint8Array, frame: number) {
  drawCloud(buf, CLOUD_Y, 160, 165, 175);

  const flakes = [
    { baseX: 9,  phase: 0  },
    { baseX: 15, phase: 4  },
    { baseX: 21, phase: 8  },
    { baseX: 12, phase: 2  },
    { baseX: 24, phase: 6  },
  ];

  const areaH = 9;
  const cycle = SNOW_X_DRIFT.length;

  for (const { baseX, phase } of flakes) {
    const yPos = PRECIP_Y + (frame + phase) % areaH;
    const xDrift = SNOW_X_DRIFT[(frame + phase) % cycle]!;
    const fx = baseX + xDrift;
    const fy = yPos;
    set(buf, fx,     fy,     200, 220, 255);
    set(buf, fx - 1, fy,     150, 170, 210);
    set(buf, fx + 1, fy,     150, 170, 210);
    set(buf, fx,     fy - 1, 150, 170, 210);
    set(buf, fx,     fy + 1, 150, 170, 210);
  }
}

function drawAnimatedThunder(buf: Uint8Array, frame: number) {
  const isFlash = frame === 6 || frame === 7;

  const [cr, cg, cb] = isFlash
    ? [190, 195, 210]
    : [80, 85, 95];

  drawCloud(buf, CLOUD_Y, cr, cg, cb);

  if (isFlash) {
    const boltPixels = [
      [17, 0], [16, 1], [15, 1], [14, 2], [13, 2],
      [15, 3], [14, 4], [13, 4], [12, 5], [11, 6],
    ];
    const [lr, lg, lb] = frame === 6 ? [255, 255, 50] : [200, 200, 20];
    for (const [x, dy] of boltPixels) {
      set(buf, x!, PRECIP_Y + dy!, lr, lg, lb);
    }
  }
}

// ---- Animation frame counts and delays ----

export const ANIM: Record<IconType, { count: number; delayMs: number }> = {
  "clear-day":     { count: 8,  delayMs: 150 },
  "clear-night":   { count: 6,  delayMs: 280 },
  "partly-cloudy": { count: 8,  delayMs: 180 },
  "cloudy":        { count: 8,  delayMs: 220 },
  "fog":           { count: 8,  delayMs: 160 },
  "rain":          { count: 8,  delayMs: 140 },
  "heavy-rain":    { count: 8,  delayMs: 110 },
  "snow":          { count: 12, delayMs: 170 },
  "thunder":       { count: 10, delayMs: 160 },
};

export function drawAnimatedIcon(buf: Uint8Array, icon: IconType, frame: number) {
  switch (icon) {
    case "clear-day":
      drawAnimatedSun(buf, 16, 8, frame);
      break;
    case "clear-night":
      drawAnimatedMoon(buf, 16, 8, frame);
      break;
    case "partly-cloudy":
      drawAnimatedPartlyCloudy(buf, frame);
      break;
    case "cloudy":
      drawAnimatedCloud(buf, frame);
      break;
    case "fog":
      drawAnimatedFog(buf, frame);
      break;
    case "rain":
      drawAnimatedRain(buf, frame, false);
      break;
    case "heavy-rain":
      drawAnimatedRain(buf, frame, true);
      break;
    case "snow":
      drawAnimatedSnow(buf, frame);
      break;
    case "thunder":
      drawAnimatedThunder(buf, frame);
      break;
  }
}

// ---- Night tint ----

export function applyNightTint(buf: Uint8Array): void {
  for (let i = 0; i < buf.length; i += 3) {
    buf[i + 1] = Math.round((buf[i + 1] ?? 0) * 0.85);
    buf[i + 2] = Math.round((buf[i + 2] ?? 0) * 0.45);
  }
}

// ---- Pixel pet (Bengal cat) ----

export const PET_WIDTH = 5;
export const PET_Y_WALK = 28;
export const PET_Y_PERCH = 17;

type Pixel = [number, number, string];
type PetColor = Record<string, [number, number, number]>;

const PET_DAY: PetColor = {
  o: [255, 155, 30],
  g: [50, 220, 80],
  s: [184, 74, 10],   // tail + sit stripes: dark chocolate (was r)
  l: [255, 205, 130],
  r: [225, 145, 65],  // cheek/chest mark: warm light tan (lighter than old s)
};
const PET_NIGHT: PetColor = {
  o: [130, 75, 15],
  g: [20, 100, 35],
  s: [95, 38, 5],     // tail + stripes: dark (was r night)
  l: [130, 105, 65],
  r: [115, 74, 33],   // cheek/chest mark: lighter night version
};

function parseSpr(rows: string[]): Pixel[] {
  const out: Pixel[] = [];
  for (let dy = 0; dy < rows.length; dy++) {
    const row = rows[dy]!;
    for (let dx = 0; dx < row.length; dx++) {
      if (row[dx] !== '.') out.push([dx, dy, row[dx]!]);
    }
  }
  return out;
}

function blit(
  buf: Uint8Array, pixels: Pixel[],
  x: number, y: number, mirror: boolean, colors: PetColor
) {
  for (const [dx, dy, ch] of pixels) {
    const px = mirror ? x + (PET_WIDTH - 1 - dx) : x + dx;
    const c = colors[ch];
    if (c) set(buf, px, y + dy, c[0], c[1], c[2]);
  }
}

const WALK       = [parseSpr(RAW_SPRITES.WALK_A),  parseSpr(RAW_SPRITES.WALK_B)];
const WALK_BLINK = [parseSpr(RAW_SPRITES.BLINK_A), parseSpr(RAW_SPRITES.BLINK_B)];
const SIT        = [parseSpr(RAW_SPRITES.SIT_A),   parseSpr(RAW_SPRITES.SIT_B)];
const LIE        = [parseSpr(RAW_SPRITES.LIE_A),   parseSpr(RAW_SPRITES.LIE_B)];
const JUMP: Array<{ pix: Pixel[]; yOff: number }> = [
  { pix: parseSpr(RAW_SPRITES.JUMP_1), yOff:  1 },
  { pix: parseSpr(RAW_SPRITES.JUMP_2), yOff:  0 },
  { pix: parseSpr(RAW_SPRITES.JUMP_3), yOff: -1 },
  { pix: parseSpr(RAW_SPRITES.JUMP_4), yOff:  0 },
];
const DREAM = parseSpr(RAW_SPRITES.DREAM);

const TAIL_Y = [1, 2, 1, 2];

function drawDream(buf: Uint8Array, s: PetState): void {
  const zX = s.x + 2;
  const phase = s.behaviorFrame % 12;
  const [r, g, b] = [160, 160, 255] as const;
  if (phase < 3)  set(buf, zX,     PET_Y_WALK - 2, r, g, b);
  if (phase >= 3 && phase < 6)  set(buf, zX + 1, PET_Y_WALK - 4, r, g, b);
  if (phase >= 6 && phase < 9)  set(buf, zX + 2, PET_Y_WALK - 6, r, g, b);
}

export type PetBehavior = 'walk' | 'sit' | 'lie' | 'jump' | 'perch' | 'dream';

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

export function drawPet(buf: Uint8Array, s: PetState): void {
  const colors = s.isDay ? PET_DAY : PET_NIGHT;
  const mirror = !s.facingRight;
  let pixels: Pixel[];
  let baseY: number;
  let drawTail = true;

  switch (s.behavior) {
    case 'walk':
      pixels = s.eyesClosed
        ? WALK_BLINK[s.walkFrame % 2]!
        : WALK[s.walkFrame % 2]!;
      baseY = PET_Y_WALK;
      break;
    case 'sit':
      pixels = SIT[Math.floor(s.behaviorFrame / 20) % 2]!;
      baseY = PET_Y_WALK;
      drawTail = false;
      break;
    case 'lie':
      pixels = LIE[Math.floor(s.behaviorFrame / 30) % 2]!;
      baseY = PET_Y_WALK + 1;
      break;
    case 'jump': {
      const ji = Math.min(Math.floor(s.behaviorFrame / 2), JUMP.length - 1);
      const jf = JUMP[ji]!;
      pixels = jf.pix;
      baseY = PET_Y_WALK + jf.yOff;
      break;
    }
    case 'perch':
      pixels = s.eyesClosed
        ? WALK_BLINK[s.walkFrame % 2]!
        : WALK[s.walkFrame % 2]!;
      baseY = s.perchY;
      break;
    case 'dream':
      pixels = DREAM;
      baseY = PET_Y_WALK;   // row 3 (L-tail base) lands at y=31, last visible row
      drawTail = false;      // tail is baked into sprite as s-pixels
      break;
  }

  blit(buf, pixels, s.x, baseY, mirror, colors);
  if (s.behavior === 'dream') drawDream(buf, s);

  if (drawTail) {
    const tailX = s.facingRight ? s.x : s.x + PET_WIDTH - 1;
    const ty = TAIL_Y[s.tailPhase]!;
    const tc = colors['s']!;
    set(buf, tailX, baseY + ty, tc[0], tc[1], tc[2]);
  }

}

// ---- Public API ----

export interface AnimationFrame {
  pixels: Uint8Array;
  delayMs: number;
}

export function renderAnimation(snapshot: WeatherSnapshot): AnimationFrame[] {
  const icon = codeToIcon(snapshot.weatherCode, snapshot.isDay);
  const { count, delayMs } = ANIM[icon];
  const sign = snapshot.temperature < 0 ? "-" : "";
  const tempStr = `${sign}${Math.abs(snapshot.temperature)}°C`;

  return Array.from({ length: count }, (_, frame) => {
    const buf = mkBuf();
    drawAnimatedIcon(buf, icon, frame);
    drawText(buf, tempStr, 21, 255, 255, 255);
    if (!snapshot.isDay) applyNightTint(buf);
    return { pixels: buf, delayMs };
  });
}

export function render(snapshot: WeatherSnapshot): Uint8Array {
  const icon = codeToIcon(snapshot.weatherCode, snapshot.isDay);
  const buf = mkBuf();
  drawAnimatedIcon(buf, icon, 0);
  const sign = snapshot.temperature < 0 ? "-" : "";
  drawText(buf, `${sign}${Math.abs(snapshot.temperature)}°C`, 21, 255, 255, 255);
  if (!snapshot.isDay) applyNightTint(buf);
  return buf;
}
