import { MasterDataService } from '../../../services/master-data.service';
import { AstrocoreKind } from './astrocore.kind';

const lv = (attr: number) => [{ level: 0, attrs: [] }, { level: 1, attrs: [{ attr, value: 10 }] }];
const rows = [
  { id: 1, name: 'Serpenta', kind: 'statue', isOpen: true, levels: lv(27) },
  { id: 7, name: 'Valkyrie - Intimidation', kind: 'statue', isOpen: false, levels: lv(27) },
  { id: 11, name: 'Bridge of Wisdom', kind: 'statuePart', statueId: 1, levels: lv(36) },
  { id: 71, name: 'Part of a closed statue', kind: 'statuePart', statueId: 7, levels: lv(36) },
  { id: 99, name: 'Jewel', kind: 'statueJewel' },
];
const data = { load: () => Promise.resolve(rows) } as unknown as MasterDataService;

describe('AstrocoreKind', () => {
  it('offers the open main stars and their sub-stars only', async () => {
    const opts = await new AstrocoreKind().options(data);
    expect(opts.map((o) => [o.name, o.group])).toEqual([['Serpenta', 'Main star'], ['Serpenta: Bridge of Wisdom', 'Sub-star']]);
    expect(opts[1].resolve(1)).toEqual([{ attr: 36, value: 10 }]);
  });
});
