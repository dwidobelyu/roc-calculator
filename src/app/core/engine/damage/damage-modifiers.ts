import { Attr, ELEMENT_SLOT, SIZE_ATTRS, pct } from '../../models/attr';
import { Combatant } from '../../models/combat.models';
import { ELEMENT_DAMAGE, PVP_DAM_CURVE, PVP_WEAPON_ATK_FACTOR, WEAPON_SIZE_DAMAGE } from '../combat-tables';

/**
 * Inputs shared by every damage formula: DamageCalculator.Calculatorprocess (DC:1102-1440) plus the values the
 * game fills natively in args.calculate_data_. Native values are reconstructed from final attributes and
 * flagged as inferred.
 */
export interface DamageModifiers {
  pvp: boolean;
  attackElement: number;
  // physical
  atk: number;
  weaponAtk: number;
  size: number;
  sizeInc: number;
  race: number;
  element: number;
  elementBonus: number;
  def: number;
  defFlat: number;
  npc: number;
  // magic
  matk: number;
  weaponMatk: number;
  mdef: number;
  mdefFlat: number;
  npcMagic: number;
  // shared
  additionalAtk: number;
  additionalMatk: number;
  floatMin: number;
  floatMax: number;
  critMultiplier: number;
  /** TempAddDam (DC:1720-1841): extra damage from gear fight-temp rates, added before DEF. */
  tempAddPhys?: number;
  tempAddNormal?: number;
  tempAddMagic?: number;
}

/** Element-damage snapshots that add to the element multiplier when it is already > 1 (DC:1190-1250). */
const ELEMENT_SNAPSHOTS: readonly [string, number, readonly number[]][] = [
  ['EQUIP_COMMON_FIREDAM_SNAPSHOT', 3, [9, 2]], ['EQUIP_COMMON_POISONDAM_SNAPSHOT', 5, [1, 2, 3, 4]],
  ['EQUIP_COMMON_WINDDAM_SNAPSHOT', 1, [4]], ['EQUIP_COMMON_EARTHDAM_SNAPSHOT', 2, [1]],
  ['EQUIP_COMMON_WATERDAM_SNAPSHOT', 4, [3]], ['EQUIP_COMMON_HOLYDAM_SNAPSHOT', 6, [9, 7]],
  ['EQUIP_COMMON_GHOSSDAM_SNAPSHOT', 8, [8, 9]],
];

export function buildModifiers(c: Combatant, t: Combatant, attackElement: number): DamageModifiers {
  const ca = c.attrs, ta = t.attrs;
  const pvp = c.kind === 'player' && t.kind === 'player';

  // weapon vs size, size and race damage % (DC:1107-1130)
  const size = WEAPON_SIZE_DAMAGE[c.weaponType]?.[t.size] ?? 1;
  const sizeInc = pct(ca.get(SIZE_ATTRS[t.size][0])) - pct(ta.get(SIZE_ATTRS[c.size][1]));
  const ft = (k: string) => c.fightTemp?.[k] ?? 0;
  const race = pct(ca.get(Attr.RACE_DAM + t.race)) - pct(ta.get(Attr.RACE_RES + c.race)) + pct(ft('EQUIP_COMMEN_RACEADD_SNAPSHOT'));

  // element table with the PvP weakness dampener (DC:1132-1263)
  const v = ELEMENT_DAMAGE[attackElement]?.[t.element] ?? 1;
  const ratio = pvp && v > 1 ? pct(ta.get(Attr.ELEMENT_RATIO)) : 0;
  let element = 1 + (v - 1) * Math.max(0.25, 1 - ratio);
  if (element > 1) {
    for (const [key, atkEl, defEls] of ELEMENT_SNAPSHOTS) {
      if (attackElement === atkEl && defEls.includes(t.element)) element += pct(ft(key));
    }
  }

  // native "yuansu": element damage % of the attacker minus element resist of the target [inferred]
  const atkSlot = ELEMENT_SLOT[attackElement] ?? 4;
  const defSlot = ELEMENT_SLOT[t.element] ?? 4;
  const elementBonus = 1 + pct(ca.get(Attr.ELEMENT_SKILL_ATK + atkSlot)) - pct(ta.get(Attr.ELEMENT_SKILL_DEF + atkSlot)) +
    (t.kind === 'monster' ? pct(ca.get(Attr.ELEMENT_NPC_DAM + defSlot)) : 0);

  // native DEF reduction, shape taken from the game's own EHP estimate (AC:2772) [inferred]
  const defEquip = Math.max(ta.get(Attr.DEF_FINAL) * (1 - Math.min(pct(ca.get(Attr.IGNORE_DEF_PER)), 1)) -
    ca.get(Attr.IGNORE_DEF), 0);
  const refineDef = ta.get(Attr.REFINE_REDUC);
  const def = ((defEquip + 4000) / (defEquip * 10 + 4000)) * ((refineDef + 400) / (refineDef * 10 + 400));
  const mdefEquip = Math.max(ta.get(Attr.MDEF_FINAL) * (1 - Math.min(pct(ca.get(Attr.IGNORE_MDEF_PER)), 1)) -
    ca.get(Attr.IGNORE_MDEF), 0);
  const mdef = (mdefEquip + 1000) / (mdefEquip * 10 + 1000); // MDEF curve used by create_monster_attr.lua:120

  // native npc_dam_final: damage vs target class [inferred], then final DMG% bonus/reduction (DC:1720)
  const vsClass = targetClassBonus(c, t);
  const npc = Math.max(vsClass + pct(ca.get(Attr.DAM_INCREASE_FINAL)) - pct(ta.get(Attr.DAM_REDUC_FINAL)), 0.1);
  const npcMagic = Math.max(vsClass + pct(ca.get(Attr.MDAM_INCREASE_FINAL)) - pct(ta.get(Attr.MDAM_REDUC_FINAL)), 0.1);

  // weapon ATK = weapon part + refine part (refine x weapon ATK% == ATTR_TOTAL_REFINE)
  let weaponAtk = ca.get(Attr.WEAPON_ATK_FINAL) + ca.get(Attr.TOTAL_REFINE);
  let weaponMatk = ca.get(Attr.WEAPON_MATK_FINAL) + ca.get(Attr.TOTAL_MREFINE);
  let atk = ca.get(Attr.BASE_ATK_FINAL);
  let matk = ca.get(Attr.BASE_MATK_FINAL);
  if (pvp) {
    // PvP weapon ATK compression (DC:1400-1437)
    const b = Math.max(c.level - 29, 1);
    const k = PVP_WEAPON_ATK_FACTOR[c.weaponType] ?? 1;
    const curve = 3 * b * b + 107 * b + 600;
    weaponAtk = (weaponAtk + 2 * Math.min(weaponAtk, (curve / 28 + 100) * k)) / 3;
    weaponMatk = (weaponMatk + Math.min(weaponMatk, (curve / 25 + 100) * k)) / 2;
    atk *= 2 / 3;
    matk *= 2 / 3;
  }

  // damage float (DC:1375-1392); native roll assumed uniform on [0.97, 1.03]
  const up = pct(ca.get(Attr.FLOAT_UP)), down = pct(ca.get(Attr.FLOAT_DOWN));
  const floatMax = 1.03 + up;
  const floatMin = Math.min(0.97 + down, floatMax);

  // TempAddDam: rate x (2 x status ATK + weapon ATK) or x (MATK + weapon MATK); MSAHQ has no /10000 in the Lua
  const physBase = 2 * atk + ca.get(Attr.WEAPON_ATK_FINAL), magBase = matk + ca.get(Attr.WEAPON_MATK_FINAL);
  const phys = (pct(ft('EQUIP_MDTS_EXDAMRATE_SNAPSHOT')) + pct(ft('XJWW_EXDAMRATE_SNAPSHOT'))) * physBase +
    ft('EQUIP_MSAHQ_EXDAMRATE_SNAPSHOT') * magBase;
  const tempAddPhys = phys + Math.max(0, pct(ft('EQUIP_ZHNS_EXDAMRATE')) - 4.5) * magBase;
  const tempAddNormal = phys + pct(ft('EQUIP_WZHY_EXDAMRATE_SNAPSHOT')) * magBase + pct(ft('EQUIP_SCSZX_EXDAMRATE_SNAPSHOT')) * physBase;
  const tempAddMagic = pct(ft('EQUIP_WZHY_EXDAMRATE_SNAPSHOT')) * magBase +
    (pct(ft('EQUIP_SCSZX_EXDAMRATE_SNAPSHOT')) + pct(ft('XJWW_EXDAMRATE_SNAPSHOT'))) * physBase + ft('EQUIP_MSAHQ_EXDAMRATE_SNAPSHOT') * magBase;

  return {
    tempAddPhys, tempAddNormal, tempAddMagic,
    pvp, attackElement, atk, weaponAtk, size, sizeInc, race, element, elementBonus, def,
    defFlat: ta.get(Attr.BASE_DEF_FINAL), npc, matk, weaponMatk, mdef, mdefFlat: ta.get(Attr.BASE_MDEF_FINAL),
    npcMagic, additionalAtk: ca.get(Attr.ADDITIONAL_ATK), additionalMatk: ca.get(Attr.ADDITIONAL_MATK),
    floatMin, floatMax,
    critMultiplier: 1.5 * (1 + pct(ca.get(Attr.CRI_DAM_PER)) - pct(ta.get(Attr.CRI_DEF_PER))),
  };
}

function targetClassBonus(c: Combatant, t: Combatant): number {
  const ca = c.attrs, ta = t.attrs;
  if (t.kind === 'monster') return 1 + pct(ca.get(t.isBoss ? Attr.BOSS_DAM : Attr.MONSTER_DAM));
  if (c.kind === 'player') return 1 + pct(ca.get(Attr.PLAYER_DAM)) - pct(ta.get(Attr.PLAYER_RES));
  return 1 - pct(ta.get(c.isBoss ? Attr.BOSS_RES_FINAL : Attr.MONSTER_RES_FINAL));
}

/** armor_dam[casterArmor][targetArmor], classes 1..4 (DC:427-452); > 1 means the caster's armor counters the target's. */
const ARMOR_COUNTER: readonly (readonly number[])[] = [
  [1, 1.2, 0.9, 1], [0.9, 1, 1, 1.2], [1.2, 1, 1, 0.9], [1, 0.9, 1.2, 1],
];
/** Per armor class: [damage vs that class attr, resist from that class attr] (DC:1594-1610). */
const ARMOR_ATTRS: readonly (readonly [number, number])[] = [[491, 487], [492, 488], [493, 489], [494, 490]];
/** Per job group (jobId / 100): [damage vs that group attr, resist from that group attr] (DC:1625-1691). */
const JOB_ATTRS: Readonly<Record<number, readonly [number, number]>> = {
  21: [507, 495], 22: [508, 496], 31: [509, 497], 32: [510, 498], 41: [511, 499], 42: [512, 500],
  51: [513, 501], 52: [514, 502], 71: [515, 503], 72: [516, 504], 61: [517, 505], 62: [518, 506],
  81: [531, 532], 91: [558, 559], 101: [568, 569],
};

/** Armor-class counter (DC:1590-1620): only when both sides have an armor class. */
function armorFactor(c: Combatant, t: Combatant): number {
  const ca = c.attrs, ta = t.attrs;
  const cA = ca.get(Attr.ARMOR), tA = ta.get(Attr.ARMOR);
  if (!cA || !tA || !ARMOR_COUNTER[cA - 1] || !ARMOR_ATTRS[tA - 1]) return 1;
  const ex = ARMOR_COUNTER[cA - 1][tA - 1] > 1 ? pct(ca.get(Attr.RESTRAIN_DAMUP)) - pct(ta.get(Attr.RESIST_DAMDOWN)) : 0;
  return 1 + ex + pct(ca.get(ARMOR_ATTRS[tA - 1][0])) - pct(ta.get(ARMOR_ATTRS[cA - 1][1]));
}

/** Job counter (DC:1621-1693): advanced jobs only (job id not ending in 0). */
function jobCounter(c: Combatant, t: Combatant): number {
  if (c.job % 10 === 0 || t.job % 10 === 0) return 0;
  const vs = JOB_ATTRS[Math.trunc(t.job / 100)], from = JOB_ATTRS[Math.trunc(c.job / 100)];
  return (vs ? pct(c.attrs.get(vs[0])) : 0) - (from ? pct(t.attrs.get(from[1])) : 0);
}

/** DamageCalculator.PvpDamProcess (DC:1464-1707): one global multiplier. */
export function globalMultiplier(c: Combatant, t: Combatant, kind: 'normal' | 'physical' | 'magic'): number {
  const ca = c.attrs, ta = t.attrs;
  const pvp = c.kind === 'player' && t.kind === 'player';
  const base = !pvp ? 1 : kind === 'normal' ? 0.7 : kind === 'magic' ? 0.3 : 0.6;

  let attrUp: number;
  if (pvp) {
    const d = ca.get(Attr.PVP_DAM) - ta.get(Attr.PVP_RES);
    const abs = Math.abs(d);
    const [slope, x0, y0] = PVP_DAM_CURVE[Math.min(Math.floor(abs / 300), 8)];
    attrUp = Math.sign(d) * (slope * (abs - x0) + y0);
  } else {
    const dam = ca.get(Attr.PVE_DAM), res = ta.get(Attr.PVE_RES);
    attrUp = (dam ? dam / (dam + 8000) : 0) - (res ? res / (res + 8000) : 0);
  }

  const [deepen, relief] = kind === 'magic'
    ? [ca.get(Attr.MDEEPEN_FINAL), ta.get(Attr.MRELIEF_FINAL)]
    : [ca.get(Attr.DEEPEN_FINAL), ta.get(Attr.RELIEF_FINAL)];
  const damUpFinal = Math.max(1 + pct(deepen) - pct(relief), 0.1);
  const newDamUp = pvp
    ? Math.max(0.35, (1 + pct(ca.get(Attr.DAMAGE_RESTRAIN))) * (1 - pct(ta.get(Attr.DAMAGE_RESIST))))
    : 1;
  const x = ca.get(Attr.SOUL_FORCE_DAMUP) - ta.get(Attr.SOUL_FORCE_DAMDOWN);
  const soul = Math.max(0.35, 1 + (x ? x / (Math.abs(x) + 8000) : 0));
  const emblem = Math.max(0.35, 1 + pct(ca.get(Attr.EMBLEM_DAMAGE)) - pct(ta.get(Attr.EMBLEM_RESIST)));
  const outfit = Math.max(0.35, 1 + pct(ca.get(Attr.OUTFIT_DAMAGE)) - pct(ta.get(Attr.OUTFIT_RESIST)));
  // armor/job counters only exist between players (monsters have no armor class or job).
  // PvpDamHuiLiu (honorary title level, DC:1442-1462) is left out: not part of the ROC calculator.
  const counters = pvp ? Math.max(0.35, armorFactor(c, t) + jobCounter(c, t)) : 1;
  return base * damUpFinal * (1 + attrUp) * counters * newDamUp * soul * emblem * outfit;
}
