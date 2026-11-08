import { Component, computed, input, model } from '@angular/core';
import { StatBonus } from '../../core/models/master-data.models';
import { AttrNames } from '../../core/services/attr-names';
import { EntityPicker } from '../../shared/components/entity-picker';
import { NumberField } from '../../shared/components/number-field';
import { SectionPanel } from '../../shared/components/section-panel';

/** Free-form attribute rows for anything the extracted data does not cover. Values use game units. */
@Component({
  selector: 'app-attr-editor',
  imports: [EntityPicker, NumberField, SectionPanel],
  template: `
    <app-section-panel
      title="Manual attributes"
      hint="Add any game attribute directly. Percent attributes use game units: 100 = 1%."
      [badge]="attrs().length || ''"
    >
      <app-entity-picker label="Add attribute" [items]="items()" [clearOnPick]="true" (valueChange)="add($event)" />
      @for (a of attrs(); track $index) {
        <div class="inline-row">
          <app-number-field [label]="names().of(a.attr)" [value]="a.value" (valueChange)="set($index, $event)" />
          <button type="button" class="link-button" (click)="remove($index)" [attr.aria-label]="'Remove ' + names().of(a.attr)">
            Remove
          </button>
        </div>
      }
    </app-section-panel>
  `,
})
export class AttrEditor {
  readonly names = input.required<AttrNames>();
  readonly attrs = model.required<StatBonus[]>();

  protected readonly items = computed(() => this.names().all().map((a) => ({ id: a.id, label: this.names().of(a.id) })));

  protected add(id: string | number | null): void {
    if (id != null) this.attrs.update((a) => [...a, { attr: Number(id), value: 0 }]);
  }

  protected set(i: number, value: number): void {
    this.attrs.update((a) => a.map((x, j) => (j === i ? { ...x, value } : x)));
  }

  protected remove(i: number): void {
    this.attrs.update((a) => a.filter((_, j) => j !== i));
  }
}
