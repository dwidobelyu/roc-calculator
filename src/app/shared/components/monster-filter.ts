import { Component, computed, input, model } from '@angular/core';
import { EMPTY_MONSTER_FILTER, MonsterFilterState, RANK_GROUPS, isFilterActive } from '../../core/engine/monster-filter';
import { Enums } from '../../core/models/master-data.models';

let nextId = 0;

/** Monster filters: name or id, rank (Normal, Mini-boss, MVP, ...), race, element, size and level range. */
@Component({
  selector: 'app-monster-filter',
  template: `
    <fieldset class="filter-box">
      <legend>{{ legend() }}</legend>
      <div class="filter-grid">
        <label class="field" [for]="id + '-q'">
          <span class="field-label">Monster name or id</span>
          <input [id]="id + '-q'" type="search" [value]="filter().query" (input)="patch({ query: $any($event.target).value })" />
        </label>
        <label class="field">
          <span class="field-label">Rank</span>
          <select [value]="filter().rank" (change)="patch({ rank: $any($event.target).value })">
            <option value="">Any rank</option>
            @for (g of ranks; track g.key) {
              <option [value]="g.key" [selected]="g.key === filter().rank">{{ g.label }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span class="field-label">Race</span>
          <select (change)="patch({ race: num($any($event.target).value) })">
            <option value="" [selected]="filter().race == null">Any race</option>
            @for (r of enums().races; track r.id) {
              <option [value]="r.id" [selected]="r.id === filter().race">{{ r.name }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span class="field-label">Element</span>
          <select (change)="patch({ element: num($any($event.target).value) })">
            <option value="" [selected]="filter().element == null">Any element</option>
            @for (e of elements(); track e.id) {
              <option [value]="e.id" [selected]="e.id === filter().element">{{ e.name }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span class="field-label">Size</span>
          <select (change)="patch({ size: num($any($event.target).value) })">
            <option value="" [selected]="filter().size == null">Any size</option>
            @for (s of enums().sizes; track s.id) {
              <option [value]="s.id" [selected]="s.id === filter().size">{{ s.name }}</option>
            }
          </select>
        </label>
        <div class="grid-2 level-range">
          <label class="field" [for]="id + '-min'">
            <span class="field-label">Level from</span>
            <input [id]="id + '-min'" type="number" min="1" [value]="filter().minLevel ?? ''"
              (change)="patch({ minLevel: num($any($event.target).value) })" />
          </label>
          <label class="field" [for]="id + '-max'">
            <span class="field-label">Level to</span>
            <input [id]="id + '-max'" type="number" min="1" [value]="filter().maxLevel ?? ''"
              (change)="patch({ maxLevel: num($any($event.target).value) })" />
          </label>
        </div>
      </div>
      @if (active()) {
        <button type="button" class="button ghost" (click)="filter.set(empty)">Clear filters</button>
      }
    </fieldset>
  `,
})
export class MonsterFilter {
  readonly enums = input.required<Enums>();
  readonly legend = input('Filter monsters');
  readonly filter = model.required<MonsterFilterState>();
  protected readonly id = `mf-${nextId++}`;
  protected readonly ranks = RANK_GROUPS;
  protected readonly empty = EMPTY_MONSTER_FILTER;

  /** Monster body elements are ids 0..9; strip the "Lv.1" suffix the element table carries. */
  protected readonly elements = computed(() =>
    this.enums().elements.filter((e) => e.id < 10).map((e) => ({ id: e.id, name: e.name.replace(/ ?Lv\.1/, '') })));
  protected readonly active = computed(() => isFilterActive(this.filter()));

  protected patch(p: Partial<MonsterFilterState>): void {
    this.filter.update((f) => ({ ...f, ...p }));
  }

  protected num(v: string): number | null {
    return v === '' || !Number.isFinite(+v) ? null : +v;
  }
}
