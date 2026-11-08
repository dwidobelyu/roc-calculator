import { Component, computed, inject, input, model, signal } from '@angular/core';
import { STAT_SOURCE_KINDS } from '../../core/engine/sources/kinds';
import { StatSourceKind } from '../../core/engine/sources/stat-source';
import { MAX_BASE_LEVEL, maxAffordable, pointsAt, spent } from '../../core/engine/stat-points';
import { canRide, defaultMount, hasJobMount, mountsForJob } from '../../core/engine/mounts';
import { ammoFor } from '../../core/engine/ammo';
import { FeatherEditor } from './feather-editor';
import { PetEditor } from './pet-editor';
import { SkillTreeEditor } from './skill-tree-editor';
import { BaseStats, EquipSlotState, PlayerBuild, SourcePick, emptyBuild } from '../../core/models/build.models';
import { Combatant } from '../../core/models/combat.models';
import { StatBonus } from '../../core/models/master-data.models';
import { BuildStorageService } from '../../core/services/build-storage.service';
import { Catalog } from '../../core/services/catalog.service';
import { NumberField } from '../../shared/components/number-field';
import { SectionPanel } from '../../shared/components/section-panel';
import { AttrEditor } from './attr-editor';
import { EquipmentEditor } from './equipment-editor';
import { SourceListEditor } from './source-list-editor';
import { StatsSummary } from './stats-summary';

const STAT_KEYS: (keyof BaseStats)[] = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];

/** Full player build: job, level, stats, gear and every stat-source system. Used for attacker and target. */
@Component({
  selector: 'app-build-editor',
  imports: [AttrEditor, EquipmentEditor, FeatherEditor, NumberField, PetEditor, SkillTreeEditor, SectionPanel, SourceListEditor, StatsSummary],
  template: `
    <div class="build-toolbar">
      <label class="field grow">
        <span class="field-label">Build name</span>
        <input type="text" [value]="build().name" (change)="patch({ name: $any($event.target).value })" />
      </label>
      <button type="button" class="button" (click)="save()">Save build</button>
      @if (storage.builds().length) {
        <label class="field">
          <span class="field-label">Saved builds</span>
          <select (change)="load($any($event.target))">
            <option value="">Load a build</option>
            @for (b of storage.builds(); track b.name) {
              <option [value]="b.name">{{ b.name }}</option>
            }
          </select>
        </label>
        <button type="button" class="button ghost" [disabled]="!isSaved()" (click)="remove()">Delete saved</button>
      }
      <button type="button" class="button ghost" (click)="build.set(emptyBuild())">Reset</button>
    </div>
    <!-- always rendered: every build editor keeps the same rows so two of them can line up -->
    <p class="small muted status-line" role="status">{{ status() }}</p>

    <app-section-panel title="Character and base stats" [open]="true">
      <div class="grid-2">
        <label class="field">
          <span class="field-label">Job</span>
          <select [value]="build().jobId" (change)="setJob(+$any($event.target).value)">
            @for (j of catalog().jobs; track j.id) {
              <option [value]="j.id" [selected]="j.id === build().jobId">{{ j.name }}</option>
            }
          </select>
        </label>
        <app-number-field [label]="'Base level (max ' + maxLevel + ')'" [min]="1" [max]="maxLevel" [value]="build().baseLevel"
          (valueChange)="patch({ baseLevel: $event })" />
        <label class="field">
          <span class="field-label">Weapon element</span>
          <select [value]="build().weaponElement" (change)="patch({ weaponElement: +$any($event.target).value })">
            @for (e of elements(); track e.id) {
              <option [value]="e.id" [selected]="e.id === build().weaponElement">{{ e.name }}</option>
            }
          </select>
        </label>
        @if (hasMount()) {
        <label class="field">
          <span class="field-label">Mount (follows the job)</span>
          <select (change)="patch({ mountId: +$any($event.target).value || null })">
            <option value="0" [selected]="build().mountId == null">Job mount: {{ jobMount()?.name ?? 'none' }}</option>
            @for (m of mounts(); track m.id) {
              <option [value]="m.id" [selected]="m.id === build().mountId">{{ m.name }}</option>
            }
          </select>
        </label>
        }
        @if (arrows().length) {
          <label class="field">
            <span class="field-label">Arrow</span>
            <select (change)="patch({ ammoId: +$any($event.target).value || null })">
              <option value="0" [selected]="build().ammoId == null">No arrow</option>
              @for (a of arrows(); track a.id) {
                <option [value]="a.id" [selected]="a.id === build().ammoId">{{ a.name }}</option>
              }
            </select>
          </label>
        }
        <app-number-field [label]="'Job level (max ' + maxJobLevel() + ')'" [min]="1" [max]="maxJobLevel()"
          [value]="build().jobLevel ?? 1" (valueChange)="patch({ jobLevel: $event })" />
        @if (hasMount()) {
          <label class="check">
            <input type="checkbox" [checked]="build().mounted ?? false" (change)="patch({ mounted: $any($event.target).checked })" />
            Riding the mount
          </label>
        }
      </div>
      <p class="small muted" [class.warn]="points().left < 0" role="status">
        Stat points: {{ points().used }} of {{ points().total }} used at Lv.{{ build().baseLevel }}
        @if (points().left < 0) {
          ({{ -points().left }} over: lower a stat or raise the level)
        } @else {
          ({{ points().left }} left)
        }
      </p>
      <div class="grid-3">
        @for (k of statKeys; track k) {
          <app-number-field [label]="k.toUpperCase() + ' (max ' + statMax()[k] + ')'" [min]="1" [max]="statMax()[k]"
            [value]="build().stats[k]" (valueChange)="setStat(k, $event)" />
        }
      </div>
      <p class="small muted">Points you allocate (1 to 99 each). Bonus stats from gear and systems go through the panels below.</p>
    </app-section-panel>

    <!-- right under the inputs, so every change shows its effect without scrolling past the other panels -->
    <app-section-panel title="Final stats" [open]="true">
      <app-stats-summary [combatant]="combatant()" />
    </app-section-panel>

    <h3 class="group-head">Gear</h3>
    <app-equipment-editor [catalog]="catalog()" [jobId]="build().jobId" [equipment]="build().equipment"
      (equipmentChange)="setEquipment($event)" />

    <app-feather-editor [catalog]="catalog()" [baseLevel]="build().baseLevel" [feathers]="build().feathers"
      (feathersChange)="patch({ feathers: $event })" />

    <h3 class="group-head">Character growth</h3>
    <app-skill-tree-editor [catalog]="catalog()" [build]="build()" [passives]="build().passives ?? {}"
      (passivesChange)="patch({ passives: $event })" />

    <app-pet-editor [catalog]="catalog()" [value]="build().pets" (valueChange)="patch({ pets: $event })" />

    <h3 class="group-head">Account systems</h3>
    @for (kind of accountKinds; track kind.key) {
      <!-- Mount level only for jobs that have a mount -->
      @if (kind.key !== 'mount' || hasMount()) {
      <app-source-list-editor
        [title]="kind.label"
        [hint]="kind.hint"
        [available]="availability()(kind)"
        [options]="catalog().sourceOptions.get(kind.key) ?? []"
        [names]="catalog().attrNames"
        [picks]="build().sources[kind.key] ?? []"
        (picksChange)="setSource(kind.key, $event)"
      />
      }
    }

    <h3 class="group-head">Buffs and extra attributes</h3>
    @for (kind of combatKinds; track kind.key) {
      <app-source-list-editor
        [title]="kind.label"
        [hint]="kind.hint"
        [available]="availability()(kind)"
        [options]="catalog().sourceOptions.get(kind.key) ?? []"
        [names]="catalog().attrNames"
        [picks]="build().sources[kind.key] ?? []"
        (picksChange)="setSource(kind.key, $event)"
      />
    }

    <app-attr-editor [names]="catalog().attrNames" [attrs]="build().extraAttrs" (attrsChange)="setExtra($event)" />
  `,
})
export class BuildEditor {
  readonly catalog = input.required<Catalog>();
  readonly combatant = input.required<Combatant>();
  readonly build = model.required<PlayerBuild>();
  protected readonly storage = inject(BuildStorageService);
  /** Account-wide systems, then the combat buffs and debuffs, each under its own heading. */
  protected readonly accountKinds = STAT_SOURCE_KINDS.filter((k) => k.key !== 'buff' && k.key !== 'debuff');
  protected readonly combatKinds = STAT_SOURCE_KINDS.filter((k) => k.key === 'buff' || k.key === 'debuff');
  protected readonly statKeys = STAT_KEYS;
  protected readonly emptyBuild = emptyBuild;
  protected readonly status = signal('');

  protected readonly maxLevel = MAX_BASE_LEVEL;
  protected readonly mounts = computed(() => mountsForJob(this.catalog().mounts, this.build().jobId));
  /** Arrows for the equipped bow (none for other weapons). */
  protected readonly arrows = computed(() => {
    const cat = this.catalog();
    const w = this.build().equipment.find((e) => e.slot === 1 && e.equipId != null);
    const type = w ? cat.equipById.get(w.equipId!)?.weaponType ?? 0 : 0;
    return ammoFor(type, cat.ammo);
  });
  /** Highest job level of the current job (job-bonus.json maxJobLevel). */
  protected readonly maxJobLevel = computed(() => this.catalog().jobBonus.maxJobLevel[this.build().jobId] ?? 50);
  protected readonly jobMount = computed(() => defaultMount(this.catalog().mounts, this.build().jobId));
  /** Only jobs with their own base mount (VehicleTable Type 1) ride; Novice has none. */
  protected readonly hasMount = computed(() => hasJobMount(this.catalog().mounts, this.build().jobId));
  protected readonly elements = computed(() => this.catalog().enums.elements.filter((e) => e.id < 10));

  protected readonly points = computed(() => {
    const rules = this.catalog().statPoints;
    const total = pointsAt(rules, this.build().baseLevel);
    const used = spent(rules, this.build().stats);
    return { total, used, left: total - used };
  });

  protected readonly statMax = computed(() => {
    const rules = this.catalog().statPoints, b = this.build();
    return Object.fromEntries(STAT_KEYS.map((k) => [k, maxAffordable(rules, b.stats, k, b.baseLevel)])) as Record<keyof BaseStats, number>;
  });

  /** Per-kind option filter for this build (e.g. Seasonal Furnace needs the season equipped). */
  protected readonly availability = computed(() => {
    const b = this.build(), cat = this.catalog();
    return (kind: StatSourceKind) => kind.availableFor?.(b, cat) ?? (() => true);
  });
  protected readonly isSaved = computed(() => this.storage.builds().some((b) => b.name === this.build().name));

  protected patch(p: Partial<PlayerBuild>): void {
    this.build.update((b) => ({ ...b, ...p }));
  }

  /** Changing job resets a mount the new job cannot ride, so it falls back to the job's own mount. */
  protected setJob(jobId: number): void {
    const cur = this.build().mountId;
    const keep = cur != null && this.catalog().mountById.get(cur) && canRide(this.catalog().mountById.get(cur)!, jobId);
    // cap the job level to the new job; passives of another job line stop counting on their own (factory filter)
    const maxJob = this.catalog().jobBonus.maxJobLevel[jobId] ?? 50;
    this.patch({ jobId, mountId: keep ? cur : null, jobLevel: Math.min(this.build().jobLevel ?? 1, maxJob) });
  }

  protected setStat(k: keyof BaseStats, v: number): void {
    this.build.update((b) => ({ ...b, stats: { ...b.stats, [k]: v } }));
  }

  protected setEquipment(equipment: EquipSlotState[]): void {
    this.patch({ equipment });
  }

  protected setSource(key: string, picks: SourcePick[]): void {
    this.build.update((b) => ({ ...b, sources: { ...b.sources, [key]: picks } }));
  }

  protected setExtra(extraAttrs: StatBonus[]): void {
    this.patch({ extraAttrs });
  }

  protected save(): void {
    const name = this.build().name.trim();
    if (!name) {
      this.status.set('Give the build a name before saving.');
      return;
    }
    this.storage.save({ ...this.build(), name });
    this.status.set(`Saved "${name}" in this browser.`);
  }

  protected load(select: HTMLSelectElement): void {
    const b = this.storage.get(select.value);
    select.value = '';
    if (b) {
      this.build.set(b);
      this.status.set(`Loaded "${b.name}".`);
    }
  }

  protected remove(): void {
    const name = this.build().name;
    this.storage.remove(name);
    this.status.set(`Deleted saved build "${name}".`);
  }
}
