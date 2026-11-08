# ROC Damage Calculator

A damage calculator for Ragnarok Origin Classic, built from the game client's own formulas and data tables. You set
up a build, pick a target (a monster or a second player build) and an attack or skill. The result is the damage the
target takes per cast, the critical range, the hit and crit chances, and the time it takes to bring the target to
0 HP.

Every feature, the rule behind it and the data it reads are described in [docs/FEATURES.md](docs/FEATURES.md).

## What is in it

- Calculator: a full build editor (job, stats, gear, cards, feathers, passives, pet, account systems), a monster
  or player target, the attack, and a result with a factor-by-factor breakdown.
- Monsters: browse every monster with its final stats and skills, and send one to the calculator as the target.
- Player skills and Monster skills: search and filter every skill, with its element source and damage script.
- Stalker Copy: which monster teaches which skill to a Stalker.
- Cards and Equipment: browse every card and wearable item, with their effects and the rules the editor applies.

Data version: game client 1.2.3.115.

## Run it

With Docker (no local Node needed):

```bash
docker compose up -d --build   # http://localhost:8080
docker compose down
```

For development:

```bash
npm install
npm start            # http://localhost:4200
npm test             # engine and rule tests (vitest)
npm run build        # static site in dist/roc-calculator/browser
```

The build uses hash URLs (`#/skills/player`), so `dist/roc-calculator/browser` works from any static host or
folder, including GitHub Pages.

## Release

The public page deploys only on a release. Create a branch named `rc-<major>.<minor>.<patch>`
([semver](https://semver.org), for example `rc-1.4.0`), open a pull request into `main` and merge it.
`.github/workflows/pages.yml` then runs the tests, builds with that version, publishes it to GitHub Pages, and
creates the tag and GitHub release `v1.4.0`. The version shows in the page footer. Last, it creates the next
release branch, `rc-1.4.1` (patch + 1), from that `main` commit, with a first commit that sets `package.json`
to `1.4.1`. Work goes into it through pull requests.

The version in `package.json` must match the branch: `.github/workflows/release-check.yml` fails a pull request
from `rc-1.4.1` into `main` otherwise. Because of that check, `main` always holds the version it last released.
For a minor or major release, create `rc-1.5.0` or `rc-2.0.0` yourself, run
`npm version 1.5.0 --no-git-tag-version` on it and commit the change.

Other merges and pushes to `main` deploy nothing. A merge from a branch like `rc-1.4` or `rc-1.4.0-beta`, or a
version that already has a tag, fails the workflow.

One-time setup on GitHub:

- **Settings > Pages > Source:** GitHub Actions.
- **Settings > Rules > Rulesets > New ruleset > Import a ruleset:** pick `.github/rulesets/rc-branches.json`.
  Every `rc-*` branch then accepts changes only through pull requests and cannot be deleted or force-pushed.
  GitHub Actions is on its bypass list, so the workflow can push the version commit that opens each branch.

## Project structure

```
src/app/
  app.ts, app.config.ts   shell, navigation and routes
  core/
    models/        attribute ids, master-data shapes, build and combat models
    engine/        pure TypeScript, no Angular, testable on its own
      attribute-calculator.ts   stats -> PATK, MATK, HIT, FLEE, CRIT, HP, SP, ASPD
      combat-tables.ts          element, weapon-vs-size and PvP tables
      combatant-factory.ts      build or monster -> Combatant (final attribute sheet)
      damage/                   modifiers, one class per damage script, the calculator
      sources/kinds/            one StatSourceKind per account system
      item-options.ts           enchant lines per item and job
      item-upgrades.ts          card level and star, Inscription, fixed Face/Mouth/Back/Fashion items
    services/      data loading (MasterDataService), indexing (CatalogService), saved builds
  shared/components/  number field, searchable picker, attribute list, collapsible panel, effect detail
  features/
    calculator/    page, build editor, equipment editor, source list editor, target, attack, result
    skills/        player and monster skill lists, Stalker Copy
    items/         card and equipment lists
public/data/       master data (JSON) from the game client
scripts/sync-data.mjs   copies a new set of master data into public/data
docs/FEATURES.md   feature reference
Dockerfile, docker-compose.yml, nginx.conf   static build served by nginx on port 8080
.gitlab-ci.yml                               GitLab Pages: test, build, publish the static site
.github/workflows/pages.yml                  GitHub Pages: release rc-x.y.z merges as version x.y.z
```

## SOLID in practice

- **Single responsibility:** loading (`MasterDataService`), indexing (`CatalogService`), stat derivation
  (`attribute-calculator`), damage (`damage-calculator`) and each UI piece are separate units.
- **Open/closed:** a new game system is one new `StatSourceKind` class added to `STAT_SOURCE_KINDS`
  (`core/engine/sources/kinds/index.ts`). A new damage script is one new `DamageFormula` class added to
  `SPECIAL_FORMULAS` (`core/engine/damage/special/index.ts`), or to `GENERIC_FORMULAS`
  (`core/engine/damage/generic-formulas.ts`) for a generic one; `core/engine/damage/damage-formulas.ts` merges both.
  Nothing else changes: the build editor renders every registered kind with the same `SourceListEditor`, and
  aggregation goes through the same `resolve()`.
- **Liskov:** every kind returns `StatOption`s with the same contract (`resolve(amount) -> StatBonus[]`),
  whether the data is flat, per level, or a rolled value range.
- **Interface segregation:** components take only what they render (`AttrNames`, an option list, a pick list).
- **Dependency inversion:** engine functions take a plain `Catalog` object; they never fetch or touch Angular.

Per-item rules live in `core/engine/item-options.ts` (enchant lines) and `core/engine/item-upgrades.ts` (card level,
Inscription, the fixed Face/Mouth/Back/Fashion items). The equipment editor and the stat aggregation call the same
functions, so a pick that no longer fits the item or the job stops counting. An account system can do the same
with `availableFor`.

### Add an account system

```ts
// core/engine/sources/kinds/costume.kind.ts
export class CostumeKind implements StatSourceKind {
  readonly key = 'costume';
  readonly label = 'Costume';
  readonly hint = 'Costume set bonuses.';
  async options(data: MasterDataService) {
    const rows = await data.load<MasterEntry[]>('costumes.json');
    return rows.map((e) => fixedOption(e));
  }
}
// then add `new CostumeKind()` to STAT_SOURCE_KINDS and put costumes.json in public/data
```

`fixedOption`, `leveledOption` and `rangedOption` in `core/engine/sources/stat-source.ts` cover flat bonuses,
per-level bonuses and rolled values.

### Add a damage script

Implement `DamageFormula` (`core/engine/damage/formula.ts`) with the script name the skill data uses, then add the
class to the matching group in `core/engine/damage/special/` (physical, physical-crit, magic, normal, pet,
monster). A skill whose script has no class falls back to a generic formula, and the skill pages say so.

## Data

`public/data` holds the master data the app loads: 42 JSON files, about 11 MB before compression. It contains
names, numbers and ids taken from the game client's tables, nothing else.

To replace it with a newer set, put the new JSON files in one folder and run:

```bash
npm run data:sync -- <folder with the JSON files>
```

The script copies every file the app already uses and stops if one is missing from the folder.

## Scope

The ROC client shares code and tables with Ragnarok Origin, so its data also holds systems ROC does not run. The
calculator keeps what ROC uses:

- Jobs: official jobs up to 2nd trans. Novice and Doram Novice, the six classic lines (Swordsman, Acolyte, Mage,
  Thief, Merchant, Archer) up to their trans class, the Doram line up to Summoner and the Gunslinger line up to
  Rebellion. No 3rd jobs, no Super Novice line, no NPC professions.
- Pets: the 9 ROC pets.
- Card levels up to 15.

Not included: honorary title level, Divine Armament legendary effects and dream affixes, Sacred Quenching, Feather
Recycle, Faith, Runes, Halo, Antique, Soul Force and Favorability.

## Assets and copyright

The site ships no artwork from the game: no skill icons, monster images, models or UI textures. Skills, monsters
and items are shown by name only. The favicon (`public/favicon.svg`) is the rune Raidho (R) drawn for this project,
not a game asset.

## Accuracy

The game client ships its final damage and attribute code, and the engine ports it line by line. About 25 inputs
come from the game server, which the client does not contain. Those are rebuilt from final attributes, and every
result row says which kind it is ("Game code" or "Inferred").

| Part | Status |
|---|---|
| Attribute derivation (PATK, MATK, DEF, HIT, FLEE, CRIT, HP, SP, ASPD) | Ported from the client |
| Normal attack, physical, physical can-crit, true-damage and magic formulas | Ported from the client |
| Element table, weapon vs size, PvP weapon compression, PvP/PvE multiplier chain | Copied from the client |
| Cast time with gear, DEX and INT | Ported from the client |
| Hard DEF/MDEF reduction curve, element damage %, target-class damage % | Inferred (server side) |
| Damage float 0.97 to 1.03 | Inferred from the remap constants in the client |
| Skill DMG % (attribute 283) on the skill ratio | Inferred |
| Cooldown reduction, action time of ASPD-bound skills | Inferred |
| Divine Armament season of each item | Inferred from the item id, matches the item level band for all 480 items |
| Current Divine Armament season | Inferred: the newest season in the data |
| Monster size ids (0 Medium, 1 Large, 2 Small) | Inferred from known monsters, matches the weapon-size table |
| Monster rank names and which ranks count as boss | Inferred from monster names |

No result has been compared with real in-game damage yet.
