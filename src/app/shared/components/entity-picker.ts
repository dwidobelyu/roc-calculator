import { Component, computed, input, model } from '@angular/core';

export interface PickerItem {
  id: string | number;
  label: string;
}

let nextId = 0;

/**
 * Searchable picker over thousands of entries using the native input + datalist, which is keyboard
 * accessible without custom ARIA. Labels carry the id ("Name #123") so duplicate names stay distinct.
 */
@Component({
  selector: 'app-entity-picker',
  template: `
    <label class="field" [for]="id">
      <span class="field-label">{{ label() }}</span>
      <input
        [id]="id"
        type="search"
        autocomplete="off"
        [attr.list]="id + '-list'"
        [placeholder]="placeholder()"
        [value]="text()"
        (change)="pick($any($event.target))"
      />
    </label>
    <datalist [id]="id + '-list'">
      @for (o of items(); track o.id) {
        <option [value]="display(o)"></option>
      }
    </datalist>
  `,
})
export class EntityPicker {
  readonly label = input.required<string>();
  readonly items = input.required<PickerItem[]>();
  readonly placeholder = input('Type to search');
  readonly clearOnPick = input(false);
  readonly value = model<string | number | null>(null);
  protected readonly id = `pick-${nextId++}`;

  protected readonly text = computed(() => {
    const v = this.value();
    const hit = v == null ? undefined : this.items().find((o) => o.id === v);
    return hit ? this.display(hit) : '';
  });

  protected display(o: PickerItem): string {
    return `${o.label} #${o.id}`;
  }

  protected pick(el: HTMLInputElement): void {
    const raw = el.value.trim();
    if (!raw) {
      this.value.set(null);
      return;
    }
    const hit = this.items().find((o) => this.display(o) === raw) ??
      this.items().find((o) => o.label.toLowerCase() === raw.toLowerCase());
    if (hit && this.clearOnPick()) {
      this.value.set(hit.id);
      this.value.set(null); // "add" pickers emit the pick, then reset for the next one
      el.value = '';
    } else if (hit) this.value.set(hit.id);
    else el.value = this.text(); // unknown text: restore the current selection
  }
}
