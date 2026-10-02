import type { WeatherSnapshot } from '../../weather/index.js';
import { mkBuf } from '../canvas.js';
import { WHITE } from '../colors.js';
import { ANIM, drawAnimatedIcon } from '../icons/registry.js';
import type { IconType } from '../icons/types.js';
import { codeToIcon } from '../icons/weather-map.js';
import { drawCenteredText } from '../text/draw.js';
import type { AnimationFrame } from '../types.js';
import { drawSideBars } from './bars.js';
import { drawClockLine } from './clock-line.js';
import { formatCompactTemperature, formatTemperature } from './format.js';
import { applyNightTint } from './tint.js';

const TEMPERATURE_Y = 21;

export interface SceneDescriptor {
  icon: IconType;
  temperatureText: string;
  isDay: boolean;
  humidity: number;
  windSpeed: number;
  /** When set, the bottom line shows the temperature on the left and this clock on the right. */
  clockText?: string;
}

export function describeScene(snapshot: WeatherSnapshot, clock?: string): SceneDescriptor {
  return {
    icon: codeToIcon(snapshot.weatherCode, snapshot.isDay),
    temperatureText: clock === undefined ? formatTemperature(snapshot.temperature) : formatCompactTemperature(snapshot.temperature),
    isDay: snapshot.isDay,
    humidity: snapshot.humidity,
    windSpeed: snapshot.windSpeed,
    ...(clock === undefined ? {} : { clockText: clock }),
  };
}

export function renderFrame(scene: SceneDescriptor, frame: number): Uint8Array {
  const buf = mkBuf();
  drawSideBars(buf, scene.humidity, scene.windSpeed);
  drawAnimatedIcon(buf, scene.icon, frame);
  if (scene.clockText === undefined) {
    drawCenteredText(buf, scene.temperatureText, TEMPERATURE_Y, WHITE);
  } else {
    drawClockLine(buf, scene.clockText, scene.temperatureText, TEMPERATURE_Y, WHITE);
  }
  if (!scene.isDay) applyNightTint(buf);
  return buf;
}

/** `clock` (`HH:MM`) puts the clock and the temperature on the bottom line together. */
export function renderAnimationFrames(snapshot: WeatherSnapshot, clock?: string): AnimationFrame[] {
  const scene = describeScene(snapshot, clock);
  const { count, delayMs } = ANIM[scene.icon];

  return Array.from({ length: count }, (_, frame) => ({
    pixels: renderFrame(scene, frame),
    delayMs,
  }));
}

export function render(snapshot: WeatherSnapshot): Uint8Array {
  return renderFrame(describeScene(snapshot), 0);
}
