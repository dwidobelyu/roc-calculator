import { FightTempSource, fightTempFrom } from './fight-temp';

const sources: FightTempSource[] = [
  { effectId: 16201, kind: 'buff', name: 'Parry', sets: { SKILL_COMMON_BLOCK: 1700, SKILL_SJGD_BLOCK: 1 } },
  { effectId: 7060101, kind: 'buff', name: 'Element Arrow Resonance Boost Lv.1', sets: { EQUIP_COMMON_FIREDAM_SNAPSHOT: 600 },
    copies: { EQUIP_COMMON_FIREDAM: 'EQUIP_COMMON_FIREDAM_SNAPSHOT' } },
  { effectId: 1, kind: 'buff', name: 'base', sets: { EQUIP_COMMON_FIREDAM: 400 } },
  { effectId: 410077001, kind: 'equip', name: 'Recovery Light', itemId: 4335407, sets: { EQUIP_QYGH_MOBRATE: 6666 }, minRefine: 10 },
];

describe('fightTempFrom', () => {
  it('sums the active buffs only', () => {
    expect(fightTempFrom(sources, [16201])).toEqual({ SKILL_COMMON_BLOCK: 1700, SKILL_SJGD_BLOCK: 1 });
  });

  it('copies the base total into the snapshot key when the copy buff is active', () => {
    expect(fightTempFrom(sources, [1, 7060101])['EQUIP_COMMON_FIREDAM_SNAPSHOT']).toBe(1000);
    expect(fightTempFrom(sources, [7060101])['EQUIP_COMMON_FIREDAM_SNAPSHOT']).toBe(600);
  });

  it('item-specific values need that item at the required refine', () => {
    expect(fightTempFrom(sources, [410077001])).toEqual({});
    expect(fightTempFrom(sources, [{ effectId: 410077001, itemId: 4335407, refine: 9 }])).toEqual({});
    expect(fightTempFrom(sources, [{ effectId: 410077001, itemId: 4335407, refine: 10 }])).toEqual({ EQUIP_QYGH_MOBRATE: 6666 });
  });
});
