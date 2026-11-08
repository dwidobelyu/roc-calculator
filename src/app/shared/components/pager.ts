import { Component, computed, input, model } from '@angular/core';

/** Page numbers to show (0-based): first, last and the pages around the current one; null marks a gap. */
export function pageWindow(page: number, count: number): (number | null)[] {
  const keep = new Set([0, count - 1, page - 1, page, page + 1].filter((p) => p >= 0 && p < count));
  const sorted = [...keep].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? [null, p] : [p]));
}

/**
 * Page buttons for a long list: Previous, numbered pages, Next and "51-100 of 1,234". Hidden when everything fits on
 * one page. Changing page scrolls `scrollTo` (the top of the list) into view.
 */
@Component({
  selector: 'app-pager',
  template: `
    @if (count() > 1) {
      <nav class="pager" [attr.aria-label]="label()">
        <button type="button" class="button ghost" [disabled]="page() === 0" (click)="go(page() - 1)">Previous</button>
        @for (p of pages(); track $index) {
          @if (p === null) {
            <span class="pager-gap" aria-hidden="true">...</span>
          } @else {
            <button type="button" class="button ghost" [class.current]="p === page()" [attr.aria-current]="p === page() ? 'page' : null"
              [attr.aria-label]="'Page ' + (p + 1)" (click)="go(p)">{{ p + 1 }}</button>
          }
        }
        <button type="button" class="button ghost" [disabled]="page() === count() - 1" (click)="go(page() + 1)">Next</button>
        <span class="small muted">{{ from() }} to {{ to() }} of {{ total().toLocaleString() }}</span>
      </nav>
    }
  `,
})
export class Pager {
  readonly total = input.required<number>();
  readonly pageSize = input(50);
  readonly label = input('Pages');
  readonly scrollTo = input<HTMLElement | undefined>();
  readonly page = model(0);

  protected readonly count = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  protected readonly pages = computed(() => pageWindow(this.page(), this.count()));
  protected readonly from = computed(() => (this.page() * this.pageSize() + 1).toLocaleString());
  protected readonly to = computed(() => Math.min(this.total(), (this.page() + 1) * this.pageSize()).toLocaleString());

  protected go(p: number): void {
    this.page.set(Math.min(Math.max(p, 0), this.count() - 1));
    this.scrollTo()?.scrollIntoView({ block: 'start' });
  }
}
