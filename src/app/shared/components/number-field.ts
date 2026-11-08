import { Component, input, model } from '@angular/core';

let nextId = 0;

/** Labelled numeric input clamped to min..max on change. */
@Component({
  selector: 'app-number-field',
  template: `
    <label class="field" [for]="id">
      <span class="field-label">{{ label() }}</span>
      <input
        [id]="id"
        type="number"
        inputmode="numeric"
        [min]="min()"
        [max]="max()"
        [step]="step()"
        [value]="value()"
        (change)="set($any($event.target))"
      />
    </label>
  `,
})
export class NumberField {
  readonly label = input.required<string>();
  readonly min = input<number>(-1e9);
  readonly max = input<number>(1e9);
  readonly step = input<number>(1);
  readonly value = model.required<number>();
  protected readonly id = `num-${nextId++}`;

  protected set(el: HTMLInputElement): void {
    const n = Number(el.value);
    const clamped = Number.isFinite(n) ? Math.min(Math.max(n, this.min()), this.max()) : this.min();
    this.value.set(clamped);
    // when the clamped value equals the previous one the binding does not change, so fix the box directly
    el.value = String(clamped);
  }
}
