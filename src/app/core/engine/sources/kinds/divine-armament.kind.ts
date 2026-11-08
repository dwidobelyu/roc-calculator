import { AttrNames } from '../../../services/attr-names';
import { MasterDataService } from '../../../services/master-data.service';
import { StatOption, StatSourceKind, rangedOption } from '../stat-source';

interface FurnaceEntry {
  id: number;
  name: string;
  kind: string;
  season?: number;
  /** MysterySeasonAttrIncreaseTable.TypeID: 1 = Permanent Stat, 2 = Seasonal Stat (ESeasonAttrType). */
  typeId?: number;
  attrIds?: number[];
  maxValue?: number;
}

/**
 * Divine Armament seasonal stats (MysterySeasonAttrIncreaseTable), with the rules of the in-game help text:
 * Permanent Stats of every season always apply; Seasonal Stats apply everywhere only for the current season
 * (other seasons only inside their own Nightmare Temple, which the calculator does not model).
 * The current season is taken as the newest season in the data [inferred].
 * Each value goes up to the stat's cap; the in-game cap also scales with the season level (cap x level / 20).
 */
export class DivineArmamentKind implements StatSourceKind {
  readonly key = 'divineArmament';
  readonly label = 'Divine Armament: Seasonal';
  readonly hint =
    'Permanent Stats of every season always count. Seasonal Stats count for the current season only. ' +
    'Enter the value you reached; the cap rises with the season level.';

  async options(data: MasterDataService): Promise<StatOption[]> {
    const [rows, names] = await Promise.all([data.load<FurnaceEntry[]>('divine-armament.json'), AttrNames.load(data)]);
    const furnace = rows.filter((e) => e.kind === 'seasonFurnaceAttr' && e.season != null && e.attrIds?.length);
    const current = Math.max(...furnace.map((e) => e.season!));
    const option = (e: FurnaceEntry, group: string) =>
      rangedOption(`furnace-${e.id}`, `${names.of(e.attrIds![0])} (season ${e.season})`, e.attrIds![0], 0, e.maxValue ?? 0, group);
    return [
      ...furnace.filter((e) => e.typeId === 1).map((e) => option(e, `Permanent Stats, season ${e.season}`)),
      ...furnace.filter((e) => e.typeId === 2 && e.season === current).map((e) => option(e, `Seasonal Stats, season ${current} (current)`)),
    ];
  }
}
