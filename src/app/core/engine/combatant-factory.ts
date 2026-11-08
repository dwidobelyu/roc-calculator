import { Attr } from '../models/attr';
import { PlayerBuild, SourcePick } from '../models/build.models';
import { Combatant } from '../models/combat.models';
import { LeveledBonus, MonsterEntry, StatBonus } from '../models/master-data.models';
import { Catalog } from '../services/catalog.service';
import { AttrSheet } from './attr-sheet';
import { calculateAttributes } from './attribute-calculator';
import { BOSS_RANKS } from './combat-tables';
import { canEquip, jobLineIds, slotAvailable } from './equipment-rules';
import { MAX_ENCHANT_LINES, countedEnchants, enchantOptionsFor } from './item-options';
import { canLevelCard, cardLevelAttrs, slotItemId } from './item-upgrades';
import { ammoFor } from './ammo';
import { DynamicMonsterInput, dynamicMonsterStats } from './dynamic-monster';
import { petAttrs, petRawSheet } from './pet-combatant';
import { petOwnStats } from './pets';
import { passiveAttrs } from './passives';
import { jobBonusAttrs } from './job-bonus';
import { ActiveEffect, fightTempFrom } from './fight-temp';
import { STAT_SOURCE_KINDS } from './sources/kinds';
import { StatOption } from './sources/stat-source';
import { MAX_BASE_LEVEL } from './stat-points';
import { featherSetBonuses, gearSetBonuses } from './set-bonuses';
import { FEATHER_SLOTS, featherAttrs, featherLevel } from './feathers';
import { canRide, defaultMount, hasJobMount } from './mounts';
import { petEvolutionAttrs } from './pets';

/** One labelled group of attribute bonuses, so the UI can show where each number came from. */
export interface SourceContribution {
  label: string;
  attrs: StatBonus[];
}

const levelAttrs = (levels: LeveledBonus[] | undefined, lv: number) =>
  levels?.findLast((l) => l.level <= lv)?.attrs ?? [];

/** Equipment base attrs, refine, enhance, socketed cards (star and level), inscription and gear buffs that decode to plain attrs. */
export function equipmentContributions(build: PlayerBuild, cat: Catalog): SourceContribution[] {
  const out: SourceContribution[] = [];
  const line = jobLineIds(cat.jobs, build.jobId);
  for (const s of build.equipment) {
    const itemId = slotItemId(s.slot, s.equipId); // Face/Mouth/Back/Fashion always wear their fixed item
    const eq = itemId != null ? cat.equipById.get(itemId) : undefined;
    // gear the job cannot wear, or a slot the job does not have (Trolley, Battle Bird), grants nothing
    if (!eq || !canEquip(eq, line) || !slotAvailable(eq.slot, cat.jobs, build.jobId)) continue;
    const rolled = (eq.rolls ?? []).map((r, i) => ({ attr: r.attr, value: s.rolls?.[i] ?? r.max }));
    out.push({
      label: eq.name,
      attrs: [...(eq.attrs ?? []), ...rolled, ...(eq.effects ?? []).flatMap((e) => cat.equipBuffAttrs.get(e.effectId) ?? [])],
    });
    if (s.refine && eq.refineGroup != null) {
      out.push({ label: `${eq.name} refine +${s.refine}`, attrs: levelAttrs(cat.refineByGroup.get(eq.refineGroup), s.refine) });
    }
    // shortcut: the game caps enhance at min(slot max, player level) (EquipStrengthenmoreMgr); capped at Lv.99 here, not the build's level
    const enhance = Math.min(s.enhance, MAX_BASE_LEVEL);
    if (enhance) {
      out.push({ label: `${eq.slotName} enhance Lv.${enhance}`, attrs: levelAttrs(cat.enhanceBySlot.get(eq.slot), enhance) });
    }
    // only as many cards as the item has slots
    s.cardIds.slice(0, eq.holeNum).forEach((id, hole) => {
      const card = cat.cardById.get(id);
      if (!card || !card.slots.includes(eq.slot)) return;
      // only awakened "+" cards have stars and levels; a base card counts its own attributes only
      const awakened = canLevelCard(card);
      const star = awakened ? s.cardLevels?.[hole] ?? 0 : 0;
      const lv = awakened ? s.cardLv?.[hole] ?? 0 : 0;
      out.push({
        label: card.name + (star ? ` star ${star}` : '') + (lv ? ` Lv.${lv}` : ''),
        attrs: [
          ...(card.attrs ?? []),
          ...(star ? levelAttrs(card.levels, star) : []),
          ...cardLevelAttrs(cat.cardLevels, card.levelGroup, lv, star),
          ...(card.effects ?? []).flatMap((e) => cat.equipBuffAttrs.get(e.effectId) ?? []),
        ],
      });
    });
    out.push(...picksOf(`${eq.name} enchant`, countedEnchants(s.enchants), enchantOptionsFor(cat.enchantOptions, eq, line), MAX_ENCHANT_LINES));
    const gem = s.inscription != null && cat.inscriptionOrnaments.has(eq.id) ? cat.inscriptionById.get(s.inscription) : undefined;
    if (gem) out.push({ label: `${eq.name} inscription: ${gem.name}`, attrs: gem.attrs });
  }
  return out;
}

/** Resolve picks against the options still valid for the item, capped at the number of lines it can hold. */
function picksOf(label: string, picks: SourcePick[] | undefined, valid: StatOption[], max: number): SourceContribution[] {
  const byId = new Map(valid.map((o) => [o.id, o]));
  return (picks ?? []).slice(0, max).flatMap((p) => {
    const o = byId.get(p.optionId);
    return o ? [{ label: `${label}: ${o.name}`, attrs: o.resolve(p.amount) }] : [];
  });
}

/** Active mount (job default when none is chosen), the 10 feathers and the active pet's owner bonus. */
export function characterContributions(build: PlayerBuild, cat: Catalog): SourceContribution[] {
  const out: SourceContribution[] = [];
  // only jobs with their own base mount ride one (Novice has none)
  const chosen = build.mountId != null ? cat.mountById.get(build.mountId) : undefined;
  const mount = !hasJobMount(cat.mounts, build.jobId) ? undefined
    : chosen && canRide(chosen, build.jobId) ? chosen : defaultMount(cat.mounts, build.jobId);
  if (mount) out.push({ label: `Mount: ${mount.name}`, attrs: mount.attrs ?? [] });

  const level = Math.min(build.baseLevel, MAX_BASE_LEVEL);
  (build.feathers ?? []).forEach((f, i) => {
    const kind = f ? cat.featherById.get(f.kindId) : undefined;
    const slot = FEATHER_SLOTS[i];
    // a feather counts only in a slot that accepts its type and at a level the base level allows
    if (!f || !kind || !slot?.accepts.includes(kind.type)) return;
    const lv = featherLevel(f.level, kind, level);
    if (lv > 0) out.push({ label: `${slot.label}: ${kind.name} Lv.${lv}`, attrs: featherAttrs(kind, lv) });
  });

  // learned passives (skill tree): only skills of the job line, gated by weapon type and mount state
  const line = jobLineIds(cat.jobs, build.jobId);
  const weapon = build.equipment.find((e) => e.slot === 1 && e.equipId != null);
  const weaponType = (weapon && cat.equipById.get(weapon.equipId!)?.weaponType) || 0;
  for (const [id, lv] of Object.entries(build.passives ?? {})) {
    const p = cat.passiveById.get(+id);
    if (p && lv > 0 && p.jobIds.some((j) => line.has(j))) {
      out.push({ label: `Passive: ${p.name} Lv.${lv}`, attrs: passiveAttrs(p, lv, weaponType, (build.mounted ?? false) && hasJobMount(cat.mounts, build.jobId)) });
    }
  }
  const jobAttrs = jobBonusAttrs(cat.jobBonus, build.jobId, build.jobLevel ?? 1);
  if (jobAttrs.length) out.push({ label: `Job level ${build.jobLevel} bonus`, attrs: jobAttrs });

  out.push(...petContributions(build, cat));
  return out;
}

/** Gear/card/buff effects that may set fight-temp keys: worn items (with their refine), socketed cards, chosen buffs. */
export function activeEffects(build: PlayerBuild, cat: Catalog): ActiveEffect[] {
  const line = jobLineIds(cat.jobs, build.jobId);
  const out: ActiveEffect[] = [];
  for (const s of build.equipment) {
    const itemId = slotItemId(s.slot, s.equipId);
    const eq = itemId != null ? cat.equipById.get(itemId) : undefined;
    if (!eq || !canEquip(eq, line) || !slotAvailable(eq.slot, cat.jobs, build.jobId)) continue;
    for (const e of eq.effects ?? []) out.push({ effectId: e.effectId, itemId: eq.id, refine: s.refine });
    for (const id of s.cardIds.slice(0, eq.holeNum)) {
      for (const e of cat.cardById.get(id)?.effects ?? []) out.push({ effectId: e.effectId });
    }
  }
  for (const p of build.sources['buff'] ?? []) out.push(+p.optionId);
  return out;
}

/** Card and gear effect ids worn, one per copy, with the name of the card or item that carries each. */
export function wornEffects(build: PlayerBuild, cat: Catalog): { effectId: number; name: string }[] {
  const line = jobLineIds(cat.jobs, build.jobId);
  const out: { effectId: number; name: string }[] = [];
  for (const s of build.equipment) {
    const itemId = slotItemId(s.slot, s.equipId);
    const eq = itemId != null ? cat.equipById.get(itemId) : undefined;
    if (!eq || !canEquip(eq, line) || !slotAvailable(eq.slot, cat.jobs, build.jobId)) continue;
    for (const e of eq.effects ?? []) out.push({ effectId: e.effectId, name: eq.name });
    for (const id of s.cardIds.slice(0, eq.holeNum)) {
      const card = cat.cardById.get(id);
      for (const e of card?.effects ?? []) out.push({ effectId: e.effectId, name: card!.name });
    }
  }
  return out;
}

/** Picks from every stat-source panel (mount, feather, astrocore, pet, buffs, ...). */
export function sourceContributions(build: PlayerBuild, cat: Catalog): SourceContribution[] {
  const out: SourceContribution[] = [];
  for (const kind of STAT_SOURCE_KINDS) {
    const byId = cat.sourceOptionById.get(kind.key);
    const allowed = kind.availableFor?.(build, cat) ?? (() => true);
    for (const p of build.sources[kind.key] ?? []) {
      const opt = byId?.get(p.optionId);
      if (opt && allowed(opt)) out.push({ label: opt.name, attrs: opt.resolve(p.amount) });
    }
  }
  if (build.extraAttrs.length) out.push({ label: 'Manual attributes', attrs: build.extraAttrs });
  return out;
}

export function playerCombatant(
  build: PlayerBuild, cat: Catalog, extra: SourceContribution[] = [],
): { combatant: Combatant; contributions: SourceContribution[] } {
  const s = new AttrSheet();
  const job = cat.jobs.find((j) => j.id === build.jobId);
  const line = jobLineIds(cat.jobs, build.jobId);
  const weaponSlot = build.equipment.find((e) => e.slot === 1 && e.equipId != null);
  const weapon = weaponSlot ? cat.equipById.get(weaponSlot.equipId!) : undefined;
  const weaponType = (weapon && canEquip(weapon, line) && weapon.weaponType) || 0;

  s.set(Attr.JOB, build.jobId);
  s.set(Attr.BASE_LV, Math.min(build.baseLevel, MAX_BASE_LEVEL));
  s.set(Attr.WEAPON_TYPE, weaponType);
  s.set(Attr.BASE_ASPD, [4000, 4101, 4102, 4103, 4201, 4202, 4203].includes(build.jobId) ? 146 : 156);
  s.set(Attr.STR, build.stats.str);
  s.set(Attr.AGI, build.stats.agi);
  s.set(Attr.VIT, build.stats.vit);
  s.set(Attr.INT, build.stats.int);
  s.set(Attr.DEX, build.stats.dex);
  s.set(Attr.LUK, build.stats.luk);

  const contributions = [
    ...equipmentContributions(build, cat), ...gearSetBonuses(build, cat), ...characterContributions(build, cat),
    ...featherSetBonuses(build, cat), ...sourceContributions(build, cat), ...extra,
  ];
  const ammo = build.ammoId != null ? ammoFor(weaponType, cat.ammo).find((a) => a.id === build.ammoId) : undefined;
  if (ammo) contributions.push({ label: `Arrow: ${ammo.name}`, attrs: ammo.attrs });
  for (const c of contributions) s.addAll(c.attrs);
  const offhandSlot = build.equipment.find((e) => e.slot === 2 && e.equipId != null);
  const offhand = offhandSlot ? cat.equipById.get(offhandSlot.equipId!) : undefined;
  applyAttrLimits(s, cat.attrLimits);
  calculateAttributes(s, cat.jobTables, { offhandWeaponType: (offhand && canEquip(offhand, line) && offhand.weaponType) || 0 });
  applyAttrLimits(s, cat.attrLimits);

  return {
    combatant: {
      kind: 'player', name: build.name || job?.name || 'Player', attrs: s, level: Math.min(build.baseLevel, MAX_BASE_LEVEL), job: build.jobId,
      race: 1, // players are Demi-Human
      size: 0, // players are Medium
      element: 0, weaponType, weaponElement: build.weaponElement, isBoss: false,
      ammo: ammo ? { element: ammo.element, skillIds: cat.ammoSkillIds } : undefined,
      fightTemp: fightTempFrom(cat.fightTemp.sources, activeEffects(build, cat)),
    },
    contributions,
  };
}

/**
 * AttrLimitTable caps (e.g. Ignore PDEF % <= 40%, cast time reduction >= -60%). Control 1 rows only carry a floor;
 * a 0 bound next to a non-zero one means "no bound" [inferred from the five rows in the table].
 */
export function applyAttrLimits(s: AttrSheet, limits: Catalog['attrLimits']): void {
  for (const l of limits) {
    let v = s.get(l.attr);
    if (l.max != null && l.max > 0 && l.control !== 1) v = Math.min(v, l.max);
    if (l.min != null && (l.min < 0 || (l.max ?? 0) > 0)) v = Math.max(v, l.min);
    if (v !== s.get(l.attr)) s.set(l.attr, v);
  }
}

/** EntityTable columns -> input attributes (inferred name mapping). */
const MONSTER_COLUMNS: Readonly<Record<string, number>> = {
  STR: Attr.STR, INT: Attr.INT, AGI: Attr.AGI, VIT: Attr.VIT, DEX: Attr.DEX, LUK: Attr.LUK,
  BaseHP: Attr.MAX_HP, BaseSP: Attr.MAX_SP, BaseATK: Attr.BASE_ATK, BaseMATK: Attr.BASE_MATK,
  BaseDEF: Attr.BASE_DEF, BaseMDEF: Attr.BASE_MDEF, WEAPON_ATK: Attr.WEAPON_ATK, WEAPON_MATK: Attr.WEAPON_MATK,
  DEF: Attr.DEF, MDEF: Attr.MDEF, HIT: Attr.HIT, FLEE: Attr.FLEE, CRI: Attr.CRI, CRI_RES: Attr.CRI_RES,
  DAM_UP: Attr.DAM_INCREASE, MDAM_UP: Attr.MDAM_INCREASE, DAM_DOWN: Attr.DAM_REDUC, MDAM_DOWN: Attr.MDAM_REDUC,
  DEF_IGNORE: Attr.IGNORE_DEF, DEF_IGNORE_PERCENT: Attr.IGNORE_DEF_PER, MDEF_IGNORE: Attr.IGNORE_MDEF,
  MDEF_IGNORE_PERCENT: Attr.IGNORE_MDEF_PER, DEEPEN: Attr.DEEPEN, RELIEF: Attr.RELIEF, MDEEPEN: Attr.MDEEPEN,
  MRELIEF: Attr.MRELIEF, C_HIT: Attr.COMPLETE_HIT, C_DODGE: Attr.COMPLETE_DODGE, C_MHIT: Attr.COMPLETE_MHIT,
  C_MDORGE: Attr.COMPLETE_MDODGE, ATTR_BASIC_PVE_RES: Attr.PVE_RES, ATTR_BASIC_PVE_DAM: Attr.PVE_DAM,
};

/** Content inputs for a scaled (DynamicAttr) monster; they come from server tables, so the user supplies them. */
export type DynamicScaling = Pick<DynamicMonsterInput,
  'dynamicAtk' | 'dynamicHp' | 'expectHp' | 'expectDps' | 'expectLv' | 'fn' | 'typeLv' | 'dungeonId'>;

export function monsterCombatant(m: MonsterEntry, cat: Catalog, extra: StatBonus[] = [], scaling?: DynamicScaling): Combatant {
  const s = new AttrSheet();
  s.set(Attr.BASE_LV, m.level);
  s.set(Attr.BASE_ASPD, m.aspd);
  for (const [col, v] of Object.entries(m.stats)) {
    const id = MONSTER_COLUMNS[col];
    if (id != null) s.add(id, v);
  }
  s.addAll(extra);
  calculateAttributes(s, cat.jobTables);
  let level = m.level;
  if (scaling) {
    // CreateMonsterAttr pass (create_monster_attr.lua:7-206) runs on the static finals, then the finals are redone
    const st = (k: string) => m.stats[k] ?? 0;
    const d = dynamicMonsterStats({
      ...scaling, entityId: m.id, typeLevel: m.rank, str: st('STR'), int: st('INT'), agi: st('AGI'), dex: st('DEX'),
      luk: st('LUK'), baseAspd: m.aspd, defFinal: s.get(Attr.DEF_FINAL), mdefFinal: s.get(Attr.MDEF_FINAL),
      hitFinal: s.get(Attr.HIT_FINAL), flee: s.get(Attr.FLEE), tableLevel: m.level, def: s.get(Attr.DEF), mdef: s.get(Attr.MDEF),
    });
    level = d.level;
    s.set(Attr.BASE_LV, d.level); s.set(Attr.MAX_HP, d.maxHp); s.set(Attr.WEAPON_ATK, d.weaponAtk);
    s.set(Attr.WEAPON_MATK, d.weaponMatk); s.set(Attr.HIT, d.hit); s.set(Attr.FLEE, d.flee); s.set(Attr.DEF, d.def);
    s.set(Attr.MDEF, d.mdef); s.set(Attr.IGNORE_DEF, 0); s.set(Attr.IGNORE_MDEF, 0);
    calculateAttributes(s, cat.jobTables);
  }
  return {
    kind: 'monster', name: m.name, attrs: s, level, job: 0, race: m.race, size: m.size,
    element: m.element, weaponType: 0, weaponElement: 0, isBoss: BOSS_RANKS.includes(m.rank),
  };
}

/**
 * Deployed pets: evolution deployed bonus. Assist pets: evolution assist bonus. ROC has no pet star step, so the
 * PetRankUpTable star bonus is not added.
 */
export function petContributions(build: PlayerBuild, cat: Catalog): SourceContribution[] {
  const out: SourceContribution[] = [];
  for (const state of ['deployed', 'assist'] as const) {
    (build.pets?.[state] ?? []).forEach((pick, i) => {
      const pet = pick ? cat.petById.get(pick.petId) : undefined;
      if (!pick || !pet) return;
      const evo = pick.evolution == null ? [] : petEvolutionAttrs(pet, pick.evolution, state);
      const label = `${state === 'deployed' ? 'Deployed' : 'Assist'} pet ${i + 1}: ${pet.name}`;
      out.push({ label: pick.evolution == null ? label : `${label} evolution ${pick.evolution}`, attrs: evo });
    });
  }
  return out;
}

/** The active pet as an attacker: CalculateAttributePet on its base form (no star step in ROC) and level-up stats. */
export function petCombatant(build: PlayerBuild, cat: Catalog): Combatant | null {
  const pick = build.pets?.deployed[0];
  const pet = pick ? cat.petCombat.get(pick.petId) : undefined;
  if (!pick || !pet) return null;
  const raw = petRawSheet(pet, 0, petOwnStats(cat.petLevels, pick.petId, pick.level));
  raw.set(Attr.BASE_LV, pick.level);
  const attrs = petAttrs(raw, cat.jobTables.PetStatAmplifier ?? {});
  const star = pet.stars[0];
  return {
    // pet units take the PvE damage chain here: PetPvpDamProcess (damage_calculator_oversea.lua) is not ported
    kind: 'monster', name: pet.name, attrs, level: pick.level, job: 0,
    race: star?.race ?? pet.race, size: star?.size ?? pet.size, element: star?.element ?? pet.element,
    weaponType: 0, weaponElement: star?.element ?? pet.element, isBoss: false,
  };
}
