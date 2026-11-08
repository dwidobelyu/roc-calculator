import { TableSourceKind } from './table-source';

/** Medals (MedalTable + MedalAttrTable, per job line; mercenary medals excluded). */
export class MedalKind extends TableSourceKind {
  readonly key = 'medal';
  readonly label = 'Medals';
  readonly hint = 'Level of each medal you own. The bonus shown is the total at that level.';
  protected readonly file = 'medals.json';
}
