import { AttrDef } from '../models/master-data.models';
import { MasterDataService } from './master-data.service';

/** Names for frequent attributes that have no AttrInfoTable display name, in the game's own UI vocabulary. */
const FALLBACK_NAMES: Readonly<Record<number, string>> = {
  27: 'Equipment PATK', 28: 'PATK %', 31: 'Base PDEF %', 32: 'Equipment PDEF', 33: 'PDEF %', 36: 'Equipment MATK',
  37: 'MATK %', 41: 'Equipment MDEF', 42: 'MDEF %', 47: 'Max HP', 49: 'Max SP', 51: 'HIT', 53: 'FLEE', 55: 'CRIT',
  57: 'CRIT RES', 61: 'Refine PATK', 62: 'Refine MATK', 65: 'PDMG %', 66: 'MDMG %', 67: 'PDMG reduction %',
  68: 'MDMG reduction %', 69: 'Skill ASPD %', 71: 'ASPD %', 74: 'Move speed %', 75: 'HP regen', 76: 'HP regen %',
  78: 'SP regen %', 82: 'Fixed cast time %', 84: 'Variable cast time %', 249: 'Ranged physical DMG rate',
  283: 'Skill DMG %', 310: 'Physical DMG rate', 312: 'Weapon PATK', 313: 'Weapon MATK', 421: 'PATK and MATK',
  422: 'PATK and MATK %', 425: 'PDMG and MDMG %', 426: 'PDMG and MDMG reduction %',
  379: 'Pet HP', 380: 'Pet PATK', 381: 'Pet MATK', 382: 'Pet HIT', 383: 'Pet FLEE', 384: 'Pet SP', 385: 'Pet PDEF',
  386: 'Pet MDEF', 387: 'Pet ASPD', 388: 'Pet CRIT',
};

/** Display names and value formatting for game attribute ids (attr_ids.json). */
export class AttrNames {
  private constructor(private readonly byId: Map<number, AttrDef>) {}

  static async load(data: MasterDataService): Promise<AttrNames> {
    const file = await data.load<{ attrs: AttrDef[] }>('attr_ids.json');
    return new AttrNames(new Map(file.attrs.map((a) => [a.id, a])));
  }

  all(): AttrDef[] {
    return [...this.byId.values()];
  }

  of(id: number): string {
    const a = this.byId.get(id);
    if (!a) return `Attribute ${id}`;
    if (a.display) return a.display;
    if (FALLBACK_NAMES[id]) return FALLBACK_NAMES[id];
    // ATTR_PERCENT_FIRE_SKILL_ATK -> "Fire skill atk %"
    const words = a.enum.replace(/^ATTR_(BASIC_|SPECIAL_|EQUIP_)?/, '').replace(/^PERCENT_/, '').toLowerCase().split('_');
    const text = words.join(' ');
    return (text.charAt(0).toUpperCase() + text.slice(1)) + (this.isPercent(id) ? ' %' : '');
  }

  isPercent(id: number): boolean {
    const a = this.byId.get(id);
    return !!a && (a.kind === 'percent' || /_PER(_|$)|PERCENT/.test(a.enum));
  }

  /** Percent attrs are stored x10000. */
  format(id: number, value: number): string {
    const sign = value > 0 ? '+' : '';
    return this.isPercent(id) ? `${sign}${+(value / 100).toFixed(2)}%` : `${sign}${value}`;
  }
}
