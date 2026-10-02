import { DISPLAY_WIDTH, set } from '../canvas.js';
import { drawTextAt } from '../text/draw.js';
import { measureText } from '../text/measure.js';
import type { Color } from '../types.js';

// "14:25      23°": clock flush left, temperature flush right on one 5px line.
// The colon and the minus are narrowed and the degree sign's empty column trimmed,
// so even the widest case "23:41 -24°" keeps a 2px gap between the two.

export const CLOCK_COLOR: Color = [255, 160, 40];

function drawClock(buf: Uint8Array, clock: string, y: number, color: Color): void {
  const [hh = '', mm = ''] = clock.split(':');
  drawTextAt(buf, hh, 0, y, color);
  set(buf, 8, y + 1, color);
  set(buf, 8, y + 3, color);
  drawTextAt(buf, mm, 10, y, color);
}

function drawTemperatureFlushRight(buf: Uint8Array, text: string, y: number, color: Color): void {
  const negative = text.startsWith('-');
  const body = negative ? text.slice(1) : text;
  const width = measureText(body) - 1 + (negative ? 3 : 0); // -1: the degree sign's third column is empty
  let x = DISPLAY_WIDTH - width;
  if (negative) {
    set(buf, x, y + 2, color);
    set(buf, x + 1, y + 2, color);
    x += 3;
  }
  drawTextAt(buf, body, x, y, color);
}

export function drawClockLine(buf: Uint8Array, clock: string, temperatureText: string, y: number, temperatureColor: Color): void {
  drawClock(buf, clock, y, CLOCK_COLOR);
  drawTemperatureFlushRight(buf, temperatureText, y, temperatureColor);
}
