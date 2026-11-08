import { DynamicMonsterInput, dynamicMonsterStats } from './dynamic-monster';

const base: DynamicMonsterInput = {
  entityId: 1, typeLevel: 0, str: 10, int: 0, agi: 5, dex: 10, luk: 6, baseAspd: 100,
  defFinal: 0, mdefFinal: 0, hitFinal: 0, flee: 0, tableLevel: 20, def: 7, mdef: 3,
  dynamicAtk: 1, dynamicHp: 1, expectHp: 1000, expectDps: 50, expectLv: 20, fn: 0, typeLv: 0, dungeonId: 0,
};

describe('dynamic monster solver (CMA:7-206)', () => {
  it('low level: DEF factor 1, table DEF kept', () => {
    // aspdF 0.5, cri 2 -> crit factor 0.814; atk = ((50/0.5/0.814 + 14) - 36.4) / 1.05 = 95.67
    // matk = (4*50 + 14)/2 - 9 = 98; hit = 50 - 10 + 40; flee = 20 - 5
    expect(dynamicMonsterStats(base)).toEqual({
      level: 20, maxHp: 1000, weaponAtk: 95, weaponMatk: 98, hit: 80, flee: 15, def: 7, mdef: 3,
    });
  });

  it('Function 9 boss sets equipment DEF and uses the 0.7659 curve', () => {
    const r = dynamicMonsterStats({
      ...base, typeLevel: 1, str: 20, int: 10, agi: 10, dex: 20, luk: 30, baseAspd: 150,
      defFinal: 100, mdefFinal: 20, dynamicAtk: 2, dynamicHp: 1.5, expectHp: 5000, expectDps: 100, expectLv: 50, fn: 9, typeLv: 2,
    });
    // def = 0.7659*e^(-0.189)*0.7 = 0.4438; atk = ((200/0.87 + 68.25)/0.4438 - 85)/1.1 = 533.43
    // hp = 5000*1.5*max(4100/5000, 1020/1200) = 6375; matk = 835/2 - 41.5 = 376
    expect(r).toEqual({ level: 50, maxHp: 6375, weaponAtk: 533, weaponMatk: 376, hit: 170, flee: 40, def: 300, mdef: 75 });
  });

  it('dungeon 4000-4999 re-derives HIT/FLEE/HP and scales ATK by 0.3', () => {
    const r = dynamicMonsterStats({
      ...base, luk: 3, int: 5, hitFinal: 100, flee: 5, tableLevel: 40,
      expectHp: 10000, expectDps: 20, expectLv: 60, fn: 9, typeLv: 1, dungeonId: 4001,
    });
    // weaponDef 120 / weaponMdef 30 -> hp = 10000*(4120/5200)*0.28 = 2218.46; hit = max(110, 0, 40) + 220
    // atk = ((20/0.5/0.807 + 81.9)/0.6356 - 55.2)/1.05*0.3 = 43.32; matk = (122/2 - 25.5)*0.3 = 10.65
    expect(r).toEqual({ level: 60, maxHp: 2218, weaponAtk: 43, weaponMatk: 10, hit: 330, flee: 25, def: 120, mdef: 30 });
  });

  it('0 expectations fall back to HP_E 100 / DPS_E 10', () => {
    expect(dynamicMonsterStats({ ...base, expectHp: 0, expectDps: 0 }).maxHp).toBe(100);
  });
});
