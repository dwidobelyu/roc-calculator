import { Injectable, signal } from '@angular/core';
import { PlayerBuild, emptyBuild } from '../models/build.models';

const KEY = 'roc-calculator.builds';

/** Named builds saved in this browser only (localStorage). Never required for the calculator to work. */
@Injectable({ providedIn: 'root' })
export class BuildStorageService {
  readonly builds = signal<PlayerBuild[]>(this.read());

  save(build: PlayerBuild): void {
    const rest = this.builds().filter((b) => b.name !== build.name);
    this.write([...rest, structuredClone(build)].sort((a, b) => a.name.localeCompare(b.name)));
  }

  remove(name: string): void {
    this.write(this.builds().filter((b) => b.name !== name));
  }

  get(name: string): PlayerBuild | undefined {
    const b = this.builds().find((x) => x.name === name);
    if (!b) return undefined;
    // fill fields and equipment slots added after the build was saved
    const base = emptyBuild();
    const saved = structuredClone(b);
    // builds saved before pet slots had one active pet: it becomes deployed slot 1
    const old = (saved as { pet?: PlayerBuild['pets']['deployed'][number] }).pet ?? null;
    const pets = saved.pets ?? { ...base.pets, deployed: [old, ...base.pets.deployed.slice(1)] };
    return { ...base, ...saved, pets, equipment: base.equipment.map((slot, i) => saved.equipment?.[i] ?? slot) };
  }

  private read(): PlayerBuild[] {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as PlayerBuild[]).filter((b) => typeof b?.name === 'string') : [];
    } catch {
      return [];
    }
  }

  private write(list: PlayerBuild[]): void {
    this.builds.set(list);
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      // storage blocked or full: keep the in-memory list for this session
    }
  }
}
