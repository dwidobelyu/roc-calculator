import { SkillLevel } from '../models/master-data.models';
import { calcStatus, damageText, useText } from './skill-summary';

const lv = (p: Partial<SkillLevel>) => ({
  level: 10, script: 'X', hits: [1], pveRatio: [0], pveFlat: [0], cooldown: 0, castVar: 0, castFixed: 0, ...p,
}) as SkillLevel;

describe('skill summary', () => {
  it('writes table damage in player words and skips empty segments', () => {
    expect(damageText(lv({ pveRatio: [35000], pveFlat: [200] }), 1, 'ported')).toBe('350% ATK + 200, 1 hit');
    expect(damageText(lv({ pveRatio: [35000, 0], pveFlat: [200, 0], hits: [1, 1] }), 1, 'ported')).toBe('350% ATK + 200, 1 hit');
    expect(damageText(lv({ pveRatio: [73000], pveFlat: [], hits: [3] }), 2, 'ported')).toBe('730% MATK, 3 hits');
  });

  it('says when a script sets the damage, or there is none', () => {
    expect(damageText(lv({ hits: [10] }), 2, 'ported')).toBe('Damage set by its script, 10 hits');
    expect(damageText(lv({}), 0, 'none')).toBe('No direct damage');
    expect(damageText(lv({ pveRatio: [10000] }), 2, 'none')).toBe('No direct damage');
  });

  it('tells area-effect damage apart from skills with no damage', () => {
    expect(calcStatus('none', 'Deals a total of {0}% Water MDMG over 10 hits')).toBe('linked');
    expect(calcStatus('none', 'Summon meteors, <color=red>striking</color> for {0}% Fire MDMG')).toBe('linked');
    expect(calcStatus('none', 'Removes all Poison effects from nearby party members.')).toBe('none');
    expect(calcStatus('none', 'Reduce damage taken by targets within the barrier by 50%')).toBe('none');
    expect(calcStatus('ported', 'Deals 350% PDMG')).toBe('ported');
    expect(damageText(lv({ hits: [10] }), 2, 'linked')).toBe('Damage set by its area effect, 10 hits');
  });

  it('lists base cast time, cooldown and SP', () => {
    expect(useText(lv({ castVar: 0.625, castFixed: 0.625, cooldown: 1, cost: [7, 172] }))).toBe('Cast 1.25 s, cooldown 1 s, 172 SP');
    expect(useText(lv({ cost: [7, 0] }))).toBe('Instant cast');
  });
});
