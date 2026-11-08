import { MasterDataService } from '../../../services/master-data.service';
import { StatOption } from '../stat-source';
import { TableSourceKind } from './table-source';

/** Guild skills (GuildSkillLevelTable), type 1 only. Pet guild skills are left out. */
export class GuildSkillKind extends TableSourceKind {
  readonly key = 'guildSkill';
  readonly label = 'Guild skills';
  readonly hint = 'Level of each guild skill you learned.';
  protected readonly file = 'guild-skills.json';

  override async options(data: MasterDataService): Promise<StatOption[]> {
    return (await super.options(data)).filter((o) => o.group === 'Type 1');
  }
}
