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
  /** The urgency phrase buried in the text; shown only in reviews, never as a label during play. */
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
/**
 * Urgency is never labelled: it is buried in each problem's wording. Rank 0 = within the hour,
 * 1 = later today, 2 = this week or later. Phrases vary so the order has to be read, not pattern-matched.
 */
const URGENCY: string[][] = [
  ['before the ferry leaves at eleven', 'for the council call that starts in under an hour', 'before the tide turns this morning', 'by the time the steering group dials in at ten', 'before the boat goes out in forty minutes'],
  ['before tonight’s data upload', 'by close of play today', 'before we lock the lab this evening', 'in time for this evening’s team debrief', 'before the courier collects at five'],
  ['ahead of next week’s review', 'at some point before the final report', 'once this week’s fieldwork wraps up', 'before the end-of-month board meeting', 'whenever the next survey cycle starts'],
];
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

  // No problem repeats within a game: each day draws fresh templates from the bank.
  const bank = rng.shuffle(TEMPLATES);
  const per = CONFIG.sflIsland.supportProblemsPerDay;
  const problems = [0, 1, 2].map((day) => buildProblems(rng, day, researchers, stations, bank.slice(day * per, (day + 1) * per)));
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

/**
 * Consultant-style dilemmas. Every option is a plausible two-sentence answer; the weak ones are dressed
 * up as rigour (postpone), decisiveness (force), harmony (give in), support (take over) or ambition
 * (lose focus). The strongest moves forward with what exists, builds in a check, and leaves the person
 * owning the problem.
 */
export const TEMPLATES: Template[] = [
  {
    text: 'The {S} readings have drifted 12% from baseline. {O} thinks the probe is miscalibrated; I think it’s real runoff from the storm. The council wants our water-quality summary {U}.',
    opts: {
      middle: 'Submit the summary with that figure flagged as provisional, setting out both explanations and what would tell them apart. Ask {O} to run a calibration check on a reference sample so the flag can be confirmed or lifted in the next update.',
      postpone: 'Tell the council the summary needs one more sampling cycle so the figure is beyond dispute. A late number you can defend protects the project’s credibility more than a fast one you can’t.',
      force: 'Present the runoff explanation as the finding, since it’s the more likely of the two. Raising calibration doubts in front of a non-technical audience will only muddy the message.',
      giveIn: 'Use last month’s validated figure so nothing in the summary is contested. The drift can be investigated quietly once the summary is out.',
      decideForThem: 'Send me both datasets and I’ll choose the interpretation and brief the council myself. That takes the pressure off you and {O}.',
      loseFocus: 'Treat this as proof the monitoring design needs rethinking and draft a proposal for a continuous sensor network. The summary can reuse the standard template this time.',
    },
  },
  {
    text: 'The {S} and {O}’s station both need the only boat {U}. My samples degrade if they wait; {O} has a buoy that has stopped sending data.',
    opts: {
      middle: 'Agree with {O} which loss can’t be undone — degraded samples can’t be recollected, a silent buoy can be serviced on the next trip — and sequence the boat on that basis. Ask {O} to log the data gap so the missing buoy hours are visible in the dataset.',
      postpone: 'Hold both trips until the harbour office can lend a second boat. Losing a morning is better than forcing a choice between two stations.',
      force: 'Take the boat now, since sample integrity is central to the deliverable. Let {O} know the buoy goes to the back of the queue.',
      giveIn: 'Let {O} have the boat this time and resample later in the week. It keeps relations smooth between the stations.',
      decideForThem: 'Leave it with me — I’ll tell {O} who gets the boat and when. You shouldn’t have to negotiate this yourself.',
      loseFocus: 'Use the morning to build a shared booking system for the boat so this never happens again. The samples and the buoy can sort themselves out today.',
    },
  },
  {
    text: 'The fishing cooperative has heard we might recommend a no-take zone near the {S} and wants to meet {U}. My analysis isn’t finished and I’m worried a half-formed message will turn them against us.',
    opts: {
      middle: 'Meet them, be clear about what you are testing and what you don’t know yet, and ask what catch records they could share. You protect the relationship and may close a real gap in the analysis.',
      postpone: 'Decline politely until the analysis is complete, so you don’t create expectations you can’t meet. A finished recommendation will land far better than a provisional one.',
      force: 'Tell them a no-take zone is likely and the science supports it. It’s better they hear it early and firmly than feel misled later.',
      giveIn: 'Reassure them a no-take zone is off the table so they stay on side. The final report’s wording can be revisited later.',
      decideForThem: 'I’ll take the meeting myself so you can concentrate on the analysis. Stakeholder conversations are my job, not yours.',
      loseFocus: 'Send them the full raw dataset so they can draw their own conclusions. Transparency should speak for itself.',
    },
  },
  {
    text: '{O} keeps leaving the {S} handover notes incomplete, so I’ve been redoing their counts at night. I don’t want to get them in trouble, but my own results are due {U}.',
    opts: {
      middle: 'Raise it with {O} directly and specifically — what’s missing and what it costs you — and agree a short handover checklist you both use. If it hasn’t improved by the end of the week, bring it to me together.',
      postpone: 'Keep a log for a couple of weeks so you have solid evidence before raising it. A pattern is harder to dispute than a single complaint.',
      force: 'Tell {O} that from today you won’t accept counts without complete notes. Clear standards fix this faster than conversations.',
      giveIn: 'Keep covering for now — the project ends soon and it isn’t worth the friction. You can mention it in the end-of-project review.',
      decideForThem: 'I’ll speak to {O} without saying it came from you. That keeps your working relationship intact.',
      loseFocus: 'Use the extra evening hours to start drafting the analysis section early. The handover issue will matter less once the fieldwork ends.',
    },
  },
  {
    text: 'The council has asked whether we can add an invasive-species map to the deliverable, and they want an answer {U}. It would strengthen the report, but it would pull me off the {S} for two days.',
    opts: {
      middle: 'Offer a lean version — one map built from existing survey points, with its limits stated — and confirm with the council that it is an annex, not a core finding. That shows responsiveness without putting the core work at risk.',
      postpone: 'Tell them it is a strong idea for a second phase and park it for now. Committing before the core work is done would be premature.',
      force: 'Agree to the full map; a sponsor request outranks internal priorities. The station work will have to absorb the two days.',
      giveIn: 'Say yes and absorb the extra work in the evenings. That way nobody else on the team is affected.',
      decideForThem: 'I’ll negotiate the scope with the council and tell you what we’ve agreed. You don’t need to be in that conversation.',
      loseFocus: 'Use the request as a reason to build a full island mapping platform. Future requests like this would then take minutes.',
    },
  },
  {
    text: 'Three weeks of {S} data were logged with the wrong timestamps. Correcting them shifts a trend we’ve already shared with {O}’s team, and the final figures go out {U}.',
    opts: {
      middle: 'Correct the timestamps, quantify how far the shared trend moves, and send {O}’s team the corrected version with a plain explanation. Add the check that would have caught it, so the fix is credible.',
      postpone: 'Leave the shared trend as it is until every log on the project has been audited. Fixing one error at a time risks finding another next week.',
      force: 'Correct it in the final figures without flagging it; the earlier version was only shared internally. Drawing attention to it creates noise.',
      giveIn: 'Keep the original timestamps so the numbers stay consistent with what’s been shared. Changing them now would confuse people.',
      decideForThem: 'I’ll write to {O}’s team and explain the error on your behalf. It’s better coming from me.',
      loseFocus: 'Take this as a sign the logging software needs replacing and start scoping a new system. The figures can go out as they are.',
    },
  },
  {
    text: 'I’ve been asked to lead the {S} write-up, but I’ve never written a policy brief and a first draft is expected {U}. I’m losing sleep over it.',
    opts: {
      middle: 'Start from the decisions the council has to make and draft rough bullet points for each. Share them with me early so we can fix the direction before you polish anything.',
      postpone: 'Ask for the draft to move back until you’ve worked through some example briefs. Going in underprepared helps no one.',
      force: 'Just write it — everyone has to stretch on a project like this. The pressure will sharpen your thinking.',
      giveIn: 'Hand the write-up to {O}, who has done it before. It avoids the stress and gets a safer result.',
      decideForThem: 'I’ll write the brief and you can review it afterwards. That way you can stay on the fieldwork.',
      loseFocus: 'Spend the time collecting more data so the brief rests on stronger evidence. The writing will be easier with more to say.',
    },
  },
  {
    text: '{O} wants to switch the {S} survey to camera traps, which cover more ground but miss smaller species. The method has to be locked {U}.',
    opts: {
      middle: 'Use camera traps on the wide transects and keep hand counts on a small fixed subset for the smaller species, so you gain coverage without breaking comparability. Document the split so the results are read correctly.',
      postpone: 'Run a full side-by-side pilot of both methods before deciding. Locking in a method without evidence is how surveys go wrong.',
      force: 'Keep the current method — changing mid-project breaks the time series. {O} can propose the switch for next year.',
      giveIn: 'Go with camera traps to keep {O} engaged. Small species are a minor part of the brief anyway.',
      decideForThem: 'I’ll decide the method and let you both know. You shouldn’t have to settle this between yourselves.',
      loseFocus: 'Look into drone surveys instead, which could make both methods obsolete. It’s worth getting ahead of the technology.',
    },
  },
  {
    text: 'The track to the {S} washed out overnight. I could reach it along the rocks at low tide, but that isn’t an approved route — and the reading is needed {U}.',
    opts: {
      middle: 'Stay off the unapproved route; ask {O} to cover the most time-sensitive reading from the accessible side and report the washout so a route can be cleared. Record the gap in the log rather than force the reading.',
      postpone: 'Stop all work at the station until the track is repaired. Nothing there is worth rushing.',
      force: 'Go along the rocks — it’s a short stretch and the reading matters. Take a radio and be quick.',
      giveIn: 'Drop the station from the rest of the project; it’s simpler than working around it. The other stations can carry the report.',
      decideForThem: 'I’ll go out myself and decide on the spot whether it’s safe. You stay at the lodge.',
      loseFocus: 'Use the day to catalogue old samples in the lab instead. There’s always a backlog there.',
    },
  },
  {
    text: '{O} and I disagree on whether the report should prioritise restoring the dunes or the wetland near the {S}. The steering group expects a single recommendation {U}.',
    opts: {
      middle: 'Score both options against the steering group’s own criteria — cost, ecological gain, community impact — and recommend the one that wins, stating the condition that would flip it. Ask {O} to stress-test the logic before it goes.',
      postpone: 'Present both options without a recommendation and let the steering group choose. It isn’t the team’s place to pre-empt them.',
      force: 'Recommend your option; you’ve been closer to the data than {O}. A split message weakens the report.',
      giveIn: 'Go with {O}’s view to avoid a visible split in the team. Unity matters more than which option leads.',
      decideForThem: 'I’ll make the call and present it to the steering group myself. That takes the disagreement off your shoulders.',
      loseFocus: 'Propose a larger programme that restores both at once. It sidesteps the trade-off entirely.',
    },
  },
  {
    text: 'A supplier can deliver the {S} sensors a week early if we pay a 15% rush fee, and I need an answer {U}. Without them I’ll be estimating two indicators instead of measuring them.',
    opts: {
      middle: 'Check which decisions in the report depend on those two indicators; if they drive a recommendation, pay for rush delivery of just those sensors and estimate the rest. State the method used for each indicator in the report.',
      postpone: 'Wait for the standard delivery and note the delay in the report. Spending extra on speed sets a bad precedent.',
      force: 'Pay the rush fee for the whole order — measured data always beats estimates. The budget will find a way.',
      giveIn: 'Skip the two indicators entirely so nobody questions the estimates. The report will be shorter but cleaner.',
      decideForThem: 'Send me the quote and I’ll decide with finance. You don’t need to deal with procurement.',
      loseFocus: 'Use the wait to design a new set of indicators for next year. The current ones were never ideal.',
    },
  },
  {
    text: 'A volunteer group offered to help at the {S}, but their last survey elsewhere had a high error rate. They want to know whether they’re in {U}.',
    opts: {
      middle: 'Accept them for the simpler tasks with a short calibration exercise first, and have {O} spot-check a sample of their records. You gain capacity while keeping quality visible.',
      postpone: 'Ask them to come back once their training records improve. The station can’t risk bad data right now.',
      force: 'Accept them for everything; the station needs the hands and errors can be cleaned later.',
      giveIn: 'Accept them but keep them away from any real data so nobody is upset. They’ll feel included either way.',
      decideForThem: 'I’ll decide what they can do and brief them myself. You focus on your own work.',
      loseFocus: 'Use the offer to start a citizen-science programme for the whole island. That’s a bigger opportunity than one station.',
    },
  },
];

function buildProblems(rng: Rng, day: number, rs: Researcher[], ss: Station[], temps: Template[]): Problem[] {
  const n = CONFIG.sflIsland.supportProblemsPerDay;
  const from = rng.sample([0, 1, 2, 3], n);
  const ranks = rng.shuffle([0, 1, 2].slice(0, n));
  return from.map((ri, k) => {
    const other = rng.pick([0, 1, 2, 3].filter((x) => x !== ri));
    const station = rng.int(0, ss.length - 1);
    const urgency = rng.pick(URGENCY[ranks[k]]);
    const fill = (t: string) => t.replace(/\{S\}/g, ss[station].name).replace(/\{O\}/g, first(rs[other].name)).replace(/\{U\}/g, urgency);
    const archs = ['middle', ...rng.sample(['postpone', 'force', 'giveIn', 'decideForThem', 'loseFocus'] as Archetype[], 3)] as Archetype[];
    return {
      id: `d${day}p${k}`,
      from: ri,
      other,
      station,
      deadlineRank: ranks[k],
      deadline: urgency,
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

const QUESTION_WORDING: Record<QuestionKind, string[]> = {
  strength: ['Where do you think you contribute most?', 'Which part of the project makes best use of what you know?', 'If you could pick your station, where would you add the most?'],
  mood: ['How are you doing today?', 'How is the week landing for you so far?', 'Honestly, how are you finding the workload?'],
  risk: ['What could go wrong with the work today?', 'What are you most worried we’ll miss today?', 'Where is the project most exposed right now?'],
  need: ['What does this station need today?', 'What would make the biggest difference here today?', 'Who or what is this station short of today?'],
  srisk: ['What could go wrong here today?', 'What happens here if things slip today?', 'What’s the biggest risk at this station today?'],
};

/** Same question, varied wording: the variant is fixed per person/station and day so it reads naturally. */
export function questionText(kind: QuestionKind, key = ''): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const list = QUESTION_WORDING[kind];
  return list[h % list.length];
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
