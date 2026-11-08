import { ProcEntry, ProcSource, collapseProcs, expectedProcAttrs, expectedProcSkills, procRatesFor, procUptime, procsFor } from './procs';

const proc = (over: Partial<ProcEntry>): ProcEntry =>
  ({ id: 1, sourceId: 1, trigger: 'attack', chance: 0.1, cooldownSec: 0, effects: [], ...over });

// procs.json rows: "3% chance when attacking: PDMG/MDMG +3% for 3 s, no CD" and "PATK: 8% to auto-cast Thunderstorm Lv.5 (CD 0.5 s)"
const pdmgCard: ProcSource = {
  id: 510038301, name: '#510038301', desc: '',
  procs: [{
    id: 510038301, sourceId: 510038301, trigger: 'attack', chance: 0.03, cooldownSec: 0,
    effects: [{ kind: 'attrs', buffId: 510038401, target: 'self', attrs: [{ attr: 65, value: 300 }, { attr: 66, value: 300 }], durationSec: 3 }],
  }],
};
const stormCard: ProcSource = {
  id: 510026222, name: '#510026222', desc: '',
  procs: [{
    id: 510026222, sourceId: 510026222, trigger: 'attack', hitType: 'physical', chance: 0.08, perCopy: true, cooldownSec: 0.5,
    effects: [{ kind: 'skill', skillId: 400004, level: 5 }],
  }],
};
const byId = new Map([pdmgCard, stormCard].map((s) => [s.id, s]));

describe('procs', () => {
  it('uptime = D / (max(D, CD) + 1 / (chance * rate))', () => {
    // r = 0.5/s -> wait 2 s; cycle 2 + max(4, 10) = 12 s
    expect(procUptime(proc({ chance: 0.5, cooldownSec: 10 }), 4, 1)).toBeCloseTo(4 / 12);
    expect(procUptime(proc({ chance: 1 }), 5, 100)).toBeCloseTo(5 / 5.01);
    expect(procUptime(proc({ chance: 1 }), 5, 0)).toBe(0);
  });

  it('per-copy chances add up, non-stacking ones count once', () => {
    const p = proc({ perCopy: true, maxChance: 0.15 });
    expect(collapseProcs([p, p])[0].chance).toBeCloseTo(0.15);
    expect(collapseProcs([proc({}), proc({})])[0].chance).toBe(0.1);
  });

  it('real data: PDMG proc at 2 attacks/s', () => {
    // r = 0.06/s, uptime = 3 / (3 + 16.67) = 0.1525 -> 300 * 0.1525
    expect(expectedProcAttrs(procsFor([510038301], byId), { attack: 2 })).toEqual([{ attr: 65, value: 46 }, { attr: 66, value: 46 }]);
    expect(expectedProcAttrs(procsFor([510038301], byId), { attack: 2 }, 'enemy')).toEqual([]);
  });

  it('real data: autocast per trigger, filtered by hit type', () => {
    const one = expectedProcSkills(procsFor([510026222], byId), { attack: 2 });
    expect(one[0].skillId).toBe(400004);
    expect(one[0].perSec).toBeCloseTo(1 / (0.5 + 6.25));
    expect(one[0].perTrigger).toBeCloseTo(one[0].perSec / 2);
    const two = expectedProcSkills(procsFor([510026222, 510026222], byId), { attack: 2 });
    expect(two[0].perSec).toBeCloseTo(1 / (0.5 + 3.125));
    expect(expectedProcSkills(procsFor([510026222], byId), { attack: 2, 'attack/physical': 0 })).toEqual([]);
  });
});

describe('proc rates for an action', () => {
  it('fires magic procs only on magic attacks and never fires when-hit procs', () => {
    const r = procRatesFor('magic', 2);
    expect(r['attack/magic']).toBe(2);
    expect(r['attack/physical']).toBe(0);
    expect(r['hit']).toBe(0);
    expect(procRatesFor('normal', 1)['attack/normal']).toBe(1);
  });
});
