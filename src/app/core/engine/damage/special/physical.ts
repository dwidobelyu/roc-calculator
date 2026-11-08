import { Attr, pct } from '../../../models/attr';
import { FormulaContext, StateInput, physicalTotal } from '../formula';
import { SP_PCT, SpecialFormula, ca, commonCrit, currentSp, effectId, npcTerms, per, st, ta, wmod } from './common';

/** Pierce lands one hit per size step: Medium 2, Large 3, Small 1 (DC:9018). */
const pierceHits = (ctx: FormulaContext) => (ctx.target.size === 0 ? 2 : ctx.target.size === 1 ? 3 : 1);

const physical = (script: string, label: string, raw: SpecialFormula['raw'], flee: 'skill' | 'none' = 'skill',
  state?: StateInput[]) => new SpecialFormula({ script, label, kind: 'physical', flee, raw, state });

const SPHERES: StateInput = {
  key: 'spheres', label: 'Spirit spheres', kind: 'number', min: 0, max: 5, default: 0,
  note: 'Stacks of buff 1525; each above 2 adds 15% (max 3)',
};

/** Scripts that end in the generic PhysicalSkillCalc arithmetic once buff/equip-only terms are 0. */
const generic = (script: string, label: string, flee: 'skill' | 'none' = 'skill') =>
  physical(script, label, (m, s, F) => physicalTotal(m, s, F), flee);

/** Shield skills (DC:11503, 11557, 11289): the weapon part adds shield ATK; HMT variants scale by VIT. */
const shield = (script: string, label: string, vitScaled: boolean) =>
  physical(script, label, (m, s, F, ctx) => {
    // skipped: shield_atk = shield refine x5 + shield weight; the Combatant carries no per-slot equipment
    const shieldAtk = 0;
    const vit = ca(ctx, Attr.VIT_FINAL);
    const vitAdd = vitScaled ? 1 + (1.5 * vit) / (vit + 200) : 1;
    return physicalTotal({ ...m, weaponAtk: m.weaponAtk + shieldAtk }, per(s, s.skillPer * vitAdd), F);
  });

/** HolyCross (DC:11145) / HolyCrossHMT (DC:11177): ratio x2 with weapon type 5; no soft DEF, DEF% only in HMT. */
const holyCross = (script: string, withDef: boolean) =>
  physical(script, 'Holy Cross', (m, s, F, ctx) => {
    const p = ctx.attacker.weaponType === 5 ? 2 * s.skillPer : s.skillPer;
    const core = (2 * m.atk + m.weaponAtk * wmod(m)) * p * (withDef ? m.def : 1) * m.npc;
    return Math.max(core, 0) * F + s.skillNum * F + m.additionalAtk;
  });

export const PHYSICAL_FORMULAS: readonly SpecialFormula[] = [
  /** DC:13568 */
  physical('PhysicalSkillCalcStr', 'Physical skill (STR scaled)', (m, s, F, ctx) =>
    physicalTotal(m, per(s, s.skillPer * (1 + ca(ctx, Attr.STR_FINAL) / 5 / 100)), F)),
  /** DC:11503 */
  shield('ShieldCommon', 'Shield skill', false),
  /** DC:11557 */
  shield('ShieldCommonHMT', 'Shield skill (VIT scaled)', true),
  /** DC:11289 */
  shield('ShieldBoomerangHMT', 'Shield Boomerang', true),
  /** DC:11145 */
  holyCross('HolyCross', false),
  /** DC:11177 */
  holyCross('HolyCrossHMT', true),
  /** DC:9541 Invasion: ratio + target DEF / 200; DamageCalcBase has no flee roll. */
  physical('OccultImpaction', 'Invasion', (m, s, F, ctx) =>
    physicalTotal(m, per(s, s.skillPer + ta(ctx, Attr.DEF) / 100 / 2), F), 'none'),
  /** DC:9018 Pierce: one hit per size step (Medium 2, Large 3, Small 1). */
  new SpecialFormula({
    script: 'LianCiGongJi', label: 'Pierce', kind: 'physical', flee: 'skill',
    // skipped: buff 4300402 (+1.5 ratio) and belluz 2009 extra-hit roll
    raw: (m, s, F, ctx) => physicalTotal(m, s, F) * pierceHits(ctx),
    hitCount: pierceHits,
  }),
  /** DC:10416 Sturdy Strike: ratio x (1 + VIT / 300). */
  physical('JianDingDaJi', 'Sturdy Strike', (m, s, F, ctx) =>
    physicalTotal(m, per(s, s.skillPer * (1 + ca(ctx, Attr.VIT_FINAL) / 300)), F)),
  /** DC:18040 Clashing Spiral: size 1.25 vs Small, 1 otherwise. */
  physical('ClashingSpiral', 'Clashing Spiral', (m, s, F, ctx) => {
    // skipped: weapon weight x skill level in the weapon part (no item weight on the Combatant), belluz 2018
    const size = ctx.target.size === 2 ? 1.25 : 1;
    return physicalTotal({ ...m, size }, s, F);
  }),
  /** DC:9746 Chain Crush Combo: ratio x (1 + 0.15 x min(3, spheres - 2)) from buff 1525 stacks. */
  physical('ChainCrushCombo', 'Chain Crush Combo', (m, s, F, ctx) => {
    const extra = Math.min(3, Math.max(st(ctx, SPHERES) - 2, 0));
    return physicalTotal(m, per(s, s.skillPer * (1 + 0.15 * extra)), F);
  }, 'skill', [SPHERES]),
  /** DC:9664 Finger Offensive: damage x min(hits, spheres); assumes enough spheres (buff 1514) to cast. */
  physical('ThrowSpiritSphere', 'Finger Offensive', (m, s, F, ctx) => physicalTotal(m, s, F) * ctx.hits, 'none'),
  /** DC:9999 Soul Breaker: physical part + INT-based magic part, deepen averaged with magic deepen. */
  physical('SoulDestroyerHMT', 'Soul Breaker', (m, s, F, ctx) => {
    const int = ca(ctx, Attr.INT_FINAL);
    const n = npcTerms(m, ctx);
    const matkDownRate = ctx.pvp ? 1 : 0.2;
    // skipped: EQUIP_YLDJ (INT part bonus) and EQUIP_YCDJ (MATK part rate) fight-temp equipment terms
    const intUp = 1, matkRate = 0;
    const mods = m.element * Math.max(1 + m.race, 0.1) * Math.max(1 + m.sizeInc, 0.1) * Math.max(m.elementBonus, 0.1);
    const phys = (2 * m.atk + m.weaponAtk * mods) * s.skillPer * m.def *
      Math.max(n.vs + n.atkUp - n.atkDown + n.matkUp - n.matkDown * matkDownRate + (int / 10) * 0.01, 0.1) - m.defFlat;
    const mag = (int * s.skillPer * intUp * 5 + (m.matk + m.weaponMatk) * matkRate * mods) * m.mdef *
      Math.max(n.vs + n.atkUp + n.matkUp - n.matkDown + (int / 10) * 0.02, 0.1) - m.mdefFlat;
    const damage = Math.max(phys, 0) * F + Math.max(mag, 0) * F + m.additionalAtk;
    // pvpdam swaps the physical deepen factor for the physical/magic average, then x0.5 in PvP
    const deepen = pct(ca(ctx, Attr.DEEPEN_FINAL)), mdeepen = pct(ca(ctx, Attr.MDEEPEN_FINAL));
    const relief = pct(ta(ctx, Attr.RELIEF_FINAL));
    const swap = Math.max(1 + (deepen + mdeepen) / 2 - relief, 0.1) / Math.max(1 + deepen - relief, 0.1);
    return damage * swap * (ctx.pvp ? 0.5 : 1);
  }),
  /** DC:11994 Acid Terror: skipped skill 620107 ratio bonus and EQUIP_AEDZC multiplier. */
  generic('QiangSuanGongJi', 'Acid Terror'),
  /** DC:12197 Acid Demonstration: target VIT and caster STR scale the whole ATK; magic PvP chain. */
  new SpecialFormula({
    script: 'QiangSuanHuoYanPingHMT', label: 'Acid Demonstration', kind: 'magic', flee: 'none',
    raw: (m, s, F, ctx) => {
      // segment 1 needs belluz 7510 (buff 62622); skipped: skill 620107 ratio, skill 620203 float remap
      if (ctx.segment > 0) return 0;
      const vitpara = ctx.config['vitpara'];
      const vitPara = vitpara ? 1 + ta(ctx, Attr.VIT_FINAL) / vitpara : 1;
      const p = ctx.skill.id === 620216 ? s.skillPer + Math.min(ca(ctx, Attr.STR_FINAL) / 100, 3) : s.skillPer;
      const core = (2 * m.atk + m.weaponAtk) * vitPara * wmod(m) * p * m.def * m.npc - m.defFlat;
      return Math.max(core, 0) * F + s.skillNum * F + m.additionalAtk;
    },
  }),
  /** DC:12308 Demonic Fire: parts 1-2 deal damage, part 0 none, part 3 needs belluz 7510 (buff 62622). */
  physical('EmohuoyanPhy', 'Demonic Fire', (m, s, F, ctx) =>
    ctx.segment === 1 || ctx.segment === 2 ? physicalTotal(m, s, F) : 0, 'none'),
  /** DC:9618 Asura Strike: ratio x (160 + current SP / 20) / 10, no DEF%, soft DEF subtracted. */
  physical('AsuraStrikeHMT', 'Asura Strike', (m, s, F, ctx) => {
    // skipped: SKILL_SKILLPER_ADD fight temp and buffs 72481/72482 vs shields
    const p = ((160 + currentSp(ctx) / 20) * s.skillPer) / 10;
    return Math.max((2 * m.atk + m.weaponAtk * wmod(m)) * p * m.npc - m.defFlat, 0) * F + s.skillNum * F + m.additionalAtk;
  }, 'none', [SP_PCT]),
  /** DC:13409 Cart Spurt: skipped EQUIP_BKZF cart-weight flat damage. */
  generic('CarSkill3Turn', 'Cart Spurt'),
  /** DC:16059 Gate of Hell: its effect ids fall in the generic else branch. */
  generic('LuoChaPoHuangQuan', 'Gate of Hell'),
  /** DC:16775 Front Slide: its effect ids fall in the generic else branch. */
  generic('QianCeHuaPhysicalSkillCalc', 'Front Slide'),
  /** DC:2654 Envenom: flat x (min(45, BaseLv) - 10) + 50, only element and soft DEF apply. */
  physical('StableElementDamage', 'Envenom', (m, s, F, ctx) => {
    // skipped: SKILL_SKILLNUM_ADD fight temp
    const num = s.skillNum * (Math.min(45, ctx.attacker.level) - 10) + 50;
    return Math.max(num * m.element * Math.max(m.elementBonus, 0.1) - m.defFlat, 0) * F + m.additionalAtk;
  }),
  /** DC:4048 Smite (Novice): flat damage x race table (0 vs race 10), no float, no PvP chain. */
  new SpecialFormula({
    script: 'ZhongJi', label: 'Smite', kind: 'physical', flee: 'none', global: false,
    raw: (_m, s, _F, ctx) => (ctx.target.race === 10 ? 0 : s.skillNum),
  }),
  /** DC:18141 Blitz Beat: falcon damage from DEX/INT/status ATK, no soft DEF, DEF% only in PvP. */
  physical('ShanDianChongJi', 'Blitz Beat', (m, s, F, ctx) => {
    // skipped: skills 710107/710207/710125 learned levels (falcon ATK, ATK%), buff 4048 crit, equip fight temps
    const lvA = 0, skillAtk = 0, skillAtkPer = 0, lvB = 0;
    const dex = ca(ctx, Attr.DEX_FINAL), int = ca(ctx, Attr.INT_FINAL);
    const n = npcTerms(m, ctx);
    const element = m.element - 1 > 0 ? 1.3 : m.element;
    const def = ctx.pvp ? m.def : 1;
    const base = (80 + 6 * lvA + (2 * dex) / 3 + (2 * int) / 2 + skillAtk + m.atk) * Math.max(1 + n.atkUp - n.atkDown, 0.1) *
      element * Math.max(1 + m.race, 0.1) * Math.max(1 + m.sizeInc, 0.1) * Math.max(m.elementBonus, 0.1);
    const tempAdd = skillAtkPer * (2 * m.atk + m.weaponAtk);
    const id = effectId(ctx);
    if (id > 71010200 && id < 71012511) {
      return (base * s.skillPer + tempAdd) * def * F + s.skillNum * F + m.additionalAtk;
    }
    return (base * s.skillPer * (1 + 0.2 * lvB) + tempAdd) * def * F + s.skillPer * lvB * 10 * F + m.additionalAtk;
  }, 'none'),
  /** DC:10134 Sniping Shot: normal-attack flee and crit rolls, physical PvP chain. */
  new SpecialFormula({
    script: 'SniperStrike', label: 'Sniping Shot', kind: 'physical', flee: 'normal', canCrit: true,
    raw: (m, s, F) => physicalTotal(m, s, F), critChance: commonCrit,
  }),
];
