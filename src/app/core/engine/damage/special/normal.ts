import { Attr } from '../../../models/attr';
import { physicalTotal } from '../formula';
import { SpecialFormula, ca } from './common';

const normal = (script: string, label: string, raw: SpecialFormula['raw']) =>
  new SpecialFormula({ script, label, kind: 'normal', flee: 'normal', canCrit: true, raw });

export const NORMAL_FORMULAS: readonly SpecialFormula[] = [
  /** DC:7897 Thief-line attack: half the weapon ATK (refine part whole); skipped skill 500010 double attack. */
  normal('ErDaoLianJi', 'Normal attack (Thief line)', (m, s, F, ctx) => {
    // katar off-hand = 1 + damage x DeputyDam, and DeputyDam needs skill 500010
    if (ctx.segment > 0 && ctx.attacker.weaponType === 16) return 0;
    // shortcut: in PvP buildModifiers compresses weapon + refine together, so this halves the uncompressed weapon ATK
    const weaponAtk = m.weaponAtk - ca(ctx, Attr.WEAPON_ATK_FINAL) / 2;
    return physicalTotal({ ...m, weaponAtk }, s, F);
  }),
  /** DC:17901 Novice-line attack; skipped skill 1000014 double attack roll. */
  normal('CCErDaoLianJi', 'Normal attack (Novice line)', (m, s, F) => physicalTotal(m, s, F)),
  /** DC:11727 Crusader attack; skipped Sacrifice (buff 225) and buff 220327 ratio. */
  normal('CrusaderCommonSkillCritCalcHMT', 'Normal attack (Crusader)', (m, s, F) => physicalTotal(m, s, F)),
];
