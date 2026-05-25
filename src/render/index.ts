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

function crc32(data: Buffer): number {
  const tbl = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tbl[i] = c;
  }
  let crc = 0xffffffff;
  for (const byte of data) crc = tbl[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

function rgbToPng(rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc(DISPLAY_HEIGHT * (1 + DISPLAY_WIDTH * RGB_CHANNELS));
  for (let y = 0; y < DISPLAY_HEIGHT; y++) {
    raw[y * (1 + DISPLAY_WIDTH * RGB_CHANNELS)] = 0;
    for (let x = 0; x < DISPLAY_WIDTH; x++) {
      const src = (y * DISPLAY_WIDTH + x) * RGB_CHANNELS;
      const dst = y * (1 + DISPLAY_WIDTH * RGB_CHANNELS) + 1 + x * RGB_CHANNELS;
      raw[dst] = rgb[src]!;
      raw[dst + 1] = rgb[src + 1]!;
      raw[dst + 2] = rgb[src + 2]!;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(DISPLAY_WIDTH, 0);
  ihdr.writeUInt32BE(DISPLAY_HEIGHT, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
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
