import { makeRng } from '../../lib/rng';
import { mean } from '../../lib/scoring';

export const PRIORITIES = ['Emissions impact', 'Community trust', 'Budget discipline', 'Delivery timeline'] as const;
export type Dim = 'prioritisation' | 'uncertainty' | 'messy information' | 'trade-offs' | 'stakeholders';

export interface ClassicOption {
  text: string;
  outcome: string;
  /** Effect on each priority, in PRIORITIES order (-1..1). */
  w: [number, number, number, number];
  /** Decision quality under the practice model (0..1). */
  q: number;
  /** Branch tag consumed by later decisions. */
  tag?: string;
}

export interface ClassicDecision {
  id: string;
  dim: Dim;
  title: string;
  prompt: string;
  options: ClassicOption[];
}

export interface ClassicScenario {
  programme: string;
  region: string;
  intro: string[];
  mandate: string;
  idealRanking: number[];
  decisions: (ClassicDecision | { branchOn: string; variants: Record<string, ClassicDecision>; fallback: string })[];
}

const REGIONS = ['the Vellmar coast', 'the Ostra delta', 'Harrowby Bay', 'the Kelso estuary'];
const MANDATES = [
  { text: 'The board’s mandate is unambiguous: measurable emissions cuts come first, and nothing should damage the programme’s standing with residents. The budget is fixed; the deadline matters but has some give.', ideal: [0, 1, 2, 3] },
  { text: 'The funders’ condition is that the community stays behind the programme — two earlier schemes collapsed when residents turned against them. Emissions results matter next; the budget is fixed and the timeline has some flexibility.', ideal: [1, 0, 2, 3] },
  { text: 'The grant is released only if the programme stays within budget. Within that, the board wants the largest possible emissions cut, delivered with residents’ support. The deadline is the most negotiable element.', ideal: [2, 0, 1, 3] },
];

export function generateClassic(seed: string): ClassicScenario {
  const rng = makeRng(`${seed}::sfl-classic`);
  const region = rng.pick(REGIONS);
  const m = rng.pick(MANDATES);
  const budget = rng.int(3, 9);
  const months = rng.int(10, 16);
  const programme = `${region.replace('the ', '').replace(/^\w/, (c) => c.toUpperCase())} Renewal Programme`;
  const D = (d: ClassicDecision) => d;
  return {
    programme,
    region,
    mandate: m.text,
    idealRanking: m.ideal,
    intro: [
      `You have just been appointed lead of the ${programme}, a $${budget} million effort to cut energy emissions and restore coastal habitat along ${region}. It combines three workstreams: a solar microgrid for two villages, a mangrove restoration belt, and insulation retrofits for 400 homes.`,
      `You have ${months} months. Your predecessor left suddenly, the dashboards are half-built, and several partners are waiting on decisions you have not yet been briefed on. ${m.text}`,
    ],
    decisions: [
      D({
        id: 'd1', dim: 'prioritisation', title: 'Engineering capacity',
        prompt: 'The programme has one engineering team. All three workstreams want it first: the microgrid needs grid studies, the mangrove belt needs hydrology surveys, and the retrofit needs house assessments.',
        options: [
          { text: 'Assign the team to the microgrid first. It is the largest single source of emissions savings and has the longest lead times.', outcome: 'Grid studies finish early. The mangrove and retrofit leads grumble about waiting, but understand the logic.', w: [1, -0.2, 0, 0.5], q: 0.9 },
          { text: 'Split the team three ways so every workstream can start at once.', outcome: 'Everyone starts, but each study runs at a third of the pace. By month two nothing has been completed.', w: [0, 0.4, -0.2, -0.6], q: 0.4 },
          { text: 'Start with the retrofits — homeowners will see visible progress quickly and that builds goodwill.', outcome: 'Residents notice crews on their streets and local radio is positive. The microgrid slips a month.', w: [-0.2, 1, 0, -0.2], q: 0.7 },
        ],
      }),
      D({
        id: 'd2', dim: 'uncertainty', title: 'Solar panel supplier',
        prompt: 'Two suppliers bid for the solar panels. One is 18% cheaper but has missed deliveries on two recent projects. The other is local, more expensive, and has a clean record. The data on the cheaper supplier’s delays is anecdotal.',
        options: [
          { text: 'Take the cheaper bid. The delay reports are anecdotal and the savings are certain.', outcome: 'The budget gains breathing room. The supplier promises a delivery date you cannot independently verify.', w: [0, 0, 1, -0.6], q: 0.4, tag: 'cheap' },
          { text: 'Call two of the cheaper supplier’s recent clients before deciding, and ask the local supplier whether it can sharpen its price.', outcome: 'The calls confirm one serious delay. The local supplier trims 6% off its price. You sign with the local firm.', w: [0.3, 0, 0.4, 0.3], q: 1, tag: 'local' },
          { text: 'Choose the local supplier straight away to avoid any risk.', outcome: 'Delivery is secure, but the higher price squeezes the retrofit budget later.', w: [0.2, 0.3, -0.5, 0.6], q: 0.6, tag: 'local' },
        ],
      }),
      D({
        id: 'd3', dim: 'messy information', title: 'Conflicting soil reports',
        prompt: 'Two soil reports for the mangrove site disagree. One says salinity is ideal; the other, from a different month, says it is too high for seedlings. Planting is due in six weeks.',
        options: [
          { text: 'Go with the favourable report — it is the more recent one.', outcome: 'Planting proceeds. A third of the seedlings fail in the first hot month.', w: [-0.4, 0, -0.3, 0.6], q: 0.3 },
          { text: 'Commission a quick third sample at both tide states, and prepare a salt-tolerant species mix as a fallback.', outcome: 'The new sample shows salinity swings with the tide. The mixed planting plan copes well.', w: [0.8, 0, -0.2, -0.1], q: 1 },
          { text: 'Postpone planting for a full season to run a year-long monitoring study.', outcome: 'You get excellent data, but the restoration belt will not be planted before the programme ends.', w: [0.2, -0.3, 0, -1], q: 0.4 },
        ],
      }),
      D({
        id: 'd4', dim: 'stakeholders', title: 'Fishers’ objection',
        prompt: 'The fishers’ cooperative objects to the planned mangrove zone: it covers a channel they use to reach the outer banks. They have asked for a meeting; the planning team says the zone is ecologically optimal.',
        options: [
          { text: 'Proceed with the optimal zone. The ecological case is strong and the permits are in place.', outcome: 'Planting can start on time, but the cooperative files a formal complaint with the council.', w: [0.6, -1, 0, 0.4], q: 0.3, tag: 'overrule' },
          { text: 'Meet the cooperative with the planning team and redesign the zone together, keeping a navigable channel.', outcome: 'The redesign loses 8% of planted area but the cooperative becomes an advocate for the project.', w: [0.3, 1, -0.1, -0.2], q: 1, tag: 'codesign' },
          { text: 'Move the whole zone to a less contested stretch of coast.', outcome: 'Conflict disappears, but the new site has poorer sediment and lower expected survival.', w: [-0.5, 0.6, 0, -0.3], q: 0.5, tag: 'codesign' },
        ],
      }),
      {
        branchOn: 'd2',
        fallback: 'local',
        variants: {
          cheap: D({
            id: 'd5a', dim: 'uncertainty', title: 'Panels delayed',
            prompt: 'The cheaper supplier now says panels will arrive ten weeks late. It offers a 5% discount as compensation. The local supplier could deliver half the order in four weeks at full price.',
            options: [
              { text: 'Accept the delay and the discount; reschedule the installation crews.', outcome: 'Crews sit idle for weeks; the microgrid now finishes at the very end of the programme.', w: [0, -0.2, 0.5, -1], q: 0.4 },
              { text: 'Order half from the local supplier now to keep one village on schedule, and hold the cheaper supplier to the rest.', outcome: 'One village goes live on time. Costs rise slightly but the schedule recovers.', w: [0.6, 0.3, -0.3, 0.6], q: 1 },
              { text: 'Cancel the contract entirely and re-tender.', outcome: 'The tender takes two months and legal costs eat the original savings.', w: [0, 0, -0.6, -0.8], q: 0.3 },
            ],
          }),
          local: D({
            id: 'd5b', dim: 'trade-offs', title: 'Budget pressure',
            prompt: 'The higher panel price has left the retrofit stream 7% short of what it needs to cover all 400 homes.',
            options: [
              { text: 'Reduce the retrofit to the 370 homes with the highest heat loss.', outcome: 'The emissions impact barely changes; 30 households are disappointed but understand the criteria.', w: [0.4, -0.3, 0.8, 0.2], q: 0.9 },
              { text: 'Ask the funders for a top-up before changing anything.', outcome: 'The request takes six weeks and is refused. Retrofit crews were on hold the whole time.', w: [0, 0, 0, -0.7], q: 0.4 },
              { text: 'Keep all 400 homes but use a cheaper insulation spec throughout.', outcome: 'Every household is included, but projected savings per home drop by a fifth.', w: [-0.5, 0.5, 0.6, 0], q: 0.5 },
            ],
          }),
        },
      },
      D({
        id: 'd6', dim: 'trade-offs', title: 'Underspend',
        prompt: 'The mangrove stream is running 8% under budget because volunteers have replaced some paid labour. The microgrid lead asks for the surplus to add battery storage; the community officer wants it for a public education programme.',
        options: [
          { text: 'Fund the battery storage — it raises the microgrid’s emissions savings by an estimated 12%.', outcome: 'Storage is added. The community officer feels sidelined.', w: [1, -0.3, 0, 0], q: 0.7 },
          { text: 'Fund the education programme — community understanding protects the whole programme.', outcome: 'Workshops are well attended; emissions savings are unchanged.', w: [0, 1, 0, 0], q: 0.7 },
          { text: 'Hold it as contingency until the riskiest work packages are complete.', outcome: 'The contingency later covers an unexpected repair.', w: [0, 0, 1, 0.2], q: 0.7 },
        ],
      }),
      D({
        id: 'd7', dim: 'uncertainty', title: 'Storm forecast',
        prompt: 'A forecast gives a 40% chance of a strong storm in the week planting is scheduled. Seedlings planted just before a storm would mostly be lost; delaying two weeks pushes into a hotter, drier period.',
        options: [
          { text: 'Plant as scheduled — a 40% chance means the storm is more likely not to come.', outcome: 'The storm misses the coast this time, but you took a large risk on the whole stock.', w: [0.2, 0, 0, 0.6], q: 0.4 },
          { text: 'Plant a third of the stock now and hold the rest until the forecast firms up.', outcome: 'The storm clips the coast; you lose part of the first batch but the rest goes in safely.', w: [0.6, 0, 0, 0.2], q: 1 },
          { text: 'Delay all planting by two weeks.', outcome: 'No storm comes. Survival in the hotter weeks is noticeably lower.', w: [-0.2, 0, 0, -0.4], q: 0.5 },
        ],
      }),
      D({
        id: 'd8', dim: 'messy information', title: 'Suspicious dashboard',
        prompt: 'The emissions dashboard shows savings 30% above target after one quarter. A junior analyst mentions that the baseline may have been entered in the wrong units.',
        options: [
          { text: 'Share the result with the board — it is good news and morale needs it.', outcome: 'The board celebrates. A month later the error surfaces and your credibility suffers.', w: [0, -0.5, 0, 0.2], q: 0.1 },
          { text: 'Ask the analyst to check the baseline before reporting, and tell the board a corrected figure is coming.', outcome: 'The baseline was wrong; true savings are 4% above target. The board appreciates the candour.', w: [0.3, 0.4, 0, 0], q: 1 },
          { text: 'Leave the dashboard out of this quarter’s report entirely.', outcome: 'The board asks why emissions data is missing and starts questioning the programme.', w: [0, -0.3, 0, 0], q: 0.3 },
        ],
      }),
      {
        branchOn: 'd4',
        fallback: 'codesign',
        variants: {
          overrule: D({
            id: 'd9a', dim: 'stakeholders', title: 'Protest at the shore',
            prompt: 'Fishers block access to the planting site in protest, and a local paper runs the story. Planting is halted.',
            options: [
              { text: 'Ask the council to enforce the permits so work can resume.', outcome: 'Work resumes under police watch. Relations with the village reach a low point.', w: [0.4, -1, 0, 0.4], q: 0.2 },
              { text: 'Pause work, meet the cooperative and offer to redesign the channel section.', outcome: 'A compromise is reached in ten days; the paper runs a follow-up on the turnaround.', w: [0.2, 0.9, -0.1, -0.3], q: 1 },
              { text: 'Issue a press statement explaining the ecological benefits.', outcome: 'The statement is seen as tone-deaf and the blockade continues.', w: [0, -0.4, 0, -0.4], q: 0.3 },
            ],
          }),
          codesign: D({
            id: 'd9b', dim: 'stakeholders', title: 'An offer of help',
            prompt: 'The fishers’ cooperative offers 30 volunteers for planting days, but asks that its members be paid for boat transport.',
            options: [
              { text: 'Accept the volunteers and pay for transport at standard local rates.', outcome: 'Planting doubles in pace and the partnership deepens.', w: [0.5, 0.8, -0.2, 0.5], q: 1 },
              { text: 'Accept the volunteers but decline the transport fee to protect the budget.', outcome: 'Fewer volunteers turn up than promised; the cooperative feels taken for granted.', w: [0.1, -0.4, 0.3, 0], q: 0.4 },
              { text: 'Decline politely — volunteer coordination would add management overhead.', outcome: 'The cooperative is disappointed; planting continues at the original pace.', w: [0, -0.5, 0.1, -0.1], q: 0.3 },
            ],
          }),
        },
      },
      D({
        id: 'd10', dim: 'stakeholders', title: 'Early press event',
        prompt: 'The council leader wants a press event next week to announce the programme’s success, before the first results are verified.',
        options: [
          { text: 'Agree — political support keeps doors open.', outcome: 'Good headlines, but you are now publicly tied to numbers that may change.', w: [0, 0.2, 0, 0], q: 0.4 },
          { text: 'Propose an event about progress and community involvement now, with a results announcement once figures are verified.', outcome: 'The council leader accepts; coverage focuses on residents taking part.', w: [0.1, 0.8, 0, 0], q: 1 },
          { text: 'Decline any event until the programme ends.', outcome: 'The council leader is irritated and slows a permit you need.', w: [0, -0.4, 0, -0.4], q: 0.3 },
        ],
      }),
      D({
        id: 'd11', dim: 'trade-offs', title: 'Faster retrofits',
        prompt: 'The retrofit contractor offers to finish six weeks early by switching to a thinner insulation board. Savings per home would fall by about 15%.',
        options: [
          { text: 'Accept — finishing early frees capacity for the end-of-programme push.', outcome: 'The retrofit finishes early; long-term savings are lower.', w: [-0.6, 0, 0.2, 0.8], q: 0.5 },
          { text: 'Decline — the original spec is what delivers the emissions case.', outcome: 'The retrofit finishes on the original schedule with full savings.', w: [0.8, 0, 0, -0.2], q: 0.8 },
          { text: 'Use the thinner board only on the 60 homes where wall depth makes the full spec impractical anyway.', outcome: 'You recover three weeks with almost no loss in savings.', w: [0.4, 0, 0.1, 0.4], q: 1 },
        ],
      }),
      D({
        id: 'd12', dim: 'prioritisation', title: 'The final month',
        prompt: 'With a month to go, the microgrid for the second village is three weeks behind. The funders offer a one-month extension, but it would cost 4% of the budget in extra staffing.',
        options: [
          { text: 'Take the extension and complete both villages.', outcome: 'Both villages go live; the overspend has to be explained in the final report.', w: [0.8, 0.4, -0.6, -0.5], q: 0.7 },
          { text: 'Deliver on time with one village live and a funded plan for the second.', outcome: 'You hit the deadline and budget; the second village waits two months for power.', w: [0.2, -0.2, 0.6, 0.8], q: 0.7 },
          { text: 'Ask the installation crews to work weekends to close the gap.', outcome: 'The gap closes, but two crew members are injured from fatigue and morale drops.', w: [0.4, -0.4, -0.2, 0.6], q: 0.3 },
        ],
      }),
    ],
  };
}

/** Resolve the decision list given choices so far (branching). */
export function resolveDecision(sc: ClassicScenario, idx: number, tags: Record<string, string>): ClassicDecision {
  const d = sc.decisions[idx];
  if ('variants' in d) return d.variants[tags[d.branchOn] ?? d.fallback] ?? d.variants[d.fallback];
  return d;
}

/** 1 when the ranking matches the mandate, 0 when fully reversed (normalised Spearman footrule). */
export function rankingScore(ranking: number[], ideal: number[]): number {
  const pos = (arr: number[], p: number) => arr.indexOf(p);
  const dist = [0, 1, 2, 3].reduce((a, p) => a + Math.abs(pos(ranking, p) - pos(ideal, p)), 0);
  return 1 - dist / 8;
}

/** How well a chosen option fits the player's own ranking, relative to the alternatives (0..1). */
export function alignment(ranking: number[], d: ClassicDecision, chosen: number): number {
  const weights = [0, 1, 2, 3].map((p) => 4 - ranking.indexOf(p)); // top priority weighs 4
  const fit = d.options.map((o) => o.w.reduce((a, w, i) => a + w * weights[i], 0));
  const lo = Math.min(...fit);
  const hi = Math.max(...fit);
  return hi === lo ? 1 : (fit[chosen] - lo) / (hi - lo);
}

export function dimScores(decisions: ClassicDecision[], choices: number[]): Record<Dim, number> {
  const out: Partial<Record<Dim, number[]>> = {};
  decisions.forEach((d, i) => {
    if (choices[i] === undefined) return;
    (out[d.dim] ??= []).push(d.options[choices[i]].q);
  });
  const dims: Dim[] = ['prioritisation', 'uncertainty', 'messy information', 'trade-offs', 'stakeholders'];
  return Object.fromEntries(dims.map((k) => [k, Math.round(100 * mean(out[k] ?? []))])) as Record<Dim, number>;
}
