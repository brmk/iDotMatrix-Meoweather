import { fillCircle, fillRect } from '../canvas.js';
import type { Color } from '../types.js';

export function drawCloud(buf: Uint8Array, yBase: number, color: Color, xOff = 0): void {
  fillCircle(buf, 10 + xOff, yBase + 4, 4, color);
  fillCircle(buf, 16 + xOff, yBase + 2, 5, color);
  fillCircle(buf, 22 + xOff, yBase + 4, 4, color);
  fillRect(buf, 6 + xOff, yBase + 5, 26 + xOff, yBase + 8, color);
}
