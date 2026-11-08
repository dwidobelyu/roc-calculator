import { Component, input } from '@angular/core';

/** Collapsible section built on native details/summary (keyboard and screen-reader support for free). */
@Component({
  selector: 'app-section-panel',
  template: `
    <details class="panel" [open]="open()">
      <summary>
        <span class="panel-title">{{ title() }}</span>
        @if (badge()) {
          <span class="panel-badge">{{ badge() }}</span>
        }
      </summary>
      @if (hint()) {
        <p class="muted small">{{ hint() }}</p>
      }
      <ng-content />
    </details>
  `,
})
export class SectionPanel {
  readonly title = input.required<string>();
  readonly hint = input('');
  readonly badge = input<string | number>('');
  readonly open = input(false);
}
