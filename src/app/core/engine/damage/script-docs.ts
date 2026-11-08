import { DamageFormula, resolveFormula } from './damage-formulas';
import { MONSTER_SCRIPT_DOCS } from './special/monster-docs';

/**
 * Plain-words summary of each DamageCalculator.<script> in damage_calculator.lua (DC), as ported in this app.
 * `skipped` lists what the port does not compute. `line` is the Lua line of the script.
 */
export interface ScriptDoc {
  summary: string;
  skipped?: string;
  line: number;
}

const CORE = '(2 x status ATK + weapon ATK x size, element, race/size/element % bonuses) x skill ratio x hard DEF x target-class bonus, minus soft DEF, x damage float, + flat damage, x PvE/PvP multiplier';

export const SCRIPT_DOCS: Readonly<Record<string, ScriptDoc>> = {
  ...MONSTER_SCRIPT_DOCS,
  // Generic
  CommonSkillCritCalc: { line: 1709, summary: `Normal attack. ${CORE}. Can crit (x1.5 x crit damage %). Uses the normal hit/flee roll.` },
  PhysicalSkillCalc: { line: 1801, summary: `Physical skill. ${CORE}. Never crits; uses the skill hit/flee roll.` },
  PhysicalSkillCalcCanCri: { line: 2072, summary: `Physical skill that can crit. ${CORE}. Crit chance = CRIT x cripara + cripro - target CRIT RES (PVEConfigData).` },
  PhysicalSkillCalcReal: { line: 2246, summary: 'Physical "true" damage: same core but ignores hard DEF, soft DEF and the PvE/PvP multiplier.' },
  MagicSkillCalc: { line: 2273, summary: 'Spell. (MATK + weapon MATK) x race/size/element % x element table x skill ratio x hard MDEF x target-class bonus, minus soft MDEF. No crit, no flee roll.' },

  // Physical
  PhysicalSkillCalcStr: { line: 13568, summary: 'Generic physical with skill ratio x (1 + STR / 500).' },
  ShieldCommon: { line: 11503, summary: 'Generic physical plus the shield ATK part.', skipped: 'Shield ATK (taken as 0).' },
  ShieldCommonHMT: { line: 11557, summary: 'Shield skill: skill ratio x (1 + 1.5 x VIT / (VIT + 200)).' },
  ShieldBoomerangHMT: { line: 11289, summary: 'Shield Boomerang: skill ratio x (1 + 1.5 x VIT / (VIT + 200)).' },
  HolyCross: { line: 11145, summary: 'Holy Cross: skill ratio x 2 with a two-handed spear (weapon type 5); ignores DEF.' },
  HolyCrossHMT: { line: 11177, summary: 'Holy Cross (HMT): skill ratio x 2 with a two-handed spear; hard DEF applies.' },
  OccultImpaction: { line: 9541, summary: 'Investigate: skill ratio + target DEF / 200 (more DEF, more damage); no flee roll.' },
  LianCiGongJi: { line: 9018, summary: 'Pierce: hits by target size (Medium 2, Large 3, Small 1); damage x hits.' },
  JianDingDaJi: { line: 10416, summary: 'Skill ratio x (1 + VIT / 300).' },
  ClashingSpiral: { line: 18040, summary: 'Clashing Spiral: generic physical with size modifier 1.25 against Small.' },
  ChainCrushCombo: { line: 9746, summary: 'Chain Crush Combo: skill ratio x (1 + 15% per spirit sphere above 2, max 3).' },
  ThrowSpiritSphere: { line: 9664, summary: 'Throw Spirit Sphere: damage x spirit spheres; no flee roll.' },
  SoulDestroyerHMT: { line: 9999, summary: 'Soul Breaker: physical part + INT x 5 x ratio magic part; damage deepen averaged; x0.5 in PvP.' },
  QiangSuanGongJi: { line: 11994, summary: 'Acid Terror: generic physical.' },
  QiangSuanHuoYanPingHMT: { line: 12197, summary: 'Acid Demonstration: (2 x ATK + weapon ATK) x (1 + target VIT / vitpara) x modifiers x ratio; magic multiplier chain.' },
  EmohuoyanPhy: { line: 12308, summary: 'Demonic Fire: physical parts.', skipped: 'Only parts 2 and 3 are computed.' },
  AsuraStrikeHMT: { line: 9618, summary: 'Asura Strike: skill ratio x (160 + current SP / 20) / 10; ignores hard DEF, soft DEF still subtracted.', skipped: 'Shield bonus buffs 72481/72482.' },
  CarSkill3Turn: { line: 13409, summary: 'Cart Spurt: generic physical.' },
  LuoChaPoHuangQuan: { line: 16059, summary: 'Gate of Hell: generic physical.' },
  QianCeHuaPhysicalSkillCalc: { line: 16775, summary: 'Front Slide: generic physical.' },
  StableElementDamage: { line: 2654, summary: 'Envenom: flat x (min(45, level) - 10) + 50, x element table, minus soft DEF.' },
  ZhongJi: { line: 4048, summary: 'Smite: flat damage; 0 against race 10; no damage float or PvP chain.' },
  ShanDianChongJi: { line: 18141, summary: 'Blitz Beat: (80 + 2 x DEX / 3 + INT + ATK) x modifiers x ratio; element bonus capped at 1.3; DEF only in PvP.' },
  SniperStrike: { line: 10134, summary: 'Sniping Shot: generic physical with the normal flee and crit roll.' },

  // Magic
  ShuangBeiTouZhi: { line: 13033, summary: 'Bolt spells: generic magic per bolt; part 2 is the Double Cast echo (DAMPer, +25% PvE), part 3 a second echo with buff 62702.', skipped: 'Buff 6239 blocking the echoes; buff 202683 random damage roll.' },
  SNShuangBeiTouZhi: { line: 13148, summary: 'Novice bolts: generic magic; part 2 is an echo at 15% + 5% per level of buff 1010434, part 3 deals nothing.' },
  LeiMingShu: { line: 10491, summary: 'Jupitel Thunder: generic magic.' },
  WaterBall: { line: 4113, summary: 'Water Ball: generic magic.' },
  Holyzhaohuan: { line: 4072, summary: 'Soul Strike: flat 40; the table flat value is a % bonus against Undead.' },
  LingHunBaoFaCalc: { line: 3799, summary: 'Soul Expansion: generic magic; part N + 1 needs N + 1 spirits; x1.25 against a target in White Imprison.' },
  ZhuanShengShu: { line: 8953, summary: 'Turn Undead: damage only against Undead; no PvP chain.' },
  ShenPan: { line: 11067, summary: 'Judex: generic magic; part 2 needs buff 4102330; buff 4110240 halves part 1 and enables part 3; buff 4110080 doubles an element advantage.', skipped: 'EQUIP_SZJY random bonus.' },
  XuWuZhiJian: { line: 12974, summary: 'Void Bolt: skill ratio + min(current SP / 10000, 1) x 8; uses the skill flee roll.' },
  JingShenHaoRuo: { line: 13001, summary: 'Weaken Mind: skill ratio x (2 - target current SP %).' },
  StaveCrasher: { line: 9835, summary: 'Magic Crasher: MATK against physical DEF; physical multiplier chain.' },
  GrandCross: { line: 11209, summary: 'Grand Cross: half of (ATK x DEF + weapon ATK x size x DEF + MATK x MDEF) x modifiers x ratio.' },
  ShuShiMagicCri: { line: 14826, summary: 'Chili Spear: generic magic; crits (CRIT x 1) only with buff 8510.' },
  MagicSkillCalcShengQiang: { line: 2463, summary: 'Summon spells: generic magic; part 1 of skills 420310-420320 needs the owner buff 4203168.', skipped: 'Owner element-resource stacks.' },

  // Physical with crit
  YouXiaSkillCalcCri: { line: 13324, summary: 'Generic physical; crit para 0.6 with its crit buff, 1 with the upgrade buff.' },
  ReLiPenSheCalcCri: { line: 13370, summary: 'Generic physical; crit para 0.6 (0.7 upgraded) when the target has buff 5073 and the caster buff 4202341.', skipped: 'Cart-weight flat damage.' },
  JiSuChuoCi: { line: 13437, summary: 'Generic physical; crit para 0.7 with buff 21037.' },
  HuangJiaWeiShiSkillCalcCri: { line: 13467, summary: 'Generic physical (Royal Guard); crit para 1 with buff 4203152.' },
  XiuLuoSkillCalcCri: { line: 13503, summary: 'Generic physical (Sura); crit para 1 with buff 4203137.', skipped: 'Per-stack ratio (its config param is not in the data).' },
  AnCiCalcCri: { line: 15820, summary: 'Generic physical; crit para 1 with buff 3218.' },
  YinSuTouZhi: { line: 8683, summary: 'Sonic Blow: generic physical; crit chance from cripro / cripara.' },
  ShenHongQieGe: { line: 8732, summary: 'Red Cut: generic physical; with buff 4102412 it can crit (cripro/cripara).', skipped: 'Its own crit multiplier 1.2 x (1 + 0.3 x crit damage); the generic one is shown.' },
  LieYingTuJi2: { line: 18276, summary: 'Falcon Assault: skill ratio + DEX x 0.15 (PvE) or a DEX-difference curve (PvP); crit pro 1, para 1.' },
  ZhaDanLaJiao: { line: 14856, summary: 'Chili Bomb: damage x buff 8502 stacks (+5 with buff 4203127) x 0.8; crits only with buff 8510.' },

  // Normal attacks
  ErDaoLianJi: { line: 7897, summary: 'Thief-line normal attack: second hit at half weapon ATK.', skipped: 'Katar second hit needs Double Attack.' },
  CCErDaoLianJi: { line: 17901, summary: 'Novice normal attack.' },
  CrusaderCommonSkillCritCalcHMT: { line: 11727, summary: 'Crusader normal attack (generic normal attack core).' },

  // Pet
  PetCommonPhyCrit: { line: 13857, summary: 'Pet physical: 2 x (status ATK x modifiers x ratio x DEF x target-class bonus); no weapon part, no soft DEF.' },
  PetCommonMagCrit: { line: 13886, summary: 'Pet magic: 2 x (status MATK x modifiers x ratio x MDEF x target-class bonus); no weapon part, no soft MDEF.' },
};

export interface ScriptInfo {
  script: string;
  /** ported: exact port; approximated: no port, computed with the generic formula formula.script; none: no damage. */
  status: 'ported' | 'approximated' | 'none';
  formula: DamageFormula | null;
  doc?: ScriptDoc;
}

/** What the app does with a skill's damage script. */
export function describeScript(script: string, damageType: number): ScriptInfo {
  const { formula, approximated } = resolveFormula(script, damageType);
  if (!formula) return { script, status: 'none', formula };
  return { script, status: approximated ? 'approximated' : 'ported', formula, doc: SCRIPT_DOCS[formula.script] };
}
