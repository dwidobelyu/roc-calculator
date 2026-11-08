import { StatBonus } from '../models/master-data.models';

/** job-bonus.json: JobAwardTable stats by absolute job level, cumulative along the job line. */
export interface JobBonusData {
  jobChangeLevel: number[];
  maxJobLevel: Record<string, number>;
  /** jobId -> rows sorted by jobLevel; attrs are running totals. */
  bonus: Record<string, { jobLevel: number; attrs: StatBonus[] }[]>;
}

/** Job-level bonus stats of a job at a job level (the last row reached). */
export function jobBonusAttrs(data: JobBonusData, jobId: number, jobLevel: number): StatBonus[] {
  let attrs: StatBonus[] = [];
  for (const row of data.bonus[jobId] ?? []) {
    if (row.jobLevel > jobLevel) break;
    attrs = row.attrs;
  }
  return attrs;
}
