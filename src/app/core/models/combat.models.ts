import { AttrSheet } from '../engine/attr-sheet';
import { SkillEntry, SkillLevel } from './master-data.models';

/** A unit with final attributes, ready for the damage engine. */
export interface Combatant {
  kind: 'player' | 'monster';
  name: string;
  attrs: AttrSheet;
  level: number;
  job: number;
  race: number;
  size: number;
  /** Defense (body) element id 0..9. */
  element: number;
  weaponType: number;
  /** Element of normal attacks and of physical skills without a fixed element. */
  weaponElement: number;
  isBoss: boolean;
  /** Loaded arrow: its element replaces the weapon element for arrow-consuming skills [inferred]. */
  ammo?: { element: number; skillIds: ReadonlySet<number> };
  /** Fight-temp attributes by key (EQUIP_*_SNAPSHOT etc.) from gear, cards and buffs; read by damage formulas. */
  fightTemp?: Readonly<Record<string, number>>;
}

export interface DamageRequest {
  attacker: Combatant;
  target: Combatant;
  skill: SkillEntry;
  level: SkillLevel;
  /** Damage part of a multi-part skill (index into the per-part arrays), or 'all' to add every part together. */
  segment: number | 'all';
  /** Number of units attacking the target (each one past 2 cuts target FLEE by 30%). */
  attackerCount: number;
  /** Combat-state values keyed by the formula's StateInput.key (active buffs, stacks, current SP). */
  state?: Readonly<Record<string, number>>;
}

export interface BreakdownLine {
  label: string;
  value: number;
  /** How the value was obtained: read from game data/code, or inferred where the game computes it natively. */
  source: 'game' | 'inferred';
}

export interface DamageRange {
  min: number;
  max: number;
}

export interface DamageResult {
  formulaName: string;
  /** True when the skill's own script was replaced by the generic formula of its damage type. */
  approximated: boolean;
  hits: number;
  normal: DamageRange;
  critical: DamageRange | null;
  /** Probabilities 0..1 */
  perfectHitChance: number;
  hitChance: number;
  critChance: number;
  breakdown: BreakdownLine[];
  notes: string[];
}
