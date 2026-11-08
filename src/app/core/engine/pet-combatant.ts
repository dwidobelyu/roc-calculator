import { StatBonus } from '../models/master-data.models';
import { AttrSheet } from './attr-sheet';

/**
 * The pet as an attacker: port of AttributeCalculator.CalculateAttributePet (attribute_calculator.lua:2883-3058).
 * Input is the pet's raw attribute sheet, output its final attributes.
 */

/** AttributeCalculator.PetStatAmplifier (attr_job_tables.json): aptitude name -> weight per output. */
export type PetStatAmplifier = Record<string, Record<'HP' | 'SP' | 'ATK' | 'MAG' | 'DEF' | 'MDF' | 'ASPD' | 'CRIT', number>>;

/** pet-combat.json entry (public/data): a pet's base attributes, aptitudes and attack skills. */
export interface PetCombatEntry {
  id: number;
  name: string;
  entityId: number;
  race: number; size: number; element: number;
  /** Aptitude rolls (attr 373..378): min..max at adoption. */
  initialStats: { attr: number; min: number; max: number }[];
  statMax: { attr: number; max: number }[];
  baseAttrs: StatBonus[];
  levelUpGroup: number;
  normalAttackSkill: number;
  initSkills: { id: number; weight: number }[];
  /** PetRankUpTable rows; petAttrs = AdditionAttrsForPet summed up to this row. Form fields only when they change. */
  stars: { rank: number; rankUp: number; petAttrs: StatBonus[]; exclusiveSkillId?: number; normalAttackSkill?: number;
    entityId?: number; race?: number; size?: number; element?: number }[];
}

// Lua iterates ATTR_PET_STR, AGI, VIT, INT, DEX, LUK = 373..378
const APTITUDE: [string, number][] = [
  ['ATTR_PET_STR', 373], ['ATTR_PET_AGI', 374], ['ATTR_PET_VIT', 375],
  ['ATTR_PET_INT', 376], ['ATTR_PET_DEX', 377], ['ATTR_PET_LUK', 378],
];

/** Raw pet sheet: base attrs + summed level-ups (petOwnStats) + star bonuses + aptitudes (default: initial min). */
export function petRawSheet(pet: PetCombatEntry, star: number, levelUp: readonly StatBonus[], aptitude?: Record<number, number>): AttrSheet {
  const s = new AttrSheet();
  s.addAll(pet.baseAttrs);
  s.addAll(levelUp);
  const st = pet.stars[Math.min(Math.max(star, 0), pet.stars.length - 1)];
  if (st) s.addAll(st.petAttrs);
  for (const { attr, min } of pet.initialStats) s.add(attr, aptitude?.[attr] ?? min);
  return s;
}

export function petAttrs(raw: AttrSheet, amp: PetStatAmplifier): AttrSheet {
  const g = (id: number) => raw.get(id);
  const m = { HP: 1, SP: 1, ATK: 1, MAG: 1, DEF: 1, MDF: 1, ASPD: 0, CRIT: 1 };
  for (const [name, id] of APTITUDE) {
    const k = (g(id) - 500) / 1000 / 7;
    for (const key of Object.keys(m) as (keyof typeof m)[]) m[key] += k * (amp[name]?.[key] ?? 0);
  }
  const hunger = g(391) <= 0 ? 0.3 : g(391) <= 30 ? 0.7 : 1;
  const P = (id: number) => g(id) / 10000;
  const moreHp = 1 + P(435), moreSp = 1 + P(436), moreAtk = 1 + P(437), moreDef = 1 + P(438);
  // battle = equipment-style attrs; lvup = PetLevelUpAttrTable; zw = exclusive gear (ZHUANWU); temp = PetTable.BaseAttr
  const hpBase = g(379) + g(392), spBase = g(384) + g(395);
  const atkBase = g(380) + g(393), matkBase = g(381) + g(394), defBase = g(385) + g(396), mdefBase = g(386) + g(397);

  const out = new AttrSheet();
  out.set(127, ((hpBase + g(540)) * 2 + g(47)) * (1 + P(401) + P(48) + m.HP - 1) * moreHp);
  out.set(128, (spBase + g(49)) * (1 + P(404) + P(50) + m.SP - 1) * moreSp);
  out.set(117, (atkBase + g(541) + g(27) + g(421)) * (1 + P(402) + P(28) + P(422) + m.ATK - 1) * moreAtk * hunger);
  out.set(118, (matkBase + g(542) + g(36) + g(421)) * (1 + P(403) + P(37) + P(422) + m.MAG - 1) * moreAtk * hunger);
  out.set(119, (defBase + g(543) + g(32) + g(423)) * (1 + P(405) + P(33) + P(424) + m.DEF - 1) * moreDef * hunger);
  out.set(120, (mdefBase + g(544) + g(41) + g(423)) * (1 + P(406) + P(42) + P(424) + m.MDF - 1) * moreDef * hunger);
  out.set(116, g(73) * (1 + P(74)));
  out.set(93, m.ASPD * 10000 + g(71) + g(387));
  out.set(129, g(382) + g(51) + 80);
  out.set(130, g(383) + g(53));
  out.set(133, m.CRIT * (g(55) + g(388)));
  out.set(134, g(389) + g(57));
  out.set(131, out.get(127) * g(76) / 10000);
  out.set(132, out.get(128) * g(78) / 10000);
  out.set(86, (1 / (1 + P(433)) - 1) * 10000);
  out.set(427, g(65) + g(425));
  out.set(429, g(66) + g(425));
  out.set(428, g(67) + g(426));
  out.set(430, g(68) + g(426));
  // ATTR_PET_TRUE_*: same without battle / exclusive gear terms and without hunger
  out.set(411, hpBase * 2 * (1 + P(401) + m.HP - 1) * moreHp);
  out.set(414, spBase * (1 + P(404) + m.SP - 1) * moreSp);
  out.set(412, atkBase * (1 + P(402) + m.ATK - 1) * moreAtk);
  out.set(413, matkBase * (1 + P(403) + m.MAG - 1) * moreAtk);
  out.set(415, defBase * (1 + P(405) + m.DEF - 1) * moreDef);
  out.set(416, mdefBase * (1 + P(406) + m.MDF - 1) * moreDef);
  // LuaSetAttr floors every write
  for (const [id, v] of out.entries()) out.set(id, Math.floor(v));
  return out;
}
