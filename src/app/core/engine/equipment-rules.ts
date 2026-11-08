import { EquipmentEntry, JobEntry } from '../models/master-data.models';

/** Job ids on a job's line: the job itself and every parent (Lord Knight -> Knight -> Swordman -> Novice). */
export function jobLineIds(jobs: readonly JobEntry[], jobId: number): Set<number> {
  const ids = new Set<number>();
  for (let j = jobs.find((x) => x.id === jobId); j && !ids.has(j.id); j = jobs.find((x) => x.id === j!.parent)) {
    ids.add(j.id);
  }
  return ids;
}

/**
 * ItemTable.Profession lists the job ids allowed to wear an item ([[0,0]] or no entry = any job). An item listed
 * for a class is usable by that class and every class above it, so the check is against the wearer's job line.
 */
export function canEquip(item: EquipmentEntry, line: ReadonlySet<number>): boolean {
  const allowed = (item.profession ?? []).map((p) => p[0]).filter((id) => id !== 0);
  return allowed.length === 0 || allowed.some((id) => line.has(id));
}

/** Seasonal Divine Armament first (newest season, then highest tier), then other gear by level and name. */
export function compareEquipment(a: EquipmentEntry, b: EquipmentEntry): number {
  return (b.season ?? 0) - (a.season ?? 0) ||
    (b.tier ?? 0) - (a.tier ?? 0) ||
    (b.level ?? 0) - (a.level ?? 0) ||
    a.name.localeCompare(b.name);
}

export function equipmentLabel(e: EquipmentEntry): string {
  const lv = e.level ? ` Lv.${e.level}` : '';
  return e.season ? `[Season ${e.season} ${e.seasonName}] ${e.name} T${e.tier}${lv}` : `${e.name}${lv}`;
}

/**
 * Slots that need a learned skill (RoleEquipWidget CheckFunc): Trolley needs Pushcart (600012, Merchant line),
 * Battle Bird needs Falconry Mastery (710106, Hunter line). The slot exists only for jobs whose line has the skill.
 */
export const SLOT_SKILL: Readonly<Record<number, number>> = { 12: 600012, 14: 710106 };

export function slotAvailable(slot: number, jobs: readonly JobEntry[], jobId: number): boolean {
  const skill = SLOT_SKILL[slot];
  if (skill == null) return true;
  const line = jobLineIds(jobs, jobId);
  return jobs.some((j) => line.has(j.id) && j.skillIds.includes(skill));
}
