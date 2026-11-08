import { Combatant } from '../../models/combat.models';
import { SkillEntry, SkillLevel } from '../../models/master-data.models';
import { DamageModifiers } from './damage-modifiers';

/** Per-segment skill inputs from SkillEffectTable (ratio as a multiplier, flat damage). */
export interface SkillInput {
  skillPer: number;
  skillNum: number;
}

/**
 * A combat-state value a script reads (an active buff, a stack or resource count, current SP). The formula declares
 * it; the attack panel shows an input for it; the value reaches the script as ctx.state[key].
 */
export interface StateInput {
  key: string;
  label: string;
  /** toggle: 0 or 1; number: a count or percent between min and max. */
  kind: 'toggle' | 'number';
  min?: number;
  max?: number;
  /** Value when the user has not set it (0 if omitted). */
  default?: number;
  /** Short help text, e.g. which buff id the game checks. */
  note?: string;
}

/** Everything a skill-specific script may read besides the shared modifiers. */
export interface FormulaContext {
  attacker: Combatant;
  target: Combatant;
  skill: SkillEntry;
  level: SkillLevel;
  /** Index into the per-segment arrays (ratio, flat, hits). */
  segment: number;
  hits: number;
  pvp: boolean;
  /** SkillEffectTable PVE/PVPConfigData params for this level (raw values, e.g. cripara 5000 = 0.5). */
  config: Readonly<Record<string, number>>;
  /** Combat-state values for the formula's stateInputs (defaults filled in). */
  state: Readonly<Record<string, number>>;
}

/**
 * One DamageCalculator.<DamageScript> function. Add a class implementing this and register it (generic formulas in
 * generic-formulas.ts, skill-specific ones in special/index.ts) to support another script.
 */
export interface DamageFormula {
  readonly script: string;
  readonly label: string;
  readonly damageKind: 'normal' | 'physical' | 'magic';
  readonly canCrit: boolean;
  /** Which flee roll applies; magic skills skip it. */
  readonly fleeRoll: 'normal' | 'skill' | 'none';
  /** False for true-damage formulas that ignore the PvP/global chain. */
  readonly usesGlobalMultiplier: boolean;
  /** Damage before the global multiplier, for one float value F. */
  raw(m: DamageModifiers, s: SkillInput, F: number, ctx: FormulaContext): number;
  /** Optional hit count override when the script decides it (e.g. Pierce hits by target size). */
  hitCount?(ctx: FormulaContext): number;
  /** Optional crit chance override (0..1); defaults to the CRIT - CRIT RES roll with cripro/cripara. */
  critChance?(ctx: FormulaContext): number;
  /** Optional crit damage multiplier override; defaults to m.critMultiplier (1.5 x (1 + crit dmg - crit def)). */
  critMultiplier?(m: DamageModifiers, ctx: FormulaContext): number;
  /** Combat-state inputs this script reads (buffs, stacks, resources). */
  readonly stateInputs?: readonly StateInput[];
}

/** Size, element, race and element-damage multipliers that scale the weapon part of physical damage. */
export const weaponModifier = (m: DamageModifiers): number =>
  m.size * m.element * Math.max(1 + m.race, 0.1) * Math.max(1 + m.sizeInc, 0.1) * Math.max(m.elementBonus, 0.1);

/** Physical core (DC:1728): status ATK x2 is unmodified, the weapon part takes the modifiers; then DEF. */
export const physicalCore = (m: DamageModifiers, s: SkillInput, withDef = true): number => {
  const base = (2 * m.atk + m.weaponAtk * weaponModifier(m)) * s.skillPer + (m.tempAddPhys ?? 0);
  return withDef ? Math.max(base * m.def * m.npc - m.defFlat, 0) : Math.max(base * m.npc, 0);
};

/** Magic core (DC:2431): all of MATK takes race/size/element modifiers (no weapon-size table); then MDEF. */
export const magicCore = (m: DamageModifiers, s: SkillInput, withDef = true): number => {
  const mw = m.matk + m.weaponMatk;
  const core = mw * Math.max(1 + m.race, 0.1) * Math.max(1 + m.sizeInc, 0.1) * Math.max(m.elementBonus, 0.1) *
    m.element * s.skillPer + (m.tempAddMagic ?? 0);
  return withDef ? Math.max(core * m.mdef * m.npcMagic - m.mdefFlat, 0) : Math.max(core * m.npcMagic, 0);
};

/** Shared tail of the generic paths: core x float + flat x float + additional flat damage. */
export const physicalTotal = (m: DamageModifiers, s: SkillInput, F: number, withDef = true): number =>
  physicalCore(m, s, withDef) * F + s.skillNum * F + m.additionalAtk;

export const magicTotal = (m: DamageModifiers, s: SkillInput, F: number, withDef = true): number =>
  magicCore(m, s, withDef) * F + s.skillNum * F + m.additionalMatk;
