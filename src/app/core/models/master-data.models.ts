/** Shapes of the JSON files in public/data. */

export interface StatBonus {
  attr: number;
  value: number;
}

export interface LeveledBonus {
  level: number;
  attrs: StatBonus[];
}

/** Any pickable thing that grants attributes, flat or per level (levels hold cumulative totals). */
export interface MasterEntry {
  id: number;
  name: string;
  attrs?: StatBonus[];
  levels?: LeveledBonus[];
}

export interface AttrDef {
  id: number;
  enum: string;
  kind: 'flat' | 'percent' | 'derived' | 'other';
  display?: string;
}

export interface EquipmentEntry extends MasterEntry {
  slot: number;
  slotName: string;
  weaponType?: number;
  holeNum: number;
  refineGroup?: number;
  refineMax?: number;
  level?: number;
  /** ItemTable.Profession pairs [jobId, flag]; absent means every job can wear it. */
  profession?: [number, number][];
  effects?: { effectId: number }[];
  weaponTypeName?: string;
  /** ItemTable quality and gender lock (sex id as stored; which id is which gender is not decoded). */
  quality?: number;
  sex?: number;
  /** Random entry attributes and scripted entries (EquipAttributeTable); listed, not counted by the calculator. */
  entryAttrs?: StatBonus[];
  entryEffects?: { effectId: number; effectType?: number; params?: Record<string, number | string> }[];
  /** Base attributes rolled within a range (Divine Armament); the rolled value lives in the build. */
  rolls?: { attr: number; min: number; max: number }[];
  /** Divine Armament season (1 = Dawn ... 5 = Aeon) and tier 1..4. */
  season?: number;
  seasonName?: string;
  tier?: number;
  /** Divine Armament: dream affix pool, the gear level its affixes roll at, and how many it can hold. */
  affixGarage?: number;
  gearLevel?: number;
  maxAffixes?: number;
}

export interface StatPointRules {
  /** Total stat points owned at each base level. */
  pointsAtLevel: Record<string, number>;
  /** Total points spent to have a stat at each value (from 1). */
  costToReach: Record<string, number>;
  limits: { attr: number; min: number; max: number }[];
}

export interface SkillLevel {
  level: number;
  script: string;
  hits: number[];
  pvpHits: number[];
  pveRatio: number[];
  pvpRatio: number[];
  pveFlat: number[];
  pvpFlat: number[];
  /** Seconds. */
  cooldown: number;
  pvpCooldown: number;
  groupCooldown: number;
  pvpGroupCooldown: number;
  castVar: number;
  castFixed: number;
  /** SkillEffectTable.SkillCost [attr, amount]; attr 7 = SP. */
  cost?: number[];
  pvpCastVar: number;
  pvpCastFixed: number;
  /** SkillEffectTable PVE/PVPConfigData params (e.g. cripro, cripara, per). */
  config?: Record<string, number>;
  pvpConfig?: Record<string, number>;
  /** Values for the {0}, {1}, ... placeholders of SkillEntry.desc at this level. */
  descRep?: string[];
}

export interface SkillEntry {
  id: number;
  name: string;
  /** Full description template (game rich text, placeholders {0}..{n} filled per level from descRep). */
  desc?: string;
  simpleDesc?: string;
  /** Extra notes shown under the description in game (delay, synergies). */
  descAdd?: string;
  passive: boolean;
  /** SkillTable.SkillDamType: 1 physical, 2 magic (others are utility/special). */
  damageType: number;
  /** Skill element; -1/0 means "use weapon element". */
  element: number;
  aoe: boolean;
  /** Weapon types the skill requires (empty = any). */
  weaponTypes?: number[];
  /** Arrows consumed per cast (SkillTable.IsUseArrow); > 0 means the arrow element applies. */
  arrows?: number;
  /** SkillTable.IsAffectedASPD and ASPDPercent: the action time scales with attack speed. */
  affectedByAspd: boolean;
  aspdPercent: number;
  jobIds: number[];
  monsterIds: number[];
  /** Pets whose attacks use this skill (pet-combat.json). */
  petIds?: number[];
  /** Cards that let any job use this skill (CardAttr type 4, or the GetSkillBuff script), with the granted level. */
  grantedBy?: { itemId: number; name: string; level: number }[];
  levels: SkillLevel[];
}

export interface MonsterEntry {
  id: number;
  name: string;
  level: number;
  race: number;
  element: number;
  size: number;
  rank: number;
  aspd: number;
  inHandbook: boolean;
  /** EntityTable.DynamicAttr: non-zero = stats are rescaled by content (dungeon/event). */
  dynamicAttr: number;
  stats: Record<string, number>;
  skills: { id: number; level: number }[];
}

export interface JobEntry {
  id: number;
  name: string;
  code: string;
  parent: number;
  commonAttackSkill: number;
  skillIds: number[];
}

export interface NamedId {
  id: number;
  name: string;
}

export interface Enums {
  elements: NamedId[];
  races: NamedId[];
  sizes: NamedId[];
}

export interface JobTables {
  /** Pet aptitude weights (CalculateAttributePet). */
  PetStatAmplifier?: Record<string, Record<'HP' | 'SP' | 'ATK' | 'MAG' | 'DEF' | 'MDF' | 'ASPD' | 'CRIT', number>>;
  HPNUM: Record<string, Record<string, number>>;
  SPNUM: Record<string, Record<string, number>>;
  EquipAspd: Record<string, Record<string, number>>;
  ArmorArray: Record<string, number>;
}
