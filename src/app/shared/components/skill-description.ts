import { Component, computed, input } from '@angular/core';
import { SkillEntry } from '../../core/models/master-data.models';

/** Game rich text -> plain text: drops <color=...> and similar tags, keeps line breaks. */
export function plainText(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\\n/g, '\n').trim();
}

/** Fills {0}, {1}, ... with the per-level values from SkillEffectTable.SkillDescRep. */
export function fillDescription(template: string, values: readonly string[] = []): string {
  return plainText(template.replace(/\{(\d+)\}/g, (m, i: string) => values[+i] ?? m));
}

/** Full skill description: summary, the text at one level (or every level) and the extra notes. */
@Component({
  selector: 'app-skill-description',
  template: `
    @let s = skill();
    @if (s.simpleDesc) {
      <p class="desc-summary">{{ plain(s.simpleDesc) }}</p>
    }
    @if (s.desc) {
      @if (level() != null) {
        <p class="desc-text">{{ textAt(level()!) }}</p>
      } @else {
        <ol class="desc-levels">
          @for (l of perLevel(); track l.level) {
            <li><span class="desc-lv">Lv.{{ l.level }}</span> {{ l.text }}</li>
          }
        </ol>
      }
    }
    @if (s.descAdd) {
      <p class="desc-add">{{ plain(s.descAdd) }}</p>
    }
    @if (!s.simpleDesc && !s.desc && !s.descAdd) {
      <p class="small muted">The game has no description for this skill.</p>
    }
  `,
})
export class SkillDescription {
  readonly skill = input.required<SkillEntry>();
  /** Show one level; null lists every level. */
  readonly level = input<number | null>(null);

  protected readonly perLevel = computed(() =>
    this.skill().levels.map((l) => ({ level: l.level, text: fillDescription(this.skill().desc ?? '', l.descRep) })),
  );

  protected textAt(level: number): string {
    const l = this.skill().levels.find((x) => x.level === level) ?? this.skill().levels.at(-1);
    return fillDescription(this.skill().desc ?? '', l?.descRep);
  }

  protected plain(s: string): string {
    return plainText(s);
  }
}
