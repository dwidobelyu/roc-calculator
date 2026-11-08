import { PlayerBuild } from '../../../models/build.models';
import { LeveledBonus, StatBonus } from '../../../models/master-data.models';
import { AttrNames } from '../../../services/attr-names';
import type { Catalog } from '../../../services/catalog.service';
import { MasterDataService } from '../../../services/master-data.service';
import { jobLineIds } from '../../equipment-rules';
import { StatOption, StatSourceKind, fixedOption, leveledOption, rangedOption } from '../stat-source';

/**
 * One row of a stat-source file in public/data: flat attrs, cumulative
 * levels or a rolled range. Rows without a name are named after their attributes.
 */
export interface SourceRow {
  id: number | string;
  name?: string;
  suffix?: string;
  group?: string;
  label?: string;
  /** Only for these exact job ids. */
  jobs?: number[];
  /** Only for jobs on the line of one of these job ids (e.g. 2000 = every Swordsman class). */
  lines?: number[];
  attrs?: StatBonus[];
  levels?: LeveledBonus[];
  range?: { attr: number; min: number; max: number };
}

/** A system whose options all come from one SourceRow file. */
export abstract class TableSourceKind implements StatSourceKind {
  abstract readonly key: string;
  abstract readonly label: string;
  abstract readonly hint: string;
  protected abstract readonly file: string;
  private rows = new Map<string, SourceRow>();

  async options(data: MasterDataService): Promise<StatOption[]> {
    const [rows, names] = await Promise.all([data.load<SourceRow[]>(this.file), AttrNames.load(data)]);
    this.rows = new Map(rows.map((r) => [String(r.id), r]));
    return rows.map((r) => toOption(r, names));
  }

  availableFor(build: PlayerBuild, catalog: Catalog): (o: StatOption) => boolean {
    const line = jobLineIds(catalog.jobs, build.jobId);
    return (o) => {
      const r = this.rows.get(o.id);
      return !r || ((!r.jobs || r.jobs.includes(build.jobId)) && (!r.lines || r.lines.some((id) => line.has(id))));
    };
  }
}

function toOption(r: SourceRow, names: AttrNames): StatOption {
  const id = String(r.id);
  const shown = r.attrs ?? r.levels?.at(-1)?.attrs ?? (r.range ? [r.range] : []);
  const base = r.name ?? [...new Set(shown.map((a) => names.of(a.attr)))].join(', ');
  const name = r.suffix ? `${base} (${r.suffix})` : base;
  if (r.range) return rangedOption(id, name, r.range.attr, r.range.min, r.range.max, r.group);
  if (r.levels) return leveledOption(id, name, r.levels, { group: r.group, label: r.label });
  return { ...fixedOption({ id: 0, name }, r.group, r.attrs ?? []), id };
}
