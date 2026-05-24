import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import type { WeatherSnapshot } from "../weather/index.js";

const W = 32;
const H = 32;

// ---- Pixel buffer helpers ----

function mkBuf(): Uint8Array {
  return new Uint8Array(W * H * 3); // all black
}

function set(
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

type IconType =
  | "clear-day"
  | "clear-night"
  | "partly-cloudy"
  | "cloudy"
  | "fog"
  | "rain"
  | "heavy-rain"
  | "snow"
  | "thunder";

function codeToIcon(code: number, isDay: boolean): IconType {
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

// Rays rotate clockwise: 4 of 8 rays get a bright outer pixel each frame
function drawAnimatedSun(buf: Uint8Array, cx: number, cy: number, frame: number) {
  fillCircle(buf, cx, cy, 5, 255, 200, 0);

  // 8 directions in clockwise order starting from N
  const dirs: Array<[number, number]> = [
    [0, -1], [1, -1], [1, 0], [1, 1],
    [0, 1], [-1, 1], [-1, 0], [-1, -1],
  ];

  // Active cluster of 4 consecutive rays rotates by 1 position per frame
  const active = new Set([0, 1, 2, 3].map(o => (frame + o) % 8));

  for (let i = 0; i < dirs.length; i++) {
    const [dx, dy] = dirs[i]!;
    const len = Math.sqrt(dx * dx + dy * dy);
    // All rays have inner pixel at d=7
    set(buf, Math.round(cx + dx * 7 / len), Math.round(cy + dy * 7 / len), 255, 220, 50);
    // Active rays additionally get outer pixel at d=9
    if (active.has(i)) {
      set(buf, Math.round(cx + dx * 9 / len), Math.round(cy + dy * 9 / len), 255, 240, 100);
    }
  }
}

// Moon stays static; stars twinkle with a 3-state cycle
function drawAnimatedMoon(buf: Uint8Array, cx: number, cy: number, frame: number) {
  fillCircle(buf, cx, cy, 6, 220, 230, 255);
  fillCircle(buf, cx + 3, cy - 2, 5, 0, 0, 0);

  // 4 stars with independent twinkle phases
  const stars: Array<[number, number, number]> = [
    [cx + 10, cy - 4, 0],
    [cx - 9,  cy - 2, 2],
    [cx + 8,  cy + 5, 4],
    [cx + 11, cy + 1, 1],
  ];

  for (const [sx, sy, phase] of stars) {
    const state = (frame + phase) % 6;
    // Bright on states 0,1; dim on 2,3; very dim on 4,5
    const [r, g, b] =
      state < 2 ? [210, 220, 255] :
      state < 4 ? [90, 95, 120] :
                  [30, 32, 45];
    set(buf, sx, sy, r, g, b);
  }
}

// Sun glows (brightness pulse), cloud is static
function drawAnimatedPartlyCloudy(buf: Uint8Array, frame: number) {
  // Sun brightness cycles through 4 levels
  const levels = [255, 210, 175, 210];
  const lv = levels[frame % 4]!;
  const sr = lv;
  const sg = Math.round(lv * 200 / 255);
  const sb = 0;

  fillCircle(buf, 9, 6, 4, sr, sg, sb);
  // Sun rays (2 short ones to fit in the corner)
  set(buf, 9, 0, sr, sg + 20, sb); // top
  set(buf, 9, 1, sr, sg + 20, sb);
  set(buf, 3, 6, sr, sg + 20, sb); // left
  set(buf, 4, 6, sr, sg + 20, sb);

  // Cloud drifts slightly: frames 0-3 at 0, frames 4-7 at +1
  const xOff = frame >= 4 ? 1 : 0;
  const [cr, cg, cb] = [160, 165, 175];
  fillCircle(buf, 14 + xOff, 11, 3, cr, cg, cb);
  fillCircle(buf, 19 + xOff, 9, 4, cr, cg, cb);
  fillCircle(buf, 24 + xOff, 11, 3, cr, cg, cb);
  fillRect(buf, 11 + xOff, 12, 27 + xOff, 15, cr, cg, cb);
}

// Cloud sways left/right by 1 pixel
const CLOUD_SWAY = [0, 0, 1, 1, 0, 0, -1, -1];

function drawAnimatedCloud(buf: Uint8Array, frame: number) {
  const xOff = CLOUD_SWAY[frame % CLOUD_SWAY.length]!;
  drawCloud(buf, CLOUD_Y, 160, 165, 175, xOff);
}

// Fog lines scroll right — dashes of varying length create a drifting wispiness
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
      // Create dashes: pixel ON if (i + frame + row) % 4 < 3
      if ((i + frame + line.y) % 4 < 3) {
        const x = line.xStart + i;
        set(buf, x, line.y, 150, 150, 160);
      }
    }
  }
}

// Rain drops fall: 3 tracks, staggered phases, 1px/frame
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

  const areaH = 9; // precipitation height: PRECIP_Y to PRECIP_Y+8

  for (const { x, phase } of tracks) {
    const y = PRECIP_Y + (frame + phase) % areaH;
    set(buf, x, y, 80, 140, 255);
    if (y + 1 < PRECIP_Y + areaH) {
      set(buf, x, y + 1, 60, 110, 220);
    }
  }
}

// Snow flakes fall and gently drift horizontally
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
    // Cross-shaped flake
    set(buf, fx,     fy,     200, 220, 255);
    set(buf, fx - 1, fy,     150, 170, 210);
    set(buf, fx + 1, fy,     150, 170, 210);
    set(buf, fx,     fy - 1, 150, 170, 210);
    set(buf, fx,     fy + 1, 150, 170, 210);
  }
}

// Thunder: dark storm cloud most frames; lightning flash on frames 6-7
function drawAnimatedThunder(buf: Uint8Array, frame: number) {
  const isFlash = frame === 6 || frame === 7;

  const [cr, cg, cb] = isFlash
    ? [190, 195, 210]  // brighter cloud during flash
    : [80, 85, 95];    // dark stormy cloud otherwise

  drawCloud(buf, CLOUD_Y, cr, cg, cb);

  if (isFlash) {
    // Bright yellow lightning bolt
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

const ANIM: Record<IconType, { count: number; delayMs: number }> = {
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

function drawAnimatedIcon(buf: Uint8Array, icon: IconType, frame: number) {
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

// ---- PNG writer (Node built-ins only) ----

function crc32(data: Buffer): number {
  const tbl = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    tbl[i] = c;
  }
  let crc = 0xffffffff;
  for (const byte of data) crc = tbl[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

function rgbToPng(rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    for (let x = 0; x < W; x++) {
      const src = (y * W + x) * 3;
      const dst = y * (1 + W * 3) + 1 + x * 3;
      raw[dst] = rgb[src]!;
      raw[dst + 1] = rgb[src + 1]!;
      raw[dst + 2] = rgb[src + 2]!;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- Night tint ----

function applyNightTint(buf: Uint8Array): void {
  for (let i = 0; i < buf.length; i += 3) {
    buf[i + 1] = Math.round((buf[i + 1] ?? 0) * 0.85);
    buf[i + 2] = Math.round((buf[i + 2] ?? 0) * 0.45);
  }
}

// ---- Pixel pet (Bengal cat) ----
//
// Colors — warm ginger/beige/cinnamon palette, no purple:
//   o = base orange     [255,155,30]
//   g = green eye       [50,220,80]
//   s = cinnamon stripe [195,105,25]  ← warm darker-orange, clearly not purple
//   l = cream belly     [255,205,130]
//
// Original 5×4 user grid preserved as base:
//   ears: . . o . o
//   face: o . g o g   ← original orange cheeks, green eyes (no dark spot on face)
//   body: . o l s o   ← cream belly + one warm stripe
//   legs: varies
//
// facingRight=false → sprite mirrored horizontally.

export const PET_WIDTH = 5;
export const PET_Y_WALK = 28;
export const PET_Y_PERCH = 17; // feet just above temperature text at y=21

type Pixel = [number, number, string];
type PetColor = Record<string, [number, number, number]>;

const PET_DAY: PetColor = {
  o: [255, 155, 30],
  g: [50, 220, 80],
  s: [195, 105, 25],
  l: [255, 205, 130],
  r: [184, 74, 10],
};
const PET_NIGHT: PetColor = {
  o: [130, 75, 15],
  g: [20, 100, 35],
  s: [100, 55, 12],
  l: [130, 105, 65],
  r: [95, 38, 5],
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

// Walk: 2-frame cycle — legs spread / legs together
const WALK = [
  parseSpr(['..o.o', '..gog', '.oroo', '.o.o.']),  // A: legs spread
  parseSpr(['..o.o', '..gog', '.oroo', '..oo.']),  // B: legs together
];
// Eye-closed variants for blinking during walk
const WALK_BLINK = [
  parseSpr(['..o.o', '..ooo', '.oroo', '.o.o.']),
  parseSpr(['..o.o', '..ooo', '.oroo', '..oo.']),
];

// Sit: same baseY=28, 4 rows — tail curls around haunches
const SIT = [
  parseSpr(['..o.o', '..gog', '.sroo', '.sso.']),  // eyes open
  parseSpr(['..o.o', '..ooo', '.sroo', '.sso.']),  // blink (g→o)
];

// Lie: baseY=29, 3 rows — tail wags up/down via separate pixel
const LIE = [
  parseSpr(['..o.o', '..gog', '.oroo']),  // awake
  parseSpr(['..o.o', '..ooo', '.oroo']),  // sleepy / eyes closed
];

// Jump: 4 positions with y-offsets
const JUMP: Array<{ pix: Pixel[]; yOff: number }> = [
  { pix: parseSpr(['..o.o', '..gog', '.oroo', '.o.o.']), yOff:  1 }, // crouch ↓
  { pix: parseSpr(['..o.o', '..gog', '.oroo', '.....']), yOff:  0 }, // launch
  { pix: parseSpr(['..o.o', '..gog', '.oroo', '.....']), yOff: -1 }, // peak
  { pix: parseSpr(['..o.o', '..gog', '.oroo', '.o.o.']), yOff:  0 }, // land
];

// Tail: 1 pixel, waves between eye row (+1) and body row (+2) from PET_Y_WALK
const TAIL_Y = [1, 2, 1, 2];

// Dream: ZZZ bubbles + tiny fish floating above a sleeping cat
// ZZZ dream: 3 pixels rise one by one (3 frames each), then gap, repeat
// 9-frame active + 3-frame pause = 12-frame cycle @ 150ms = 1.8s
function drawDream(buf: Uint8Array, s: PetState): void {
  const zX = s.x + 2;
  const phase = s.behaviorFrame % 12;
  const [r, g, b] = [160, 160, 255] as const;
  if (phase < 3)  set(buf, zX,     PET_Y_WALK - 2, r, g, b); // z1 — close
  if (phase >= 3 && phase < 6)  set(buf, zX + 1, PET_Y_WALK - 4, r, g, b); // z2 — mid
  if (phase >= 6 && phase < 9)  set(buf, zX + 2, PET_Y_WALK - 6, r, g, b); // z3 — far
  // phase 9-11: all off (pause before next cycle)
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
  perchY: number; // current Y during perch arc; equals PET_Y_WALK when not perching
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
      drawTail = false; // tail shown curled in sprite
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
      drawTail = false;
      break;
    case 'dream':
      pixels = LIE[1]!; // always closed eyes
      baseY = PET_Y_WALK + 1;
      drawTail = false;
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

export function pixelsToPng(pixels: Uint8Array): Buffer {
  return rgbToPng(pixels);
}

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

export function renderToPng(snapshot: WeatherSnapshot): Buffer {
  return rgbToPng(render(snapshot));
}

export function renderToFile(snapshot: WeatherSnapshot, path: string): void {
  writeFileSync(path, renderToPng(snapshot));
}
