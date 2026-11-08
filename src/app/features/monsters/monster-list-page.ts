import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MONSTER_RANKS } from '../../core/engine/combat-tables';
import { monsterCombatant } from '../../core/engine/combatant-factory';
import { EMPTY_MONSTER_FILTER, MonsterFilterState, matchesMonster } from '../../core/engine/monster-filter';
import { MonsterEntry } from '../../core/models/master-data.models';
import { Catalog, CatalogService } from '../../core/services/catalog.service';
import { LoadState } from '../../shared/components/load-state';
import { MonsterFilter } from '../../shared/components/monster-filter';
import { Pager } from '../../shared/components/pager';
import { StatsSummary } from '../calculator/stats-summary';

const PAGE = 50;

/**
 * Monster browser: filter by name, rank, race, element, size and level; open a monster for the final stats the
 * calculator uses and its skills, or send it to the calculator as the target.
 */
@Component({
  selector: 'app-monster-list-page',
  imports: [LoadState, MonsterFilter, Pager, RouterLink, StatsSummary],
  template: `
    <h2>Monsters</h2>
    <p class="muted">
      Every monster in the game data with its level, rank, race, element and size. Open a monster for its final stats
      (the same numbers the calculator uses) and its skills, or use it as the target in the calculator.
    </p>
    @if (catalogService.current(); as cat) {
      <app-monster-filter [enums]="cat.enums" [filter]="filter()" (filterChange)="setFilter($event)" legend="Find a monster" />
      <label class="check">
        <input type="checkbox" [checked]="handbookOnly()" (change)="setHandbookOnly($any($event.target).checked)" />
        Only monsters listed in the in-game handbook
      </label>
      <p #listTop class="small muted" role="status">{{ filtered().length }} monsters match.</p>
      <app-pager [total]="filtered().length" [pageSize]="PAGE" [scrollTo]="listTop" [(page)]="page" label="Pages of monsters, top" />
      @if (filtered().length) {
        <div class="table-wrap stack">
          <table class="skills">
            <thead>
              <tr>
                <th scope="col">Monster</th><th scope="col">Level</th><th scope="col">Rank</th>
                <th scope="col">Race / element / size</th><th scope="col">HP</th>
              </tr>
            </thead>
            <tbody>
              @for (m of visible(); track m.id) {
                <tr>
                  <td><strong>{{ m.name }}</strong><br /><span class="muted small">#{{ m.id }}</span></td>
                  <td class="num" data-label="Level">{{ m.level }}</td>
                  <td data-label="Rank">{{ rank(m) }}</td>
                  <td data-label="Race / element / size">{{ traits(cat, m) }}</td>
                  <td class="num" data-label="HP">{{ (m.stats['BaseHP'] ?? 0).toLocaleString() }}</td>
                </tr>
                <tr class="desc-row">
                  <td colspan="5">
                    <details #d (toggle)="toggle(m.id, d.open)">
                      <summary>Stats and skills of {{ m.name }}</summary>
                      @if (open().has(m.id)) {
                        <app-stats-summary [combatant]="unit(cat, m)" />
                        <h3 class="sub-head">Skills</h3>
                        @if (m.skills.length) {
                          <ul class="small">
                            @for (s of m.skills; track $index) {
                              <li>{{ cat.skillById.get(s.id)?.name ?? 'Skill #' + s.id }} Lv.{{ s.level }}</li>
                            }
                          </ul>
                        } @else {
                          <p class="small muted">No skill in the data; it uses normal attacks.</p>
                        }
                      }
                    </details>
                    <a class="button ghost" routerLink="/" [queryParams]="{ monster: m.id }">Use as target in Calculator</a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager [total]="filtered().length" [pageSize]="PAGE" [scrollTo]="listTop" [(page)]="page" label="Pages of monsters, bottom" />
      } @else {
        <p class="empty">No monster matches these filters.</p>
      }
    } @else {
      <app-load-state />
    }
  `,
})
export class MonsterListPage {
  protected readonly catalogService = inject(CatalogService);
  protected readonly filter = signal<MonsterFilterState>(EMPTY_MONSTER_FILTER);
  protected readonly handbookOnly = signal(false);
  /** Current page, 0-based; every filter change goes back to page 1. */
  protected readonly page = signal(0);
  /** Monsters whose details are open; their stats are computed only then. */
  protected readonly open = signal(new Set<number>());
  protected readonly PAGE = PAGE;

  protected readonly filtered = computed(() => {
    const all = this.catalogService.current()?.monsters ?? [];
    const f = this.filter();
    return all.filter((m) => (!this.handbookOnly() || m.inHandbook) && matchesMonster(m, f));
  });
  protected readonly visible = computed(() => this.filtered().slice(this.page() * PAGE, (this.page() + 1) * PAGE));

  protected setFilter(f: MonsterFilterState): void {
    this.filter.set(f);
    this.page.set(0);
  }

  protected setHandbookOnly(on: boolean): void {
    this.handbookOnly.set(on);
    this.page.set(0);
  }

  protected toggle(id: number, isOpen: boolean): void {
    const next = new Set(this.open());
    if (isOpen) next.add(id); else next.delete(id);
    this.open.set(next);
  }

  protected rank(m: MonsterEntry): string {
    return MONSTER_RANKS[m.rank] ?? `Rank ${m.rank}`;
  }

  protected traits(cat: Catalog, m: MonsterEntry): string {
    const name = (list: { id: number; name: string }[], id: number) => list.find((x) => x.id === id)?.name ?? `#${id}`;
    return `${name(cat.enums.races, m.race)} / ${name(cat.enums.elements, m.element).replace(' Lv.1', '')} / ${name(cat.enums.sizes, m.size)}`;
  }

  protected unit(cat: Catalog, m: MonsterEntry) {
    return monsterCombatant(m, cat);
  }
}
