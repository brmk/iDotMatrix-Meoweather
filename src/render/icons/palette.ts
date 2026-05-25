import type { Color } from '../types.js';

export const ICON_LAYOUT = {
  cloudY: 1,
  precipY: 11,
  sunCenter: [16, 8] as const,
  moonCenter: [16, 8] as const,
} as const;

export const SKY_COLORS = {
  sunCore: [255, 200, 0] as Color,
  sunRayBase: [255, 220, 50] as Color,
  sunRayHighlight: [255, 240, 100] as Color,
  moon: [220, 230, 255] as Color,
  moonMask: [0, 0, 0] as Color,
  starBright: [210, 220, 255] as Color,
  starDim: [90, 95, 120] as Color,
  starOff: [30, 32, 45] as Color,
} as const;

export const CLOUD_COLORS = {
  standard: [160, 165, 175] as Color,
  rain: [130, 135, 145] as Color,
  heavyRain: [100, 105, 115] as Color,
  thunder: [80, 85, 95] as Color,
  thunderFlash: [190, 195, 210] as Color,
} as const;

export const WEATHER_EFFECT_COLORS = {
  fog: [150, 150, 160] as Color,
  rainDrop: [80, 140, 255] as Color,
  rainDropTail: [60, 110, 220] as Color,
  snowCore: [200, 220, 255] as Color,
  snowEdge: [150, 170, 210] as Color,
  thunderBoltBright: [255, 255, 50] as Color,
  thunderBoltDim: [200, 200, 20] as Color,
} as const;
