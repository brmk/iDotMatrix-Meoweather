import { set } from '../canvas.js';
import type { Color } from '../types.js';

const HUM_ACTIVE: Color = [0, 180, 255];
const HUM_DIM: Color = [0, 30, 55];
const HUM_TICK: Color = [0, 55, 90];
const WIND_ACTIVE: Color = [200, 220, 255];
const WIND_DIM: Color = [35, 45, 60];
const WIND_TICK: Color = [60, 70, 90];

const BAR_TOP = 0;
const BAR_BOTTOM = 17;
const BAR_H = BAR_BOTTOM - BAR_TOP + 1;
const WIND_MAX = 60; // km/h → full bar

const TICK_25 = Math.round(BAR_H * 0.25);
const TICK_50 = Math.round(BAR_H * 0.5);
const TICK_75 = Math.round(BAR_H * 0.75);

function drawBar(buf: Uint8Array, x: number, fillPx: number, active: Color, dim: Color, tick: Color): void {
  for (let y = BAR_TOP; y <= BAR_BOTTOM; y++) {
    const fromBottom = BAR_BOTTOM - y;
    let color: Color;
    if (fromBottom < fillPx) {
      color = active;
    } else if (fromBottom === TICK_25 || fromBottom === TICK_50 || fromBottom === TICK_75) {
      color = tick;
    } else {
      color = dim;
    }
    set(buf, x, y, color);
    set(buf, x + 1, y, color);
  }
}

export function drawSideBars(buf: Uint8Array, humidity: number, windSpeed: number): void {
  const humFill = Math.round((humidity / 100) * BAR_H);
  const windFill = Math.round((Math.min(windSpeed, WIND_MAX) / WIND_MAX) * BAR_H);
  drawBar(buf, 0, humFill, HUM_ACTIVE, HUM_DIM, HUM_TICK);
  drawBar(buf, 30, windFill, WIND_ACTIVE, WIND_DIM, WIND_TICK);
}
