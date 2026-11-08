import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { monsterCombatant, petCombatant, playerCombatant, wornEffects } from '../../core/engine/combatant-factory';
import { resolveFormula } from '../../core/engine/damage/damage-formulas';
import { expectedProcAttrs, expectedProcSkills, procRatesFor, procViews, procsFor } from '../../core/engine/procs';
import { calculateTiming } from '../../core/engine/combat-timing';
import { calculateDamage } from '../../core/engine/damage/damage-calculator';
import { PlayerBuild, emptyBuild } from '../../core/models/build.models';
import { Combatant } from '../../core/models/combat.models';
import { CatalogService } from '../../core/services/catalog.service';
import { LoadState } from '../../shared/components/load-state';
import { ActionPicker, ActionState } from './action-picker';
import { BuildEditor } from './build-editor';
import { MonsterTarget, MonsterTargetState } from './monster-target';
import { ProcCastView, ProcPanel } from './proc-panel';
import { ResultPanel } from './result-panel';
import { TimingPanel } from './timing-panel';

type TargetMode = 'monster' | 'player';
/** 'player' = the Target column's player build attacks Your build (PvP damage taken). */
type AttackerMode = 'build' | 'pet' | 'monster' | 'player';

@Component({
  selector: 'app-calculator-page',
  imports: [ActionPicker, BuildEditor, DecimalPipe, LoadState, MonsterTarget, ProcPanel, ResultPanel, TimingPanel],
  template: `
    @if (catalogService.current(); as cat) {
      <!-- "paired": two player builds share grid rows, so each section sits level with its counterpart -->
      <div class="columns" [class.paired]="targetPlayerShown()">
        <section class="column build-column" aria-labelledby="attacker-h">
          <div class="column-head"><h2 id="attacker-h">Your build</h2></div>
          <app-build-editor [catalog]="cat" [combatant]="ownBuild()!" [(build)]="attackerBuild" />
        </section>

        <section class="column build-column" aria-labelledby="target-h">
          <div class="column-head">
            <h2 id="target-h">Target</h2>
            <div class="segmented" role="radiogroup" aria-label="Target type">
              @for (m of modes; track m.value) {
                <label class="segment">
                  <input type="radio" name="target-mode" [value]="m.value" [checked]="targetMode() === m.value"
                    (change)="targetMode.set(m.value)" />
                  <span>{{ m.label }}</span>
                </label>
              }
            </div>
          </div>
          @if (attackerMode() === 'monster') {
            <p class="note">A monster is attacking, so the target is <strong>Your build</strong>. Switch the attacker back to
              "Your build" in Attack to pick a target here.</p>
          } @else if (attackerMode() === 'player') {
            <p class="note">This player attacks <strong>Your build</strong>: the result shows the damage you take from them.</p>
            <app-build-editor [catalog]="cat" [combatant]="attackerBase()!" [(build)]="targetBuild" />
          } @else if (targetMode() === 'monster') {
            <app-monster-target [catalog]="cat" [combatant]="targetBase()" [(state)]="monsterState" />
          } @else {
            <app-build-editor [catalog]="cat" [combatant]="targetBase()!" [(build)]="targetBuild" />
          }
        </section>

        <section class="column result-column" aria-labelledby="action-h">
          <div class="sticky">
            <div class="column-head">
              <h2 id="action-h">Attack</h2>
              <div class="segmented" role="radiogroup" aria-label="Attacker">
                @for (m of attackerModes; track m.value) {
                  <label class="segment">
                    <input type="radio" name="attacker-mode" [value]="m.value" [checked]="attackerMode() === m.value"
                      (change)="setAttackerMode(m.value)" />
                    <span>{{ m.label }}</span>
                  </label>
                }
              </div>
            </div>
            @if (attackerMode() === 'monster') {
              <app-monster-target [catalog]="cat" [combatant]="attackerBase()" [(state)]="attackerMonster" />
            }
            <app-action-picker [catalog]="cat" [jobId]="attackerMode() === 'player' ? targetBuild().jobId : attackerBuild().jobId" [skillIds]="attackerSkillIds()"
              [(state)]="action" />
            @if (result(); as r) {
              <app-result-panel [result]="r" />
              @if (timing(); as t) {
                <app-timing-panel [timing]="t" />
              }
              @if (procs(); as pr) {
                <app-proc-panel [procs]="pr.views" [casts]="procCasts().casts" [extraDps]="procCasts().extraDps"
                  [baseDps]="timing()?.dps ?? 0" [targetHp]="timing()?.targetHp ?? 0" />
              }
            } @else {
              <p class="empty">{{ emptyReason() }}</p>
            }
          </div>
        </section>
      </div>
      <!-- on one or two columns the result column scrolls away while editing; this bar keeps the number in view -->
      @if (result(); as r) {
        <div class="result-bar">
          <p class="result-bar-text">
            <span class="small muted">{{ pickedName() }}</span>
            <strong class="num">{{ r.normal.min | number }} to {{ r.normal.max | number }}</strong>
            @if (timing(); as t) { <span class="small">{{ t.dps | number: '1.0-0' }} DPS</span> }
          </p>
          <button type="button" class="button ghost" (click)="showResult()">View result</button>
        </div>
      }
    } @else {
      <app-load-state />
    }
  `,
})
export class CalculatorPage {
  protected readonly catalogService = inject(CatalogService);
  private readonly catalog = this.catalogService.current;
  /** Query parameter "monster" (bound by the router): a monster id to use as the target. */
  readonly monster = input<string | undefined>();

  constructor() {
    effect(() => {
      const id = Number(this.monster());
      if (!id) return;
      this.monsterState.update((s) => ({ ...s, monsterId: id }));
      this.targetMode.set('monster');
      this.setAttackerMode('build');
    });
  }

  protected readonly modes: { value: TargetMode; label: string }[] = [
    { value: 'monster', label: 'Monster' },
    { value: 'player', label: 'Player' },
  ];
  protected readonly attackerBuild = signal<PlayerBuild>(emptyBuild('My build'));
  protected readonly targetBuild = signal<PlayerBuild>(emptyBuild('Target player'));
  protected readonly targetMode = signal<TargetMode>('monster');
  protected readonly monsterState = signal<MonsterTargetState>({ monsterId: null, sources: {}, extraAttrs: [] });
  protected readonly action = signal<ActionState>({
    skillId: null, level: 1, segment: 'all', attackerCount: 1, allSkills: false, targetHp: null, state: {}, procs: false,
  });
  protected readonly attackerModes: { value: AttackerMode; label: string }[] = [
    { value: 'build', label: 'Your build' },
    { value: 'pet', label: 'Your pet' },
    { value: 'monster', label: 'A monster' },
    { value: 'player', label: 'Target player' },
  ];
  protected readonly attackerMode = signal<AttackerMode>('build');
  protected readonly attackerMonster = signal<MonsterTargetState>({ monsterId: null, sources: {}, extraAttrs: [] });

  /** Your build as a unit; it attacks, or it is the target when a monster attacks. */
  protected readonly ownBuild = computed(() => {
    const cat = this.catalog();
    return cat ? playerCombatant(this.attackerBuild(), cat).combatant : null;
  });

  protected readonly attackerBase = computed((): Combatant | null => {
    const cat = this.catalog();
    if (this.attackerMode() === 'monster') return this.monsterUnit(this.attackerMonster());
    if (this.attackerMode() === 'pet') return cat ? petCombatant(this.attackerBuild(), cat) : null;
    if (this.attackerMode() === 'player') return cat ? playerCombatant(this.targetBuild(), cat).combatant : null;
    return this.ownBuild();
  });

  protected readonly targetBase = computed((): Combatant | null => {
    const cat = this.catalog();
    if (!cat) return null;
    if (this.attackerMode() === 'monster' || this.attackerMode() === 'player') return this.ownBuild();
    if (this.targetMode() === 'player') return playerCombatant(this.targetBuild(), cat).combatant;
    return this.monsterUnit(this.monsterState());
  });

  /** A monster attacker can only use its own skills. */
  protected readonly attackerSkillIds = computed(() => {
    if (this.attackerMode() === 'pet') {
      const petId = this.attackerBuild().pets?.deployed[0]?.petId;
      return petId == null ? [] : (this.catalog()?.skills ?? []).filter((s) => s.petIds?.includes(petId)).map((s) => s.id);
    }
    if (this.attackerMode() !== 'monster') return null;
    const m = this.catalog()?.monsterById.get(this.attackerMonster().monsterId ?? -1);
    return m ? m.skills.map((s) => s.id) : [];
  });

  /** Both columns hold a player build, so their sections line up. */
  protected readonly targetPlayerShown = computed(() =>
    this.attackerMode() === 'player' || (this.targetMode() === 'player' && this.attackerMode() !== 'monster'));

  protected setAttackerMode(mode: AttackerMode): void {
    this.attackerMode.set(mode);
    // the attacking player is the Target column's player build
    if (mode === 'player') this.targetMode.set('player');
    this.action.update((a) => ({ ...a, skillId: null }));
  }

  private monsterUnit(st: MonsterTargetState): Combatant | null {
    const cat = this.catalog();
    const m = cat?.monsterById.get(st.monsterId ?? -1);
    if (!cat || !m) return null;
    const picked = Object.entries(st.sources).flatMap(([kind, picks]) =>
      picks.flatMap((p) => cat.sourceOptionById.get(kind)?.get(p.optionId)?.resolve(p.amount) ?? []));
    return monsterCombatant(m, cat, [...picked, ...st.extraAttrs], st.scaling ?? undefined);
  }

  protected readonly pickedName = computed(() => {
    const p = this.picked();
    return p ? `${p.skill.name} Lv.${p.level.level}` : '';
  });

  protected showResult(): void {
    document.getElementById('action-h')?.scrollIntoView({ block: 'start' });
  }

  private readonly picked = computed(() => {
    const cat = this.catalog(), a = this.action();
    const skill = a.skillId == null ? undefined : cat?.skillById.get(a.skillId);
    const level = skill?.levels.find((l) => l.level === a.level) ?? skill?.levels[0];
    return skill && level ? { skill, level } : null;
  });

  private run(c: Combatant | null, t: Combatant | null) {
    const p = this.picked(), a = this.action();
    if (!c || !t || !p) return null;
    const result = calculateDamage({ attacker: c, target: t, ...p, segment: a.segment, attackerCount: a.attackerCount, state: a.state });
    return result ? { result, timing: calculateTiming(c, t, p.skill, p.level, result, a.targetHp) } : null;
  }

  /** Without procs: gives the action rate the procs are scaled by. */
  private readonly base = computed(() => this.run(this.attackerBase(), this.targetBase()));

  /** Expected proc effects of your build's cards and gear under the current action. */
  protected readonly procs = computed(() => {
    const cat = this.catalog(), base = this.base(), p = this.picked();
    if (!cat || !base || !p || !this.action().procs || this.attackerMode() !== 'build') return null;
    const worn = wornEffects(this.attackerBuild(), cat);
    const list = procsFor(worn.map((w) => w.effectId), cat.procById);
    if (!list.length) return { views: [], self: [], enemy: [], skills: [] };
    const kind = resolveFormula(p.level.script, p.skill.damageType).formula?.damageKind ?? 'physical';
    const rates = procRatesFor(kind, 1 / Math.max(base.timing.cycleTime, 0.01));
    return {
      views: procViews(list, rates, cat.procById, new Map(worn.map((w) => [w.effectId, w.name]))),
      self: expectedProcAttrs(list, rates, 'self'),
      enemy: expectedProcAttrs(list, rates, 'enemy'),
      skills: expectedProcSkills(list, rates),
    };
  });

  protected readonly attacker = computed((): Combatant | null => {
    const cat = this.catalog(), pr = this.procs();
    if (!cat || !pr?.self.length) return this.attackerBase();
    return playerCombatant(this.attackerBuild(), cat, [{ label: 'Procs (expected value)', attrs: pr.self }]).combatant;
  });

  protected readonly target = computed((): Combatant | null => {
    const cat = this.catalog(), pr = this.procs();
    if (!cat || !pr?.enemy.length) return this.targetBase();
    if (this.targetMode() === 'player') {
      return playerCombatant(this.targetBuild(), cat, [{ label: 'Proc debuffs (expected value)', attrs: pr.enemy }]).combatant;
    }
    const st = this.monsterState();
    return this.monsterUnit({ ...st, extraAttrs: [...st.extraAttrs, ...pr.enemy] });
  });

  private readonly withProcs = computed(() => (this.procs() ? this.run(this.attacker(), this.target()) : this.base()));
  protected readonly result = computed(() => this.withProcs()?.result ?? null);
  protected readonly timing = computed(() => this.withProcs()?.timing ?? null);

  /** Autocast skills from procs: expected casts per second x average damage of one cast on the target. */
  protected readonly procCasts = computed((): { casts: ProcCastView[]; extraDps: number } => {
    const cat = this.catalog(), pr = this.procs(), c = this.attacker(), t = this.target();
    if (!cat || !pr || !c || !t) return { casts: [], extraDps: 0 };
    const casts = pr.skills.map((s): ProcCastView => {
      const skill = cat.skillById.get(s.skillId);
      const level = skill?.levels.find((l) => l.level === s.level) ?? skill?.levels.at(-1);
      const r = skill && level
        ? calculateDamage({ attacker: c, target: t, skill, level, segment: 'all', attackerCount: this.action().attackerCount })
        : null;
      const avg = r ? (r.normal.min + r.normal.max) / 2 : 0;
      return { name: skill ? `${skill.name} Lv.${level?.level}` : `Skill #${s.skillId}`, perSec: s.perSec, avgDamage: avg, dps: avg * s.perSec };
    });
    return { casts, extraDps: casts.reduce((a, x) => a + x.dps, 0) };
  });

  protected readonly emptyReason = computed(() => {
    if (!this.attacker()) {
      return this.attackerMode() === 'pet' ? 'Pick a pet in Your build > Pets, deployed slot 1.' : 'Pick the attacking monster.';
    }
    if (!this.target()) return 'Pick a target to see the damage it takes.';
    if (this.action().skillId == null) return 'Pick an attack or skill.';
    return 'This skill level deals no direct damage (healing or utility script).';
  });
}
