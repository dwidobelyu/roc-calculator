import { StatSourceKind } from '../stat-source';
import { AstrocoreKind } from './astrocore.kind';
import { BuffKind } from './buff.kind';
import { CardDepositKind } from './card-deposit.kind';
import { DivineArmamentKind } from './divine-armament.kind';
import { GuildSkillKind } from './guild-skill.kind';
import { MedalKind } from './medal.kind';
import { MonsterResearchKind } from './monster-research.kind';
import { MountKind } from './mount.kind';

/**
 * Account-wide stat-source panels shown in a build editor, in display order. Register new systems here.
 * Per-item systems (enchant, card star and level, inscription) live in the equipment slot instead.
 */
export const STAT_SOURCE_KINDS: readonly StatSourceKind[] = [
  new CardDepositKind(),
  new MonsterResearchKind(),
  new MountKind(),
  new AstrocoreKind(),
  new DivineArmamentKind(),
  new MedalKind(),
  new GuildSkillKind(),
  new BuffKind('buff', 'Buffs', 'Buffs active on this unit.', false),
  new BuffKind('debuff', 'Debuffs', 'Debuffs applied to this unit.', true),
];
