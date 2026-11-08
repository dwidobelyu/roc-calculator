import { StatBonus } from '../models/master-data.models';

/** Mutable bag of attribute values keyed by game attribute id. Missing ids read as 0. */
export class AttrSheet {
  private readonly values = new Map<number, number>();

  get(id: number): number {
    return this.values.get(id) ?? 0;
  }

  set(id: number, value: number): void {
    this.values.set(id, value);
  }

  add(id: number, value: number): void {
    if (value) this.values.set(id, this.get(id) + value);
  }

  addAll(bonuses: readonly StatBonus[]): void {
    for (const b of bonuses) this.add(b.attr, b.value);
  }

  entries(): [number, number][] {
    return [...this.values.entries()].filter(([, v]) => v !== 0).sort((a, b) => a[0] - b[0]);
  }
}
