import { describe, expect, it } from 'vitest';
import { generateCases, generateStudy } from '../games/redrock/model';
import { scoreRedRock } from '../games/redrock/score';
import { evaluate, bestTrio, correctCall, generateSeaWolf } from '../games/seawolf/model';
import { scoreSeaWolf, type SiteOutcome } from '../games/seawolf/score';
import { generateIsland } from '../games/sfl/island';
import { scoreIsland, type DayRecord } from '../games/sfl/islandScore';
import type { GameResult } from './types';

function check(r: GameResult) {
  const b = r.breakdown!;
  expect(b.length).toBeGreaterThan(0);
  expect(b.reduce((a, l) => a + l.weight, 0)).toBeCloseTo(1, 5);
  // Points shown in the debrief add up to the game score (allowing for rounding).
  expect(Math.abs(b.reduce((a, l) => a + l.weight * l.score, 0) - r.score)).toBeLessThanOrEqual(1.5);
  b.forEach((l) => {
    expect(l.reason.length).toBeGreaterThan(0);
    expect(l.fix.length).toBeGreaterThan(0);
  });
}

describe('score breakdowns', () => {
  it('Red Rock: empty and perfect runs', () => {
    const study = generateStudy('bd');
    const cases = generateCases('bd');
    const empty = scoreRedRock(study, cases, { answers: {}, blanks: {}, chartType: null, chartValues: [], caseAnswers: [], casesReached: 0, studySec: 2000, casesSec: 0 }, [], true);
    check(empty);
    const answers = Object.fromEntries(study.questions.map((q) => [q.id, String(q.answer)]));
    const blanks = Object.fromEntries(study.report.blanks.map((b) => [b.id, b.kind === 'choice' ? b.correct : b.questionId]));
    const perfect = scoreRedRock(
      study,
      cases,
      { answers, blanks, chartType: study.chart.correct, chartValues: study.chart.values.map(String), caseAnswers: cases.map((c) => String(c.answer)), casesReached: 6, studySec: 600, casesSec: 600 },
      study.requiredFacts.map((f, i) => ({ t_ms: i, game: 'redrock', phase: 'investigation', type: 'journal_add', payload: { factId: f, relevant: true } })),
      false,
    );
    check(perfect);
    expect(perfect.breakdown!.filter((l) => l.area === 'product').every((l) => l.score === 100)).toBe(true);
  });

  it('Sea Wolf', () => {
    const sc = generateSeaWolf('bd');
    const sites = sc.sites.map((d) => d.site);
    const outcomes: SiteOutcome[] = sc.sites.slice(0, 2).map((d, i) => {
      const pool = d.reserve.slice(0, 10);
      const trio = pool.slice(0, 3);
      const ev = evaluate(trio, d.site, sc.attrNames, sc.traitNames);
      return { site: i, score: ev.score, evaluation: ev, poolBest: bestTrio(pool, d.site, sc.attrNames, sc.traitNames), designedBest: d.designedBest, poolIds: pool.map((m) => m.id), selection: trio.map((m) => m.id), calls: d.queue.map(() => 'return'), truth: d.queue.map((m) => correctCall(m, sites, i)), locks: ['desired', 'attr:0'], seconds: 400 };
    });
    check(scoreSeaWolf(sc, outcomes, [], true));
  });

  it('Sustainable Futures Lab', () => {
    const sc = generateIsland('bd');
    const day: DayRecord = {
      day: 0,
      purchases: [{ day: 0, target: 's0', kind: 'need', answer: '' }],
      moves: [{ researcher: 0, from: sc.researchers[0].home, to: 2, reason: 'contribute', supported: false }],
      placement: [2, 1, 2, 3],
      order: sc.problems[0].map((p) => p.id),
      choices: { [sc.problems[0][0].id]: 'postpone' },
      ratings: { r0: 2 },
      expected: { r0: 'unknown', r1: 'unknown', r2: 'unknown', r3: 'unknown' },
      requestsAvailable: 3,
      seconds: 700,
    };
    check(scoreIsland(sc, null, [day], [], true, 200));
  });
});
