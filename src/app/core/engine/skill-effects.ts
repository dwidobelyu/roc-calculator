import { StatBonus } from '../models/master-data.models';

/** skill-effects.json (calculator/tools/x_skill_effects.js): cast target, range and the buff chain per skill level. */
export interface SkillEffectData {
  skills: Record<string, { target: number; area: number; levels: SkillEffectLevel[] }>;
  buffs: Record<string, EffectBuff>;
}

export interface SkillEffectLevel {
  level: number;
  /** FarRange, metres. */
  castRange: number;
  /** EffectRange, metres (area radius). */
  radius: number[];
  /** CreateBuff: [buff id, chance out of 10000]. */
  buffs?: [number, number][];
  /** CreateGroupBuff: party buffs. */
  partyBuffs?: number[];
}

export interface EffectBuff {
  name: string;
  desc: string;
  debuff: boolean;
  /** DestroyTiming [kind, value]; kind 1 = lasts value seconds. */
  end: number[][];
  effects: EffectLine[];
}

export interface EffectLine {
  type: number;
  param: string;
  every?: number;
  cond?: string;
  /** BuffEffectTable.TargetType, not decoded. */
  target?: number;
  range?: number[];
  count?: number;
  /** Buffs this line adds (followed in the chain). */
  buffs?: number[];
}

/** SkillTable.TargetType, inferred from known skills (Bash 4, Blessing 2, Endure 1, Heal 0). */
const CAST_TARGET: Record<number, string> = { [-1]: 'No target', 0: 'An ally or an enemy', 1: 'Yourself', 2: 'An ally', 4: 'An enemy' };
/** SkillTable.SkillTargetRangeType, inferred (Bash 0, Sanctuary 2, Magnum Break 3). */
const CAST_AREA: Record<number, string> = { 0: 'one unit', 2: 'a spot on the ground', 3: 'the area around you' };

export function castTargetLabel(target: number, area: number): string {
  const who = CAST_TARGET[target] ?? `Target type ${target} (not decoded)`;
  const where = CAST_AREA[area];
  return where ? `${who}, ${where}` : who;
}

export function buffDuration(end: readonly number[][]): string {
  if (!end.length) return 'No time limit in the data';
  return end.map(([kind, v]) => (kind === 1 ? `Lasts ${v} s` : `Ends by rule ${kind} (${v}), not decoded`)).join('; ');
}

/** Attribute changes of HPSPChange (1), AttributeChange (2) and BuffAttributeChange (21) lines ("attr=value|..."). */
export function lineAttrs(line: EffectLine): StatBonus[] | null {
  if (![1, 2, 21].includes(line.type) || !/^-?\d+=-?\d+(\|-?\d+=-?\d+)*$/.test(line.param)) return null;
  return line.param.split('|').map((p) => {
    const [attr, value] = p.split('=').map(Number);
    return { attr, value };
  });
}

export interface BuffRow {
  id: number;
  depth: number;
  buff: EffectBuff;
  /** Chance out of 10000, for buffs the skill creates directly. */
  chance?: number;
  party?: boolean;
}

/** The buff chain as a flat, indented list; a buff already shown higher up is not repeated (chains can loop). */
export function buffChain(data: SkillEffectData, level: SkillEffectLevel): BuffRow[] {
  const out: BuffRow[] = [];
  const seen = new Set<number>();
  const walk = (id: number, depth: number, extra: Partial<BuffRow>) => {
    const buff = data.buffs[id];
    if (!buff || seen.has(id)) return;
    seen.add(id);
    out.push({ id, depth, buff, ...extra });
    for (const line of buff.effects) for (const child of line.buffs ?? []) walk(child, depth + 1, {});
  };
  for (const [id, chance] of level.buffs ?? []) walk(id, 0, { chance });
  for (const id of level.partyBuffs ?? []) walk(id, 0, { party: true });
  return out;
}
