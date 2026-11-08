import { LeveledBonus } from '../../../models/master-data.models';
import { MasterDataService } from '../../../services/master-data.service';
import { StatOption, StatSourceKind, leveledOption } from '../stat-source';

interface ResearchTrack {
  id: number;
  name: string;
  levels: LeveledBonus[];
}

/** Monster Research (EntityHandBookLvTable): every level reached adds its AddAttr. */
export class MonsterResearchKind implements StatSourceKind {
  readonly key = 'monsterResearch';
  readonly label = 'Monster Research';
  readonly hint = 'Your Monster Research level. The bonus is the sum of every level up to it.';

  async options(data: MasterDataService): Promise<StatOption[]> {
    const rows = await data.load<ResearchTrack[]>('monster-research.json');
    return rows.map((r) => leveledOption(String(r.id), r.name, r.levels));
  }
}
