import { SourcePick } from '../models/build.models';
import { EquipmentEntry, LeveledBonus, MasterEntry } from '../models/master-data.models';
import { AttrNames } from '../services/attr-names';
import { MasterDataService } from '../services/master-data.service';
import { StatOption, leveledOption } from './sources/stat-source';

/** An enchant line and where it can roll. */
export interface EnchantOption extends StatOption {
  /** Equipment slot ids (EquipTable.EquipId) the line can appear on. */
  slots: number[];
  /** Job ids whose line may roll it (effect enchants); empty = any job. */
  professions: number[];
}

interface EnchantRow {
  id: number;
  name: string;
  kind: 'new' | 'newEffect' | 'legacy';
  attr?: number;
  slots?: number[];
  slot?: number;
  profession?: number[];
  levels?: LeveledBonus[];
  effectId?: number;
}

/** Max enchant lines per item: the new system shows three lines (buff/special, basic, common). */
export const MAX_ENCHANT_LINES = 3;

/** A basic "Enchant" line (attribute by level); every other line is an "Effect enchant". */
export function isBasicEnchant(optionId: string): boolean {
  return optionId.startsWith('new-');
}

/** Options a slot accepts: slot 1 (index 0) takes an Enchant or an Effect enchant, slots 2 and 3 basic Enchants only. */
export function enchantSlotOptions<T extends StatOption>(options: readonly T[], slot: number): T[] {
  return slot === 0 ? [...options] : options.filter((o) => isBasicEnchant(o.id));
}

/**
 * The enchant lines that count: slot 1 is an Effect enchant or a basic Enchant, slots 2 and 3 basic Enchants only
 * (1 Effect + 2 Enchant, or 3 Enchant). An Effect enchant in slot 2 or 3, an empty slot and slots past the third are
 * skipped.
 */
export function countedEnchants(picks: readonly (SourcePick | null)[] | undefined): SourcePick[] {
  return (picks ?? []).slice(0, MAX_ENCHANT_LINES).filter((p, i): p is SourcePick => !!p && (i === 0 || isBasicEnchant(p.optionId)));
}

export async function loadEnchantOptions(data: MasterDataService, names: AttrNames): Promise<EnchantOption[]> {
  const [rows, buffs] = await Promise.all([
    data.load<EnchantRow[]>('enchant.json'),
    data.load<MasterEntry[]>('equip-buffs.json'),
  ]);
  const buffById = new Map(buffs.map((b) => [b.id, b]));
  return rows.flatMap((e): EnchantOption[] => {
    if (e.kind === 'new') {
      const name = e.attr != null ? names.of(e.attr) : e.name;
      return [{ ...leveledOption(`new-${e.id}`, name, e.levels ?? [], { group: 'Enchant' }), slots: e.slots ?? [], professions: [] }];
    }
    if (e.kind === 'newEffect') {
      const attrs = (e.effectId ? buffById.get(e.effectId)?.attrs : undefined) ?? [];
      if (!attrs.length) return [];
      return [{
        id: `effect-${e.id}`, name: buffById.get(e.effectId!)!.name, group: 'Effect enchant', amountLabel: '', min: 0, max: 0,
        resolve: () => attrs, slots: e.slot != null ? [e.slot] : [], professions: e.profession ?? [],
      }];
    }
    // legacy EquipEnchantTable lines are not offered
    return [];
  });
}

/** Enchant lines that can roll on this item for a wearer on this job line. */
export function enchantOptionsFor(all: readonly EnchantOption[], item: EquipmentEntry, line: ReadonlySet<number>): EnchantOption[] {
  return all.filter((o) => o.slots.includes(item.slot) &&
    (o.professions.length === 0 || o.professions.some((p) => line.has(p))));
}
