import { describe, expect, it } from 'vitest';
import { alignment, generateClassic, rankingScore, resolveDecision } from './classic';

describe('SFL Classic', () => {
  it('has 12 decisions with at least 2 branching on earlier picks', () => {
    const sc = generateClassic('c1');
    expect(sc.decisions).toHaveLength(12);
    expect(sc.decisions.filter((d) => 'variants' in d).length).toBeGreaterThanOrEqual(2);
  });

  it('branches on earlier choices', () => {
    const sc = generateClassic('c2');
    expect(resolveDecision(sc, 4, { d2: 'cheap' }).id).toBe('d5a');
    expect(resolveDecision(sc, 4, { d2: 'local' }).id).toBe('d5b');
    expect(resolveDecision(sc, 8, { d4: 'overrule' }).id).toBe('d9a');
    expect(resolveDecision(sc, 8, {}).id).toBe('d9b');
  });

  it('scores ranking and alignment', () => {
    expect(rankingScore([0, 1, 2, 3], [0, 1, 2, 3])).toBe(1);
    expect(rankingScore([3, 2, 1, 0], [0, 1, 2, 3])).toBe(0);
    const d = resolveDecision(generateClassic('c3'), 0, {});
    // Ranking emissions first should make the emissions-heavy option the best fit.
    expect(alignment([0, 1, 2, 3], d, 0)).toBe(1);
  });
});
