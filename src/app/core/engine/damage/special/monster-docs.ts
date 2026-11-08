import type { ScriptDoc } from '../script-docs';

const HP = 'then adds table flat / 10000 x target max HP; that HP part skips the damage float and the PvE/PvP multiplier, and the flat value is not added as damage';
const NO_ROLL = 'No flee roll and no crit (only the perfect-hit and block checks).';

/** Plain-words docs for MONSTER_FORMULAS, merged into SCRIPT_DOCS. */
export const MONSTER_SCRIPT_DOCS: Readonly<Record<string, ScriptDoc>> = {
  PhyMixPerSkillCalc: { line: 2758, summary: `Physical skill damage x PvE/PvP multiplier, ${HP}. ${NO_ROLL}` },
  MagMixPerSkillCalc: { line: 2860, summary: `Magic skill damage x PvE/PvP multiplier, ${HP}. ${NO_ROLL}` },
  PhyMixPerSkillCalcNew: { line: 2785, summary: `Like PhyMixPerSkillCalc, but the HP part is x (1 +- 0.15 per started 2000 points of the caster's final DMG% up minus the target's final DMG% down, max 1.5; +0.15 even at 0), floored at x0.5.` },
  MagMixPerSkillCalcNew: { line: 2887, summary: `Like MagMixPerSkillCalc, but the HP part is x (1 +- 0.15 per started 2000 points of the caster's final MDMG% up minus the target's final MDMG% down, max 1.5; +0.15 even at 0), floored at x0.5.` },
  PhyMixPerSkillCalcMVP: { line: 3074, summary: 'Like PhyMixPerSkillCalc; an MVP caster deals half the HP part to target job ids 2201-2203, 3101-3103, 7201-7203 and 7211-7213.', skipped: 'Whether the caster is an MVP is not in the monster data; set it in the attack panel.' },
  MagMixPerSkillCalcMVP: { line: 3040, summary: 'Like MagMixPerSkillCalc; an MVP caster deals half the HP part to target job ids 2201-2203, 3101-3103, 7201-7203 and 7211-7213.', skipped: 'Whether the caster is an MVP is not in the monster data; set it in the attack panel.' },
  MixSkillCalc: { line: 2706, summary: `Physical ATK formula, but against (1 + 3 x DEF%) / 4 x (3 + MDEF%) / 4 instead of DEF%, minus soft DEF; uses the magic PvE/PvP multiplier. ${NO_ROLL}` },
  MixPerSkillCalc: { line: 2731, summary: `MixSkillCalc where the table flat becomes flat / 10000 x target max HP x race/size/element % bonuses (with the damage float and multiplier). ${NO_ROLL}` },
  PhysicalShareReal: { line: 2198, summary: 'Target max HP x max(1, skill ratio), split evenly over the targets hit. Ignores ATK, DEF, the float and the PvE/PvP multiplier.' },
  MonsterBoom: { line: 8397, summary: 'Self-destruct: target max HP x skill ratio x element table. Ignores ATK, DEF, the float and the PvE/PvP multiplier.' },
  YueYeMaoBoom: { line: 8431, summary: 'Same as MonsterBoom, but deals 0 while the target has buff 59502.' },
  FireBall: { line: 8118, summary: 'Fire Ball: generic magic without additional magic damage; the MATK part deals 75% beyond 1.5 m from the centre.', skipped: 'Damage suppress ratio (server value).' },
  HuoZhuGongJi: { line: 8284, summary: 'Summoned fire: (MATK + weapon MATK + table flat) x race/size/element % x element table x ratio x target-class bonus; no hard or soft MDEF.', skipped: 'Owner buff 67615 bonus and owner gear extra damage; the game deals nothing if the caster has no owner.' },
  Blizzard: { line: 8328, summary: 'Storm Gust: generic magic; deals 0 to a target in buff state 301.', skipped: 'Caster buff 67616 bonus; the target-count bonus for player effect ids 410115xx; damage suppress ratio.' },
  BingBaoQiShiXuanWoCalc: { line: 12771, summary: 'Generic magic damage.', skipped: 'The script computes generic magic but never stores it as the result; what the game then deals is unknown.' },
  MonsterQiChengGongJi: { line: 9288, summary: 'Mounted Brandish Spear: physical with a fixed ratio by distance (x4.6 up to 2 m, x4.0 up to 3 m, x3.3 up to 4 m, x2.6 beyond); the table ratio is not used; skill flee roll.', skipped: 'Damage suppress ratio (server value).' },
};
