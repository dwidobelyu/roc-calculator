import { Component, input, model } from '@angular/core';
import { DynamicScaling } from '../../core/engine/combatant-factory';
import { DungeonEntry } from '../../core/services/catalog.service';
import { NumberField } from '../../shared/components/number-field';
import { SectionPanel } from '../../shared/components/section-panel';

/**
 * Inputs for a scaled (dungeon/event) monster. The game solves its HP and ATK from a target HP and DPS that only the
 * server knows, so the user enters them; without scaling the table stats are used as they are.
 */
@Component({
  selector: 'app-dynamic-scaling-editor',
  imports: [NumberField, SectionPanel],
  template: `
    <app-section-panel title="Content scaling" [badge]="scaling() ? 'On' : ''"
      hint="This monster is scaled by its dungeon or event. Expected HP and DPS come from server data: enter them to rebuild its HP and ATK.">
      <label class="check">
        <input type="checkbox" [checked]="!!scaling()" (change)="toggle($any($event.target).checked)" />
        Scale this monster for content
      </label>
      @if (scaling(); as s) {
        <label class="field">
          <span class="field-label">Dungeon or content</span>
          <select (change)="pickDungeon(+$any($event.target).value)">
            <option value="0" [selected]="!s.dungeonId">Not a dungeon (field content)</option>
            @for (d of dungeons(); track d.id) {
              <option [value]="d.id" [selected]="d.id === s.dungeonId">{{ d.name }}</option>
            }
          </select>
        </label>
        <div class="grid-2">
          <app-number-field label="Expected HP" [min]="0" [value]="s.expectHp" (valueChange)="patch({ expectHp: $event })" />
          <app-number-field label="Expected DPS" [min]="0" [value]="s.expectDps" (valueChange)="patch({ expectDps: $event })" />
          <app-number-field label="Content level" [min]="1" [max]="200" [value]="s.expectLv" (valueChange)="patch({ expectLv: $event })" />
          <app-number-field label="HP factor" [min]="0" [step]="0.01" [value]="s.dynamicHp" (valueChange)="patch({ dynamicHp: $event })" />
          <app-number-field label="ATK factor" [min]="0" [step]="0.01" [value]="s.dynamicAtk" (valueChange)="patch({ dynamicAtk: $event })" />
          <app-number-field label="Difficulty type" [min]="0" [max]="9" [value]="s.typeLv" (valueChange)="patch({ typeLv: $event })" />
        </div>
      }
    </app-section-panel>
  `,
})
export class DynamicScalingEditor {
  readonly dungeons = input.required<DungeonEntry[]>();
  readonly monsterLevel = input.required<number>();
  readonly scaling = model.required<DynamicScaling | null>();

  protected toggle(on: boolean): void {
    // defaults mirror the Lua fallbacks: HP_E 100, DPS_E 10, factors 1
    this.scaling.set(on
      ? { expectHp: 100, expectDps: 10, expectLv: this.monsterLevel(), dynamicHp: 1, dynamicAtk: 1, fn: 0, typeLv: 0, dungeonId: 0 }
      : null);
  }

  protected pickDungeon(id: number): void {
    const d = this.dungeons().find((x) => x.id === id);
    this.patch({ dungeonId: d?.id ?? 0, fn: d?.function ?? 0 });
  }

  protected patch(p: Partial<DynamicScaling>): void {
    const s = this.scaling();
    if (s) this.scaling.set({ ...s, ...p });
  }
}
