import { CONFIG } from '../../config';
import { budgetScore, calmness, combine, mean, pct } from '../../lib/scoring';
import type { GameResult, TelemetryEvent } from '../../lib/types';
import { DAY_GOALS, GOAL_TEXT, placementScore, reflectCredit, supportScore, type IslandScenario, type Purchase, type Rating, type Reason } from './island';

export interface IslandDay {
  day: number;
  placement: (number | null)[];
  reasons: { researcher: number; station: number; reason: Reason; supported: boolean }[];
  support: number[];
  ratings: Record<string, Rating>;
  evidence: Record<string, boolean>;
  purchases: Purchase[];
  requestsAvailable: number;
  seconds: number;
}

export function scoreIsland(sc: IslandScenario, days: IslandDay[], events: TelemetryEvent[], timedOut: boolean, onboardingSec: number): GameResult {
  const nDays = CONFIG.sflIsland.days;
  const per = Array.from({ length: nDays }, (_, d) => {
    const dd = days[d];
    if (!dd) return { placement: 0, support: 0, consistency: 0, reflect: 0, reasons: 0, explore: 0, time: 0 };
    const placement = placementScore(sc, d, dd.placement);
    const reqs = sc.support[d];
    const support = mean(reqs.map((r, i) => (dd.support[i] === undefined ? 0 : supportScore(d, r.options[dd.support[i]]))));
    const linked = reqs.findIndex((r) => r.linkedTo);
    const src = reqs.findIndex((r) => r.id === reqs[linked]?.linkedTo);
    const a = reqs[src]?.options[dd.support[src]];
    const b = reqs[linked]?.options[dd.support[linked]];
    const consistency = a && b && a.stance && b.stance === a.stance ? 100 : 0;
    const reflect = mean(sc.researchers.map((r) => reflectCredit(r.feeling[d], dd.ratings[r.id] ?? 'unknown', !!dd.evidence[r.id])));
    const reasons = dd.reasons.length ? pct(dd.reasons.filter((x) => x.supported).length, dd.reasons.length) : 0;
    const goalKinds = DAY_GOALS[d] === 'researcher' ? ['pref', 'feeling'] : DAY_GOALS[d] === 'workstation' ? ['need', 'coverage', 'skill'] : ['pref', 'need', 'coverage', 'skill', 'feeling'];
    const used = dd.purchases.length;
    const onGoal = dd.purchases.filter((p) => goalKinds.includes(p.kind)).length;
    const explore = used ? 0.5 * pct(used, dd.requestsAvailable) + 0.5 * pct(onGoal, used) : 0;
    const time = budgetScore(dd.seconds, CONFIG.sflIsland.perDayBudgetSec);
    return { placement: placement * 100, support: support * 100, consistency, reflect: reflect * 100, reasons, explore, time };
  });
  const avg = (k: keyof (typeof per)[number]) => mean(per.map((p) => p[k]));
  const product = Math.round(0.4 * avg('placement') + 0.35 * avg('support') + 0.25 * avg('reflect'));
  const totalSec = onboardingSec + days.reduce((a, d) => a + d.seconds, 0);
  const calm = calmness(events, totalSec || 1).score;
  const process = Math.round(0.35 * avg('reasons') + 0.2 * avg('explore') + 0.15 * avg('consistency') + 0.2 * avg('time') + 0.1 * calm);

  const metrics = {
    evidenceBackedReasons: Math.round(avg('reasons')),
    exploreEfficiency: Math.round(avg('explore')),
    supportConsistency: Math.round(avg('consistency')),
    timeAllocation: Math.round(avg('time')),
    onboardingSec,
    daysCompleted: days.length,
  };
  let habit = 'Strong judgement. Keep tying every assignment reason to an answer you bought today.';
  if (days.length < nDays) habit = `Pace: you completed ${days.length}/3 days. Keep onboarding to ~3 min and each day to ~9 min; move on even if Explore feels incomplete.`;
  else if (avg('reasons') < 60) habit = 'Evidence: a reason only counts if today’s answers support it. Spend Explore Requests on what today’s goal needs, then cite them.';
  else if (avg('reflect') < 60) habit = 'Reflect: rate only what you have evidence for (an answer or a remark in Support). Otherwise choose “I don’t know”.';
  else if (avg('support') < 70) habit = 'Support: more than one option sounds reasonable — pick the one that serves today’s goal (Day 3: the balanced one).';
  else if (avg('consistency') < 100) habit = 'Consistency: when a later request echoes an earlier one, give the same policy you already told the team.';

  return {
    game: 'sflIsland',
    product,
    process,
    score: combine(product, process),
    timeSpentSec: totalSec,
    timedOut,
    habit,
    details: {
      perDay: per.map((p, d) => ({ day: d + 1, goal: GOAL_TEXT[DAY_GOALS[d]], ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Math.round(v)])) })),
      metrics,
      truth: sc.researchers.map((r) => ({ name: r.name, skill: r.skill, prefs: r.pref.map((p) => sc.stations[p].name), feelings: r.feeling })),
      stations: sc.stations.map((s) => ({ name: s.name, needs: s.need, coverage: s.coverage })),
      bestSupport: sc.support.map((reqs, d) => reqs.map((r) => r.options.find((o) => o.serves === DAY_GOALS[d])?.text ?? '')),
    },
  };
}
