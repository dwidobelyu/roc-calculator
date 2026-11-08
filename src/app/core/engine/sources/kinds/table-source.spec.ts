import { PlayerBuild } from '../../../models/build.models';
import type { Catalog } from '../../../services/catalog.service';
import { MasterDataService } from '../../../services/master-data.service';
import { SourceRow, TableSourceKind } from './table-source';

class TestKind extends TableSourceKind {
  readonly key = 'test';
  readonly label = 'Test';
  readonly hint = '';
  protected readonly file = 'test.json';
}

const rows: SourceRow[] = [
  { id: 1, suffix: 'skill 1', levels: [{ level: 0, attrs: [] }, { level: 2, attrs: [{ attr: 27, value: 5 }] }] },
  { id: 'sw', name: 'Swordsman line', lines: [2000], attrs: [{ attr: 27, value: 1 }] },
  { id: 'lk', name: 'Lord Knight only', jobs: [2102], range: { attr: 27, min: 1, max: 9 } },
];
const files: Record<string, unknown> = { 'test.json': rows, 'attr_ids.json': { attrs: [{ id: 27, enum: 'ATTR_BASIC_WEAPON_ATK', kind: 'flat', display: 'PATK' }] } };
const data = { load: (f: string) => Promise.resolve(files[f]) } as unknown as MasterDataService;
const jobs = [
  { id: 1000, parent: 0 }, { id: 2000, parent: 1000 }, { id: 2101, parent: 2000 }, { id: 2102, parent: 2101 }, { id: 3000, parent: 1000 },
];
const catalog = { jobs } as unknown as Catalog;

describe('TableSourceKind', () => {
  it('names rows after their attributes, resolves levels and gates by job', async () => {
    const kind = new TestKind();
    const opts = await kind.options(data);
    expect(opts.map((o) => o.name)).toEqual(['PATK (skill 1)', 'Swordsman line', 'Lord Knight only']);
    expect(opts[0].resolve(3)).toEqual([{ attr: 27, value: 5 }]);
    expect(opts[2].resolve(4)).toEqual([{ attr: 27, value: 4 }]);
    const ids = (jobId: number) => opts.filter(kind.availableFor({ jobId } as PlayerBuild, catalog)).map((o) => o.id);
    expect(ids(2102)).toEqual(['1', 'sw', 'lk']);
    expect(ids(2101)).toEqual(['1', 'sw']);
    expect(ids(3000)).toEqual(['1']);
  });
});
