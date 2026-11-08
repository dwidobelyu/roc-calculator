import { SkillLevel } from '../models/master-data.models';

export type CalcStatus = 'ported' | 'approximated' | 'none' | 'linked';

/** Calculator support for a skill's damage, in player words. */
export const CALC_STATUS: Readonly<Record<CalcStatus, string>> = {
  ported: 'Exact: uses the game formula',
  approximated: 'Estimate: generic formula',
  none: 'No damage to calculate',
  linked: 'Not calculated yet: damage comes from its area effect',
};

/** "Deals 300% Holy MDMG", "attack ... dealing ... PDMG": the description says the skill hurts its targets. */
const DEALS_DAMAGE = /\b(deals?|dealing|attacks?|strik\w+)\b[^.]*?\b[PM]DMG\b/i;

/**
 * A skill with no damage script (DamageNil) whose description says it deals PDMG or MDMG does its damage through an
 * area, trap or summon effect (Storm Gust, Meteor Storm, Land Mine). Inferred: the client has no table link to that
 * effect. The table ratio is not used: buff skills (Blessing) and utility skills (Detoxify) carry ratios and hit
 * counts too.
 */
export function calcStatus(scriptStatus: 'ported' | 'approximated' | 'none', desc: string): CalcStatus {
  return scriptStatus === 'none' && DEALS_DAMAGE.test(desc.replace(/<[^>]+>/g, '')) ? 'linked' : scriptStatus;
}

const pct = (ratio: number) => `${+(ratio / 100).toFixed(1)}%`;
const hits = (n: number) => (n > 1 ? `${n} hits` : '1 hit');

/**
 * Damage of one level in plain words: "350% ATK + 200, 1 hit", segments joined by "then". Table ratio 0 with a damage
 * script means the script sets the damage ("Damage set by its script, 10 hits").
 */
export function damageText(level: SkillLevel, damageType: number, status: CalcStatus): string {
  // utility and buff skills carry table ratios too (Sight 100%); without damage they show none
  if (status === 'none') return 'No direct damage';
  const base = damageType === 2 ? 'MATK' : 'ATK';
  const segs = level.pveRatio
    .map((r, i) => ({ r, f: level.pveFlat[i] ?? 0, h: level.hits[i] ?? 1 }))
    .filter((s) => s.r || s.f);
  if (!segs.length) {
    return `Damage set by its ${status === 'linked' ? 'area effect' : 'script'}, ${hits(Math.max(1, ...level.hits))}`;
  }
  return segs.map((s) => `${s.r ? `${pct(s.r)} ${base}` : ''}${s.r && s.f ? ' + ' : ''}${s.f ? s.f : ''}, ${hits(s.h)}`).join(' then ');
}

/** Base cast time, cooldown and SP cost of one level (before DEX, gear and buffs): "Cast 1.25 s, cooldown 1 s, 172 SP". */
export function useText(level: SkillLevel): string {
  const cast = level.castFixed + level.castVar;
  const parts = [cast > 0 ? `Cast ${+cast.toFixed(2)} s` : 'Instant cast'];
  if (level.cooldown > 0) parts.push(`cooldown ${+level.cooldown.toFixed(2)} s`);
  // SkillCost [attr, amount]: attr 7 = SP
  if (level.cost?.[0] === 7 && level.cost[1] > 0) parts.push(`${level.cost[1]} SP`);
  return parts.join(', ');
}
