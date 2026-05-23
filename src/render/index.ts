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
// Each glyph: 5 rows, each row is a 3-bit mask (bit2=left, bit1=mid, bit0=right)

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

// char width=3, gap=1 → advance 4 per char; total = len*4-1
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

// ---- Icon drawing ----

// Cloud: 3 overlapping circles + flat bottom, centred in 32-wide buffer
// yBase is the top row of the icon area.
function drawCloud(
  buf: Uint8Array,
  yBase: number,
  r: number,
  g: number,
  b: number
) {
  fillCircle(buf, 10, yBase + 4, 4, r, g, b); // left bump
  fillCircle(buf, 16, yBase + 2, 5, r, g, b); // centre (highest)
  fillCircle(buf, 22, yBase + 4, 4, r, g, b); // right bump
  fillRect(buf, 6, yBase + 5, 26, yBase + 8, r, g, b); // flat bottom
}

// Sun: filled yellow circle + 8 short rays
function drawSun(buf: Uint8Array, cx: number, cy: number) {
  fillCircle(buf, cx, cy, 5, 255, 200, 0);
  const dirs: Array<[number, number]> = [
    [0, -1], [0, 1], [-1, 0], [1, 0],
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ];
  for (const [dx, dy] of dirs) {
    const len = Math.sqrt(dx * dx + dy * dy);
    for (const d of [7, 8]) {
      set(
        buf,
        Math.round(cx + (dx * d) / len),
        Math.round(cy + (dy * d) / len),
        255, 220, 50
      );
    }
  }
}

// Moon crescent: white disc with dark disc offset to create crescent + 3 stars
function drawMoon(buf: Uint8Array, cx: number, cy: number) {
  fillCircle(buf, cx, cy, 6, 220, 230, 255);
  fillCircle(buf, cx + 3, cy - 2, 5, 0, 0, 0); // cut crescent
  set(buf, cx + 10, cy - 4, 200, 210, 255); // stars
  set(buf, cx - 9, cy - 2, 200, 210, 255);
  set(buf, cx + 8, cy + 5, 180, 190, 255);
}

// Rain: vertical 2-pixel drops below the cloud
function drawRain(buf: Uint8Array, yBase: number, heavy: boolean) {
  const drops = heavy
    ? [[9, 0], [15, 1], [21, 0], [12, 3], [18, 2], [24, 3]]
    : [[9, 0], [15, 1], [21, 0]];
  for (const [x, dy] of drops) {
    set(buf, x, yBase + dy, 80, 140, 255);
    set(buf, x, yBase + dy + 1, 80, 140, 255);
  }
}

// Snow: small cross-shaped flakes below the cloud
function drawSnow(buf: Uint8Array, yBase: number) {
  const flakes = [[9, 0], [16, 1], [23, 0], [12, 3], [19, 2]];
  for (const [x, dy] of flakes) {
    const fx = x, fy = yBase + dy;
    set(buf, fx, fy, 200, 220, 255);
    set(buf, fx - 1, fy + 1, 200, 220, 255);
    set(buf, fx, fy + 1, 200, 220, 255);
    set(buf, fx + 1, fy + 1, 200, 220, 255);
  }
}

// Lightning bolt: yellow zigzag below the cloud
function drawLightning(buf: Uint8Array, yBase: number) {
  const pixels = [
    [17, 0], [16, 1], [15, 1], [14, 2], [13, 2],
    [15, 3], [14, 4], [13, 4], [12, 5], [11, 6],
  ];
  for (const [x, dy] of pixels) {
    set(buf, x, yBase + dy, 255, 255, 0);
  }
}

// Fog: horizontal grey lines filling the icon area
function drawFog(buf: Uint8Array) {
  for (let y = 3; y <= 14; y += 3) {
    for (let x = 4; x <= 27; x++) {
      set(buf, x, y, 150, 150, 160);
    }
  }
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
  if (code === 2) return "partly-cloudy";
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

const CLOUD_Y = 1; // top of cloud / icon area
const PRECIP_Y = 11; // top of precipitation area (below cloud)

function drawIcon(buf: Uint8Array, icon: IconType) {
  switch (icon) {
    case "clear-day":
      drawSun(buf, 16, 8);
      break;

    case "clear-night":
      drawMoon(buf, 16, 8);
      break;

    case "partly-cloudy": {
      // Small sun top-left, cloud overlapping bottom-right
      fillCircle(buf, 9, 6, 4, 255, 200, 0);
      set(buf, 9, 0, 255, 220, 50); // top ray
      set(buf, 9, 1, 255, 220, 50);
      set(buf, 3, 6, 255, 220, 50); // left ray
      set(buf, 4, 6, 255, 220, 50);
      const [cr, cg, cb] = [160, 165, 175];
      fillCircle(buf, 14, 11, 3, cr, cg, cb);
      fillCircle(buf, 19, 9, 4, cr, cg, cb);
      fillCircle(buf, 24, 11, 3, cr, cg, cb);
      fillRect(buf, 11, 12, 27, 15, cr, cg, cb);
      break;
    }

    case "cloudy":
      drawCloud(buf, CLOUD_Y, 160, 165, 175);
      break;

    case "fog":
      drawFog(buf);
      break;

    case "rain":
      drawCloud(buf, CLOUD_Y, 130, 135, 145);
      drawRain(buf, PRECIP_Y, false);
      break;

    case "heavy-rain":
      drawCloud(buf, CLOUD_Y, 100, 105, 115);
      drawRain(buf, PRECIP_Y, true);
      break;

    case "snow":
      drawCloud(buf, CLOUD_Y, 160, 165, 175);
      drawSnow(buf, PRECIP_Y);
      break;

    case "thunder":
      drawCloud(buf, CLOUD_Y, 80, 85, 95);
      drawLightning(buf, PRECIP_Y);
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
  // Scanlines: filter byte 0 (None) + W*3 bytes per row
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
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- Public API ----

export function render(snapshot: WeatherSnapshot): Uint8Array {
  const buf = mkBuf();
  drawIcon(buf, codeToIcon(snapshot.weatherCode, snapshot.isDay));
  const sign = snapshot.temperature < 0 ? "-" : "";
  const temp = String(Math.abs(snapshot.temperature));
  drawText(buf, `${sign}${temp}°C`, 21, 255, 255, 255);
  return buf;
}

export function renderToPng(snapshot: WeatherSnapshot): Buffer {
  return rgbToPng(render(snapshot));
}

export function renderToFile(snapshot: WeatherSnapshot, path: string): void {
  writeFileSync(path, renderToPng(snapshot));
}
