import { PassiveSkill, passiveAttrs } from './passives';

// Spear Mastery Lv10 as extracted: PATK +40 with a spear (types 4/5), +10 more while mounted
const spear: PassiveSkill = {
  skillId: 210103, name: 'Spear Mastery', jobIds: [2101], weaponTypes: [4, 5],
  levels: [{ level: 10, attrs: [
    { attr: 27, value: 10, weaponTypes: [4, 5], mounted: true },
    { attr: 27, value: 40, weaponTypes: [4, 5] },
  ] }],
};

describe('passiveAttrs', () => {
  it('applies weapon-gated attrs only with a matching weapon', () => {
    expect(passiveAttrs(spear, 10, 4)).toEqual([{ attr: 27, value: 40 }]);
    expect(passiveAttrs(spear, 10, 2)).toEqual([]);
  });

  it('adds the mounted extra only while mounted', () => {
    expect(passiveAttrs(spear, 10, 5, true)).toEqual([{ attr: 27, value: 10 }, { attr: 27, value: 40 }]);
  });

  it('returns nothing for an unknown level', () => {
    expect(passiveAttrs(spear, 3, 4)).toEqual([]);
  });
});
