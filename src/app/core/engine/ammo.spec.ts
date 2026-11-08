import { AmmoEntry, ammoFor } from './ammo';

const arrow = (id: number, element: number): AmmoEntry =>
  ({ id, name: '#' + id, element, attrs: [{ attr: 27, value: 50 }], buff: null, profession: [[0, 0]], weaponTypes: [11] });

describe('ammo', () => {
  it('only bows load arrows', () => {
    const all = [arrow(2021001, 0), arrow(2021003, 3)];
    expect(ammoFor(11, all).map((a) => a.id)).toEqual([2021001, 2021003]);
    expect(ammoFor(1, all)).toEqual([]);
  });
});
