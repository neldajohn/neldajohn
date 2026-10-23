import { describe, expect, it } from 'vitest';
import { evaluateExpression as ev } from './calc';

describe('calculator', () => {
  it('respects precedence and parentheses', () => {
    expect(ev('2+3*4')).toBe(14);
    expect(ev('(2+3)*4')).toBe(20);
    expect(ev('75/410*100')).toBeCloseTo(18.2927, 3);
    expect(ev('-3+5')).toBe(2);
    expect(ev('2^3^2')).toBe(512);
    expect(ev('1,200 ÷ 4 × 2')).toBe(600);
  });
  it('rejects junk', () => {
    expect(() => ev('2+')).toThrow();
    expect(() => ev('alert(1)')).toThrow();
    expect(() => ev('1/0')).toThrow();
  });
});
