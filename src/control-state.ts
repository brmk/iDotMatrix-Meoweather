import type { PetContext } from './pet/index.js';
import type { PetBehavior, PetState } from './render/pet/types.js';
import type { WeatherSnapshot } from './weather/index.js';

export interface BehaviorOverride {
  behavior: PetBehavior;
  dur: number;
}

export interface ControlState {
  pet: PetState | null;
  petCtx: PetContext | null;
  snapshot: WeatherSnapshot | null;
  tick: number;
  behaviorOverride: BehaviorOverride | null;
  weatherOverride: WeatherSnapshot | null;
  weatherDirty: boolean;
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
  logLines: [],
  logSubs: new Set(),
  currentFrame: null,
  frameSubs: new Set(),
};
