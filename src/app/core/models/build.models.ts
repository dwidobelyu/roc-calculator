import { StatBonus } from './master-data.models';

/** One row picked in a stat-source panel: an option id plus the level or rolled value the user set. */
export interface SourcePick {
  optionId: string;
  amount: number;
}

export interface EquipSlotState {
  slot: number;
  equipId: number | null;
  refine: number;
  enhance: number;
  cardIds: number[];
  /** Awakened card star per card slot (0 = base card effect). */
  cardLevels?: number[];
  /** Card level per card slot (CardUp, 0 = not levelled). */
  cardLv?: number[];
  /** Inscription gem on a Legendary Ornament accessory (inscriptions.json gem id); null = none. */
  inscription?: number | null;
  /** Rolled value per EquipmentEntry.rolls entry (Divine Armament base attributes). */
  rolls?: number[];
  /** Enchant slots 1 to 3 by position (EnchantOption id + level or value); null = empty slot. */
  enchants?: (SourcePick | null)[];
}

export interface BaseStats {
  str: number;
  agi: number;
  vit: number;
  int: number;
  dex: number;
  luk: number;
}

/** Everything the user configures for one player. Plain data so it serialises to localStorage as-is. */
export interface PlayerBuild {
  name: string;
  jobId: number;
  baseLevel: number;
  stats: BaseStats;
  /** Element of the weapon (0 Neutral .. 9 Undead), e.g. from an endow or an elemental weapon. */
  weaponElement: number;
  equipment: EquipSlotState[];
  /** Job level (job bonus stats). */
  jobLevel: number;
  /** Learned passive skills: skill id -> level. */
  passives: Record<string, number>;
  /** Arrow/bullet in use (ammo.json id); null = none. */
  ammoId: number | null;
  /** Riding the mount (some passives, e.g. Spear Mastery, add more while mounted). */
  mounted: boolean;
  /** Active mount; null = the job's own mount (e.g. Alpaca for a Priest). */
  mountId: number | null;
  /** The 10 feather slots (5 attack, 5 defense, see FEATHER_SLOTS); null = empty slot. */
  feathers: (FeatherPick | null)[];
  /** Deployed and assist pet slots; null = empty. Deployed slot 1 is the pet that attacks ("Your pet"). */
  pets: { deployed: (PetPick | null)[]; assist: (PetPick | null)[] };
  /** Picks per stat-source kind key (see STAT_SOURCE_KINDS). */
  sources: Record<string, SourcePick[]>;
  /** Free-form attributes for anything the data does not cover. */
  extraAttrs: StatBonus[];
}

export interface FeatherPick {
  kindId: number;
  level: number;
}

export interface PetPick {
  petId: number;
  level: number;
  /** PetEvolutionTable rank 0..10 (deployed and assist bonus); missing in builds saved before it existed. */
  evolution?: number;
}

/** Pet slots per state (as the user's game shows them). */
export const DEPLOYED_PET_SLOTS = 4;
export const ASSIST_PET_SLOTS = 5;

/** Equipment slots the calculator exposes, by EquipTable position id. */
export const EQUIP_SLOTS: readonly { slot: number; label: string }[] = [
  { slot: 1, label: 'Weapon' },
  { slot: 2, label: 'Off-hand' },
  { slot: 3, label: 'Armor' },
  { slot: 4, label: 'Cape' },
  { slot: 5, label: 'Boots' },
  { slot: 6, label: 'Accessory 1' },
  { slot: 6, label: 'Accessory 2' },
  { slot: 7, label: 'Headwear' },
  { slot: 8, label: 'Face' },
  { slot: 9, label: 'Mouth' },
  { slot: 10, label: 'Back' },
  { slot: 15, label: 'Fashion' },
  { slot: 12, label: 'Trolley' },
  { slot: 14, label: 'Battle Bird' },
];

export function emptyBuild(name = 'New build'): PlayerBuild {
  return {
    name,
    jobId: 2000,
    baseLevel: 60,
    stats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 },
    weaponElement: 0,
    equipment: EQUIP_SLOTS.map(({ slot }) => ({ slot, equipId: null, refine: 0, enhance: 0, cardIds: [] })),
    jobLevel: 1,
    passives: {},
    ammoId: null,
    mounted: false,
    mountId: null,
    feathers: Array.from({ length: 10 }, () => null),
    pets: { deployed: Array.from({ length: DEPLOYED_PET_SLOTS }, () => null), assist: Array.from({ length: ASSIST_PET_SLOTS }, () => null) },
    sources: {},
    extraAttrs: [],
  };
}
