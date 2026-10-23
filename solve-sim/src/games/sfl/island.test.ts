import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../config';
import { DAY_GOALS, generateIsland, placementScore, reasonSupported, reflectCredit, supportScore } from './island';

const seeds = Array.from({ length: 30 }, (_, i) => `isl-${i}`);

describe('SFL Island generator', () => {
  it('is deterministic', () => {
    expect(JSON.stringify(generateIsland('a'))).toBe(JSON.stringify(generateIsland('a')));
  });

  it('always has a perfect placement on day 1 and day 2, and a strong balance on day 3', () => {
    for (const seed of seeds) {
      const sc = generateIsland(seed);
      expect(sc.researchers).toHaveLength(4);
      expect(sc.stations).toHaveLength(4);
      expect(placementScore(sc, 0, sc.plantedPlacement[0])).toBe(1);
      expect(placementScore(sc, 1, sc.plantedPlacement[1])).toBe(1);
      expect(placementScore(sc, 2, sc.plantedPlacement[2])).toBeGreaterThanOrEqual(0.75);
      // Capacity is respected by the planted placements and by preferences.
      for (let d = 0; d < 3; d++) {
        const counts = [0, 0, 0, 0];
        sc.researchers.forEach((r) => counts[r.pref[d]]++);
        counts.forEach((c) => expect(c).toBeLessThanOrEqual(CONFIG.sflIsland.stationCapacity));
        expect(sc.stations.reduce((a, s) => a + s.coverage[d], 0)).toBe(4);
      }
    }
  });

  it('builds 4 interlinked support requests per day with one option serving the goal', () => {
    for (const seed of seeds) {
      const sc = generateIsland(seed);
      sc.support.forEach((reqs, d) => {
        expect(reqs).toHaveLength(4);
        expect(reqs.filter((r) => r.linkedTo)).toHaveLength(1);
        reqs.forEach((r) => {
          expect(r.options.length).toBeGreaterThanOrEqual(2);
          expect(r.options.length).toBeLessThanOrEqual(4);
          expect(r.options.filter((o) => supportScore(d, o) === 1)).toHaveLength(1);
        });
      });
    }
  });
});

describe('SFL Island scoring', () => {
  const sc = generateIsland('score');
  it('only counts reasons supported by answers bought today', () => {
    const r = sc.researchers[0];
    const pref0 = r.pref[0];
    expect(reasonSupported(sc, 0, [], 0, pref0, 'preference')).toBe(false);
    expect(reasonSupported(sc, 0, [{ day: 0, target: r.id, kind: 'pref', answer: '' }], 0, pref0, 'preference')).toBe(true);
    // Yesterday's answer does not count after the overnight reset.
    expect(reasonSupported(sc, 1, [{ day: 0, target: r.id, kind: 'pref', answer: '' }], 0, r.pref[1], 'preference')).toBe(false);
    expect(DAY_GOALS).toEqual(['researcher', 'workstation', 'balance']);
  });

  it('credits "I don\'t know" only without evidence', () => {
    expect(reflectCredit('low', 'unknown', false)).toBe(1);
    expect(reflectCredit('low', 'low', false)).toBe(0);
    expect(reflectCredit('low', 'low', true)).toBe(1);
    expect(reflectCredit('low', 'unknown', true)).toBe(0);
  });
});
