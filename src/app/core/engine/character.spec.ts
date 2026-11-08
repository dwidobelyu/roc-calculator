import { emptyBuild } from '../models/build.models';
import type { Catalog } from '../services/catalog.service';
import { characterContributions, petContributions } from './combatant-factory';
import { FEATHER_SLOTS, FeatherKind, featherLevel, featherMaxLevel } from './feathers';
import { MountEntry, defaultMount, mountsForJob } from './mounts';
import { PET_MAX_LEVEL, PetEntry, PetLevelData, petOwnStats } from './pets';

const mount = (id: number, name: string, vehicleType: number, jobLimit: number[]): MountEntry =>
  ({ id, name, vehicleType, jobLimit, attrs: [{ attr: 27, value: id % 100 }] });
const alpaca = mount(1020001, 'Alpaca', 1, [3000, 3101, 3102]);
const lion = mount(1020019, 'Lion', 1, [2000, 2101]);
const peco = mount(1020013, 'Peco Peco', 3, [2101]);
const boat = mount(1021112, 'Dragon Boat', 2, []);
const mounts = [alpaca, lion, peco, boat];

describe('mounts follow the job', () => {
  it('a Priest gets the Alpaca by default and cannot ride a Peco Peco', () => {
    expect(defaultMount(mounts, 3101)?.name).toBe('Alpaca');
    expect(mountsForJob(mounts, 3101).map((m) => m.name)).toEqual(['Alpaca', 'Dragon Boat']);
  });
});

const fury: FeatherKind = {
  id: 1, name: 'Fury', type: 'ATK', quality: 2, color: 1, levelCap: [[68, 5], [80, 8], [99, 20]],
  levels: Array.from({ length: 30 }, (_, i) => ({ level: i + 1, attrs: [{ attr: 421, value: i + 1 }] })),
};
const vigor: FeatherKind = { ...fury, id: 2, name: 'Vigor', type: 'DEF' };

describe('feathers', () => {
  it('has 5 attack and 5 defense slots; MIX fits both', () => {
    expect(FEATHER_SLOTS.filter((s) => s.group === 'attack')).toHaveLength(5);
    expect(FEATHER_SLOTS.filter((s) => s.group === 'defense')).toHaveLength(5);
    expect(FEATHER_SLOTS.every((s) => s.accepts.includes('MIX'))).toBe(true);
  });

  it('caps the level by base level (Lv.99 -> 20 even if the kind has 30 rows)', () => {
    expect(featherMaxLevel(fury, 99)).toBe(20);
    expect(featherMaxLevel(fury, 85)).toBe(8);
    expect(featherMaxLevel(fury, 60)).toBe(0);
  });

  it('a feather picked while locked (level 0) counts at the highest allowed level once unlocked', () => {
    expect(featherLevel(0, fury, 60)).toBe(0);
    expect(featherLevel(0, fury, 99)).toBe(20);
    expect(featherLevel(12, fury, 99)).toBe(12);
    expect(featherLevel(25, fury, 85)).toBe(8);
  });

  it('a DEF feather in an attack slot adds nothing; levels above the cap are clamped', () => {
    const cat = {
      mounts, mountById: new Map(mounts.map((m) => [m.id, m])),
      featherById: new Map([[1, fury], [2, vigor]]), petById: new Map(),
      jobs: [], equipById: new Map(), passiveById: new Map(), jobBonus: { jobChangeLevel: [], maxJobLevel: {}, bonus: {} },
    } as unknown as Catalog;
    const feathers = Array.from({ length: 10 }, () => null) as ({ kindId: number; level: number } | null)[];
    feathers[0] = { kindId: 2, level: 5 }; // DEF in attack slot 1
    feathers[1] = { kindId: 1, level: 30 }; // ATK, too high for Lv.99
    const build = { ...emptyBuild(), jobId: 3101, baseLevel: 99, feathers };
    const parts = characterContributions(build, cat);
    expect(parts.map((p) => p.label)).toEqual(['Mount: Alpaca', 'Attack feather 2: Fury Lv.20']);
  });
});

describe('pets', () => {
  const pet: PetEntry = {
    id: 1001, name: 'Poring',
    starLevels: [
      { rank: 0, rankUp: 0, attrs: [], foreverAttrs: [{ attr: 421, value: 1 }] },
      { rank: 0, rankUp: 1, attrs: [{ attr: 48, value: 100 }], foreverAttrs: [{ attr: 421, value: 1 }] },
    ],
  };
  const levels: PetLevelData = {
    maxLevel: PET_MAX_LEVEL, attrs: [379, 380], petGroup: { 1001: 9 },
    deltas: { 9: Array.from({ length: PET_MAX_LEVEL }, (_, i) => [i === 0 ? 0 : 10, 1]) },
  };

  it('deployed pets add the evolution deployed bonus, assist pets the assist bonus; no star step bonus', () => {
    const evo = { ...pet, evolution: [
      { rank: 0, fightAttrs: [{ attr: 50, value: 20 }], assistAttrs: [{ attr: 47, value: 50 }] },
      { rank: 1, fightAttrs: [{ attr: 50, value: 40 }], assistAttrs: [{ attr: 47, value: 90 }] },
    ] };
    const cat = { petById: new Map([[1001, evo]]) } as unknown as Catalog;
    const pick = { petId: 1001, level: 99, evolution: 1 };
    const build = { ...emptyBuild(), pets: { deployed: [pick, null], assist: [null, { ...pick, evolution: 0 }] } };
    expect(petContributions(build, cat)).toEqual([
      { label: 'Deployed pet 1: Poring evolution 1', attrs: [{ attr: 50, value: 40 }] },
      { label: 'Assist pet 2: Poring evolution 0', attrs: [{ attr: 47, value: 50 }] },
    ]);
  });

  it("the pet's own stats sum the per-level rows and stop at level 99", () => {
    expect(petOwnStats(levels, 1001, 3)).toEqual([{ attr: 379, value: 20 }, { attr: 380, value: 3 }]);
    expect(petOwnStats(levels, 1001, 150)).toEqual(petOwnStats(levels, 1001, 99));
  });
});
