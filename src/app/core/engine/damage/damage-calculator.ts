import { Attr } from '../../models/attr';
import { BreakdownLine, Combatant, DamageRequest, DamageResult } from '../../models/combat.models';
import { attackElementOf, elementSource } from '../skill-element';
import { buildModifiers, globalMultiplier } from './damage-modifiers';
import { DamageFormula, FormulaContext, SkillInput, resolveFormula } from './damage-formulas';

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Number of damage parts (segments) a skill level has in SkillEffectTable. */
export function segmentCount(level: DamageRequest['level']): number {
  return Math.max(level.pveRatio.length, 1);
}

/**
 * Damage of one skill use. `segment: 'all'` adds every part of a multi-part skill together (each part rolls its own
 * float, so the sum of mins and the sum of maxes bound the total); a number computes that one part.
 */
export function calculateDamage(req: DamageRequest): DamageResult | null {
  if (req.segment !== 'all') return calculateSegment(req, req.segment);
  const parts = Array.from({ length: segmentCount(req.level) }, (_, i) => calculateSegment(req, i))
    .filter((p): p is DamageResult => p !== null);
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];
  const sum = (pick: (r: DamageResult) => number) => parts.reduce((a, r) => a + pick(r), 0);
  const first = parts[0];
  return {
    ...first,
    hits: sum((r) => r.hits),
    normal: { min: sum((r) => r.normal.min), max: sum((r) => r.normal.max) },
    critical: first.critical
      ? { min: sum((r) => r.critical?.min ?? r.normal.min), max: sum((r) => r.critical?.max ?? r.normal.max) }
      : null,
    notes: [`Total of ${parts.length} damage parts.`, ...first.notes],
  };
}

function calculateSegment(req: DamageRequest, segment: number): DamageResult | null {
  const { attacker: c, target: t, skill, level } = req;
  const { formula, approximated } = resolveFormula(level.script, skill.damageType);
  if (!formula) return null;

  const pvp = c.kind === 'player' && t.kind === 'player';
  const at = <T>(arr: T[], fallback: T) => arr[segment] ?? arr[0] ?? fallback;
  const ratio = at(pvp ? level.pvpRatio : level.pveRatio, 10000);
  const flat = at(pvp ? level.pvpFlat : level.pveFlat, 0);
  const tableHits = Math.max(at(pvp ? level.pvpHits : level.hits, 1), 1);
  // "Skill DMG %" (attr 283) scales the skill ratio of real skills [inferred: the native fill is not readable]
  const skillDmg = formula.damageKind === 'normal' ? 0 : c.attrs.get(Attr.SKILL_ATK_PER) / 10000;
  // skill ratio / flat additions from fight-temp, both cut by SKILL_CANNON_ATTRDOWN (DC:1356-1373)
  const ft = (k: string) => c.fightTemp?.[k] ?? 0;
  const cut = Math.max(0, 1 - ft('SKILL_CANNON_ATTRDOWN') / 10000);
  const input: SkillInput = {
    skillPer: ((ratio / 10000) * (1 + skillDmg) + ft('SKILL_SKILLPER_ADD_SNAPSHOT') / 10000) * cut,
    skillNum: (flat + ft('SKILL_SKILLNUM_ADD_SNAPSHOT')) * cut,
  };
  const ctx: FormulaContext = {
    attacker: c, target: t, skill, level, segment, hits: tableHits, pvp,
    config: (pvp ? level.pvpConfig ?? level.config : level.config) ?? {},
    state: stateValues(formula, req.state),
  };
  const hits = formula.hitCount ? formula.hitCount(ctx) : tableHits;

  const attackElement = resolveAttackElement(skill, formula, c);
  const m = buildModifiers(c, t, attackElement);
  const global = formula.usesGlobalMultiplier ? globalMultiplier(c, t, formula.damageKind) : 1;
  // floor at the hit count is applied before the crit multiplier (DC:1764-1774)
  const at_ = (F: number) => Math.max(formula.raw(m, input, F, ctx) * global, hits);
  const normal = { min: Math.floor(at_(m.floatMin)), max: Math.floor(at_(m.floatMax)) };
  const critMul = formula.critMultiplier ? formula.critMultiplier(m, ctx) : m.critMultiplier;
  const critical = formula.canCrit
    ? { min: Math.floor(at_(m.floatMin) * critMul), max: Math.floor(at_(m.floatMax) * critMul) }
    : null;

  const notes: string[] = [];
  if (approximated) {
    notes.push(`"${level.script}" is a skill-specific script in the game. This result uses the generic ${formula.label.toLowerCase()} formula instead.`);
  }
  if (c.ammo && attackElement === c.ammo.element && elementSource(skill, formula.damageKind).kind === 'weapon' && (skill.arrows ?? 0) > 0) {
    notes.push('This skill uses arrows: the arrow element is used (inferred; the game sets it natively).');
  }
  if (skillDmg) notes.push(`Skill DMG ${+(skillDmg * 100).toFixed(2)}% is applied to the skill ratio (inferred).`);
  if (ratio === 0 && flat === 0) notes.push('This skill part has no damage ratio in SkillEffectTable; its damage comes from script config data that is not extracted.');

  return {
    formulaName: formula.label,
    approximated,
    hits,
    normal,
    critical,
    ...rollChances(formula, ctx, req.attackerCount),
    breakdown: breakdown(formula, m, input, global, hits, critMul),
    notes,
  };
}

/** Values for the formula's declared state inputs: the user's value, else the input default, else 0. */
export function stateValues(f: DamageFormula, given: Readonly<Record<string, number>> = {}): Record<string, number> {
  return Object.fromEntries((f.stateInputs ?? []).map((i) => [i.key, given[i.key] ?? i.default ?? 0]));
}

/** Attack element from the skill's element source (skill-element.ts) and the attacker's weapon and arrow. */
function resolveAttackElement(skill: DamageRequest['skill'], f: DamageFormula, c: Combatant): number {
  const arrows = skill.arrows ?? (c.ammo?.skillIds.has(skill.id) ? 1 : 0);
  return attackElementOf(elementSource({ element: skill.element, arrows }, f.damageKind), c.weaponElement, c.ammo?.element ?? null);
}

/** DC:682-797: perfect hit, flee and crit rolls. Units: HIT/FLEE/CRI as points, 100 = 100%. */
function rollChances(f: DamageFormula, ctx: FormulaContext, attackers: number) {
  const { attacker: c, target: t, pvp } = ctx;
  const ca = c.attrs, ta = t.attrs;
  const magic = f.damageKind === 'magic';
  const perfect = clamp(100 + ca.get(magic ? Attr.COMPLETE_MHIT : Attr.COMPLETE_HIT) -
    ta.get(magic ? Attr.COMPLETE_MDODGE : Attr.COMPLETE_DODGE), 5, 100) / 100;

  const hitBase = ca.get(Attr.HIT_FINAL), fleeBase = ta.get(Attr.FLEE_FINAL), dex = ca.get(Attr.DEX);
  const fleeCut = 1 - (clamp(attackers, 2, 7) - 2) * 0.3;
  let hit = 1;
  if (f.fleeRoll === 'normal') {
    hit = (hitBase - fleeBase * fleeCut) / 100;
    if (pvp) {
      const h = hitBase * 1.05 - fleeBase + dex * 0.5;
      if (h > -100 && h < 0) hit = (((h + 100) / 100) * 5 + 15) / 100;
      else if (h >= 0 && h < 100) hit = ((h / 100) * 80 + 20) / 100;
    }
    hit = clamp(hit, 0.05, 1);
  } else if (f.fleeRoll === 'skill') {
    hit = ((pvp ? hitBase * 1.5 + dex * 0.5 : hitBase) - fleeBase * fleeCut) / 100;
    if (pvp) {
      if (hit < 0) hit = (((hit * 100 + 100) / 100) * 5 + 45) / 100;
      else if (hit < 1) hit = (hit * 50 + 50) / 100;
    }
    hit = clamp(hit, 0.05, 1);
  }
  let crit = 0;
  if (f.critChance) crit = clamp(f.critChance(ctx), 0, 1);
  else if (f.canCrit) {
    const cri = ca.get(Attr.CRI_FINAL), res = ta.get(Attr.CRI_RES_FINAL);
    if (f.damageKind === 'normal') crit = clamp((cri - res) / 100, 0, 1);
    else {
      // IsSkillCrit (DC:770-797): (CRIT x cripara + cripro - CRIT RES) / 100, params from PVEConfigData
      const cripro = ctx.config['cripro'] ?? 0;
      const cripara = (ctx.config['cripara'] ?? 10000) / 10000;
      crit = clamp((cri * cripara + cripro - res) / 100, 0, 1);
    }
  }
  // block (DC:1071-1100): the target's block rate from its fight-temp; Parry-style SJGD adds the gear rate
  const tft = (k: string) => t.fightTemp?.[k] ?? 0;
  const sjgd = tft('SKILL_SJGD_BLOCK') === 1;
  const block = magic
    ? (sjgd ? tft('EQUIP_JJCJ_MAGICBLOCKPRO') / 10000 : 0)
    : tft('SKILL_COMMON_BLOCK') / 10000 + (sjgd ? tft('EQUIP_JJCJ_PHYSICBLOCKPRO') / 10000 : 0);
  return { perfectHitChance: perfect, hitChance: hit * (1 - clamp(block, 0, 1)), critChance: crit };
}

function breakdown(
  f: DamageFormula,
  m: ReturnType<typeof buildModifiers>,
  s: SkillInput,
  global: number,
  hits: number,
  critMul: number,
): BreakdownLine[] {
  const magic = f.damageKind === 'magic';
  const lines: BreakdownLine[] = magic
    ? [
        { label: 'Status MATK', value: m.matk, source: 'game' },
        { label: 'Weapon + refine MATK', value: m.weaponMatk, source: 'game' },
        { label: 'MDEF multiplier', value: m.mdef, source: 'inferred' },
        { label: 'Soft MDEF (subtracted)', value: m.mdefFlat, source: 'game' },
        { label: 'Target class x MDMG% bonus', value: m.npcMagic, source: 'inferred' },
        { label: 'Additional magic damage', value: m.additionalMatk, source: 'game' },
      ]
    : [
        { label: 'Status ATK (counted x2)', value: m.atk, source: 'game' },
        { label: 'Weapon + refine ATK', value: m.weaponAtk, source: 'game' },
        { label: 'Weapon vs size', value: m.size, source: 'game' },
        { label: 'DEF multiplier', value: m.def, source: 'inferred' },
        { label: 'Soft DEF (subtracted)', value: m.defFlat, source: 'game' },
        { label: 'Target class x PDMG% bonus', value: m.npc, source: 'inferred' },
        { label: 'Additional physical damage', value: m.additionalAtk, source: 'game' },
      ];
  lines.push(
    { label: 'Skill ratio', value: s.skillPer, source: 'game' },
    { label: 'Skill flat damage', value: s.skillNum, source: 'game' },
    { label: 'Element table', value: m.element, source: 'game' },
    { label: 'Element damage %', value: m.elementBonus, source: 'inferred' },
    { label: 'Race damage %', value: 1 + m.race, source: 'inferred' },
    { label: 'Size damage %', value: 1 + m.sizeInc, source: 'inferred' },
    { label: 'Damage float', value: (m.floatMin + m.floatMax) / 2, source: 'inferred' },
    { label: 'Global multiplier (PvP/PvE chain)', value: global, source: 'game' },
    { label: 'Hits', value: hits, source: 'game' },
  );
  if (f.canCrit) lines.push({ label: 'Crit multiplier', value: critMul, source: 'game' });
  return lines;
}
