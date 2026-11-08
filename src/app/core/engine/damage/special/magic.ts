import { Attr, pct } from '../../../models/attr';
import { StateInput, magicTotal } from '../formula';
import {
  SP_PCT, SpecialFormula, TARGET_SP_PCT, buffToggle, currentSp, effectId, magicMod, npcTerms, per, skillCrit, st,
  stalkerSwap,
} from './common';

const magic = (script: string, label: string, raw: SpecialFormula['raw'], flee: 'none' | 'skill' = 'none',
  state?: StateInput[]) => new SpecialFormula({ script, label, kind: 'magic', flee, raw, state });

const DOUBLE_CAST: StateInput = {
  key: 'doubleCastLv', label: 'Double Cast level', kind: 'number', min: 0, max: 10, default: 0,
  note: 'Learned level of skill 420106 (0 = not learned)',
};
/** SkillTable 420106 DAMPer by level 1-10 (passive-skills data). */
const DOUBLE_CAST_DAMPER = [2300, 2600, 2900, 3200, 3500, 3800, 4100, 4400, 4700, 5000];
const BELLUZ_ECHO = buffToggle('belluzEcho', 'Second echo buff active', 'Buff 62702 (adds BELLUZ_7702_DAMUP)');
const SN_ECHO: StateInput = {
  key: 'echoLv', label: 'Echo buff level', kind: 'number', min: 0, default: 0, note: 'Level of buff 1010434 (0 = none)',
};
const SPIRITS: StateInput = {
  key: 'spirits', label: 'Spirits', kind: 'number', min: 0, max: 5, default: 0,
  note: 'Spirit count (3-turn resource 5); part N needs N + 1',
};
const WHITE_IMPRISON = buffToggle('whiteImprison', 'Target in White Imprison', 'Target buff 2123');
const JUDEX_PART1 = buffToggle('judexPart1', 'Second Judex hit buff active', 'Buff 4102330');
const JUDEX_SPLIT = buffToggle('judexSplit', 'Judex split buff active', 'Buff 4110240: part 0 halved, part 2 deals damage');
const JUDEX_ELEMENT = buffToggle('judexElement', 'Element advantage buff active', 'Buff 4110080: doubles an element advantage');
const CHILI_CRIT = buffToggle('chiliCrit', 'Rage of Land active (crit)', 'Buff 8510');
const SUMMON_OWNER = buffToggle('ownerBuff', 'Owner summon buff active', 'Owner buff 4203168 (skills 420310-420320)');

/** Varetyr Spear and other summon spells whose first part is 0 without the owner's buff 4203168. */
const SHENGQIANG_SWAP = [400002, 410104, 420105, 520236, 520242, 520262, 410116];
const SHENGQIANG_YYS = [420310, 420311, 420313, 420314, 420316, 420317, 420319, 420320];

export const MAGIC_FORMULAS: readonly SpecialFormula[] = [
  /**
   * DC:13033 Bolts: part 0 is the bolt; part 1 a Double Cast echo at DAMPer (+25% PvE); part 2 a second echo at
   * BELLUZ_7702_DAMUP (+10% PvE) that also needs buff 62702. Skipped: buff 6239 blocks both, buff 202683 random +-.
   */
  magic('ShuangBeiTouZhi', 'Bolt (Double Cast)', (m, s, F, ctx) => {
    const lv = Math.min(st(ctx, DOUBLE_CAST), 10);
    if (ctx.segment > 0 && lv < 1) return 0;
    const pve = ctx.pvp ? 0 : 1;
    const rate = ctx.segment === 0 ? 1
      : ctx.segment === 1 ? DOUBLE_CAST_DAMPER[lv - 1] / 10000 + 0.25 * pve
      : st(ctx, BELLUZ_ECHO) ? pct(ctx.attacker.fightTemp?.['BELLUZ_7702_DAMUP'] ?? 0) + 0.1 * pve : 0;
    return rate && magicTotal(stalkerSwap(m, ctx), s, F) * rate;
  }, 'none', [DOUBLE_CAST, BELLUZ_ECHO]),
  /** DC:13148 Novice bolts: part 1 is an echo at 15% + 5% per level of buff 1010434, part 2 is always 0. */
  magic('SNShuangBeiTouZhi', 'Novice bolt', (m, s, F, ctx) => {
    const lv = st(ctx, SN_ECHO);
    const rate = ctx.segment === 0 ? 1 : ctx.segment === 1 && lv ? 0.15 + 0.05 * lv : 0;
    return rate && magicTotal(stalkerSwap(m, ctx), s, F) * rate;
  }, 'none', [SN_ECHO]),
  /** DC:10491 Jupitel Thunder. */
  magic('LeiMingShu', 'Jupitel Thunder', (m, s, F, ctx) => magicTotal(stalkerSwap(m, ctx), s, F)),
  /** DC:4113 Water Ball: skipped equip WZHY flat split over the ball count. */
  magic('WaterBall', 'Water Ball', (m, s, F) => magicTotal(m, s, F)),
  /** DC:4072 Soul Strike: flat 40 instead of the table flat; table flat is a MDEF% bonus vs Undead; no 0 floor. */
  magic('Holyzhaohuan', 'Soul Strike', (m, s, F, ctx) => {
    const undeadUp = ctx.target.element === 9 ? 1 + s.skillNum / 10000 : 1;
    const core = (m.matk + m.weaponMatk) * magicMod(m) * s.skillPer;
    return Math.floor(core * m.mdef * undeadUp * m.npcMagic - m.mdefFlat) * F + 40 * F + m.additionalMatk;
  }),
  /** DC:3799 Soul Expansion: part N > 0 needs N + 1 spirits; x1.25 vs a target in White Imprison (buff 2123). */
  magic('LingHunBaoFaCalc', 'Soul Expansion', (m, s, F, ctx) => {
    if (ctx.segment > 0 && st(ctx, SPIRITS) < ctx.segment + 1) return 0;
    return magicTotal(stalkerSwap(m, ctx), s, F) * (st(ctx, WHITE_IMPRISON) ? 1.25 : 1);
  }, 'none', [SPIRITS, WHITE_IMPRISON]),
  /** DC:8953 Turn Undead: damage only vs Undead, no PvP chain; skipped instant-kill roll. */
  new SpecialFormula({
    script: 'ZhuanShengShu', label: 'Turn Undead', kind: 'magic', flee: 'none', global: false,
    raw: (m, s, F, ctx) => (ctx.target.element === 9 ? magicTotal(m, s, F) : 0),
  }),
  /**
   * DC:11067 Judex: part 0 always (halved with buff 4110240), part 1 needs buff 4102330, part 2 buff 4110240;
   * buff 4110080 doubles an element advantage. Skipped: EQUIP_SZJY random bonus.
   */
  magic('ShenPan', 'Judex', (m, s, F, ctx) => {
    const split = st(ctx, JUDEX_SPLIT);
    const rate = ctx.segment === 0 ? (split ? 0.5 : 1) : ctx.segment === 1 ? st(ctx, JUDEX_PART1) : split;
    const element = st(ctx, JUDEX_ELEMENT) && m.element > 1 ? 1 + (m.element - 1) * 2 : m.element;
    return rate && magicTotal({ ...m, element }, s, F) * rate;
  }, 'none', [JUDEX_PART1, JUDEX_SPLIT, JUDEX_ELEMENT]),
  /** DC:12974 Void Bolt: physical flee roll; ratio + min(current SP / 10000, 1) x 8. */
  magic('XuWuZhiJian', 'Void Bolt', (m, s, F, ctx) =>
    magicTotal(m, per(s, s.skillPer + Math.min(currentSp(ctx) / 10000, 1) * 8), F), 'skill', [SP_PCT]),
  /** DC:13001 Weaken Mind: ratio x (2 - target SP%). */
  magic('JingShenHaoRuo', 'Weaken Mind', (m, s, F, ctx) => {
    const max = ctx.target.attrs.get(Attr.MAX_SP_FINAL);
    const spPer = max ? currentSp(ctx, 'target') / max : 1;
    return magicTotal(m, per(s, s.skillPer * (1 + Math.min(1 - spPer, 1))), F);
  }, 'none', [TARGET_SP_PCT]),
  /** DC:9835 Magic Crasher: MATK against physical DEF% and soft DEF, physical PvP chain; slate buffs skipped. */
  new SpecialFormula({
    script: 'StaveCrasher', label: 'Magic Crasher', kind: 'physical', flee: 'none',
    raw: (m, s, F) => {
      const core = (m.matk + m.weaponMatk) * magicMod(m) * s.skillPer;
      return Math.max(core * m.def * m.npcMagic - m.defFlat, 0) * F + s.skillNum * F + m.additionalMatk;
    },
  }),
  /** DC:11209 Grand Cross: half of (ATK x DEF% + weapon x size x DEF% + MATK x MDEF%), both additional damages. */
  magic('GrandCross', 'Grand Cross', (m, s, F, ctx) => {
    const n = npcTerms(m, ctx);
    const mix = (m.atk * m.def + m.weaponAtk * m.size * m.def + (m.matk + m.weaponMatk) * m.mdef) / 2;
    const npc = Math.max(n.vs + n.atkUp + n.matkUp - n.matkDown, 0.1);
    return Math.max(mix * magicMod(m) * s.skillPer * npc - m.defFlat, 0) * F + s.skillNum * F +
      m.additionalAtk + m.additionalMatk;
  }),
  /** DC:14826 Chili Spear: magic crit base, crit para 1 with buff 8510. */
  new SpecialFormula({
    script: 'ShuShiMagicCri', label: 'Chilli Spear', kind: 'magic', flee: 'none', canCrit: true, state: [CHILI_CRIT],
    raw: (m, s, F) => magicTotal(m, s, F), critChance: (ctx) => (st(ctx, CHILI_CRIT) ? skillCrit(ctx, 0, 1) : 0),
  }),
  /**
   * DC:2463 Summon spells: the attacker stands in for the summon; part 0 of skills 420310-420320 needs owner buff
   * 4203168. Skipped: owner element-resource buffs 2151/2159-2162 (BuffTable 215101 per is not extracted).
   */
  magic('MagicSkillCalcShengQiang', 'Summon spell', (m, s, F, ctx) => {
    const id = Math.floor(effectId(ctx) / 100);
    if (SHENGQIANG_YYS.includes(id) && ctx.segment === 0 && !st(ctx, SUMMON_OWNER)) return 0;
    return magicTotal(SHENGQIANG_SWAP.includes(id) ? stalkerSwap(m, ctx) : m, s, F);
  }, 'none', [SUMMON_OWNER]),
];
