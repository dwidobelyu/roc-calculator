import { StatBonus } from '../models/master-data.models';

/** One attribute a passive grants; weaponTypes / mounted gate it (absent = always). */
export interface PassiveAttr extends StatBonus {
  /** Only with one of these weapon types equipped (EquipTable.WeaponId). */
  weaponTypes?: number[];
  /** true: only while mounted (extra on top of the base value); false: only while not mounted. */
  mounted?: boolean;
}

export interface PassiveLevel {
  level: number;
  attrs: PassiveAttr[];
  /** Plain-words summary of the gates in attrs. */
  conditions?: string;
  /** Combat-time bonuses (vs race, when hit, ...) not applied by passiveAttrs. */
  conditional?: (PassiveAttr & { condition: string })[];
  /** PassivitySkillEffectTable.ExtraNum: raw params scripts / damage formulas read (e.g. Double Attack chance). */
  extra?: Record<string, number>;
  raw?: unknown[];
}

/** passive-skills.json entry. */
export interface PassiveSkill {
  skillId: number;
  name: string;
  jobIds: number[];
  weaponTypes?: number[];
  /** damage_calculator.lua functions that read this skill's params directly. */
  formulaRefs?: string[];
  levels: PassiveLevel[];
}

/** Attributes a learned passive gives at a skill level with the given weapon (0 = none) and mount state. */
export function passiveAttrs(passive: PassiveSkill, level: number, weaponType: number, mounted = false): StatBonus[] {
  const row = passive.levels.find((l) => l.level === level);
  if (!row) return [];
  return row.attrs
    .filter((a) => !a.weaponTypes || a.weaponTypes.includes(weaponType))
    .filter((a) => a.mounted === undefined || a.mounted === mounted)
    .map(({ attr, value }) => ({ attr, value }));
}
