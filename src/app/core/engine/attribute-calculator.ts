import { Attr, pct } from '../models/attr';
import { JobTables } from '../models/master-data.models';
import { AttrSheet } from './attr-sheet';

/**
 * Port of AttributeCalculator.CalculateAttribute (attribute_calculator.lua:2445-2881).
 * Reads input attributes from the sheet and writes the *_FINAL outputs back into it.
 * Port of attribute_calculator.lua. Outputs are floored like the game's write-back.
 */
export function calculateAttributes(s: AttrSheet, jobTables: JobTables, opts: { offhandWeaponType?: number } = {}): void {
  const g = (id: number) => s.get(id);
  const job = normalizeJob(g(Attr.JOB));
  const lv = g(Attr.BASE_LV);

  // 2.2 job base values (monsters and non-job units have job <= 10 and get none)
  const isJob = job > 10;
  const hp = jobTables.HPNUM[job];
  const sp = jobTables.SPNUM[job];
  const baseHp = isJob && hp ? hp['1'] + ((lv + 1) * lv / 2) * hp['2'] + lv * hp['3'] : 0;
  const baseSp = isJob && sp ? sp['1'] + lv * sp['3'] : 0;
  const baseAtk = isJob ? 5 : 0;
  const baseMatk = isJob ? 5 : 0;
  const baseHit = isJob ? lv + 10 : 0;
  const baseFlee = isJob ? lv : 0;

  // 2.3 final six stats
  const stat = (base: number, eq: number, per: number) =>
    Math.max(base * (1 + pct(per)), 0) + Math.max(eq * (1 + pct(per)), 0);
  const STR = stat(g(Attr.STR), g(Attr.STR_EQUIP), g(294));
  const INT = stat(g(Attr.INT), g(Attr.INT_EQUIP), g(295));
  const AGI = stat(g(Attr.AGI), g(Attr.AGI_EQUIP), g(296));
  const DEX = stat(g(Attr.DEX), g(Attr.DEX_EQUIP), g(297));
  const VIT = stat(g(Attr.VIT), g(Attr.VIT_EQUIP), g(298));
  const LUK = stat(g(Attr.LUK), g(Attr.LUK_EQUIP), g(299));

  // 2.4 ATK (Archer and Gunslinger lines swap STR and DEX)
  const atkPer = g(Attr.WEAPON_ATK_PER) + g(Attr.WEAPON_BOTH_PER);
  const ranged = (job >= 7000 && job < 8000) || (job >= 9000 && job < 10000);
  const main = ranged ? DEX : STR;
  const sub = ranged ? STR : DEX;
  const atkBase =
    (main + sub / 5 + LUK / 5 + baseAtk + lv / 4 + g(Attr.BASE_ATK)) * (1 + pct(g(Attr.BASE_ATK_PER))) +
    g(Attr.MEDAL_ATK) * (1 + pct(g(Attr.MEDAL_ATK_PER)));
  const atkWeap =
    (g(Attr.WEAPON_ATK) + g(Attr.WEAPON_BOTH) +
      g(Attr.WEAPONEX_ATK) * (1 + pct(g(Attr.WEAPONEX_ATK_PER)) + main / 200) + g(Attr.MERC_ATK)) *
    Math.max(1 + pct(atkPer), 0.01);

  // 2.5 MATK (base MATK is scaled by MATK%, unlike ATK)
  const matkPer = g(Attr.WEAPON_MATK_PER) + g(Attr.WEAPON_BOTH_PER);
  const matkMul = Math.max(1 + pct(matkPer), 0.01);
  const matkBase =
    ((INT * 1.5 + DEX / 5 + LUK / 3 + baseMatk + lv / 4 + g(Attr.BASE_MATK)) * (1 + pct(g(Attr.BASE_MATK_PER))) +
      g(Attr.MEDAL_MATK) * (1 + pct(g(Attr.MEDAL_MATK_PER)))) * matkMul;
  const matkWeap =
    (g(Attr.WEAPON_MATK) + g(Attr.WEAPON_BOTH) + g(Attr.WEAPONEX_MATK) * (1 + pct(g(Attr.WEAPONEX_MATK_PER))) +
      g(Attr.MERC_MATK)) * matkMul;

  // 2.6 DEF / MDEF
  const defBase = Math.max(((lv + VIT) / 2 + AGI / 5 + g(Attr.BASE_DEF)) * (1 + pct(g(Attr.BASE_DEF_PER))), 0);
  const mdefBase = Math.max(
    (lv / 4 + INT + VIT / 5 + DEX / 5 + g(Attr.BASE_MDEF)) * (1 + pct(g(Attr.BASE_MDEF_PER))), 0);
  const defEquip = Math.max(
    (g(Attr.DEF) + g(Attr.DEF_BOTH) + g(Attr.SHIELD_DEF)) * (1 + pct(g(Attr.DEF_PER) + g(Attr.DEF_BOTH_PER))), 0);
  const mdefEquip = Math.max(
    (g(Attr.MDEF) + g(Attr.DEF_BOTH)) * (1 + pct(g(Attr.MDEF_PER) + g(Attr.DEF_BOTH_PER))), 0);

  // 2.8 HP / SP
  const maxHp = (baseHp * (1 + VIT / 100) + g(Attr.MAX_HP) + g(Attr.MEDAL_HP) * (1 + pct(g(Attr.MEDAL_HP_PER))) +
    g(Attr.MERC_HP)) * (1 + pct(g(Attr.MAX_HP_PER)));
  const maxSp = (baseSp * (1 + INT / 100) + g(Attr.MAX_SP) + g(Attr.MEDAL_SP) * (1 + pct(g(Attr.MEDAL_SP_PER)))) *
    (1 + pct(g(Attr.MAX_SP_PER)));

  // 2.9 HIT / FLEE / CRIT (katar doubles CRIT)
  const hit = Math.max((baseHit + g(Attr.HIT) + DEX) * (1 + pct(g(Attr.HIT_PER))) + 80, 0);
  const flee = Math.max((baseFlee + g(Attr.FLEE) + AGI) * (1 + pct(g(Attr.FLEE_PER))), 0);
  let cri = Math.max(g(Attr.CRI) * (1 + pct(g(Attr.CRI_PER))) + LUK / 3, 0);
  if (g(Attr.WEAPON_TYPE) === 16) cri *= 2;
  const criRes = Math.max(g(Attr.CRI_RES) * (1 + pct(g(Attr.CRI_RES_PER))) + LUK / 5, 0);

  // 2.10 ASPD
  const aspd = attackSpeed(job, g(Attr.WEAPON_TYPE), opts.offhandWeaponType ?? 0, AGI, DEX, s, jobTables);

  // 2.11 cast time: (1 + final%) = (1 + gear%) * (1 - sqrt(stat/350)); DEX for fixed, INT for variable cast
  const ctFixPer = g(Attr.CT_FIXED_PER);
  const ctVarPer = Math.max(g(Attr.CT_CHANGE_PER), -10000);
  const dexCut = Math.sqrt(Math.max(DEX, 0) / 350), intCut = Math.sqrt(Math.max(INT, 0) / 350);
  const ctFixFinal = Math.max(ctFixPer - dexCut * 10000 - dexCut * ctFixPer, -10000);
  const ctVarFinal = Math.max(ctVarPer - intCut * 10000 - intCut * ctVarPer, -10000);

  // 2.12 saturating penetration / resilience curve
  const sat = (x: number, k: number) => (x ? ((x * 8) / (x * 7 + k)) * 10000 : 0);

  const out: [number, number][] = [
    [Attr.STR_FINAL, STR], [Attr.INT_FINAL, INT], [Attr.AGI_FINAL, AGI],
    [Attr.DEX_FINAL, DEX], [Attr.VIT_FINAL, VIT], [Attr.LUK_FINAL, LUK],
    [Attr.BASE_ATK_FINAL, atkBase], [Attr.WEAPON_ATK_FINAL, atkWeap], [Attr.WEAPON_ATK_PER_FINAL, atkPer],
    [Attr.BASE_MATK_FINAL, matkBase], [Attr.WEAPON_MATK_FINAL, matkWeap], [Attr.WEAPON_MATK_PER_FINAL, matkPer],
    [Attr.BASE_DEF_FINAL, defBase], [Attr.BASE_MDEF_FINAL, mdefBase],
    [Attr.DEF_FINAL, defEquip], [Attr.MDEF_FINAL, mdefEquip],
    [Attr.TOTAL_REFINE, g(Attr.REFINE) * Math.max(1 + pct(atkPer), 0.01)],
    [Attr.TOTAL_MREFINE, g(Attr.MREFINE) * matkMul],
    [Attr.MAX_HP_FINAL, maxHp], [Attr.MAX_SP_FINAL, maxSp],
    [Attr.HIT_FINAL, hit], [Attr.FLEE_FINAL, flee], [Attr.CRI_FINAL, cri], [Attr.CRI_RES_FINAL, criRes],
    [Attr.ASPD_FINAL, aspd * 10000],
    [Attr.CT_FIXED_FINAL, g(Attr.CT_FIXED)], [Attr.CT_CHANGE_FINAL, g(Attr.CT_CHANGE)],
    [Attr.CT_FIXED_PER_FINAL, ctFixFinal], [Attr.CT_CHANGE_PER_FINAL, ctVarFinal],
    [Attr.DAM_INCREASE_FINAL, g(Attr.DAM_INCREASE) + g(Attr.BOTH_INCREASE)],
    [Attr.DAM_REDUC_FINAL, g(Attr.DAM_REDUC) + g(Attr.BOTH_REDUC)],
    [Attr.MDAM_INCREASE_FINAL, g(Attr.MDAM_INCREASE) + g(Attr.BOTH_INCREASE)],
    [Attr.MDAM_REDUC_FINAL, g(Attr.MDAM_REDUC) + g(Attr.BOTH_REDUC)],
    [Attr.BOSS_RES_FINAL, g(Attr.BOSS_RES) + g(Attr.PLAYER_BOSS_RES)],
    [Attr.MONSTER_RES_FINAL, g(Attr.MONSTER_RES) + g(Attr.PLAYER_MONSTER_RES)],
    [Attr.DEEPEN_FINAL, sat(g(Attr.DEEPEN), 6000)], [Attr.RELIEF_FINAL, sat(g(Attr.RELIEF), 8000)],
    [Attr.MDEEPEN_FINAL, sat(g(Attr.MDEEPEN), 6000)], [Attr.MRELIEF_FINAL, sat(g(Attr.MRELIEF), 8000)],
  ];
  for (const [id, v] of out) s.set(id, Math.floor(v));
  if (isJob) s.set(Attr.ARMOR, jobTables.ArmorArray[job] ?? 0);
}

/** Class-trial job ids collapse to their 1st-class root (AC:2487-2509). */
export function normalizeJob(job: number): number {
  const roots: [number, number[]][] = [
    [2000, [1102000, 1202000, 1302000, 1402000]],
    [3000, [1103000, 1203000, 1303000, 1403000, 1503000]],
    [4000, [1104000, 1204000, 1304000, 1404000]],
    [5000, [1105000, 1205000, 1305000, 1405000]],
    [6000, [1106000, 1206000, 1306000]],
    [7000, [1107000, 1207000, 1307000, 1407000]],
  ];
  return roots.find(([, ids]) => ids.includes(job))?.[0] ?? job;
}

/** Attacks per second (AC:2676-2734), including the shield and Thief-line dual-wield adjustments. */
function attackSpeed(job: number, weaponType: number, offhand: number, AGI: number, DEX: number, s: AttrSheet, t: JobTables): number {
  const base = s.get(Attr.BASE_ASPD);
  if (job <= 10) return Math.min(5, (50 / (200 - base)) * (1 + pct(s.get(Attr.EQUIP_ASPD_PER))));
  let pen1 = weaponType ? (t.EquipAspd[job]?.[weaponType] ?? 0) : 0;
  // only a shield off-hand slows attacks; Thief-line dual wield eases the main-hand penalty (AC:2683-2692)
  const pen2 = offhand === 17 ? (t.EquipAspd[job]?.[17] ?? 0) : 0;
  if (job >= 5000 && job < 6000) {
    if (offhand === 1) pen1 -= 10;
    else if (offhand === 2 || offhand === 6) pen1 -= 12;
  }
  const chengfa = base > 145 ? 1 - (base + pen1 - 144) / 50 : 0.96;
  const equipPer = Math.min(s.get(Attr.EQUIP_ASPD_PER), 10000);
  const jiaoyan = (Math.sqrt(205) - Math.sqrt(AGI)) / 7.15;
  const jichu = 200 - (200 - (base + pen1 + pen2 - jiaoyan + Math.sqrt(AGI * 9.999 + DEX * 0.19212) * chengfa)) *
    (1 - Math.min(pct(s.get(Attr.SKILL_ASPD_PER)), 0.35));
  const zhuangbei = ((195 - jichu) * equipPer) / 10000;
  const aspdInt = Math.min(Math.max(Math.floor((jichu + zhuangbei + s.get(Attr.EQUIP_ASPD)) * 1000) / 1000, 33), 190);
  return 50 / (200 - aspdInt);
}
