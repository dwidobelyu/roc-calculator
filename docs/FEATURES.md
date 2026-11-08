# Features

This file describes every feature of the ROC Damage Calculator: what you can set, which game rule decides the
result, which data file it reads, and where the calculator has to infer a value. How to run the project and how the
code is organised is in [../README.md](../README.md).

Data version: game client 1.2.3.115. File names in this document are in `public/data` unless a path says otherwise,
and the counts are the sizes of those files.

## Pages

| Page | Route | Purpose |
|---|---|---|
| Calculator | `#/` | Build a character, pick a target and an attack, read the damage. `#/?monster=<id>` opens it with that monster as the target |
| Monsters | `#/monsters` | All 995 monsters: level, rank, race, element, size, HP; open one for its final stats and skills, or send it to the calculator |
| Equipment | `#/equipment` | Every wearable item with the rules the equipment editor uses |
| Cards | `#/cards` | All 1,757 cards with effects, album bonus and "+" versions |
| Player skills | `#/skills/player` | Browse job skills, card skills and equipment skills (Skill type filter) |
| Monster skills | `#/skills/monster` | Browse the 1,398 skills monsters use |
| Stalker Copy | `#/stalker-copy` | Which monster teaches which skill to a Stalker |

The pages sit behind one Menu button in the header (every screen size). It opens a plain list of the pages in the
order above, with the theme switch at the bottom. Picking a page, Escape or a click outside closes it. The stylesheet
uses no fixed pixels: layout in %, vw, vh and fr, sizes and spacing in rem (they follow the browser font size and
zoom), breakpoints in em. Every list (Monsters, Equipment, Cards, both skill pages, Stalker Copy) shows 50 items per
page with Previous, numbered pages and Next. On wider screens an item's main row and its details row share one block,
with a firm line between items; on a phone (40em, 640px at default settings, or narrower) each item becomes a card
with labelled fields.

All pages load the same master data once: 42 JSON files, about 11 MB before compression. While it loads, each page
shows a loading message; if a file fails, it shows the error and a retry button.

## Scope: Ragnarok Origin Classic only

The ROC client shares code and tables with Ragnarok Origin, so the game data contains systems ROC does not run. The
calculator keeps only what ROC uses:

- Jobs: official jobs up to 2nd trans. Novice and Doram Novice, the six classic lines up to their trans class, the
  Doram line up to Summoner and the Gunslinger line up to Rebellion. No 3rd jobs, no Super Novice line, no NPC
  professions. That gives 40 jobs (`jobs.json`).
- Pets: the 9 ROC pets (`pets.json`): Sohee, Baphomet Jr., King Piggy, Kitten Oracle, Abyss Witch, Teacup Rabbit,
  Dr. Owl, Squidgitte, Child of Earth.
- Card levels stop at 15 (`card-levels.json`).
- Left out on purpose: honorary title level, Divine Armament legendary effects and dream affixes, Sacred Quenching,
  Feather Recycle, Faith, Runes, Halo, Antique, Soul Force and Favorability.

## Calculator page

The page has three columns: your build, the target, and the attack with its result. With a player as the target,
both build editors share grid rows, so each panel lines up with its counterpart.

### Attacker

| Choice | What it computes |
|---|---|
| Your build | The build editor below, through `core/engine/attribute-calculator.ts` |
| Your pet | The pet in deployed slot 1 as the attacker (`core/engine/pet-combatant.ts`), in its base form at its level |
| A monster | A monster attacking your build, with its own skill scripts |
| Target player | The player build in the Target column attacks your build: the damage you take in PvP (PvP ratio, flat, hits and hit/flee rules apply because both units are players). Card and gear procs are not added for this attacker |

### Build editor

The same editor serves the attacker and a player target. It is split into collapsible panels.

#### Character and base stats

- Job (40 jobs) and base level up to 99. Changing job keeps the mount only if the new job may ride it.
- Job level, capped at the job's highest job level. Job-level bonus stats are summed along the job line
  (`job-bonus.json`).
- The six stats, each 1 to 99. The editor counts the points you spent against the points owned at the base level and
  says how many are left or over (`stat-points.json`, `core/engine/stat-points.ts`).
- Weapon element (Neutral to Undead), for endows or elemental weapons.
- Arrow: shown only with a bow equipped (7 arrow types, `ammo.json`). Skills that consume arrows take the arrow's
  element.
- Mount and "Riding the mount": shown only for jobs with their own base mount (`mounts.json`). Novice has none. The
  default is the job's mount (Alpaca for the Acolyte line, Lion for Swordsman, and so on); the list holds only
  mounts the job may ride. Riding changes passives that check the mount, such as Spear Mastery.

#### Equipment, cards, enchant, refine and enhance

One block per slot: Weapon, Off-hand, Armor, Cape, Boots, two Accessories, Headwear, Face, Mouth, Back, Fashion,
Trolley and Battle Bird.

- Item lists show only gear the job can wear (the item's job list, checked against the whole job line, so a Priest
  gets no bows). Gear left from an earlier job is flagged and adds nothing. Rules: `core/engine/equipment-rules.ts`.
- Divine Armament (`divine-equipment.json`, 480 items) comes first, newest season and highest tier on top, with its
  base attribute roll as an input (the roll range comes from the item).
- Face, Mouth, Back and Fashion hold one fixed item named "Face/Mouth/Back/Fashion". In ROC every item of these
  slots has the same stats, 2 card slots and refine up to +20, so the slot always counts them:

  | Slot | Stats |
  |---|---|
  | Face | PDEF +15, MDEF +5, DEX +3 |
  | Mouth | PDEF +15, MDEF +5, AGI +3 |
  | Back | PDEF +15, MDEF +5, VIT +3 |
  | Fashion | Weapon ATK +15, Weapon MATK +15, STR +3, INT +3 |

  The fixed items are built from `equipment.json` at load time (`collapseSharedLookSlots` in
  `core/engine/item-upgrades.ts`).
- Trolley appears only when the job line learns Pushcart (skill 600012, Merchant line). Battle Bird appears only when
  it learns Falconry Mastery (710106, Hunter line). The game checks the same skills before it lets you equip them.
- Refine up to the item's cap, with the bonus from its refine table (`refine.json`). Enhance per slot
  (`enhance.json`), up to Lv.99. The table goes to 150 or 200, but the game also caps enhance at the player's level
  (`EquipStrengthenmoreMgr.lua`), and the level cap is 99.
- Enchant: up to 3 lines, chosen only from lines that roll on that item and job (`enchant.json`,
  `core/engine/item-options.ts`). Job-locked effect lines (Magic Boon on a weapon or accessory for caster jobs) are
  hidden from other jobs.
  Three fixed slots: Enchant 1 takes an Effect enchant line or a basic Enchant line (an attribute by level); Enchant 2
  and Enchant 3 take basic Enchant lines only. So an item has 1 Effect enchant + 2 Enchants, or 3 Enchants. An Effect
  enchant in slot 2 or 3 (from an old saved build) does not count. The legacy enchant system (EquipEnchantTable) is not
  offered.
- Inscription (`inscriptions.json`): a Legendary Ornament accessory (44 items, the ones with a LegendaryOrnamentChargeTable row: Morrigane's Pendant, Divine Wrath, Doombringer, Bradium Brooch, Pendant of Harmony and Pendant of Chaos at Lv.99, Freya and Meteor accessories at Lv.120) takes one gem
  out of 107. The gem list shows each gem's quality (1 to 5) and season. The gem's plain stats count; gems whose
  effect is a proc or a script show their description and add no fixed stat.
- Gear buffs that decode to plain attributes count directly (`equip-buffs.json`). Effects that only set combat
  values go to the damage formulas (see Fight-temp values below).

#### Cards in equipment

- Each item shows exactly as many card slots as it has, and only cards that fit that slot (`cards.json`).
- Card star (0 to 3) and card level apply to awakened "+" cards only (513 cards). The game levels and stars only
  those cards; base cards keep their own stats. Each card slot has an "Awakened (+)" checkbox that swaps the card
  for its other version (`awakenedCardId` / `baseCardId` in `cards.json`) and shows star and level. Cards with no
  awakened version say so instead.
- Card level goes up to 15. The bonus is the sum of every level's bonus up to the chosen level, picked by the card's
  slot and quality (`card-levels.json`). Each star allows a higher level: Lv.5 at star 0, Lv.10 at star 1, Lv.15 at
  star 2. If you enter a level above the current star's cap, the editor raises the star to the lowest one that
  allows it; lowering the star lowers the level to the new cap.
- Star bonuses are totals up to the chosen star (the `levels` of a "+" card in `cards.json`).

#### Set bonuses

Computed from the equipped gear, no input needed (`core/engine/set-bonuses.ts`):

- Refine set, enhance set (Echo) and enchant set (Syntony) from `refine-suit.json`, `enhance-suit.json` and
  `enchant-suit.json`: the highest tier whose piece count and level are met. Which tier wins when several are met is
  inferred, because the game checks sets on the server. The breakdown names the active tier as "x/6 at +N".
- The refine set needs 6 pieces at +3, +5, +8, +10, +12, +15, +18 or +20. It counts only the slots the game counts
  (SuitPart 0-10 and 15), so Trolley and Battle Bird are left out. Its "All Stats +N" buff comes from the Lua script
  decoded in `script-buffs.json`.
- Feather sets per statue (`feather-suits.json`): the colour mix and the lowest feather level in the group pick the
  set.

#### Feathers

10 fixed slots: 5 attack slots that take ATK or MIX feathers, 5 defense slots that take DEF or MIX. Each slot picks
one of 25 feather kinds (`feather-kinds.json`) and its level. The level list stops at what the base level allows
(Lv.68 allows 5, Lv.80 8, Lv.85 11, Lv.90 14, Lv.95 17, Lv.99 20). Below base level 68 feathers are locked: the
editor says so instead of an empty level list, and a feather picked while locked counts at the highest allowed level
once the base level unlocks it (`featherLevel`). Feathers are the statue jewels of the game; the English client
calls them feathers.

#### Passive skills

The skill tree of the job line (156 passives, `passive-skills.json`). Each passive takes a level. A weapon-type
passive counts only with that weapon, a mounted bonus only while riding.

#### Pet

4 deployed slots and 5 assist slots, each holding one of the 9 ROC pets (`pets.json`):

- Deployed pet: the evolution deployed bonus (PetEvolutionTable `FightAdditionAttrs`, Max HP, Max SP and Weapon
  ATK %) at the chosen evolution rank 0 to 10. ROC has no pet star step, so the PetRankUpTable star bonus is not
  offered or added.
- Assist pet: the evolution assist bonus (PetEvolutionTable `HelptAdditionAttrs`, flat Max HP, Max SP and Weapon
  ATK) at the chosen rank.
- The evolution bonus is inferred: it is unknown whether PetEvolutionTable is still live, and the client gets the
  real assist bonus from the server (`RequestPetSuperimposedAttr`).
- Deployed slot 1 is also the attacking pet. Its pet level 1 to 99 shows its own level-up stats
  (`pet-levels.json`); these stay on the pet and add nothing to the owner.
- Builds saved with the old single active pet load it into deployed slot 1, without an evolution bonus.

#### Account systems

Each system is one panel and one class in `core/engine/sources/kinds/`. You add entries and set a level or a value;
the panel shows what each entry grants.

| Panel | Data file | What you set |
|---|---|---|
| Card deposit | `card-deposit.json` | Cards stored in the album (558) |
| Monster Research | `monster-research.json` | Your research level; every level reached adds its bonus |
| Mount level | `mounts.json` | One mount level for all 5 traits, trait quality, mount equipment. Hidden for jobs without a mount |
| Astrocore | `astrocore.json` | Main star: the level of the 6 open statues (Serpenta, Sagitta, Felina, Lumia, Alvara, Divinia). Sub-star: the 3 sub-stars of each, level = stage x 10 + star |
| Divine Armament: Seasonal | `divine-armament.json` | Permanent Stats of every season, Seasonal Stats of the current season |
| Medals | `medals.json` | Level of each medal |
| Guild skills | `guild-skills.json` | Level of each type 1 guild skill (4 skills) |
| Buffs, Debuffs | `buffs-all.json`, `script-buffs.json` (6,945 buffs) | Buffs on this unit, with stack count where it applies |
| Manual attributes | none | Any attribute by id and value, for anything the data does not cover |

Divine Armament: Seasonal follows the in-game help text: Permanent Stats from all seasons always count, and the
current season's Seasonal Stats count everywhere (other seasons count only inside their own Nightmare Temple, which
the calculator does not model). Each stat goes up to its cap. Two points are inferred: the current season is the
newest one in the data (season 5), and the cap does not scale with the season level the way the game does.

Buffs cover attribute buffs and scripted buffs decoded to fixed values. Stacks multiply the per-layer attributes;
that rule is inferred because the game handles stacking outside the client's script code.

#### Final stats

The derived sheet of the unit: PATK, MATK, DEF, MDEF, HIT, FLEE, CRIT, HP, SP, ASPD and the rest, from
`core/engine/attribute-calculator.ts`. Every source above feeds it, and each contribution keeps its label so the UI
can show where a number came from.

#### Saved builds

Save, load and delete named builds. They live in this browser's local storage only
(`core/services/build-storage.service.ts`). A saved build that refers to something no longer in the data (a removed
system, an old Face item, a level on a base card) still loads; those parts are ignored.

### Target

- Monster: 995 field and handbook monsters (`monsters.json`). Filters: name or id, rank (Normal, Elite, Mini-boss,
  MVP and others), race, element, size and level range (`core/engine/monster-filter.ts`). Rank names and which ranks
  count as boss are inferred from monster names. Buffs, debuffs and manual attributes can be set on the monster.
- Scaled monsters: dungeon and event monsters whose stats the game scales (`dynamic-monsters.json`, 525 dungeon
  entries). The game solves their HP and ATK from a target HP and DPS that only the server has, so the panel takes
  Expected HP, Expected DPS, content level, difficulty type and the HP and ATK factors as inputs
  (`core/engine/dynamic-monster.ts`). Without scaling, the table stats are used as they are.
- Player: a second build editor.

### Attack

- Attack or skill: the normal attack or a damaging skill of the attacker's job line. A Stalker's list also holds the
  skills it can copy. "Include skills of every job and monster" widens the list to every damaging skill.
- Skill level, and "Damage part" for skills with several parts: all parts added together (the default) or one part.
- Combat state: skills whose damage script reads a buff, a stack count, spirit spheres or current SP get inputs for
  exactly those values. Other skills show none.
- Units hitting the target (the FLEE penalty for crowding) and target HP (0 means full HP).
- Procs (optional, see below).

### Result

- Damage taken per cast, min to max, and the critical range when the skill can crit. Multi-hit skills also show the
  per-hit split.
- Perfect-hit roll, hit chance against FLEE and crit chance.
- "How this number was built": every factor of the formula with its value and its source, "Game code" or
  "Inferred". The formulas live in `core/engine/damage/`.

### Speed and time to kill

From `core/engine/combat-timing.ts`:

- Cast time: fixed and variable after gear, DEX and INT.
- Attacks per second, time per use, average damage per use and damage per second.
- Time until the target's HP reaches 0 (HP divided by DPS, never sooner than the first cast or swing), plus the range
  if every use lands.
- Cooldown reduction and the action time of ASPD-bound skills are inferred, because the game computes them outside
  the client's script code.

### Procs

With "Add card and gear procs" on, chance-based effects of your cards and gear (128 proc effects, `procs.json`)
count as expected values (`core/engine/procs.ts`):

- A proc buff adds to your stats by its uptime; a proc debuff adds to the target.
- An autocast skill adds its damage per second.
- Copies of the same card add their chances up to the cap; non-stacking effects count once.
- A table lists every proc with its trigger (hit, skill, being hit), chance, cooldown and uptime.

### Fight-temp values

Some gear, card and buff effects do not change attributes; they set combat values the damage formulas read, such as
element and race snapshots, extra damage rates, skill ratio adds and block rate. The calculator collects these from
180 sources (`fight-temp.json`, `core/engine/fight-temp.ts`) and passes them to the formula. An item-bound value
needs that item at the required refine.

## Monsters

- Filters: name or id, rank (Normal, Mini-boss, MVP, ...), race, element, size, level range, and "only monsters in
  the in-game handbook".
- Per monster: level, rank, race / element / size and HP. "Stats and skills" shows the final stats from the same
  code the calculator uses (`monsterCombatant`), computed only when opened, and the monster's skills with levels.
- "Use as target in Calculator" opens the calculator with that monster as the target.

## Player skills and Monster skills

- Search by skill name or id (`skills.json`). Player skills filter by job; monster skills filter by the monsters that
  use them (name or id, rank, race, element, size, level).
- Player skills has a "Skill type" filter:
  - Job skills (default): the 409 skills the 40 jobs learn, with the Job filter.
  - Card skills: the 11 skills a worn card lets you use, for example Hiding Lv.1 (Smokie), Teleport Lv.1 (Creamy),
    Heal Lv.1 (Vitata) or Lv.2 (Aether Card: Vitata), Magnum Break Lv.3 (Marine Sphere). The "Granted by card"
    column names every card version and the level it gives (`grantedBy` in `skills.json`: CardAttr entry type 4, or
    the `GetSkillBuff` script). They are not listed under any job.
  - Equipment skills: skills a piece of equipment grants. No equipment in the data grants one, so the list says so.
    Card or equipment is decided by where the granting item is (`cardById` or `equipById`).
- Element source per skill, also usable as a filter: follows the weapon, follows the arrow, own fixed element, forced
  neutral, or neutral spell (`core/engine/skill-element.ts`). Treating an element value of 0 as "follows the weapon"
  is inferred.
- Required weapon types, and arrows per cast for arrow skills.
- Damage script: the script name, whether it is ported or approximated with a generic formula, a plain description
  of what it computes and what it leaves out, and the line of the game's damage code it was ported from
  (`core/engine/damage/script-docs.ts`). 51 player scripts and 16 monster scripts are ported, plus pet attacks.
- Columns in player words (`core/engine/skill-summary.ts`), all at the skill's highest level and before stats, gear
  and buffs:
  - Damage at max level: for example "350% ATK + 200, 1 hit"; "Damage set by its script, 10 hits" when the script
    computes it; "No direct damage" for utility skills.
  - Type and element: Physical / Magic, and where the element comes from.
  - Cast, cooldown and SP: for example "Cast 1.25 s, cooldown 1 s, 172 SP" or "Instant cast".
  - In the calculator: "Exact: uses the game formula", "Estimate: generic formula", "No damage to calculate", or
    "Not calculated yet: damage comes from its area effect" for skills without a damage script whose description
    says they deal PDMG or MDMG (Storm Gust, Meteor Storm, Magnus Exorcismus, Fire Pillar, Land Mine and other
    traps; inferred). Table ratios are not used for this: buff and utility skills such as Blessing, Detoxify and
    Sight carry ratios and hit counts too, and show "No direct damage".
- Each skill opens its full description of every level first, then its effects, then how the calculator computes it.
- Effects at max level (`skill-effects.json`, made by `calculator/tools/x_skill_effects.js`, loaded when the panel
  opens): who the skill is cast on, cast range and area radius, every buff it creates with its chance, and each buff's
  duration, debuff flag and effect lines. Attribute lines show named stats (for example Loki's Lament: SP -2 every
  1 s, MSPD -60%); script lines show the Lua script name and its arguments. Buffs that add more buffs are listed
  under them.
  - Inferred: the cast-target labels (enemy, ally, yourself) come from known skills; the client has no names for
    those values. The effect-level target type is shown as a number because it is not decoded.
  - Not covered: effects the server applies without a client table entry, such as Loki's Lament silencing nearby
    enemies. The skill description is the only source for those.

## Stalker Copy

293 copy targets (`stalker-copy.json`): the monster, its rank and level, the skill a Stalker learns from it, and the
Copy level the monster needs (Lv.1 normal, Lv.2 Mini-boss, Lv.3 MVP; ranks outside Mini-boss and MVP count as
normal, which is inferred). Filters by skill name or id and by the monster.

## Cards

- Search by name, id or effect text. Filters: slot, quality, and version (base cards or awakened "+" cards).
- Per card: slot, quality, attributes and effect text.
- Deposit: the album bonus while the card is stored (`card-deposit.json`). A "+" card uses its base card's bonus.
- Versions: a base card links to its "+" card and back. A "+" card lists its star 1 to 3 bonuses.
- Script detail per effect: each effect line with its game effect type (such as `AddBuff`, `LuaScript` or
  `LuaScriptChangeAttr`), the script name and its parameters, and what the calculator does with it: attributes
  counted, proc expected value, fight-temp value, or description only. The effect type names are listed in
  `core/engine/item-effects.ts`; they follow the order of the game's enum, which has no explicit values, so the
  mapping is inferred.

## Equipment

- Every wearable item the calculator offers, in the same order as the editor. Face, Mouth, Back and Fashion are one
  combined row that lists the stats of each slot.
- Filters: name or id, slot, weapon type, "Divine Armament only", and "Wearable by job". The job filter applies the
  same job-line rule as the editor and also hides Trolley and Battle Bird for jobs that cannot use them.
- Per item: required jobs, slot and weapon type, gender lock, card slots, refine cap and refine table, enhance levels,
  enchant lines for the chosen job, Divine Armament season, tier and roll ranges, and whether it takes an
  Inscription.
- Effects use the same script detail as the cards page. Random entries (extra attributes and scripted entries an
  item can roll) are listed and marked as not counted by the calculator.

## Accuracy and limits

The game client ships its final damage and attribute code, and the engine ports it line by line: attribute
derivation, the damage formulas, the element table, weapon against size, and the PvP and PvE multiplier chain. About
25 inputs come from the game server, which the client does not contain. Those are rebuilt from final attributes and
marked "Inferred" in every result. The main ones:

- the hard DEF and MDEF reduction curve, element damage %, target-class damage %;
- the damage float (0.97 to 1.03, read from the remap constants in the client);
- Skill DMG % (attribute 283) on the skill ratio, cooldown reduction, the action time of ASPD-bound skills;
- monster size ids, rank names, the current Divine Armament season.

No result has been compared with real in-game damage yet. Pet damage in PvP and pet skill ratios are not available,
because the game keeps them on the server.
