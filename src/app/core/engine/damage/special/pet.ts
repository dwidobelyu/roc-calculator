import { DamageModifiers } from '../damage-modifiers';
import { DamageFormula, SkillInput } from '../formula';
import { SpecialFormula } from './common';

/**
 * DamageCalculator.petdamage (DC:13827): pet damage has no weapon part and no soft-DEF subtraction:
 * 2 x (max(stat x size x element x race x size% x element% x ratio x DEF x npc, 0) x F + flat x F + additional).
 */
const petDamage = (stat: number, defMul: number, npc: number, m: DamageModifiers, s: SkillInput, F: number) =>
  2 * (Math.max(stat * m.size * m.element * Math.max(1 + m.race, 0.1) * Math.max(1 + m.sizeInc, 0.1) *
    Math.max(m.elementBonus, 0.1) * s.skillPer * defMul * npc, 0) * F + s.skillNum * F + m.additionalAtk);

export const PET_FORMULAS: readonly DamageFormula[] = [
  /** DC:13857 PetCommonPhyCrit: pet ATK (BASE_ATK_FINAL), normal-attack crit and flee rolls. */
  new SpecialFormula({
    script: 'PetCommonPhyCrit', label: 'Pet physical attack', kind: 'normal', flee: 'normal', canCrit: true,
    raw: (m, s, F) => petDamage(m.atk, m.def, m.npc, m, s, F),
  }),
  /** DC:13886 PetCommonMagCrit: pet MATK vs MDEF; skipped: skill effect 100108001 special branch. */
  new SpecialFormula({
    script: 'PetCommonMagCrit', label: 'Pet magic attack', kind: 'magic', flee: 'normal', canCrit: true,
    raw: (m, s, F) => petDamage(m.matk, m.mdef, m.npcMagic, m, s, F),
  }),
];
