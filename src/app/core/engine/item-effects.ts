import { EquipmentEntry, JobEntry, StatBonus } from '../models/master-data.models';
import { FightTempSource } from './fight-temp';
import { ProcSource } from './procs';

/**
 * ROGameLibs.BuffEffectType member names in declaration order (index = BuffEffectTable effect type).
 * Inferred: the enum has no explicit values in the client; the order fits the data (11 = Lua trigger script,
 * 20 = Lua attribute script, 6 = add buff, 7 = delete buff, 77 = snapshot attribute script).
 */
const BUFF_EFFECT_TYPES = [
  'Invalid', 'HPSPChange', 'AttributeChange', 'AttributeTranslate', 'SpecialState', 'Shapeshift', 'AddBuff',
  'DeleteBuffByID', 'DeleteBuffByType', 'Skill', 'TransfigureNew', 'LuaScript', 'UnitAttrChange', 'DeleteBuffByEffect',
  'AttributeSolidify', 'StopState', 'SkillInfo', 'Revive', 'Teleport', 'BeHitFxChange', 'LuaScriptChangeAttr',
  'BuffAttributeChange', 'VisibleHiding', 'ImmuneSpecialState', 'AutoFish', 'ChangeFightGroup', 'Effect', 'CallEntity',
  'BoomHair', 'ChangeScale', 'CallEagle', 'WeaponUnitAttrChange', 'Darkness', 'Link', 'Vehicle', 'MobMonster',
  'CallMobMonsterFollow', 'CommonSkill', 'CallNpcFollow', 'SoulBeatBack', 'ChangePassive', 'StartBlessing',
  'ReplaceBuffByAttr', 'Bar', 'Barrow', 'Illusory', 'TransfigureAddSkill', 'TeleportPos', 'AIEvent', 'Ornament',
  'CallAffixMonter', 'BuffLifeCycle', 'ActivateSkill', 'RefreshCD', 'NoUse3', 'SceneEffect', 'PlayFx', 'OverrideAnim',
  'Dead', 'CallNpc', 'DeleteEntity', 'ShowTVNotice', 'CloseTVNotice', 'ModifyMobSelfLimit', 'EnterStateMutex',
  'EquipDisable', 'ModifyAIHeartIntervalCombat', 'RandomShuffleHatred', 'HaloAddBuff', 'BeHitAudioChange', 'TeamBuff',
  'ShowBubble', 'None', 'IncrDungeonsTime', 'SceneEvent', 'ChangeColor', 'ReleaseSkillInAbnormalState',
  'ChangeAttrSnapshotByLuaScript', 'Damage', 'Xuqi', 'CameraFixed', 'HatredDiversion', 'SendBarrage', 'CallSlime',
  'SendNetEvent', 'EnsembleMobMonster', 'RogueAddSkill', 'ItemsGetting', 'SetRoleAttr', 'DamageTimeLimit',
  'ChangeBuffTime', 'SkillTypeForbid', 'JoystickMove', 'LookAtTarget', 'ClientNoUseSkill', 'SetBarrowAlpha',
  'AutoMoveForward', 'HideFashion', 'FourWayMove', 'ForbidRotation', 'HideButtonForRidingBird', 'RidingBird', 'Follow',
  'CreateModel', 'SwitchModelAnim', 'Floating', 'PvpTaunt', 'SpiritSkill', 'WheelDisable',
] as const;

export function buffEffectTypeName(type: number): string {
  return BUFF_EFFECT_TYPES[type] ?? `Type ${type}`;
}

/** One BuffEffectTable line of a buff: its effect type and raw parameter string. */
export interface EffectScript {
  effectId?: number;
  effectType: number;
  param: string;
}

/** equip-buffs.json row: a buff referenced by gear or cards. */
export interface EquipBuff {
  id: number;
  name: string;
  desc: string;
  attrs: StatBonus[];
  script?: EffectScript[];
}

/** What the damage calculator does with an effect id. */
export type EffectUse = 'attrs' | 'proc' | 'fightTemp';

export interface EffectLookups {
  equipBuffAttrs: ReadonlyMap<number, readonly StatBonus[]>;
  procById: ReadonlyMap<number, ProcSource>;
  fightTempSources: readonly FightTempSource[];
}

/** The calculator mechanisms that read this effect id: plain attrs, proc expected value, fight-temp values. */
export function effectUses(effectId: number, l: EffectLookups): EffectUse[] {
  const out: EffectUse[] = [];
  if (l.equipBuffAttrs.get(effectId)?.length) out.push('attrs');
  if (l.procById.has(effectId)) out.push('proc');
  if (l.fightTempSources.some((s) => s.effectId === effectId)) out.push('fightTemp');
  return out;
}

/** "Key=value|..." Lua script parameters, the first part being the script name when it has no "=". */
export function scriptParts(param: string): { name: string; args: string[] } {
  const parts = param.split('|').filter(Boolean);
  const named = parts.length > 0 && !parts[0].includes('=');
  return { name: named ? parts[0] : '', args: named ? parts.slice(1) : parts };
}

/**
 * Jobs that may wear an item (ItemTable.Profession). Empty = every job. Each listed job also covers the classes
 * above it, the same rule canEquip applies.
 */
export function requiredJobs(item: EquipmentEntry, jobs: readonly JobEntry[]): string[] {
  const ids = [...new Set((item.profession ?? []).map((p) => p[0]).filter((id) => id !== 0))];
  return ids.map((id) => jobs.find((j) => j.id === id)?.name ?? `Job #${id}`);
}
