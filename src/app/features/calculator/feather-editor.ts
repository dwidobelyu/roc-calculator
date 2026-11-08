import { Component, computed, input, model } from '@angular/core';
import { FEATHER_SLOTS, FeatherKind, featherAttrs, featherLevel, featherMaxLevel } from '../../core/engine/feathers';
import { FeatherPick } from '../../core/models/build.models';
import { Catalog } from '../../core/services/catalog.service';
import { AttrList } from '../../shared/components/attr-list';
import { SectionPanel } from '../../shared/components/section-panel';

/**
 * The 10 feather slots: 5 attack (ATK or MIX feathers) and 5 defense (DEF or MIX). Each slot picks a feather and
 * its level from the game data; the level list stops at what the base level allows.
 */
@Component({
  selector: 'app-feather-editor',
  imports: [AttrList, SectionPanel],
  template: `
    <app-section-panel title="Feathers" [badge]="filled() ? filled() + '/10' : ''"
      hint="5 attack feathers (ATK or MIX) and 5 defense feathers (DEF or MIX). Pick the feather, then its level.">
      @for (group of groups; track group.key) {
        <fieldset class="slot">
          <legend>{{ group.label }}</legend>
          @for (row of rowsOf(group.key); track row.index) {
            <div class="feather-row">
              <label class="field">
                <span class="field-label">{{ row.label }}</span>
                <select (change)="pick(row.index, +$any($event.target).value)">
                  <option value="0" [selected]="!row.kind">Empty</option>
                  @for (k of row.options; track k.id) {
                    <option [value]="k.id" [selected]="k.id === row.kind?.id">[{{ k.type }}] {{ k.name }}</option>
                  }
                </select>
              </label>
              @if (row.kind && row.levels.length) {
                <label class="field">
                  <span class="field-label">Level (max {{ row.levels.length }} at base Lv.{{ baseLevel() }})</span>
                  <select (change)="setLevel(row.index, +$any($event.target).value)">
                    @for (lv of row.levels; track lv) {
                      <option [value]="lv" [selected]="lv === row.level">Lv.{{ lv }}</option>
                    }
                  </select>
                </label>
              }
            </div>
            @if (row.kind && !row.levels.length) {
              <p class="small warn">Feathers unlock at base level {{ row.unlockLevel }}; this build is Lv.{{ baseLevel() }}. Raise the base level to set its level.</p>
            } @else if (row.kind) {
              <app-attr-list [attrs]="row.attrs" [names]="catalog().attrNames" />
            }
          }
        </fieldset>
      }
    </app-section-panel>
  `,
})
export class FeatherEditor {
  readonly catalog = input.required<Catalog>();
  readonly baseLevel = input.required<number>();
  readonly feathers = model.required<(FeatherPick | null)[]>();

  protected readonly groups = [
    { key: 'attack', label: 'Attack feathers' },
    { key: 'defense', label: 'Defense feathers' },
  ] as const;

  private readonly rows = computed(() => {
    const cat = this.catalog();
    return FEATHER_SLOTS.map((slot, index) => {
      const pick = this.feathers()[index] ?? null;
      const kind = pick ? cat.featherById.get(pick.kindId) : undefined;
      const max = kind ? featherMaxLevel(kind, this.baseLevel()) : 0;
      const level = pick && kind ? featherLevel(pick.level, kind, this.baseLevel()) : 0;
      return {
        index,
        group: slot.group,
        label: slot.label,
        options: cat.featherKinds.filter((k) => slot.accepts.includes(k.type)),
        kind,
        level,
        levels: Array.from({ length: max }, (_, i) => i + 1),
        unlockLevel: kind?.levelCap[0]?.[0] ?? 1,
        attrs: kind && level ? featherAttrs(kind, level) : [],
      };
    });
  });

  protected readonly filled = computed(() => this.rows().filter((r) => r.kind).length);

  protected rowsOf(group: 'attack' | 'defense') {
    return this.rows().filter((r) => r.group === group);
  }

  protected pick(index: number, kindId: number): void {
    const kind: FeatherKind | undefined = this.catalog().featherById.get(kindId);
    // a newly picked feather starts at the highest level the base level allows
    this.set(index, kind ? { kindId, level: featherMaxLevel(kind, this.baseLevel()) } : null);
  }

  protected setLevel(index: number, level: number): void {
    const cur = this.feathers()[index];
    if (cur) this.set(index, { ...cur, level });
  }

  private set(index: number, value: FeatherPick | null): void {
    this.feathers.update((list) => {
      const next = Array.from({ length: FEATHER_SLOTS.length }, (_, i) => list[i] ?? null);
      next[index] = value;
      return next;
    });
  }
}
