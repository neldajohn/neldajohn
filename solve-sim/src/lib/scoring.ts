import { CONFIG } from '../config';
import type { TelemetryEvent } from './types';

export const pct = (num: number, den: number) => (den <= 0 ? 0 : (100 * num) / den);

export function combine(product: number, process: number): number {
  const { productWeight, processWeight } = CONFIG.scoring;
  return Math.round(product * productWeight + process * processWeight);
}

/** Answer changes after the first commit on the same field. */
export function flipFlops(events: TelemetryEvent[], type = 'answer_change'): number {
  const seen = new Map<string, number>();
  for (const e of events) {
    if (e.type !== type) continue;
    const k = String(e.payload?.field ?? '');
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  let flips = 0;
  for (const n of seen.values()) flips += Math.max(0, n - 1);
  return flips;
}

/** Clicks per minute above the threshold count as erratic; returns a 0–100 calmness score. */
export function calmness(events: TelemetryEvent[], durationSec: number): { cpm: number; score: number } {
  const clicks = events.filter((e) => e.type === 'click').length;
  const cpm = durationSec > 0 ? clicks / (durationSec / 60) : 0;
  const over = Math.max(0, cpm - CONFIG.scoring.erraticClicksPerMin);
  return { cpm: Math.round(cpm), score: Math.max(0, 100 - over * 4) };
}

/** Seconds between the first and last event of a game. */
export function durationOf(events: TelemetryEvent[]): number {
  return events.length ? (events[events.length - 1].t_ms - events[0].t_ms) / 1000 : 0;
}

/** 100 when actual is within the budget, decaying as it overruns. */
export function budgetScore(actualSec: number, budgetSec: number): number {
  if (actualSec <= budgetSec) return 100;
  return Math.max(0, Math.round(100 - ((actualSec - budgetSec) / budgetSec) * 100));
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
