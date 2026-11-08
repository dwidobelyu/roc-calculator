import type { PlayerBuild } from '../../models/build.models';
import { LeveledBonus, MasterEntry, StatBonus } from '../../models/master-data.models';
import type { Catalog } from '../../services/catalog.service';
import { MasterDataService } from '../../services/master-data.service';

/**
 * A pickable thing that grants attributes. `amount` is the level or the rolled value the user sets,
 * bounded by min..max; options with min === max take no input.
 */
export interface StatOption {
  id: string;
  name: string;
  group?: string;
  amountLabel: string;
  min: number;
  max: number;
  resolve(amount: number): StatBonus[];
}

/**
 * One stat-source system (mount, feather, astrocore, ...). Adding a system = one class implementing this,
 * registered in STAT_SOURCE_KINDS. The UI and the build aggregation never change.
 */
export interface StatSourceKind {
  readonly key: string;
  readonly label: string;
  readonly hint: string;
  options(data: MasterDataService): Promise<StatOption[]>;
  /**
   * Optional: which options this build may use (e.g. Seasonal Furnace only for equipped seasons). Applied by the
   * editor and by stat aggregation, so a pick that stops being valid also stops counting.
   */
  availableFor?(build: PlayerBuild, catalog: Catalog): (option: StatOption) => boolean;
}

/** Flat attrs, no input. */
export function fixedOption(e: MasterEntry, group?: string, attrs = e.attrs ?? []): StatOption {
  return { id: String(e.id), name: e.name, group, amountLabel: '', min: 0, max: 0, resolve: () => attrs };
}

/** Cumulative per-level attrs; a level without a row uses the highest row below it. */
export function leveledOption(
  id: string,
  name: string,
  levels: LeveledBonus[],
  opts: { group?: string; label?: string; extra?: StatBonus[] } = {},
): StatOption {
  const sorted = [...levels].sort((a, b) => a.level - b.level);
  const min = sorted[0]?.level ?? 0;
  const max = sorted.at(-1)?.level ?? 0;
  return {
    id, name, group: opts.group, amountLabel: opts.label ?? 'Level', min, max,
    resolve: (lv) => [...(opts.extra ?? []), ...(sorted.findLast((l) => l.level <= lv)?.attrs ?? [])],
  };
}

/** One attribute whose value the user enters inside a rolled range. */
export function rangedOption(id: string, name: string, attr: number, min: number, max: number, group?: string): StatOption {
  return { id, name, group, amountLabel: 'Value', min, max, resolve: (v) => [{ attr, value: v }] };
}
