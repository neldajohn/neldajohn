import { describe, expect, it } from 'vitest';
import { bestTrio, buildOffers, correctCall, evaluate, generateSeaWolf, initialPool, type Microbe, type Site } from './model';

const names = ['A', 'B', 'C'];
const traits = ['t0', 't1', 't2', 't3'];
const site: Site = { id: 's', name: 'S', ranges: [[3, 5], [7, 9], [1, 3]], desired: 0, undesired: 1, solvable: true };
const mk = (id: string, attrs: number[], t: number[]): Microbe => ({ id, name: id, attrs, traits: t });

describe('Sea Wolf scorer', () => {
  it('scores five checks at 20% each', () => {
    const trio = [mk('a', [4, 8, 2], [0]), mk('b', [4, 8, 2], [2]), mk('c', [4, 8, 2], [3])];
    expect(evaluate(trio, site, names, traits).score).toBe(100);
    const bad = [mk('a', [9, 8, 2], [1]), mk('b', [9, 8, 2], [2]), mk('c', [9, 8, 2], [3])];
    const e = evaluate(bad, site, names, traits);
    expect(e.score).toBe(40); // attr 2 & 3 in range only; no desired; undesired present
  });

  it('uses the average, not each microbe', () => {
    const trio = [mk('a', [1, 10, 1], [0]), mk('b', [5, 7, 1], [2]), mk('c', [6, 7, 7], [2])];
    // averages 4, 8, 3 → all in range
    expect(evaluate(trio, site, names, traits).score).toBe(100);
  });

  it('classifies sorting calls', () => {
    const next: Site = { ...site, id: 'n', ranges: [[8, 10], [8, 10], [8, 10]], undesired: 3 };
    expect(correctCall(mk('x', [4, 8, 9], [2]), [site, next], 0)).toBe('current');
    expect(correctCall(mk('y', [9, 9, 9], [2]), [site, next], 0)).toBe('next');
    expect(correctCall(mk('z', [9, 9, 9], [3]), [site, next], 0)).toBe('return');
    expect(correctCall(mk('w', [4, 8, 2], [1]), [site, next], 0)).toBe('return');
  });
});

describe('Sea Wolf generator', () => {
  const seeds = Array.from({ length: 40 }, (_, i) => `seed-${i}`);

  it('is deterministic per seed', () => {
    expect(JSON.stringify(generateSeaWolf('abc'))).toBe(JSON.stringify(generateSeaWolf('abc')));
    expect(JSON.stringify(generateSeaWolf('abc'))).not.toBe(JSON.stringify(generateSeaWolf('abd')));
  });

  for (const variant of ['default', 'alt'] as const) {
    it(`reports best achievable and mixes solvable / best-effort sites (${variant})`, () => {
      let solvable = 0;
      let effort = 0;
      for (const seed of seeds) {
        const sc = generateSeaWolf(seed, variant);
        expect(sc.sites).toHaveLength(3);
        expect(sc.sites.some((d) => d.site.solvable)).toBe(true);
        expect(sc.sites.some((d) => !d.site.solvable)).toBe(true);
        sc.sites.forEach((d) => {
          expect(d.designedBest.score).toBeGreaterThan(0);
          if (d.site.solvable) {
            solvable++;
            expect(d.designedBest.score).toBe(100);
            const planted = d.reserve.filter((m) => d.planted.includes(m.id));
            expect(planted).toHaveLength(3);
            expect(evaluate(planted, d.site, sc.attrNames, sc.traitNames).score).toBe(100);
          } else {
            effort++;
            expect(d.designedBest.score).toBeLessThan(100);
          }
          expect(d.queue).toHaveLength(10);
          d.queue.concat(d.population, d.reserve).forEach((m) => {
            expect(m.attrs).toHaveLength(sc.attrNames.length);
            m.attrs.forEach((a) => expect(a >= 1 && a <= 10).toBe(true));
          });
        });
      }
      expect(solvable).toBeGreaterThan(0);
      expect(effort).toBeGreaterThan(0);
    });
  }

  it('keeps planted microbes in the offers even when routed microbes fill other slots', () => {
    const sc = generateSeaWolf('offers');
    const d = sc.sites.find((x) => x.site.solvable)!;
    const offers = buildOffers(d, d.queue, new Set());
    expect(offers).toHaveLength(4);
    offers.forEach((o) => expect(o).toHaveLength(3));
    const offered = new Set(offers.flat().map((m) => m.id));
    d.planted.forEach((id) => expect(offered.has(id)).toBe(true));
  });

  it('initial pool prefers microbes matching both locks', () => {
    const sc = generateSeaWolf('locks');
    const d = sc.sites[0];
    const pool = initialPool(d, ['attr:0', 'undesired']);
    expect(pool).toHaveLength(6);
    const best = bestTrio(pool, d.site, sc.attrNames, sc.traitNames);
    expect(best.trio).toHaveLength(3);
  });
});
