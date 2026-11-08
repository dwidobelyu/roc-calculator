import { StatBonus } from '../models/master-data.models';

/** What fires the proc: dealing a hit, releasing a skill, or taking a hit. */
export type ProcTrigger = 'attack' | 'skill' | 'hit';

export type ProcEffect =
  | { kind: 'attrs'; buffId: number; target: 'self' | 'enemy'; attrs: StatBonus[]; durationSec: number }
  | { kind: 'skill'; skillId: number; level: number; atLeastLearned?: boolean }
  | { kind: 'other'; buffId?: number; target?: 'self' | 'enemy'; durationSec?: number; note: string };

/** One chance-based trigger of a card or gear effect (procs.json). */
export interface ProcEntry {
  id: number;
  sourceId: number;
  trigger: ProcTrigger;
  /** Damage-type filter of the hit: normal | physical | physicalSkill | magic | skill. */
  hitType?: string;
  /** 0..1 per trigger event, for one copy. */
  chance: number;
  /** Chance adds up across copies of the same effect ("accumulates trigger chances"). */
  perCopy?: boolean;
  maxChance?: number;
  cooldownSec: number;
  effects: ProcEffect[];
}

/** procs.json row: a card / gear effect id with its procs. */
export interface ProcSource {
  id: number;
  name: string;
  desc: string;
  procs: ProcEntry[];
}

/**
 * Trigger events per second. Keys are a trigger ('attack') or a trigger with a hit type ('attack/magic');
 * the specific key wins, so a magic build sets 'attack/physical': 0.
 */
export type ProcRates = Partial<Record<string, number>>;

export const procRate = (p: ProcEntry, rates: ProcRates): number =>
  (p.hitType ? rates[`${p.trigger}/${p.hitType}`] : undefined) ?? rates[p.trigger] ?? 0;

/**
 * Merge copies: per-copy procs add their chance (capped), non-stacking ones count once.
 * Input may list the same proc once per equipped copy.
 */
export function collapseProcs(procs: ProcEntry[]): ProcEntry[] {
  const byId = new Map<number, ProcEntry>();
  for (const p of procs) {
    const seen = byId.get(p.id);
    if (!seen) byId.set(p.id, p);
    else if (p.perCopy) byId.set(p.id, { ...seen, chance: Math.min(seen.chance + p.chance, p.maxChance ?? 1) });
  }
  return [...byId.values()];
}

/**
 * Share of time a proc buff of `durationSec` is up.
 * Model: a cycle is "wait for the proc" (mean 1 / (chance * rate)) then max(duration, cooldown) during which it cannot
 * proc again, so uptime = D / (max(D, CD) + 1 / (chance * rate)), capped at 1.
 * shortcut: ignores refresh when CD < D (real uptime is a bit higher), switch to 1 - exp(-r*D) style math if it matters.
 */
export function procUptime(p: ProcEntry, durationSec: number, triggersPerSec: number): number {
  const r = p.chance * triggersPerSec;
  if (r <= 0 || durationSec <= 0) return 0;
  return Math.min(1, durationSec / (Math.max(durationSec, p.cooldownSec) + 1 / r));
}

/** Procs per second: one per cycle of cooldown + expected wait. */
export function procsPerSec(p: ProcEntry, triggersPerSec: number): number {
  const r = p.chance * triggersPerSec;
  return r <= 0 ? 0 : 1 / (p.cooldownSec + 1 / r);
}

/** Proc buff attrs weighted by uptime, summed by attr. `target` 'self' = own buffs, 'enemy' = debuffs on the enemy. */
export function expectedProcAttrs(procs: ProcEntry[], rates: ProcRates, target: 'self' | 'enemy' = 'self'): StatBonus[] {
  const sum = new Map<number, number>();
  for (const p of collapseProcs(procs)) {
    const rate = procRate(p, rates);
    for (const e of p.effects) {
      if (e.kind !== 'attrs' || e.target !== target) continue;
      const up = procUptime(p, e.durationSec, rate);
      for (const a of e.attrs) sum.set(a.attr, (sum.get(a.attr) ?? 0) + a.value * up);
    }
  }
  return [...sum].map(([attr, value]) => ({ attr, value: Math.round(value) })).filter((a) => a.value !== 0);
}

export interface ProcSkillCast {
  skillId: number;
  level: number;
  /** Uses the learned level when higher. */
  atLeastLearned: boolean;
  perSec: number;
  /** Expected casts per trigger event: multiply by the skill's damage and add to that event's damage. */
  perTrigger: number;
}

/** Autocast skills with their expected cast rate. */
export function expectedProcSkills(procs: ProcEntry[], rates: ProcRates): ProcSkillCast[] {
  const out: ProcSkillCast[] = [];
  for (const p of collapseProcs(procs)) {
    const rate = procRate(p, rates);
    if (rate <= 0) continue;
    const perSec = procsPerSec(p, rate);
    for (const e of p.effects) {
      if (e.kind === 'skill') {
        out.push({ skillId: e.skillId, level: e.level, atLeastLearned: !!e.atLeastLearned, perSec, perTrigger: perSec / rate });
      }
    }
  }
  return out;
}

/** Procs of the given effect ids (cards, gear), one entry per id occurrence so per-copy chances add up. */
export function procsFor(effectIds: number[], byId: Map<number, ProcSource>): ProcEntry[] {
  return effectIds.flatMap((id) => byId.get(id)?.procs ?? []);
}

/**
 * Trigger rates when the attacker repeats one action `usesPerSec` times per second.
 * shortcut: one trigger event per use (not per hit of a multi-hit skill) and no incoming hits; upgrade if
 * calibration shows per-hit triggers.
 */
export function procRatesFor(kind: 'normal' | 'physical' | 'magic', usesPerSec: number): ProcRates {
  const on = (b: boolean) => (b ? usesPerSec : 0);
  const skill = kind !== 'normal';
  return {
    attack: usesPerSec,
    'attack/normal': on(kind === 'normal'),
    'attack/physical': on(kind !== 'magic'),
    'attack/physicalSkill': on(kind === 'physical'),
    'attack/magic': on(kind === 'magic'),
    'attack/skill': on(skill),
    skill: on(skill),
    hit: 0,
  };
}

/** One proc as shown to the user, with its rate under the current action. */
export interface ProcView {
  source: string;
  desc: string;
  trigger: string;
  chance: number;
  cooldownSec: number;
  /** Trigger events per second for this proc under the current action (0 = never fires). */
  rate: number;
  /** Buff/debuff uptime (0..1), or null for autocast or other effects. */
  uptime: number | null;
  perSec: number;
}

const TRIGGER_LABELS: Record<string, string> = {
  attack: 'On attack', 'attack/normal': 'On normal attack', 'attack/physical': 'On physical attack',
  'attack/physicalSkill': 'On physical skill', 'attack/magic': 'On magic attack', 'attack/skill': 'On skill hit',
  skill: 'On skill use', hit: 'When hit', 'hit/physical': 'When hit by a physical attack', 'hit/magic': 'When hit by magic',
};

/** Rows for the proc panel; `names` maps a source effect id to the card or item that carries it. */
export function procViews(procs: ProcEntry[], rates: ProcRates, byId: Map<number, ProcSource>, names: Map<number, string>): ProcView[] {
  return collapseProcs(procs).map((p) => {
    const rate = procRate(p, rates);
    const buff = p.effects.find((e) => e.kind === 'attrs');
    const key = p.hitType ? `${p.trigger}/${p.hitType}` : p.trigger;
    return {
      source: names.get(p.sourceId) ?? `Effect #${p.sourceId}`,
      desc: byId.get(p.sourceId)?.desc ?? '',
      trigger: TRIGGER_LABELS[key] ?? key,
      chance: p.chance,
      cooldownSec: p.cooldownSec,
      rate,
      uptime: buff?.kind === 'attrs' ? procUptime(p, buff.durationSec, rate) : null,
      perSec: procsPerSec(p, rate),
    };
  });
}
