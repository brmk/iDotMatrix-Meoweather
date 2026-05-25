import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import type { WeatherSnapshot } from '../weather/index.js';
import { render } from './core.js';

export * from './core.js';

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

const W = 32;
const H = 32;

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
