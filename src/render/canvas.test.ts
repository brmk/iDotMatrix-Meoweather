import { describe, expect, it } from 'vitest';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH, fillCircle, fillRect, mkBuf, RGB_CHANNELS, set } from './canvas.js';

function readPixel(buf: Uint8Array, x: number, y: number): [number, number, number] {
  const index = (y * DISPLAY_WIDTH + x) * RGB_CHANNELS;
  return [buf[index] ?? 0, buf[index + 1] ?? 0, buf[index + 2] ?? 0];
}

describe('render/canvas', () => {
  it('allocates a buffer that matches the shared display dimensions', () => {
    expect(mkBuf()).toHaveLength(DISPLAY_WIDTH * DISPLAY_HEIGHT * RGB_CHANNELS);
  });

  it('ignores out-of-bounds writes', () => {
    const buf = mkBuf();
    set(buf, -1, 0, [1, 2, 3]);
    set(buf, DISPLAY_WIDTH, DISPLAY_HEIGHT - 1, [4, 5, 6]);
    expect(Array.from(buf).every((value) => value === 0)).toBe(true);
  });

  it('fills rectangles inclusively', () => {
    const buf = mkBuf();
    fillRect(buf, 1, 2, 2, 3, [10, 20, 30]);

    expect(readPixel(buf, 1, 2)).toEqual([10, 20, 30]);
    expect(readPixel(buf, 2, 3)).toEqual([10, 20, 30]);
    expect(readPixel(buf, 0, 2)).toEqual([0, 0, 0]);
  });

  it('fills only pixels inside the circle radius', () => {
    const buf = mkBuf();
    fillCircle(buf, 4, 4, 1, [9, 8, 7]);

    expect(readPixel(buf, 4, 4)).toEqual([9, 8, 7]);
    expect(readPixel(buf, 5, 4)).toEqual([9, 8, 7]);
    expect(readPixel(buf, 5, 5)).toEqual([0, 0, 0]);
  });
});
