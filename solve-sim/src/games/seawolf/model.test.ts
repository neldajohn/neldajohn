import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../config';
import { bestTrio, buildOffers, correctCall, evaluate, fits, generateSeaWolf, initialPool, inRange, perfectTrios, type Microbe, type Site } from './model';

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
    // Only the next site's desired trait is visible, so "next" = not a fit here but carries that trait.
    expect(correctCall(mk('y', [9, 9, 9], [0]), [site, next], 0)).toBe('next');
    expect(correctCall(mk('v', [9, 9, 9], [2]), [site, next], 0)).toBe('return');
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

describe('Sea Wolf hard mode', () => {
  const seeds = Array.from({ length: 30 }, (_, i) => `hard-${i}`);
  for (const variant of ['default', 'alt'] as const) {
    it(`every site is solvable but tightly constrained (${variant})`, () => {
      for (const seed of seeds) {
        const sc = generateSeaWolf(seed, variant, true);
        const sites = sc.sites.map((d) => d.site);
        sc.sites.forEach((d, i) => {
          expect(d.site.solvable).toBe(true);
          expect(d.designedBest.score).toBe(100);
          d.site.ranges.forEach(([lo, hi]) => expect(hi - lo + 1).toBe(CONFIG.seaWolf.hard.rangeWidth));
          // The planted trio: one hidden in the sorting queue (and sortable to "current"), two in the offers.
          const all = [...d.population, ...d.queue, ...d.reserve];
          const trio = d.planted.map((id) => all.find((m) => m.id === id)!);
          expect(evaluate(trio, d.site, sc.attrNames, sc.traitNames).score).toBe(100);
          const inQueue = d.queue.find((m) => d.planted.includes(m.id))!;
          expect(fits(inQueue, d.site)).toBe(true);
          expect(correctCall(inQueue, sites, i)).toBe('current');
          expect(d.reserve.filter((m) => d.planted.includes(m.id))).toHaveLength(2);
          // No planted microbe in the offers looks perfect on its own.
          d.reserve.filter((m) => d.planted.includes(m.id)).forEach((m) => expect(m.attrs.some((a, k) => !inRange(a, d.site.ranges[k]))).toBe(true));
          // Only a couple of 100% trios exist among everything reachable.
          const reach = [...d.population, ...d.queue, ...d.reserve, ...(i > 0 ? sc.sites[i - 1].queue : [])];
          expect(perfectTrios(reach, d.site, 10).length).toBeLessThanOrEqual(CONFIG.seaWolf.hard.maxPerfectTrios);
        });
      }
    });
  }

  it('a correctly routed planted microbe always reaches the offer rounds', () => {
    for (const seed of seeds) {
      const sc = generateSeaWolf(seed, 'default', true);
      const sites = sc.sites.map((d) => d.site);
      sc.sites.forEach((d, i) => {
        const routed = d.queue.filter((m) => correctCall(m, sites, i) === 'current');
        const offered = new Set(buildOffers(d, routed, new Set()).flat().map((m) => m.id));
        d.planted.forEach((id) => expect(offered.has(id)).toBe(true));
      });
    }
  });

  it('is harder than standard: fewer desired-trait carriers', () => {
    let std = 0;
    let hard = 0;
    for (const seed of seeds) {
      const count = (sc: ReturnType<typeof generateSeaWolf>) => sc.sites.reduce((a, d) => a + [...d.population, ...d.reserve].filter((m) => m.traits.includes(d.site.desired)).length, 0);
      std += count(generateSeaWolf(seed, 'default', false));
      hard += count(generateSeaWolf(seed, 'default', true));
    }
    expect(hard).toBeLessThan(std);
  });
});

describe('perfectTrios', () => {
  it('agrees with the full scorer', () => {
    for (const seed of ['p1', 'p2', 'p3']) {
      const sc = generateSeaWolf(seed, 'default', true);
      const d = sc.sites[0];
      const pool = [...d.reserve, ...d.queue].slice(0, 16);
      const fast = perfectTrios(pool, d.site).length;
      let slow = 0;
      for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) for (let k = j + 1; k < pool.length; k++) if (evaluate([pool[i], pool[j], pool[k]], d.site, sc.attrNames, sc.traitNames).score === 100) slow++;
      expect(fast).toBe(slow);
    }
  });
});
