import { CONFIG } from '../../config';
import { budgetScore, calmLine, calmness, combine, durationOf, line, listSome, mean, pct } from '../../lib/scoring';
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
  const calmRes = calmness(events, durationOf(events) || 1);
  const calm = calmRes.score;
  const completion = pct(outcomes.length, nSites);
  const process = Math.round(0.45 * sortAcc + 0.15 * locks + 0.15 * timeAlloc + 0.1 * calm + 0.15 * completion);
  const metrics = { sortingAccuracy: Math.round(sortAcc), lockQuality: Math.round(locks), timeAllocation: Math.round(timeAlloc), calmness: Math.round(calm), completion: Math.round(completion) };
  const gaps = outcomes.map((o) => o.poolBest.score - o.score);
  let habit = 'Keep it up: verify the live averages against every range before submitting.';
  if (completion < 100) habit = 'Pace yourself: aim for ~9 minutes per site so all three sites get a treatment.';
  else if (sortAcc < 70) habit = 'Sorting: check every attribute against the current range and the undesired trait before each call — two of three in range is a fit.';
  else if (Math.max(...gaps) > 0) habit = 'Final pick: your pool held a better trio. Start from the scarce characteristic (desired trait or edge range) and balance the averages around it.';
  else if (locks < 50) habit = 'Lock the scarce characteristics (edge ranges like 1–3 / 8–10, desired trait) — the easy ones fill themselves.';
  const name = (id: string) => sc.sites.flatMap((d) => [...d.population, ...d.queue, ...d.reserve]).find((m) => m.id === id)?.name ?? id;
  const siteLines = sc.sites.map((d, i) => {
    const o = outcomes[i];
    const label = `Site ${i + 1}: ${d.site.name}`;
    const cap = d.designedBest.score;
    if (!o) return line('product', 1 / nSites, label, 0, 'Not submitted before time ran out.', `Reach this site: aim for ~${Math.round(CONFIG.seaWolf.siteBudgetSec / 60)} min per site. Best possible here was ${cap}%.`);
    const failed = o.evaluation.checks.filter((c) => !c.pass).map((c) => `${c.label} (got ${c.detail})`);
    const capNote = cap < 100 ? ` 100% was impossible here — the best any trio could reach was ${cap}%, so ${cap}% is full marks in practice.` : '';
    const reason = `${o.score}% effective.${failed.length ? ' Failed: ' + listSome(failed) + '.' : ''}${capNote}`;
    let fix: string;
    if (o.poolBest.score > o.score) fix = `Your pool already held a ${o.poolBest.score}% trio: ${o.poolBest.trio.map(name).join(', ')}. Start from the scarce trait or edge range, then balance the averages.`;
    else if (cap > o.score) fix = `Your pool topped out at ${o.poolBest.score}%. The site allowed ${cap}% (e.g. ${d.designedBest.trio.map(name).join(', ')}): keep microbes that fix your weakest check in the offer rounds, and sort good fits to "Current site".`;
    else fix = cap < 100 ? `You hit the site's ceiling of ${cap}%; nothing more was possible.` : '';
    return line('product', 1 / nSites, label, o.score, reason, fix);
  });
  const missorts = outcomes.flatMap((o) => o.calls.map((c, k) => ({ c, t: o.truth[k], site: o.site + 1, id: sc.sites[o.site].queue[k]?.id })).filter((x) => x.c !== x.t));
  const breakdown = [
    ...siteLines,
    line('process', 0.45, 'Sorting accuracy', sortAcc,
      outcomes.length ? `${outcomes.reduce((a, o) => a + o.calls.filter((c, k) => c === o.truth[k]).length, 0)} of ${outcomes.reduce((a, o) => a + o.truth.length, 0)} sorting calls right.${missorts.length ? ' Missed: ' + listSome(missorts.map((m) => `site ${m.site} ${name(m.id ?? '')} → should be ${m.t}`)) : ''}` : 'No sorting done.',
      'Rule: "Current" if at least 2 of 3 attributes sit in this site\'s ranges and it lacks the undesired trait; otherwise "Next" if it fits the next site\'s preview; otherwise "Return".'),
    line('process', 0.15, 'Lock choice', locks,
      `${Math.round(locks)}% of your locks were scarce characteristics (edge ranges 1–3 / 8–10, or the desired trait).`,
      'Lock the hardest things to find — an edge range or the desired trait. Easy middle ranges fill themselves.'),
    line('process', 0.15, 'Time per site', timeAlloc,
      outcomes.length ? `Site times: ${outcomes.map((o) => `${(o.seconds / 60).toFixed(1)} min`).join(', ')} (budget ${Math.round(CONFIG.seaWolf.siteBudgetSec / 60)} min each).` : 'No site finished.',
      `Keep each site under ${Math.round(CONFIG.seaWolf.siteBudgetSec / 60)} minutes; sorting should take about a minute.`),
    calmLine(0.1, calmRes.cpm, calm),
    line('process', 0.15, 'Completion', completion, `Finished ${outcomes.length} of ${nSites} sites.`, 'Submit a treatment at every site, even an imperfect one.'),
  ];

  return {
    breakdown,
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
