import { Component, computed, inject, signal } from '@angular/core';
import { Catalog, CardEntry, CatalogService } from '../../core/services/catalog.service';
import { AttrList } from '../../shared/components/attr-list';
import { EffectDetail } from '../../shared/components/effect-detail';
import { LoadState } from '../../shared/components/load-state';
import { plainText } from '../../shared/components/skill-description';
import { Pager } from '../../shared/components/pager';

const PAGE = 50;
type Version = 'all' | 'base' | 'awakened';

/** Card browser: slot, quality, attributes, effects with their scripts, album (deposit) bonus and "+" version. */
@Component({
  selector: 'app-card-list-page',
  imports: [AttrList, EffectDetail, LoadState, Pager],
  template: `
    <h2>Cards</h2>
    <p class="muted">
      Every card from EquipCardTable. Attributes and effects are what the card gives in an equipment slot; the deposit
      bonus is what it gives once stored in the card album. Awakened "+" cards also list their star 1 to 3 bonuses.
    </p>
    @if (catalogService.current(); as cat) {
      <form class="filters" role="search" (submit)="$event.preventDefault()">
        <label class="field grow">
          <span class="field-label">Card name, id or effect text</span>
          <input type="search" [value]="query()" (input)="reset(query, $any($event.target).value)" />
        </label>
        <label class="field">
          <span class="field-label">Slot</span>
          <select [value]="slot()" (change)="reset(slot, $any($event.target).value)">
            <option value="">Any slot</option>
            @for (s of slots(); track s) {
              <option [value]="s">{{ s }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span class="field-label">Quality</span>
          <select [value]="quality()" (change)="reset(quality, +$any($event.target).value)">
            <option value="0">Any quality</option>
            @for (q of qualities(); track q) {
              <option [value]="q">Quality {{ q }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span class="field-label">Version</span>
          <select [value]="version()" (change)="reset(version, $any($event.target).value)">
            <option value="all">Base and awakened</option>
            <option value="base">Base cards</option>
            <option value="awakened">Awakened "+" cards</option>
          </select>
        </label>
      </form>
      <p #listTop class="small muted" role="status">{{ filtered().length }} cards match.</p>
      <app-pager [total]="filtered().length" [pageSize]="PAGE" [scrollTo]="listTop" [(page)]="page" label="Pages of cards, top" />
      @if (filtered().length) {
        <div class="table-wrap stack">
          <table class="skills">
            <thead>
              <tr>
                <th scope="col">Card</th><th scope="col">Slot</th><th scope="col">Quality</th>
                <th scope="col">Attributes</th><th scope="col">Effect</th>
              </tr>
            </thead>
            <tbody>
              @for (c of visible(); track c.id) {
                <tr>
                  <td><strong>{{ c.name }}</strong><br /><span class="muted small">#{{ c.id }}</span></td>
                  <td data-label="Slot">{{ (c.slotNames ?? []).join(', ') }}</td>
                  <td class="num" data-label="Quality">{{ c.color ?? '' }}</td>
                  <td data-label="Attributes"><app-attr-list [attrs]="c.attrs ?? []" [names]="cat.attrNames" empty="None" /></td>
                  <td class="small" data-label="Effect">{{ summary(c) }}</td>
                </tr>
                <tr class="desc-row">
                  <td colspan="5">
                    @if (c.effects?.length) {
                      <details>
                        <summary>Effects and scripts of {{ c.name }}</summary>
                        @for (e of c.effects; track $index) {
                          <app-effect-detail [cat]="cat" [effectId]="e.effectId" [desc]="e.desc" [script]="e.script" />
                        }
                      </details>
                    }
                    <details>
                      <summary>Deposit and upgraded version of {{ c.name }}</summary>
                      <dl class="skill-facts">
                        <dt>Deposit bonus (card album)</dt>
                        <dd>
                          @if (deposit(cat, c); as d) {
                            <app-attr-list [attrs]="d" [names]="cat.attrNames" />
                          } @else {
                            <span class="muted">No deposit bonus.</span>
                          }
                        </dd>
                        @if (c.awakenedCardId) {
                          <dt>Awakened version</dt>
                          <dd>{{ cardName(cat, c.awakenedCardId) }}</dd>
                        }
                        @if (c.baseCardId) {
                          <dt>Base card</dt>
                          <dd>{{ cardName(cat, c.baseCardId) }}</dd>
                        }
                      </dl>
                      @if (c.levels?.length) {
                        <table class="small">
                          <caption class="muted">Star bonuses on top of the card (attributes are totals up to that star)</caption>
                          <thead><tr><th scope="col">Star</th><th scope="col">Attributes</th><th scope="col">Effects</th></tr></thead>
                          <tbody>
                            @for (l of c.levels; track l.level) {
                              <tr>
                                <td class="num">{{ l.level }}</td>
                                <td><app-attr-list [attrs]="l.attrs" [names]="cat.attrNames" empty="None" /></td>
                                <td>
                                  @for (e of l.effects ?? []; track $index) {
                                    <app-effect-detail [cat]="cat" [effectId]="e.effectId" [desc]="e.desc" [script]="e.script" />
                                  } @empty {
                                    <span class="muted">None</span>
                                  }
                                </td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      }
                    </details>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager [total]="filtered().length" [pageSize]="PAGE" [scrollTo]="listTop" [(page)]="page" label="Pages of cards, bottom" />
      } @else {
        <p class="empty">No card matches these filters.</p>
      }
    } @else {
      <app-load-state />
    }
  `,
})
export class CardListPage {
  protected readonly catalogService = inject(CatalogService);
  protected readonly query = signal('');
  protected readonly slot = signal('');
  protected readonly quality = signal(0);
  protected readonly version = signal<Version>('all');
  /** Current page, 0-based; every filter change goes back to page 1. */
  protected readonly page = signal(0);
  protected readonly PAGE = PAGE;

  private readonly cards = computed(() => this.catalogService.current()?.cards ?? []);
  protected readonly slots = computed(() => [...new Set(this.cards().flatMap((c) => c.slotNames ?? []))].sort());
  protected readonly qualities = computed(() =>
    [...new Set(this.cards().map((c) => c.color ?? 0))].filter((q) => q > 0).sort((a, b) => a - b));

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.cards().filter((c) =>
      (!q || c.name.toLowerCase().includes(q) || String(c.id) === q || this.summary(c).toLowerCase().includes(q)) &&
      (!this.slot() || (c.slotNames ?? []).includes(this.slot())) &&
      (!this.quality() || c.color === this.quality()) &&
      (this.version() === 'all' || (this.version() === 'awakened') === (c.baseCardId != null)));
  });
  protected readonly visible = computed(() => this.filtered().slice(this.page() * PAGE, (this.page() + 1) * PAGE));

  protected reset<T>(target: { set(v: T): void }, value: T): void {
    target.set(value);
    this.page.set(0);
  }

  protected summary(c: CardEntry): string {
    return (c.effects ?? []).map((e) => plainText(e.desc ?? '')).filter(Boolean).join(' / ');
  }

  protected deposit(cat: Catalog, c: CardEntry) {
    const d = cat.cardDeposit.get(c.id) ?? (c.baseCardId != null ? cat.cardDeposit.get(c.baseCardId) : undefined);
    return d?.length ? d : null;
  }

  protected cardName(cat: Catalog, id: number): string {
    const c = cat.cardById.get(id);
    return c ? `${c.name} #${id}` : `#${id}`;
  }
}
