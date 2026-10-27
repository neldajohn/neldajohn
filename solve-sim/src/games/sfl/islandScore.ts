import { CONFIG } from '../../config';
import { budgetScore, calmLine, calmness, combine, line, listSome, mean } from '../../lib/scoring';
import type { GameResult, TelemetryEvent } from '../../lib/types';
import {
  ARCHETYPE_QUALITY,
  ARCHETYPE_TEXT,
  DAY_GOALS,
  first,
  GOAL_TEXT,
  orderScore,
  placementScore,
  REASONS,
  ratingText,
  relevantKinds,
  type Archetype,
  type IslandScenario,
  type Purchase,
  type Rating,
  type Reason,
} from './island';

export interface DayRecord {
  day: number;
  purchases: Purchase[];
  moves: { researcher: number; from: number; to: number; reason: Reason; supported: boolean }[];
  /** Placement at the end of Assign. */
  placement: number[];
  /** Problem ids in the order you chose to handle them. */
  order: string[];
  choices: Record<string, Archetype>;
  ratings: Record<string, Rating>;
  /** What each rating should have been, given what you saw today. */
  expected: Record<string, Rating>;
  requestsAvailable: number;
  seconds: number;
}

export interface StageScores {
  explore: number;
  assign: number;
  support: number;
  reflect: number;
  time: number;
}

export function dayScores(sc: IslandScenario, d: DayRecord): StageScores {
  const rel = relevantKinds(d.day);
  const asked = d.purchases.length;
  const explore = asked ? 100 * (0.7 * (d.purchases.filter((p) => rel.includes(p.kind)).length / asked) + 0.3 * (d.purchases.some((p) => p.kind === 'mood') ? 1 : 0)) : 0;
  const best = sc.bestPlacement[d.day].score || 1;
  const place = d.placement.length ? placementScore(sc, d.day, d.placement) / best : 0;
  const reasons = d.moves.length ? d.moves.filter((m) => m.supported).length / d.moves.length : 1;
  const assign = d.placement.length ? 100 * (0.6 * place + 0.4 * reasons) : 0;
  const probs = sc.problems[d.day];
  const quality = mean(probs.map((p) => (d.choices[p.id] ? ARCHETYPE_QUALITY[d.choices[p.id]] : 0)));
  const ideal = [...probs].sort((a, b) => a.deadlineRank - b.deadlineRank).map((p) => p.id);
  const order = d.order.length ? orderScore(d.order, ideal) : 0;
  const support = 100 * (0.7 * quality + 0.3 * order);
  const reflect = 100 * mean(sc.researchers.map((r) => (d.ratings[r.id] !== undefined && d.ratings[r.id] === d.expected[r.id] ? 1 : 0)));
  return { explore, assign, support, reflect, time: budgetScore(d.seconds, CONFIG.sflIsland.perDayBudgetSec) };
}

export function supportPattern(days: DayRecord[]): { counts: Partial<Record<Archetype, number>>; drift: Archetype | null } {
  const counts: Partial<Record<Archetype, number>> = {};
  days.forEach((d) => Object.values(d.choices).forEach((a) => (counts[a] = (counts[a] ?? 0) + 1)));
  const off = Object.entries(counts).filter(([a]) => a !== 'middle') as [Archetype, number][];
  off.sort((a, b) => b[1] - a[1]);
  return { counts, drift: off.length && off[0][1] >= 2 ? off[0][0] : null };
}

const DRIFT_FIX: Record<Archetype, string> = {
  middle: '',
  postpone: 'You tend to postpone. When there’s a deadline, move forward with what you have and leave room to correct course.',
  force: 'You tend to force. Bring the people involved in before deciding; decide with them, not over them.',
  giveIn: 'You tend to give in. Avoiding friction leaves the real issue open — address it, kindly.',
  decideForThem: 'You tend to take over. Options that help the person solve it themselves are stronger.',
  loseFocus: 'You tend to lose focus. Stick to the problem in front of you and its deadline.',
};

export function scoreIsland(sc: IslandScenario, opening: string[] | null, days: DayRecord[], events: TelemetryEvent[], timedOut: boolean, openingSec: number): GameResult {
  const nDays = CONFIG.sflIsland.days;
  const per = Array.from({ length: nDays }, (_, i) => (days[i] ? dayScores(sc, days[i]) : { explore: 0, assign: 0, support: 0, reflect: 0, time: 0 }));
  const avg = (k: keyof StageScores) => mean(per.map((p) => p[k]));
  const openingScore = opening ? 100 * orderScore(opening, sc.openingIdeal) : 0;
  const product = Math.round(0.05 * openingScore + 0.2 * avg('explore') + 0.3 * avg('assign') + 0.25 * avg('support') + 0.2 * avg('reflect'));
  const totalSec = openingSec + days.reduce((a, d) => a + d.seconds, 0);
  const calmRes = calmness(events, totalSec || 1);
  const completion = (100 * days.length) / nDays;
  const process = Math.round(0.6 * avg('time') + 0.2 * completion + 0.2 * calmRes.score);
  const pattern = supportPattern(days);

  // ---- reasons and fixes, per stage
  const R = sc.researchers;
  const S = sc.stations;
  const D = (d: number) => `Day ${d + 1}`;
  const exploreIssues: string[] = [];
  const assignIssues: string[] = [];
  const supportIssues: string[] = [];
  const reflectIssues: string[] = [];
  const timeIssues: string[] = [];
  const bestText: string[] = [];
  const orderFix: string[] = [];
  const nameOf = (id: string) => R.find((r) => r.id === id)?.name ?? S.find((s) => s.id === id)?.name ?? id;
  for (let d = 0; d < nDays; d++) {
    const rec = days[d];
    if (!rec) {
      exploreIssues.push(`${D(d)} not reached`);
      continue;
    }
    const rel = relevantKinds(d);
    rec.purchases.filter((p) => !rel.includes(p.kind) && p.kind !== 'mood').forEach((p) => exploreIssues.push(`${D(d)}: asked ${nameOf(p.target)} a question that doesn’t serve “${GOAL_TEXT[DAY_GOALS[d]]}”`));
    if (!rec.purchases.some((p) => p.kind === 'mood')) exploreIssues.push(`${D(d)}: you never asked anyone how they were doing`);
    if (rec.purchases.length < rec.requestsAvailable) exploreIssues.push(`${D(d)}: used ${rec.purchases.length} of ${rec.requestsAvailable} requests`);

    const bp = sc.bestPlacement[d];
    const got = placementScore(sc, d, rec.placement);
    if (got < bp.score) {
      assignIssues.push(`${D(d)}: placement reached ${Math.round((100 * got) / (bp.score || 1))}% of what was possible`);
      bestText.push(`${D(d)}: ${R.map((r, i) => `${first(r.name)} → ${S[bp.placement[i]].name}`).join(', ')}`);
    }
    rec.moves.filter((m) => !m.supported).forEach((m) => {
      const why = REASONS.find((x) => x.id === m.reason)!;
      assignIssues.push(`${D(d)}: moved ${first(R[m.researcher].name)} to the ${S[m.to].name} for “${why.label}” without the evidence — it needs ${why.needs}`);
    });

    const probs = sc.problems[d];
    const ideal = [...probs].sort((a, b) => a.deadlineRank - b.deadlineRank);
    if (rec.order.length && rec.order.join() !== ideal.map((p) => p.id).join()) {
      supportIssues.push(`${D(d)}: handled problems out of deadline order`);
      orderFix.push(`${D(d)}: ${ideal.map((p) => `${first(R[p.from].name)} (${p.deadline})`).join(' → ')}`);
    }
    probs.forEach((p) => {
      const a = rec.choices[p.id];
      if (!a) supportIssues.push(`${D(d)}: ${first(R[p.from].name)}’s problem not answered`);
      else if (a !== 'middle') supportIssues.push(`${D(d)}: to ${first(R[p.from].name)} you chose a reply that ${ARCHETYPE_TEXT[a].split(' — ')[1]}`);
    });

    R.forEach((r) => {
      const g = rec.ratings[r.id];
      const e = rec.expected[r.id];
      if (g === e) return;
      reflectIssues.push(
        e === 'unknown'
          ? `${D(d)}: rated ${first(r.name)} “${g === undefined ? 'nothing' : ratingText(g)}” with nothing in your notes about them today — should be “I don’t know”`
          : `${D(d)}: rated ${first(r.name)} “${g === undefined ? 'nothing' : ratingText(g)}”, but the last thing you saw showed ${ratingText(e).toLowerCase()}`,
      );
    });
    if (rec.seconds > CONFIG.sflIsland.perDayBudgetSec) timeIssues.push(`${D(d)} took ${(rec.seconds / 60).toFixed(1)} min`);
  }

  const breakdown = [
    line('product', 0.05, 'Opening questions', openingScore,
      opening ? `You ranked: ${opening.map((id) => sc.opening.find((q) => q.id === id)!.text).join(' → ')}` : 'Not completed.',
      `Ask what drives every later decision first: ${sc.openingIdeal.slice(0, 4).map((id) => `“${sc.opening.find((q) => q.id === id)!.text}”`).join(', ')}. Budget and lodging don’t change anything.`),
    line('product', 0.2, 'Explore', avg('explore'),
      exploreIssues.length ? listSome(exploreIssues, 4) : 'Every request served the day’s goal, and you checked on people.',
      'Read the day’s goal before spending a request. Day 1: ask people where they contribute most. Day 2: ask stations what they need and what could go wrong. Day 3: both. Always spend one request on how someone is doing — you need it for Reflect.'),
    line('product', 0.3, 'Assign', avg('assign'),
      assignIssues.length ? listSome(assignIssues, 4) : 'Placements served each day’s goal, and every move had evidence behind it.',
      `${bestText.length ? `Best placements: ${listSome(bestText, 3)}. ` : ''}Only move someone when your notes back the reason; otherwise leave them where they are.`),
    line('product', 0.25, 'Support', avg('support'),
      supportIssues.length ? listSome(supportIssues, 4) : 'Middle-path answers, in deadline order, every day.',
      `${orderFix.length ? `Deadline order: ${listSome(orderFix, 3)}. ` : ''}${pattern.drift ? DRIFT_FIX[pattern.drift] + ' ' : ''}Pick the reply that moves forward with what you have, leaves room to correct, and lets the person own it.`),
    line('product', 0.2, 'Reflect', avg('reflect'),
      reflectIssues.length ? listSome(reflectIssues, 4) : 'Every rating matched what you had seen.',
      'Rate from the latest thing you saw today — the support consequence beats the assignment reaction, which beats the morning answer. No observation today means “I don’t know”.'),
    line('process', 0.6, 'Time per day', avg('time'),
      timeIssues.length ? `Over the ${CONFIG.sflIsland.perDayBudgetSec / 60}-minute daily budget: ${timeIssues.join(', ')}.` : days.length ? 'Every day within budget.' : 'No day completed.',
      `About ${CONFIG.sflIsland.perDayBudgetSec / 60} minutes a day. If Day 1 runs long you are spending Day 3’s time. Don’t reread options hunting for a perfect one.`),
    line('process', 0.2, 'Completion', completion, `Finished ${days.length} of ${nDays} days.`, 'Unfinished days score zero on every stage. Keep moving.'),
    calmLine(0.2, calmRes.cpm, calmRes.score),
  ];

  let habit = 'Strong run. Keep reading the day’s goal first and rating only what you saw.';
  if (days.length < nDays) habit = `Pace: you finished ${days.length}/3 days. Keep each day to ~10 minutes.`;
  else if (pattern.drift) habit = DRIFT_FIX[pattern.drift];
  else if (avg('reflect') < 70) habit = 'Reflect from your notes: the latest thing you saw about each person, or “I don’t know”.';
  else if (avg('explore') < 70) habit = 'Explore: let the day’s goal choose your questions, and always check on how someone is doing.';

  return {
    game: 'sflIsland',
    product,
    process,
    score: combine(product, process),
    timeSpentSec: totalSec,
    timedOut,
    habit,
    breakdown,
    details: {
      perDay: per.map((p, i) => ({ day: i + 1, goal: GOAL_TEXT[DAY_GOALS[i]], ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Math.round(v)])) })),
      stages: { opening: Math.round(openingScore), explore: Math.round(avg('explore')), assign: Math.round(avg('assign')), support: Math.round(avg('support')), reflect: Math.round(avg('reflect')) },
      pattern: Object.fromEntries(Object.entries(pattern.counts).map(([a, n]) => [ARCHETYPE_TEXT[a as Archetype].split(' — ')[0], n])),
      drift: pattern.drift ? ARCHETYPE_TEXT[pattern.drift].split(' — ')[0] : null,
      truth: R.map((r) => ({ name: r.name, role: r.role, home: S[r.home].name, strength: S[r.strength].name })),
      stations: S.map((s) => ({ name: s.name, needs: s.need.map((n) => (n.people ? `${n.people} incl. ${n.role}` : 'none')) })),
    },
  };
}
