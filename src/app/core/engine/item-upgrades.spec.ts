import { EquipmentEntry } from '../models/master-data.models';
import { slotAvailable } from './equipment-rules';
import { hasJobMount } from './mounts';
import {
  CardLevelData, SHARED_LOOK_NAME, canLevelCard, cardLevelAttrs, cardMaxLevel, collapseSharedLookSlots, starForLevel,
} from './item-upgrades';

describe('card levels', () => {
  const data: CardLevelData = {
    maxLevel: 15, starMaxLevel: [5, 10, 15],
    groups: { '1/3': Array.from({ length: 15 }, (_, i) => ({ level: i + 1, attrs: [{ attr: 425, value: (i + 1) * 10 }] })) },
  };

  it('caps the level by star and returns the total at that level', () => {
    expect(cardMaxLevel(data, 0)).toBe(5);
    expect(cardMaxLevel(data, 3)).toBe(15);
    expect(cardLevelAttrs(data, '1/3', 8, 1)).toEqual([{ attr: 425, value: 80 }]);
    expect(cardLevelAttrs(data, '1/3', 8, 0)).toEqual([{ attr: 425, value: 50 }]);
    expect(cardLevelAttrs(data, '1/3', 0, 2)).toEqual([]);
    expect(cardLevelAttrs(data, undefined, 5, 0)).toEqual([]);
  });
});

describe('shared-look slots', () => {
  const face = (id: number, holeNum = 2) => ({
    id, name: `Face ${id}`, slot: 8, slotName: 'FaceGear', holeNum, refineMax: 20, refineGroup: 8,
    attrs: [{ attr: 32, value: 15 }],
  }) as EquipmentEntry;
  const sword = { id: 1, name: 'Sword', slot: 1, slotName: 'Weapon', holeNum: 1 } as EquipmentEntry;

  it('keeps other slots and turns a slot into one fixed item with the common stats', () => {
    const out = collapseSharedLookSlots([sword, face(10), face(11), face(12, -2146826246)]);
    expect(out.filter((e) => e.slot === 1)).toEqual([sword]);
    expect(out.filter((e) => e.slot === 8)).toEqual([{
      id: -8, name: SHARED_LOOK_NAME, slot: 8, slotName: 'FaceGear', attrs: [{ attr: 32, value: 15 }],
      holeNum: 2, refineMax: 20, refineGroup: 8,
    }]);
  });
});

describe('job-gated slots and mounts', () => {
  const jobs = [
    { id: 1000, parent: 0, name: 'Novice', code: '', commonAttackSkill: 0, skillIds: [] },
    { id: 6000, parent: 1000, name: 'Merchant', code: '', commonAttackSkill: 0, skillIds: [600012] },
    { id: 6101, parent: 6000, name: 'Blacksmith', code: '', commonAttackSkill: 0, skillIds: [] },
    { id: 7101, parent: 1000, name: 'Hunter', code: '', commonAttackSkill: 0, skillIds: [710106] },
  ];

  it('trolley and battle bird follow the skill on the job line', () => {
    expect(slotAvailable(12, jobs, 6101)).toBe(true);
    expect(slotAvailable(12, jobs, 7101)).toBe(false);
    expect(slotAvailable(14, jobs, 7101)).toBe(true);
    expect(slotAvailable(1, jobs, 1000)).toBe(true);
  });

  it('only jobs with a base mount get one', () => {
    const mounts = [{ id: 1, name: 'Savage', vehicleType: 1, jobLimit: [6000, 6101] }, { id: 2, name: 'Any', vehicleType: 2, jobLimit: [] }];
    expect(hasJobMount(mounts, 6101)).toBe(true);
    expect(hasJobMount(mounts, 1000)).toBe(false);
  });
});

describe('card level and star', () => {
  const data = { maxLevel: 15, starMaxLevel: [5, 10, 15], groups: {} };

  it('names the lowest star a level needs', () => {
    expect([0, 5, 6, 10, 11, 15].map((lv) => starForLevel(data, lv))).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('only awakened cards (with star data) level up', () => {
    expect(canLevelCard({ levels: [{}] })).toBe(true);
    expect(canLevelCard({ levels: [] })).toBe(false);
    expect(canLevelCard({})).toBe(false);
  });
});
