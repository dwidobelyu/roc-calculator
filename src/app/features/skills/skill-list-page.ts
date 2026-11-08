import { Component, computed, inject, input, signal } from '@angular/core';
import { WEAPON_TYPES } from '../../core/engine/combat-tables';
import { ScriptInfo, describeScript } from '../../core/engine/damage/script-docs';
import { ElementSource, elementSource, elementSourceLabel } from '../../core/engine/skill-element';
import { EMPTY_MONSTER_FILTER, MonsterFilterState, isFilterActive, matchesMonster } from '../../core/engine/monster-filter';
import { SkillEntry, SkillLevel } from '../../core/models/master-data.models';
import { CALC_STATUS, calcStatus, damageText, useText } from '../../core/engine/skill-summary';
import { Catalog, CatalogService } from '../../core/services/catalog.service';
import { LoadState } from '../../shared/components/load-state';
import { MonsterFilter } from '../../shared/components/monster-filter';
import { SkillDescription } from '../../shared/components/skill-description';
import { SkillEffects } from '../../shared/components/skill-effects';
import { Pager } from '../../shared/components/pager';

export type SkillOwner = 'player' | 'monster';
const PAGE = 50;
type SourceFilter = 'any' | 'weapon' | 'arrow' | 'fixed' | 'forced-neutral';
const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'weapon', label: 'Follows weapon element' },
  { value: 'arrow', label: 'Follows arrow element' },
  { value: 'fixed', label: 'Own fixed element' },
  { value: 'forced-neutral', label: 'Forced neutral' },
];
const DAMAGE_TYPES: Record<number, string> = { 0: 'Normal attack', 1: 'Physical', 2: 'Magic', 3: 'Special' };

/**
 * Skill browser for one owner type (route data `owner`): player skills filter by job, monster skills by the
 * monsters that use them (name or id, rank, race, element, size, level).
 */
@Component({
  selector: 'app-skill-list-page',
  imports: [LoadState, MonsterFilter, Pager, SkillDescription, SkillEffects],
  template: `
    <h2>{{ owner() === 'player' ? 'Player skills' : 'Monster skills' }}</h2>
    <p class="muted">
      Damage, cast time, cooldown and SP are the skill's own values at its highest level, before your stats, gear and
      buffs. Open a skill for every level, its effects and how the calculator computes it.
    </p>
    @if (catalogService.current(); as cat) {
      <form class="filters" role="search" (submit)="$event.preventDefault()">
        <label class="field grow">
          <span class="field-label">Skill name or id</span>
          <input type="search" [value]="query()" (input)="reset(query, $any($event.target).value)" />
        </label>
        @if (owner() === 'player') {
          <label class="field">
            <span class="field-label">Skill type</span>
            <select [value]="origin()" (change)="reset(origin, $any($event.target).value)">
              <option value="job">Job skills</option>
              <option value="card">Card skills</option>
              <option value="equipment">Equipment skills</option>
            </select>
          </label>
        }
        @if (owner() === 'player' && origin() === 'job') {
          <label class="field">
            <span class="field-label">Job</span>
            <select [value]="jobId()" (change)="reset(jobId, +$any($event.target).value)">
              <option value="0">Any job</option>
              @for (j of cat.jobs; track j.id) {
                <option [value]="j.id">{{ j.name }}</option>
              }
            </select>
          </label>
        }
        <label class="field">
          <span class="field-label">Element source</span>
          <select [value]="sourceFilter()" (change)="reset(sourceFilter, $any($event.target).value)">
            @for (o of SOURCE_FILTERS; track o.value) {
              <option [value]="o.value">{{ o.label }}</option>
            }
          </select>
        </label>
      </form>
      @if (owner() === 'monster') {
        <app-monster-filter [enums]="cat.enums" [filter]="monsterFilter()" (filterChange)="reset(monsterFilter, $event)"
          legend="Show skills used by these monsters" />
      }
      <p #listTop class="small muted" role="status">{{ filtered().length }} skills match.</p>
      <app-pager [total]="filtered().length" [pageSize]="PAGE" [scrollTo]="listTop" [(page)]="page" label="Pages of skills, top" />
      @if (filtered().length) {
        <div class="table-wrap stack">
          <table class="skills">
            <thead>
              <tr>
                <th scope="col">Skill</th><th scope="col">Damage at max level</th><th scope="col">Type and element</th>
                <th scope="col">Cast, cooldown and SP</th><th scope="col">In the calculator</th>
                <th scope="col">{{ ownerLabel() }}</th>
              </tr>
            </thead>
            <tbody>
              @for (s of visible(); track s.id) {
                @let top = s.levels.at(-1)!;
                <tr>
                  @let info = script(s);
                  @let calc = status(s, info);
                  <td><strong>{{ s.name }}</strong><br /><span class="muted small">#{{ s.id }}{{ s.passive ? ', passive' : '' }}</span></td>
                  <td data-label="Damage at max level"><span class="muted small">Lv.{{ top.level }}</span><br />{{ damage(top, s, calc) }}</td>
                  <td data-label="Type and element">{{ damageType(s) }}<br /><span class="muted small">{{ elementLabel(cat, s) }}</span></td>
                  <td data-label="Cast, cooldown and SP">{{ use(top) }}</td>
                  <td data-label="In the calculator">{{ STATUS[calc] }}</td>
                  <td class="small" [attr.data-label]="ownerLabel()">{{ owners(cat, s) }}</td>
                </tr>
                <tr class="desc-row">
                  <td colspan="6">
                    <details>
                      <summary>Full description of {{ s.name }}, every level</summary>
                      <app-skill-description [skill]="s" />
                    </details>
                    <details #fx (toggle)="toggleEffects(s.id, fx.open)">
                      <summary>Effects of {{ s.name }}: target, range and buffs</summary>
                      @if (openEffects().has(s.id)) {
                        <app-skill-effects [skillId]="s.id" [names]="cat.attrNames" />
                      }
                    </details>
                    <details>
                      <summary>How the calculator computes {{ s.name }}</summary>
                      <dl class="skill-facts">
                        <dt>Element</dt>
                        <dd>{{ elementLabel(cat, s) }}. {{ elementNote(s) }}</dd>
                        @if (s.weaponTypes?.length) {
                          <dt>Needs weapon</dt>
                          <dd>{{ weapons(s) }}</dd>
                        }
                        <dt>Damage script</dt>
                        <dd>
                          <code>{{ info.script || 'none' }}</code>: {{ STATUS[calc] }}.
                          @if (info.status === 'approximated') {
                            No port of this script yet; computed with the generic <code>{{ info.formula!.script }}</code>.
                          }
                        </dd>
                        @if (info.doc; as doc) {
                          <dt>What it computes</dt>
                          <dd>{{ doc.summary }}</dd>
                          @if (doc.skipped) {
                            <dt>Not computed</dt>
                            <dd>{{ doc.skipped }}</dd>
                          }
                          <dt>Source</dt>
                          <dd>damage_calculator.lua line {{ doc.line }}</dd>
                        }
                      </dl>
                    </details>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager [total]="filtered().length" [pageSize]="PAGE" [scrollTo]="listTop" [(page)]="page" label="Pages of skills, bottom" />
      } @else if (owner() === 'player' && origin() === 'equipment' && !query()) {
        <p class="empty">No equipment in the game data lets you use a skill. Skills that come from cards are under "Card skills".</p>
      } @else {
        <p class="empty">No skill matches these filters.</p>
      }
    } @else {
      <app-load-state />
    }
  `,
})
export class SkillListPage {
  /** Bound from route data. */
  readonly owner = input<SkillOwner>('player');
  protected readonly catalogService = inject(CatalogService);
  protected readonly query = signal('');
  /** Player skills: learned by a job, or usable while a card or a piece of equipment that grants it is worn. */
  protected readonly origin = signal<'job' | 'card' | 'equipment'>('job');
  protected readonly ownerLabel = computed(() =>
    this.owner() === 'monster' ? 'Monsters' : this.origin() === 'job' ? 'Jobs' : this.origin() === 'card' ? 'Granted by card' : 'Granted by equipment');
  /** Skills whose effect panel is open; the 690 KB effect file loads only when one opens. */
  protected readonly openEffects = signal(new Set<number>());

  protected toggleEffects(id: number, open: boolean): void {
    const next = new Set(this.openEffects());
    if (open) next.add(id); else next.delete(id);
    this.openEffects.set(next);
  }
  protected readonly jobId = signal(0);
  protected readonly monsterFilter = signal<MonsterFilterState>(EMPTY_MONSTER_FILTER);
  protected readonly sourceFilter = signal<SourceFilter>('any');
  /** Current page, 0-based; every filter change goes back to page 1. */
  protected readonly page = signal(0);
  protected readonly SOURCE_FILTERS = SOURCE_FILTERS;
  protected readonly STATUS = CALC_STATUS;
  protected readonly PAGE = PAGE;

  protected readonly filtered = computed(() => {
    const cat = this.catalogService.current();
    if (!cat) return [];
    const q = this.query().trim().toLowerCase();
    const src = this.sourceFilter();
    const byText = (s: SkillEntry) => (!q || s.name.toLowerCase().includes(q) || String(s.id) === q) && this.matchesSource(s, src);
    if (this.owner() === 'player') {
      const origin = this.origin();
      if (origin === 'job') return cat.skills.filter((s) => s.jobIds.length > 0 && byText(s) && (!this.jobId() || s.jobIds.includes(this.jobId())));
      // granted by a card or by a piece of equipment, told apart by where the granting item lives
      const from = origin === 'card' ? cat.cardById : cat.equipById;
      return cat.skills.filter((s) => (s.grantedBy ?? []).some((g) => from.has(g.itemId)) && byText(s));
    }
    const f = this.monsterFilter();
    const active = isFilterActive(f);
    const matching = new Set(active ? cat.monsters.filter((m) => matchesMonster(m, f)).map((m) => m.id) : []);
    return cat.skills.filter((s) =>
      s.monsterIds.length > 0 && byText(s) && (!active || s.monsterIds.some((id) => matching.has(id))));
  });
  protected readonly visible = computed(() => this.filtered().slice(this.page() * PAGE, (this.page() + 1) * PAGE));

  /** Set a filter and go back to the first page of results. */
  protected reset<T>(target: { set(v: T): void }, value: T): void {
    target.set(value);
    this.page.set(0);
  }

  protected damageType(s: SkillEntry): string {
    return DAMAGE_TYPES[s.damageType] ?? 'None';
  }

  protected script(s: SkillEntry): ScriptInfo {
    return describeScript(s.levels.at(-1)!.script, s.damageType);
  }

  private source(s: SkillEntry): ElementSource {
    const kind = this.script(s).formula?.damageKind ?? (s.damageType === 2 ? 'magic' : 'physical');
    return elementSource(s, kind);
  }

  private matchesSource(s: SkillEntry, f: SourceFilter): boolean {
    if (f === 'any') return true;
    const src = this.source(s);
    if (f === 'arrow') return src.kind === 'weapon' && src.arrows > 0;
    return src.kind === f;
  }

  protected elementLabel(cat: Catalog, s: SkillEntry): string {
    return elementSourceLabel(this.source(s), (id) =>
      (cat.enums.elements.find((e) => e.id === id)?.name ?? `#${id}`).replace(' Lv.1', ''));
  }

  protected elementNote(s: SkillEntry): string {
    const src = this.source(s);
    switch (src.kind) {
      case 'fixed': return 'The weapon and arrow element do not change it.';
      case 'forced-neutral': return 'Always neutral, even with an elemental weapon, arrow or endow.';
      case 'spell-neutral': return 'A spell with no element of its own; the weapon element does not apply (inferred).';
      case 'weapon': return src.arrows > 0
        ? 'Takes the element of the loaded arrow; without an elemental arrow, the weapon element (inferred from the arrow use flag).'
        : 'Takes the weapon element (weapon, card or endow) (inferred: the skill has no element of its own).';
    }
  }

  protected weapons(s: SkillEntry): string {
    return (s.weaponTypes ?? []).map((w) => WEAPON_TYPES[w] ?? `#${w}`).join(', ');
  }

  protected status(s: SkillEntry, info: ScriptInfo) {
    return calcStatus(info.status, s.desc ?? '');
  }

  protected damage(level: SkillLevel, s: SkillEntry, status: ReturnType<typeof calcStatus>): string {
    return damageText(level, s.damageType, status);
  }

  protected use(level: SkillLevel): string {
    return useText(level);
  }

  protected owners(cat: Catalog, s: SkillEntry): string {
    if (this.owner() === 'player') {
      if (this.origin() === 'job') return s.jobIds.map((id) => cat.jobs.find((j) => j.id === id)?.name ?? `#${id}`).join(', ');
      // the granting items with the level they give, e.g. "Card: Smokie (Lv.1)"; card versions (Time-Space, +) too
      const from = this.origin() === 'card' ? cat.cardById : cat.equipById;
      return [...new Set((s.grantedBy ?? []).filter((g) => from.has(g.itemId)).map((g) => `${g.name} (Lv.${g.level})`))].join(', ');
    }
    const names = [...new Set(s.monsterIds.map((id) => {
      const m = cat.monsterById.get(id);
      return m ? `${m.name} #${m.id}` : `#${id}`;
    }))];
    return names.length > 4 ? `${names.slice(0, 4).join(', ')} and ${names.length - 4} more` : names.join(', ');
  }
}
