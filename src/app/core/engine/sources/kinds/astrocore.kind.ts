import { LeveledBonus, MasterEntry } from '../../../models/master-data.models';
import { MasterDataService } from '../../../services/master-data.service';
import { StatOption, StatSourceKind, leveledOption } from '../stat-source';

interface AstroEntry extends MasterEntry {
  kind: string;
  altName?: string;
  /** StatueTable: the statue is in the game (the 6 main stars); the other 9 rows are not open. */
  isOpen?: boolean;
  /** Sub-star (statue part): the main star it belongs to. */
  statueId?: number;
  levels?: LeveledBonus[];
}

const MAIN = 'Main star';
const SUB = 'Sub-star';

/**
 * Astrocore is the Statue system (StatueMgr.lua). Main stars are the 6 open statues (Serpenta, Sagitta, Felina,
 * Lumia, Alvara, Divinia), each with a level; every main star has 3 sub-stars (statue parts) whose level is
 * stage x 10 + star. Statue jewels are the feathers, set in the Feathers section.
 */
export class AstrocoreKind implements StatSourceKind {
  readonly key = 'astrocore';
  readonly label = 'Astrocore';
  readonly hint = 'Main star: the level of Serpenta, Sagitta, Felina, Lumia, Alvara or Divinia. Sub-star: the 3 sub-stars of each main star, level = stage x 10 + star (stage 9 star 3 = 93). Feathers are set in the Feathers section.';

  async options(data: MasterDataService): Promise<StatOption[]> {
    const rows = await data.load<AstroEntry[]>('astrocore.json');
    const main = new Map(rows.filter((e) => e.kind === 'statue' && e.isOpen).map((e) => [e.id, e]));
    return [
      ...[...main.values()].map((e) => leveledOption(String(e.id), e.name, e.levels ?? [], { group: MAIN })),
      ...rows
        .filter((e) => e.kind === 'statuePart' && e.statueId != null && main.has(e.statueId))
        .map((e) => leveledOption(String(e.id), `${main.get(e.statueId!)!.name}: ${e.name}`, e.levels ?? [],
          { group: SUB, label: 'Level (stage x 10 + star)' })),
    ];
  }
}
