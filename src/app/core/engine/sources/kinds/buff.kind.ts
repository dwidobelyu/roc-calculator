import { StatBonus } from '../../../models/master-data.models';
import { MasterDataService } from '../../../services/master-data.service';
import { StatOption, StatSourceKind } from '../stat-source';

interface BuffEntry {
  id: number;
  name: string;
  isDebuff: boolean;
  maxLayer?: number;
  duration?: number;
  attrs: StatBonus[];
}

/** script-buffs.json: buffs whose attr change runs through a Lua script (effect types 20/77), decoded to fixed attrs. */
interface ScriptBuff {
  buffId: number;
  name: string;
  attrs: StatBonus[];
}

/**
 * Buffs or debuffs that change attributes (BuffEffectTable effect types 2 and 21, plus scripted types 20/77).
 * Stacks multiply the attrs per layer; that rule is inferred because stacking is native code.
 */
export class BuffKind implements StatSourceKind {
  constructor(
    readonly key: string,
    readonly label: string,
    readonly hint: string,
    private readonly debuff: boolean,
  ) {}

  async options(data: MasterDataService): Promise<StatOption[]> {
    const [rows, scripted, fightTemp] = await Promise.all([
      data.load<BuffEntry[]>('buffs-all.json'),
      data.load<ScriptBuff[]>('script-buffs.json'),
      data.load<{ sources: { effectId: number; kind: string; name: string }[] }>('fight-temp.json'),
    ]);
    // scripted attrs join the plain ones of the same buff; scripted-only buffs count as buffs (no debuff flag in the data)
    const byId = new Map(rows.map((b) => [b.id, { ...b, attrs: [...b.attrs] }]));
    for (const s of scripted) {
      const b = byId.get(s.buffId);
      if (b) b.attrs.push(...s.attrs);
      else byId.set(s.buffId, { id: s.buffId, name: s.name, isDebuff: false, attrs: s.attrs });
    }
    // buffs that only set fight-temp values (e.g. Parry block rate) are still pickable; their effect is applied in the
    // damage formulas through the buff id, not through attributes
    const combatOnly = new Set<number>();
    for (const f of fightTemp.sources) {
      if (f.kind === 'buff' && !byId.has(f.effectId)) {
        byId.set(f.effectId, { id: f.effectId, name: `${f.name} (combat effect)`, isDebuff: false, attrs: [] });
        combatOnly.add(f.effectId);
      }
    }
    return [...byId.values()]
      .filter((b) => b.isDebuff === this.debuff && (b.attrs.length || combatOnly.has(b.id)))
      .map((b) => {
        const layers = b.maxLayer && b.maxLayer > 1 ? b.maxLayer : 0;
        return {
          id: String(b.id),
          name: b.duration ? `${b.name} (${b.duration}s)` : b.name,
          amountLabel: layers ? 'Stacks' : '',
          min: layers ? 1 : 0,
          max: layers,
          resolve: (n: number) => b.attrs.map((a) => ({ attr: a.attr, value: a.value * Math.max(n, 1) })),
        };
      });
  }
}
