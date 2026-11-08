import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { version } from '../../package.json';

type Theme = 'light' | 'dark';

/** The pages in the menu, in this order. */
const MENU: { path: string; label: string; exact?: boolean }[] = [
  { path: '/', label: 'Calculator', exact: true },
  { path: '/monsters', label: 'Monsters' },
  { path: '/equipment', label: 'Equipment' },
  { path: '/cards', label: 'Cards' },
  { path: '/skills/player', label: 'Player skills' },
  { path: '/skills/monster', label: 'Monster skills' },
  { path: '/stalker-copy', label: 'Stalker Copy' },
];

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  host: { '(document:click)': 'onDocumentClick($event)', '(document:keydown.escape)': 'closeMenu(true)' },
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="menu-wrap" #menuWrap>
        <button #menuButton type="button" class="button ghost menu-button" aria-controls="site-menu"
          [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(!menuOpen())">
          <svg aria-hidden="true" class="menu-icon" viewBox="0 0 18 18"><path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" stroke-width="2" /></svg>
          Menu
        </button>
        <nav id="site-menu" class="site-menu" aria-label="Main" [hidden]="!menuOpen()">
          <ul>
            @for (m of menu; track m.path) {
              <li>
                <a [routerLink]="m.path" routerLinkActive="active" ariaCurrentWhenActive="page"
                  [routerLinkActiveOptions]="{ exact: !!m.exact }">{{ m.label }}</a>
              </li>
            }
          </ul>
          <button type="button" class="button ghost menu-theme" (click)="toggleTheme()" [attr.aria-pressed]="theme() === 'dark'">
            {{ theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme' }}
          </button>
        </nav>
      </div>
      <a class="brand" routerLink="/">
        <span class="brand-mark" aria-hidden="true">ROC</span>
        <h1>Damage Calculator</h1>
      </a>
    </header>
    <main id="main">
      <router-outlet />
    </main>
    <footer class="site-footer">
      <p class="small muted">
        Formulas and data come from the Ragnarok Origin Classic PC client (decompiled Lua and game tables).
        The server computes some inputs natively; those are reconstructed and marked "Inferred" in each result.
      </p>
      <p class="small muted">Version {{ version }}</p>
    </footer>
  `,
})
export class App {
  protected readonly theme = signal<Theme>(this.initialTheme());
  protected readonly menu = MENU;
  /** Set from the rc-x.y.z branch at release build time; 0.0.0 in local builds. */
  protected readonly version = version;
  protected readonly menuOpen = signal(false);
  private readonly menuWrap = viewChild.required<ElementRef<HTMLElement>>('menuWrap');
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');

  constructor() {
    document.documentElement.dataset['theme'] = this.theme();
    // picking a page closes the menu
    inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.menuOpen.set(false);
    });
  }

  /** Escape closes the menu and puts focus back on its button. */
  protected closeMenu(refocus: boolean): void {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    if (refocus) this.menuButton().nativeElement.focus();
  }

  /** A click outside the menu closes it. */
  protected onDocumentClick(e: MouseEvent): void {
    if (this.menuOpen() && !this.menuWrap().nativeElement.contains(e.target as Node)) this.closeMenu(false);
  }

  protected toggleTheme(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    document.documentElement.dataset['theme'] = next;
    try {
      localStorage.setItem('roc-calculator.theme', next);
    } catch {
      // storage blocked: the choice lasts for this page view
    }
  }

  private initialTheme(): Theme {
    try {
      const saved = localStorage.getItem('roc-calculator.theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // ignore blocked storage
    }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
