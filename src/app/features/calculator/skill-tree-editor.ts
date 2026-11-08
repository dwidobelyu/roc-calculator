import { Component, computed, input, model } from '@angular/core';
import { jobLineIds } from '../../core/engine/equipment-rules';
import { passiveAttrs } from '../../core/engine/passives';
import { PlayerBuild } from '../../core/models/build.models';
import { Catalog } from '../../core/services/catalog.service';
import { AttrList } from '../../shared/components/attr-list';
import { SectionPanel } from '../../shared/components/section-panel';

/** Learned passive skills of the job line (skill tree): pick each passive's level; weapon and mount gates apply. */
@Component({
  selector: 'app-skill-tree-editor',
  imports: [AttrList, SectionPanel],
  template: `
    <app-section-panel title="Passive skills" [badge]="learned() || ''"
      hint="Passives of your job line that change stats. Some only count with a weapon type equipped or while mounted.">
      @for (row of rows(); track row.id) {
        <div class="source-row">
          <div class="feather-row">
            <div>
              <strong>{{ row.name }}</strong>
              @if (row.conditions) {
                <span class="muted small"> ({{ row.conditions }})</span>
              }
            </div>
            <label class="field">
              <span class="field-label">Level</span>
              <select (change)="setLevel(row.id, +$any($event.target).value)" [attr.aria-label]="row.name + ' level'">
                <option value="0" [selected]="row.level === 0">Not learned</option>
                @for (l of row.levels; track l) {
                  <option [value]="l" [selected]="l === row.level">Lv.{{ l }}</option>
                }
              </select>
            </label>
          </div>
          @if (row.level) {
            <app-attr-list [attrs]="row.attrs" [names]="catalog().attrNames"
              empty="No stat bonus with the current weapon or mount state." />
          }
        </div>
      } @empty {
        <p class="small muted">No passive of this job line changes stats in the decoded data.</p>
      }
    </app-section-panel>
  `,
})
export class SkillTreeEditor {
  readonly catalog = input.required<Catalog>();
  readonly build = input.required<PlayerBuild>();
  readonly passives = model.required<Record<string, number>>();

  protected readonly rows = computed(() => {
    const cat = this.catalog(), b = this.build();
    const line = jobLineIds(cat.jobs, b.jobId);
    const weapon = b.equipment.find((e) => e.slot === 1 && e.equipId != null);
    const weaponType = (weapon && cat.equipById.get(weapon.equipId!)?.weaponType) || 0;
    return cat.passives
      .filter((p) => p.jobIds.some((j) => line.has(j)) && p.levels.some((l) => l.attrs.length))
      .map((p) => {
        const level = this.passives()[p.skillId] ?? 0;
        return {
          id: p.skillId,
          name: p.name,
          conditions: p.levels.find((l) => l.conditions)?.conditions ?? '',
          levels: p.levels.map((l) => l.level),
          level,
          attrs: level ? passiveAttrs(p, level, weaponType, b.mounted ?? false) : [],
        };
      });
  });

  protected readonly learned = computed(() => this.rows().filter((r) => r.level > 0).length);

  protected setLevel(id: number, level: number): void {
    this.passives.update((p) => {
      const next = { ...p };
      if (level) next[id] = level;
      else delete next[id];
      return next;
    });
  }
}
