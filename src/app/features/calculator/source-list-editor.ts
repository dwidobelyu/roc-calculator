import { Component, computed, input, model, signal } from '@angular/core';
import { StatOption } from '../../core/engine/sources/stat-source';
import { SourcePick } from '../../core/models/build.models';
import { AttrNames } from '../../core/services/attr-names';
import { AttrList } from '../../shared/components/attr-list';
import { EntityPicker } from '../../shared/components/entity-picker';
import { NumberField } from '../../shared/components/number-field';
import { SectionPanel } from '../../shared/components/section-panel';

/**
 * One editor for every list of stat options: account systems (mount, pet, ...), enchant lines on an item,
 * Divine Armament affixes. Add options, set their level or rolled value, see what they grant.
 */
@Component({
  selector: 'app-source-list-editor',
  imports: [AttrList, EntityPicker, NumberField, SectionPanel],
  template: `
    <app-section-panel [title]="title()" [hint]="hint()" [badge]="badge()">
      @if (groups().length > 1) {
        <label class="field">
          <span class="field-label">Category</span>
          <select [value]="group()" (change)="group.set($any($event.target).value)">
            <option value="">All</option>
            @for (g of groups(); track g) {
              <option [value]="g">{{ g }}</option>
            }
          </select>
        </label>
      }
      @if (full()) {
        <p class="small muted">All {{ maxPicks() }} lines are used. Remove one to add another.</p>
      } @else if (items().length) {
        <app-entity-picker
          [label]="'Add ' + title().toLowerCase()"
          [items]="items()"
          [clearOnPick]="true"
          (valueChange)="add($event)"
        />
      } @else {
        <p class="small muted">{{ emptyText() }}</p>
      }
      @for (row of rows(); track row.pick.optionId + '-' + $index) {
        <div class="source-row" [class.inactive]="!row.active">
          <div class="source-head">
            <strong>{{ row.option.name }}</strong>
            @if (row.option.group) {
              <span class="muted small">{{ row.option.group }}</span>
            }
            <button type="button" class="link-button" (click)="remove($index)" [attr.aria-label]="'Remove ' + row.option.name">
              Remove
            </button>
          </div>
          @if (!row.active) {
            <p class="small muted">Not available with the current gear, so it adds nothing.</p>
          }
          @if (row.option.max > row.option.min) {
            <app-number-field
              [label]="row.option.amountLabel + ' (' + row.option.min + ' to ' + row.option.max + ')'"
              [min]="row.option.min"
              [max]="row.option.max"
              [value]="row.pick.amount"
              (valueChange)="setAmount($index, $event)"
            />
          }
          <app-attr-list [attrs]="row.option.resolve(row.pick.amount)" [names]="names()" />
        </div>
      }
    </app-section-panel>
  `,
})
export class SourceListEditor {
  readonly title = input.required<string>();
  readonly hint = input('');
  readonly options = input.required<StatOption[]>();
  readonly names = input.required<AttrNames>();
  readonly picks = model.required<SourcePick[]>();
  readonly maxPicks = input(Infinity);
  /** Which options the build can currently use; others cannot be added and show as inactive. */
  readonly available = input<(o: StatOption) => boolean>(() => true);
  readonly emptyText = input('Nothing to pick for the current gear.');
  protected readonly group = signal('');

  private readonly byId = computed(() => new Map(this.options().map((o) => [o.id, o])));
  private readonly usable = computed(() => this.options().filter(this.available()));
  protected readonly groups = computed(() => [...new Set(this.usable().map((o) => o.group ?? ''))].filter(Boolean));
  protected readonly items = computed(() =>
    this.usable()
      .filter((o) => !this.group() || o.group === this.group())
      .map((o) => ({ id: o.id, label: o.group && !this.group() ? `${o.name} (${o.group})` : o.name })),
  );
  protected readonly rows = computed(() =>
    this.picks().flatMap((pick, i) => {
      const option = this.byId().get(pick.optionId);
      return option ? [{ pick, option, active: this.available()(option) && i < this.maxPicks() }] : [];
    }),
  );
  protected readonly full = computed(() => this.picks().length >= this.maxPicks());
  protected readonly badge = computed(() => {
    const n = this.picks().length;
    return !n ? '' : Number.isFinite(this.maxPicks()) ? `${n}/${this.maxPicks()}` : n;
  });

  protected add(id: string | number | null): void {
    const o = id == null ? undefined : this.byId().get(String(id));
    if (o && !this.full()) this.picks.update((p) => [...p, { optionId: o.id, amount: o.max > o.min ? o.max : o.min }]);
  }

  protected setAmount(i: number, amount: number): void {
    this.picks.update((p) => p.map((x, j) => (j === i ? { ...x, amount } : x)));
  }

  protected remove(i: number): void {
    this.picks.update((p) => p.filter((_, j) => j !== i));
  }
}
