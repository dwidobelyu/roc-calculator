import { Attr, pct } from '../../../models/attr';
import { DamageModifiers } from '../damage-modifiers';
import { DamageFormula, FormulaContext, SkillInput, StateInput } from '../formula';

type Raw = DamageFormula['raw'];

/** One ported DamageCalculator.<script>; `raw` holds the script-specific arithmetic. */
export class SpecialFormula implements DamageFormula {
  readonly script: string;
  readonly label: string;
  readonly damageKind: DamageFormula['damageKind'];
  readonly canCrit: boolean;
  readonly fleeRoll: DamageFormula['fleeRoll'];
  readonly usesGlobalMultiplier: boolean;
  readonly raw: Raw;
  readonly critChance?: (ctx: FormulaContext) => number;
  readonly hitCount?: (ctx: FormulaContext) => number;
  readonly stateInputs?: readonly StateInput[];
  readonly critMultiplier?: (m: DamageModifiers, ctx: FormulaContext) => number;

  constructor(d: {
    script: string;
    label: string;
    kind: DamageFormula['damageKind'];
    flee: DamageFormula['fleeRoll'];
    raw: Raw;
    canCrit?: boolean;
    global?: boolean;
    critChance?: (ctx: FormulaContext) => number;
    hitCount?: (ctx: FormulaContext) => number;
    state?: readonly StateInput[];
    critMultiplier?: (m: DamageModifiers, ctx: FormulaContext) => number;
  }) {
    this.script = d.script;
    this.label = d.label;
    this.damageKind = d.kind;
    this.fleeRoll = d.flee;
    this.raw = d.raw;
    this.canCrit = d.canCrit ?? false;
    this.usesGlobalMultiplier = d.global ?? true;
    if (d.critChance) this.critChance = d.critChance;
    if (d.hitCount) this.hitCount = d.hitCount;
    if (d.state) this.stateInputs = d.state;
    if (d.critMultiplier) this.critMultiplier = d.critMultiplier;
  }
}

export const ca = (ctx: FormulaContext, id: number) => ctx.attacker.attrs.get(id);
export const ta = (ctx: FormulaContext, id: number) => ctx.target.attrs.get(id);

/** SkillTable effect id as the Lua sees it (args.skill_:SkillEffectID()). */
export const effectId = (ctx: FormulaContext) => ctx.skill.id * 100 + ctx.level.level;

export const per = (s: SkillInput, skillPer: number): SkillInput => ({ ...s, skillPer });

/** Weapon-part modifiers with an optional size override (WMOD in the Lua). */
export const wmod = (m: DamageModifiers, size = m.size): number =>
  size * m.element * Math.max(1 + m.race, 0.1) * Math.max(1 + m.sizeInc, 0.1) * Math.max(m.elementBonus, 0.1);

/** race x size% x element% x element table: the multiplier on MATK (MCORE without the MATK sum). */
export const magicMod = (m: DamageModifiers): number =>
  Math.max(1 + m.race, 0.1) * Math.max(1 + m.sizeInc, 0.1) * Math.max(m.elementBonus, 0.1) * m.element;

/** Stalker (5202) and Shadow Chaser (5203) cast copied spells with ATK in place of MATK (e.g. DC:13048). */
export const stalkerSwap = (m: DamageModifiers, ctx: FormulaContext): DamageModifiers =>
  ctx.attacker.job === 5202 || ctx.attacker.job === 5203 ? { ...m, matk: m.atk, weaponMatk: m.weaponAtk } : m;

/** Splits npc_dam_final and the four caster/target up/down terms that buildModifiers folds into m.npc. */
export function npcTerms(m: DamageModifiers, ctx: FormulaContext) {
  const atkUp = pct(ca(ctx, Attr.DAM_INCREASE_FINAL)), atkDown = pct(ta(ctx, Attr.DAM_REDUC_FINAL));
  const matkUp = pct(ca(ctx, Attr.MDAM_INCREASE_FINAL)), matkDown = pct(ta(ctx, Attr.MDAM_REDUC_FINAL));
  // shortcut: wrong when m.npc hit its 0.1 floor, upgrade when buildModifiers exposes npc_dam itself
  return { vs: m.npc - atkUp + atkDown, atkUp, atkDown, matkUp, matkDown };
}

/** IsSkillCrit (DC:770-797) with SKILL_CANCRI_MARK = 0: no crit unless the script passes a pro or para. */
export function skillCrit(ctx: FormulaContext, pro: number, para: number): number {
  if (!pro && !para) return 0;
  return (ca(ctx, Attr.CRI_FINAL) * para + pro - ta(ctx, Attr.CRI_RES_FINAL)) / 100;
}

/** IsCommonSkillCrit (DC:741-768) without sleep or buff branches. */
export const commonCrit = (ctx: FormulaContext): number =>
  (ca(ctx, Attr.CRI_FINAL) - ta(ctx, Attr.CRI_RES_FINAL)) / 100;

/** The value of a declared state input, or its default when the caller left it unset. */
export const st = (ctx: FormulaContext, i: StateInput): number => ctx.state[i.key] ?? i.default ?? 0;

/** On/off input for a buff the script checks with HasBuff. */
export const buffToggle = (key: string, label: string, note: string): StateInput => ({ key, label, kind: 'toggle', note });

export const SP_PCT: StateInput = {
  key: 'spPct', label: 'Current SP %', kind: 'number', min: 0, max: 100, default: 100,
  note: 'Current SP (ATTR_BASIC_SP) as a percent of max SP',
};
export const TARGET_SP_PCT: StateInput = { ...SP_PCT, key: 'targetSpPct', label: 'Target current SP %' };

/** Current SP (ATTR_BASIC_SP) from max SP and the SP % state input (full SP by default). */
export const currentSp = (ctx: FormulaContext, who: 'attacker' | 'target' = 'attacker') =>
  (ctx[who].attrs.get(Attr.MAX_SP_FINAL) * st(ctx, who === 'attacker' ? SP_PCT : TARGET_SP_PCT)) / 100;
