import { MasterDataService } from '../../../services/master-data.service';
import { MountKind } from './mount.kind';

const trait = (id: number, attr: number) => ({
  id, name: `Trait ${id}`, kind: 'mountLevel',
  levels: [{ level: 0, attrs: [{ attr, value: 1 }] }, { level: 70, attrs: [{ attr, value: 50 }] }, { level: 100, attrs: [{ attr, value: 80 }] }],
});
const data = { load: () => Promise.resolve([trait(101, 27), trait(102, 36)]) } as unknown as MasterDataService;

describe('MountKind', () => {
  it('one mount level sets every trait to that level', async () => {
    const [level, ...rest] = await new MountKind().options(data);
    expect(rest).toEqual([]);
    expect([level.id, level.min, level.max]).toEqual(['mountLevel', 0, 100]);
    expect(level.resolve(70)).toEqual([{ attr: 27, value: 50 }, { attr: 36, value: 50 }]);
  });
});
