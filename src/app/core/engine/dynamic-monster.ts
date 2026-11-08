/**
 * Port of CreateMonsterAttr.CalculateAttribute (create_monster_attr.lua:7-206): stats of scaled monsters
 * (EntityTable.DynamicAttr != 0). The game solves weapon ATK/MATK backwards from a target DPS and folds the
 * player's DEF curve into HP.
 *
 * expectHp / expectDps / expectLv come from server tables (utilTool:LuaGetActivityDynamicData*,
 * DungeonEntityAttrTable, DungeonStandardAttrTable) that are not shipped with the client, so the caller supplies them.
 */
export interface DynamicMonsterInput {
  /** EntityTable.Id (15003/15004 use the hunting-field branch). */
  entityId: number;
  /** EntityTable.UnitTypeLevel (0 normal, 1/2 boss/MVP per CMA). */
  typeLevel: number;
  str: number; int: number; agi: number; dex: number; luk: number;
  /** ATTR_BASIC_BASE_ASPD (EntityTable.ASPD). */
  baseAspd: number;
  /** Finals of the monster before this pass (static monster pipeline, 09 section 4.1). */
  defFinal: number; mdefFinal: number; hitFinal: number;
  /** ATTR_BASIC_FLEE before this pass (EntityTable.FLEE). */
  flee: number;
  /** EntityTable.UnitLevel. */
  tableLevel: number;
  /** ATTR_BASIC_DEF / MDEF from the table; kept unless the content sets equipment DEF. */
  def: number; mdef: number;
  dynamicAtk: number; dynamicHp: number;
  /** Dungeons 4000-4999: pass DynamicDungeonCalculator's HP_E/DPS_E and expectLv = dungeon level. */
  expectHp: number; expectDps: number; expectLv: number;
  /** DungeonsTable.DynamicFunctionID. */
  fn: number;
  typeLv: number;
  dungeonId: number;
  /** Used only by the hunting-field branch (fn 101, entity 15003/15004). */
  serverLevel?: number;
}

export interface DynamicMonsterStats {
  level: number; maxHp: number; weaponAtk: number; weaponMatk: number;
  hit: number; flee: number; def: number; mdef: number;
}

const curveA = (lv: number) => Math.max(0.7659 * Math.exp(-0.009 * (lv - 29)), 0.1);
const curveB = (lv: number) => Math.max(0.8145 * Math.exp(-0.008 * (lv - 29)), 0.1);

export function dynamicMonsterStats(i: DynamicMonsterInput): DynamicMonsterStats {
  const bossish = i.typeLevel === 1 || i.typeLevel === 2;
  const tower = i.dungeonId >= 4000 && i.dungeonId < 5000;
  let hpE = i.expectHp || 100;
  let dpsE = i.expectDps || 10;
  let lv = i.expectLv;
  let def: number;
  let mdef = 1;
  let weaponDef = 0;
  let weaponMdef = 0;

  if (lv < 30) def = 1;
  else if (i.fn === 2 || i.fn === 12) { def = curveA(lv) * 0.7; mdef = 1.2; }
  else if (i.fn === 9) {
    def = i.typeLv === 2 ? curveA(lv) * 0.7 : curveB(lv);
    const boss = i.typeLv === 2 ? [6, 1.5] : [4, 0.75];
    weaponDef = Math.floor(Math.max(0, lv * (bossish ? boss[0] : 2)));
    weaponMdef = Math.floor(Math.max(0, lv * (bossish ? boss[1] : 0.5)));
  } else if (i.fn === 7) def = curveA(lv) * 0.7;
  else if (i.fn === 5 && (i.typeLv === 2 || i.typeLv === 3)) def = curveA(lv);
  else def = curveB(lv);

  // hunting field / SRQY: level and DEF factor are overridden and HP_E/DPS_E are re-read from the native lookup
  // after the 0 -> default step, so a 0 stays 0 here
  const hunting = i.fn === 101 || i.entityId === 15003 || i.entityId === 15004;
  if (hunting || i.dungeonId === 5030) {
    if (hunting) lv = i.serverLevel ?? lv;
    def = curveA(lv) * 0.7; mdef = 1; hpE = i.expectHp; dpsE = i.expectDps;
  }

  const aspdF = 50 / (200 - i.baseAspd);
  const atkSuzhi = (i.str + i.dex / 5 + i.luk / 5 + lv / 4) * 2;
  const matkSuzhi = i.int * 1.5 + i.dex / 5 + i.luk / 3 + lv / 4;
  const cri = Math.min(i.luk / 3, 100);
  let hit = lv * 2.5 - i.dex + 40 + (i.typeLevel !== 0 ? lv * 0.5 : 0);
  let flee = lv - i.agi;
  const reduc = (d: number, m: number) => Math.max((d + 4000) / (d * 10 + 4000), (m + 1000) / (m * 10 + 1000));
  // CMA uses the raw DynamicHp/DynamicAtk here, not the 0->1 defaulted copies
  let hp = hpE * i.dynamicHp * reduc(i.defFinal, i.mdefFinal);
  if (tower) {
    hit = Math.max(i.hitFinal + i.dex, 0, (lv - i.tableLevel) * 2) + lv * 2 + 100;
    flee = i.flee + Math.max(0, lv - i.tableLevel);
    hp = hpE * i.dynamicHp * reduc(weaponDef, weaponMdef) * 0.28;
  }
  // every Function except "< 40" uses the 1.95 level term (the two Lua branches are identical)
  const lvTerm = lv * 0.7 * (lv < 40 ? 1 : 1.95);
  let atk = ((dpsE * i.dynamicAtk / aspdF / (1.5 * cri / 100 + (1 - cri / 100) * 0.8) + lvTerm) / def - atkSuzhi) / (1 + i.str / 200);
  let matk = (4 * dpsE * i.dynamicAtk + lv * 0.7) / 2 / mdef - matkSuzhi;
  if (dpsE === 0) { atk = 0; matk = 0; }
  if (tower) { atk *= 0.3; matk *= 0.3; }

  // LuaSetAttr floors every write (Common/AttrCalculator.lua)
  return {
    level: Math.floor(lv), maxHp: Math.floor(hp), weaponAtk: Math.floor(atk), weaponMatk: Math.floor(matk),
    hit: Math.floor(hit), flee: Math.floor(flee),
    def: weaponDef || i.def, mdef: weaponMdef || i.mdef,
  };
}
