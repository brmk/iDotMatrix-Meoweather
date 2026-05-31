import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import type { WeatherSnapshot } from '../weather/index.js';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH, RGB_CHANNELS } from './canvas.js';
import { render, renderAnimationFrames } from './scene/frame.js';

export * from './canvas.js';
export * from './colors.js';
export * from './icons/effects.js';
export * from './icons/palette.js';
export * from './icons/primitives.js';
export * from './icons/registry.js';
export * from './icons/types.js';
export * from './icons/weather-map.js';
export * from './pet/behaviors.js';
export * from './pet/colors.js';
export * from './pet/draw.js';
export * from './pet/sprites.js';
export * from './pet/types.js';
export * from './scene/format.js';
export * from './scene/frame.js';
export * from './scene/tint.js';
export * from './text/draw.js';
export * from './text/glyphs.js';
export * from './text/measure.js';
export * from './types.js';

export function renderAnimation(snapshot: WeatherSnapshot) {
  return renderAnimationFrames(snapshot);
}

// ---- PNG writer (Node built-ins only) ----

// CRC lookup table built once at module load — avoids per-frame rebuild.
const CRC_TABLE = (() => {
  const tbl = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tbl[i] = c;
  }
  return tbl;
})();

function buildChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.allocUnsafe(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  // compute CRC over type + data without an intermediate concat buffer
  let crc = 0xffffffff;
  for (let i = 4; i < 8 + data.length; i++) crc = CRC_TABLE[(crc ^ out[i]!) & 0xff]! ^ (crc >>> 8);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + data.length);
  return out;
}

// Pre-built constant chunks — never change for 32×32 RGB.
const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const IHDR_DATA = Buffer.alloc(13);
IHDR_DATA.writeUInt32BE(DISPLAY_WIDTH, 0);
IHDR_DATA.writeUInt32BE(DISPLAY_HEIGHT, 4);
IHDR_DATA[8] = 8; // bit depth
IHDR_DATA[9] = 2; // color type: RGB truecolor
const IHDR_CHUNK = buildChunk('IHDR', IHDR_DATA);
const IEND_CHUNK = buildChunk('IEND', Buffer.alloc(0));

// Reusable scanline buffer — avoids one Buffer.alloc per frame.
const ROW_STRIDE = 1 + DISPLAY_WIDTH * RGB_CHANNELS;
const RAW_BUF = Buffer.alloc(DISPLAY_HEIGHT * ROW_STRIDE);
for (let y = 0; y < DISPLAY_HEIGHT; y++) RAW_BUF[y * ROW_STRIDE] = 0; // filter byte: None

function rgbToPng(rgb: Uint8Array): Buffer {
  for (let y = 0; y < DISPLAY_HEIGHT; y++) {
    RAW_BUF.set(rgb.subarray(y * DISPLAY_WIDTH * RGB_CHANNELS, (y + 1) * DISPLAY_WIDTH * RGB_CHANNELS), y * ROW_STRIDE + 1);
  }
  const idat = buildChunk('IDAT', deflateSync(RAW_BUF, { level: 1 }));
  return Buffer.concat([PNG_SIG, IHDR_CHUNK, idat, IEND_CHUNK]);
}

export function pixelsToPng(pixels: Uint8Array): Buffer {
  return rgbToPng(pixels);
}

export function renderToPng(snapshot: WeatherSnapshot): Buffer {
  return rgbToPng(render(snapshot));
}

export function renderToFile(snapshot: WeatherSnapshot, path: string): void {
  writeFileSync(path, renderToPng(snapshot));
}
