import { DISPLAY_WIDTH, set } from '../canvas.js';
import { drawTextAt } from '../text/draw.js';
import { measureText } from '../text/measure.js';
import type { Color } from '../types.js';

// "23°      14:25": temperature on the left, clock on the right on one 5px line,
// with a 1px edge padding. The colon and the minus are narrowed and the degree
// sign's empty column trimmed. When the padding would leave less than a 2px gap
// (only "-10°" … "-99°"), the line goes edge to edge instead.

export const CLOCK_COLOR: Color = [255, 160, 40];

const CLOCK_WIDTH = 17; // HH (7) + gap + 1px colon + gap + MM (7)
const EDGE_PADDING = 1;
const MIN_GAP = 2;

function drawClock(buf: Uint8Array, clock: string, x: number, y: number, color: Color): void {
  const [hh = '', mm = ''] = clock.split(':');
  drawTextAt(buf, hh, x, y, color);
  set(buf, x + 8, y + 1, color);
  set(buf, x + 8, y + 3, color);
  drawTextAt(buf, mm, x + 10, y, color);
}

function drawTemperature(buf: Uint8Array, text: string, x: number, y: number, color: Color): void {
  const negative = text.startsWith('-');
  const body = negative ? text.slice(1) : text;
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
  const fits = compactTemperatureWidth(temperatureText) + MIN_GAP + CLOCK_WIDTH + 2 * EDGE_PADDING <= DISPLAY_WIDTH;
  const padding = fits ? EDGE_PADDING : 0;
  drawTemperature(buf, temperatureText, padding, y, temperatureColor);
  drawClock(buf, clock, DISPLAY_WIDTH - padding - CLOCK_WIDTH, y, CLOCK_COLOR);
}
