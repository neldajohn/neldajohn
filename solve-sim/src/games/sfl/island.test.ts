import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../config';
import {
  bestPlacement,
  DAY_GOALS,
  generateIsland,
  orderScore,
  placementScore,
  reasonSupported,
  ROLES,
  STATION_DEFS,
  type Purchase,
} from './island';
import { dayScores, scoreIsland, supportPattern, type DayRecord } from './islandScore';

const seeds = Array.from({ length: 30 }, (_, i) => `sfl-${i}`);

describe('Sustainable Futures Lab generator', () => {
  it('is deterministic', () => {
    expect(JSON.stringify(generateIsland('a'))).toBe(JSON.stringify(generateIsland('a')));
  });

  it('matches the reported setup: four roles, four stations, three days', () => {
    for (const seed of seeds) {
      const sc = generateIsland(seed);
      expect(sc.researchers.map((r) => r.role)).toEqual([...ROLES]);
      expect(sc.stations.map((s) => s.id)).toEqual(STATION_DEFS.map((s) => s.id));
      // Everyone starts at the station matching their experience.
      sc.researchers.forEach((r) => expect(STATION_DEFS[r.home].home).toBe(r.role));
      // Day 1 needs real moves: at least two people contribute most away from home.
      expect(sc.researchers.filter((r) => r.strength !== r.home).length).toBeGreaterThanOrEqual(2);
      // Each person and station offers exactly two questions a day (or none when out in the field).
      sc.offers.forEach((o, day) => {
        sc.researchers.forEach((r) => expect(o[r.id]).toHaveLength(r.unavailable === day ? 0 : 2));
        sc.stations.forEach((s) => expect(o[s.id]).toHaveLength(2));
      });
      expect(sc.researchers.filter((r) => r.unavailable === 0)).toHaveLength(0);
      expect(sc.researchers.filter((r) => r.unavailable === 1)).toHaveLength(1);
      expect(sc.researchers.filter((r) => r.unavailable === 2)).toHaveLength(1);
    }
  });

  it('every day has a reachable perfect (Days 1–2) or strong (Day 3) placement', () => {
    for (const seed of seeds) {
      const sc = generateIsland(seed);
      expect(bestPlacement(sc, 0).score).toBe(1);
      expect(bestPlacement(sc, 1).score).toBe(1);
      expect(bestPlacement(sc, 2).score).toBeGreaterThanOrEqual(0.75);
      // Starting where they are (home) is not already best on Day 1.
      expect(placementScore(sc, 0, sc.researchers.map((r) => r.home))).toBeLessThan(1);
      sc.stations.forEach((s) => s.need.forEach((n) => expect(n.people).toBeLessThanOrEqual(CONFIG.sflIsland.stationCapacity)));
    }
  });

  it('support problems: 3 per day, distinct urgency, one middle-path option each, no repeats in a game', () => {
    for (const seed of seeds) {
      const sc = generateIsland(seed);
      sc.problems.forEach((ps) => {
        expect(ps).toHaveLength(CONFIG.sflIsland.supportProblemsPerDay);
        expect(new Set(ps.map((p) => p.deadlineRank)).size).toBe(ps.length);
        expect(new Set(ps.map((p) => p.from)).size).toBe(ps.length);
        ps.forEach((p) => {
          expect(p.options).toHaveLength(4);
          expect(p.options.filter((o) => o.archetype === 'middle')).toHaveLength(1);
          expect(p.text).not.toMatch(/\{[SOU]\}/);
          p.options.forEach((o) => expect(o.text).not.toMatch(/\{[SOU]\}/));
          // Urgency is buried in the wording, never labelled.
          expect(p.text).toContain(p.deadline);
        });
      });
      const texts = sc.problems.flat().map((p) => p.options.find((o) => o.archetype === 'middle')!.text.slice(0, 40));
      expect(new Set(texts).size).toBe(texts.length);
    }
  });
});

describe('Sustainable Futures Lab scoring', () => {
  const sc = generateIsland('score');
  const r = sc.researchers.find((x) => x.strength !== x.home)!;
  const ri = sc.researchers.indexOf(r);

  it('reasons need evidence: strengths last across days, station needs only today', () => {
    const strength: Purchase = { day: 0, target: r.id, kind: 'strength', answer: '' };
    expect(reasonSupported(sc, 0, [], ri, r.strength, 'contribute')).toBe(false);
    expect(reasonSupported(sc, 0, [strength], ri, r.strength, 'contribute')).toBe(true);
    expect(reasonSupported(sc, 2, [strength], ri, r.strength, 'contribute')).toBe(true);
    const si = sc.stations.findIndex((s) => s.need[0].role !== null);
    const role = sc.stations[si].need[0].role;
    const who = sc.researchers.findIndex((x) => x.role === role);
    const need: Purchase = { day: 0, target: sc.stations[si].id, kind: 'need', answer: '' };
    expect(reasonSupported(sc, 0, [need], who, si, 'expertise')).toBe(true);
    expect(reasonSupported(sc, 1, [need], who, si, 'expertise')).toBe(false);
    expect(DAY_GOALS).toEqual(['people', 'stations', 'balance']);
  });

  it('order score and support pattern', () => {
    expect(orderScore(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1);
    expect(orderScore(['c', 'b', 'a'], ['a', 'b', 'c'])).toBe(0);
    const rec = (choices: DayRecord['choices']): DayRecord => ({ day: 0, purchases: [], moves: [], placement: [], order: [], choices, ratings: {}, expected: {}, requestsAvailable: 3, seconds: 0 });
    expect(supportPattern([rec({ a: 'postpone', b: 'postpone', c: 'middle' })]).drift).toBe('postpone');
    expect(supportPattern([rec({ a: 'middle', b: 'force' })]).drift).toBe(null);
  });

  it('a perfect day scores 100 on every stage', () => {
    const day = 0;
    const best = sc.bestPlacement[day].placement;
    const purchases: Purchase[] = [
      { day, target: sc.researchers[0].id, kind: 'strength', answer: '' },
      { day, target: sc.researchers[1].id, kind: 'mood', answer: '' },
      { day, target: sc.researchers[2].id, kind: 'strength', answer: '' },
    ];
    const ideal = [...sc.problems[day]].sort((a, b) => a.deadlineRank - b.deadlineRank).map((p) => p.id);
    const d: DayRecord = {
      day,
      purchases,
      moves: [],
      placement: best,
      order: ideal,
      choices: Object.fromEntries(sc.problems[day].map((p) => [p.id, 'middle'])),
      ratings: { r0: 1, r1: 'unknown', r2: 'unknown', r3: 'unknown' },
      expected: { r0: 1, r1: 'unknown', r2: 'unknown', r3: 'unknown' },
      requestsAvailable: 3,
      seconds: 300,
    };
    const s = dayScores(sc, d);
    expect(s).toEqual({ explore: 100, assign: 100, support: 100, reflect: 100, time: 100 });
    const res = scoreIsland(sc, sc.openingIdeal, [d], [], true, 60);
    expect(res.breakdown!.length).toBeGreaterThan(0);
  });
});
