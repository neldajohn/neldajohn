import { describe, expect, it } from 'vitest';
import { checkNumeric, generateCases, generateStudy, workedExample, type Fact, type Study, type TemplateId } from './model';

const TEMPLATES: TemplateId[] = ['largestShare', 'highestGrowth', 'lowestCost', 'projection'];
const seeds = Array.from({ length: 25 }, (_, i) => `rr-${i}`);
const r2 = (x: number) => Math.round(x * 100) / 100;

function req(study: Study): Fact[] {
  return study.requiredFacts.map((id) => study.facts[id]);
}
const val = (fs: Fact[], entity: string, metric: string, year?: number) => {
  const f = fs.find((x) => x.entity === entity && x.metric === metric && (year === undefined || x.year === year));
  if (!f) throw new Error(`missing ${entity} ${metric} ${year}`);
  return f.value;
};

/** Recompute question-1 answers using only the required facts: proves the study is solvable from what the journal should hold. */
function solveQ1(study: Study): number[] {
  const fs = req(study);
  const year = Math.max(...fs.map((f) => f.year ?? 0));
  const ents = [...new Set(fs.filter((f) => f.year === year || f.year === undefined).map((f) => f.entity))];
  switch (study.template) {
    case 'largestShare': {
      const sp = fs.find((f) => f.metric !== 'wildlife recorded')!.metric;
      return ents.map((e) => r2((100 * val(fs, e, sp, year)) / val(fs, e, 'wildlife recorded', year)));
    }
    case 'highestGrowth':
      return ents.map((e) => r2((100 * (val(fs, e, 'breeding pairs', year) - val(fs, e, 'breeding pairs', year - 1))) / val(fs, e, 'breeding pairs', year - 1)));
    case 'lowestCost':
      return ents.map((e) => r2(val(fs, e, 'programme cost') / ((val(fs, e, 'hectares planted') * val(fs, e, 'survival rate')) / 100)));
    case 'projection':
      return ents.map((e) => r2(val(fs, e, 'live coral cover') * Math.pow(1 + val(fs, e, 'annual change in coral cover') / 100, 3)));
  }
}

describe('Red Rock worked example (spec §2.5)', () => {
  it('reproduces the published numbers', () => {
    const w = workedExample();
    expect(w.shares).toEqual([15, 18.29, 11.54]);
    expect(w.lead).toBe(3.29);
    expect(w.shareOfAll).toBe(32.47);
    expect(w.rawLeader).toBe(0); // North Bank has most otters (the trap)
    expect(w.shareLeader).toBe(1); // Cedar Marsh has the largest share
  });
});

describe('Red Rock study generator', () => {
  for (const t of TEMPLATES) {
    it(`${t}: solvable from required facts, well-formed`, () => {
      for (const seed of seeds) {
        const s = generateStudy(seed, t);
        expect(s.template).toBe(t);
        // Required facts are flagged relevant; about half the facts are noise.
        req(s).forEach((f) => expect(f.relevant).toBe(true));
        const all = Object.values(s.facts);
        expect(all.filter((f) => !f.relevant).length).toBeGreaterThanOrEqual(all.length * 0.35);
        // Questions: 3 numbered questions with sub-parts, 2 dp answers.
        const numbers = new Set(s.questions.map((q) => q.label[0]));
        expect(numbers.size).toBeGreaterThanOrEqual(2);
        expect(numbers.size).toBeLessThanOrEqual(4);
        s.questions.forEach((q) => expect(r2(q.answer)).toBe(q.answer));
        expect(solveQ1(s)).toEqual(s.questions.slice(0, 3).map((q) => q.answer));
        // Report: 8–10 blanks, value blanks point at real questions, choice answers are among options.
        expect(s.report.blanks.length).toBeGreaterThanOrEqual(8);
        expect(s.report.blanks.length).toBeLessThanOrEqual(10);
        s.report.blanks.forEach((b) => {
          if (b.kind === 'value') expect(s.questions.some((q) => q.id === b.questionId)).toBe(true);
          else expect(b.options).toContain(b.correct);
        });
        const placed = s.report.segments.filter((x) => typeof x !== 'string').length;
        expect(placed).toBe(s.report.blanks.length);
        expect(s.chart.categories.length).toBe(s.chart.values.length);
        expect(['line', 'bar']).toContain(s.chart.correct);
      }
    });
  }

  it('is deterministic and varies by seed', () => {
    expect(JSON.stringify(generateStudy('x'))).toBe(JSON.stringify(generateStudy('x')));
    const kinds = new Set(seeds.map((s) => generateStudy(s).template));
    expect(kinds.size).toBeGreaterThan(1);
  });
});

describe('Red Rock cases', () => {
  it('produces six cases covering the four core types', () => {
    for (const seed of seeds) {
      const cs = generateCases(seed);
      expect(cs).toHaveLength(6);
      const types = new Set(cs.map((c) => c.type));
      ['word', 'formula', 'verbal', 'visual'].forEach((t) => expect(types.has(t as never)).toBe(true));
      cs.forEach((c) => {
        if (c.kind === 'choice') expect(c.options).toContain(c.answer);
        else expect(Number.isFinite(c.answer as number)).toBe(true);
      });
    }
  });

  it('accepts answers within rounding tolerance', () => {
    expect(checkNumeric(18.29, 18.2927)).toBe(true);
    expect(checkNumeric(18.3, 18.2927)).toBe(true);
    expect(checkNumeric(18.31, 18.2927)).toBe(false);
    expect(checkNumeric(null, 1)).toBe(false);
  });
});
