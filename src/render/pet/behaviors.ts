import { PET_WIDTH, PET_Y_WALK } from './sprites.js';
import type { BehaviorDrawResult, ParsedSprites, PetState, Pixel } from './types.js';

const TAIL_Y = [1, 2, 1, 2] as const;

function resolveBlinkingWalkPixels(state: PetState, sprites: ParsedSprites): Pixel[] {
  const frames = state.eyesClosed ? sprites.WALK_BLINK : sprites.WALK;
  return frames[state.walkFrame % 2]!;
}

function resolveAnimatedPose(frames: [Pixel[], Pixel[]], behaviorFrame: number, cadence: number): Pixel[] {
  return frames[Math.floor(behaviorFrame / cadence) % 2]!;
}

export function resolveTailOffset(state: PetState): number {
  return TAIL_Y[state.tailPhase]!;
}

export function resolvePetBehaviorDraw(state: PetState, sprites: ParsedSprites): BehaviorDrawResult {
  switch (state.behavior) {
    case 'walk':
      return {
        pixels: resolveBlinkingWalkPixels(state, sprites),
        baseY: PET_Y_WALK,
        drawTail: true,
      };
    case 'sit':
      return {
        pixels: resolveAnimatedPose(sprites.SIT, state.behaviorFrame, 20),
        baseY: PET_Y_WALK,
        drawTail: false,
      };
    case 'lie':
      return {
        pixels: resolveAnimatedPose(sprites.LIE, state.behaviorFrame, 30),
        baseY: PET_Y_WALK + 1,
        drawTail: true,
      };
    case 'jump': {
      const jumpIndex = Math.min(Math.floor(state.behaviorFrame / 2), sprites.JUMP.length - 1);
      const jumpFrame = sprites.JUMP[jumpIndex]!;
      return {
        pixels: jumpFrame.pix,
        baseY: PET_Y_WALK + jumpFrame.yOff,
        drawTail: true,
      };
    }
    case 'perch':
      return {
        pixels: resolveBlinkingWalkPixels(state, sprites),
        baseY: state.perchY,
        drawTail: true,
      };
    case 'dream':
      return {
        pixels: sprites.DREAM,
        baseY: PET_Y_WALK,
        drawTail: false,
      };
    case 'burp':
      return {
        pixels: resolveAnimatedPose(sprites.BURP, state.behaviorFrame, 4),
        baseY: PET_Y_WALK,
        drawTail: false,
      };
    case 'poo':
      return {
        pixels: resolveAnimatedPose(sprites.POO, state.behaviorFrame, 4),
        baseY: PET_Y_WALK,
        drawTail: false,
      };
  }
}

export function resolveTailX(state: PetState): number {
  return state.facingRight ? state.x : state.x + PET_WIDTH - 1;
}
