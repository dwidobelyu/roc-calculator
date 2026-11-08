import { emptyBuild } from '../models/build.models';
import { EquipmentEntry, StatPointRules } from '../models/master-data.models';
import type { Catalog } from '../services/catalog.service';
import { fillDescription } from '../../shared/components/skill-description';
import { equipmentContributions } from './combatant-factory';
import { EnchantOption, countedEnchants, enchantOptionsFor, enchantSlotOptions } from './item-options';
import { EMPTY_MONSTER_FILTER, FilterableMonster, MonsterFilterState, matchesMonster } from './monster-filter';
import { MAX_BASE_LEVEL, maxAffordable, pointsAt, spent } from './stat-points';

// costs: 1 point per stat value up to 10, then 2 per value; 30 points at level 99
const rules: StatPointRules = {
  pointsAtLevel: { 1: 0, 50: 15, 99: 30 },
  costToReach: Object.fromEntries(Array.from({ length: 99 }, (_, i) => {
    const v = i + 1;
    return [v, v <= 10 ? v - 1 : 9 + (v - 10) * 2];
  })),
  limits: [13, 15, 17, 19, 21, 23].map((attr) => ({ attr, min: 1, max: 99 })),
};

describe('stat points', () => {
  const stats = { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 };

  it('caps the base level at 99', () => {
    expect(pointsAt(rules, 150)).toBe(pointsAt(rules, MAX_BASE_LEVEL));
  });

  it('a stat can only rise as far as the remaining points allow', () => {
    // 30 points: 9 to reach 10, then 2 per value -> 10 + floor(21 / 2) = 20
    expect(maxAffordable(rules, stats, 'str', 99)).toBe(20);
    // AGI 10 uses 9 of the 30 points: 21 left -> 9 to reach 10, 12 more -> 16
    expect(maxAffordable(rules, { ...stats, agi: 10 }, 'str', 99)).toBe(16);
    expect(spent(rules, { ...stats, str: 20 })).toBe(29);
  });
});

const option = (id: string, extra: Partial<EnchantOption>): EnchantOption => ({
  id, name: id, amountLabel: '', min: 0, max: 0, resolve: () => [{ attr: 27, value: 10 }], slots: [], professions: [], ...extra,
});

describe('enchant per item', () => {
  const weapon = { id: 1, name: 'Rod', slot: 1, slotName: 'Weapon', holeNum: 1 } as EquipmentEntry;
  const armor = { id: 2, name: 'Robe', slot: 3, slotName: 'Armor', holeNum: 1 } as EquipmentEntry;
  const magicBoon = option('magic-boon', { slots: [1, 6], professions: [4000, 3000] });
  const vit = option('vit', { slots: [2, 3] });

  it('Magic Boon rolls on a weapon for a caster job, not on armor', () => {
    const mage = new Set([4101, 4000, 1000]);
    expect(enchantOptionsFor([magicBoon, vit], weapon, mage).map((o) => o.id)).toEqual(['magic-boon']);
    expect(enchantOptionsFor([magicBoon, vit], armor, mage).map((o) => o.id)).toEqual(['vit']);
  });

  it('job-locked effect enchants are hidden from other jobs', () => {
    expect(enchantOptionsFor([magicBoon], weapon, new Set([2000, 1000]))).toEqual([]);
  });
});

describe('cards on equipment', () => {
  const card = (id: number, value: number) => ({
    id, name: `Card ${id}`, slots: [1], attrs: [{ attr: 27, value }], levelGroup: '1/3',
    levels: [{ level: 1, attrs: [{ attr: 28, value: 100 }] }, { level: 2, attrs: [{ attr: 28, value: 250 }] }],
  });
  const weapon = { id: 1, name: 'Sword', slot: 1, slotName: 'Weapon', holeNum: 1, attrs: [] } as EquipmentEntry;
  const ring = { id: 2, name: 'Freya Ring', slot: 6, slotName: 'Accessory', holeNum: 0, attrs: [] } as EquipmentEntry;
  const gem = { id: 90, name: 'Gem', stat: 'Fortitude', quality: 5, rare: true, season: 1, attrs: [{ attr: 48, value: 1200 }], effects: [] };
  const cat = {
    jobs: [{ id: 2000, parent: 0, name: '', code: '', commonAttackSkill: 0, skillIds: [] }],
    equipById: new Map([[1, weapon], [2, ring]]),
    cardById: new Map([[11, card(11, 5)], [12, card(12, 7)]]),
    equipBuffAttrs: new Map(), refineByGroup: new Map(), enhanceBySlot: new Map(), enchantOptions: [],
    cardLevels: { maxLevel: 15, starMaxLevel: [5, 10, 15], groups: { '1/3': [{ level: 5, attrs: [{ attr: 425, value: 90 }] }, { level: 10, attrs: [{ attr: 425, value: 200 }] }] } },
    inscriptionOrnaments: new Set([2]), inscriptionById: new Map([[90, gem]]),
  } as unknown as Catalog;

  it('an item with one card slot counts only one card, at the chosen star', () => {
    const build = { ...emptyBuild(), jobId: 2000, equipment: [{ slot: 1, equipId: 1, refine: 0, enhance: 0, cardIds: [11, 12], cardLevels: [2, 0] }] };
    const attrs = equipmentContributions(build, cat).flatMap((c) => c.attrs);
    expect(attrs).toEqual([{ attr: 27, value: 5 }, { attr: 28, value: 250 }]);
  });

  it('a card level adds its level bonus, capped by the star', () => {
    const at = (star: number, lv: number) => equipmentContributions({ ...emptyBuild(), jobId: 2000,
      equipment: [{ slot: 1, equipId: 1, refine: 0, enhance: 0, cardIds: [11], cardLevels: [star], cardLv: [lv] }] }, cat)
      .flatMap((c) => c.attrs).filter((a) => a.attr === 425);
    expect(at(1, 10)).toEqual([{ attr: 425, value: 200 }]);
    expect(at(0, 10)).toEqual([{ attr: 425, value: 90 }]);
  });

  it('a base card (no star data) gets no level bonus', () => {
    const base = { id: 13, name: 'Base', slots: [1], attrs: [{ attr: 27, value: 1 }], levelGroup: '1/3' };
    const withBase = { ...cat, cardById: new Map([[13, base]]) } as unknown as Catalog;
    const attrs = equipmentContributions({ ...emptyBuild(), jobId: 2000,
      equipment: [{ slot: 1, equipId: 1, refine: 0, enhance: 0, cardIds: [13], cardLevels: [2], cardLv: [10] }] }, withBase)
      .flatMap((c) => c.attrs);
    expect(attrs).toEqual([{ attr: 27, value: 1 }]);
  });

  it('an inscription counts only on a Legendary Ornament', () => {
    const on = (equipId: number) => equipmentContributions({ ...emptyBuild(), jobId: 2000,
      equipment: [{ slot: equipId === 2 ? 6 : 1, equipId, refine: 0, enhance: 0, cardIds: [], inscription: 90 }] }, cat)
      .flatMap((c) => c.attrs);
    expect(on(2)).toEqual([{ attr: 48, value: 1200 }]);
    expect(on(1)).toEqual([]);
  });
});

describe('monster filter', () => {
  const m = (id: number, name: string, rank: number, extra: Partial<FilterableMonster> = {}): FilterableMonster =>
    ({ id, name, level: 50, rank, race: 0, element: 0, size: 0, ...extra });
  const list = [
    m(1, 'Poring', 0, { race: 3, element: 4, size: 0, level: 3 }),
    m(2, 'Eclipse', 4, { race: 0, element: 0 }),
    m(3, 'Baphomet', 5, { race: 2, element: 7, size: 1, level: 81 }),
    m(4, 'Invading Osiris', 21, { race: 4, element: 9 }),
  ];
  const pick = (f: Partial<MonsterFilterState>) => list.filter((x) => matchesMonster(x, { ...EMPTY_MONSTER_FILTER, ...f })).map((x) => x.id);

  it('MVP includes invading MVPs; Mini-boss and Normal are separate', () => {
    expect(pick({ rank: 'mvp' })).toEqual([3, 4]);
    expect(pick({ rank: 'mini' })).toEqual([2]);
    expect(pick({ rank: 'normal' })).toEqual([1]);
  });

  it('filters by name or exact id, size, race, element and level range together', () => {
    expect(pick({ query: 'bapho' })).toEqual([3]);
    expect(pick({ query: '2' })).toEqual([2]);
    expect(pick({ size: 1, race: 2, element: 7, minLevel: 80 })).toEqual([3]);
    expect(pick({ maxLevel: 10 })).toEqual([1]);
  });
});

describe('skill description', () => {
  it('fills placeholders and strips game rich-text tags', () => {
    const t = 'Deal <color=$$Yellow$$>{0}% + {1}</color> Neutral PDMG';
    expect(fillDescription(t, ['350', '200'])).toBe('Deal 350% + 200 Neutral PDMG');
  });
});

describe('enchant slots: 1 Effect or Enchant, 2 and 3 Enchant only', () => {
  const pick = (optionId: string) => ({ optionId, amount: 1 });
  it('counts an Effect enchant only in slot 1 and skips empty slots', () => {
    expect(countedEnchants([pick('effect-1'), null, pick('new-2'), pick('new-3')]).map((p) => p.optionId)).toEqual(['effect-1', 'new-2']);
    expect(countedEnchants([pick('new-1'), pick('effect-1'), pick('new-2')]).map((p) => p.optionId)).toEqual(['new-1', 'new-2']);
  });
  it('slot 1 offers both kinds, slots 2 and 3 only basic Enchants', () => {
    const opts = [{ id: 'new-1' }, { id: 'effect-1' }] as EnchantOption[];
    expect(enchantSlotOptions(opts, 0).map((o) => o.id)).toEqual(['new-1', 'effect-1']);
    expect(enchantSlotOptions(opts, 2).map((o) => o.id)).toEqual(['new-1']);
  });
});
