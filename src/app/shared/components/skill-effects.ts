import { Component, computed, inject, input, signal } from '@angular/core';
import { buffEffectTypeName, scriptParts } from '../../core/engine/item-effects';
import { EffectLine, SkillEffectData, buffChain, buffDuration, castTargetLabel, lineAttrs } from '../../core/engine/skill-effects';
import { AttrNames } from '../../core/services/attr-names';
import { MasterDataService } from '../../core/services/master-data.service';
import { AttrList } from './attr-list';
import { plainText } from './skill-description';

/**
 * What a skill does besides damage, at its highest level: cast target and range, the buffs it creates (with chance)
 * and each buff's effect lines, following buffs that add more buffs. Loads skill-effects.json on first use.
 */
@Component({
  selector: 'app-skill-effects',
  imports: [AttrList],
  template: `
    @if (error()) {
      <p class="small">Could not load the skill effect data. Reload the page to try again.</p>
    } @else if (!data()) {
      <p class="small muted">Loading effects...</p>
    } @else if (view(); as v) {
      <dl class="skill-facts">
        <dt>Cast on</dt>
        <dd>{{ v.target }} <span class="muted small">(inferred from the target type)</span></dd>
        @if (v.level.castRange) {
          <dt>Cast range</dt>
          <dd>{{ v.level.castRange }} m</dd>
        }
        @if (v.level.radius.length) {
          <dt>Area radius</dt>
          <dd>{{ v.level.radius.join(', ') }} m</dd>
        }
      </dl>
      @for (row of v.rows; track row.id) {
        <div class="effect" [style.margin-left.rem]="row.depth">
          <p>
            <strong>{{ row.depth ? 'Adds buff' : row.party ? 'Party buff' : 'Buff' }} #{{ row.id }}{{ row.buff.name ? ': ' + row.buff.name : '' }}</strong>
            <span class="small"> {{ row.buff.debuff ? 'debuff' : 'buff' }}, {{ duration(row.buff.end) }}{{ row.chance != null && row.chance < 10000 ? ', ' + row.chance / 100 + '% chance' : '' }}</span>
          </p>
          @if (row.buff.desc) {
            <p class="small">{{ plain(row.buff.desc) }}</p>
          }
          <ul class="small script-lines">
            @for (line of row.buff.effects; track $index) {
              <li>
                @if (attrs(line); as a) {
                  <app-attr-list [attrs]="a" [names]="names()" />
                } @else {
                  @let p = parts(line.param);
                  {{ typeName(line.type) }}@if (p.name) {: <code>{{ p.name }}</code>}@if (p.args.length) { <span class="muted">{{ p.args.join(', ') }}</span>}
                }
                <span class="muted">{{ extras(line) }}</span>
              </li>
            }
          </ul>
        </div>
      } @empty {
        <p class="small muted">This skill creates no buff in the client data at Lv.{{ v.level.level }}.</p>
      }
      <p class="small muted">
        Lv.{{ v.level.level }}. Effects the server applies on its own (for example, which nearby units a song silences)
        are not in the client data; the skill description above covers them.
      </p>
    } @else {
      <p class="small muted">No effect data for this skill.</p>
    }
  `,
})
export class SkillEffects {
  readonly skillId = input.required<number>();
  readonly names = input.required<AttrNames>();

  protected readonly data = signal<SkillEffectData | null>(null);
  protected readonly error = signal(false);
  protected readonly typeName = buffEffectTypeName;
  protected readonly parts = scriptParts;
  protected readonly attrs = lineAttrs;
  protected readonly duration = buffDuration;
  protected readonly plain = plainText;

  constructor() {
    inject(MasterDataService).load<SkillEffectData>('skill-effects.json').then((d) => this.data.set(d), () => this.error.set(true));
  }

  protected readonly view = computed(() => {
    const d = this.data();
    const skill = d?.skills[this.skillId()];
    const level = skill?.levels.at(-1);
    if (!d || !skill || !level) return null;
    return { target: castTargetLabel(skill.target, skill.area), level, rows: buffChain(d, level) };
  });

  protected extras(line: EffectLine): string {
    const out: string[] = [];
    if (line.every) out.push(`every ${line.every} s`);
    if (line.cond) out.push(`only if ${line.cond}`);
    if (line.range) out.push(`within ${line.range.join(', ')} m${line.count ? `, up to ${line.count} units` : ''}`);
    if (line.target) out.push(`effect target type ${line.target} (not decoded)`);
    return out.length ? ` (${out.join('; ')})` : '';
  }
}
