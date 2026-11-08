import { Component, inject } from '@angular/core';
import { CatalogService } from '../../core/services/catalog.service';

/** Loading and error state for pages that need the game data; triggers the load itself. */
@Component({
  selector: 'app-load-state',
  template: `
    @if (catalog.error(); as err) {
      <div class="state-box" role="alert">
        <p>The game data files could not be loaded: {{ err }}</p>
        <button type="button" class="button" (click)="catalog.ensureLoaded()">Try again</button>
      </div>
    } @else {
      <p class="state-box" role="status">Loading game data (about 9 MB the first time)...</p>
    }
  `,
})
export class LoadState {
  protected readonly catalog = inject(CatalogService);

  constructor() {
    void this.catalog.ensureLoaded();
  }
}
