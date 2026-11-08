import { Attr } from '../../../models/attr';
import { Combatant } from '../../../models/combat.models';
import { SkillEntry } from '../../../models/master-data.models';
import { AttrSheet } from '../../attr-sheet';
import { DamageModifiers } from '../damage-modifiers';
import { resolveFormula } from '../damage-formulas';
import { FormulaContext, SkillInput } from '../formula';
import { SCRIPT_DOCS } from '../script-docs';
import { MONSTER_FORMULAS } from './monster';

// Physical part: (2*100 + 200) * 2 * 0.5 - 20 = 380, + 5 = 385. Magic part: 400 * 2 * 0.5 - 10 = 390, + 7 = 397.
const M: DamageModifiers = {
  pvp: false, attackElement: 0, atk: 100, weaponAtk: 200, size: 1, sizeInc: 0, race: 0, element: 1, elementBonus: 1,
  def: 0.5, defFlat: 20, npc: 1, matk: 300, weaponMatk: 100, mdef: 0.5, mdefFlat: 10, npcMagic: 1,
  additionalAtk: 5, additionalMatk: 7, floatMin: 0.97, floatMax: 1.03, critMultiplier: 1.5,
};
const S: SkillInput = { skillPer: 2, skillNum: 10 };
/** Flat 500 = 5% of the 10000 max HP below. */
const HP_S: SkillInput = { skillPer: 2, skillNum: 500 };

function unit(set: Record<number, number> = {}, extra: Partial<Combatant> = {}): Combatant {
  const attrs = new AttrSheet();
  for (const [k, v] of Object.entries(set)) attrs.set(+k, v);
  return { kind: 'monster', name: 'u', attrs, level: 50, job: 0, race: 0, size: 0, element: 0, weaponType: 0,
    weaponElement: 0, isBoss: false, ...extra };
}

const target = (set: Record<number, number> = {}, extra: Partial<Combatant> = {}) =>
  unit({ [Attr.MAX_HP_FINAL]: 10000, ...set }, { kind: 'player', ...extra });

function ctx(o: { a?: Combatant; t?: Combatant; state?: Record<string, number> } = {}): FormulaContext {
  const skill = { id: 1, levels: [] } as unknown as SkillEntry;
  return { attacker: o.a ?? unit(), target: o.t ?? target(), skill, level: { level: 1 } as SkillEntry['levels'][0],
    segment: 0, hits: 1, pvp: false, config: {}, state: o.state ?? {} };
}

const f = (script: string) => {
  const r = MONSTER_FORMULAS.find((x) => x.script === script);
  if (!r) throw new Error(script);
  return r;
};

describe('monster damage scripts', () => {
  it('resolves each script exactly and documents it', () => {
    for (const x of MONSTER_FORMULAS) {
      expect(resolveFormula(x.script, 1).formula).toBe(x);
      expect(SCRIPT_DOCS[x.script], x.script).toBeDefined();
    }
  });

  it('PhyMix / MagMix: core x PvE chain + flat / 10000 x target max HP outside the chain', () => {
    expect(f('PhyMixPerSkillCalc').raw(M, HP_S, 1, ctx())).toBeCloseTo(885);
    expect(f('MagMixPerSkillCalc').raw(M, HP_S, 1, ctx())).toBeCloseTo(897);
    // target PvE resist 8000 halves the chain (8000 / 16000) but not the HP part
    expect(f('PhyMixPerSkillCalc').raw(M, HP_S, 1, ctx({ t: target({ [Attr.PVE_RES]: 8000 }) }))).toBeCloseTo(692.5);
  });

  it('*New: HP part x (1 + 0.15 per started 2000 DMG% difference), +0.15 at 0, floor 0.5', () => {
    expect(f('PhyMixPerSkillCalcNew').raw(M, HP_S, 1, ctx())).toBeCloseTo(385 + 575);
    const a = unit({ [Attr.DAM_INCREASE_FINAL]: 4000 });
    expect(f('PhyMixPerSkillCalcNew').raw(M, HP_S, 1, ctx({ a }))).toBeCloseTo(385 + 725);
    const t = target({ [Attr.MDAM_REDUC_FINAL]: 20000 });
    expect(f('MagMixPerSkillCalcNew').raw(M, HP_S, 1, ctx({ t }))).toBeCloseTo(397 + 250);
  });

  it('*MVP: an MVP caster halves the HP part against listed jobs only', () => {
    const t = target({}, { job: 2201 });
    expect(f('PhyMixPerSkillCalcMVP').raw(M, HP_S, 1, ctx({ t }))).toBeCloseTo(885);
    expect(f('PhyMixPerSkillCalcMVP').raw(M, HP_S, 1, ctx({ t, state: { mvp: 1 } }))).toBeCloseTo(635);
    expect(f('MagMixPerSkillCalcMVP').raw(M, HP_S, 1, ctx({ state: { mvp: 1 } }))).toBeCloseTo(897);
  });

  it('MixSkillCalc / MixPerSkillCalc: ATK against (1 + 3 DEF%) / 4 x (3 + MDEF%) / 4', () => {
    // 400 x 0.625 x 0.875 x 2 - 20 = 417.5
    expect(f('MixSkillCalc').raw(M, S, 1, ctx())).toBeCloseTo(417.5 + 10 + 5);
    expect(f('MixPerSkillCalc').raw(M, HP_S, 1, ctx())).toBeCloseTo(417.5 + 500 + 5);
  });

  it('PhysicalShareReal: max HP x max(1, ratio) / targets', () => {
    expect(f('PhysicalShareReal').raw(M, S, 1, ctx({ state: { targets: 4 } }))).toBeCloseTo(5000);
    expect(f('PhysicalShareReal').raw(M, { skillPer: 0.5, skillNum: 0 }, 1, ctx())).toBeCloseTo(10000);
  });

  it('MonsterBoom / YueYeMaoBoom: max HP x ratio x element table', () => {
    const s = { skillPer: 0.15, skillNum: 0 };
    expect(f('MonsterBoom').raw({ ...M, element: 1.5 }, s, 1.03, ctx())).toBeCloseTo(2250);
    expect(f('YueYeMaoBoom').raw(M, s, 1, ctx())).toBeCloseTo(1500);
    expect(f('YueYeMaoBoom').raw(M, s, 1, ctx({ state: { buff59502: 1 } }))).toBe(0);
  });

  it('FireBall: MATK part x0.75 when far, no additional MATK', () => {
    expect(f('FireBall').raw(M, S, 1, ctx())).toBeCloseTo(400);
    expect(f('FireBall').raw(M, S, 1, ctx({ state: { far: 1 } }))).toBeCloseTo(302.5);
  });

  it('HuoZhuGongJi: (MATK + flat) x ratio, no MDEF', () => {
    expect(f('HuoZhuGongJi').raw(M, S, 1, ctx())).toBeCloseTo(827);
  });

  it('Blizzard: generic magic, 0 in buff state 301', () => {
    expect(f('Blizzard').raw(M, S, 1, ctx())).toBeCloseTo(407);
    expect(f('Blizzard').raw(M, S, 1, ctx({ state: { state301: 1 } }))).toBe(0);
  });

  it('MonsterQiChengGongJi: fixed ratio by distance', () => {
    // floor(400 x 0.5 x 4.6 - 20) = 900; beyond 4 m: floor(400 x 0.5 x 2.6 - 20) = 500
    expect(f('MonsterQiChengGongJi').raw(M, S, 1, ctx())).toBeCloseTo(915);
    expect(f('MonsterQiChengGongJi').raw(M, S, 1, ctx({ state: { distance: 5 } }))).toBeCloseTo(515);
  });
});
