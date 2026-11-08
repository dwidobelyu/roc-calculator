import { AttrSheet } from './attr-sheet';
import { PetCombatEntry, PetStatAmplifier, petAttrs, petRawSheet } from './pet-combatant';

// AttributeCalculator.PetStatAmplifier as shipped in attr_job_tables.json
const amp: PetStatAmplifier = {
  ATTR_PET_STR: { SP: 0, DEF: 1, HP: 0, ATK: 7, ASPD: 0, MAG: 0, MDF: 0, CRIT: 0 },
  ATTR_PET_AGI: { SP: 0, DEF: 0, HP: 0, ATK: 0, ASPD: 4, MAG: 1, MDF: 1, CRIT: 2 },
  ATTR_PET_VIT: { SP: 0, DEF: 2, HP: 6, ATK: 0, ASPD: 0, MAG: 0, MDF: 0, CRIT: 0 },
  ATTR_PET_INT: { SP: 2, DEF: 0, HP: 0, ATK: 0, ASPD: 0, MAG: 6, MDF: 0, CRIT: 0 },
  ATTR_PET_DEX: { SP: 0, DEF: 4, HP: 0, ATK: 0, ASPD: 2, MAG: 0, MDF: 2, CRIT: 0 },
  ATTR_PET_LUK: { SP: 0, DEF: 0, HP: 0, ATK: 0, ASPD: 0, MAG: 0, MDF: 4, CRIT: 4 },
};

const sheet = (o: Record<number, number>) => {
  const s = new AttrSheet();
  for (const [k, v] of Object.entries(o)) s.set(+k, v);
  return s;
};
const neutral = { 373: 500, 374: 500, 375: 500, 376: 500, 377: 500, 378: 500, 391: 100 };

describe('pet combatant (AC:2883-3058)', () => {
  it('neutral aptitude: multipliers are 1, ASPD multiplier 0', () => {
    const r = petAttrs(sheet({ ...neutral, 379: 100, 392: 50, 380: 20, 393: 16, 435: 1500, 71: 8000, 387: 29, 382: 12, 388: 1 }), amp);
    expect(r.get(127)).toBe(345); // (100+50)*2 * 1 * 1.15
    expect(r.get(117)).toBe(36);
    expect(r.get(93)).toBe(8029);
    expect(r.get(129)).toBe(92);
    expect(r.get(133)).toBe(1);
    expect(r.get(411)).toBe(345);
  });

  it('STR aptitude raises ATK/DEF; hunger 0 scales battle ATK/DEF by 0.3 but not the true stats', () => {
    const r = petAttrs(sheet({ ...neutral, 373: 1200, 391: 0, 380: 20, 393: 16, 385: 10 }), amp);
    // ATK mult = 1 + 0.7*7/7 = 1.7 -> 36*1.7*0.3 = 18.36; DEF mult = 1 + 0.7/7 = 1.1 -> 10*1.1*0.3 = 3.3
    expect(r.get(117)).toBe(18);
    expect(r.get(119)).toBe(3);
    expect(r.get(412)).toBe(61);
    expect(r.get(415)).toBe(11);
  });

  it('raw sheet = base + level-up + star + initial aptitude', () => {
    const pet = {
      baseAttrs: [{ attr: 392, value: 50 }],
      initialStats: [{ attr: 373, min: 1200, max: 1400 }],
      stars: [{ rank: 0, rankUp: 0, petAttrs: [] }, { rank: 0, rankUp: 1, petAttrs: [{ attr: 379, value: 35 }] }],
    } as unknown as PetCombatEntry;
    const s = petRawSheet(pet, 1, [{ attr: 379, value: 100 }]);
    expect([s.get(392), s.get(379), s.get(373)]).toEqual([50, 135, 1200]);
    expect(petRawSheet(pet, 9, [], { 373: 1400 }).get(373)).toBe(1400);
  });
});
