import { Component, computed, input } from '@angular/core';
import { EffectScript, EffectUse, buffEffectTypeName, effectUses, scriptParts } from '../../core/engine/item-effects';
import { Catalog } from '../../core/services/catalog.service';
import { AttrList } from './attr-list';
import { plainText } from './skill-description';

const USE_LABEL: Record<EffectUse, string> = {
  attrs: 'attributes counted in the build',
  proc: 'proc, optional expected value in the Procs panel',
  fightTemp: 'combat values the damage formulas read (fight-temp)',
};

/**
 * One card or gear effect (a BuffTable id): description, plain attributes, every effect line with its type and
 * script parameters, and what the damage calculator does with it.
 */
@Component({
  selector: 'app-effect-detail',
  imports: [AttrList],
  template: `
    @let v = view();
    <div class="effect">
      <p>
        @if (v.desc) { {{ v.desc }} } @else { <span class="muted">No description in the game data.</span> }
        <span class="muted small"> (effect #{{ effectId() }})</span>
      </p>
      @if (v.attrs.length) {
        <app-attr-list [attrs]="v.attrs" [names]="cat().attrNames" />
      }
      @if (v.scripts.length || params()) {
        <ul class="small script-lines">
          @for (s of v.scripts; track $index) {
            @let p = parts(s.param);
            <li>
              {{ typeName(s.effectType) + ' (' + s.effectType + ')' + (p.name || p.args.length ? ': ' : '') }}@if (p.name) {<code>{{ p.name }}</code>}@if (p.args.length) {<span class="muted">{{ (p.name ? ' ' : '') + p.args.join(', ') }}</span>}
            </li>
          }
          @if (params(); as ps) {
            <li>Script parameters: <span class="muted">{{ ps }}</span></li>
          }
        </ul>
      }
      <p class="small muted">
        Calculator: {{ v.uses.length ? v.uses.join('; ') : 'not computed (description only)' }}.
      </p>
    </div>
  `,
})
export class EffectDetail {
  readonly cat = input.required<Catalog>();
  readonly effectId = input.required<number>();
  /** Inline description / script from the item row; falls back to equip-buffs.json. */
  readonly desc = input<string | undefined>();
  readonly script = input<EffectScript[] | undefined>();
  readonly params = input<string>('');

  protected readonly typeName = buffEffectTypeName;
  protected readonly parts = scriptParts;

  protected readonly view = computed(() => {
    const cat = this.cat();
    const buff = cat.equipBuffById.get(this.effectId());
    const uses = effectUses(this.effectId(), {
      equipBuffAttrs: cat.equipBuffAttrs, procById: cat.procById, fightTempSources: cat.fightTemp.sources,
    });
    return {
      desc: plainText(this.desc() || buff?.desc || cat.procById.get(this.effectId())?.desc || ''),
      attrs: cat.equipBuffAttrs.get(this.effectId()) ?? [],
      scripts: this.script() ?? buff?.script ?? [],
      uses: uses.map((u) => USE_LABEL[u]),
    };
  });
}
