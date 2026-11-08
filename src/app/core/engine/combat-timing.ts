import { Attr, pct } from '../models/attr';
import { Combatant, DamageResult } from '../models/combat.models';
import { SkillEntry, SkillLevel } from '../models/master-data.models';

/** Time per action, damage per second and time until the target reaches 0 HP. Seconds throughout. */
export interface CombatTiming {
  castFixed: number;
  castVariable: number;
  castTime: number;
  cooldown: number;
  attacksPerSecond: number;
  /** Time between two uses of this attack when it is used over and over. */
  cycleTime: number;
  expectedPerCast: number;
  dps: number;
  dpsMin: number;
  dpsMax: number;
  targetHp: number;
  /** HP / expected DPS: rolls (miss, crit) included. */
  timeToKill: number;
  /** Every cast landing, at min and max damage: casts needed and the time they take. */
  castsToKill: { min: number; max: number };
  timeToKillRange: { min: number; max: number };
  notes: string[];
}

/**
 * Cast time is FightAttr.GetSingingTimeByAttr (Formula/FightAttr.lua):
 *   fixed = max(0, CT_FIXED_FINAL/1e4 + skill fixed) * max(0, 1 + CT_FIXED_PER_FINAL/1e4), variable likewise.
 * Cooldown reductions and the action time of ASPD-bound skills are inferred (native code).
 */
export function calculateTiming(
  attacker: Combatant,
  target: Combatant,
  skill: SkillEntry,
  level: SkillLevel,
  result: DamageResult,
  targetHp: number | null,
): CombatTiming {
  const a = attacker.attrs;
  const pvp = attacker.kind === 'player' && target.kind === 'player';
  const notes: string[] = [];

  const castFixed = Math.max(0, pct(a.get(Attr.CT_FIXED_FINAL)) + (pvp ? level.pvpCastFixed : level.castFixed)) *
    Math.max(0, 1 + pct(a.get(Attr.CT_FIXED_PER_FINAL)));
  const castVariable = Math.max(0, pct(a.get(Attr.CT_CHANGE_FINAL)) + (pvp ? level.pvpCastVar : level.castVar)) *
    Math.max(0, 1 + pct(a.get(Attr.CT_CHANGE_PER_FINAL)));
  const castTime = castFixed + castVariable;

  const attacksPerSecond = a.get(Attr.ASPD_FINAL) / 10000;
  const isNormal = skill.damageType === 0 || level.script === 'CommonSkillCritCalc';

  // flat CD attrs are seconds x10000, percents x10000 [inferred to combine like cast time]
  const reduce = (base: number, flat: number, per: number) =>
    base > 0 ? Math.max(0, base + pct(a.get(flat))) * Math.max(0, 1 + pct(a.get(per))) : 0;
  const ownCd = reduce(pvp ? level.pvpCooldown : level.cooldown, Attr.CD_CHANGE, Attr.CD_CHANGE_PER);
  const groupCd = reduce(pvp ? level.pvpGroupCooldown : level.groupCooldown, Attr.GROUP_CD_CHANGE, Attr.GROUP_CD_CHANGE_PER);
  // an ASPD-bound skill cannot be used faster than its share of one attack interval [inferred]
  const actionTime = skill.affectedByAspd && attacksPerSecond > 0 ? (skill.aspdPercent || 1) / attacksPerSecond : 0;

  let cooldown: number;
  let cycleTime: number;
  if (isNormal) {
    cooldown = 0;
    cycleTime = attacksPerSecond > 0 ? 1 / attacksPerSecond : 0;
  } else {
    cooldown = Math.max(ownCd, groupCd);
    cycleTime = castTime + Math.max(cooldown, actionTime);
    if (actionTime > cooldown) notes.push('This skill is bound to attack speed; its action time sets the pace (inferred).');
  }
  if (cycleTime <= 0) {
    notes.push('No cast time, cooldown or attack speed limits this attack in the data; DPS assumes one use per second.');
    cycleTime = 1;
  }

  // expected damage per use: perfect-hit roll, then crit (skips the flee roll) or a normal hit vs FLEE
  const avg = (r: { min: number; max: number }) => (r.min + r.max) / 2;
  const crit = result.critical ? result.critChance : 0;
  const expectedPerCast = result.perfectHitChance *
    (crit * avg(result.critical ?? result.normal) + (1 - crit) * result.hitChance * avg(result.normal));

  const hp = targetHp && targetHp > 0 ? targetHp : target.attrs.get(Attr.MAX_HP_FINAL);
  const dps = expectedPerCast / cycleTime;
  const casts = (dmg: number) => (dmg > 0 ? Math.ceil(hp / dmg) : Infinity);
  // n normal attacks take n swing intervals (60k HP at 30k per 1 s swing = 2 s); for skills the last use
  // only needs its cast to finish, not the cooldown after it
  const timeFor = (n: number) =>
    Number.isFinite(n) ? (isNormal ? n * cycleTime : (n - 1) * cycleTime + castTime) : Infinity;
  const castsToKill = { min: casts(result.normal.max), max: casts(result.normal.min) };

  if (target.kind === 'monster' && hp <= 0) notes.push('This monster has no HP value in the data.');

  return {
    castFixed, castVariable, castTime, cooldown, attacksPerSecond, cycleTime, expectedPerCast,
    dps,
    dpsMin: result.normal.min / cycleTime,
    dpsMax: (result.critical?.max ?? result.normal.max) / cycleTime,
    targetHp: hp,
    // HP / DPS, but never sooner than the first swing (normal attack) or the first cast (skill) can land
    timeToKill: dps > 0 ? Math.max(hp / dps, isNormal ? cycleTime : castTime) : Infinity,
    castsToKill,
    timeToKillRange: { min: timeFor(castsToKill.min), max: timeFor(castsToKill.max) },
    notes,
  };
}
