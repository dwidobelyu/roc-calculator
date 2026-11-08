import { Component, computed, input, model } from '@angular/core';
import { equipmentContributions } from '../../core/engine/combatant-factory';
import { canEquip, equipmentLabel, jobLineIds, slotAvailable } from '../../core/engine/equipment-rules';
import { EnchantOption, MAX_ENCHANT_LINES, enchantOptionsFor, enchantSlotOptions } from '../../core/engine/item-options';
import { SHARED_LOOK_SLOTS, cardMaxLevel, slotItemId, starForLevel } from '../../core/engine/item-upgrades';
import { MAX_BASE_LEVEL } from '../../core/engine/stat-points';
import { EQUIP_SLOTS, EquipSlotState, emptyBuild } from '../../core/models/build.models';
import { StatBonus } from '../../core/models/master-data.models';
import { Catalog } from '../../core/services/catalog.service';
import { AttrList } from '../../shared/components/attr-list';
import { EntityPicker, PickerItem } from '../../shared/components/entity-picker';
import { NumberField } from '../../shared/components/number-field';
import { SectionPanel } from '../../shared/components/section-panel';
import { plainText } from '../../shared/components/skill-description';

/**
 * Gear per slot: item, rolled base values (Divine Armament), refine, enhance, enchant lines, as many cards as the
 * item has slots (with star and level) and the Inscription of a Legendary Ornament accessory. Only items the job can
 * wear are offered; seasonal Divine Armament first. Trolley and Battle Bird slots appear only for jobs that have them.
 */
@Component({
  selector: 'app-equipment-editor',
  imports: [AttrList, EntityPicker, NumberField, SectionPanel],
  template: `
    <app-section-panel title="Equipment, cards, enchant, refine and enhance" [badge]="equippedCount() || ''"
      hint="Lists only gear your job can wear. Divine Armament is listed first, newest season on top.">
      @for (row of rows(); track row.index) {
        @if (row.available) {
        <fieldset class="slot">
          <legend>{{ row.label }}</legend>
          @if (row.fixed) {
            <p><strong>{{ row.equip?.name }}</strong></p>
            <p class="small muted">Every item of this slot has the same stats in ROC, so this slot always counts them.</p>
          } @else {
            <app-entity-picker
              label="Item"
              [items]="row.items"
              [value]="row.state.equipId"
              (valueChange)="pickItem(row.index, $event)"
            />
          }
          @if (row.equip; as eq) {
            @if (!row.usable) {
              <p class="note" role="alert">{{ eq.name }} cannot be worn by this job, so it adds nothing. Pick another item.</p>
            }
            @if (eq.rolls?.length) {
              <div class="grid-2">
                @for (r of eq.rolls; track $index) {
                  <app-number-field
                    [label]="names().of(r.attr) + ' roll (' + r.min + ' to ' + r.max + ')'"
                    [min]="r.min" [max]="r.max"
                    [value]="row.state.rolls?.[$index] ?? r.max"
                    (valueChange)="setRoll(row.index, $index, $event)"
                  />
                }
              </div>
            }
            <div class="grid-2">
              @if (eq.refineGroup != null && (eq.refineMax ?? 0) > 0) {
                <app-number-field label="Refine" [min]="0" [max]="eq.refineMax ?? 0" [value]="row.state.refine"
                  (valueChange)="patch(row.index, { refine: $event })" />
              }
              @if (row.enhanceMax > 0) {
                <app-number-field label="Enhance" [min]="0" [max]="row.enhanceMax" [value]="row.state.enhance"
                  (valueChange)="patch(row.index, { enhance: $event })" />
              }
            </div>
            @if (!row.holes.length) {
              <p class="small muted">This item has no card slot.</p>
            }
            @for (hole of row.holes; track hole) {
              <div class="card-row">
                <app-entity-picker
                  [label]="'Card slot ' + (hole + 1) + ' of ' + row.holes.length"
                  [items]="row.cards"
                  [value]="row.state.cardIds[hole] || null"
                  (valueChange)="setCard(row.index, hole, $event)"
                />
                @if (awakenPair(row.state.cardIds[hole]); as other) {
                  <label class="check">
                    <input type="checkbox" [checked]="!!cardStars(row.state.cardIds[hole])" (change)="setCard(row.index, hole, other)" />
                    Awakened (+): unlocks card star and card level
                  </label>
                } @else if (row.state.cardIds[hole] && !cardStars(row.state.cardIds[hole])) {
                  <p class="muted small">This card has no awakened version in the game, so it has no star or level.</p>
                }
                @if (cardStars(row.state.cardIds[hole]); as stars) {
                  <label class="field">
                    <span class="field-label">Card star</span>
                    <select [value]="row.state.cardLevels?.[hole] ?? 0" (change)="setCardLevel(row.index, hole, +$any($event.target).value)">
                      @for (s of stars; track s) {
                        <option [value]="s" [selected]="s === (row.state.cardLevels?.[hole] ?? 0)">{{ s ? 'Star ' + s : 'Base' }}</option>
                      }
                    </select>
                  </label>
                }
                @if (cardStars(row.state.cardIds[hole])) {
                  <app-number-field [label]="'Card level (max ' + cardMaxLv() + ')'" [min]="0" [max]="cardMaxLv()"
                    [value]="row.state.cardLv?.[hole] ?? 0" (valueChange)="setCardLv(row.index, hole, $event)" />
                }
              </div>
            }
            @if (row.enchantOptions.length) {
              <h3 class="sub-head">Enchant</h3>
              <p class="small muted">Enchant 1 takes an Effect enchant or an Enchant; Enchant 2 and 3 take Enchants only.</p>
              @for (slot of enchantSlots; track slot) {
                @let pick = row.state.enchants?.[slot] ?? null;
                @let opt = pick ? optionById(row.enchantOptions, pick.optionId) : undefined;
                <app-entity-picker [label]="'Enchant ' + (slot + 1) + (slot === 0 ? ' (Effect enchant or Enchant)' : ' (Enchant)')"
                  [items]="enchantItems(row.enchantOptions, slot)" [value]="pick?.optionId ?? null"
                  (valueChange)="setEnchant(row.index, slot, $event)" />
                @if (opt && pick) {
                  @if (opt.max > opt.min) {
                    <app-number-field [label]="opt.amountLabel + ' (' + opt.min + ' to ' + opt.max + ')'" [min]="opt.min" [max]="opt.max"
                      [value]="pick.amount" (valueChange)="setEnchantAmount(row.index, slot, $event)" />
                  }
                  <app-attr-list [attrs]="opt.resolve(pick.amount)" [names]="names()" />
                }
              }
            } @else {
              <p class="small muted">No enchant can roll on this item.</p>
            }
            @if (row.inscribable) {
              <label class="field">
                <span class="field-label">Inscription (one gem per Legendary Ornament)</span>
                <select (change)="patch(row.index, { inscription: +$any($event.target).value || null })">
                  <option value="0" [selected]="row.state.inscription == null">No inscription</option>
                  @for (g of catalog().inscriptionGems; track g.id) {
                    <option [value]="g.id" [selected]="g.id === row.state.inscription">{{ g.name }} (quality {{ g.quality }}{{ g.season ? ', season ' + g.season : '' }})</option>
                  }
                </select>
              </label>
              @if (row.gem; as gem) {
                @for (e of gem.effects; track e.effectId) {
                  <p class="small">{{ plain(e.desc) }}</p>
                }
                @if (!gem.attrs.length) {
                  <p class="small muted">This gem's effect is conditional (a proc or script), so it adds no fixed attribute.</p>
                }
              }
            }
            <app-attr-list [attrs]="row.attrs" [names]="names()" />
          }
        </fieldset>
        }
      }
    </app-section-panel>
  `,
})
export class EquipmentEditor {
  readonly catalog = input.required<Catalog>();
  readonly jobId = input.required<number>();
  readonly equipment = model.required<EquipSlotState[]>();

  protected readonly names = computed(() => this.catalog().attrNames);
  private readonly line = computed(() => jobLineIds(this.catalog().jobs, this.jobId()));

  /** Wearable items per slot, already in catalog order (seasonal first). */
  private readonly itemsBySlot = computed(() => {
    const map = new Map<number, PickerItem[]>();
    for (const e of this.catalog().equipment) {
      if (!canEquip(e, this.line())) continue;
      (map.get(e.slot) ?? map.set(e.slot, []).get(e.slot)!).push({ id: e.id, label: equipmentLabel(e) + this.statHint(e.attrs) });
    }
    return map;
  });

  private readonly cardsBySlot = computed(() => {
    const map = new Map<number, PickerItem[]>();
    for (const c of this.catalog().cards) {
      for (const s of c.slots) (map.get(s) ?? map.set(s, []).get(s)!).push({ id: c.id, label: c.name + this.statHint(c.attrs) });
    }
    return map;
  });

  /** " (INT +82, Max HP +3%)": up to 3 stats, so the search box also matches stat names. */
  private statHint(attrs: readonly StatBonus[] | undefined): string {
    const n = this.names();
    const shown = (attrs ?? []).filter((a) => a.value).slice(0, 3);
    return shown.length ? ` (${shown.map((a) => `${n.of(a.attr)} ${n.format(a.attr, a.value)}`).join(', ')})` : '';
  }

  protected readonly equippedCount = computed(() => this.equipment().filter((e) => slotItemId(e.slot, e.equipId) != null).length);

  protected readonly rows = computed(() => {
    const cat = this.catalog();
    return this.equipment().map((state, index) => {
      const itemId = slotItemId(state.slot, state.equipId);
      const equip = itemId != null ? cat.equipById.get(itemId) : undefined;
      const one = { ...emptyBuild(), jobId: this.jobId(), equipment: [state] };
      return {
        index,
        state,
        label: EQUIP_SLOTS[index]?.label ?? `Slot ${state.slot}`,
        available: slotAvailable(state.slot, cat.jobs, this.jobId()),
        fixed: SHARED_LOOK_SLOTS.includes(state.slot),
        inscribable: !!equip && cat.inscriptionOrnaments.has(equip.id),
        gem: state.inscription != null ? cat.inscriptionById.get(state.inscription) : undefined,
        items: this.itemsBySlot().get(state.slot) ?? [],
        cards: this.cardsBySlot().get(state.slot) ?? [],
        equip,
        usable: !equip || canEquip(equip, this.line()),
        enhanceMax: Math.min(cat.enhanceBySlot.get(state.slot)?.at(-1)?.level ?? 0, MAX_BASE_LEVEL),
        holes: Array.from({ length: equip?.holeNum ?? 0 }, (_, h) => h),
        enchantOptions: equip ? enchantOptionsFor(cat.enchantOptions, equip, this.line()) : [],
        attrs: equipmentContributions(one, cat).flatMap((c) => c.attrs),
      };
    });
  });

  protected readonly enchantSlots = Array.from({ length: MAX_ENCHANT_LINES }, (_, i) => i);

  protected enchantItems(options: readonly EnchantOption[], slot: number): PickerItem[] {
    return enchantSlotOptions(options, slot).map((o) => ({ id: o.id, label: `${o.name} (${o.group})` }));
  }

  protected optionById(options: readonly EnchantOption[], id: string): EnchantOption | undefined {
    return options.find((o) => o.id === id);
  }

  protected setEnchant(i: number, slot: number, id: string | number | null): void {
    const opt = id == null ? undefined : this.optionById(this.rows()[i].enchantOptions, String(id));
    const list = Array.from({ length: MAX_ENCHANT_LINES }, (_, k) => this.equipment()[i].enchants?.[k] ?? null);
    list[slot] = opt ? { optionId: opt.id, amount: opt.max > opt.min ? opt.max : opt.min } : null;
    this.patch(i, { enchants: list });
  }

  protected setEnchantAmount(i: number, slot: number, amount: number): void {
    const list = [...(this.equipment()[i].enchants ?? [])];
    const p = list[slot];
    if (p) list[slot] = { ...p, amount };
    this.patch(i, { enchants: list });
  }

  /** Star choices for an awakened card ([0, 1, 2, 3]); null for cards without stars. */
  protected cardStars(id: number | undefined): number[] | null {
    const levels = id ? this.catalog().cardById.get(id)?.levels : undefined;
    return levels?.length ? [0, ...levels.map((l) => l.level)] : null;
  }

  /** The other version of a card (base <-> awakened "+"), or null when the game has none. */
  protected awakenPair(id: number | undefined): number | null {
    const card = id ? this.catalog().cardById.get(id) : undefined;
    return card?.awakenedCardId ?? card?.baseCardId ?? null;
  }

  protected pickItem(i: number, id: string | number | null): void {
    // a new item starts clean: its cards, rolls, enchants and inscription belong to the old one
    this.patch(i, {
      equipId: id == null ? null : +id, cardIds: [], cardLevels: [], cardLv: [], rolls: undefined, refine: 0, enchants: [],
      inscription: null,
    });
  }

  protected setCardLevel(i: number, hole: number, star: number): void {
    const levels = [...(this.equipment()[i].cardLevels ?? [])];
    levels[hole] = star;
    // a lower star lowers the level cap
    const lv = [...(this.equipment()[i].cardLv ?? [])];
    lv[hole] = Math.min(lv[hole] ?? 0, this.cardLvMax(star));
    this.patch(i, { cardLevels: levels, cardLv: lv });
  }

  /** Highest card level at a star (CardEvolutionLevel: star 0 -> 5, 1 -> 10, 2 and up -> 15). */
  protected cardLvMax(star: number): number {
    return cardMaxLevel(this.catalog().cardLevels, star);
  }

  /** Highest card level of all (GlobalTable CardMaxLevel, 15). */
  protected readonly cardMaxLv = computed(() => this.catalog().cardLevels.maxLevel);

  /** A level above the current star's cap raises the star to the lowest one that allows it (Lv.11 -> star 2). */
  protected setCardLv(i: number, hole: number, lv: number): void {
    const list = [...(this.equipment()[i].cardLv ?? [])];
    const stars = [...(this.equipment()[i].cardLevels ?? [])];
    list[hole] = lv;
    stars[hole] = Math.max(stars[hole] ?? 0, starForLevel(this.catalog().cardLevels, lv));
    this.patch(i, { cardLv: list, cardLevels: stars });
  }

  protected plain(s: string): string {
    return plainText(s);
  }

  protected patch(i: number, p: Partial<EquipSlotState>): void {
    this.equipment.update((list) => list.map((s, j) => (j === i ? { ...s, ...p } : s)));
  }

  protected setRoll(i: number, k: number, v: number): void {
    const eq = this.catalog().equipById.get(this.equipment()[i].equipId!);
    const rolls = (eq?.rolls ?? []).map((r, j) => this.equipment()[i].rolls?.[j] ?? r.max);
    rolls[k] = v;
    this.patch(i, { rolls });
  }

  protected setCard(i: number, hole: number, id: string | number | null): void {
    const cards = [...this.equipment()[i].cardIds];
    cards[hole] = id == null ? 0 : Number(id);
    const levels = [...(this.equipment()[i].cardLevels ?? [])];
    levels[hole] = 0; // star and level belong to the previous card
    const lv = [...(this.equipment()[i].cardLv ?? [])];
    lv[hole] = 0;
    this.patch(i, { cardIds: cards, cardLevels: levels, cardLv: lv });
  }
}
