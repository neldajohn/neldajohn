import { CONFIG } from '../../config';
import { budgetScore, calmness, combine, mean, pct } from '../../lib/scoring';
import type { GameResult, TelemetryEvent } from '../../lib/types';
import type { Evaluation, Scenario } from './model';

export interface SiteOutcome {
  site: number;
  score: number;
  evaluation: Evaluation;
  poolBest: Evaluation & { trio: string[] };
  designedBest: Evaluation & { trio: string[] };
  poolIds: string[];
  selection: string[];
  calls: string[];
  truth: string[];
  locks: string[];
  seconds: number;
}

/** Locks that bite: edge ranges (1–3, 8–10) and the desired trait are the scarce characteristics. */
export function lockQuality(sc: Scenario, o: SiteOutcome): number {
  const site = sc.sites[o.site].site;
  const hard = (l: string) => {
    if (l === 'desired') return true;
    if (!l.startsWith('attr:')) return false;
    const [lo, hi] = site.ranges[Number(l.slice(5))];
    return lo === 1 || hi === 10;
  };
  return pct(o.locks.filter(hard).length, o.locks.length);
}

export function scoreSeaWolf(sc: Scenario, outcomes: SiteOutcome[], events: TelemetryEvent[], timedOut: boolean): GameResult {
  const nSites = sc.sites.length;
  const product = Math.round(mean(Array.from({ length: nSites }, (_, i) => outcomes[i]?.score ?? 0)));
  const sortAcc = mean(outcomes.map((o) => pct(o.calls.filter((c, i) => c === o.truth[i]).length, o.truth.length)));
  const locks = mean(outcomes.map((o) => lockQuality(sc, o)));
  const timeAlloc = mean(outcomes.map((o) => budgetScore(o.seconds, CONFIG.seaWolf.siteBudgetSec)));
  const totalSec = outcomes.reduce((a, o) => a + o.seconds, 0);
  const calm = calmness(events, totalSec || 1).score;
  const completion = pct(outcomes.length, nSites);
  const process = Math.round(0.45 * sortAcc + 0.15 * locks + 0.15 * timeAlloc + 0.1 * calm + 0.15 * completion);
  const metrics = { sortingAccuracy: Math.round(sortAcc), lockQuality: Math.round(locks), timeAllocation: Math.round(timeAlloc), calmness: Math.round(calm), completion: Math.round(completion) };
  const gaps = outcomes.map((o) => o.poolBest.score - o.score);
  let habit = 'Keep it up: verify the live averages against every range before submitting.';
  if (completion < 100) habit = 'Pace yourself: aim for ~9 minutes per site so all three sites get a treatment.';
  else if (sortAcc < 70) habit = 'Sorting: check every attribute against the current range and the undesired trait before each call — two of three in range is a fit.';
  else if (Math.max(...gaps) > 0) habit = 'Final pick: your pool held a better trio. Start from the scarce characteristic (desired trait or edge range) and balance the averages around it.';
  else if (locks < 50) habit = 'Lock the scarce characteristics (edge ranges like 1–3 / 8–10, desired trait) — the easy ones fill themselves.';
  return {
    game: 'seawolf',
    product,
    process,
    score: combine(product, process),
    timeSpentSec: totalSec,
    timedOut,
    habit,
    details: { outcomes, metrics, sites: sc.sites.map((d) => ({ name: d.site.name, solvable: d.site.solvable, designedBest: d.designedBest.score })) },
  };
}
