import { Component, computed, input } from '@angular/core';
import { StatBonus } from '../../core/models/master-data.models';
import { AttrNames } from '../../core/services/attr-names';

/** Read-only list of attribute bonuses with display names and percent formatting. */
@Component({
  selector: 'app-attr-list',
  template: `
    @if (rows().length) {
      <ul class="attr-list">
        @for (r of rows(); track $index) {
          <li><span>{{ r.name }}</span><span class="num">{{ r.value }}</span></li>
        }
      </ul>
    } @else {
      <p class="muted small">{{ empty() }}</p>
    }
  `,
})
export class AttrList {
  readonly attrs = input.required<readonly StatBonus[]>();
  readonly names = input.required<AttrNames>();
  readonly empty = input('No attribute bonus.');

  protected readonly rows = computed(() =>
    this.attrs()
      .filter((a) => a.value !== 0)
      .map((a) => ({ name: this.names().of(a.attr), value: this.names().format(a.attr, a.value) })),
  );
}
