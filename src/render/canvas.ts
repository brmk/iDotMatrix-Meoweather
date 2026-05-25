import type { Color } from './types.js';

export const DISPLAY_WIDTH = 32;
export const DISPLAY_HEIGHT = 32;
export const RGB_CHANNELS = 3;
export const DISPLAY_PIXEL_COUNT = DISPLAY_WIDTH * DISPLAY_HEIGHT;

export function mkBuf(): Uint8Array {
  return new Uint8Array(DISPLAY_PIXEL_COUNT * RGB_CHANNELS);
}

export function set(buf: Uint8Array, x: number, y: number, color: Color): void {
  if (x < 0 || x >= DISPLAY_WIDTH || y < 0 || y >= DISPLAY_HEIGHT) return;
  const i = (y * DISPLAY_WIDTH + x) * RGB_CHANNELS;
  buf[i] = color[0];
  buf[i + 1] = color[1];
  buf[i + 2] = color[2];
}

export function fillCircle(buf: Uint8Array, cx: number, cy: number, rad: number, color: Color): void {
  const r2 = rad * rad;
  for (let dy = -rad; dy <= rad; dy++) {
    for (let dx = -rad; dx <= rad; dx++) {
      if (dx * dx + dy * dy <= r2) set(buf, cx + dx, cy + dy, color);
    }
  }
}

export function fillRect(buf: Uint8Array, x0: number, y0: number, x1: number, y1: number, color: Color): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      set(buf, x, y, color);
    }
  }
}
