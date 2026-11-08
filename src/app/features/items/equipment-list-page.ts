import { Component, computed, inject, signal } from '@angular/core';
import { canEquip, equipmentLabel, jobLineIds, slotAvailable } from '../../core/engine/equipment-rules';
import { requiredJobs } from '../../core/engine/item-effects';
import { MAX_ENCHANT_LINES, enchantOptionsFor } from '../../core/engine/item-options';
import { SHARED_LOOK_NAME, SHARED_LOOK_SLOTS } from '../../core/engine/item-upgrades';
import { EquipmentEntry } from '../../core/models/master-data.models';
import { Catalog, CatalogService } from '../../core/services/catalog.service';
import { AttrList } from '../../shared/components/attr-list';
import { EffectDetail } from '../../shared/components/effect-detail';
import { LoadState } from '../../shared/components/load-state';
import { MAX_BASE_LEVEL } from '../../core/engine/stat-points';
import { Pager } from '../../shared/components/pager';

const PAGE = 50;

/**
 * Equipment browser with the same rules the calculator's equipment editor uses: job line (ItemTable.Profession),
 * slot, card slots, refine and enhance, enchant lines for the job, Divine Armament rolls, Inscription. Face, Mouth, Back
 * and Fashion items all share one stat line per slot in ROC, so they are one combined row.
 */
@Component({
  selector: 'app-equipment-list-page',
  imports: [AttrList, EffectDetail, LoadState, Pager],
  template: `
    <h2>Equipment</h2>
    <p class="muted">
      Every wearable item the calculator offers, Divine Armament first (newest season on top). Pick a job to see only
      what that job can wear, as in the equipment editor.
    </p>
    @if (catalogService.current(); as cat) {
      <form class="filters" role="search" (submit)="$event.preventDefault()">
        <label class="field grow">
          <span class="field-label">Item name or id</span>
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
          <span class="field-label">Weapon type</span>
          <select [value]="weaponType()" (change)="reset(weaponType, $any($event.target).value)">
            <option value="">Any</option>
            @for (w of weaponTypes(); track w) {
              <option [value]="w">{{ w }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span class="field-label">Wearable by job</span>
          <select [value]="jobId()" (change)="reset(jobId, +$any($event.target).value)">
            <option value="0">Any job</option>
            @for (j of cat.jobs; track j.id) {
              <option [value]="j.id">{{ j.name }}</option>
            }
          </select>
        </label>
        <label class="check">
          <input type="checkbox" [checked]="divineOnly()" (change)="reset(divineOnly, $any($event.target).checked)" />
          <span>Divine Armament only</span>
        </label>
      </form>
      <p #listTop class="small muted" role="status">{{ filtered().length }} items match.</p>
      <app-pager [total]="filtered().length" [pageSize]="PAGE" [scrollTo]="listTop" [(page)]="page" label="Pages of items, top" />
      @if (filtered().length) {
        <div class="table-wrap stack">
          <table class="skills">
            <thead>
              <tr>
                <th scope="col">Item</th><th scope="col">Slot</th><th scope="col">Required job</th>
                <th scope="col">Card slots / refine</th><th scope="col">Base attributes</th>
              </tr>
            </thead>
            <tbody>
              @if (sharedLook().length) {
                <tr>
                  <td><strong>{{ SHARED_LOOK_NAME }}</strong><br /><span class="muted small">every item of these slots</span></td>
                  <td data-label="Slot">{{ sharedLookSlots() }}</td>
                  <td class="small" data-label="Required job">Any job</td>
                  <td class="num" data-label="Card slots / refine">{{ sharedLook()[0].holeNum }} / +{{ sharedLook()[0].refineMax ?? 0 }}</td>
                  <td data-label="Base attributes">
                    @for (e of sharedLook(); track e.slot) {
                      <p class="small muted">{{ e.slotName }}</p>
                      <app-attr-list [attrs]="e.attrs ?? []" [names]="cat.attrNames" empty="None" />
                    }
                  </td>
                </tr>
                <tr class="desc-row"><td colspan="5"><p class="small muted">
                  In Ragnarok Origin Classic every Face, Mouth, Back and Fashion item has the same stats, card slots and
                  refine for its slot, so the calculator uses one fixed item per slot.
                </p></td></tr>
              }
              @for (e of visible(); track e.id) {
                <tr>
                  <td><strong>{{ label(e) }}</strong><br /><span class="muted small">#{{ e.id }}{{ e.quality ? ', quality ' + e.quality : '' }}</span></td>
                  <td data-label="Slot">{{ e.slotName }}{{ e.weaponTypeName ? ' (' + e.weaponTypeName + ')' : '' }}</td>
                  <td class="small" data-label="Required job">{{ jobs(cat, e) }}</td>
                  <td class="num" data-label="Card slots / refine">{{ e.holeNum }} / +{{ e.refineMax ?? 0 }}</td>
                  <td data-label="Base attributes">
                    <app-attr-list [attrs]="e.attrs ?? []" [names]="cat.attrNames" [empty]="e.rolls?.length ? 'Rolled, see details' : 'None'" />
                  </td>
                </tr>
                <tr class="desc-row">
                  <td colspan="5">
                    <details>
                      <summary>Calculator details of {{ e.name }}</summary>
                      @let d = details(cat, e);
                      <dl class="skill-facts">
                        <dt>Slot</dt>
                        <dd>{{ e.slotName }} (slot id {{ e.slot }}){{ e.weaponTypeName ? ', ' + e.weaponTypeName : '' }}</dd>
                        <dt>Required job</dt>
                        <dd>{{ jobs(cat, e) }}</dd>
                        @if (e.sex != null) {
                          <dt>Gender lock</dt>
                          <dd>Only one gender can wear it (sex id {{ e.sex }})</dd>
                        }
                        <dt>Card slots</dt>
                        <dd>{{ e.holeNum }}{{ d.cardCount ? ', ' + d.cardCount + ' cards fit this slot' : '' }}</dd>
                        <dt>Refine</dt>
                        <dd>Up to +{{ e.refineMax ?? 0 }}{{ d.refineLevels ? ', refine bonus table with ' + d.refineLevels + ' levels' : ', no refine bonus' }}</dd>
                        <dt>Enhance</dt>
                        <dd>{{ d.enhanceLevels ? d.enhanceLevels + ' levels (bonus by slot)' : 'None' }}</dd>
                        <dt>Enchant</dt>
                        <dd>{{ d.enchantLines ? 'Up to ' + MAX_ENCHANT_LINES + ' lines from ' + d.enchantLines + ' possible lines' + (jobId() ? ' for this job' : ' (all jobs)') : 'None' }}</dd>
                        @if (e.season) {
                          <dt>Divine Armament</dt>
                          <dd>Season {{ e.season }} {{ e.seasonName }}, tier {{ e.tier }}, gear level {{ e.gearLevel ?? e.level }}</dd>
                        }
                        @if (d.inscription) {
                          <dt>Inscription</dt>
                          <dd>One Inscription gem (Legendary Ornament), {{ cat.inscriptionGems.length }} gems available</dd>
                        }
                        @if (e.rolls?.length) {
                          <dt>Rolled base attributes</dt>
                          <dd>
                            @for (r of e.rolls; track $index) {
                              {{ cat.attrNames.of(r.attr) }}: {{ r.min }} to {{ r.max }}<br />
                            }
                          </dd>
                        }
                      </dl>
                    </details>
                    @if (e.effects?.length || e.entryAttrs?.length || e.entryEffects?.length) {
                      <details>
                        <summary>Effects and scripts of {{ e.name }}</summary>
                        @for (x of e.effects ?? []; track $index) {
                          <app-effect-detail [cat]="cat" [effectId]="x.effectId" />
                        }
                        @if (e.entryAttrs?.length || e.entryEffects?.length) {
                          <p class="small muted">Random entries (EquipAttributeTable). Listed only: the calculator does not count them.</p>
                          @if (e.entryAttrs?.length) {
                            <app-attr-list [attrs]="e.entryAttrs!" [names]="cat.attrNames" />
                          }
                          @for (x of e.entryEffects ?? []; track $index) {
                            <app-effect-detail [cat]="cat" [effectId]="x.effectId" [params]="paramText(x.params)" />
                          }
                        }
                      </details>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager [total]="filtered().length" [pageSize]="PAGE" [scrollTo]="listTop" [(page)]="page" label="Pages of items, bottom" />
      } @else {
        <p class="empty">No item matches these filters.</p>
      }
    } @else {
      <app-load-state />
    }
  `,
})
export class EquipmentListPage {
  protected readonly catalogService = inject(CatalogService);
  protected readonly query = signal('');
  protected readonly slot = signal('');
  protected readonly weaponType = signal('');
  protected readonly jobId = signal(0);
  protected readonly divineOnly = signal(false);
  /** Current page, 0-based; every filter change goes back to page 1. */
  protected readonly page = signal(0);
  protected readonly PAGE = PAGE;
  protected readonly MAX_ENCHANT_LINES = MAX_ENCHANT_LINES;
  protected readonly label = equipmentLabel;
  protected readonly SHARED_LOOK_NAME = SHARED_LOOK_NAME;

  private readonly items = computed(() => this.catalogService.current()?.equipment ?? []);
  protected readonly slots = computed(() => [...new Set(this.items().map((e) => e.slotName))].sort());
  protected readonly weaponTypes = computed(() =>
    [...new Set(this.items().flatMap((e) => (e.weaponTypeName ? [e.weaponTypeName] : [])))].sort());

  /** The selected job's line, or every job when none is picked (enchant lines then cover all jobs). */
  private readonly line = computed(() => {
    const cat = this.catalogService.current();
    if (!cat) return new Set<number>();
    return this.jobId() ? jobLineIds(cat.jobs, this.jobId()) : new Set(cat.jobs.map((j) => j.id));
  });

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const line = this.line();
    return this.items().filter((e) =>
      (!q || e.name.toLowerCase().includes(q) || String(e.id) === q) &&
      (!this.slot() || e.slotName === this.slot()) &&
      (!this.weaponType() || e.weaponTypeName === this.weaponType()) &&
      (!this.jobId() || canEquip(e, line)) &&
      (!this.divineOnly() || e.season != null) &&
      !SHARED_LOOK_SLOTS.includes(e.slot) &&
      (!this.jobId() || slotAvailable(e.slot, this.catalogService.current()!.jobs, this.jobId())));
  });
  protected readonly visible = computed(() => this.filtered().slice(this.page() * PAGE, (this.page() + 1) * PAGE));
  /** The fixed Face/Mouth/Back/Fashion entries, when the filters let them through. */
  protected readonly sharedLook = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (this.divineOnly() || this.weaponType() || (q && !SHARED_LOOK_NAME.toLowerCase().includes(q))) return [];
    return this.items().filter((e) => SHARED_LOOK_SLOTS.includes(e.slot) && (!this.slot() || e.slotName === this.slot()));
  });
  protected readonly sharedLookSlots = computed(() => this.sharedLook().map((e) => e.slotName).join(', '));

  protected reset<T>(target: { set(v: T): void }, value: T): void {
    target.set(value);
    this.page.set(0);
  }

  protected jobs(cat: Catalog, e: EquipmentEntry): string {
    const names = requiredJobs(e, cat.jobs);
    return names.length ? `${names.join(', ')} (and their later classes)` : 'Any job';
  }

  protected details(cat: Catalog, e: EquipmentEntry) {
    return {
      cardCount: cat.cards.filter((c) => c.slots.includes(e.slot)).length,
      refineLevels: e.refineGroup != null ? cat.refineByGroup.get(e.refineGroup)?.length ?? 0 : 0,
      enhanceLevels: Math.min(cat.enhanceBySlot.get(e.slot)?.length ?? 0, MAX_BASE_LEVEL),
      enchantLines: enchantOptionsFor(cat.enchantOptions, e, this.line()).length,
      inscription: cat.inscriptionOrnaments.has(e.id),
    };
  }

  protected paramText(p: Record<string, number | string> | undefined): string {
    return p ? Object.entries(p).map(([k, v]) => `${k}=${v}`).join(', ') : '';
  }
}
