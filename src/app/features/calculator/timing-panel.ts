import { DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { CombatTiming } from '../../core/engine/combat-timing';

/** Cast time, attack speed, damage per second and time until the target's HP reaches 0. */
@Component({
  selector: 'app-timing-panel',
  imports: [DecimalPipe],
  template: `
    @let t = timing();
    <section class="result" aria-labelledby="timing-h">
      <h3 id="timing-h" class="result-label">Speed and time to kill</h3>
      <p class="ttk">
        Target at 0 HP in about <span class="num">{{ seconds(t.timeToKill) }}</span>
      </p>
      <p class="small muted">
        {{ t.targetHp | number }} HP at {{ t.dps | number: '1.0-0' }} damage per second (misses and crits included).
        If every use lands: {{ count(t.castsToKill.min) }} to {{ count(t.castsToKill.max) }} uses,
        {{ seconds(t.timeToKillRange.min) }} to {{ seconds(t.timeToKillRange.max) }}.
      </p>
      <details class="panel">
        <summary><span class="panel-title">Cast time and speed details</span></summary>
        <dl class="facts">
        <div><dt>Fixed cast</dt><dd class="num">{{ t.castFixed | number: '1.2-2' }} s</dd></div>
        <div><dt>Variable cast</dt><dd class="num">{{ t.castVariable | number: '1.2-2' }} s</dd></div>
        <div><dt>Total cast time</dt><dd class="num">{{ t.castTime | number: '1.2-2' }} s</dd></div>
        <div><dt>Cooldown</dt><dd class="num">{{ t.cooldown | number: '1.2-2' }} s</dd></div>
        <div><dt>Attacks per second</dt><dd class="num">{{ t.attacksPerSecond | number: '1.2-2' }}</dd></div>
        <div><dt>Time per use</dt><dd class="num">{{ t.cycleTime | number: '1.2-2' }} s</dd></div>
        <div><dt>Average damage per use</dt><dd class="num">{{ t.expectedPerCast | number: '1.0-0' }}</dd></div>
        <div><dt>DPS range</dt><dd class="num">{{ t.dpsMin | number: '1.0-0' }} to {{ t.dpsMax | number: '1.0-0' }}</dd></div>
        </dl>
      </details>
      @for (n of t.notes; track n) {
        <p class="note">{{ n }}</p>
      }
    </section>
  `,
})
export class TimingPanel {
  readonly timing = input.required<CombatTiming>();

  protected seconds(s: number): string {
    if (!Number.isFinite(s)) return 'never (no damage lands)';
    return s < 60 ? `${s.toFixed(2)} s` : `${Math.floor(s / 60)} min ${(s % 60).toFixed(1)} s`;
  }

  protected count(n: number): string {
    return Number.isFinite(n) ? String(n) : 'no';
  }
}
