import { DISPLAY_WIDTH } from '../render/canvas.js';
import { PET_WIDTH, PET_Y_PERCH, PET_Y_WALK } from '../render/pet/sprites.js';
import type { PetBehavior, PetState } from '../render/pet/types.js';
import { PET_BEHAVIOR_CONFIG, type BehaviorPeriodConfig } from './config.js';

export type { PetBehavior, PetState };

function rndWith(min: number, max: number, rand: () => number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

export interface PetContext {
  stepCounter: number;
  tailCounter: number;
  blinkTimer: number;
  walkBudget: number;
  behaviorDur: number;
}

export function makePetContext(rand = Math.random): PetContext {
  return {
    stepCounter: 0,
    tailCounter: 0,
    blinkTimer: rndWith(PET_BEHAVIOR_CONFIG.initialBlinkMin, PET_BEHAVIOR_CONFIG.initialBlinkMax, rand),
    walkBudget: rndWith(PET_BEHAVIOR_CONFIG.day.walkBudgetMin, PET_BEHAVIOR_CONFIG.day.walkBudgetMax, rand),
    behaviorDur: 0,
  };
}

function pickBehavior(period: BehaviorPeriodConfig, roll: number): PetBehavior {
  let cursor = 0;
  for (const [behavior, cfg] of Object.entries(period.transitions) as Array<[PetBehavior, BehaviorPeriodConfig['transitions'][PetBehavior]]>) {
    if (!cfg || cfg.chance <= 0) continue;
    cursor += cfg.chance;
    if (roll < cursor) return behavior;
  }
  return 'walk';
}

function rollBehavior(state: PetState, ctx: PetContext, rand: () => number): void {
  const period = state.isDay ? PET_BEHAVIOR_CONFIG.day : PET_BEHAVIOR_CONFIG.night;
  const next = pickBehavior(period, rand());
  const nextCfg = period.transitions[next];
  ctx.walkBudget = rndWith(period.walkBudgetMin, period.walkBudgetMax, rand);

  if (next !== 'walk' && nextCfg) {
    ctx.behaviorDur = rndWith(nextCfg.minDuration, nextCfg.maxDuration, rand);
    state.behavior = next;
    state.behaviorFrame = 0;
  }
}

export function advanceWalk(state: PetState, ctx: PetContext, rand = Math.random): PetState {
  ctx.stepCounter++;

  if (ctx.stepCounter < 2) return state;
  ctx.stepCounter = 0;

  if (!state.isDay && state.x >= 25) {
    state.facingRight = false;
  }

  state.x += state.facingRight ? 1 : -1;
  if (state.x >= DISPLAY_WIDTH - PET_WIDTH) {
    state.x = DISPLAY_WIDTH - PET_WIDTH;
    state.facingRight = false;
  }
  if (state.x <= 0) {
    state.x = 0;
    state.facingRight = true;
  }

  state.walkFrame = (state.walkFrame + 1) % 2;
  ctx.walkBudget--;

  if (ctx.walkBudget <= 0) {
    rollBehavior(state, ctx, rand);
  }

  return state;
}

export function advancePerch(state: PetState, ctx: PetContext, rand = Math.random): PetState {
  if (state.perchY > PET_Y_PERCH && ctx.behaviorDur > 0) {
    // arc up — gated on budget > 0 so arc-down can't re-trigger this branch
    state.perchY = Math.max(PET_Y_PERCH, state.perchY - 2);
    ctx.stepCounter = 0;
  } else if (ctx.behaviorDur > 0) {
    // walk on text: 1px/frame, legs animate every 2 steps
    ctx.stepCounter = 0;
    state.x += state.facingRight ? 1 : -1;
    if (state.x > 22) {
      state.x = 22;
      state.facingRight = false;
    }
    if (state.x < 4) {
      state.x = 4;
      state.facingRight = true;
    }
    if (ctx.behaviorDur % 2 === 0) state.walkFrame = (state.walkFrame + 1) % 2;
    ctx.behaviorDur--;
  } else {
    // arc down
    state.perchY = Math.min(PET_Y_WALK, state.perchY + 2);
    if (state.perchY >= PET_Y_WALK) {
      state.perchY = PET_Y_WALK;
      state.behavior = 'walk';
      state.behaviorFrame = 0;
      const period = state.isDay ? PET_BEHAVIOR_CONFIG.day : PET_BEHAVIOR_CONFIG.night;
      ctx.walkBudget = rndWith(period.walkBudgetMin, period.walkBudgetMax, rand);
    }
  }

  return state;
}

export function advanceTimed(state: PetState, ctx: PetContext): PetState {
  state.behaviorFrame++;
  if (state.behaviorFrame >= ctx.behaviorDur) {
    state.behavior = 'walk';
    state.behaviorFrame = 0;
  }
  return state;
}

export function advanceBurp(state: PetState, ctx: PetContext): PetState {
  if (state.behaviorFrame === 0) {
    const floorX = state.facingRight ? state.x + PET_WIDTH : state.x - 1;
    state.pukeItems.push({ x: floorX, y: PET_Y_WALK + 3, ttl: PET_BEHAVIOR_CONFIG.burpResidueTTL });
  }

  state.behaviorFrame++;
  if (state.behaviorFrame >= ctx.behaviorDur) {
    state.behavior = 'walk';
    state.behaviorFrame = 0;
  }
  return state;
}

export function advancePoo(state: PetState, ctx: PetContext): PetState {
  if (state.behaviorFrame === 0) {
    const rearX = state.facingRight ? state.x : state.x + PET_WIDTH - 1;
    state.pooItems.push({ x: rearX, y: PET_Y_WALK + 3, ttl: PET_BEHAVIOR_CONFIG.pooResidueTTL });
  }

  state.behaviorFrame++;
  if (state.behaviorFrame >= ctx.behaviorDur) {
    state.behavior = 'walk';
    state.behaviorFrame = 0;
  }
  return state;
}

// Adding a new behavior with custom advance logic: add an entry here.
// Behaviors not listed fall back to advanceTimed (increment frame, return to walk when done).
type BehaviorAdvancer = (state: PetState, ctx: PetContext, rand: () => number) => PetState;

const BEHAVIOR_ADVANCERS: Partial<Record<PetBehavior, BehaviorAdvancer>> = {
  walk: advanceWalk,
  perch: advancePerch,
  burp: advanceBurp,
  poo: advancePoo,
};

export function advancePet(state: PetState, ctx: PetContext, rand = Math.random): PetState {
  for (const item of state.pukeItems) item.ttl--;
  state.pukeItems = state.pukeItems.filter((i) => i.ttl > 0);
  for (const item of state.pooItems) item.ttl--;
  state.pooItems = state.pooItems.filter((i) => i.ttl > 0);

  ctx.tailCounter++;
  ctx.blinkTimer--;

  if (ctx.tailCounter >= 3) {
    state.tailPhase = (state.tailPhase + 1) % 4;
    ctx.tailCounter = 0;
  }

  if (ctx.blinkTimer <= 0) {
    state.eyesClosed = ctx.blinkTimer > -2;
    if (ctx.blinkTimer <= -2) {
      ctx.blinkTimer = rndWith(PET_BEHAVIOR_CONFIG.repeatBlinkMin, PET_BEHAVIOR_CONFIG.repeatBlinkMax, rand);
    }
  } else {
    state.eyesClosed = false;
  }

  const advancer = BEHAVIOR_ADVANCERS[state.behavior];
  return advancer ? advancer(state, ctx, rand) : advanceTimed(state, ctx);
}
