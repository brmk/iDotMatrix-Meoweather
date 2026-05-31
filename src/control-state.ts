import type { PetContext } from './pet/index.js';
import type { PetBehavior, PetState } from './render/pet/types.js';
import type { WeatherSnapshot } from './weather/index.js';
import { config } from './config.js';

export interface BehaviorOverride {
  behavior: PetBehavior;
  dur: number;
}

export interface BrightnessConfig {
  day: number;
  night: number;
}

/** Hour range [from, to) that forces night mode, wrapping midnight if from > to. */
export interface NightHours {
  from: number;
  to: number;
}

/** Hour range [offFrom, offTo) during which the matrix is completely off, wrapping midnight if offFrom > offTo. */
export interface PowerSchedule {
  offFrom: number;
  offTo: number;
}

export interface ControlState {
  pet: PetState | null;
  petCtx: PetContext | null;
  snapshot: WeatherSnapshot | null;
  tick: number;
  behaviorOverride: BehaviorOverride | null;
  weatherOverride: WeatherSnapshot | null;
  weatherDirty: boolean;
  brightness: BrightnessConfig;
  nightHours: NightHours | null;
  powerSchedule: PowerSchedule | null;
  logLines: string[];
  logSubs: Set<(line: string) => void>;
  currentFrame: string | null;
  frameSubs: Set<(frame: string) => void>;
}

export const controlState: ControlState = {
  pet: null,
  petCtx: null,
  snapshot: null,
  tick: 0,
  behaviorOverride: null,
  weatherOverride: null,
  weatherDirty: false,
  brightness: { day: config.dayBrightness, night: config.nightBrightness },
  nightHours: null,
  powerSchedule: null,
  logLines: [],
  logSubs: new Set(),
  currentFrame: null,
  frameSubs: new Set(),
};
