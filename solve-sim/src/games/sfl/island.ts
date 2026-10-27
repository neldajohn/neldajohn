/**
 * Sustainable Futures Lab (30-minute, three-day format), modelled on public prep guides:
 * 4 researchers (ecologist, biologist, habitat planner, engineer), 4 stations (water, plants,
 * animals, communications), 3 days × Explore → Assign → Support → Reflect.
 */
import { CONFIG } from '../../config';
import { makeRng, type Rng } from '../../lib/rng';

export const ROLES = ['Ecologist', 'Biologist', 'Habitat planner', 'Engineer'] as const;
export type Role = (typeof ROLES)[number];

export const STATION_DEFS = [
  { id: 'animals', name: 'Animal survey', description: 'Tracks birds and small mammals across the island.', home: 'Ecologist' as Role },
  { id: 'water', name: 'Water lab', description: 'Tests water quality in the lagoon and streams.', home: 'Biologist' as Role },
  { id: 'plants', name: 'Plant nursery', description: 'Grows native seedlings for the dune restoration.', home: 'Habitat planner' as Role },
  { id: 'comms', name: 'Communications desk', description: 'Keeps the sensors online and reports to the island council.', home: 'Engineer' as Role },
];

/** 0 struggling · 1 okay · 2 thriving */
export type State = 0 | 1 | 2;
export const STATE_LABEL = ['struggling', 'okay', 'thriving'] as const;
export type Rating = State | 'unknown';
export const ratingText = (r: Rating) => (r === 'unknown' ? 'I don’t know' : STATE_LABEL[r][0].toUpperCase() + STATE_LABEL[r].slice(1));
export const clampState = (x: number) => Math.max(0, Math.min(2, x)) as State;

export type DayGoal = 'people' | 'stations' | 'balance';
export const DAY_GOALS: DayGoal[] = ['people', 'stations', 'balance'];
export const GOAL_TEXT: Record<DayGoal, string> = {
  people: 'Understand what each researcher needs to work well',
  stations: 'Cover what each station asks for today',
  balance: 'Balance people and stations — the final deadline is close',
};

export interface Researcher {
  id: string;
  name: string;
  role: Role;
  /** Station matching their experience: where they start on Day 1. */
  home: number;
  /** Station where they contribute most (stable across days). */
  strength: number;
  /** Day 1 morning state; later mornings carry over from the previous evening plus a drift. */
  morning0: State;
  drift: number[];
  /** Day on which they are out in the field and can't be asked (or null). */
  unavailable: number | null;
}

export interface StationNeed {
  role: Role | null;
  people: number;
}

export interface Station {
  id: string;
  name: string;
  description: string;
  need: StationNeed[];
}

export type QuestionKind = 'strength' | 'mood' | 'risk' | 'need' | 'srisk';
export const PERSON_KINDS: QuestionKind[] = ['strength', 'mood'];

export type Archetype = 'middle' | 'postpone' | 'force' | 'giveIn' | 'decideForThem' | 'loseFocus';
export const ARCHETYPE_TEXT: Record<Archetype, string> = {
  middle: 'Middle path — moves forward, leaves room to correct, lets the person own it',
  postpone: 'Postpones — asks for more time or data the deadline doesn’t allow',
  force: 'Forces — decides fast and alone, running over people or data',
  giveIn: 'Gives in — avoids friction and drops the real issue',
  decideForThem: 'Takes over — decides or speaks for the person',
  loseFocus: 'Loses focus — attention goes to something that isn’t the priority',
};
export const ARCHETYPE_QUALITY: Record<Archetype, number> = { middle: 1, decideForThem: 0.4, giveIn: 0.3, postpone: 0.3, force: 0.3, loseFocus: 0 };
const ARCHETYPE_DELTA: Record<Archetype, number> = { middle: 1, postpone: -1, force: -1, giveIn: 0, decideForThem: -1, loseFocus: 0 };
const CONSEQUENCE: Record<Archetype, string> = {
  middle: '{R} handles it well and the work moves forward.',
  postpone: 'Nothing moves today, and {R} is frustrated by the wait.',
  force: 'It gets done, but {R} and {O} feel run over.',
  giveIn: 'The friction goes away for now, but the real issue is still open.',
  decideForThem: 'It gets done, but {R} feels sidelined.',
  loseFocus: 'The day’s priority slips while attention goes elsewhere.',
};

export interface Problem {
  id: string;
  from: number;
  other: number;
  station: number;
  deadlineRank: number;
  deadline: string;
  text: string;
  options: { archetype: Archetype; text: string }[];
}

export interface OpeningQuestion {
  id: string;
  text: string;
  answer: string;
}

export interface IslandScenario {
  island: string;
  researchers: Researcher[];
  stations: Station[];
  /** Which two questions each researcher/station offers, per day. */
  offers: Record<string, QuestionKind[]>[];
  /** For researcher "what could go wrong" answers: which station they warn about, per day. */
  riskStation: Record<string, number>[];
  problems: Problem[][];
  opening: OpeningQuestion[];
  /** Ideal opening order (question ids). */
  openingIdeal: string[];
  /** Placement that best serves each day's goal (for hints and the debrief). */
  bestPlacement: { placement: number[]; score: number }[];
}

const NAMES = ['Amara Osei', 'Tomas Lindqvist', 'Priya Raman', 'Kai Nakoa', 'Elena Duarte', 'Felix Moreau', 'Hana Sato', 'Rafael Ortiz', 'Ines Kovac', 'Jonah Whitfield'];
const ISLANDS = ['Ardent Isle', 'Kestrel Key', 'Morrow Island', 'Saltwhistle'];
const DEADLINES = ['by 11:00 today', 'by the end of today', 'by Friday'];
const MOOD_LINES: Record<State, string[]> = {
  0: ['Honestly, I’m stretched thin and a bit lost today.', 'Not great — I can’t see how my part fits in.'],
  1: ['Fine. Busy, but managing.', 'Okay — a few loose ends, nothing serious.'],
  2: ['Really good — I know exactly what I’m doing today.', 'Great. The work is clicking.'],
};
const RISK_LINES = ['the samples will spoil', 'we lose a full day of readings', 'the council update goes out incomplete', 'the seedlings dry out'];

export const first = (name: string) => name.split(' ')[0];

/** Placement respecting the 2-per-station capacity. */
function randomPlacement(rng: Rng, n: number, cap: number): number[] {
  for (;;) {
    const p = Array.from({ length: n }, () => rng.int(0, n - 1));
    if ([0, 1, 2, 3].every((s) => p.filter((x) => x === s).length <= cap)) return p;
  }
}
const diff = (a: number[], b: number[]) => a.filter((x, i) => x !== b[i]).length;

export function generateIsland(seed: string): IslandScenario {
  const rng = makeRng(`${seed}::sfl3`);
  const cfg = CONFIG.sflIsland;
  const names = rng.sample(NAMES, 4);
  const homes = ROLES.map((role) => STATION_DEFS.findIndex((s) => s.home === role));
  // Strengths: at least two researchers do their best work away from their home station, so Day 1 needs moves.
  let strengths: number[];
  do strengths = randomPlacement(rng, 4, cfg.stationCapacity);
  while (diff(strengths, homes) < 2);
  // On Days 2 and 3 one researcher is out in the field and can't be asked (a different one each day).
  const [offDay2, offDay3] = rng.sample([0, 1, 2, 3], 2);
  const researchers: Researcher[] = ROLES.map((role, i) => ({
    id: `r${i}`,
    name: names[i],
    role,
    home: homes[i],
    strength: strengths[i],
    morning0: rng.int(0, 2) as State,
    drift: [0, rng.pick([-1, 0, 0, 1]), rng.pick([-1, 0, 0, 1])],
    unavailable: i === offDay2 ? 1 : i === offDay3 ? 2 : null,
  }));

  // Station needs per day, each derived from a feasible placement.
  const day1Need = homes.slice();
  let day2Need: number[];
  do day2Need = randomPlacement(rng, 4, cfg.stationCapacity);
  while (diff(day2Need, strengths) < 2);
  const day3Need = strengths.slice();
  const k = rng.int(0, 3);
  const alt = [0, 1, 2, 3].filter((s) => s !== strengths[k] && day3Need.filter((x) => x === s).length < cfg.stationCapacity);
  day3Need[k] = rng.pick(alt);
  const needPlacements = [day1Need, day2Need, day3Need];
  const stations: Station[] = STATION_DEFS.map((d, si) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    need: needPlacements.map((pl) => {
      const here = researchers.filter((_, ri) => pl[ri] === si);
      return { role: here.length ? rng.pick(here).role : null, people: here.length };
    }),
  }));

  const offers = [0, 1, 2].map((day) => {
    const o: Record<string, QuestionKind[]> = {};
    researchers.forEach((r) => (o[r.id] = r.unavailable === day ? [] : rng.sample(['strength', 'mood', 'risk'] as QuestionKind[], 2)));
    stations.forEach((s) => (o[s.id] = ['need', 'srisk']));
    return o;
  });
  const riskStation = [0, 1, 2].map((day) => {
    const staffed = stations.map((s, i) => (s.need[day].people > 0 ? i : -1)).filter((i) => i >= 0);
    return Object.fromEntries(researchers.map((r) => [r.id, rng.pick(staffed)]));
  });

  const problems = [0, 1, 2].map((day) => buildProblems(rng, day, researchers, stations));
  const sc: IslandScenario = {
    island: rng.pick(ISLANDS),
    researchers,
    stations,
    offers,
    riskStation,
    problems,
    opening: [],
    openingIdeal: [],
    bestPlacement: [],
  };
  sc.opening = buildOpening(sc);
  sc.openingIdeal = ['deliver', 'team', 'stations', 'constraints', 'budget', 'lodging'];
  sc.opening = rng.shuffle(sc.opening);
  sc.bestPlacement = [0, 1, 2].map((d) => bestPlacement(sc, d));
  return sc;
}

function buildOpening(sc: IslandScenario): OpeningQuestion[] {
  const S = sc.stations;
  return [
    { id: 'deliver', text: 'What do we have to deliver, and by when?', answer: `A restoration plan for ${sc.island}’s coast, with evidence from all four stations, due to the island council at the end of Day 3.` },
    {
      id: 'team',
      text: 'Who is on the team, and what is each person’s background?',
      answer: sc.researchers.map((r) => `${r.name} — ${r.role}, experienced at the ${S[r.home].name}`).join('; ') + '.',
    },
    { id: 'stations', text: 'What does each station do?', answer: S.map((s) => `${s.name}: ${s.description}`).join(' ') },
    {
      id: 'constraints',
      text: 'What constraints do we work under?',
      answer: `A station can be left empty or hold up to ${CONFIG.sflIsland.stationCapacity} people. Each day you have only a few questions (${CONFIG.sflIsland.exploreRequests.join(', ')}), and each person answers one question a day. Placements carry over to the next day.`,
    },
    { id: 'budget', text: 'Is there budget for new equipment?', answer: 'A small one, already allocated. It won’t change this week’s decisions.' },
    { id: 'lodging', text: 'Where is the team staying?', answer: 'At the field lodge near the harbour.' },
  ];
}

type Template = { text: string; opts: Record<Archetype, string> };
const TEMPLATES: Template[] = [
  {
    text: 'The {S} readings don’t match last week’s. {O} wants to rerun everything; I think the trend is real. The summary is due {D}.',
    opts: {
      middle: 'Send the summary with the current readings, flag the mismatch clearly, and agree with {O} on one quick check you can add tomorrow.',
      postpone: 'Hold the summary until the whole series has been rerun and the numbers are certain.',
      force: 'Tell {O} the trend stands and send the summary as it is — there’s no time to debate it.',
      giveIn: 'Leave the mismatch out of the summary so nobody argues about it.',
      decideForThem: 'I’ll rewrite the summary myself and present it to the council for you.',
      loseFocus: 'Use the time to redesign the station dashboard instead.',
    },
  },
  {
    text: 'The main sensor at the {S} has failed. A spare arrives {D}, or I could borrow {O}’s, which would stall their work.',
    opts: {
      middle: 'Borrow it for the two most critical readings only, agree the times with {O}, and switch to the spare when it arrives.',
      postpone: 'Pause all readings until the new sensor arrives.',
      force: 'Take {O}’s sensor for the day — their work can wait.',
      giveIn: 'Skip today’s readings rather than ask {O}.',
      decideForThem: 'I’ll go and negotiate with {O} on your behalf.',
      loseFocus: 'Spend the day cleaning up old data instead.',
    },
  },
  {
    text: 'I’ve been asked to cover the {S} and answer a council request {D}. I can’t do both well.',
    opts: {
      middle: 'Agree with me which matters most today, deliver that fully, and give the council a short, honest update on when the other will come.',
      postpone: 'Ask the council for a week’s extension on everything.',
      force: 'Do both anyway — work late if you have to.',
      giveIn: 'Quietly drop the council request.',
      decideForThem: 'I’ll handle the council request myself; you stay at the station.',
      loseFocus: 'Start a new side project to show initiative.',
    },
  },
  {
    text: '{O} and I keep clashing about how to run the {S}. We need an agreed plan {D}.',
    opts: {
      middle: 'Sit down with {O}, list what each approach protects, and agree a split you can both test this week.',
      postpone: 'Wait and see whether it settles down on its own.',
      force: 'Tell {O} we’re doing it your way.',
      giveIn: 'Let {O} decide everything to keep the peace.',
      decideForThem: 'I’ll write the plan myself and hand it to you both.',
      loseFocus: 'Focus on your own reports and leave the station plan for now.',
    },
  },
  {
    text: 'Villagers want a tour of the {S} {D}. It’s good for relations, but it would take half a day.',
    opts: {
      middle: 'Offer a shorter tour at a quieter moment, focused on the work that matters most to them.',
      postpone: 'Tell them you’ll arrange something once the project is over.',
      force: 'Run the full half-day tour regardless of the station’s work.',
      giveIn: 'Cancel today’s station work so the visit can be as long as they like.',
      decideForThem: 'I’ll host the villagers myself.',
      loseFocus: 'Use the visit to pitch an unrelated new project.',
    },
  },
  {
    text: 'I’m not sure our sampling method at the {S} is right. The first batch is due {D}.',
    opts: {
      middle: 'Run the first batch with the current method, note your concerns, and test the alternative on a small sample alongside it.',
      postpone: 'Stop sampling until you’ve researched every possible method.',
      force: 'Follow the protocol and stop questioning it.',
      giveIn: 'Switch to whatever method feels right today.',
      decideForThem: 'I’ll choose the method for you.',
      loseFocus: 'Spend today reading papers instead.',
    },
  },
  {
    text: 'I mislabelled some samples at the {S} yesterday. Fixing it properly means redoing part of the work, due {D}.',
    opts: {
      middle: 'Tell the team plainly, fix the samples that feed this week’s results first, and add a quick check so it doesn’t happen again.',
      postpone: 'Wait to see whether anyone notices before deciding.',
      force: 'Redo everything from scratch today, whatever else slips.',
      giveIn: 'Leave the labels as they are — it’s probably fine.',
      decideForThem: 'I’ll quietly fix it myself.',
      loseFocus: 'Move on to a new task and come back to it later.',
    },
  },
  {
    text: 'Honestly, I’m not sure my work at the {S} makes a difference. I need some direction {D}.',
    opts: {
      middle: 'Talk through how your results feed the final plan, and agree one concrete goal for you to own this week.',
      postpone: 'Let’s discuss it after the project ends.',
      force: 'Everyone has to pull their weight — keep going.',
      giveIn: 'Take it easy and do less for a while.',
      decideForThem: 'I’ll move you to a different station without asking.',
      loseFocus: 'Let’s talk about something else for now.',
    },
  },
];

function buildProblems(rng: Rng, day: number, rs: Researcher[], ss: Station[]): Problem[] {
  const n = CONFIG.sflIsland.supportProblemsPerDay;
  const from = rng.sample([0, 1, 2, 3], n);
  const temps = rng.sample(TEMPLATES, n);
  const ranks = rng.shuffle([0, 1, 2].slice(0, n));
  return from.map((ri, k) => {
    const other = rng.pick([0, 1, 2, 3].filter((x) => x !== ri));
    const station = rng.int(0, ss.length - 1);
    const fill = (t: string) => t.replace(/\{S\}/g, ss[station].name).replace(/\{O\}/g, first(rs[other].name)).replace(/\{D\}/g, DEADLINES[ranks[k]]);
    const archs = ['middle', ...rng.sample(['postpone', 'force', 'giveIn', 'decideForThem', 'loseFocus'] as Archetype[], 3)] as Archetype[];
    return {
      id: `d${day}p${k}`,
      from: ri,
      other,
      station,
      deadlineRank: ranks[k],
      deadline: DEADLINES[ranks[k]],
      text: fill(temps[k].text),
      options: rng.shuffle(archs.map((a) => ({ archetype: a, text: fill(temps[k].opts[a]) }))),
    };
  });
}

// ---------------------------------------------------------------- answers & knowledge

export interface Purchase {
  day: number;
  target: string;
  kind: QuestionKind;
  answer: string;
}

export function questionText(kind: QuestionKind): string {
  return {
    strength: 'Where do you think you contribute most?',
    mood: 'How are you doing today?',
    risk: 'What could go wrong with the work today?',
    need: 'What does this station need today?',
    srisk: 'What could go wrong here today?',
  }[kind];
}

export function answerText(sc: IslandScenario, day: number, target: string, kind: QuestionKind, morning?: State, rng?: Rng): string {
  const r = sc.researchers.find((x) => x.id === target);
  const S = sc.stations;
  if (r) {
    if (kind === 'strength') return `“I do my best work at the ${S[r.strength].name}.”`;
    if (kind === 'mood') {
      const st = morning ?? r.morning0;
      return `“${(rng ? rng.pick(MOOD_LINES[st]) : MOOD_LINES[st][0])}” (${STATE_LABEL[st]})`;
    }
    const si = sc.riskStation[day][r.id];
    const n = S[si].need[day].people;
    return `“If the ${S[si].name} isn’t covered today, ${RISK_LINES[si % RISK_LINES.length]}. It needs ${n} ${n === 1 ? 'person' : 'people'}.”`;
  }
  const si = S.findIndex((x) => x.id === target);
  const need = S[si].need[day];
  if (kind === 'need') return need.role ? `“Today we need a ${need.role.toLowerCase()}${need.people > 1 ? ', and two people in total' : ''}.”` : '“Nothing urgent today — the station can run unattended.”';
  return need.people === 0 ? '“Low risk today — it’s fine to leave us empty.”' : `“If we’re short-staffed today, ${RISK_LINES[si % RISK_LINES.length]}. We need at least ${need.people}.”`;
}

/** What the player knows, from their purchases. Strengths are stable; station needs only hold for the day asked. */
export function knowsStrength(buys: Purchase[], rid: string) {
  return buys.some((b) => b.target === rid && b.kind === 'strength');
}
export function knowsNeedRole(buys: Purchase[], sid: string, day: number) {
  return buys.some((b) => b.day === day && b.target === sid && b.kind === 'need');
}
export function knowsPeople(sc: IslandScenario, buys: Purchase[], si: number, day: number) {
  const sid = sc.stations[si].id;
  return buys.some((b) => b.day === day && ((b.target === sid && (b.kind === 'need' || b.kind === 'srisk')) || (b.kind === 'risk' && sc.riskStation[day][b.target] === si)));
}

export type Reason = 'expertise' | 'contribute' | 'staffing' | 'goal';
export const REASONS: { id: Reason; label: string; needs: string }[] = [
  { id: 'expertise', label: 'Matches what the station needs', needs: 'today’s “what does this station need” answer naming their role' },
  { id: 'contribute', label: 'Where they contribute most', needs: 'their own answer that this is where they do their best work (any day)' },
  { id: 'staffing', label: 'Station needs more people today', needs: 'a “what could go wrong” or “what does it need” answer about this station today saying it needs people' },
  { id: 'goal', label: 'Advances today’s goal', needs: 'Day 1: they told you this is where they contribute most. Day 2: today’s answer about this station’s need or staffing. Day 3: either' },
];

export function reasonSupported(sc: IslandScenario, day: number, buys: Purchase[], ri: number, si: number, reason: Reason): boolean {
  const r = sc.researchers[ri];
  const s = sc.stations[si];
  const contribute = knowsStrength(buys, r.id) && r.strength === si;
  const expertise = knowsNeedRole(buys, s.id, day) && s.need[day].role === r.role;
  const staffing = knowsPeople(sc, buys, si, day) && s.need[day].people > 0;
  if (reason === 'contribute') return contribute;
  if (reason === 'expertise') return expertise;
  if (reason === 'staffing') return staffing;
  const goal = DAY_GOALS[day];
  return goal === 'people' ? contribute : goal === 'stations' ? expertise || staffing : contribute || expertise || staffing;
}

// ---------------------------------------------------------------- scoring helpers

export function peopleScore(sc: IslandScenario, place: number[]) {
  return sc.researchers.filter((r, i) => place[i] === r.strength).length / sc.researchers.length;
}
export function stationsMet(sc: IslandScenario, day: number, place: number[]) {
  return sc.stations.map((s, si) => {
    const here = sc.researchers.filter((_, ri) => place[ri] === si);
    const n = s.need[day];
    if (n.people === 0) return true;
    return here.length >= n.people && (!n.role || here.some((r) => r.role === n.role));
  });
}
export function placementScore(sc: IslandScenario, day: number, place: number[]): number {
  const p = peopleScore(sc, place);
  const s = stationsMet(sc, day, place).filter(Boolean).length / sc.stations.length;
  const g = DAY_GOALS[day];
  return g === 'people' ? p : g === 'stations' ? s : (p + s) / 2;
}

export function bestPlacement(sc: IslandScenario, day: number): { placement: number[]; score: number } {
  let best = { placement: [] as number[], score: -1 };
  for (let code = 0; code < 256; code++) {
    const p = [0, 1, 2, 3].map((i) => Math.floor(code / Math.pow(4, i)) % 4);
    if ([0, 1, 2, 3].some((s) => p.filter((x) => x === s).length > CONFIG.sflIsland.stationCapacity)) continue;
    const score = placementScore(sc, day, p);
    if (score > best.score) best = { placement: p, score };
  }
  return best;
}

/** How a move lands with the person: moving to where they contribute most lifts them; moving them away dips them. */
export function moveDelta(r: Researcher, from: number, to: number): number {
  if (to === r.strength && from !== r.strength) return 1;
  if (from === r.strength && to !== r.strength) return -1;
  return 0;
}
export function reactionText(to: number, state: State, sc: IslandScenario, delta: number): string {
  const s = sc.stations[to].name;
  const line = delta > 0 ? `“Glad to be at the ${s} — this is where I’m most useful.”` : delta < 0 ? `“The ${s}? Okay… I was doing my best work where I was.”` : `“Fine, I’ll head to the ${s}.”`;
  return `${line} (${STATE_LABEL[state]})`;
}

export function applyArchetype(state: State, a: Archetype): State {
  return clampState(state + ARCHETYPE_DELTA[a]);
}
export function consequenceText(sc: IslandScenario, p: Problem, a: Archetype, after: State): string {
  const R = first(sc.researchers[p.from].name);
  return `${CONSEQUENCE[a].replace(/\{R\}/g, R).replace(/\{O\}/g, first(sc.researchers[p.other].name))} ${R} ends the day ${STATE_LABEL[after]}.`;
}

/** Spearman-footrule closeness of two orders (1 = identical). */
export function orderScore(given: string[], ideal: string[]): number {
  const max = Math.floor((ideal.length * ideal.length) / 2) || 1;
  const d = ideal.reduce((a, id, i) => a + Math.abs(given.indexOf(id) - i), 0);
  return 1 - d / max;
}

export function relevantKinds(day: number): QuestionKind[] {
  const g = DAY_GOALS[day];
  return g === 'people' ? ['strength', 'mood'] : g === 'stations' ? ['need', 'srisk', 'risk'] : ['strength', 'need', 'srisk', 'risk'];
}

/** Reflect: the right rating is the latest state you actually observed today; with none, "I don't know". */
export function reflectCredit(expected: Rating, given: Rating | undefined) {
  return given === expected ? 1 : 0;
}
