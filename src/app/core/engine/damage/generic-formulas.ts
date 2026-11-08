import { DamageModifiers } from './damage-modifiers';
import { DamageFormula, SkillInput, magicTotal, physicalTotal } from './formula';

/** CommonSkillCritCalc (DC:1709-1799): normal attack, can crit. */
class NormalAttackFormula implements DamageFormula {
  readonly script = 'CommonSkillCritCalc';
  readonly label = 'Normal attack';
  readonly damageKind = 'normal';
  readonly canCrit = true;
  readonly fleeRoll = 'normal';
  readonly usesGlobalMultiplier = true;
  raw(m: DamageModifiers, s: SkillInput, F: number): number {
    // normal attacks add their own TempAddDam set (DC:1720-1726)
    return physicalTotal({ ...m, tempAddPhys: m.tempAddNormal }, s, F);
  }
}

/** PhysicalSkillCalc generic branch (DC:1974-1977): never crits. */
class PhysicalSkillFormula implements DamageFormula {
  readonly script: string = 'PhysicalSkillCalc';
  readonly label: string = 'Physical skill';
  readonly damageKind = 'physical';
  readonly canCrit: boolean = false;
  readonly fleeRoll = 'skill';
  readonly usesGlobalMultiplier: boolean = true;
  raw(m: DamageModifiers, s: SkillInput, F: number): number {
    return physicalTotal(m, s, F);
  }
}

/** PhysicalSkillCalcCanCri (DC:2072-2196): physical skill that can crit (no suppress factor). */
class PhysicalCritSkillFormula extends PhysicalSkillFormula {
  override readonly script = 'PhysicalSkillCalcCanCri';
  override readonly label = 'Physical skill (can crit)';
  override readonly canCrit = true;
}

/** PhysicalSkillCalcReal (DC:2246-2271): ignores DEF and the global multiplier. */
class PhysicalTrueSkillFormula extends PhysicalSkillFormula {
  override readonly script = 'PhysicalSkillCalcReal';
  override readonly label = 'Physical skill (true damage)';
  override readonly usesGlobalMultiplier = false;
  override raw(m: DamageModifiers, s: SkillInput, F: number): number {
    return physicalTotal(m, s, F, false);
  }
}

/** MagicSkillCalc (DC:2273-2461): no weapon-size table, no crit, no flee roll. */
class MagicSkillFormula implements DamageFormula {
  readonly script = 'MagicSkillCalc';
  readonly label = 'Magic skill';
  readonly damageKind = 'magic';
  readonly canCrit = false;
  readonly fleeRoll = 'none';
  readonly usesGlobalMultiplier = true;
  raw(m: DamageModifiers, s: SkillInput, F: number): number {
    return magicTotal(m, s, F);
  }
}

export const GENERIC_FORMULAS: readonly DamageFormula[] = [
  new NormalAttackFormula(),
  new PhysicalSkillFormula(),
  new PhysicalCritSkillFormula(),
  new PhysicalTrueSkillFormula(),
  new MagicSkillFormula(),
];
