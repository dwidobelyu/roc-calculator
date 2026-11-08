import { MasterEntry } from '../models/master-data.models';

/** VehicleTable row as extracted: vehicleType 1 = job base mount, 3 = job riding mount, 2 = mount for everyone. */
export interface MountEntry extends MasterEntry {
  vehicleType: number;
  /** Job ids that may ride it; empty = any job. */
  jobLimit: number[];
  /** Time-limited copy of another mount (same stats), hidden from the list. */
  timed?: boolean;
}

export function canRide(m: MountEntry, jobId: number): boolean {
  return m.jobLimit.length === 0 || m.jobLimit.includes(jobId);
}

/** Mounts a job can ride: its own job mounts first, then the shared ones by name. */
export function mountsForJob(all: readonly MountEntry[], jobId: number): MountEntry[] {
  const own = (m: MountEntry) => (m.jobLimit.length ? 0 : 1);
  return all
    .filter((m) => !m.timed && canRide(m, jobId))
    .sort((a, b) => own(a) - own(b) || a.name.localeCompare(b.name));
}

/** The job's base mount (VehicleTable Type 1 with the job in JobLimit), e.g. Alpaca for the Acolyte line. */
export function defaultMount(all: readonly MountEntry[], jobId: number): MountEntry | undefined {
  return all.find((m) => m.vehicleType === 1 && m.jobLimit.includes(jobId)) ??
    all.find((m) => m.jobLimit.includes(jobId));
}

/** Whether the job has its own base mount (VehicleTable Type 1); jobs without one (Novice) get no mount. */
export function hasJobMount(all: readonly MountEntry[], jobId: number): boolean {
  return all.some((m) => m.vehicleType === 1 && m.jobLimit.includes(jobId));
}
