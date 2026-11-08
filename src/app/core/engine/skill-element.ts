import { SkillEntry } from '../models/master-data.models';

/**
 * Where a skill's attack element comes from. The game sets it natively (args.attack_type_); this follows
 * SkillTable.SkillAttr:
 * - 1..9: the skill's own element, always (observed in the data, e.g. Fire Bolt 3, Holy Light 6).
 * - 10: "Forced Neutral" (ElementAttr name): neutral even with an elemental weapon or arrow.
 * - 0 / -1 on a physical attack: the weapon element, or the arrow element for skills that consume arrows
 *   [inferred: 10 exists as a separate "forced" value, so 0 is the weapon-following default].
 * - 0 / -1 on a spell: neutral (a spell has no weapon to take an element from) [inferred].
 */
export type ElementSource =
  | { kind: 'fixed'; element: number }
  | { kind: 'forced-neutral' }
  | { kind: 'weapon'; arrows: number }
  | { kind: 'spell-neutral' };

export function elementSource(skill: Pick<SkillEntry, 'element' | 'arrows'>, damageKind: 'normal' | 'physical' | 'magic'): ElementSource {
  if (skill.element === 10) return { kind: 'forced-neutral' };
  if (skill.element > 0) return { kind: 'fixed', element: skill.element };
  if (damageKind === 'magic') return { kind: 'spell-neutral' };
  return { kind: 'weapon', arrows: skill.arrows ?? 0 };
}

/** The element the attack actually uses, given the attacker's weapon element and loaded arrow (if any). */
export function attackElementOf(src: ElementSource, weaponElement: number, arrowElement: number | null): number {
  switch (src.kind) {
    case 'fixed': return src.element;
    case 'forced-neutral': return 10;
    case 'spell-neutral': return 0;
    case 'weapon': return src.arrows > 0 && arrowElement != null ? arrowElement : weaponElement;
  }
}

/** Plain-words label for skill lists. */
export function elementSourceLabel(src: ElementSource, elementName: (id: number) => string): string {
  switch (src.kind) {
    case 'fixed': return `${elementName(src.element)} (fixed)`;
    case 'forced-neutral': return 'Neutral (forced, ignores weapon and arrow)';
    case 'spell-neutral': return 'Neutral (spell)';
    case 'weapon': return src.arrows > 0 ? `Weapon or arrow element (${src.arrows} arrow${src.arrows > 1 ? 's' : ''} per cast)` : 'Weapon element';
  }
}
