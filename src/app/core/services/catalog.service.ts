import { Injectable, inject, signal } from '@angular/core';
import { ProcSource } from '../engine/procs';
import { compareEquipment } from '../engine/equipment-rules';
import { AmmoEntry } from '../engine/ammo';
import { FightTempData } from '../engine/fight-temp';
import { JobBonusData } from '../engine/job-bonus';
import { PassiveSkill } from '../engine/passives';
import { FeatherKind } from '../engine/feathers';
import { PetCombatEntry } from '../engine/pet-combatant';
import { FeatherSuitData, GearSetTier } from '../engine/set-bonuses';
import { MountEntry } from '../engine/mounts';
import { PetEntry, PetLevelData } from '../engine/pets';
import { EnchantOption, loadEnchantOptions } from '../engine/item-options';
import { CardLevelData, InscriptionData, InscriptionGem, collapseSharedLookSlots } from '../engine/item-upgrades';
import { EffectScript, EquipBuff } from '../engine/item-effects';
import { STAT_SOURCE_KINDS } from '../engine/sources/kinds';
import { StatOption } from '../engine/sources/stat-source';
import {
  EquipmentEntry, Enums, JobEntry, JobTables, LeveledBonus, MasterEntry, MonsterEntry, SkillEntry, StatBonus,
  StatPointRules,
} from '../models/master-data.models';
import { AttrNames } from './attr-names';
import { MasterDataService } from './master-data.service';

/** A card or gear effect as stored in cards.json / equipment.json. */
export interface ItemEffect {
  effectId: number;
  effectType?: number;
  desc?: string;
  script?: EffectScript[];
  /** entryEffects: parsed Lua script parameters. */
  params?: Record<string, number | string>;
}

export interface CardEntry extends MasterEntry {
  slots: number[];
  slotNames?: string[];
  /** EquipCardTable quality (1 lowest). */
  color?: number;
  effects?: ItemEffect[];
  /** Awakened "+" cards: stars 1..3, attrs summed up to that star. */
  levels?: (LeveledBonus & { effects?: ItemEffect[] })[];
  /** Base card: id of its awakened "+" version. */
  awakenedCardId?: number;
  /** "+" card: id of the base card. */
  baseCardId?: number;
  /** card-levels.json group ("slot/quality") for its level bonus. */
  levelGroup?: string;
}

export interface StalkerCopyEntry {
  id: number;
  skillId: number;
  skillName: string;
  level: number;
  skillType: number;
  monsterId: number;
  monsterName: string;
  monsterLevel: number;
  monsterRank: number;
  /** true = Shadow Chaser version of the copy, false = Stalker. */
  shadowChaser: boolean;
}

/** refine-suit / enhance-suit / enchant-suit.json rows. */
interface SuitRow extends MasterEntry {
  equipCount: number;
  totalLevel?: number;
  enchantLevel?: number;
  effects?: { effectId: number }[];
}

const toTier = (r: SuitRow): GearSetTier => ({
  id: r.id, name: r.name, pieces: r.equipCount, threshold: r.totalLevel ?? r.enchantLevel ?? 0, attrs: r.attrs ?? [],
  effects: r.effects,
});

/** AttrLimitTable row (attr-limits.json). */
export interface AttrLimit {
  attr: number;
  max: number | null;
  min: number | null;
  control: number | null;
}

/** dynamic-monsters.json dungeon row: DungeonsTable.DynamicFunctionID is the solver's content function. */
export interface DungeonEntry {
  id: number;
  name: string;
  function: number;
}

interface SlotLevels extends MasterEntry {
  slot?: number;
  levels: LeveledBonus[];
}

/** Everything loaded and indexed once. Engine code takes this as plain data; it never fetches. */
export interface Catalog {
  attrNames: AttrNames;
  enums: Enums;
  jobs: JobEntry[];
  jobTables: JobTables;
  statPoints: StatPointRules;
  skills: SkillEntry[];
  skillById: Map<number, SkillEntry>;
  monsters: MonsterEntry[];
  monsterById: Map<number, MonsterEntry>;
  /** Stalker / Shadow Chaser Copy: which monster teaches which skill (SkillRogueTable). */
  stalkerCopy: StalkerCopyEntry[];
  /** Wearable gear incl. Divine Armament, sorted seasonal-first (compareEquipment); Face/Mouth/Back/Fashion are one fixed item each. */
  equipment: EquipmentEntry[];
  equipById: Map<number, EquipmentEntry>;
  cards: CardEntry[];
  cardById: Map<number, CardEntry>;
  refineByGroup: Map<number, LeveledBonus[]>;
  enhanceBySlot: Map<number, LeveledBonus[]>;
  /** Attr bonuses of buff ids referenced by gear and cards (equip-buffs.json). */
  equipBuffAttrs: Map<number, StatBonus[]>;
  /** Full equip-buffs.json rows (description and effect scripts) for the item lists. */
  equipBuffById: Map<number, EquipBuff>;
  /** Card album (deposit) bonus by card id (card-deposit.json); "+" cards use their base card id. */
  cardDeposit: Map<number, StatBonus[]>;
  /** Enchant lines; filter them per item and job with enchantOptionsFor. */
  enchantOptions: EnchantOption[];
  /** Card level bonus tables (CardUp) and Inscription gems for Legendary Ornament accessories. */
  cardLevels: CardLevelData;
  inscriptionOrnaments: ReadonlySet<number>;
  inscriptionGems: InscriptionGem[];
  inscriptionById: Map<number, InscriptionGem>;
  /** Feather (statue jewel) kinds, mounts with their job limits, pets and pet level data. */
  featherKinds: FeatherKind[];
  featherById: Map<number, FeatherKind>;
  mounts: MountEntry[];
  mountById: Map<number, MountEntry>;
  pets: PetEntry[];
  petById: Map<number, PetEntry>;
  petLevels: PetLevelData;
  /** Set bonuses: refine, enhance (Echo), enchant (Syntony) tiers and feather sets; attribute caps. */
  refineSets: GearSetTier[];
  enhanceSets: GearSetTier[];
  enchantSets: GearSetTier[];
  featherSuits: FeatherSuitData;
  attrLimits: AttrLimit[];
  /** Arrows and the skills that consume them; pets as attackers; dynamic-monster content. */
  ammo: AmmoEntry[];
  ammoSkillIds: ReadonlySet<number>;
  petCombat: Map<number, PetCombatEntry>;
  dungeons: DungeonEntry[];
  /** Learned passives (skill tree), job-level bonus stats and fight-temp sources (gear/buff params the damage formulas read). */
  passives: PassiveSkill[];
  passiveById: Map<number, PassiveSkill>;
  jobBonus: JobBonusData;
  fightTemp: FightTempData;
  /** Chance-based proc effects of cards and gear, by effect id. */
  procById: Map<number, ProcSource>;
  /** Options per stat-source kind key, then by option id. */
  sourceOptions: Map<string, StatOption[]>;
  sourceOptionById: Map<string, Map<string, StatOption>>;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly data = inject(MasterDataService);
  private catalog?: Promise<Catalog>;

  /** Loaded catalog for templates; null until ready. */
  readonly current = signal<Catalog | null>(null);
  /** Last load error message; empty when fine. */
  readonly error = signal('');

  load(): Promise<Catalog> {
    this.catalog ??= this.build();
    this.catalog.catch(() => (this.catalog = undefined));
    return this.catalog;
  }

  /** Start (or retry) loading and publish the result to `current` / `error`. Safe to call from every page. */
  async ensureLoaded(): Promise<void> {
    if (this.current()) return;
    this.error.set('');
    try {
      this.current.set(await this.load());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  private async build(): Promise<Catalog> {
    const d = this.data;
    const attrNames = await AttrNames.load(d);
    const [enums, jobs, jobTables, statPoints, skills, monsters, gear, divine, cards, refine, enhance, buffs,
      enchantOptions, stalkerCopy, featherKinds, mountRows, pets, petLevels, refineSuit, enhanceSuit, enchantSuit, featherSuits, attrLimits,
      sources] = await Promise.all([
      d.load<Enums>('enums.json'),
      d.load<JobEntry[]>('jobs.json'),
      d.load<JobTables>('attr_job_tables.json'),
      d.load<StatPointRules>('stat-points.json'),
      d.load<SkillEntry[]>('skills.json'),
      d.load<MonsterEntry[]>('monsters.json'),
      d.load<EquipmentEntry[]>('equipment.json'),
      d.load<EquipmentEntry[]>('divine-equipment.json'),
      d.load<CardEntry[]>('cards.json'),
      d.load<SlotLevels[]>('refine.json'),
      d.load<SlotLevels[]>('enhance.json'),
      d.load<EquipBuff[]>('equip-buffs.json'),
      loadEnchantOptions(d, attrNames),
      d.load<StalkerCopyEntry[]>('stalker-copy.json'),
      d.load<FeatherKind[]>('feather-kinds.json'),
      d.load<(MountEntry & { kind: string })[]>('mounts.json'),
      d.load<PetEntry[]>('pets.json'),
      d.load<PetLevelData>('pet-levels.json'),
      d.load<SuitRow[]>('refine-suit.json'),
      d.load<SuitRow[]>('enhance-suit.json'),
      d.load<SuitRow[]>('enchant-suit.json'),
      d.load<FeatherSuitData>('feather-suits.json'),
      d.load<AttrLimit[]>('attr-limits.json'),
      Promise.all(STAT_SOURCE_KINDS.map(async (k) => [k.key, await k.options(d)] as const)),
    ]);
    // newer data in a named batch: easier to extend than the positional list above
    const [ammo, ammoSkills, petCombat, dynamic, passives, jobBonus, fightTemp, procs, deposit, cardLevels, inscriptions, scriptBuffs] = await Promise.all([
      d.load<AmmoEntry[]>('ammo.json'),
      d.load<Record<string, number>>('ammo-skills.json'),
      d.load<{ pets: PetCombatEntry[] }>('pet-combat.json'),
      d.load<{ dungeons: DungeonEntry[] }>('dynamic-monsters.json'),
      d.load<PassiveSkill[]>('passive-skills.json'),
      d.load<JobBonusData>('job-bonus.json'),
      d.load<FightTempData>('fight-temp.json'),
      d.load<ProcSource[]>('procs.json'),
      d.load<MasterEntry[]>('card-deposit.json'),
      d.load<CardLevelData>('card-levels.json'),
      d.load<InscriptionData>('inscriptions.json'),
      d.load<{ buffId: number; attrs: StatBonus[] }[]>('script-buffs.json'),
    ]);
    // gear/set buffs whose attrs come from a Lua script (e.g. AllStateTable "All Stats +N" of the refine set)
    const scripted = new Map(scriptBuffs.map((b) => [b.buffId, b.attrs]));
    const buffAttrsOf = (b: EquipBuff) => (b.attrs?.length ? b.attrs : scripted.get(b.id) ?? []);
    const sourceOptions = new Map(sources);
    const equipment = collapseSharedLookSlots([...divine, ...gear]).sort(compareEquipment);
    const mounts = mountRows.filter((m) => m.kind === 'mount');
    return {
      attrNames, enums, jobs, jobTables, statPoints, skills, monsters, equipment, cards, enchantOptions, stalkerCopy, cardLevels,
      featherKinds, mounts, pets, petLevels, featherSuits, attrLimits, ammo,
      inscriptionOrnaments: new Set(inscriptions.ornamentIds), inscriptionGems: inscriptions.gems,
      inscriptionById: new Map(inscriptions.gems.map((g) => [g.id, g])),
      ammoSkillIds: new Set(Object.keys(ammoSkills).map(Number)),
      petCombat: new Map(petCombat.pets.map((p) => [p.id, p])),
      dungeons: dynamic.dungeons,
      passives, jobBonus, fightTemp,
      procById: new Map(procs.map((p) => [p.id, p])),
      passiveById: new Map(passives.map((p) => [p.skillId, p])),
      refineSets: refineSuit.map(toTier), enhanceSets: enhanceSuit.map(toTier), enchantSets: enchantSuit.map(toTier),
      featherById: new Map(featherKinds.map((f) => [f.id, f])),
      mountById: new Map(mounts.map((m) => [m.id, m])),
      petById: new Map(pets.map((p) => [p.id, p])),
      monsterById: new Map(monsters.map((m) => [m.id, m])),
      skillById: new Map(skills.map((s) => [s.id, s])),
      equipById: new Map(equipment.map((e) => [e.id, e])),
      cardById: new Map(cards.map((c) => [c.id, c])),
      refineByGroup: new Map(refine.map((r) => [r.id, r.levels])),
      enhanceBySlot: new Map(enhance.map((r) => [r.slot ?? r.id, r.levels])),
      equipBuffAttrs: new Map(buffs.map((b) => [b.id, buffAttrsOf(b)] as const).filter(([, a]) => a.length)),
      equipBuffById: new Map(buffs.map((b) => [b.id, b])),
      cardDeposit: new Map(deposit.map((e) => [e.id, e.attrs ?? []])),
      sourceOptions,
      sourceOptionById: new Map([...sourceOptions].map(([k, opts]) => [k, new Map(opts.map((o) => [o.id, o]))])),
    };
  }
}
