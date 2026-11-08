import { EquipmentEntry, JobEntry } from '../models/master-data.models';
import { buffEffectTypeName, effectUses, requiredJobs, scriptParts } from './item-effects';

describe('buffEffectTypeName', () => {
  it('maps the effect types seen in the data', () => {
    expect(buffEffectTypeName(6)).toBe('AddBuff');
    expect(buffEffectTypeName(11)).toBe('LuaScript');
    expect(buffEffectTypeName(20)).toBe('LuaScriptChangeAttr');
    expect(buffEffectTypeName(77)).toBe('ChangeAttrSnapshotByLuaScript');
    expect(buffEffectTypeName(999)).toBe('Type 999');
  });
});

describe('scriptParts', () => {
  it('splits a named script from its arguments', () => {
    expect(scriptParts('JingLianCard|jinglian=10|attr1=48|value1=500'))
      .toEqual({ name: 'JingLianCard', args: ['jinglian=10', 'attr1=48', 'value1=500'] });
    expect(scriptParts('KaLunDebuff')).toEqual({ name: 'KaLunDebuff', args: [] });
    expect(scriptParts('6=500')).toEqual({ name: '', args: ['6=500'] });
  });
});

describe('effectUses', () => {
  it('lists every calculator mechanism that reads the id', () => {
    const l = {
      equipBuffAttrs: new Map([[1, [{ attr: 32, value: 5 }]], [2, []]]),
      procById: new Map([[3, { id: 3, name: '', desc: '', procs: [] }]]),
      fightTempSources: [{ effectId: 1, kind: 'equip' as const, name: '', sets: {} }],
    };
    expect(effectUses(1, l)).toEqual(['attrs', 'fightTemp']);
    expect(effectUses(2, l)).toEqual([]);
    expect(effectUses(3, l)).toEqual(['proc']);
  });
});

describe('requiredJobs', () => {
  const jobs = [{ id: 3000, name: 'Acolyte' }, { id: 6000, name: 'Merchant' }] as JobEntry[];
  const item = (profession?: [number, number][]) => ({ profession } as EquipmentEntry);

  it('names the listed jobs once and treats 0 / no entry as any job', () => {
    expect(requiredJobs(item([[3000, 0], [6000, 0], [3000, 1]]), jobs)).toEqual(['Acolyte', 'Merchant']);
    expect(requiredJobs(item([[0, 0]]), jobs)).toEqual([]);
    expect(requiredJobs(item(), jobs)).toEqual([]);
    expect(requiredJobs(item([[9999, 0]]), jobs)).toEqual(['Job #9999']);
  });
});
