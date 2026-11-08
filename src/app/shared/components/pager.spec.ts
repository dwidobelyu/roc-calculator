import { pageWindow } from './pager';

describe('pageWindow', () => {
  it('shows first, last and the pages around the current one, with gaps', () => {
    expect(pageWindow(0, 1)).toEqual([0]);
    expect(pageWindow(0, 3)).toEqual([0, 1, 2]);
    expect(pageWindow(5, 20)).toEqual([0, null, 4, 5, 6, null, 19]);
    expect(pageWindow(19, 20)).toEqual([0, null, 18, 19]);
  });
});
