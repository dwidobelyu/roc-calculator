import { PlayerBuild } from '../../../models/build.models';
import { LeveledBonus, MasterEntry } from '../../../models/master-data.models';
import type { Catalog } from '../../../services/catalog.service';
import { MasterDataService } from '../../../services/master-data.service';
import { hasJobMount } from '../../mounts';
import { StatOption, StatSourceKind, leveledOption } from '../stat-source';

interface MountEntry extends MasterEntry {
  kind: 'mount' | 'mountLevel' | 'mountQuality' | 'mountQualityStage' | 'mountEquip';
  levels?: LeveledBonus[];
}

const GROUPS: Partial<Record<MountEntry['kind'], [string, string]>> = {
  mountQuality: ['Trait quality', 'Quality'],
  mountEquip: ['Mount equipment', 'Level'],
};

/** Mount level (one level for every trait), trait quality, mount equipment. Only for jobs that have a base mount. */
export class MountKind implements StatSourceKind {
  readonly key = 'mount';
  readonly label = 'Mount level';
  readonly hint = 'One mount level sets every trait (Bravery, Smart, Love, Lively, Cute) to that level. Also trait quality and mount equipment. The active mount is set in Character.';

  async options(data: MasterDataService): Promise<StatOption[]> {
    const rows = await data.load<MountEntry[]>('mounts.json');
    const traits = rows.filter((e) => e.kind === 'mountLevel').map((e) => leveledOption(String(e.id), e.name, e.levels ?? []));
    const level: StatOption[] = traits.length
      ? [{
          id: 'mountLevel', name: 'Mount level (all traits)', group: 'Mount level', amountLabel: 'Level',
          min: Math.min(...traits.map((t) => t.min)), max: Math.max(...traits.map((t) => t.max)),
          resolve: (lv) => traits.flatMap((t) => t.resolve(lv)),
        }]
      : [];
    // the active mount itself is picked per job in the build editor (mounts.ts)
    return [...level, ...rows.flatMap((e): StatOption[] => {
      const g = GROUPS[e.kind];
      return g ? [leveledOption(String(e.id), e.name, e.levels ?? [], { group: g[0], label: g[1] })] : [];
    })];
  }

  /** A job without its own mount (Novice) gets nothing from mount training. */
  availableFor(build: PlayerBuild, catalog: Catalog): (o: StatOption) => boolean {
    const ok = hasJobMount(catalog.mounts, build.jobId);
    return () => ok;
  }
}
