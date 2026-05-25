import { PET_Y_WALK, PET_Y_PERCH, PET_WIDTH } from "../render/core.js";
import type { PetState, PetBehavior } from "../render/core.js";

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
    blinkTimer: rndWith(20, 40, rand),
    walkBudget: rndWith(15, 40, rand),
    behaviorDur: 0,
  };
}

function rollBehavior(state: PetState, ctx: PetContext, rand: () => number): void {
  const roll = rand();
  let next: PetBehavior = "walk";

  if (!state.isDay) {
    if      (roll < 0.55) { next = "dream"; ctx.behaviorDur = rndWith(80, 160, rand); }
    else if (roll < 0.75) { next = "lie";   ctx.behaviorDur = rndWith(50, 100, rand); }
    else if (roll < 0.90) { next = "sit";   ctx.behaviorDur = rndWith(20, 50, rand);  }
    ctx.walkBudget = rndWith(3, 10, rand);
  } else {
    if      (roll < 0.15) { next = "sit";   ctx.behaviorDur = rndWith(30, 80, rand);  }
    else if (roll < 0.25) { next = "lie";   ctx.behaviorDur = rndWith(50, 120, rand); }
    else if (roll < 0.35) { next = "jump";  ctx.behaviorDur = 8;                      }
    else if (roll < 0.85) { next = "perch"; ctx.behaviorDur = rndWith(8, 16, rand);   }
    ctx.walkBudget = rndWith(15, 40, rand);
  }

  if (next !== "walk") {
    state.behavior = next;
    state.behaviorFrame = 0;
  }
}

export function advanceWalk(state: PetState, ctx: PetContext, rand = Math.random): PetState {
  ctx.stepCounter++;

  if (ctx.stepCounter < 2) return state;
  ctx.stepCounter = 0;

  if (!state.isDay) {
    if (state.x < 25) state.facingRight = true;
    else               state.facingRight = false;
  }

  state.x += state.facingRight ? 1 : -1;
  if (state.x >= 32 - PET_WIDTH) { state.x = 32 - PET_WIDTH; state.facingRight = false; }
  if (state.x <= 0)               { state.x = 0;               state.facingRight = true;  }

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
    if (state.x > 22) { state.x = 22; state.facingRight = false; }
    if (state.x < 4)  { state.x = 4;  state.facingRight = true;  }
    if (ctx.behaviorDur % 2 === 0) state.walkFrame = (state.walkFrame + 1) % 2;
    ctx.behaviorDur--;
  } else {
    // arc down
    state.perchY = Math.min(PET_Y_WALK, state.perchY + 2);
    if (state.perchY >= PET_Y_WALK) {
      state.perchY = PET_Y_WALK;
      state.behavior = "walk";
      state.behaviorFrame = 0;
      ctx.walkBudget = rndWith(15, 40, rand);
    }
  }

  return state;
}

export function advanceTimed(state: PetState, ctx: PetContext): PetState {
  state.behaviorFrame++;
  if (state.behaviorFrame >= ctx.behaviorDur) {
    state.behavior = "walk";
    state.behaviorFrame = 0;
  }
  return state;
}

export function advancePet(state: PetState, ctx: PetContext, rand = Math.random): PetState {
  ctx.tailCounter++;
  ctx.blinkTimer--;

  if (ctx.tailCounter >= 3) {
    state.tailPhase = (state.tailPhase + 1) % 4;
    ctx.tailCounter = 0;
  }

  if (ctx.blinkTimer <= 0) {
    state.eyesClosed = ctx.blinkTimer > -2;
    if (ctx.blinkTimer <= -2) ctx.blinkTimer = rndWith(25, 50, rand);
  } else {
    state.eyesClosed = false;
  }

  switch (state.behavior) {
    case "walk":  return advanceWalk(state, ctx, rand);
    case "perch": return advancePerch(state, ctx, rand);
    default:      return advanceTimed(state, ctx);
  }
}
