import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { ProcView } from '../../core/engine/procs';

/** One autocast skill a proc can cast, with its expected damage per second. */
export interface ProcCastView {
  name: string;
  perSec: number;
  avgDamage: number;
  dps: number;
}

/** Card and gear procs of the attacker under the current action, as expected values. */
@Component({
  selector: 'app-proc-panel',
  imports: [DecimalPipe, PercentPipe],
  template: `
    <section class="result" aria-labelledby="procs-h">
      <h3 id="procs-h" class="result-label">Procs (expected value)</h3>
      @if (!procs().length) {
        <p class="small muted">No worn card or gear has a chance-based proc.</p>
      } @else {
        <p class="small muted">
          Buffs from procs are added to your stats weighted by their uptime, debuffs to the target. The damage and speed
          above already include them. One trigger per use of the attack is assumed (inferred).
        </p>
        <ul class="proc-list">
          @for (p of procs(); track $index) {
            <li>
              <strong>{{ p.source }}</strong>: {{ p.trigger }}, {{ p.chance | percent: '1.0-2' }} chance{{ p.cooldownSec ? ', ' + p.cooldownSec + ' s cooldown' : '' }}.
              @if (p.rate === 0) {
                <span class="muted">Does not fire with this attack.</span>
              } @else if (p.uptime !== null) {
                Uptime about {{ p.uptime | percent: '1.0-1' }}.
              } @else {
                About {{ p.perSec | number: '1.2-2' }} per second.
              }
              @if (p.desc) { <br /><span class="small muted">{{ p.desc }}</span> }
            </li>
          }
        </ul>
        @if (casts().length) {
          <dl class="facts">
            @for (c of casts(); track $index) {
              <div><dt>{{ c.name }}: {{ c.perSec | number: '1.2-2' }}/s x {{ c.avgDamage | number: '1.0-0' }}</dt><dd class="num">+{{ c.dps | number: '1.0-0' }} DPS</dd></div>
            }
          </dl>
          <p class="small">
            DPS with autocast procs: <strong class="num">{{ baseDps() + extraDps() | number: '1.0-0' }}</strong>.
            @if (targetHp() > 0 && baseDps() + extraDps() > 0) {
              Target at 0 HP in about <strong class="num">{{ targetHp() / (baseDps() + extraDps()) | number: '1.1-1' }} s</strong>.
            }
            Autocast damage ignores the hit roll.
          </p>
        }
      }
    </section>
  `,
})
export class ProcPanel {
  readonly procs = input.required<ProcView[]>();
  readonly casts = input<ProcCastView[]>([]);
  readonly extraDps = input(0);
  readonly baseDps = input(0);
  readonly targetHp = input(0);
}
