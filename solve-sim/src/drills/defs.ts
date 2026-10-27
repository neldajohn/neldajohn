/**
 * Drill item generators and answer keys. Each drill is 10 quick tries on one skill, with
 * immediate feedback. Items reuse the real game generators so they look and behave the same.
 */
import { makeRng } from '../lib/rng';
import { checkNumeric, factLabel, generateCases, generateStudy, type Case, type Fact, type Question, type Study } from '../games/redrock/model';
import {
  bestTrio,
  correctCall,
  evaluate,
  fits,
  generateSeaWolf,
  initialPool,
  inRange,
  matchesLock,
  type Evaluation,
  type Microbe,
  type Scenario,
  type SortCall,
} from '../games/seawolf/model';
import {
  ARCHETYPE_TEXT,
  answerText,
  applyArchetype,
  clampState,
  consequenceText,
  DAY_GOALS,
  first,
  generateIsland,
  GOAL_TEXT,
  moveDelta,
  questionText,
  reactionText,
  REASONS,
  reasonSupported,
  relevantKinds,
  type IslandScenario,
  type Problem,
  type Purchase,
  type QuestionKind,
  type Rating,
  type Reason,
  type State,
} from '../games/sfl/island';

export const DRILL_LENGTH = 10;

export type DrillId =
  | 'sw-sort'
  | 'sw-lock'
  | 'sw-keep'
  | 'sw-final'
  | 'rr-data'
  | 'rr-analysis'
  | 'rr-cases'
  | 'sfl-explore'
  | 'sfl-reasons'
  | 'sfl-support'
  | 'sfl-order'
  | 'sfl-reflect';

export interface DrillMeta {
  id: DrillId;
  game: 'Sea Wolf' | 'Red Rock' | 'Sustainable Futures Lab';
  title: string;
  blurb: string;
}

export const DRILLS: DrillMeta[] = [
  { id: 'sw-sort', game: 'Sea Wolf', title: 'Sorting calls', blurb: 'One microbe at a time: current site, next site or return pool?' },
  { id: 'sw-lock', game: 'Sea Wolf', title: 'Locking', blurb: 'Pick the two characteristics worth locking for a site.' },
  { id: 'sw-keep', game: 'Sea Wolf', title: 'Keep one of three', blurb: 'An offer round: which microbe does your pool need most?' },
  { id: 'sw-final', game: 'Sea Wolf', title: 'Final treatment', blurb: 'Pick the best trio from a pool of ten.' },
  { id: 'rr-data', game: 'Red Rock', title: 'Spot the data', blurb: 'Read a study and collect only the values the objective needs.' },
  { id: 'rr-analysis', game: 'Red Rock', title: 'Analysis maths', blurb: 'Shares, growth, CAGR, cost per unit, projections — to 2 decimals.' },
  { id: 'rr-cases', game: 'Red Rock', title: 'Cases', blurb: 'Word problems, formulas, true/false/can’t tell, charts, probability.' },
  { id: 'sfl-explore', game: 'Sustainable Futures Lab', title: 'Explore: what to ask', blurb: 'Spend a request on what today’s goal needs — and spot the wasted questions.' },
  { id: 'sfl-reasons', game: 'Sustainable Futures Lab', title: 'Assignment reasons', blurb: 'Which reason do your notes actually back up?' },
  { id: 'sfl-support', game: 'Sustainable Futures Lab', title: 'Support replies', blurb: 'Find the middle path; learn to spot postpone, force, give in and take over.' },
  { id: 'sfl-order', game: 'Sustainable Futures Lab', title: 'Support order', blurb: 'Three problems arrive at once: handle them by deadline.' },
  { id: 'sfl-reflect', game: 'Sustainable Futures Lab', title: 'Reflect ratings', blurb: 'Rate from the latest thing you saw — or say “I don’t know”.' },
];

// ---------------------------------------------------------------- Sea Wolf

export interface SortItem {
  sc: Scenario;
  siteIdx: number;
  microbe: Microbe;
  answer: SortCall;
}

export function makeSortItem(seed: string, variant: 'default' | 'alt', hard: boolean): SortItem {
  const rng = makeRng(`${seed}::sort`);
  const sc = generateSeaWolf(seed, variant, hard);
  const sites = sc.sites.map((d) => d.site);
  // Pick the answer first so the three calls come up about equally often.
  const want = rng.pick(['current', 'next', 'return'] as SortCall[]);
  const siteIdx = want === 'next' ? rng.int(0, sites.length - 2) : rng.int(0, sites.length - 1);
  const pool = sc.sites.flatMap((d) => [...d.queue, ...d.population, ...d.reserve]);
  const cands = pool.filter((m) => correctCall(m, sites, siteIdx) === want);
  const microbe = cands.length ? rng.pick(cands) : rng.pick(pool);
  return { sc, siteIdx, microbe, answer: correctCall(microbe, sites, siteIdx) };
}

export function explainSort(it: SortItem): string[] {
  const site = it.sc.sites[it.siteIdx].site;
  const next = it.sc.sites[it.siteIdx + 1]?.site;
  const need = Math.ceil((2 * site.ranges.length) / 3);
  const inCount = site.ranges.filter((r, k) => inRange(it.microbe.attrs[k], r)).length;
  const lines = site.ranges.map((r, k) => `${it.sc.attrNames[k]} ${it.microbe.attrs[k]} vs ${r[0]}–${r[1]}: ${inRange(it.microbe.attrs[k], r) ? 'in range' : 'out'}`);
  lines.push(`${inCount} of ${site.ranges.length} in range (needs ${need}).`);
  lines.push(it.microbe.traits.includes(site.undesired) ? `Has the undesired trait (${it.sc.traitNames[site.undesired]}), so it can’t be a current-site fit.` : 'No undesired trait for this site.');
  if (fits(it.microbe, site)) lines.push('→ Fits this site: Current site.');
  else if (next) lines.push(it.microbe.traits.includes(next.desired) ? `→ Not a fit here, but it has the next site’s desired trait (${it.sc.traitNames[next.desired]}): Next site.` : `→ Not a fit here, and it lacks the next site’s desired trait (${it.sc.traitNames[next.desired]}): Return pool.`);
  else lines.push('→ Not a fit and this is the last site: Return pool.');
  return lines;
}

export interface LockItem {
  sc: Scenario;
  siteIdx: number;
  keys: string[];
  labels: string[];
  counts: number[];
  bestSum: number;
}

export function makeLockItem(seed: string, variant: 'default' | 'alt', hard: boolean): LockItem {
  const rng = makeRng(`${seed}::lock`);
  const sc = generateSeaWolf(seed, variant, hard);
  const siteIdx = rng.int(0, sc.sites.length - 1);
  const d = sc.sites[siteIdx];
  const site = d.site;
  const keys = [...site.ranges.map((_, k) => `attr:${k}`), 'desired', 'undesired'];
  const labels = [...site.ranges.map((r, k) => `${sc.attrNames[k]} in ${r[0]}–${r[1]}`), `Has ${sc.traitNames[site.desired]}`, `Not ${sc.traitNames[site.undesired]}`];
  const counts = keys.map((k) => d.population.filter((m) => matchesLock(m, site, k)).length);
  let bestSum = Infinity;
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) bestSum = Math.min(bestSum, counts[i] + counts[j]);
  return { sc, siteIdx, keys, labels, counts, bestSum };
}

/** Locks are worth most on the characteristics fewest candidates have: the lock does the searching for you. */
export function gradeLock(it: LockItem, picks: string[]): { correct: boolean; score: number } {
  const sum = picks.reduce((a, k) => a + it.counts[it.keys.indexOf(k)], 0);
  return { correct: sum === it.bestSum, score: it.bestSum / Math.max(sum, 1) };
}

export interface KeepItem {
  sc: Scenario;
  siteIdx: number;
  pool: Microbe[];
  offer: Microbe[];
  /** Best trio score reachable if you keep each offered microbe. */
  scores: number[];
  trios: string[][];
}

export function makeKeepItem(seed: string, variant: 'default' | 'alt', hard: boolean): KeepItem {
  for (let attempt = 0; ; attempt++) {
    const rng = makeRng(`${seed}::keep${attempt}`);
    const sc = generateSeaWolf(`${seed}-${attempt}`, variant, hard);
    const siteIdx = rng.int(0, sc.sites.length - 1);
    const d = sc.sites[siteIdx];
    const keys = [...d.site.ranges.map((_, k) => `attr:${k}`), 'desired', 'undesired'];
    const pool = [...initialPool(d, rng.sample(keys, 2))];
    const rest = [...d.reserve, ...d.queue].filter((m) => !pool.some((p) => p.id === m.id));
    pool.push(...rng.sample(rest, rng.int(0, 3)));
    const offer = rng.sample(rest.filter((m) => !pool.some((p) => p.id === m.id)), 3);
    const results = offer.map((o) => bestTrio([...pool, o], d.site, sc.attrNames, sc.traitNames));
    const scores = results.map((r) => r.score);
    // Only keep rounds where the choice matters.
    if (Math.max(...scores) > Math.min(...scores) || attempt > 30) return { sc, siteIdx, pool, offer, scores, trios: results.map((r) => r.trio) };
  }
}

export interface FinalItem {
  sc: Scenario;
  siteIdx: number;
  pool: Microbe[];
  best: Evaluation & { trio: string[] };
}

export function makeFinalItem(seed: string, variant: 'default' | 'alt', hard: boolean): FinalItem {
  const rng = makeRng(`${seed}::final`);
  const sc = generateSeaWolf(seed, variant, hard);
  const siteIdx = rng.int(0, sc.sites.length - 1);
  const d = sc.sites[siteIdx];
  const all = [...d.population, ...d.queue, ...d.reserve];
  const planted = all.filter((m) => d.planted.includes(m.id));
  const others = rng.sample(all.filter((m) => !d.planted.includes(m.id)), 10 - planted.length);
  const pool = rng.shuffle([...planted, ...others]);
  return { sc, siteIdx, pool, best: bestTrio(pool, d.site, sc.attrNames, sc.traitNames) };
}

export function gradeFinal(it: FinalItem, ids: string[]) {
  const d = it.sc.sites[it.siteIdx];
  const ev = evaluate(it.pool.filter((m) => ids.includes(m.id)), d.site, it.sc.attrNames, it.sc.traitNames);
  return { ev, correct: ev.score >= it.best.score, score: it.best.score ? ev.score / it.best.score : 1 };
}

// ---------------------------------------------------------------- Red Rock

export function makeDataItem(seed: string): Study {
  return generateStudy(seed);
}

export function gradeData(study: Study, saved: string[]) {
  const req = new Set(study.requiredFacts);
  const hits = saved.filter((id) => req.has(id));
  const noise = saved.filter((id) => !req.has(id));
  const missed = study.requiredFacts.filter((id) => !saved.includes(id));
  const label = (id: string) => `${factLabel(study.facts[id])} = ${study.facts[id].value}`;
  return {
    correct: missed.length === 0 && noise.length === 0,
    score: hits.length / (req.size + noise.length),
    hits: hits.map(label),
    missed: missed.map(label),
    noise: noise.map(label),
  };
}

export interface AnalysisItem {
  study: Study;
  question: Question;
  facts: Fact[];
}

export function makeAnalysisItem(seed: string): AnalysisItem {
  const rng = makeRng(`${seed}::analysis`);
  const study = generateStudy(seed);
  return { study, question: rng.pick(study.questions), facts: study.requiredFacts.map((id) => study.facts[id]) };
}

export const gradeAnalysis = (it: AnalysisItem, value: number | null) => checkNumeric(value, it.question.answer);

export function makeCaseItem(seed: string): Case {
  const rng = makeRng(`${seed}::case`);
  return rng.pick(generateCases(seed));
}

// ---------------------------------------------------------------- Sustainable Futures Lab

export interface ExploreItem {
  sc: IslandScenario;
  day: number;
  notes: { day: number; who: string; text: string }[];
  options: { label: string; why: string }[];
  correct: number;
}

const nameOfId = (sc: IslandScenario, id: string) => sc.researchers.find((r) => r.id === id)?.name ?? sc.stations.find((s) => s.id === id)?.name ?? id;
const ask = (sc: IslandScenario, id: string, kind: QuestionKind) => `Ask ${nameOfId(sc, id)}: “${questionText(kind)}”`;

/** One genuinely useful question among three traps: already asked today, out in the field, or already known / off-goal. */
export function makeExploreItem(seed: string): ExploreItem {
  const rng = makeRng(`${seed}::explore`);
  const sc = generateIsland(seed);
  const day = rng.int(0, 2);
  const R = sc.researchers;
  const S = sc.stations;
  const notes: ExploreItem['notes'] = [];
  const avail = R.filter((r) => r.unavailable !== day);
  const [askedSt, goodSt] = rng.sample(S, 2);
  notes.push({ day, who: askedSt.name, text: answerText(sc, day, askedSt.id, 'need') });
  let correct: { label: string; why: string };
  let known: (typeof R)[number] | undefined;
  if (day > 0) {
    known = rng.pick(avail);
    notes.push({ day: 0, who: known.name, text: answerText(sc, 0, known.id, 'strength') });
  }
  if (DAY_GOALS[day] === 'people' || (DAY_GOALS[day] === 'balance' && rng.chance(0.5))) {
    const target = rng.pick(avail.filter((r) => r.id !== known?.id));
    correct = { label: ask(sc, target.id, 'strength'), why: `${GOAL_TEXT[DAY_GOALS[day]]}: where ${first(target.name)} contributes most is exactly what you need, and it backs a “where they contribute most” move.` };
  } else {
    correct = { label: ask(sc, goodSt.id, 'need'), why: `${GOAL_TEXT[DAY_GOALS[day]]}: what this station needs today tells you who to send, and it backs a “matches what the station needs” move.` };
  }
  const traps: { label: string; why: string }[] = [
    { label: ask(sc, askedSt.id, 'srisk'), why: `You already asked the ${askedSt.name} today — each station answers one question a day.` },
  ];
  const off = R.find((r) => r.unavailable === day);
  if (off) traps.push({ label: ask(sc, off.id, 'mood'), why: `${off.name} is out at the field site today and can’t be asked.` });
  if (known) traps.push({ label: ask(sc, known.id, 'strength'), why: `You already know where ${first(known.name)} contributes most (Day 1 notes) — that doesn’t change, so asking again wastes a request.` });
  if (DAY_GOALS[day] === 'people') {
    traps.push({ label: ask(sc, goodSt.id, 'srisk'), why: 'Station risks serve Day 2’s goal. Today is about the people.' });
    const w = rng.pick(avail.filter((x) => !correct.label.includes(x.name)));
    traps.push({ label: ask(sc, w.id, 'risk'), why: 'A question about the work, not the person. On Day 1 the goal is to understand the people.' });
  }
  if (DAY_GOALS[day] === 'stations') {
    const r = rng.pick(avail.filter((x) => x.id !== known?.id));
    traps.push({ label: ask(sc, r.id, 'strength'), why: 'Where people contribute most serves Day 1’s goal. Today is about covering the stations.' });
  }
  const options = rng.shuffle([correct, ...traps.slice(0, 3)]);
  return { sc, day, notes, options, correct: options.indexOf(correct) };
}

export interface ReasonItem {
  sc: IslandScenario;
  day: number;
  notes: Purchase[];
  researcher: number;
  station: number;
  supported: Reason[];
}

export function makeReasonItem(seed: string): ReasonItem {
  const rng = makeRng(`${seed}::reasons`);
  const sc = generateIsland(seed);
  const day = rng.int(0, 2);
  for (;;) {
    const notes: Purchase[] = [];
    // Strength answers may come from earlier days (they stay true); station answers only count today.
    rng.sample(sc.researchers, rng.int(1, 2)).forEach((r) => {
      const d = rng.int(0, day);
      notes.push({ day: d, target: r.id, kind: 'strength', answer: answerText(sc, d, r.id, 'strength') });
    });
    rng.sample(sc.stations, rng.int(1, 2)).forEach((s) => {
      const d = rng.chance(0.75) ? day : Math.max(0, day - 1);
      const kind = rng.pick(['need', 'srisk'] as QuestionKind[]);
      notes.push({ day: d, target: s.id, kind, answer: answerText(sc, d, s.id, kind) });
    });
    const researcher = rng.int(0, 3);
    const station = rng.int(0, 3);
    const supported = REASONS.map((r) => r.id).filter((r) => reasonSupported(sc, day, notes, researcher, station, r));
    if (supported.length && supported.length < REASONS.length) return { sc, day, notes, researcher, station, supported };
  }
}

export interface SupportItem {
  sc: IslandScenario;
  day: number;
  problem: Problem;
}

export function makeSupportItem(seed: string): SupportItem {
  const rng = makeRng(`${seed}::support`);
  const sc = generateIsland(seed);
  const day = rng.int(0, 2);
  return { sc, day, problem: rng.pick(sc.problems[day]) };
}
export const supportCorrect = (it: SupportItem, idx: number) => it.problem.options[idx].archetype === 'middle';
export { ARCHETYPE_TEXT };

export interface OrderItem {
  sc: IslandScenario;
  day: number;
  problems: Problem[];
  ideal: string[];
}

export function makeOrderItem(seed: string): OrderItem {
  const rng = makeRng(`${seed}::order`);
  const sc = generateIsland(seed);
  const day = rng.int(0, 2);
  const problems = rng.shuffle(sc.problems[day]);
  return { sc, day, problems, ideal: [...problems].sort((a, b) => a.deadlineRank - b.deadlineRank).map((p) => p.id) };
}

export interface ReflectItem {
  sc: IslandScenario;
  day: number;
  researcher: number;
  notes: { who: string; text: string; source: string }[];
  answer: Rating;
  why: string;
}

/** Rate from the latest observation today; older days and other people don't count. */
export function makeReflectItem(seed: string): ReflectItem {
  const rng = makeRng(`${seed}::reflect`);
  const sc = generateIsland(seed);
  const day = rng.int(0, 2);
  const ri = rng.int(0, 3);
  const r = sc.researchers[ri];
  let state: State = clampState(rng.int(0, 2));
  const notes: ReflectItem['notes'] = [];
  let latest: State | null = null;
  let why = '';
  const others = sc.researchers.filter((x) => x.id !== r.id);
  const o = rng.pick(others);
  notes.push({ who: o.name, text: answerText(sc, day, o.id, 'mood', clampState(rng.int(0, 2)), rng), source: 'answered' });
  if (day > 0 && rng.chance(0.5)) notes.unshift({ who: `${r.name} (yesterday)`, text: `“${rng.pick(['Great day, really productive.', 'Rough day, honestly.'])}”`, source: 'answered yesterday' });
  if (rng.chance(0.6)) {
    notes.push({ who: r.name, text: answerText(sc, day, r.id, 'mood', state, rng), source: 'answered this morning' });
    latest = state;
    why = 'their answer this morning';
  }
  if (rng.chance(0.5)) {
    const to = rng.pick([0, 1, 2, 3].filter((s) => s !== r.home));
    const delta = moveDelta(r, r.home, to);
    state = clampState(state + delta);
    notes.push({ who: r.name, text: reactionText(to, state, sc, delta), source: 'on being moved' });
    latest = state;
    why = 'how they reacted when you moved them';
  }
  if (rng.chance(0.5)) {
    const p = { ...rng.pick(sc.problems[day]), from: ri };
    const a = rng.pick(['middle', 'postpone', 'force', 'giveIn', 'decideForThem'] as const);
    state = applyArchetype(state, a);
    notes.push({ who: r.name, text: consequenceText(sc, p, a, state), source: 'after support' });
    latest = state;
    why = 'how their problem ended — the latest thing you saw';
  }
  return { sc, day, researcher: ri, notes, answer: latest ?? 'unknown', why: latest === null ? 'Nothing in today’s notes says how they are — yesterday and other people don’t count.' : `The latest thing you saw today was ${why}.` };
}

export { DAY_GOALS, GOAL_TEXT, relevantKinds };
