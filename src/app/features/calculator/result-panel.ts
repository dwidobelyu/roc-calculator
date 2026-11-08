import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { DamageResult } from '../../core/models/combat.models';

/** Damage range the target takes, roll chances and the full list of multipliers behind the number. */
@Component({
  selector: 'app-result-panel',
  imports: [DecimalPipe, PercentPipe],
  template: `
    @let r = result();
    <div class="result" aria-live="polite">
      <p class="result-label">Damage taken per cast ({{ r.formulaName }})</p>
      <p class="damage">
        <span class="num">{{ r.normal.min | number }}</span>
        <span class="damage-sep">to</span>
        <span class="num">{{ r.normal.max | number }}</span>
      </p>
      @if (r.hits > 1) {
        <p class="small muted">{{ r.hits }} hits: about {{ r.normal.min / r.hits | number: '1.0-0' }} to
          {{ r.normal.max / r.hits | number: '1.0-0' }} per hit.</p>
      }
      @if (r.critical; as c) {
        <p class="crit">Critical: <span class="num">{{ c.min | number }}</span> to <span class="num">{{ c.max | number }}</span></p>
      }
      <dl class="facts">
        <div><dt>Perfect-hit roll</dt><dd>{{ r.perfectHitChance | percent: '1.0-1' }}</dd></div>
        <div><dt>Hit chance vs FLEE</dt><dd>{{ r.hitChance | percent: '1.0-1' }}</dd></div>
        <div><dt>Crit chance</dt><dd>{{ r.critChance | percent: '1.0-1' }}</dd></div>
      </dl>
      @for (n of r.notes; track n) {
        <p class="note">{{ n }}</p>
      }
      <details class="panel">
        <summary><span class="panel-title">How this number was built</span></summary>
        <table class="breakdown">
          <thead><tr><th scope="col">Factor</th><th scope="col">Value</th><th scope="col">Source</th></tr></thead>
          <tbody>
            @for (b of r.breakdown; track b.label) {
              <tr>
                <td>{{ b.label }}</td>
                <td class="num">{{ b.value | number: '1.0-4' }}</td>
                <td>{{ b.source === 'game' ? 'Game code' : 'Inferred' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </details>
    </div>
  `,
})
export class ResultPanel {
  readonly result = input.required<DamageResult>();
}
