import { DISPLAY_WIDTH, set } from '../canvas.js';
import { drawTextAt } from '../text/draw.js';
import { measureText } from '../text/measure.js';
import type { Color } from '../types.js';

// "23°      14:25": temperature flush left, clock flush right on one 5px line.
// The colon and the minus are narrowed and the degree sign's empty column trimmed,
// so even the widest case "-24° 23:41" keeps a 2px gap between the two.

export const CLOCK_COLOR: Color = [255, 160, 40];

const CLOCK_WIDTH = 17; // HH (7) + gap + 1px colon + gap + MM (7)

function drawClockFlushRight(buf: Uint8Array, clock: string, y: number, color: Color): void {
  const [hh = '', mm = ''] = clock.split(':');
  const x = DISPLAY_WIDTH - CLOCK_WIDTH;
  drawTextAt(buf, hh, x, y, color);
  set(buf, x + 8, y + 1, color);
  set(buf, x + 8, y + 3, color);
  drawTextAt(buf, mm, x + 10, y, color);
}

function drawTemperature(buf: Uint8Array, text: string, y: number, color: Color): void {
  const negative = text.startsWith('-');
  const body = negative ? text.slice(1) : text;
  let x = 0;
  if (negative) {
    set(buf, x, y + 2, color);
    set(buf, x + 1, y + 2, color);
    x += 3;
  }
  drawTextAt(buf, body, x, y, color);
}

/** Width of the compact temperature as drawn: 2px minus, degree sign without its empty column. */
export function compactTemperatureWidth(text: string): number {
  const negative = text.startsWith('-');
  const body = negative ? text.slice(1) : text;
  return measureText(body) - 1 + (negative ? 3 : 0);
}

export function drawClockLine(buf: Uint8Array, clock: string, temperatureText: string, y: number, temperatureColor: Color): void {
  drawTemperature(buf, temperatureText, y, temperatureColor);
  drawClockFlushRight(buf, clock, y, CLOCK_COLOR);
}
