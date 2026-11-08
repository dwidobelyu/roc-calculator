import { Component, computed, inject, signal } from '@angular/core';
import {
  EMPTY_MONSTER_FILTER, FilterableMonster, MonsterFilterState, matchesMonster, rankLabel,
} from '../../core/engine/monster-filter';
import { CatalogService, StalkerCopyEntry } from '../../core/services/catalog.service';
import { LoadState } from '../../shared/components/load-state';
import { MonsterFilter } from '../../shared/components/monster-filter';
import { Pager } from '../../shared/components/pager';
import { SkillDescription } from '../../shared/components/skill-description';

/**
 * Copy level the target needs, from the Copy skill description: Lv.1 normal monsters, Lv.2 MINIs, Lv.3 MVPs.
 * Ranks other than Mini-boss and MVP count as normal [inferred].
 */
const PAGE = 50;

function copyLevel(rank: number): number {
  return rank === 5 || rank === 21 ? 3 : rank === 4 ? 2 : 1;
}

/** Skills a Stalker learns with Copy, and the monster to use it on (SkillRogueTable). */
@Component({
  selector: 'app-stalker-copy-page',
  imports: [LoadState, MonsterFilter, Pager, SkillDescription],
  template: `
    <h2>Stalker Copy</h2>
    <p class="muted">
      Copy takes part of a field monster's ability: Lv.1 works on normal monsters, Lv.2 on MINIs, Lv.3 on MVPs.
      Each row is one monster and the skill it gives.
    </p>
    @if (catalogService.current(); as cat) {
      <form class="filters" role="search" (submit)="$event.preventDefault()">
        <label class="field grow">
          <span class="field-label">Copied skill name or id</span>
          <input type="search" [value]="skillQuery()" (input)="setQuery($any($event.target).value)" />
        </label>
      </form>
      <app-monster-filter [enums]="cat.enums" [filter]="monsterFilter()" (filterChange)="setFilter($event)" legend="Filter by target monster" />
      <p #listTop class="small muted" role="status">{{ rows().length }} copy targets match.</p>
      <app-pager [total]="rows().length" [pageSize]="PAGE" [scrollTo]="listTop" [(page)]="page" label="Pages of copy targets, top" />
      @if (rows().length) {
        <div class="table-wrap stack">
          <table class="skills">
            <thead>
              <tr>
                <th scope="col">Target monster</th><th scope="col">Rank</th><th scope="col">Copy level needed</th>
                <th scope="col">Skill learned</th>
              </tr>
            </thead>
            <tbody>
              @for (r of visible(); track r.id) {
                <tr>
                  <td><strong>{{ r.monsterName }}</strong><br /><span class="muted small">#{{ r.monsterId }}, Lv.{{ r.monsterLevel }}</span></td>
                  <td data-label="Rank">{{ rank(r.monsterRank) }}</td>
                  <td class="num" data-label="Copy level needed">Lv.{{ copyLevel(r.monsterRank) }}</td>
                  <td data-label="Skill learned">
                    <strong>{{ r.skillName }}</strong> Lv.{{ r.level }}<br /><span class="muted small">#{{ r.skillId }}</span>
                    @if (cat.skillById.get(r.skillId); as s) {
                      <details>
                        <summary>Description</summary>
                        <app-skill-description [skill]="s" [level]="r.level" />
                      </details>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager [total]="rows().length" [pageSize]="PAGE" [scrollTo]="listTop" [(page)]="page" label="Pages of copy targets, bottom" />
      } @else {
        <p class="empty">No copy target matches these filters.</p>
      }
    } @else {
      <app-load-state />
    }
  `,
})
export class StalkerCopyPage {
  protected readonly catalogService = inject(CatalogService);
  protected readonly skillQuery = signal('');
  protected readonly monsterFilter = signal<MonsterFilterState>(EMPTY_MONSTER_FILTER);
  protected readonly copyLevel = copyLevel;
  protected readonly rank = rankLabel;
  /** Current page, 0-based; every filter change goes back to page 1. */
  protected readonly page = signal(0);
  protected readonly PAGE = PAGE;

  protected setQuery(q: string): void {
    this.skillQuery.set(q);
    this.page.set(0);
  }

  protected setFilter(f: MonsterFilterState): void {
    this.monsterFilter.set(f);
    this.page.set(0);
  }

  protected readonly rows = computed((): StalkerCopyEntry[] => {
    const cat = this.catalogService.current();
    if (!cat) return [];
    const q = this.skillQuery().trim().toLowerCase();
    const f = this.monsterFilter();
    return cat.stalkerCopy.filter((r) => {
      // copy targets outside the monster list still filter by name, id, level and rank (race etc. unknown)
      const m: FilterableMonster = cat.monsterById.get(r.monsterId) ??
        { id: r.monsterId, name: r.monsterName, level: r.monsterLevel, rank: r.monsterRank, race: -1, element: -1, size: -1 };
      return (!q || r.skillName.toLowerCase().includes(q) || String(r.skillId) === q) &&
        matchesMonster(m, f);
    });
  });

  protected readonly visible = computed(() => this.rows().slice(this.page() * PAGE, (this.page() + 1) * PAGE));
}
