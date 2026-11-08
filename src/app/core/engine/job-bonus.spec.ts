import { JobBonusData, jobBonusAttrs } from './job-bonus';

const data: JobBonusData = {
  jobChangeLevel: [10, 50, 90, 130, 170],
  maxJobLevel: { 2101: 90 },
  bonus: { 2101: [
    { jobLevel: 15, attrs: [{ attr: 20, value: 1 }, { attr: 22, value: 1 }] },
    { jobLevel: 20, attrs: [{ attr: 20, value: 1 }, { attr: 22, value: 2 }, { attr: 14, value: 1 }] },
  ] },
};

describe('jobBonusAttrs', () => {
  it('returns the running total of the last award reached', () => {
    expect(jobBonusAttrs(data, 2101, 19)).toEqual([{ attr: 20, value: 1 }, { attr: 22, value: 1 }]);
    expect(jobBonusAttrs(data, 2101, 90)).toHaveLength(3);
  });

  it('is empty below the first award or for a job without awards', () => {
    expect(jobBonusAttrs(data, 2101, 14)).toEqual([]);
    expect(jobBonusAttrs(data, 1000, 10)).toEqual([]);
  });
});
