import { Component, computed, input, model } from '@angular/core';
import { petContributions } from '../../core/engine/combatant-factory';
import { PET_MAX_LEVEL, petMaxEvolution, petOwnStats } from '../../core/engine/pets';
import { PetPick, PlayerBuild, emptyBuild } from '../../core/models/build.models';
import { Catalog } from '../../core/services/catalog.service';
import { AttrList } from '../../shared/components/attr-list';
import { NumberField } from '../../shared/components/number-field';
import { SectionPanel } from '../../shared/components/section-panel';

type PetState = 'deployed' | 'assist';

/**
 * Deployed and assist pet slots (no star step: ROC has none). Deployed: evolution deployed bonus; slot 1 is also the attacking pet,
 * so it takes a pet level (the pet's own stats). Assist: evolution assist bonus.
 */
@Component({
  selector: 'app-pet-editor',
  imports: [AttrList, NumberField, SectionPanel],
  template: `
    <app-section-panel title="Pets" [badge]="count() || ''"
      hint="Deployed pets give the evolution deployed bonus, assist pets the evolution assist bonus. The evolution bonus is inferred from PetEvolutionTable; the game sends the real assist bonus from its server.">
      @for (state of states; track state) {
        <h3 class="sub-head">{{ state === 'deployed' ? 'Deployed pets' : 'Assist pets' }}</h3>
        @for (pick of value()[state]; track $index; let i = $index) {
          <div class="source-row">
            <div class="grid-2">
              <label class="field">
                <span class="field-label">{{ state === 'deployed' ? 'Deployed' : 'Assist' }} slot {{ i + 1 }}</span>
                <select (change)="pickPet(state, i, +$any($event.target).value)">
                  <option value="0" [selected]="!pick">Empty</option>
                  @for (p of catalog().pets; track p.id) {
                    <option [value]="p.id" [selected]="p.id === pick?.petId">{{ p.name }}</option>
                  }
                </select>
              </label>
              @if (pick && catalog().petById.get(pick.petId); as p) {
                <app-number-field [label]="'Evolution rank (0 to ' + maxEvolution(p) + ')'" [min]="0" [max]="maxEvolution(p)"
                  [value]="pick.evolution ?? 0" (valueChange)="patch(state, i, { evolution: $event })" />
                @if (state === 'deployed' && i === 0) {
                  <app-number-field [label]="'Pet level (max ' + maxLevel + ', own stats only)'" [min]="1" [max]="maxLevel"
                    [value]="pick.level" (valueChange)="patch(state, i, { level: $event })" />
                }
              }
            </div>
            @if (bonus(state, i); as attrs) {
              <app-attr-list [attrs]="attrs" [names]="catalog().attrNames" />
            }
          </div>
        }
      }
      @if (ownStats().length) {
        <h3 class="sub-head">Deployed slot 1 own level-up stats at Lv.{{ value().deployed[0]?.level }}</h3>
        <app-attr-list [attrs]="ownStats()" [names]="catalog().attrNames" />
      }
    </app-section-panel>
  `,
})
export class PetEditor {
  readonly catalog = input.required<Catalog>();
  readonly value = model.required<PlayerBuild['pets']>();
  protected readonly maxLevel = PET_MAX_LEVEL;
  protected readonly states: readonly PetState[] = ['deployed', 'assist'];

  protected readonly count = computed(() => [...this.value().deployed, ...this.value().assist].filter(Boolean).length);
  protected readonly ownStats = computed(() => {
    const p = this.value().deployed[0];
    return p ? petOwnStats(this.catalog().petLevels, p.petId, p.level) : [];
  });

  protected maxEvolution(p: Parameters<typeof petMaxEvolution>[0]): number {
    return petMaxEvolution(p);
  }

  /** What one slot gives you, from the same code the build totals use. */
  protected bonus(state: PetState, i: number) {
    const pick = this.value()[state][i];
    if (!pick) return null;
    const one = { ...emptyBuild().pets, [state]: [pick] };
    return petContributions({ pets: one } as PlayerBuild, this.catalog()).flatMap((c) => c.attrs);
  }

  protected pickPet(state: PetState, i: number, id: number): void {
    const p = this.catalog().petById.get(id);
    this.set(state, i, p ? { petId: id, level: PET_MAX_LEVEL, evolution: petMaxEvolution(p) } : null);
  }

  protected patch(state: PetState, i: number, p: Partial<PetPick>): void {
    const v = this.value()[state][i];
    if (v) this.set(state, i, { ...v, ...p });
  }

  private set(state: PetState, i: number, pick: PetPick | null): void {
    const v = this.value();
    this.value.set({ ...v, [state]: v[state].map((x, j) => (j === i ? pick : x)) });
  }
}
