import { CONFIG } from '../../config';
import { makeRng, type Rng } from '../../lib/rng';

export type Skill = 'sampling' | 'data analysis' | 'equipment repair' | 'community outreach';
export const SKILLS: Skill[] = ['sampling', 'data analysis', 'equipment repair', 'community outreach'];
export type Level = 'low' | 'medium' | 'high';
export const LEVELS: Level[] = ['low', 'medium', 'high'];
export type Rating = Level | 'unknown';
export type DayGoal = 'researcher' | 'workstation' | 'balance';
export const DAY_GOALS: DayGoal[] = ['researcher', 'workstation', 'balance'];
export const GOAL_TEXT: Record<DayGoal, string> = {
  researcher: 'Meet your researchers’ needs',
  workstation: 'Meet the workstations’ needs',
  balance: 'Balance researcher and workstation needs',
};
export const REFLECT_DIMS = ['How certain does each researcher feel about the project?', 'How involved does each researcher feel in the work?', 'How supported does each researcher feel?'];

export type Reason = 'preference' | 'skill' | 'goal' | 'need' | 'coverage';
export const REASONS: { id: Reason; label: string }[] = [
  { id: 'preference', label: 'Researcher’s preference' },
  { id: 'skill', label: 'Skill fit' },
  { id: 'goal', label: 'Advances today’s goal' },
  { id: 'need', label: 'Workstation’s current need' },
  { id: 'coverage', label: 'Workstation coverage' },
];

export interface Researcher {
  id: string;
  name: string;
  title: string;
  bio: string;
  skill: Skill;
  /** Preferred station index, per day. */
  pref: number[];
  /** Feeling on the day's reflect dimension, per day. */
  feeling: Level[];
}

export interface Station {
  id: string;
  name: string;
  description: string;
  /** Skill needed per day (null = runs unattended that day). */
  need: (Skill | null)[];
  /** People needed per day. */
  coverage: number[];
  x: number;
  y: number;
}

export type QuestionKind = 'pref' | 'skill' | 'feeling' | 'need' | 'coverage';

export interface SupportOption {
  text: string;
  serves: DayGoal | 'none';
  stance?: 'flex' | 'firm';
}

export interface SupportRequest {
  id: string;
  from: string;
  /** Mood cue the requester lets slip — evidence for Reflect. */
  cue: string;
  text: string;
  options: SupportOption[];
  linkedTo?: string;
}

export interface IslandScenario {
  island: string;
  researchers: Researcher[];
  stations: Station[];
  support: SupportRequest[][];
  /** Best achievable placement per day (for the debrief). */
  plantedPlacement: number[][];
}

const NAMES = ['Amara Osei', 'Tomas Lindqvist', 'Priya Raman', 'Kai Nakoa', 'Elena Duarte', 'Felix Moreau', 'Hana Sato', 'Rafael Ortiz', 'Ines Kovac', 'Jonah Whitfield'];
const TITLES = ['Field researcher', 'Research associate', 'Postdoctoral fellow', 'Lab technician'];
const BIOS = [
  'Joined the project last spring after two seasons on a mangrove survey.',
  'Has worked on three island programmes and knows most of the local fishers.',
  'Recently moved from a city lab and is still getting used to fieldwork.',
  'Keeps meticulous notebooks and likes to understand the why behind each task.',
];
const STATIONS = [
  { name: 'Tide Pool Lab', description: 'Monitors intertidal species and water chemistry on the rocky shore.' },
  { name: 'Weather Mast', description: 'Maintains sensors that log wind, rainfall and salt spray.' },
  { name: 'Seed Bank', description: 'Stores and germinates native plant seeds for dune restoration.' },
  { name: 'Reef Hide', description: 'A floating platform for counting fish and checking coral health.' },
  { name: 'Village Desk', description: 'Shares findings with residents and gathers local observations.' },
];
const POS = [
  { x: 18, y: 28 },
  { x: 72, y: 20 },
  { x: 24, y: 72 },
  { x: 78, y: 70 },
];
const ISLANDS = ['Ardent Isle', 'Kestrel Key', 'Morrow Island', 'Saltwhistle'];

const CUES: Record<number, Record<Level, string[]>> = {
  0: {
    low: ['Honestly, I’m not sure where this project is heading.', 'I keep wondering whether our data will be used at all.'],
    medium: ['I think I see the direction, mostly.', 'The plan makes sense, though a few parts are fuzzy.'],
    high: ['I’m confident we’re on the right track.', 'It’s clear to me what we’re building towards.'],
  },
  1: {
    low: ['I feel a bit on the sidelines lately.', 'Nobody really asks for my input here.'],
    medium: ['I’m part of things, but not always in the loop.', 'I get involved when someone remembers to ask.'],
    high: ['I feel right at the centre of the work.', 'People keep pulling me into the key decisions — I love it.'],
  },
  2: {
    low: ['I’ve been figuring most things out alone.', 'It’s hard to get help when something goes wrong.'],
    medium: ['I get help when I ask, usually.', 'Support is there, if a little slow.'],
    high: ['The team has my back every time.', 'I always know who to turn to.'],
  },
};

export const cueFor = (day: number, level: Level, rng: Rng) => rng.pick(CUES[day][level]);

/** Assignment of each researcher to a station that respects capacity. */
function randomPlacement(rng: Rng, nR: number, nS: number, cap: number): number[] {
  for (;;) {
    const p = Array.from({ length: nR }, () => rng.int(0, nS - 1));
    if (Array.from({ length: nS }, (_, s) => p.filter((x) => x === s).length).every((c) => c <= cap)) return p;
  }
}

export function generateIsland(seed: string): IslandScenario {
  const rng = makeRng(`${seed}::sfl-island`);
  const cfg = CONFIG.sflIsland;
  const names = rng.sample(NAMES, cfg.researchers);
  const titles = rng.shuffle(TITLES);
  const bios = rng.shuffle(BIOS);
  const skills = rng.shuffle(SKILLS);
  const st = rng.sample(STATIONS, cfg.workstations);
  const researchers: Researcher[] = names.map((name, i) => ({
    id: `r${i}`,
    name,
    title: titles[i % titles.length],
    bio: bios[i % bios.length],
    skill: skills[i % skills.length],
    pref: [],
    feeling: [],
  }));
  const stations: Station[] = st.map((s, i) => ({ id: `s${i}`, ...s, need: [], coverage: [], ...POS[i] }));

  const planted: number[][] = [];
  for (let day = 0; day < cfg.days; day++) {
    // Workstation needs are derived from a planted feasible placement so a perfect day exists.
    const needPlace = randomPlacement(rng, researchers.length, stations.length, cfg.stationCapacity);
    stations.forEach((s, si) => {
      const here = researchers.filter((_, ri) => needPlace[ri] === si);
      s.coverage[day] = here.length;
      s.need[day] = here.length ? rng.pick(here).skill : null;
    });
    let prefPlace: number[];
    if (day === 0) prefPlace = randomPlacement(rng, researchers.length, stations.length, cfg.stationCapacity);
    else if (day === 1) prefPlace = randomPlacement(rng, researchers.length, stations.length, cfg.stationCapacity);
    else {
      // Day 3: preferences mostly agree with station needs, so the best answer is a balance.
      prefPlace = needPlace.slice();
      const k = rng.int(0, researchers.length - 1);
      const alt = Array.from({ length: stations.length }, (_, i) => i).filter((s) => s !== needPlace[k] && prefPlace.filter((x) => x === s).length < cfg.stationCapacity);
      if (alt.length) prefPlace[k] = rng.pick(alt);
    }
    researchers.forEach((r, ri) => {
      r.pref[day] = prefPlace[ri];
      r.feeling[day] = rng.pick(LEVELS);
    });
    planted.push(day === 0 ? prefPlace : needPlace);
  }

  const support = Array.from({ length: cfg.days }, (_, day) => buildSupport(rng, day, researchers, stations));
  return { island: rng.pick(ISLANDS), researchers, stations, support, plantedPlacement: planted };
}

// ---------------------------------------------------------------- support requests

function buildSupport(rng: Rng, day: number, rs: Researcher[], ss: Station[]): SupportRequest[] {
  const [a, b, c, d] = rng.shuffle(rs);
  const [s1, s2, s3] = rng.shuffle(ss);
  const cue = (r: Researcher) => cueFor(day, r.feeling[day], rng);
  const swap: SupportRequest = {
    id: `d${day}-swap`,
    from: a.id,
    cue: cue(a),
    text: `Could I spend this afternoon helping at ${s2.name} instead of ${s1.name}? I think I’d learn more there.`,
    options: [
      { text: `Yes — follow what interests you most today. I’ll make sure ${s1.name}’s logging is picked up by someone else.`, serves: 'researcher', stance: 'flex' },
      { text: `Not today. ${s1.name} needs steady hands until its readings are complete; let’s plan time at ${s2.name} later this week.`, serves: 'workstation', stance: 'firm' },
      { text: `Go for part of the afternoon once ${s1.name}’s priority readings are logged, and tell its lead when you leave.`, serves: 'balance', stance: 'flex' },
    ],
  };
  const followUp: SupportRequest = {
    id: `d${day}-follow`,
    from: b.id,
    cue: cue(b),
    linkedTo: swap.id,
    text: `I heard ${a.name.split(' ')[0]} asked to move around this afternoon. Could I also rotate to ${s3.name} for a while?`,
    options: [
      { text: 'Yes, rotate whenever you like — variety keeps people motivated.', serves: 'researcher', stance: 'flex' },
      { text: `I’d rather everyone stays put today so every station is covered; we’ll rotate once the readings are in.`, serves: 'workstation', stance: 'firm' },
      { text: `Yes, once your station’s priority task is done and someone has agreed to cover it.`, serves: 'balance', stance: 'flex' },
      { text: 'Let me think about it and get back to you later.', serves: 'none' },
    ],
  };
  const pool: SupportRequest[] = [
    {
      id: `d${day}-kit`,
      from: c.id,
      cue: cue(c),
      text: `There’s only one spare field kit left. I’d like it for my own side project on ${s1.name.toLowerCase()} samples — can I have it?`,
      options: [
        { text: 'Yes, take it — your project matters and you’ll be more engaged with your own kit.', serves: 'researcher' },
        { text: `It should go to the station whose kit failed this morning; that keeps today’s readings on track.`, serves: 'workstation' },
        { text: 'Share it: the failing station uses it during core hours and you get it for your project afterwards.', serves: 'balance' },
      ],
    },
    {
      id: `d${day}-why`,
      from: d.id,
      cue: cue(d),
      text: `Nobody has really explained why we’re collecting these measurements at ${s2.name}. Can you?`,
      options: [
        { text: 'Just follow the protocol for now; the reasons will become clear later.', serves: 'none' },
        { text: `It builds your skills for future roles — think of it as professional development.`, serves: 'researcher' },
        { text: `${s2.name} has to deliver a full data series this week; your readings are the core of it.`, serves: 'workstation' },
        { text: `Your readings complete ${s2.name}’s data series this week, and that series is what the programme’s next decisions rest on — including where you’ll want to work next.`, serves: 'balance' },
      ],
    },
    {
      id: `d${day}-method`,
      from: c.id,
      cue: cue(c),
      text: `${d.name.split(' ')[0]} and I disagree on the sampling method at ${s3.name}. Can you decide?`,
      options: [
        { text: 'Use whichever method you each feel most comfortable with.', serves: 'researcher' },
        { text: `Stick to ${s3.name}’s standard protocol so the data stays comparable.`, serves: 'workstation' },
        { text: 'Run both methods on a small batch this morning, then adopt the one that matches the station protocol best.', serves: 'balance' },
      ],
    },
    {
      id: `d${day}-late`,
      from: d.id,
      cue: cue(d),
      text: `${s1.name} wants someone to stay late tonight, but I’m exhausted. Do I have to?`,
      options: [
        { text: 'No — rest is the priority. The station can wait.', serves: 'researcher' },
        { text: 'Yes, the station needs the overnight readings.', serves: 'workstation' },
        { text: 'Take a proper break now; I’ll ask for a volunteer for the late shift and you take the morning slot.', serves: 'balance' },
      ],
    },
  ];
  const extra = rng.sample(pool, CONFIG.sflIsland.supportRequestsPerDay - 2);
  const list = [swap, extra[0], followUp, ...extra.slice(1)];
  return list.map((r) => ({ ...r, options: rng.shuffle(r.options) }));
}

// ---------------------------------------------------------------- scoring helpers

export interface Purchase {
  day: number;
  target: string; // researcher or station id
  kind: QuestionKind;
  answer: string;
}

export interface Move {
  researcher: string;
  station: number | null;
  reason: Reason | null;
}

export function placementScore(sc: IslandScenario, day: number, place: (number | null)[]): number {
  const goal = DAY_GOALS[day];
  const pref = sc.researchers.filter((r, i) => place[i] === r.pref[day]).length / sc.researchers.length;
  const met =
    sc.stations.filter((s, si) => {
      const here = sc.researchers.filter((_, ri) => place[ri] === si);
      if (s.coverage[day] === 0) return here.length === 0;
      return here.length >= s.coverage[day] && here.some((r) => r.skill === s.need[day]);
    }).length / sc.stations.length;
  if (goal === 'researcher') return pref;
  if (goal === 'workstation') return met;
  return (pref + met) / 2;
}

/** A reason only counts if an answer bought today supports it. */
export function reasonSupported(sc: IslandScenario, day: number, buys: Purchase[], researcherIdx: number, station: number, reason: Reason): boolean {
  const r = sc.researchers[researcherIdx];
  const s = sc.stations[station];
  const today = buys.filter((b) => b.day === day);
  const has = (target: string, kind: QuestionKind) => today.some((b) => b.target === target && b.kind === kind);
  switch (reason) {
    case 'preference':
      return has(r.id, 'pref') && r.pref[day] === station;
    case 'skill':
      return has(r.id, 'skill') && (!has(s.id, 'need') || s.need[day] === r.skill);
    case 'need':
      return has(s.id, 'need') && s.need[day] !== null;
    case 'coverage':
      return has(s.id, 'coverage') && s.coverage[day] > 0;
    case 'goal': {
      const goal = DAY_GOALS[day];
      const rp = has(r.id, 'pref') && r.pref[day] === station;
      const sw = has(s.id, 'need') || has(s.id, 'coverage');
      return goal === 'researcher' ? rp : goal === 'workstation' ? sw : rp || sw;
    }
  }
}

export function supportScore(day: number, opt: SupportOption): number {
  const goal = DAY_GOALS[day];
  if (opt.serves === goal) return 1;
  if (opt.serves === 'none') return 0;
  if (goal === 'balance' || opt.serves === 'balance') return 0.5;
  return 0;
}

/** Rating credit: with evidence, the rating must match; without, "I don't know" is the honest answer. */
export function reflectCredit(truth: Level, rating: Rating, evidence: boolean): number {
  if (evidence) return rating === truth ? 1 : 0;
  return rating === 'unknown' ? 1 : 0;
}

export function answerText(sc: IslandScenario, day: number, target: string, kind: QuestionKind): string {
  const r = sc.researchers.find((x) => x.id === target);
  const s = sc.stations.find((x) => x.id === target);
  if (r) {
    if (kind === 'pref') return `“I’d most like to be at ${sc.stations[r.pref[day]].name} today.”`;
    if (kind === 'skill') return `“My strongest area is ${r.skill}.”`;
    const levelWord = { low: 'low', medium: 'moderate', high: 'high' }[r.feeling[day]];
    return `“${CUES[day][r.feeling[day]][0]}” (${levelWord})`;
  }
  if (s) {
    if (kind === 'need') return s.need[day] ? `Most needed today: someone skilled in ${s.need[day]}.` : 'Runs unattended today — no specialist needed.';
    if (kind === 'coverage') return s.coverage[day] === 0 ? 'Needs nobody on site today.' : `Needs ${s.coverage[day]} ${s.coverage[day] === 1 ? 'person' : 'people'} today.`;
  }
  return '';
}

export function questionsFor(isResearcher: boolean, day: number): { kind: QuestionKind; text: string }[] {
  if (isResearcher)
    return [
      { kind: 'pref', text: 'Where would you most like to work today?' },
      { kind: 'skill', text: 'What are you strongest at?' },
      { kind: 'feeling', text: ['How do you feel about where the project is heading?', 'How involved do you feel in the work?', 'How supported do you feel?'][day] },
    ];
  return [
    { kind: 'need', text: 'What does this workstation need most today?' },
    { kind: 'coverage', text: 'How many people should staff it today?' },
  ];
}
