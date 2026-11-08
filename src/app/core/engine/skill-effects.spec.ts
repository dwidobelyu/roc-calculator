import { SkillEffectData, buffChain, buffDuration, castTargetLabel, lineAttrs } from './skill-effects';

const data: SkillEffectData = {
  skills: { 1: { target: 2, area: 0, levels: [{ level: 1, castRange: 4, radius: [], buffs: [[10, 10000]] }] } },
  buffs: {
    10: { name: '', desc: '', debuff: false, end: [[1, 5]], effects: [
      { type: 1, param: '7=-2', every: 1 },
      { type: 11, param: 'Script|Buff_ID=20', buffs: [20] },
    ] },
    20: { name: 'Child', desc: '', debuff: true, end: [], effects: [{ type: 6, param: '10', buffs: [10] }] },
  },
};

describe('skill effects', () => {
  it('labels the cast target and duration', () => {
    expect(castTargetLabel(2, 0)).toBe('An ally, one unit');
    expect(castTargetLabel(9, 7)).toBe('Target type 9 (not decoded)');
    expect(buffDuration([[1, 5]])).toBe('Lasts 5 s');
  });

  it('decodes attribute lines only', () => {
    expect(lineAttrs({ type: 1, param: '7=-2' })).toEqual([{ attr: 7, value: -2 }]);
    expect(lineAttrs({ type: 11, param: 'Script|Buff_ID=20' })).toBeNull();
  });

  it('flattens the buff chain and stops at loops', () => {
    const rows = buffChain(data, data.skills[1].levels[0]);
    expect(rows.map((r) => [r.id, r.depth, r.chance])).toEqual([[10, 0, 10000], [20, 1, undefined]]);
  });
});
