import {
  drawAnimatedCloud,
  drawAnimatedFog,
  drawAnimatedMoon,
  drawAnimatedPartlyCloudy,
  drawAnimatedRain,
  drawAnimatedSnow,
  drawAnimatedSun,
  drawAnimatedThunder,
  drawCompactCloud,
  drawCompactFog,
  drawCompactMoon,
  drawCompactPartlyCloudy,
  drawCompactRain,
  drawCompactSnow,
  drawCompactSun,
  drawCompactThunder,
} from './effects.js';
import { ICON_TYPES, type IconAnimationMeta, type IconDef, type IconType } from './types.js';

export const ICON_REGISTRY: Record<IconType, IconDef> = {
  'clear-day': { count: 8, delayMs: 150, draw: drawAnimatedSun },
  'clear-night': { count: 6, delayMs: 280, draw: drawAnimatedMoon },
  'partly-cloudy': { count: 8, delayMs: 180, draw: drawAnimatedPartlyCloudy },
  cloudy: { count: 8, delayMs: 220, draw: drawAnimatedCloud },
  fog: { count: 8, delayMs: 160, draw: drawAnimatedFog },
  rain: { count: 8, delayMs: 140, draw: (buf, frame) => drawAnimatedRain(buf, frame, false) },
  'heavy-rain': { count: 8, delayMs: 110, draw: (buf, frame) => drawAnimatedRain(buf, frame, true) },
  snow: { count: 12, delayMs: 170, draw: drawAnimatedSnow },
  thunder: { count: 10, delayMs: 160, draw: drawAnimatedThunder },
};

export const ANIM: Record<IconType, IconAnimationMeta> = Object.fromEntries(
  (Object.entries(ICON_REGISTRY) as Array<[IconType, IconDef]>).map(([icon, def]) => [icon, { count: def.count, delayMs: def.delayMs }]),
) as Record<IconType, IconAnimationMeta>;

export function drawAnimatedIcon(buf: Uint8Array, icon: IconType, frame: number): void {
  ICON_REGISTRY[icon].draw(buf, frame);
}

export const COMPACT_ICON_REGISTRY: Record<IconType, IconDef> = {
  'clear-day': { count: 8, delayMs: 150, draw: drawCompactSun },
  'clear-night': { count: 6, delayMs: 280, draw: drawCompactMoon },
  'partly-cloudy': { count: 8, delayMs: 180, draw: drawCompactPartlyCloudy },
  cloudy: { count: 8, delayMs: 220, draw: drawCompactCloud },
  fog: { count: 8, delayMs: 160, draw: drawCompactFog },
  rain: { count: 8, delayMs: 140, draw: (buf, frame) => drawCompactRain(buf, frame, false) },
  'heavy-rain': { count: 8, delayMs: 110, draw: (buf, frame) => drawCompactRain(buf, frame, true) },
  snow: { count: 12, delayMs: 170, draw: drawCompactSnow },
  thunder: { count: 10, delayMs: 160, draw: drawCompactThunder },
};

export function drawCompactIcon(buf: Uint8Array, icon: IconType, frame: number): void {
  COMPACT_ICON_REGISTRY[icon].draw(buf, frame);
}

export function listRegisteredIcons(): readonly IconType[] {
  return ICON_TYPES;
}
