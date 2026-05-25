import type { SpriteKey } from '../../sprites.js';
import type { Color } from '../types.js';

export type Pixel = [x: number, y: number, colorKey: string];
export type PetColor = Record<string, Color>;
export type RawPetSprites = Record<SpriteKey, string[]>;

export type PetBehavior = 'walk' | 'sit' | 'lie' | 'jump' | 'perch' | 'dream' | 'burp' | 'poo';

export interface SceneItem {
  x: number;
  y: number;
  ttl: number;
}

export interface PetState {
  x: number;
  facingRight: boolean;
  behavior: PetBehavior;
  walkFrame: number;
  behaviorFrame: number;
  tailPhase: number;
  isDay: boolean;
  eyesClosed: boolean;
  perchY: number;
  pukeItems: SceneItem[];
  pooItems: SceneItem[];
}

export interface JumpFrame {
  pix: Pixel[];
  yOff: number;
}

export interface ParsedSprites {
  WALK: [Pixel[], Pixel[]];
  WALK_BLINK: [Pixel[], Pixel[]];
  SIT: [Pixel[], Pixel[]];
  LIE: [Pixel[], Pixel[]];
  JUMP: JumpFrame[];
  DREAM: Pixel[];
  BURP: [Pixel[], Pixel[]];
  POO: [Pixel[], Pixel[]];
}

export interface BehaviorDrawResult {
  pixels: Pixel[];
  baseY: number;
  drawTail: boolean;
}
