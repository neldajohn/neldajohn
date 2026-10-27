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
import { generateClassic, PRIORITIES, resolveDecision, type ClassicDecision, type ClassicScenario } from '../games/sfl/classic';
import {
  answerText,
  cueFor,
  DAY_GOALS,
  generateIsland,
  GOAL_TEXT,
  LEVELS,
  questionsFor,
  REASONS,
  reasonSupported,
  type IslandScenario,
  type Level,
  type Purchase,
  type QuestionKind,
  type Rating,
  type Reason,
  type SupportRequest,
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
  | 'sfl-reflect'
  | 'sfl-classic';

export interface DrillMeta {
  id: DrillId;
  game: 'Sea Wolf' | 'Red Rock' | 'SFL Island' | 'SFL Classic';
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
  { id: 'sfl-explore', game: 'SFL Island', title: 'Explore: what to ask', blurb: 'Spend one Explore Request on the question today’s goal needs.' },
  { id: 'sfl-reasons', game: 'SFL Island', title: 'Assignment reasons', blurb: 'Which reason do your notes actually support?' },
  { id: 'sfl-support', game: 'SFL Island', title: 'Support replies', blurb: 'Several replies sound fine — pick the one that serves today’s goal.' },
  { id: 'sfl-reflect', game: 'SFL Island', title: 'Reflect ratings', blurb: 'Rate a researcher from evidence, or say “I don’t know”.' },
  { id: 'sfl-classic', game: 'SFL Classic', title: 'Decisions', blurb: 'Programme dilemmas under a mandate: pick the strongest option.' },
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

// ---------------------------------------------------------------- SFL Island

export interface ExploreItem {
  sc: IslandScenario;
  day: number;
  notes: Purchase[];
  options: { target: string; kind: QuestionKind; label: string; why: string }[];
  correct: number;
}

/** Days 1–2 only: on Day 3 every question type is defensible, so there is no single best buy. */
export function makeExploreItem(seed: string): ExploreItem {
  const rng = makeRng(`${seed}::explore`);
  const sc = generateIsland(seed);
  const day = rng.int(0, 1);
  const [ra, rb, rc] = rng.sample(sc.researchers, 3);
  const [sa, sb] = rng.sample(sc.stations, 2);
  const q = (isR: boolean, kind: QuestionKind) => questionsFor(isR, day).find((x) => x.kind === kind)!.text;
  const opt = (target: { id: string; name: string }, isR: boolean, kind: QuestionKind, why: string) => ({ target: target.id, kind, label: `Ask ${target.name}: “${q(isR, kind)}”`, why });
  // One already-asked target sits in the options: a second question to them is not allowed today.
  const asked = day === 0 ? rb : sb;
  const notes: Purchase[] = [{ day, target: asked.id, kind: day === 0 ? 'pref' : 'need', answer: answerText(sc, day, asked.id, day === 0 ? 'pref' : 'need') }];
  const options =
    day === 0
      ? [
          opt(ra, true, 'pref', 'Day 1 is about researcher needs — a preference is exactly what you need to place them, and it backs a “preference” reason.'),
          opt(rb, true, 'skill', `You already asked ${rb.name} a question today; only one question per person per day.`),
          opt(sa, false, 'need', 'Workstation needs are Day 2’s goal; on Day 1 this does not help you meet researcher needs.'),
          opt(rc, true, 'skill', 'Skill matters for workstation needs (Day 2). Today’s goal is what researchers want.'),
        ]
      : [
          opt(sa, false, 'need', 'Day 2 is about workstation needs — the needed skill tells you who to send, and it backs a “workstation need” reason.'),
          opt(sb, false, 'coverage', `You already asked ${sb.name} a question today; only one question per workstation per day.`),
          opt(ra, true, 'pref', 'Preferences serve researcher needs (Day 1), not today’s goal.'),
          opt(rc, true, 'feeling', 'Feelings help with Reflect, but they don’t help you meet workstation needs.'),
        ];
  const order = rng.shuffle(options.map((_, i) => i));
  return { sc, day, notes, options: order.map((i) => options[i]), correct: order.indexOf(0) };
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
    // Buy 2–3 random answers (one per entity), then propose a move that at least one of them supports.
    const targets = rng.sample([...sc.researchers.map((r) => ({ id: r.id, isR: true })), ...sc.stations.map((s) => ({ id: s.id, isR: false }))], rng.int(2, 3));
    const notes: Purchase[] = targets.map((t) => {
      const kinds: QuestionKind[] = t.isR ? ['pref', 'skill'] : ['need', 'coverage'];
      const kind = rng.pick(kinds);
      return { day, target: t.id, kind, answer: answerText(sc, day, t.id, kind) };
    });
    const researcher = rng.int(0, sc.researchers.length - 1);
    const station = rng.int(0, sc.stations.length - 1);
    const supported = REASONS.map((r) => r.id).filter((r) => reasonSupported(sc, day, notes, researcher, station, r));
    if (supported.length && supported.length < REASONS.length) return { sc, day, notes, researcher, station, supported };
  }
}

export interface SupportItem {
  sc: IslandScenario;
  day: number;
  request: SupportRequest;
  earlier?: { who: string; said: string };
}

export function makeSupportItem(seed: string): SupportItem {
  const rng = makeRng(`${seed}::support`);
  const sc = generateIsland(seed);
  const day = rng.int(0, 2);
  const reqs = sc.support[day];
  const request = rng.pick(reqs);
  const src = request.linkedTo ? reqs.find((r) => r.id === request.linkedTo) : undefined;
  const earlier = src ? { who: sc.researchers.find((r) => r.id === src.from)!.name, said: src.options.find((o) => o.serves === DAY_GOALS[day])!.text } : undefined;
  return { sc, day, request, earlier };
}

export const supportCorrect = (it: SupportItem, idx: number) => it.request.options[idx].serves === DAY_GOALS[it.day];

export const SERVES_TEXT: Record<string, string> = {
  researcher: 'puts the researcher first',
  workstation: 'puts the workstation first',
  balance: 'balances both',
  none: 'avoids deciding',
};

export interface ReflectItem {
  sc: IslandScenario;
  day: number;
  researcher: number;
  notes: { who: string; text: string }[];
  evidence: 'asked' | 'heard' | 'none';
  truth: Level;
  answer: Rating;
}

export function makeReflectItem(seed: string): ReflectItem {
  const rng = makeRng(`${seed}::reflect`);
  const sc = generateIsland(seed);
  const day = rng.int(0, 2);
  const researcher = rng.int(0, sc.researchers.length - 1);
  const r = sc.researchers[researcher];
  const evidence = rng.pick(['asked', 'heard', 'none'] as const);
  const others = rng.sample(sc.researchers.filter((x) => x.id !== r.id), 2);
  const notes = others.map((o) => ({ who: o.name, text: rng.chance(0.5) ? answerText(sc, day, o.id, 'pref') : `(said in Support) “${cueFor(day, o.feeling[day], rng)}”` }));
  if (evidence === 'asked') notes.push({ who: r.name, text: answerText(sc, day, r.id, 'feeling') });
  if (evidence === 'heard') notes.push({ who: r.name, text: `(said in Support) “${cueFor(day, r.feeling[day], rng)}”` });
  if (evidence === 'none' && rng.chance(0.5)) notes.push({ who: r.name, text: answerText(sc, day, r.id, 'pref') }); // a note about them that says nothing about feelings
  const truth = r.feeling[day];
  return { sc, day, researcher, notes: rng.shuffle(notes), evidence, truth, answer: evidence === 'none' ? 'unknown' : truth };
}

// ---------------------------------------------------------------- SFL Classic

export interface ClassicItem {
  sc: ClassicScenario;
  decision: ClassicDecision;
  best: number;
}

export function makeClassicItem(seed: string): ClassicItem {
  const rng = makeRng(`${seed}::classic`);
  const sc = generateClassic(seed);
  const idx = rng.int(0, sc.decisions.length - 1);
  const node = sc.decisions[idx];
  const tags = 'variants' in node ? { [node.branchOn]: rng.pick(Object.keys(node.variants)) } : {};
  const decision = resolveDecision(sc, idx, tags);
  const shuffled = { ...decision, options: rng.shuffle(decision.options) };
  const best = shuffled.options.reduce((b, o, i) => (o.q > shuffled.options[b].q ? i : b), 0);
  return { sc, decision: shuffled, best };
}

export const priorityText = (sc: ClassicScenario) => sc.idealRanking.map((p) => PRIORITIES[p]).join(' → ');
export { DAY_GOALS, GOAL_TEXT, LEVELS };
