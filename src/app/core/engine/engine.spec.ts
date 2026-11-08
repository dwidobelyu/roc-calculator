import { Attr } from '../models/attr';
import { Combatant, DamageResult } from '../models/combat.models';
import { calculateTiming } from './combat-timing';
import { canEquip, compareEquipment, jobLineIds } from './equipment-rules';
import { JobTables, SkillEntry } from '../models/master-data.models';
import { AttrSheet } from './attr-sheet';
import { calculateAttributes } from './attribute-calculator';
import { calculateDamage } from './damage/damage-calculator';
import { resolveFormula } from './damage/damage-formulas';
import { leveledOption } from './sources/stat-source';

const tables: JobTables = {
  HPNUM: { '2000': { '1': 100, '2': 0.5, '3': 20 } },
  SPNUM: { '2000': { '1': 10, '2': 0, '3': 2 } },
  EquipAspd: { '2000': { '0': 0 } },
  ArmorArray: { '2000': 0 },
};

describe('calculateAttributes', () => {
  it('derives Swordman Lv10 stats like attribute_calculator.lua', () => {
    const s = new AttrSheet();
    s.set(Attr.JOB, 2000);
    s.set(Attr.BASE_LV, 10);
    s.set(Attr.BASE_ASPD, 156);
    s.set(Attr.STR, 10); s.set(Attr.DEX, 5); s.set(Attr.LUK, 5); s.set(Attr.VIT, 1); s.set(Attr.AGI, 1); s.set(Attr.INT, 1);
    s.set(Attr.WEAPON_ATK, 40);
    s.set(Attr.WEAPON_ATK_PER, 1000); // +10%
    calculateAttributes(s, tables);
    // (STR + DEX/5 + LUK/5 + 5 + Lv/4) = 10 + 1 + 1 + 5 + 2.5
    expect(s.get(Attr.BASE_ATK_FINAL)).toBe(19);
    expect(s.get(Attr.WEAPON_ATK_FINAL)).toBe(44); // 40 * 1.1
    // HIT = (Lv+10 + DEX) + 80, FLEE = Lv + AGI
    expect(s.get(Attr.HIT_FINAL)).toBe(105);
    expect(s.get(Attr.FLEE_FINAL)).toBe(11);
    // HP = (100 + 55*0.5 + 10*20) * (1 + VIT/100) = 327.5 * 1.01
    expect(s.get(Attr.MAX_HP_FINAL)).toBe(330);
  });
});

function unit(kind: 'player' | 'monster', set: Record<number, number>, extra: Partial<Combatant> = {}): Combatant {
  const attrs = new AttrSheet();
  for (const [k, v] of Object.entries(set)) attrs.set(+k, v);
  return {
    kind, name: kind, attrs, level: 50, job: 0, race: 0, size: 0, element: 0,
    weaponType: 0, weaponElement: 0, isBoss: false, ...extra,
  };
}

const timing = {
  cooldown: 0, pvpCooldown: 0, groupCooldown: 0, pvpGroupCooldown: 0, castVar: 0, castFixed: 0, pvpCastVar: 0, pvpCastFixed: 0,
};

const normalAttack: SkillEntry = {
  id: 1, name: 'Attack', passive: false, damageType: 0, element: 0, aoe: false, affectedByAspd: true, aspdPercent: 1,
  jobIds: [], monsterIds: [],
  levels: [{ level: 1, script: 'CommonSkillCritCalc', hits: [1], pvpHits: [1], pveRatio: [10000], pvpRatio: [10000], pveFlat: [0], pvpFlat: [0], ...timing, cooldown: 1 }],
};

const magicBolt: SkillEntry = {
  id: 2, name: 'Bolt', passive: false, damageType: 2, element: 3, aoe: false, affectedByAspd: false, aspdPercent: 1,
  jobIds: [], monsterIds: [],
  levels: [{ level: 1, script: 'MagicSkillCalc', hits: [1], pvpHits: [1], pveRatio: [10000], pvpRatio: [10000], pveFlat: [0], pvpFlat: [0],
    ...timing, castFixed: 0.5, castVar: 2, groupCooldown: 1 }],
};

describe('calculateDamage', () => {
  it('normal attack vs a monster with no DEF: (2*ATK + weapon ATK) x float', () => {
    const c = unit('player', { [Attr.BASE_ATK_FINAL]: 100, [Attr.WEAPON_ATK_FINAL]: 50 });
    const t = unit('monster', {});
    const r = calculateDamage({ attacker: c, target: t, skill: normalAttack, level: normalAttack.levels[0], segment: 0, attackerCount: 1 })!;
    // core 250, DEF multiplier with 0 DEF = 1, float 0.97..1.03
    expect(r.normal.min).toBe(Math.floor(250 * 0.97));
    expect(r.normal.max).toBe(Math.floor(250 * 1.03));
    // crit x1.5
    expect(r.critical!.max).toBe(Math.floor(250 * 1.03 * 1.5));
  });

  it('element and weapon-size modifiers only scale the weapon part', () => {
    // Fire weapon (3) vs Earth target (2) = 1.75; dagger (1) vs Small (2) = 1.0, vs Large (1) = 0.75
    const c = unit('player', { [Attr.BASE_ATK_FINAL]: 100, [Attr.WEAPON_ATK_FINAL]: 100 }, { weaponType: 1, weaponElement: 3 });
    const t = unit('monster', {}, { element: 2, size: 1 });
    const r = calculateDamage({ attacker: c, target: t, skill: normalAttack, level: normalAttack.levels[0], segment: 0, attackerCount: 1 })!;
    expect(r.normal.max).toBe(Math.floor((200 + 100 * 1.75 * 0.75) * 1.03));
  });

  it('PvP applies the 0.7 normal-attack base multiplier', () => {
    const c = unit('player', { [Attr.BASE_ATK_FINAL]: 90, [Attr.WEAPON_ATK_FINAL]: 0 });
    const t = unit('player', {});
    const r = calculateDamage({ attacker: c, target: t, skill: normalAttack, level: normalAttack.levels[0], segment: 0, attackerCount: 1 })!;
    // PvP also scales status ATK by 2/3: 2 * 60 = 120
    expect(r.normal.max).toBe(Math.floor(120 * 1.03 * 0.7));
  });
});

describe('calculateTiming', () => {
  const sure = (min: number, max: number): DamageResult => ({
    formulaName: 'x', approximated: false, hits: 1, normal: { min, max }, critical: null,
    perfectHitChance: 1, hitChance: 1, critChance: 0, breakdown: [], notes: [],
  });

  it('30k damage per second against 60k HP takes 2 seconds', () => {
    const c = unit('player', { [Attr.ASPD_FINAL]: 10000 }); // 1 attack per second
    const t = unit('monster', { [Attr.MAX_HP_FINAL]: 60000 });
    const r = calculateTiming(c, t, normalAttack, normalAttack.levels[0], sure(30000, 30000), null);
    expect(r.dps).toBe(30000);
    expect(r.timeToKill).toBe(2);
    expect(r.castsToKill).toEqual({ min: 2, max: 2 });
  });

  it('applies DEX/INT cast reduction and adds the group cooldown to the cycle', () => {
    const s = new AttrSheet();
    s.set(Attr.JOB, 2000); s.set(Attr.BASE_LV, 10); s.set(Attr.BASE_ASPD, 156);
    s.set(Attr.DEX, 350); s.set(Attr.INT, 0);
    calculateAttributes(s, tables);
    const c: Combatant = { ...unit('player', {}), attrs: s };
    const t = unit('monster', { [Attr.MAX_HP_FINAL]: 1000 });
    const r = calculateTiming(c, t, magicBolt, magicBolt.levels[0], sure(100, 100), null);
    expect(r.castFixed).toBe(0); // DEX 350 removes fixed cast (FightAttr.lua + AC:2658)
    expect(r.castVariable).toBe(2); // INT 0 keeps variable cast
    expect(r.cycleTime).toBe(3); // 2 s cast + 1 s group cooldown
    // 1000 HP at 100 per cast: 10 casts = 9 full cycles + the last cast
    expect(r.timeToKillRange.min).toBe(9 * 3 + 2);
  });

  it('a one-shot skill still needs its cast time', () => {
    const c = unit('player', { [Attr.ASPD_FINAL]: 10000 });
    const t = unit('monster', { [Attr.MAX_HP_FINAL]: 10 });
    const r = calculateTiming(c, t, magicBolt, magicBolt.levels[0], sure(500, 500), null);
    expect(r.timeToKill).toBe(2.5);
  });
});

describe('equipment rules', () => {
  const jobs = [
    { id: 1000, parent: 0 }, { id: 3000, parent: 1000 }, { id: 3101, parent: 3000 }, { id: 7000, parent: 1000 },
  ].map((j) => ({ ...j, name: '', code: '', commonAttackSkill: 0, skillIds: [] }));
  const bow = { id: 1, name: 'Bow', slot: 1, slotName: 'Weapon', holeNum: 0, profession: [[7000, 0]] as [number, number][] };
  const rod = { id: 2, name: 'Rod', slot: 1, slotName: 'Weapon', holeNum: 0, profession: [[3000, 0]] as [number, number][] };

  it('a Priest cannot wear a bow but can wear Acolyte-line gear', () => {
    const priest = jobLineIds(jobs, 3101);
    expect(canEquip(bow, priest)).toBe(false);
    expect(canEquip(rod, priest)).toBe(true);
    expect(canEquip({ ...bow, profession: undefined }, priest)).toBe(true);
  });

  it('lists seasonal Divine Armament first, newest season on top', () => {
    const list = [rod, { ...bow, season: 1, tier: 1 }, { ...bow, id: 3, season: 5, tier: 2 }].sort(compareEquipment);
    expect(list.map((e) => e.id)).toEqual([3, 1, 2]);
  });
});

describe('resolveFormula', () => {
  it('uses the exact port when one exists and falls back by damage type otherwise', () => {
    expect(resolveFormula('MagicSkillCalc', 2)).toEqual(expect.objectContaining({ approximated: false }));
    // ShuangBeiTouZhi (Fire Bolt) now has its own port; an unknown script still falls back by damage type
    expect(resolveFormula('ShuangBeiTouZhi', 2).approximated).toBe(false);
    expect(resolveFormula('SomeUnportedScript', 2).formula?.script).toBe('MagicSkillCalc');
    expect(resolveFormula('SomeUnportedScript', 2).approximated).toBe(true);
    expect(resolveFormula('DamageNil', 1).formula).toBeNull();
  });
});

describe('leveledOption', () => {
  it('uses the highest listed level at or below the chosen one (sparse tables)', () => {
    const o = leveledOption('x', 'X', [
      { level: 0, attrs: [] },
      { level: 3, attrs: [{ attr: 27, value: 2 }] },
      { level: 6, attrs: [{ attr: 27, value: 3 }] },
    ]);
    expect(o.resolve(5)).toEqual([{ attr: 27, value: 2 }]);
    expect(o.max).toBe(6);
  });
});
