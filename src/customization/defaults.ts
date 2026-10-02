import { PET_BEHAVIOR_CONFIG } from '../pet/config.js';
import { PET_DAY, PET_NIGHT } from '../render/pet/colors.js';
import { RAW_SPRITES } from '../sprites.js';
import type { Customization, Swatch } from './schema.js';
import { CURRENT_SCHEMA_VERSION } from './schema.js';

const RESERVED_ROLES = ['o', 'g', 's', 'l', 'r'] as const;

const palette: Swatch[] = RESERVED_ROLES.map((key) => ({
  key,
  day: PET_DAY[key] as NonNullable<(typeof PET_DAY)[typeof key]>,
  night: PET_NIGHT[key],
}));

export const DEFAULT_CUSTOMIZATION: Customization = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  palette,
  sprites: { ...RAW_SPRITES },
  behavior: PET_BEHAVIOR_CONFIG,
};
