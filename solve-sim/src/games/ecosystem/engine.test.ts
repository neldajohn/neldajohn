import { describe, expect, it } from 'vitest';
import { fitsLocation, generateEcosystem, simulate, type Species } from './engine';

const sp = (id: string, kind: Species['kind'], provides: number, needs: number, eats: string[] = []): Species => ({ id, name: id, kind, provides, needs, eats, depth: [0, 10], temp: [0, 10] });

describe('Ecosystem rules', () => {
  it('highest provider eats first, from the richest available source', () => {
    const r = simulate([sp('kelp', 'producer', 3000, 0), sp('moss', 'producer', 2000, 0), sp('crab', 'animal', 1500, 800, ['kelp', 'moss']), sp('ray', 'animal', 900, 400, ['crab'])]);
    expect(r.order).toEqual(['crab', 'ray']);
    expect(r.remaining.kelp).toBe(2200);
    expect(r.remaining.moss).toBe(2000);
    expect(r.remaining.crab).toBe(1100);
    expect(r.sustainable).toBe(true);
  });

  it('splits ties half/half', () => {
    const r = simulate([sp('a', 'producer', 1000, 0), sp('b', 'producer', 1000, 0), sp('x', 'animal', 500, 600, ['a', 'b'])]);
    expect(r.remaining.a).toBe(700);
    expect(r.remaining.b).toBe(700);
  });

  it('fails when prey is exhausted or an animal has no food', () => {
    expect(simulate([sp('a', 'producer', 500, 0), sp('x', 'animal', 900, 600, ['a'])]).sustainable).toBe(false);
    expect(simulate([sp('a', 'producer', 500, 0), sp('x', 'animal', 900, 100, ['zzz'])]).sustainable).toBe(false);
  });
});

describe('Ecosystem generator', () => {
  it('plants a sustainable, location-compatible chain of 8 in a pool of 39', () => {
    for (let i = 0; i < 25; i++) {
      const sc = generateEcosystem(`eco-${i}`);
      expect(sc.pool).toHaveLength(39);
      const chain = sc.pool.filter((s) => sc.solution.species.includes(s.id));
      expect(chain).toHaveLength(8);
      expect(simulate(chain).sustainable).toBe(true);
      chain.forEach((s) => expect(fitsLocation(s, sc.locations[sc.solution.location])).toBe(true));
    }
  });
});
