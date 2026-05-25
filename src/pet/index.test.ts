import { describe, expect, it } from 'vitest';
import { PET_WIDTH, PET_Y_PERCH, PET_Y_WALK } from '../render/core.js';
import { advancePerch, advancePet, advanceTimed, advanceWalk, type PetContext, type PetState } from './index.js';

function makeState(overrides: Partial<PetState> = {}): PetState {
  return {
    x: 10,
    facingRight: true,
    behavior: 'walk',
    walkFrame: 0,
    behaviorFrame: 0,
    tailPhase: 0,
    isDay: true,
    eyesClosed: false,
    perchY: PET_Y_WALK,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<PetContext> = {}): PetContext {
  return {
    stepCounter: 0,
    tailCounter: 0,
    blinkTimer: 50,
    walkBudget: 100,
    behaviorDur: 0,
    ...overrides,
  };
}

describe('advancePerch', () => {
  it('arc-up decrements perchY by 2 each frame while budget > 0', () => {
    const state = makeState({ behavior: 'perch', perchY: PET_Y_WALK });
    const ctx = makeCtx({ behaviorDur: 10 });
    advancePerch(state, ctx);
    expect(state.perchY).toBe(PET_Y_WALK - 2);
    advancePerch(state, ctx);
    expect(state.perchY).toBe(PET_Y_WALK - 4);
  });

  it('arc-up stops at PET_Y_PERCH exactly (no overshoot)', () => {
    const state = makeState({ behavior: 'perch', perchY: PET_Y_PERCH + 1 });
    const ctx = makeCtx({ behaviorDur: 10 });
    advancePerch(state, ctx);
    expect(state.perchY).toBe(PET_Y_PERCH);
  });

  it('walk phase decrements behaviorDur each frame', () => {
    const state = makeState({ behavior: 'perch', perchY: PET_Y_PERCH });
    const ctx = makeCtx({ behaviorDur: 5 });
    advancePerch(state, ctx);
    expect(ctx.behaviorDur).toBe(4);
    advancePerch(state, ctx);
    expect(ctx.behaviorDur).toBe(3);
  });

  it('arc-down starts only when behaviorDur === 0', () => {
    const state = makeState({ behavior: 'perch', perchY: PET_Y_PERCH });
    const ctx = makeCtx({ behaviorDur: 1 });
    // Last walk step
    advancePerch(state, ctx);
    expect(ctx.behaviorDur).toBe(0);
    expect(state.perchY).toBe(PET_Y_PERCH); // still at perch, not yet arc-down
    // Next frame: arc-down begins
    advancePerch(state, ctx);
    expect(state.perchY).toBe(PET_Y_PERCH + 2);
  });

  it('arc-down does NOT re-trigger arc-up (the 17↔19 oscillation bug)', () => {
    const state = makeState({ behavior: 'perch', perchY: PET_Y_PERCH });
    const ctx = makeCtx({ behaviorDur: 0 });
    // Arc-down step 1: perchY goes from 17 to 19
    advancePerch(state, ctx);
    expect(state.perchY).toBe(PET_Y_PERCH + 2);
    // Arc-down step 2: must continue downward, NOT reset back to 17
    advancePerch(state, ctx);
    expect(state.perchY).toBe(PET_Y_PERCH + 4);
  });

  it('arc-down exits to walk when perchY reaches PET_Y_WALK', () => {
    const state = makeState({ behavior: 'perch', perchY: PET_Y_WALK - 2 });
    const ctx = makeCtx({ behaviorDur: 0 });
    advancePerch(state, ctx, () => 0.5);
    expect(state.behavior).toBe('walk');
  });

  it('perchY is reset to PET_Y_WALK on exit', () => {
    const state = makeState({ behavior: 'perch', perchY: PET_Y_WALK - 2 });
    const ctx = makeCtx({ behaviorDur: 0 });
    advancePerch(state, ctx, () => 0.5);
    expect(state.perchY).toBe(PET_Y_WALK);
  });
});

describe('advanceWalk', () => {
  it('x clamps at 0 and reverses facing when hitting left wall', () => {
    const state = makeState({ x: 1, facingRight: false });
    const ctx = makeCtx({ stepCounter: 1, walkBudget: 100 });
    advanceWalk(state, ctx);
    expect(state.x).toBe(0);
    expect(state.facingRight).toBe(true);
  });

  it('x clamps at 32-PET_WIDTH and reverses facing when hitting right wall', () => {
    const state = makeState({ x: 32 - PET_WIDTH - 1, facingRight: true });
    const ctx = makeCtx({ stepCounter: 1, walkBudget: 100 });
    advanceWalk(state, ctx);
    expect(state.x).toBe(32 - PET_WIDTH);
    expect(state.facingRight).toBe(false);
  });

  it('walkBudget depletion triggers a behavior roll', () => {
    const state = makeState({ behavior: 'walk', isDay: true });
    // stepCounter starts at 1 so the step fires on the first call
    const ctx = makeCtx({ stepCounter: 1, walkBudget: 1 });
    // roll = 0.10 → sit (< 0.15)
    advanceWalk(state, ctx, () => 0.1);
    expect(state.behavior).toBe('sit');
  });

  it('rolled behavior is set with correct initial dur', () => {
    const state = makeState({ behavior: 'walk', isDay: true });
    const ctx = makeCtx({ stepCounter: 1, walkBudget: 1 });
    // rand always 0.10: roll < 0.15 → sit, dur = rndWith(30, 80, rand)
    // rndWith(30, 80, () => 0.10) = floor(0.10 * 51) + 30 = 5 + 30 = 35
    advanceWalk(state, ctx, () => 0.1);
    expect(ctx.behaviorDur).toBe(35);
  });
});

describe('general (tail and blink)', () => {
  it('tail phase advances every 3 frames', () => {
    const state = makeState({ tailPhase: 0 });
    const ctx = makeCtx({ tailCounter: 0 });
    advancePet(state, ctx); // tailCounter → 1
    expect(state.tailPhase).toBe(0);
    advancePet(state, ctx); // tailCounter → 2
    expect(state.tailPhase).toBe(0);
    advancePet(state, ctx); // tailCounter → 3 → resets to 0, phase increments
    expect(state.tailPhase).toBe(1);
  });

  it('eyesClosed is true for 2 frames after blinkTimer reaches 0', () => {
    const state = makeState({ eyesClosed: false });
    const ctx = makeCtx({ blinkTimer: 1, walkBudget: 100 });
    advancePet(state, ctx); // blinkTimer → 0: eyesClosed = (0 > -2) = true
    expect(state.eyesClosed).toBe(true);
    advancePet(state, ctx); // blinkTimer → -1: eyesClosed = (-1 > -2) = true
    expect(state.eyesClosed).toBe(true);
  });

  it('eyesClosed becomes false after 2 closed frames and timer resets', () => {
    const state = makeState({ eyesClosed: false });
    const ctx = makeCtx({ blinkTimer: 1, walkBudget: 100 });
    advancePet(state, ctx); // timer 0: closed
    advancePet(state, ctx); // timer -1: closed
    advancePet(state, ctx); // timer -2: eyesClosed = (-2 > -2) = false, timer resets
    expect(state.eyesClosed).toBe(false);
    expect(ctx.blinkTimer).toBeGreaterThan(0);
  });

  it('eyesClosed is false outside blink window', () => {
    const state = makeState({ eyesClosed: false });
    const ctx = makeCtx({ blinkTimer: 10, walkBudget: 100 });
    advancePet(state, ctx);
    expect(state.eyesClosed).toBe(false);
  });
});

describe('advanceTimed', () => {
  it('increments behaviorFrame each call', () => {
    const state = makeState({ behavior: 'sit', behaviorFrame: 0 });
    const ctx = makeCtx({ behaviorDur: 10 });
    advanceTimed(state, ctx);
    expect(state.behaviorFrame).toBe(1);
  });

  it('returns to walk when behaviorFrame reaches behaviorDur', () => {
    const state = makeState({ behavior: 'sit', behaviorFrame: 9 });
    const ctx = makeCtx({ behaviorDur: 10 });
    advanceTimed(state, ctx);
    expect(state.behavior).toBe('walk');
    expect(state.behaviorFrame).toBe(0);
  });
});
