import { Attr } from '../models/attr';
import { emptyBuild } from '../models/build.models';
import { Combatant } from '../models/combat.models';
import { JobTables, SkillEntry } from '../models/master-data.models';
import type { Catalog } from '../services/catalog.service';
import { AttrSheet } from './attr-sheet';
import { calculateAttributes } from './attribute-calculator';
import { applyAttrLimits } from './combatant-factory';
import { calculateDamage } from './damage/damage-calculator';
import { globalMultiplier } from './damage/damage-modifiers';
import { FeatherKind } from './feathers';
import { FeatherSuitData, GearSetTier, bestTier, featherSetBonuses, gearSetBonuses } from './set-bonuses';

const unit = (kind: 'player' | 'monster', set: Record<number, number>, extra: Partial<Combatant> = {}): Combatant => {
  const attrs = new AttrSheet();
  for (const [k, v] of Object.entries(set)) attrs.set(+k, v);
  return { kind, name: kind, attrs, level: 99, job: 0, race: 1, size: 0, element: 0, weaponType: 0, weaponElement: 0, isBoss: false, ...extra };
};

describe('gear sets', () => {
  const tiers: GearSetTier[] = [
    { id: 1, name: 'Echo I', pieces: 6, threshold: 30, attrs: [{ attr: 27, value: 10 }] },
    { id: 2, name: 'Echo II', pieces: 6, threshold: 40, attrs: [{ attr: 27, value: 20 }] },
  ];
  it('picks the highest tier whose piece count is met', () => {
    expect(bestTier(tiers, [40, 40, 40, 40, 40, 40, 0])?.name).toBe('Echo II');
    expect(bestTier(tiers, [40, 40, 40, 40, 40, 35])?.name).toBe('Echo I');
    expect(bestTier(tiers, [40, 40, 40, 40, 40])).toBeUndefined();
  });

  it('refine set ignores Trolley and Battle Bird and labels the pieces met', () => {
    const cat = { refineSets: [{ id: 1, name: 'Refine +10', pieces: 6, threshold: 10, attrs: [] }], enhanceSets: [], enchantSets: [], equipBuffAttrs: new Map() } as unknown as Catalog;
    // Weapon..Boots (5 pieces) + Trolley + Battle Bird at +10
    const wear = (slots: number[]) => ({
      ...emptyBuild(),
      equipment: emptyBuild().equipment.map((s) => (slots.includes(s.slot) ? { ...s, equipId: 1, refine: 10 } : s)),
    });
    expect(gearSetBonuses(wear([1, 2, 3, 4, 5, 12, 14]), cat)).toEqual([]);
    expect(gearSetBonuses(wear([1, 2, 3, 4, 5, 7]), cat)[0].label).toBe('Refine set: Refine +10 (6/6 at +10)');
  });
});

describe('feather sets', () => {
  const kind = (id: number, color: number): FeatherKind => ({
    id, name: `K${id}`, type: 'ATK', quality: 2, color, levelCap: [[99, 20]],
    levels: Array.from({ length: 20 }, (_, i) => ({ level: i + 1, attrs: [{ attr: 421, value: (i + 1) * 10 }] })),
  });
  const suits: FeatherSuitData = {
    classes: { 1: [421] },
    suits: [
      { id: 1, name: 'Pair', hole: 2, colors: { 1: 1, 2: 1 }, levels: [{ level: 5, attack: [[0, 47, 100]], defense: [], mix: [] }] },
      { id: 2, name: 'Trio', hole: 3, colors: { 2: 3 }, levels: [{ level: 5, attack: [[5, 1, 1000]], defense: [], mix: [] }] },
    ],
  };
  const cat = (kinds: FeatherKind[]) => ({ featherById: new Map(kinds.map((k) => [k.id, k])), featherSuits: suits } as unknown as Catalog);

  it('matches colours, uses the lowest feather level and scales the class by type-5 entries', () => {
    const feathers = Array.from({ length: 10 }, () => null) as ({ kindId: number; level: number } | null)[];
    feathers[0] = { kindId: 1, level: 5 };
    feathers[1] = { kindId: 2, level: 7 };
    feathers[2] = { kindId: 3, level: 9 };
    const build = { ...emptyBuild(), baseLevel: 99, feathers };
    // three colour-2 feathers -> "Trio" at the lowest level (5): +10% of the three feathers' attr 421 (50, 70, 90)
    const [set] = featherSetBonuses(build, cat([kind(1, 2), kind(2, 2), kind(3, 2)]));
    expect(set.label).toBe('Attack feather set: Trio Lv.5');
    expect(set.attrs).toEqual([{ attr: 421, value: 5 }, { attr: 421, value: 7 }, { attr: 421, value: 9 }]);
  });
});

describe('attribute caps (AttrLimitTable)', () => {
  it('caps Ignore PDEF % at 40% and cast reduction at -60%', () => {
    const s = new AttrSheet();
    s.set(44, 5000);
    s.set(301, -9000);
    applyAttrLimits(s, [
      { attr: 44, max: 4000, min: 0, control: 0 },
      { attr: 301, max: 0, min: -6000, control: 1 },
    ]);
    expect(s.get(44)).toBe(4000);
    expect(s.get(301)).toBe(-6000);
  });
});

describe('PvP counters', () => {
  it('armor class counter and job counter scale player vs player damage', () => {
    // Heavy (1) vs Leather (2): armor_dam = 1.2 -> RESTRAIN_DAMUP applies; +10% vs Leather (attr 492)
    const c = unit('player', { [Attr.ARMOR]: 1, [Attr.RESTRAIN_DAMUP]: 500, 492: 1000, 509: 2000 }, { job: 2101 });
    const t = unit('player', { [Attr.ARMOR]: 2 }, { job: 3101 });
    const base = globalMultiplier(unit('player', {}), unit('player', {}), 'physical');
    // 0.6 PvP base x (armor 1 + 0.05 + 0.10 + job vs group 31: 0.20)
    expect(globalMultiplier(c, t, 'physical')).toBeCloseTo(base * 1.35, 10);
  });
});

describe('off-hand ASPD', () => {
  const tables: JobTables = {
    HPNUM: { 2000: { 1: 100, 2: 0, 3: 0 } }, SPNUM: { 2000: { 1: 10, 2: 0, 3: 0 } },
    EquipAspd: { 2000: { 2: -7, 17: -5 } }, ArmorArray: { 2000: 0 },
  };
  it('a shield in the off-hand lowers attacks per second', () => {
    const make = (offhand: number) => {
      const s = new AttrSheet();
      s.set(Attr.JOB, 2000); s.set(Attr.BASE_LV, 50); s.set(Attr.BASE_ASPD, 156); s.set(Attr.WEAPON_TYPE, 2);
      s.set(Attr.AGI, 50); s.set(Attr.DEX, 30);
      calculateAttributes(s, tables, { offhandWeaponType: offhand });
      return s.get(Attr.ASPD_FINAL);
    };
    expect(make(17)).toBeLessThan(make(0));
  });
});

describe('multi-part skills', () => {
  const twoPart: SkillEntry = {
    id: 9, name: 'Two part', passive: false, damageType: 1, element: 0, aoe: false, affectedByAspd: false, aspdPercent: 1,
    jobIds: [], monsterIds: [],
    levels: [{ level: 1, script: 'PhysicalSkillCalc', hits: [1, 1], pvpHits: [1, 1], pveRatio: [10000, 20000], pvpRatio: [10000, 20000],
      pveFlat: [0, 0], pvpFlat: [0, 0], cooldown: 0, pvpCooldown: 0, groupCooldown: 0, pvpGroupCooldown: 0, castVar: 0,
      castFixed: 0, pvpCastVar: 0, pvpCastFixed: 0 }],
  };
  it("'all' adds every part's min and max", () => {
    const c = unit('player', { [Attr.BASE_ATK_FINAL]: 100 });
    const t = unit('monster', {});
    const req = { attacker: c, target: t, skill: twoPart, level: twoPart.levels[0], attackerCount: 1 };
    const p0 = calculateDamage({ ...req, segment: 0 })!, p1 = calculateDamage({ ...req, segment: 1 })!;
    const all = calculateDamage({ ...req, segment: 'all' })!;
    expect(all.normal).toEqual({ min: p0.normal.min + p1.normal.min, max: p0.normal.max + p1.normal.max });
    expect(all.hits).toBe(2);
  });
});

describe('fight-temp keys in the damage math', () => {
  const attack: SkillEntry = {
    id: 1, name: 'Attack', passive: false, damageType: 0, element: 0, aoe: false, affectedByAspd: true, aspdPercent: 1,
    jobIds: [], monsterIds: [],
    levels: [{ level: 1, script: 'CommonSkillCritCalc', hits: [1], pvpHits: [1], pveRatio: [10000], pvpRatio: [10000],
      pveFlat: [0], pvpFlat: [0], cooldown: 1, pvpCooldown: 1, groupCooldown: 0, pvpGroupCooldown: 0, castVar: 0,
      castFixed: 0, pvpCastVar: 0, pvpCastFixed: 0 }],
  };
  const run = (c: Combatant, t: Combatant) =>
    calculateDamage({ attacker: c, target: t, skill: attack, level: attack.levels[0], segment: 'all', attackerCount: 1 })!;

  it('race-add snapshot raises the weapon part like race damage %', () => {
    const plain = run(unit('player', { [Attr.WEAPON_ATK_FINAL]: 100 }), unit('monster', {}));
    const boosted = run(unit('player', { [Attr.WEAPON_ATK_FINAL]: 100 }, { fightTemp: { EQUIP_COMMEN_RACEADD_SNAPSHOT: 2000 } }), unit('monster', {}));
    expect(boosted.normal.max).toBe(Math.floor(plain.normal.max * 1.2));
  });

  it("a target's block rate lowers the hit chance", () => {
    const r = run(unit('player', { [Attr.HIT_FINAL]: 1000 }), unit('player', {}, { fightTemp: { SKILL_COMMON_BLOCK: 2500 } }));
    expect(r.hitChance).toBeCloseTo(0.75, 5);
  });
});
