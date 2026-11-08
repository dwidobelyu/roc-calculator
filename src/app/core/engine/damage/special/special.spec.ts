import { Attr } from '../../../models/attr';
import { Combatant } from '../../../models/combat.models';
import { SkillEntry } from '../../../models/master-data.models';
import { AttrSheet } from '../../attr-sheet';
import { DamageModifiers } from '../damage-modifiers';
import { resolveFormula } from '../damage-formulas';
import { FormulaContext, SkillInput } from '../formula';
import { SPECIAL_FORMULAS } from './index';

// Hand-built inputs. Generic physical with these values: (2*100 + 200) * 2 * 0.5 * 1 - 20 = 380, + 10 + 5 = 395.
const M: DamageModifiers = {
  pvp: false, attackElement: 0, atk: 100, weaponAtk: 200, size: 1, sizeInc: 0, race: 0, element: 1, elementBonus: 1,
  def: 0.5, defFlat: 20, npc: 1, matk: 300, weaponMatk: 100, mdef: 0.5, mdefFlat: 10, npcMagic: 1,
  additionalAtk: 5, additionalMatk: 7, floatMin: 0.97, floatMax: 1.03, critMultiplier: 1.5,
};
const S: SkillInput = { skillPer: 2, skillNum: 10 };

function unit(set: Record<number, number> = {}, extra: Partial<Combatant> = {}): Combatant {
  const attrs = new AttrSheet();
  for (const [k, v] of Object.entries(set)) attrs.set(+k, v);
  return { kind: 'monster', name: 'u', attrs, level: 50, job: 0, race: 0, size: 0, element: 0, weaponType: 0,
    weaponElement: 0, isBoss: false, ...extra };
}

function ctx(o: { a?: Combatant; t?: Combatant; id?: number; segment?: number; config?: Record<string, number>; state?: Record<string, number> } = {}): FormulaContext {
  const skill = { id: o.id ?? 1, levels: [] } as unknown as SkillEntry;
  return { attacker: o.a ?? unit(), target: o.t ?? unit(), skill, level: { level: 1 } as SkillEntry['levels'][0],
    segment: o.segment ?? 0, hits: 1, pvp: false, config: o.config ?? {}, state: o.state ?? {} };
}

const f = (script: string) => {
  const r = SPECIAL_FORMULAS.find((x) => x.script === script);
  if (!r) throw new Error(script);
  return r;
};

describe('special damage scripts', () => {
  it('registers every script once and resolves it without approximation', () => {
    const names = SPECIAL_FORMULAS.map((x) => x.script);
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBe(69); // 51 player-skill scripts + 2 pet attack scripts + 16 monster scripts
    for (const n of names) expect(resolveFormula(n, 1).approximated).toBe(false);
  });

  it('PhysicalSkillCalcStr: ratio x (1 + STR/500)', () => {
    // per 2 x 1.2 = 2.4; 400 x 2.4 x 0.5 - 20 = 460; + 10 + 5
    expect(f('PhysicalSkillCalcStr').raw(M, S, 1, ctx({ a: unit({ [Attr.STR_FINAL]: 100 }) }))).toBeCloseTo(475);
  });

  it('ShieldCommonHMT: ratio x (1 + 1.5 VIT / (VIT + 200))', () => {
    // vit_add 1.75, per 3.5; 400 x 3.5 x 0.5 - 20 = 680; + 15
    expect(f('ShieldCommonHMT').raw(M, S, 1, ctx({ a: unit({ [Attr.VIT_FINAL]: 200 }) }))).toBeCloseTo(695);
  });

  it('OccultImpaction: ratio + target DEF / 200', () => {
    // per 2.5; 400 x 2.5 x 0.5 - 20 = 480; + 15
    expect(f('OccultImpaction').raw(M, S, 1, ctx({ t: unit({ [Attr.DEF]: 100 }) }))).toBeCloseTo(495);
  });

  it('LianCiGongJi: x3 vs Large', () => {
    expect(f('LianCiGongJi').raw(M, S, 1, ctx({ t: unit({}, { size: 1 }) }))).toBeCloseTo(395 * 3);
  });

  it('ClashingSpiral: weapon size 1.25 vs Small', () => {
    // (200 + 200 x 1.25) x 2 x 0.5 - 20 = 430; + 15
    expect(f('ClashingSpiral').raw(M, S, 1, ctx({ t: unit({}, { size: 2 }) }))).toBeCloseTo(445);
  });

  it('HolyCross / HolyCrossHMT: weapon type 5 doubles the ratio, no soft DEF', () => {
    const c = ctx({ a: unit({}, { weaponType: 5 }) });
    // 400 x 4 = 1600 (no DEF at all); HMT: 400 x 4 x 0.5 = 800; both + 15
    expect(f('HolyCross').raw(M, S, 1, c)).toBeCloseTo(1615);
    expect(f('HolyCrossHMT').raw(M, S, 1, c)).toBeCloseTo(815);
  });

  it('StableElementDamage: flat x (min(45, lv) - 10) + 50', () => {
    // 22 x 35 + 50 = 820; 820 - 20 = 800; + 5
    expect(f('StableElementDamage').raw(M, { skillPer: 0, skillNum: 22 }, 1, ctx())).toBeCloseTo(805);
  });

  it('AsuraStrikeHMT: ratio x (160 + SP/20) / 10 without DEF%', () => {
    // per (160 + 20) x 2 / 10 = 36; 400 x 36 - 20 = 14380; + 15
    expect(f('AsuraStrikeHMT').raw(M, S, 1, ctx({ a: unit({ [Attr.MAX_SP_FINAL]: 400 }) }))).toBeCloseTo(14395);
  });

  it('ShanDianChongJi: (80 + 2DEX/3 + INT + ATK) with element capped at 1.3, no DEF in PvE', () => {
    // 80 + 60 + 60 + 100 = 300; x 1.3 x 2 = 780; + 10 + 5
    const c = ctx({ a: unit({ [Attr.DEX_FINAL]: 90, [Attr.INT_FINAL]: 60 }), id: 710125 });
    expect(f('ShanDianChongJi').raw({ ...M, element: 1.5 }, S, 1, c)).toBeCloseTo(795);
  });

  it('LieYingTuJi2: ratio + DEX x 0.15 and crit with pro 1 / para 1', () => {
    // per 2 + 15 = 17; 400 x 17 x 0.5 - 20 = 3380; + 15
    const c = ctx({ a: unit({ [Attr.DEX_FINAL]: 100, [Attr.CRI_FINAL]: 50 }), t: unit({ [Attr.CRI_RES_FINAL]: 10 }) });
    expect(f('LieYingTuJi2').raw(M, S, 1, c)).toBeCloseTo(3395);
    expect(f('LieYingTuJi2').critChance!(c)).toBeCloseTo(0.41); // (50 + 1 - 10) / 100
  });

  it('GrandCross: half of ATK x DEF%, weapon x DEF%, MATK x MDEF%', () => {
    // (100 x 0.5 + 200 x 0.5 + 400 x 0.5) / 2 = 175; x 2 = 350 - 20 = 330; + 10 + 5 + 7
    expect(f('GrandCross').raw(M, S, 1, ctx())).toBeCloseTo(352);
  });

  it('SoulDestroyerHMT: physical part + INT part, no table flat', () => {
    // phys 400 x 2 x 0.5 x (1 + 0.1) - 20 = 420; magic 100 x 2 x 5 x 0.5 x (1 + 0.2) - 10 = 590; + 5
    expect(f('SoulDestroyerHMT').raw(M, S, 1, ctx({ a: unit({ [Attr.INT_FINAL]: 100 }) }))).toBeCloseTo(1015);
  });

  it('Holyzhaohuan: flat 40, table flat is a bonus vs Undead', () => {
    const s = { skillPer: 2, skillNum: 1000 };
    // 800 x 0.5 x 1.1 - 10 = 430; + 40 + 7
    expect(f('Holyzhaohuan').raw(M, s, 1, ctx({ t: unit({}, { element: 9 }) }))).toBeCloseTo(477);
    // 800 x 0.5 - 10 = 390; + 47
    expect(f('Holyzhaohuan').raw(M, s, 1, ctx())).toBeCloseTo(437);
  });

  it('ZhuanShengShu: only Undead takes damage', () => {
    // 800 x 0.5 - 10 = 390; + 10 + 7
    expect(f('ZhuanShengShu').raw(M, S, 1, ctx({ t: unit({}, { element: 9 }) }))).toBeCloseTo(407);
    expect(f('ZhuanShengShu').raw(M, S, 1, ctx())).toBe(0);
  });

  it('ShuangBeiTouZhi: Stalker uses ATK, echo parts need Double Cast', () => {
    const a = unit({}, { job: 5202 });
    // (100 + 200) x 2 x 0.5 - 10 = 290; + 10 + 7
    expect(f('ShuangBeiTouZhi').raw(M, S, 1, ctx({ a }))).toBeCloseTo(307);
    expect(f('ShuangBeiTouZhi').raw(M, S, 1, ctx({ a, segment: 1 }))).toBe(0);
  });

  it('ErDaoLianJi: half weapon ATK', () => {
    // weapon 200 - 160 / 2 = 120; (200 + 120) x 2 x 0.5 - 20 = 300; + 15
    expect(f('ErDaoLianJi').raw(M, S, 1, ctx({ a: unit({ [Attr.WEAPON_ATK_FINAL]: 160 }) }))).toBeCloseTo(315);
  });

  it('QiangSuanHuoYanPingHMT: target VIT / vitpara and STR / 100 ratio', () => {
    // vitPara 1 + 95/190 = 1.5; per 2 + 1.5 = 3.5; 400 x 1.5 x 3.5 x 0.5 - 20 = 1030; + 15
    const c = ctx({ a: unit({ [Attr.STR_FINAL]: 150 }), t: unit({ [Attr.VIT_FINAL]: 95 }), id: 620216, config: { vitpara: 190 } });
    expect(f('QiangSuanHuoYanPingHMT').raw(M, S, 1, c)).toBeCloseTo(1045);
  });

  it('YinSuTouZhi: crit only from config cripro/cripara', () => {
    const a = unit({ [Attr.CRI_FINAL]: 80 }), t = unit({ [Attr.CRI_RES_FINAL]: 20 });
    expect(f('YinSuTouZhi').critChance!(ctx({ a, t }))).toBe(0);
    // (80 x 0.5 + 10 - 20) / 100
    expect(f('YinSuTouZhi').critChance!(ctx({ a, t, config: { cripro: 10, cripara: 5000 } }))).toBeCloseTo(0.3);
  });

  it('StaveCrasher: MATK against physical DEF', () => {
    // 400 x 2 x 0.5 - 20 = 380; + 10 + 7
    expect(f('StaveCrasher').raw(M, S, 1, ctx())).toBeCloseTo(397);
  });

  describe('combat state inputs', () => {
    const a = unit({ [Attr.CRI_FINAL]: 80 }), t = unit({ [Attr.CRI_RES_FINAL]: 20 });
    const crit = (script: string, state: Record<string, number>, id = 1, config = {}) =>
      f(script).critChance!(ctx({ a, t, id, state, config }));

    it('buff-gated crit scripts read the para their buff grants', () => {
      expect(crit('YouXiaSkillCalcCri', {})).toBe(0);
      expect(crit('YouXiaSkillCalcCri', { critBuff: 1 })).toBeCloseTo(0.28); // (80 x 0.6 - 20) / 100
      expect(crit('YouXiaSkillCalcCri', { critBuff: 1, critUpBuff: 1 })).toBeCloseTo(0.6);
      expect(crit('ReLiPenSheCalcCri', { critBuff: 1 })).toBe(0);
      expect(crit('ReLiPenSheCalcCri', { critBuff: 1, targetMark: 1 })).toBeCloseTo(0.28);
      expect(crit('ReLiPenSheCalcCri', { critBuff: 1, targetMark: 1, critUpBuff: 1 })).toBeCloseTo(0.36);
      expect(crit('JiSuChuoCi', { critBuff: 1 })).toBeCloseTo(0.36);
      expect(crit('HuangJiaWeiShiSkillCalcCri', { critBuff: 1 })).toBe(0);
      expect(crit('HuangJiaWeiShiSkillCalcCri', { critBuff: 1 }, 220315)).toBeCloseTo(0.6);
      expect(crit('XiuLuoSkillCalcCri', { critBuff: 1 }, 320304)).toBeCloseTo(0.6);
      expect(crit('AnCiCalcCri', { critBuff: 1 })).toBeCloseTo(0.6);
    });

    it('ShenHongQieGe: crit only with buff 4102412', () => {
      const config = { cripro: 0, cripara: 10000 };
      expect(crit('ShenHongQieGe', {}, 1, config)).toBe(0);
      expect(crit('ShenHongQieGe', { redCutBuff: 1 }, 1, config)).toBeCloseTo(0.6);
    });

    it('ZhaDanLaJiao / ShuShiMagicCri: stacks x 0.8, +5 stacks with buff 4203127, crit with buff 8510', () => {
      expect(f('ZhaDanLaJiao').raw(M, S, 1, ctx({ state: { chiliStacks: 2 } }))).toBeCloseTo(407 * 2 * 0.8);
      expect(f('ZhaDanLaJiao').raw(M, S, 1, ctx({ state: { chiliStacks: 2, chiliPlus: 1 } }))).toBeCloseTo(407 * 7 * 0.8);
      expect(crit('ZhaDanLaJiao', { chiliCrit: 1 })).toBeCloseTo(0.6);
      expect(crit('ShuShiMagicCri', { chiliCrit: 1 })).toBeCloseTo(0.6);
    });

    it('ChainCrushCombo: +15% ratio per sphere above 2', () => {
      // per 2 x 1.3 = 2.6; 400 x 2.6 x 0.5 - 20 = 500; + 15
      expect(f('ChainCrushCombo').raw(M, S, 1, ctx({ state: { spheres: 4 } }))).toBeCloseTo(515);
      expect(f('ChainCrushCombo').raw(M, S, 1, ctx())).toBeCloseTo(395);
    });

    it('LingHunBaoFaCalc: part N needs N + 1 spirits, x1.25 vs White Imprison', () => {
      expect(f('LingHunBaoFaCalc').raw(M, S, 1, ctx({ segment: 2, state: { spirits: 2 } }))).toBe(0);
      expect(f('LingHunBaoFaCalc').raw(M, S, 1, ctx({ segment: 2, state: { spirits: 3 } }))).toBeCloseTo(407);
      expect(f('LingHunBaoFaCalc').raw(M, S, 1, ctx({ state: { whiteImprison: 1 } }))).toBeCloseTo(407 * 1.25);
    });

    it('ShenPan: part buffs and element doubling', () => {
      expect(f('ShenPan').raw(M, S, 1, ctx({ segment: 1 }))).toBe(0);
      expect(f('ShenPan').raw(M, S, 1, ctx({ segment: 1, state: { judexPart1: 1 } }))).toBeCloseTo(407);
      expect(f('ShenPan').raw(M, S, 1, ctx({ state: { judexSplit: 1 } }))).toBeCloseTo(203.5);
      expect(f('ShenPan').raw(M, S, 1, ctx({ segment: 2, state: { judexSplit: 1 } }))).toBeCloseTo(407);
      // element 1.5 -> 2: 400 x 2 x 2 x 0.5 - 10 = 790; + 17
      expect(f('ShenPan').raw({ ...M, element: 1.5 }, S, 1, ctx({ state: { judexElement: 1 } }))).toBeCloseTo(807);
    });

    it('ShuangBeiTouZhi / SNShuangBeiTouZhi: echo parts', () => {
      const dc = unit({}, { job: 5202, fightTemp: { BELLUZ_7702_DAMUP: 2000 } });
      // DAMPer 0.5 + 0.25 PvE
      expect(f('ShuangBeiTouZhi').raw(M, S, 1, ctx({ a: dc, segment: 1, state: { doubleCastLv: 10 } }))).toBeCloseTo(307 * 0.75);
      expect(f('ShuangBeiTouZhi').raw(M, S, 1, ctx({ a: dc, segment: 2, state: { doubleCastLv: 10 } }))).toBe(0);
      expect(f('ShuangBeiTouZhi').raw(M, S, 1, ctx({ a: dc, segment: 2, state: { doubleCastLv: 10, belluzEcho: 1 } })))
        .toBeCloseTo(307 * 0.3);
      expect(f('SNShuangBeiTouZhi').raw(M, S, 1, ctx({ segment: 1, state: { echoLv: 2 } }))).toBeCloseTo(407 * 0.25);
      expect(f('SNShuangBeiTouZhi').raw(M, S, 1, ctx({ segment: 2, state: { echoLv: 2 } }))).toBe(0);
    });

    it('MagicSkillCalcShengQiang: part 0 of 420310 needs the owner buff', () => {
      expect(f('MagicSkillCalcShengQiang').raw(M, S, 1, ctx({ id: 420310 }))).toBe(0);
      expect(f('MagicSkillCalcShengQiang').raw(M, S, 1, ctx({ id: 420310, state: { ownerBuff: 1 } }))).toBeCloseTo(407);
    });

    it('current SP % for Asura Strike, Void Bolt and Weaken Mind', () => {
      // SP 200: per (160 + 10) x 2 / 10 = 34; 400 x 34 - 20 = 13580; + 15
      const asura = ctx({ a: unit({ [Attr.MAX_SP_FINAL]: 400 }), state: { spPct: 50 } });
      expect(f('AsuraStrikeHMT').raw(M, S, 1, asura)).toBeCloseTo(13595);
      // SP 5000: per 2 + 4 = 6; 400 x 6 x 0.5 - 10 = 1190; + 17
      const voidBolt = ctx({ a: unit({ [Attr.MAX_SP_FINAL]: 10000 }), state: { spPct: 50 } });
      expect(f('XuWuZhiJian').raw(M, S, 1, voidBolt)).toBeCloseTo(1207);
      // target at 25%: per 2 x 1.75 = 3.5; 400 x 3.5 x 0.5 - 10 = 690; + 17
      const weaken = ctx({ t: unit({ [Attr.MAX_SP_FINAL]: 1000 }), state: { targetSpPct: 25 } });
      expect(f('JingShenHaoRuo').raw(M, S, 1, weaken)).toBeCloseTo(707);
    });
  });
});
