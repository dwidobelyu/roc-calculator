import { Attr, pct } from '../../../models/attr';
import { FormulaContext, StateInput, magicTotal, physicalTotal } from '../formula';
import { SpecialFormula, buffToggle, ca, effectId, per, skillCrit, st, ta } from './common';

/**
 * Scripts on CalculatePhysicalSkillCanCriDamageBase whose crit para comes from a caster buff. Without the buff
 * pro = para = 0, so IsSkillCrit never crits; `para` reads the buff toggles.
 */
const buffCrit = (script: string, label: string, state: StateInput[], para: (ctx: FormulaContext) => number) =>
  new SpecialFormula({
    script, label, kind: 'physical', flee: 'skill', canCrit: true, state,
    raw: (m, s, F) => physicalTotal(m, s, F), critChance: (ctx) => skillCrit(ctx, 0, para(ctx)),
  });

const skillOf = (ctx: FormulaContext) => Math.floor(effectId(ctx) / 100);

const RANGER_CRIT = buffToggle('critBuff', 'Crit buff active', 'Buff 4202311 (Windfury Shot) or 4202321 (Warg skills)');
const RANGER_CRIT_UP = buffToggle('critUpBuff', 'Crit upgrade buff active', 'Buff 4202313 (Windfury Shot) or 4202324 (Warg skills)');
const CART_MARK = buffToggle('targetMark', 'Target has the Cart Smash mark', 'Target buff 5073');
const CART_CRIT = buffToggle('critBuff', 'Crit buff active', 'Buff 4202341');
const CART_CRIT_UP = buffToggle('critUpBuff', 'Crit upgrade buff active', 'Buff 4202342');
const SPEAR_CRIT = buffToggle('critBuff', 'Crit buff active', 'Buff 21037');
const CRESCENT_CRIT = buffToggle('critBuff', 'Crit buff active', 'Buff 4203152');
const TIGER_CRIT = buffToggle('critBuff', 'Crit buff active', 'Buff 4203137');
const ROLLING_CRIT = buffToggle('critBuff', 'Crit buff active', 'Buff 3218');
const RED_CUT = buffToggle('redCutBuff', 'Red Cut crit buff active', 'Buff 4102412');
const CHILI_CRIT = buffToggle('chiliCrit', 'Rage of Land active (crit)', 'Buff 8510');
const CHILI_STACKS: StateInput = {
  key: 'chiliStacks', label: 'Chili stacks on the target', kind: 'number', min: 0, default: 0,
  note: "Stacks of the caster's buff 8502 on the target",
};
const CHILI_PLUS = buffToggle('chiliPlus', 'Extra stacks buff active (+5)', 'Buff 4203127');
const CHILI_EQUIP = buffToggle('chiliEquip', 'Equipment bonus buff active', 'Buff 4203126 (EQUIP_DDKY_SKILL)');

export const PHYSICAL_CRIT_FORMULAS: readonly SpecialFormula[] = [
  /** DC:13324 Ranger shots: para 0.6 with the crit buff, 1 with its upgrade; skipped equip ZHNS flat. */
  buffCrit('YouXiaSkillCalcCri', 'Ranger shot', [RANGER_CRIT, RANGER_CRIT_UP], (ctx) =>
    st(ctx, RANGER_CRIT) ? (st(ctx, RANGER_CRIT_UP) ? 1 : 0.6) : 0),
  /** DC:13370 Cart Smash: para 0.6 (0.7 upgraded) with target buff 5073 + buff 4202341; skipped EQUIP_BKZF flat. */
  buffCrit('ReLiPenSheCalcCri', 'Cart Smash', [CART_MARK, CART_CRIT, CART_CRIT_UP], (ctx) =>
    st(ctx, CART_MARK) && st(ctx, CART_CRIT) ? (st(ctx, CART_CRIT_UP) ? 0.7 : 0.6) : 0),
  /** DC:13437 Hundred Spears: para 0.7 with buff 21037. */
  buffCrit('JiSuChuoCi', 'Hundred Spears', [SPEAR_CRIT], (ctx) => (st(ctx, SPEAR_CRIT) ? 0.7 : 0)),
  /** DC:13467 Crescent Slasher: para 1 with buff 4203152 (skills 220315/1010509/1010510); skipped EQUIP_MDTS flat. */
  buffCrit('HuangJiaWeiShiSkillCalcCri', 'Crescent Slasher', [CRESCENT_CRIT], (ctx) =>
    [220315, 1010509, 1010510].includes(skillOf(ctx)) && st(ctx, CRESCENT_CRIT) ? 1 : 0),
  /**
   * DC:13503 Tiger Cannon / Dragon Combo: para 1 with buff 4203137. Skipped: per-stack ratio from buffs 320312/320303,
   * the SkillEffectTable "per" param it scales is absent from the extracted config, so the stacks add 0.
   */
  buffCrit('XiuLuoSkillCalcCri', 'Tiger Cannon', [TIGER_CRIT], (ctx) =>
    [320304, 320306].includes(skillOf(ctx)) && st(ctx, TIGER_CRIT) ? 1 : 0),
  /** DC:15820 Rolling Cutter: para 1 with buff 3218. */
  buffCrit('AnCiCalcCri', 'Rolling Cutter', [ROLLING_CRIT], (ctx) => (st(ctx, ROLLING_CRIT) ? 1 : 0)),
  /** DC:8683 Sonic Blow: crit from SkillEffectTable cripro/cripara; skipped skill 510104 damage bonus. */
  new SpecialFormula({
    script: 'YinSuTouZhi', label: 'Sonic Blow', kind: 'physical', flee: 'skill', canCrit: true,
    raw: (m, s, F) => physicalTotal(m, s, F),
    critChance: (ctx) => skillCrit(ctx, ctx.config['cripro'] ?? 0, (ctx.config['cripara'] ?? 0) / 10000),
  }),
  /**
   * DC:8732 Red Cut: buff 4102412 switches to the crit base with SkillEffectTable cripro/cripara; skipped skill 510116
   * bonus and buff 156.
   */
  new SpecialFormula({
    script: 'ShenHongQieGe', label: 'Red Cut', kind: 'physical', flee: 'skill', canCrit: true, state: [RED_CUT],
    raw: (m, s, F) => physicalTotal(m, s, F),
    // DC:822 CriDamageResultShenHongQieGe: 1.2 x (1 + 0.3 x (crit dmg - crit def)); m.critMultiplier is 1.5 x (1 + that)
    critMultiplier: (m) => 1.2 * (1 + 0.3 * (m.critMultiplier / 1.5 - 1)),
    critChance: (ctx) => st(ctx, RED_CUT)
      ? skillCrit(ctx, ctx.config['cripro'] ?? 0, (ctx.config['cripara'] ?? 0) / 10000) : 0,
  }),
  /** DC:18276 Falcon Assault: crit pro 1 / para 1; ratio + DEX x 0.15 (PvE) or a DEX-difference curve (PvP). */
  new SpecialFormula({
    script: 'LieYingTuJi2', label: 'Falcon Assault', kind: 'physical', flee: 'skill', canCrit: true,
    raw: (m, s, F, ctx) => {
      const dex = ca(ctx, Attr.DEX_FINAL);
      const diff = Math.max(0, dex - ta(ctx, Attr.DEX_FINAL));
      const bonus = ctx.pvp ? Math.min(30, ((30 * diff) / 180) * (diff / 180)) : (dex / 100) * 15;
      return physicalTotal(m, per(s, s.skillPer + bonus), F);
    },
    critChance: (ctx) => skillCrit(ctx, 1, 1),
  }),
  /** DC:14856 Chili Bomb: damage x stacks of the caster's buff 8502 on the target x 0.8; 0 stacks = 0. */
  new SpecialFormula({
    script: 'ZhaDanLaJiao', label: 'Chili Bomb', kind: 'magic', flee: 'skill', canCrit: true,
    state: [CHILI_STACKS, CHILI_PLUS, CHILI_EQUIP, CHILI_CRIT],
    raw: (m, s, F, ctx) => {
      const n = st(ctx, CHILI_STACKS);
      const stacks = n && st(ctx, CHILI_PLUS) ? n + 5 : n;
      const equip = st(ctx, CHILI_EQUIP) ? pct(ctx.attacker.fightTemp?.['EQUIP_DDKY_SKILL'] ?? 0) : 0;
      return stacks * magicTotal(m, s, F) * 0.8 * (1 + equip);
    },
    critChance: (ctx) => (st(ctx, CHILI_CRIT) ? skillCrit(ctx, 0, 1) : 0),
  }),
];
