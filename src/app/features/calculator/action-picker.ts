import { Component, computed, input, model } from '@angular/core';
import { StateInput, resolveFormula } from '../../core/engine/damage/damage-formulas';
import { jobLineIds } from '../../core/engine/equipment-rules';
import { SkillEntry } from '../../core/models/master-data.models';
import { Catalog } from '../../core/services/catalog.service';
import { EntityPicker } from '../../shared/components/entity-picker';
import { NumberField } from '../../shared/components/number-field';
import { SkillDescription } from '../../shared/components/skill-description';

export interface ActionState {
  skillId: number | null;
  level: number;
  /** Damage part index, or 'all' for the total of every part. */
  segment: number | 'all';
  attackerCount: number;
  /** Show every damaging skill in the game, including monster skills. */
  allSkills: boolean;
  /** Target HP to bring to 0; null uses the target's max HP. */
  targetHp: number | null;
  /** Combat-state values for the chosen skill's script (active buffs, stacks, current SP), keyed by StateInput.key. */
  state: Record<string, number>;
  /** Add chance-based card and gear procs as expected values (your build only). */
  procs: boolean;
}

/** Choose the attack: normal attack or a damaging skill, its level and which damage segment to compute. */
@Component({
  selector: 'app-action-picker',
  imports: [EntityPicker, NumberField, SkillDescription],
  template: `
    <app-entity-picker
      label="Attack or skill"
      placeholder="Type a skill name"
      [items]="items()"
      [value]="state().skillId"
      (valueChange)="pickSkill($event)"
    />
    @if (skillIds() == null) {
      <label class="check">
        <input type="checkbox" [checked]="state().allSkills" (change)="patch({ allSkills: $any($event.target).checked })" />
        Include skills of every job and monster
      </label>
      <label class="check">
        <input type="checkbox" [checked]="state().procs" (change)="patch({ procs: $any($event.target).checked })" />
        Add card and gear procs (chance x effect, expected value)
      </label>
    }
    @if (skill(); as s) {
      <details class="panel">
        <summary><span class="panel-title">Description at Lv.{{ state().level }}</span></summary>
        <app-skill-description [skill]="s" [level]="state().level" />
      </details>
      <div class="grid-3">
        <label class="field">
          <span class="field-label">Skill level</span>
          <select [value]="state().level" (change)="patch({ level: +$any($event.target).value, segment: 'all' })">
            @for (l of s.levels; track l.level) {
              <option [value]="l.level" [selected]="l.level === state().level">Lv.{{ l.level }}</option>
            }
          </select>
        </label>
        @if (segments() > 1) {
          <label class="field">
            <span class="field-label">Damage part</span>
            <select (change)="setSegment($any($event.target).value)">
              <option value="all" [selected]="state().segment === 'all'">All parts</option>
              @for (i of segmentList(); track i) {
                <option [value]="i" [selected]="i === state().segment">Part {{ i + 1 }} only</option>
              }
            </select>
          </label>
        }
        <app-number-field label="Units hitting the target" [min]="1" [max]="7" [value]="state().attackerCount"
          (valueChange)="patch({ attackerCount: $event })" />
        <app-number-field label="Target HP (0 = full HP)" [min]="0" [value]="state().targetHp ?? 0"
          (valueChange)="patch({ targetHp: $event || null })" />
      </div>
      @if (stateInputs().length) {
        <fieldset class="combat-state">
          <legend>Combat state this skill checks</legend>
          <div class="grid-3">
            @for (i of stateInputs(); track i.key) {
              @if (i.kind === 'toggle') {
                <label class="check">
                  <input type="checkbox" [checked]="stateValue(i) === 1" (change)="setState(i.key, $any($event.target).checked ? 1 : 0)" />
                  {{ i.label }}
                  @if (i.note) { <span class="muted small">({{ i.note }})</span> }
                </label>
              } @else {
                <app-number-field [label]="i.note ? i.label + ' (' + i.note + ')' : i.label" [min]="i.min ?? 0" [max]="i.max ?? 999999"
                  [value]="stateValue(i)" (valueChange)="setState(i.key, $event)" />
              }
            }
          </div>
        </fieldset>
      }
    }
  `,
})
export class ActionPicker {
  readonly catalog = input.required<Catalog>();
  readonly jobId = input.required<number>();
  readonly state = model.required<ActionState>();
  /** Restrict the list to these skills (e.g. a monster attacker's own skills); null = the job's skills. */
  readonly skillIds = input<number[] | null>(null);

  private readonly damaging = computed(() =>
    this.catalog().skills.filter((s) => !s.passive && s.levels.some((l) => resolveFormula(l.script, s.damageType).formula)),
  );

  protected readonly items = computed(() => {
    const cat = this.catalog();
    let list: SkillEntry[];
    const only = this.skillIds();
    if (only) {
      const set = new Set(only);
      list = this.damaging().filter((s) => set.has(s.id));
    } else if (this.state().allSkills) {
      list = this.damaging();
    } else {
      const ids = jobLineIds(cat.jobs, this.jobId());
      const common = new Set(cat.jobs.filter((j) => ids.has(j.id)).map((j) => j.commonAttackSkill));
      list = this.damaging().filter((s) => common.has(s.id) || s.jobIds.some((j) => ids.has(j)));
    }
    return list.map((s) => ({ id: s.id, label: s.monsterIds.length && !s.jobIds.length ? `${s.name} (monster)` : s.name }));
  });

  protected readonly skill = computed(() => {
    const id = this.state().skillId;
    return id == null ? undefined : this.catalog().skillById.get(id);
  });

  protected readonly segments = computed(() => {
    const lv = this.skill()?.levels.find((l) => l.level === this.state().level);
    return lv ? Math.max(lv.pveRatio.length, 1) : 1;
  });

  /** State inputs declared by the scripts of the chosen level (one per key across all parts). */
  protected readonly stateInputs = computed((): StateInput[] => {
    const s = this.skill();
    const lv = s?.levels.find((l) => l.level === this.state().level);
    if (!s || !lv) return [];
    const inputs = resolveFormula(lv.script, s.damageType).formula?.stateInputs ?? [];
    return [...new Map(inputs.map((i) => [i.key, i])).values()];
  });

  protected stateValue(i: StateInput): number {
    return this.state().state[i.key] ?? i.default ?? 0;
  }

  protected setState(key: string, value: number): void {
    this.patch({ state: { ...this.state().state, [key]: value } });
  }

  protected readonly segmentList = computed(() => Array.from({ length: this.segments() }, (_, i) => i));

  protected pickSkill(id: string | number | null): void {
    const s = id == null ? undefined : this.catalog().skillById.get(+id);
    this.patch({ skillId: s?.id ?? null, level: s?.levels.at(-1)?.level ?? 1, segment: 'all', state: {} });
  }

  protected setSegment(v: string): void {
    this.patch({ segment: v === 'all' ? 'all' : +v });
  }

  protected patch(p: Partial<ActionState>): void {
    this.state.update((s) => ({ ...s, ...p }));
  }
}
