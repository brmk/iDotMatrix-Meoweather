import type { WeatherSnapshot } from '../weather/index.js';
import { mkBuf } from './canvas.js';
import { drawText } from './font.js';
import { codeToIcon, drawAnimatedIcon, ANIM } from './icons.js';

export interface AnimationFrame {
  pixels: Uint8Array;
  delayMs: number;
}

export function applyNightTint(buf: Uint8Array): void {
  for (let i = 0; i < buf.length; i += 3) {
    buf[i + 1] = Math.round((buf[i + 1] ?? 0) * 0.85);
    buf[i + 2] = Math.round((buf[i + 2] ?? 0) * 0.45);
  }
}

export function renderAnimation(snapshot: WeatherSnapshot): AnimationFrame[] {
  const icon = codeToIcon(snapshot.weatherCode, snapshot.isDay);
  const { count, delayMs } = ANIM[icon];
  const sign = snapshot.temperature < 0 ? '-' : '';
  const tempStr = `${sign}${Math.abs(snapshot.temperature)}°C`;

  return Array.from({ length: count }, (_, frame) => {
    const buf = mkBuf();
    drawAnimatedIcon(buf, icon, frame);
    drawText(buf, tempStr, 21, 255, 255, 255);
    if (!snapshot.isDay) applyNightTint(buf);
    return { pixels: buf, delayMs };
  });
}

export function render(snapshot: WeatherSnapshot): Uint8Array {
  const icon = codeToIcon(snapshot.weatherCode, snapshot.isDay);
  const buf = mkBuf();
  drawAnimatedIcon(buf, icon, 0);
  const sign = snapshot.temperature < 0 ? '-' : '';
  drawText(buf, `${sign}${Math.abs(snapshot.temperature)}°C`, 21, 255, 255, 255);
  if (!snapshot.isDay) applyNightTint(buf);
  return buf;
}
