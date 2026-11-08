import { Component, computed, input, model, signal } from '@angular/core';
import { MONSTER_RANKS } from '../../core/engine/combat-tables';
import { EMPTY_MONSTER_FILTER, MonsterFilterState, matchesMonster } from '../../core/engine/monster-filter';
import { MonsterFilter } from '../../shared/components/monster-filter';
import { DynamicScaling } from '../../core/engine/combatant-factory';
import { DynamicScalingEditor } from './dynamic-scaling-editor';
import { STAT_SOURCE_KINDS } from '../../core/engine/sources/kinds';
import { SourcePick } from '../../core/models/build.models';
import { Combatant } from '../../core/models/combat.models';
import { StatBonus } from '../../core/models/master-data.models';
import { Catalog } from '../../core/services/catalog.service';
import { EntityPicker } from '../../shared/components/entity-picker';
import { SectionPanel } from '../../shared/components/section-panel';
import { AttrEditor } from './attr-editor';
import { SourceListEditor } from './source-list-editor';
import { StatsSummary } from './stats-summary';

export interface MonsterTargetState {
  monsterId: number | null;
  sources: Record<string, SourcePick[]>;
  extraAttrs: StatBonus[];
  /** Content scaling for DynamicAttr monsters; null = table stats. */
  scaling?: DynamicScaling | null;
}

/** Monster target from EntityTable, plus buffs/debuffs and manual attributes applied to it. */
@Component({
  selector: 'app-monster-target',
  imports: [AttrEditor, DynamicScalingEditor, EntityPicker, MonsterFilter, SectionPanel, SourceListEditor, StatsSummary],
  template: `
    <app-monster-filter [enums]="catalog().enums" [(filter)]="filter" legend="Narrow the monster list" />
    <p class="small muted" role="status">{{ items().length }} of {{ catalog().monsters.length }} monsters match.</p>
    <app-entity-picker
      label="Monster"
      placeholder="Type a monster name"
      [items]="items()"
      [value]="state().monsterId"
      (valueChange)="patch({ monsterId: $event == null ? null : +$event, scaling: null })"
    />
    @if (info(); as m) {
      <dl class="facts">
        <div><dt>Level</dt><dd>{{ m.level }}</dd></div>
        <div><dt>Rank</dt><dd>{{ m.rank }}</dd></div>
        <div><dt>Race</dt><dd>{{ m.race }}</dd></div>
        <div><dt>Element</dt><dd>{{ m.element }}</dd></div>
        <div><dt>Size</dt><dd>{{ m.size }}</dd></div>
      </dl>
      @if (m.dynamic) {
        <app-dynamic-scaling-editor [dungeons]="catalog().dungeons" [monsterLevel]="m.level" [scaling]="state().scaling ?? null"
          (scalingChange)="patch({ scaling: $event })" />
      }
      @for (kind of kinds; track kind.key) {
        <app-source-list-editor
          [title]="kind.label"
          [hint]="kind.hint"
          [options]="catalog().sourceOptions.get(kind.key) ?? []"
          [names]="catalog().attrNames"
          [picks]="state().sources[kind.key] ?? []"
          (picksChange)="setSource(kind.key, $event)"
        />
      }
      <app-attr-editor [names]="catalog().attrNames" [attrs]="state().extraAttrs"
        (attrsChange)="patch({ extraAttrs: $event })" />
      @if (combatant(); as c) {
        <app-section-panel title="Monster stats" [open]="true">
          <app-stats-summary [combatant]="c" />
        </app-section-panel>
      }
    } @else {
      <p class="empty">Pick a monster to see its stats. The list holds the 979 field and handbook monsters.</p>
    }
  `,
})
export class MonsterTarget {
  readonly catalog = input.required<Catalog>();
  readonly combatant = input<Combatant | null>(null);
  readonly state = model.required<MonsterTargetState>();
  protected readonly kinds = STAT_SOURCE_KINDS.filter((k) => k.key === 'buff' || k.key === 'debuff');
  protected readonly filter = signal<MonsterFilterState>(EMPTY_MONSTER_FILTER);

  protected readonly items = computed(() =>
    this.catalog().monsters
      .filter((m) => matchesMonster(m, this.filter()))
      .map((m) => ({ id: m.id, label: `${m.name} Lv.${m.level} ${MONSTER_RANKS[m.rank] ?? ''}`.trim() })),
  );

  protected readonly info = computed(() => {
    const cat = this.catalog();
    const m = cat.monsters.find((x) => x.id === this.state().monsterId);
    if (!m) return null;
    const name = (list: { id: number; name: string }[], id: number) => list.find((x) => x.id === id)?.name ?? `#${id}`;
    return {
      dynamic: !!m.dynamicAttr,
      level: m.level,
      rank: MONSTER_RANKS[m.rank] ?? `#${m.rank}`,
      race: name(cat.enums.races, m.race),
      element: name(cat.enums.elements, m.element).replace(' Lv.1', ''),
      size: name(cat.enums.sizes, m.size),
    };
  });

  protected patch(p: Partial<MonsterTargetState>): void {
    this.state.update((s) => ({ ...s, ...p }));
  }

  protected setSource(key: string, picks: SourcePick[]): void {
    this.state.update((s) => ({ ...s, sources: { ...s.sources, [key]: picks } }));
  }
}
