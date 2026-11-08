import { Component, computed, input } from '@angular/core';
import { Attr } from '../../core/models/attr';
import { Combatant } from '../../core/models/combat.models';

const ROWS: [string, number, 'int' | 'pct' | 'aspd'][] = [
  ['HP', Attr.MAX_HP_FINAL, 'int'], ['SP', Attr.MAX_SP_FINAL, 'int'],
  ['PATK', Attr.BASE_ATK_FINAL, 'int'], ['Equipment PATK', Attr.WEAPON_ATK_FINAL, 'int'],
  ['Refine PATK', Attr.TOTAL_REFINE, 'int'],
  ['MATK', Attr.BASE_MATK_FINAL, 'int'], ['Equipment MATK', Attr.WEAPON_MATK_FINAL, 'int'],
  ['Refine MATK', Attr.TOTAL_MREFINE, 'int'],
  ['PDEF', Attr.BASE_DEF_FINAL, 'int'], ['Equipment PDEF', Attr.DEF_FINAL, 'int'],
  ['MDEF', Attr.BASE_MDEF_FINAL, 'int'], ['Equipment MDEF', Attr.MDEF_FINAL, 'int'],
  ['HIT', Attr.HIT_FINAL, 'int'], ['FLEE', Attr.FLEE_FINAL, 'int'],
  ['CRIT', Attr.CRI_FINAL, 'int'], ['CRIT RES', Attr.CRI_RES_FINAL, 'int'],
  ['CRIT DMG', Attr.CRI_DAM_PER, 'pct'], ['Attacks per second', Attr.ASPD_FINAL, 'aspd'],
  ['Fixed cast time', Attr.CT_FIXED_PER_FINAL, 'pct'], ['Variable cast time', Attr.CT_CHANGE_PER_FINAL, 'pct'],
  ['PDMG', Attr.DAM_INCREASE_FINAL, 'pct'], ['PDMG reduction', Attr.DAM_REDUC_FINAL, 'pct'],
  ['MDMG', Attr.MDAM_INCREASE_FINAL, 'pct'], ['MDMG reduction', Attr.MDAM_REDUC_FINAL, 'pct'],
  ['STR', Attr.STR_FINAL, 'int'], ['AGI', Attr.AGI_FINAL, 'int'], ['VIT', Attr.VIT_FINAL, 'int'],
  ['INT', Attr.INT_FINAL, 'int'], ['DEX', Attr.DEX_FINAL, 'int'], ['LUK', Attr.LUK_FINAL, 'int'],
];

/** Final derived stats of a unit, as computed by the attribute port. */
@Component({
  selector: 'app-stats-summary',
  template: `
    <dl class="stats">
      @for (r of rows(); track r.label) {
        <div><dt>{{ r.label }}</dt><dd class="num">{{ r.value }}</dd></div>
      }
    </dl>
  `,
})
export class StatsSummary {
  readonly combatant = input.required<Combatant>();

  protected readonly rows = computed(() => {
    const a = this.combatant().attrs;
    return ROWS.map(([label, id, f]) => {
      const v = a.get(id);
      const value = f === 'pct' ? `${+(v / 100).toFixed(2)}%` : f === 'aspd' ? (v / 10000).toFixed(2) : String(v);
      return { label, value };
    });
  });
}
