import { describe, expect, it } from 'vitest';
import { bestTrio, correctCall } from '../games/seawolf/model';
import {
  DRILL_LENGTH,
  DRILLS,
  gradeData,
  gradeFinal,
  gradeLock,
  makeAnalysisItem,
  makeCaseItem,
  makeClassicItem,
  makeDataItem,
  makeExploreItem,
  makeFinalItem,
  makeKeepItem,
  makeLockItem,
  makeReasonItem,
  makeReflectItem,
  makeSortItem,
  makeSupportItem,
  supportCorrect,
} from './defs';
import { reasonSupported } from '../games/sfl/island';

const seeds = Array.from({ length: DRILL_LENGTH }, (_, i) => `drill-${i}`);

describe('drills', () => {
  it('covers every game with at least one drill', () => {
    expect(new Set(DRILLS.map((d) => d.game))).toEqual(new Set(['Sea Wolf', 'Red Rock', 'SFL Island', 'SFL Classic']));
  });

  for (const hard of [false, true]) {
    it(`Sea Wolf items have correct answer keys (hard=${hard})`, () => {
      const calls = new Set<string>();
      for (const s of seeds) {
        const so = makeSortItem(s, 'default', hard);
        expect(so.answer).toBe(correctCall(so.microbe, so.sc.sites.map((d) => d.site), so.siteIdx));
        calls.add(so.answer);

        const lo = makeLockItem(s, 'default', hard);
        const ranked = lo.keys.map((k, i) => ({ k, c: lo.counts[i] })).sort((a, b) => a.c - b.c);
        expect(gradeLock(lo, [ranked[0].k, ranked[1].k]).correct).toBe(true);

        const ke = makeKeepItem(s, 'default', hard);
        expect(ke.offer).toHaveLength(3);
        ke.offer.forEach((o, i) => expect(bestTrio([...ke.pool, o], ke.sc.sites[ke.siteIdx].site, ke.sc.attrNames, ke.sc.traitNames).score).toBe(ke.scores[i]));

        const fi = makeFinalItem(s, 'default', hard);
        expect(fi.pool).toHaveLength(10);
        expect(gradeFinal(fi, fi.best.trio).correct).toBe(true);
        if (hard) expect(fi.best.score).toBe(100);
      }
      expect(calls.size).toBeGreaterThanOrEqual(2);
    });
  }

  it('Red Rock items', () => {
    for (const s of seeds) {
      const st = makeDataItem(s);
      expect(gradeData(st, st.requiredFacts).correct).toBe(true);
      const noisy = Object.keys(st.facts).find((id) => !st.requiredFacts.includes(id))!;
      expect(gradeData(st, [...st.requiredFacts, noisy]).correct).toBe(false);
      const an = makeAnalysisItem(s);
      expect(an.facts.length).toBeGreaterThan(0);
      const c = makeCaseItem(s);
      expect(c.question.length).toBeGreaterThan(0);
    }
  });

  it('SFL items have exactly-defined right answers', () => {
    for (const s of seeds) {
      const ex = makeExploreItem(s);
      expect(ex.options).toHaveLength(4);
      expect(ex.correct).toBeGreaterThanOrEqual(0);
      const re = makeReasonItem(s);
      expect(re.supported.length).toBeGreaterThan(0);
      re.supported.forEach((r) => expect(reasonSupported(re.sc, re.day, re.notes, re.researcher, re.station, r)).toBe(true));
      const su = makeSupportItem(s);
      expect(su.request.options.filter((_, i) => supportCorrect(su, i))).toHaveLength(1);
      const rf = makeReflectItem(s);
      expect(rf.answer).toBe(rf.evidence === 'none' ? 'unknown' : rf.truth);
      const cl = makeClassicItem(s);
      expect(cl.decision.options[cl.best].q).toBe(Math.max(...cl.decision.options.map((o) => o.q)));
    }
  });
});
