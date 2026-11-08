import { DamageFormula } from '../formula';
import { MAGIC_FORMULAS } from './magic';
import { NORMAL_FORMULAS } from './normal';
import { PHYSICAL_FORMULAS } from './physical';
import { PHYSICAL_CRIT_FORMULAS } from './physical-crit';
import { MONSTER_FORMULAS } from './monster';
import { PET_FORMULAS } from './pet';

/**
 * Skill-specific DamageCalculator scripts ported from damage_calculator.lua, grouped by damage family.
 * Register each new formula here; resolveFormula picks them before the generic fallback.
 */
export const SPECIAL_FORMULAS: readonly DamageFormula[] = [
  ...PHYSICAL_FORMULAS,
  ...PHYSICAL_CRIT_FORMULAS,
  ...MAGIC_FORMULAS,
  ...NORMAL_FORMULAS,
  ...PET_FORMULAS,
  ...MONSTER_FORMULAS,
];
