import { DamageFormula } from './formula';
import { GENERIC_FORMULAS } from './generic-formulas';
import { SPECIAL_FORMULAS } from './special';

export type { DamageFormula, FormulaContext, SkillInput, StateInput } from './formula';

const BY_SCRIPT = new Map([...GENERIC_FORMULAS, ...SPECIAL_FORMULAS].map((f) => [f.script, f]));

export interface ResolvedFormula {
  formula: DamageFormula | null;
  approximated: boolean;
}

/**
 * Picks the formula for a SkillEffectTable.DamageScript. Scripts without a port fall back to the generic
 * formula of the skill's damage type (1 physical, 2 magic). "DamageNil" and healing scripts deal no damage.
 */
export function resolveFormula(script: string, damageType: number): ResolvedFormula {
  const exact = BY_SCRIPT.get(script);
  if (exact) return { formula: exact, approximated: false };
  if (!script || script === 'DamageNil' || script.startsWith('Cure')) return { formula: null, approximated: false };
  if (damageType === 2) return { formula: BY_SCRIPT.get('MagicSkillCalc')!, approximated: true };
  if (damageType === 1) return { formula: BY_SCRIPT.get('PhysicalSkillCalc')!, approximated: true };
  if (damageType === 0) return { formula: BY_SCRIPT.get('CommonSkillCritCalc')!, approximated: true };
  return { formula: null, approximated: false };
}

/** Scripts with an exact port, for coverage reporting. */
export function portedScripts(): string[] {
  return [...BY_SCRIPT.keys()];
}
