import type { WeatherSnapshot } from '../../weather/index.js';
import { mkBuf } from '../canvas.js';
import { WHITE } from '../colors.js';
import { ANIM, drawAnimatedIcon } from '../icons/registry.js';
import type { IconType } from '../icons/types.js';
import { codeToIcon } from '../icons/weather-map.js';
import { drawCenteredText } from '../text/draw.js';
import type { AnimationFrame } from '../types.js';
import { drawSideBars } from './bars.js';
import { formatTemperature } from './format.js';
import { applyNightTint } from './tint.js';

const TEMPERATURE_Y = 21;

export interface SceneDescriptor {
  icon: IconType;
  temperatureText: string;
  isDay: boolean;
  humidity: number;
  windSpeed: number;
}

export function describeScene(snapshot: WeatherSnapshot): SceneDescriptor {
  return {
    icon: codeToIcon(snapshot.weatherCode, snapshot.isDay),
    temperatureText: formatTemperature(snapshot.temperature),
    isDay: snapshot.isDay,
    humidity: snapshot.humidity,
    windSpeed: snapshot.windSpeed,
  };
}

export function renderFrame(scene: SceneDescriptor, frame: number): Uint8Array {
  const buf = mkBuf();
  drawSideBars(buf, scene.humidity, scene.windSpeed);
  drawAnimatedIcon(buf, scene.icon, frame);
  drawCenteredText(buf, scene.temperatureText, TEMPERATURE_Y, WHITE);
  if (!scene.isDay) applyNightTint(buf);
  return buf;
}

export function renderAnimationFrames(snapshot: WeatherSnapshot): AnimationFrame[] {
  const scene = describeScene(snapshot);
  const { count, delayMs } = ANIM[scene.icon];

  return Array.from({ length: count }, (_, frame) => ({
    pixels: renderFrame(scene, frame),
    delayMs,
  }));
}

export function render(snapshot: WeatherSnapshot): Uint8Array {
  return renderFrame(describeScene(snapshot), 0);
}
