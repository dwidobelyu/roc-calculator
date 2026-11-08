import { Attr } from '../../../models/attr';
import { DamageModifiers, globalMultiplier } from '../damage-modifiers';
import { DamageFormula, FormulaContext, SkillInput, StateInput, magicCore, magicTotal, physicalCore } from '../formula';
import { SpecialFormula, ca, magicMod, stalkerSwap, ta, wmod } from './common';

type Kind = 'physical' | 'magic';

const hpMax = (ctx: FormulaContext) => ta(ctx, Attr.MAX_HP_FINAL);
const pvpdam = (ctx: FormulaContext, kind: Kind) => globalMultiplier(ctx.attacker, ctx.target, kind);

// These scripts have no TempAddDam term, so the fight-temp extra damage is removed from the shared cores.
const physPart = (m: DamageModifiers, s: SkillInput, F: number) =>
  physicalCore({ ...m, tempAddPhys: 0 }, s) * F + m.additionalAtk;
const magPart = (m: DamageModifiers, s: SkillInput, F: number) =>
  magicCore({ ...m, tempAddMagic: 0 }, s) * F + m.additionalMatk;

/** Target jobs whose HP% part is halved when the caster is an MVP (DC:3053, DC:3087). */
const MVP_HALF_JOBS = [2201, 2202, 2203, 3101, 3102, 3103, 7201, 7202, 7203, 7211, 7212, 7213];
const MVP_STATE: StateInput = {
  key: 'mvp', label: 'Caster is an MVP', kind: 'toggle', default: 0,
  note: 'Halves the max-HP part against target job ids 2201-2203, 3101-3103, 7201-7203 and 7211-7213.',
};
const mvpHalf = (ctx: FormulaContext) => (ctx.state['mvp'] && MVP_HALF_JOBS.includes(ctx.target.job) ? 0.5 : 1);

/**
 * attrdamup of the *New scripts (DC:2795-2841): 0.15 per started 2000 points of final DMG% up minus the target's
 * DMG% down, capped at 1.5; a zero difference still gives +0.15. Floored at x0.5.
 */
function attrDamUp(ctx: FormulaContext, kind: Kind): number {
  const [up, down] = kind === 'magic' ? [Attr.MDAM_INCREASE_FINAL, Attr.MDAM_REDUC_FINAL] : [Attr.DAM_INCREASE_FINAL, Attr.DAM_REDUC_FINAL];
  const d = ca(ctx, up) - ta(ctx, down);
  const step = 0.15 * (Math.min(Math.floor(Math.abs(d) / 2000), 9) + 1);
  return Math.max(1 + (d < 0 ? -step : step), 0.5);
}

/**
 * *MixPerSkillCalc*: the usual physical or magic damage x PvE/PvP chain, then + flat / 10000 x target max HP outside
 * the chain and the float. The table flat is spent on the HP part, so there is no `flat x F` term.
 */
const hpMix = (script: string, label: string, kind: Kind, hpFactor: (ctx: FormulaContext) => number = () => 1,
  state?: readonly StateInput[]) =>
  new SpecialFormula({
    script, label, kind, flee: 'none', global: false, state,
    raw: (m, s, F, ctx) => (kind === 'magic' ? magPart(m, s, F) : physPart(m, s, F)) * pvpdam(ctx, kind) +
      (s.skillNum / 10000) * hpMax(ctx) * hpFactor(ctx),
  });

/** MixSkillCalc / MixPerSkillCalc core: physical ATK against a blend of DEF% and MDEF%, magic PvE/PvP chain. */
const mixCore = (m: DamageModifiers, s: SkillInput) =>
  Math.max((2 * m.atk + m.weaponAtk * wmod(m)) * ((1 + 3 * m.def) / 4) * ((3 + m.mdef) / 4) * s.skillPer * m.npc - m.defFlat, 0);

/** Element % terms without the element table (HPDam of MixPerSkillCalc, DC:2740). */
const bonusMod = (m: DamageModifiers) =>
  Math.max(1 + m.race, 0.1) * Math.max(1 + m.sizeInc, 0.1) * Math.max(m.elementBonus, 0.1);

const toggle = (key: string, label: string, note: string): StateInput => ({ key, label, kind: 'toggle', default: 0, note });

/** Monster-only DamageCalculator scripts (used by monster skills as attackers). */
export const MONSTER_FORMULAS: readonly DamageFormula[] = [
  /** DC:2758 */
  hpMix('PhyMixPerSkillCalc', 'Physical + target max HP %', 'physical'),
  /** DC:2860 */
  hpMix('MagMixPerSkillCalc', 'Magic + target max HP %', 'magic'),
  /** DC:2785 */
  hpMix('PhyMixPerSkillCalcNew', 'Physical + target max HP % (DMG% scaled)', 'physical', (ctx) => attrDamUp(ctx, 'physical')),
  /** DC:2887 */
  hpMix('MagMixPerSkillCalcNew', 'Magic + target max HP % (MDMG% scaled)', 'magic', (ctx) => attrDamUp(ctx, 'magic')),
  /** DC:3074 */
  hpMix('PhyMixPerSkillCalcMVP', 'Physical + target max HP % (MVP)', 'physical', mvpHalf, [MVP_STATE]),
  /** DC:3040 */
  hpMix('MagMixPerSkillCalcMVP', 'Magic + target max HP % (MVP)', 'magic', mvpHalf, [MVP_STATE]),
  /** DC:2706 */
  new SpecialFormula({
    script: 'MixSkillCalc', label: 'Physical vs DEF and MDEF', kind: 'physical', flee: 'none', global: false,
    raw: (m, s, F, ctx) => (mixCore(m, s) * F + s.skillNum * F + m.additionalAtk) * pvpdam(ctx, 'magic'),
  }),
  /** DC:2731 */
  new SpecialFormula({
    script: 'MixPerSkillCalc', label: 'Physical vs DEF and MDEF + target max HP %', kind: 'physical', flee: 'none', global: false,
    raw: (m, s, F, ctx) =>
      (mixCore(m, s) * F + (s.skillNum / 10000) * hpMax(ctx) * bonusMod(m) * F + m.additionalAtk) * pvpdam(ctx, 'magic'),
  }),
  /** DC:2198 Target max HP x max(1, ratio) split over the targets hit; no float, DEF or PvE/PvP chain. */
  new SpecialFormula({
    script: 'PhysicalShareReal', label: 'Shared max HP damage', kind: 'physical', flee: 'none', global: false,
    state: [{ key: 'targets', label: 'Targets hit', kind: 'number', min: 1, max: 20, default: 1, note: 'Damage is split evenly between them.' }],
    raw: (m, s, F, ctx) => (hpMax(ctx) * Math.max(1, s.skillPer)) / Math.max(ctx.state['targets'] ?? 1, 1),
  }),
  /** DC:8397 Target max HP x ratio x element table. */
  new SpecialFormula({
    script: 'MonsterBoom', label: 'Max HP explosion', kind: 'physical', flee: 'none', global: false,
    raw: (m, s, F, ctx) => hpMax(ctx) * s.skillPer * m.element,
  }),
  /** DC:8431 MonsterBoom that deals 0 to a target with buff 59502. */
  new SpecialFormula({
    script: 'YueYeMaoBoom', label: 'Max HP explosion', kind: 'physical', flee: 'none', global: false,
    state: [toggle('buff59502', 'Target has buff 59502', 'The explosion deals no damage while it is active.')],
    raw: (m, s, F, ctx) => (ctx.state['buff59502'] ? 0 : hpMax(ctx) * s.skillPer * m.element),
  }),
  /** DC:8118 Fire Ball: the MATK part x0.75 beyond 1.5 m from the centre; no additional magic damage. */
  new SpecialFormula({
    script: 'FireBall', label: 'Fire Ball', kind: 'magic', flee: 'none',
    state: [toggle('far', 'Target farther than 1.5 m', 'Outer ring of the blast: the MATK part deals 75%.')],
    // skipped: damage_suppress_ratio_ (server value)
    raw: (m, s, F, ctx) => magicCore({ ...m, tempAddMagic: 0 }, s) * F * (ctx.state['far'] ? 0.75 : 1) + s.skillNum * F,
  }),
  /** DC:8284 Summoned-monster fire: (MATK + flat) x modifiers x ratio x target class; no MDEF at all. */
  new SpecialFormula({
    script: 'HuoZhuGongJi', label: 'Summon fire attack', kind: 'magic', flee: 'none',
    // skipped: owner buff 67615 rate and EQUIP_WZHY fight temp (owner gear); the caster must have an owner in the game
    raw: (m, s, F) =>
      Math.max((m.matk + m.weaponMatk + s.skillNum) * magicMod(m) * s.skillPer * m.npcMagic, 0) * F + m.additionalMatk,
  }),
  /** DC:8328 Storm Gust: generic magic; 0 against a target in buff state 301. */
  new SpecialFormula({
    script: 'Blizzard', label: 'Storm Gust', kind: 'magic', flee: 'none',
    state: [toggle('state301', 'Target in buff state 301', 'Storm Gust deals no damage to it.')],
    // skipped: caster buff 67616 rate, player-only target-count bonus (effect ids 410115xx), suppress ratio
    raw: (m, s, F, ctx) => (ctx.state['state301'] ? 0 : magicTotal(stalkerSwap(m, ctx), s, F)),
  }),
  /** DC:12771 */
  new SpecialFormula({
    script: 'BingBaoQiShiXuanWoCalc', label: 'Stormy Vortex', kind: 'magic', flee: 'none',
    // shortcut: the Lua computes generic magic but never calls SetResult, upgrade if the native default result is known
    raw: (m, s, F) => magicTotal(m, s, F),
  }),
  /** DC:9288 Brandish Spear (mounted monster): fixed ratio by distance, ignores the table ratio; floor, no 0 clamp. */
  new SpecialFormula({
    script: 'MonsterQiChengGongJi', label: 'Brandish Spear', kind: 'physical', flee: 'skill',
    state: [{ key: 'distance', label: 'Distance to target (m)', kind: 'number', min: 0, max: 20, default: 0,
      note: 'Up to 2 m: x4.6, up to 3 m: x4.0, up to 4 m: x3.3, beyond: x2.6.' }],
    raw: (m, s, F, ctx) => {
      const d = ctx.state['distance'] ?? 0;
      const r = d <= 2 ? 46000 : d <= 3 ? 40000 : d <= 4 ? 33000 : 26000;
      return Math.floor((2 * m.atk + m.weaponAtk * wmod(m)) * m.def * r / 10000 * m.npc - m.defFlat) * F + s.skillNum * F + m.additionalAtk;
    },
  }),
];
