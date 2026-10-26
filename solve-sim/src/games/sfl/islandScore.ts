import { CONFIG } from '../../config';
import { budgetScore, calmLine, calmness, combine, line, listSome, mean, pct } from '../../lib/scoring';
import type { GameResult, TelemetryEvent } from '../../lib/types';
import { bestPlacement, DAY_GOALS, GOAL_TEXT, placementScore, REASONS, reflectCredit, supportScore, type IslandScenario, type Purchase, type Rating, type Reason } from './island';

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
  const calmRes = calmness(events, totalSec || 1);
  const calm = calmRes.score;
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

  const R = sc.researchers;
  const S = sc.stations;
  const first = (n: string) => n.split(' ')[0];
  const where = (st: number | null) => (st === null ? 'the lodge' : S[st].name);
  const short = (t: string) => (t.length > 90 ? t.slice(0, 88) + '…' : t);
  const placementIssues: string[] = [];
  const placementFixes: string[] = [];
  const supportIssues: string[] = [];
  const supportFixes: string[] = [];
  const reflectIssues: string[] = [];
  const reasonIssues: string[] = [];
  const exploreIssues: string[] = [];
  const consistencyIssues: string[] = [];
  const timeIssues: string[] = [];
  const NEEDS: Record<string, string> = {
    preference: 'a "where would you like to work" answer from that researcher naming this station',
    skill: 'a "what are you strongest at" answer from that researcher (matching the station\'s need if you asked it)',
    need: 'a "what does this workstation need" answer from that station',
    coverage: 'a "how many people" answer from that station',
    goal: 'an answer tied to today\'s goal (preference on Day 1, station need/coverage on Day 2, either on Day 3)',
  };
  for (let d = 0; d < nDays; d++) {
    const dd = days[d];
    const D = `Day ${d + 1}`;
    if (!dd) {
      placementIssues.push(`${D} not reached`);
      continue;
    }
    const goal = DAY_GOALS[d];
    if (goal !== 'workstation') R.forEach((r, i) => dd.placement[i] !== r.pref[d] && placementIssues.push(`${D}: ${first(r.name)} at ${where(dd.placement[i])}, wanted ${S[r.pref[d]].name}`));
    if (goal !== 'researcher')
      S.forEach((s, si) => {
        const here = R.filter((_, ri) => dd.placement[ri] === si);
        const ok = s.coverage[d] === 0 ? here.length === 0 : here.length >= s.coverage[d] && here.some((r) => r.skill === s.need[d]);
        if (!ok) placementIssues.push(`${D}: ${s.name} needed ${s.coverage[d] ? `${s.coverage[d]} incl. ${s.need[d]}` : 'nobody'}, had ${here.length ? here.map((r) => `${first(r.name)} (${r.skill})`).join(', ') : 'nobody'}`);
      });
    const best = bestPlacement(sc, d);
    if (placementScore(sc, d, dd.placement) < best.score)
      placementFixes.push(`${D}: ${R.map((r, i) => `${first(r.name)} → ${S[best.placement[i]].name}`).join(', ')}${best.score < 1 ? ` (the most this day allowed was ${Math.round(best.score * 100)})` : ''}`);
    else if (best.score < 1) placementIssues.push(`${D}: you matched the best possible placement (${Math.round(best.score * 100)}); 100 was not achievable that day`);
    sc.support[d].forEach((q, i) => {
      const c = dd.support[i];
      const best = q.options.find((o) => o.serves === goal)!;
      if (c === undefined) {
        supportIssues.push(`${D}: request from ${first(R.find((r) => r.id === q.from)!.name)} not answered`);
        supportFixes.push(`${D}: "${short(best.text)}"`);
      } else if (supportScore(d, q.options[c]) < 1) {
        const got = q.options[c].serves;
        supportIssues.push(`${D}: to ${first(R.find((r) => r.id === q.from)!.name)} you chose a ${got === 'none' ? 'non-committal' : got + '-first'} reply; today wanted ${goal === 'balance' ? 'a balanced' : 'a ' + goal + '-first'} one`);
        supportFixes.push(`${D}: "${short(best.text)}"`);
      }
    });
    R.forEach((r) => {
      const rating = dd.ratings[r.id] ?? 'unknown';
      const ev = !!dd.evidence[r.id];
      if (reflectCredit(r.feeling[d], rating, ev) < 1)
        reflectIssues.push(ev ? `${D}: ${first(r.name)} rated ${rating}, but what they told you showed ${r.feeling[d]}` : `${D}: ${first(r.name)} rated ${rating} with no evidence — should be "I don't know" (truth was ${r.feeling[d]})`);
    });
    dd.reasons.filter((x) => !x.supported).forEach((x) => reasonIssues.push(`${D}: ${first(R[x.researcher].name)} → ${S[x.station].name} for "${REASONS.find((y) => y.id === x.reason)!.label}" needed ${NEEDS[x.reason]}`));
    const unplacedReasons = R.filter((_, i) => dd.placement[i] !== null && !dd.reasons.some((x) => x.researcher === i));
    unplacedReasons.forEach((r) => reasonIssues.push(`${D}: ${first(r.name)} placed without a reason`));
    if (!dd.reasons.length) reasonIssues.push(`${D}: no one was assigned`);
    if (dd.purchases.length < dd.requestsAvailable) exploreIssues.push(`${D}: used ${dd.purchases.length} of ${dd.requestsAvailable} requests`);
    const goalKinds = goal === 'researcher' ? ['pref', 'feeling'] : goal === 'workstation' ? ['need', 'coverage', 'skill'] : null;
    if (goalKinds) dd.purchases.filter((p) => !goalKinds.includes(p.kind)).forEach((p) => exploreIssues.push(`${D}: "${p.kind}" question didn't serve today's goal`));
    if (per[d].consistency < 100) consistencyIssues.push(`${D}: your reply to the follow-up request didn't match the policy you gave in the first swap request`);
    if (dd.seconds > CONFIG.sflIsland.perDayBudgetSec) timeIssues.push(`${D}: ${(dd.seconds / 60).toFixed(1)} min`);
  }
  const breakdown = [
    line('product', 0.4, 'Placements', avg('placement'),
      placementIssues.length ? listSome(placementIssues, 4) : 'Every day\'s placement met its goal.',
      `${placementFixes.length ? `Best placements: ${listSome(placementFixes, 3)}. ` : ''}On Day 1 ask researchers where they want to be; on Day 2 ask stations what they need; on Day 3 do both.`),
    line('product', 0.35, 'Support replies', avg('support'),
      supportIssues.length ? listSome(supportIssues, 4) : 'Every reply served the day\'s goal.',
      `Pick the reply that serves today's goal (Day 1 researcher, Day 2 workstation, Day 3 the balanced one). Best replies you missed: ${listSome(supportFixes, 3)}`),
    line('product', 0.25, 'Reflect ratings', avg('reflect'),
      reflectIssues.length ? listSome(reflectIssues, 4) : 'Every rating matched your evidence.',
      'Rate only people you have evidence on (you asked how they feel, or they said something in Support — it shows in Notes). Everyone else: "I don\'t know".'),
    line('process', 0.35, 'Evidence-backed reasons', avg('reasons'),
      reasonIssues.length ? listSome(reasonIssues, 4) : 'Every move had a supported reason.',
      'Choose the reason that matches an answer you bought today. With few requests, buy the answer first, then cite exactly that.'),
    line('process', 0.2, 'Explore use', avg('explore'),
      exploreIssues.length ? listSome(exploreIssues, 4) : 'All requests used, all on today\'s goal.',
      'Spend every request, and only on today\'s goal: Day 1 researcher preferences, Day 2 station needs and coverage, Day 3 a mix.'),
    line('process', 0.15, 'Consistency', avg('consistency'),
      consistencyIssues.length ? listSome(consistencyIssues) : 'You gave the same policy whenever a request came back.',
      'When someone asks for what you allowed (or refused) someone else earlier, give the same answer.'),
    line('process', 0.2, 'Time per day', avg('time'),
      timeIssues.length ? `Over the ${CONFIG.sflIsland.perDayBudgetSec / 60}-min daily budget: ${timeIssues.join(', ')}.${days.length < nDays ? ` Only ${days.length} of ${nDays} days finished.` : ''}` : days.length < nDays ? `Only ${days.length} of ${nDays} days finished.` : 'Every day within budget.',
      `Keep onboarding to ~3 min and each day to ~${CONFIG.sflIsland.perDayBudgetSec / 60} min. Unfinished days score zero.`),
    calmLine(0.1, calmRes.cpm, calm),
  ];

  return {
    breakdown,
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
