import { CONFIG } from '../../config';
import { makeRng, round2, type Rng } from '../../lib/rng';

// ---------------------------------------------------------------- types

export interface Fact {
  id: string;
  value: number;
  unit: string;
  entity: string;
  metric: string;
  year?: number;
  relevant: boolean;
}

export type Segment = string | { fact: string };

export type ChartType = 'line' | 'bar' | 'stacked' | 'pie' | 'scatter' | 'waterfall';
export const CHART_TYPES: { id: ChartType; label: string; use: string }[] = [
  { id: 'line', label: 'Line chart', use: 'trend over time' },
  { id: 'bar', label: 'Bar chart', use: 'compare categories' },
  { id: 'stacked', label: '100% stacked bar', use: 'parts of a whole' },
  { id: 'pie', label: 'Pie chart', use: 'parts of a whole' },
  { id: 'scatter', label: 'Scatter plot', use: 'relationship between two measures' },
  { id: 'waterfall', label: 'Waterfall', use: 'bridge between totals' },
];

export type Exhibit =
  | { id: string; kind: 'table'; title: string; caption?: string; columns: string[]; rows: { label: string; cells: string[] }[] }
  | { id: string; kind: 'line' | 'bar'; title: string; caption?: string; unit: string; xLabels: string[]; series: { name: string; facts: string[] }[] }
  | { id: string; kind: 'bubble'; title: string; caption: string; xLabel: string; yLabel: string; sizeLabel: string; points: { label: string; x: string; y: string; size: string }[] }
  | { id: string; kind: 'assumptions'; title: string; items: Segment[][] };

export interface Question {
  id: string;
  label: string;
  prompt: string;
  answer: number;
  unit: string;
}

export type Blank = { id: string; kind: 'choice'; options: string[]; correct: string } | { id: string; kind: 'value'; questionId: string };

export interface ChartSpec {
  correct: ChartType;
  title: string;
  categories: string[];
  values: number[];
  unit: string;
}

export interface Study {
  template: TemplateId;
  island: string;
  objective: string;
  narrative: Segment[][];
  exhibits: Exhibit[];
  facts: Record<string, Fact>;
  questions: Question[];
  report: { segments: (string | { blank: string })[]; blanks: Blank[] };
  chart: ChartSpec;
  requiredFacts: string[];
  /** Plain-language note on the deliberate trap, for the debrief. */
  trap: string;
}

export type CaseType = 'word' | 'formula' | 'verbal' | 'visual' | 'probability';

export interface Case {
  id: string;
  type: CaseType;
  title: string;
  text: Segment[][];
  exhibit?: Exhibit;
  facts: Record<string, Fact>;
  question: string;
  kind: 'numeric' | 'choice';
  options?: string[];
  answer: number | string;
  unit?: string;
  explanation: string;
}

export type TemplateId = 'largestShare' | 'highestGrowth' | 'lowestCost' | 'projection';

// ---------------------------------------------------------------- helpers

const ISLANDS = ['Red Rock', 'Isla Corvina', 'Hollin Isle', 'Skarra', 'Tamsin Key', 'Brennock', 'Marrow Island'];
const REGIONS = ['North Bank', 'Cedar Marsh', 'High Moor', 'Saltgrass Flats', 'Eastern Bluffs', 'Linden Vale', 'Quarry Point', 'Southern Fen'];
const SPECIES = [
  { name: 'river otters', unit: 'otters', role: 'ranger' },
  { name: 'marsh harriers', unit: 'harriers', role: 'field warden' },
  { name: 'pine martens', unit: 'martens', role: 'ranger' },
  { name: 'natterjack toads', unit: 'toads', role: 'survey officer' },
  { name: 'red squirrels', unit: 'squirrels', role: 'ranger' },
];

class FactBook {
  facts: Record<string, Fact> = {};
  private n = 0;
  constructor(private prefix: string) {}
  add(value: number, unit: string, entity: string, metric: string, relevant: boolean, year?: number): string {
    const id = `${this.prefix}${this.n++}`;
    this.facts[id] = { id, value, unit, entity, metric, year, relevant };
    return id;
  }
}

export const factLabel = (f: Fact) => [f.entity, f.metric, f.year, f.unit].filter((x) => x !== undefined && x !== '').join(' · ');

const pct = (a: number, b: number) => round2((100 * a) / b);
const argmax = (xs: number[]) => xs.indexOf(Math.max(...xs));
const argmin = (xs: number[]) => xs.indexOf(Math.min(...xs));
const order = (xs: number[]) => xs.map((_, i) => i).sort((a, b) => xs[b] - xs[a]);

// ---------------------------------------------------------------- noise

function noiseExhibits(rng: Rng, fb: FactBook, regions: string[], year: number, n: number): Exhibit[] {
  const builders: (() => Exhibit)[] = [
    () => {
      const months = ['May', 'Jun', 'Jul', 'Aug'];
      return {
        id: 'nx-tour',
        kind: 'line',
        title: `Visitor arrivals by month, ${year}`,
        unit: 'visitors',
        xLabels: months,
        series: [{ name: 'Visitors', facts: months.map((m) => fb.add(rng.int(8, 30) * 100, 'visitors', 'Island', `visitors ${m}`, false, year)) }],
      };
    },
    () => ({
      id: 'nx-rain',
      kind: 'bar',
      title: 'Annual rainfall by region',
      caption: 'Measured at the nearest weather station.',
      unit: 'mm',
      xLabels: regions,
      series: [{ name: `${year}`, facts: regions.map((r) => fb.add(rng.int(60, 140) * 10, 'mm', r, 'rainfall', false, year)) }],
    }),
    () => ({
      id: 'nx-staff',
      kind: 'table',
      title: 'Field staff by station',
      columns: ['Region', 'Rangers', 'Volunteers'],
      rows: regions.map((r) => ({ label: r, cells: [fb.add(rng.int(2, 6), 'staff', r, 'rangers', false, year), fb.add(rng.int(5, 25), 'people', r, 'volunteers', false, year)] })),
    }),
    () => ({
      id: 'nx-bubble',
      kind: 'bubble',
      title: 'Survey effort by region',
      caption: 'Note: bubble size shows area surveyed (km²), not the number of animals recorded.',
      xLabel: 'Survey hours',
      yLabel: 'Species recorded',
      sizeLabel: 'Area surveyed (km²)',
      points: regions.map((r) => ({
        label: r,
        x: fb.add(rng.int(80, 300), 'hours', r, 'survey hours', false, year),
        y: fb.add(rng.int(20, 60), 'species', r, 'species recorded', false, year),
        size: fb.add(rng.int(4, 30), 'km²', r, 'area surveyed', false, year),
      })),
    }),
  ];
  return rng.sample(builders, n).map((b) => b());
}

// ---------------------------------------------------------------- templates

interface Built {
  objective: string;
  narrative: Segment[][];
  exhibits: Exhibit[];
  questions: Question[];
  report: Study['report'];
  chart: ChartSpec;
  requiredFacts: string[];
  trap: string;
}

function largestShare(rng: Rng, fb: FactBook, island: string, regions: string[], year: number): Built {
  const sp = rng.pick(SPECIES);
  let t: number[], T: number[], tp: number[], Tp: number[], shares: number[];
  for (;;) {
    t = regions.map(() => rng.int(40, 120));
    T = regions.map(() => rng.int(30, 75) * 10);
    shares = t.map((x, i) => pct(x, T[i]));
    const o = order(shares);
    if (argmax(shares) !== argmax(t) && shares[o[0]] - shares[o[1]] >= 1 && shares[o[1]] - shares[o[2]] >= 0.5 && new Set(t).size === 3) break;
  }
  tp = t.map((x) => Math.max(10, x + rng.int(-25, 25)));
  Tp = T.map((x) => x + rng.int(-8, 8) * 10);
  const lead = argmax(shares);
  const o = order(shares);
  const low = o[2];
  const rawLead = argmax(t);
  const prevShare = pct(tp[lead], Tp[lead]);
  if (Math.abs(prevShare - shares[lead]) < 0.5) tp[lead] += shares[lead] > prevShare ? -6 : 6;
  const dir = shares[lead] > pct(tp[lead], Tp[lead]) ? 'increased' : 'decreased';

  const cT = regions.map((r, i) => fb.add(T[i], 'animals', r, 'wildlife recorded', true, year));
  const cTp = regions.map((r, i) => fb.add(Tp[i], 'animals', r, 'wildlife recorded', i === lead, year - 1));
  const ct = regions.map((r, i) => fb.add(t[i], sp.unit, r, sp.name, true, year));
  const ctp = regions.map((r, i) => fb.add(tp[i], sp.unit, r, sp.name, i === lead, year - 1));
  const density = regions.map((r) => fb.add(round2(rng.float(1.2, 6.5)), `${sp.unit}/km²`, r, `${sp.name} density`, false, year));

  const total = t.reduce((a, b) => a + b, 0);
  const qs: Question[] = [
    ...regions.map((r, i) => ({ id: `q1${'abc'[i]}`, label: `1${'abc'[i]}`, prompt: `What share of all wildlife recorded in ${r} in ${year} were ${sp.name}? (${sp.name} ÷ all wildlife recorded × 100)`, answer: shares[i], unit: '%' })),
    { id: 'q2', label: '2', prompt: `By how many percentage points does the highest ${sp.name} share exceed the second highest? (highest share − second-highest share)`, answer: round2(shares[o[0]] - shares[o[1]]), unit: 'pp' },
    { id: 'q3', label: '3', prompt: `The region with the highest ${sp.name} share holds what percentage of all ${sp.name} recorded across the three regions in ${year}? (region count ÷ total of the three × 100)`, answer: pct(t[lead], total), unit: '%' },
  ];
  const R = regions;
  return {
    objective: `Fund one additional ${sp.role} for the region where ${sp.name} make up the largest share of recorded wildlife in ${year}.`,
    narrative: [
      [`${island}'s conservation trust surveys wildlife across three regions every spring. This year's survey recorded `, { fact: ct[0] }, ` ${sp.name} in ${R[0]}, alongside thousands of birds, amphibians and small mammals.`],
      [`The trust can fund one more ${sp.role} next season. Board members disagree: some argue the post should go where ${sp.name} are most numerous, others where they form the biggest part of the local ecosystem. Tourism along the coast grew again this year, and several stations report staffing shortages.`],
    ],
    exhibits: [
      { id: 'ex-total', kind: 'table', title: 'All wildlife recorded, by region', columns: ['Region', `${year - 1}`, `${year}`], rows: R.map((r, i) => ({ label: r, cells: [cTp[i], cT[i]] })) },
      { id: 'ex-target', kind: 'bar', title: `${cap(sp.name)} recorded, by region`, unit: sp.unit, xLabels: R, series: [ { name: `${year - 1}`, facts: ctp }, { name: `${year}`, facts: ct } ] },
      { id: 'ex-density', kind: 'table', title: `${cap(sp.name)} density`, caption: 'Animals per km² of suitable habitat — not a count.', columns: ['Region', `Density (${sp.unit}/km²)`], rows: R.map((r, i) => ({ label: r, cells: [density[i]] })) },
    ],
    questions: qs,
    report: {
      segments: [
        `In ${year}, ${sp.name} made up the largest share of recorded wildlife in `, { blank: 'b1' }, `, at `, { blank: 'b2' }, ` of all animals recorded there. This was `, { blank: 'b3' }, ` percentage points ahead of `, { blank: 'b4' }, `. The lowest share was in `, { blank: 'b5' }, ` at `, { blank: 'b6' }, `. Although `, { blank: 'b7' }, ` recorded the most ${sp.name} in absolute terms, the leading region held `, { blank: 'b8' }, ` of all ${sp.name} across the three regions. Compared with ${year - 1}, the ${sp.name} share in the leading region `, { blank: 'b9' }, `. We recommend funding the new ${sp.role} in `, { blank: 'b10' }, '.',
      ],
      blanks: [
        { id: 'b1', kind: 'choice', options: R, correct: R[lead] },
        { id: 'b2', kind: 'value', questionId: `q1${'abc'[lead]}` },
        { id: 'b3', kind: 'value', questionId: 'q2' },
        { id: 'b4', kind: 'choice', options: R, correct: R[o[1]] },
        { id: 'b5', kind: 'choice', options: R, correct: R[low] },
        { id: 'b6', kind: 'value', questionId: `q1${'abc'[low]}` },
        { id: 'b7', kind: 'choice', options: R, correct: R[rawLead] },
        { id: 'b8', kind: 'value', questionId: 'q3' },
        { id: 'b9', kind: 'choice', options: ['increased', 'decreased'], correct: dir },
        { id: 'b10', kind: 'choice', options: R, correct: R[lead] },
      ],
    },
    chart: { correct: 'bar', title: `${cap(sp.name)} as a share of recorded wildlife, ${year}`, categories: R, values: shares, unit: '%' },
    requiredFacts: [...cT, ...ct, cTp[lead], ctp[lead]],
    trap: `${R[rawLead]} has the most ${sp.name} in raw numbers, but ${R[lead]} has the largest share. The density table measures animals per km², not counts.`,
  };
}

function highestGrowth(rng: Rng, fb: FactBook, island: string, regions: string[], year: number): Built {
  const years = [year - 3, year - 2, year - 1, year];
  let P: number[][], g: number[];
  for (;;) {
    P = regions.map(() => {
      const base = rng.int(12, 90) * 10;
      const out = [base];
      for (let k = 1; k < 4; k++) out.push(Math.max(40, Math.round(out[k - 1] * rng.float(0.85, 1.3))));
      return out;
    });
    g = P.map((p) => pct(p[3] - p[2], p[2]));
    const abs = P.map((p) => p[3] - p[2]);
    const o = order(g);
    if (argmax(g) !== argmax(abs) && g[o[0]] - g[o[1]] >= 1 && g[o[2]] < 0 && abs[argmax(abs)] > 0) break;
  }
  const colonies = regions.map((r) => `${r} colony`);
  const lead = argmax(g);
  const o = order(g);
  const low = o[2];
  const absLead = argmax(P.map((p) => p[3] - p[2]));
  const series = colonies.map((c, i) => ({ name: c, facts: years.map((y, k) => fb.add(P[i][k], 'pairs', c, 'breeding pairs', k >= 2 || (i === lead && k === 0), y)) }));
  const fledge = colonies.map((c) => fb.add(round2(rng.float(0.4, 1.6)), 'chicks/pair', c, 'fledging rate', false, year));
  const cagr = round2((Math.pow(P[lead][3] / P[lead][0], 1 / 3) - 1) * 100);
  const required = [...series.flatMap((s) => s.facts.slice(2)), series[lead].facts[0]];
  const C = colonies;
  return {
    objective: `Expand the nesting programme at the seabird colony with the highest percentage growth in breeding pairs from ${year - 1} to ${year}.`,
    narrative: [
      [`Puffin-like auks nest on three cliff colonies around ${island}. Wardens count breeding pairs each June. The nesting programme (artificial burrows and predator fencing) can be expanded at one colony next year.`],
      [`Last year, `, { fact: series[absLead].facts[3] }, ` pairs were counted at ${C[absLead]}, the most visible colony from the visitor path. Fledging rates vary with weather and are reported separately.`],
    ],
    exhibits: [
      { id: 'ex-pop', kind: 'line', title: `Breeding pairs by colony, ${years[0]}–${year}`, unit: 'pairs', xLabels: years.map(String), series },
      { id: 'ex-fledge', kind: 'table', title: `Fledging rate, ${year}`, caption: 'Chicks fledged per breeding pair.', columns: ['Colony', 'Chicks per pair'], rows: C.map((c, i) => ({ label: c, cells: [fledge[i]] })) },
      { id: 'ex-assume', kind: 'assumptions', title: 'Assumptions', items: [[`Growth rate (%) = (pairs this year − pairs last year) ÷ pairs last year × 100.`], [`Compound annual growth rate (CAGR) over n years = ((end ÷ start)^(1/n) − 1) × 100.`], [`Fledging rate does not affect next year's count of breeding pairs.`]] },
    ],
    questions: [
      ...C.map((c, i) => ({ id: `q1${'abc'[i]}`, label: `1${'abc'[i]}`, prompt: `What was the percentage growth in breeding pairs at ${c} from ${year - 1} to ${year}?`, answer: g[i], unit: '%' })),
      { id: 'q2', label: '2', prompt: 'By how many percentage points does the highest growth rate exceed the second highest?', answer: round2(g[o[0]] - g[o[1]]), unit: 'pp' },
      { id: 'q3', label: '3', prompt: `For the fastest-growing colony, what is the compound annual growth rate from ${years[0]} to ${year} (3 years)?`, answer: cagr, unit: '%' },
    ],
    report: {
      segments: [
        `From ${year - 1} to ${year}, breeding pairs grew fastest at `, { blank: 'b1' }, `, up `, { blank: 'b2' }, `. That is `, { blank: 'b3' }, ` percentage points more than `, { blank: 'b4' }, `. Pairs at `, { blank: 'b5' }, ` `, { blank: 'b6' }, `, changing by `, { blank: 'b7' }, `. While `, { blank: 'b8' }, ` added the most pairs in absolute terms, the leading colony has grown at a compound rate of `, { blank: 'b9' }, ` a year since ${years[0]}. We recommend expanding the programme at `, { blank: 'b10' }, '.',
      ],
      blanks: [
        { id: 'b1', kind: 'choice', options: C, correct: C[lead] },
        { id: 'b2', kind: 'value', questionId: `q1${'abc'[lead]}` },
        { id: 'b3', kind: 'value', questionId: 'q2' },
        { id: 'b4', kind: 'choice', options: C, correct: C[o[1]] },
        { id: 'b5', kind: 'choice', options: C, correct: C[low] },
        { id: 'b6', kind: 'choice', options: ['increased', 'decreased'], correct: 'decreased' },
        { id: 'b7', kind: 'value', questionId: `q1${'abc'[low]}` },
        { id: 'b8', kind: 'choice', options: C, correct: C[absLead] },
        { id: 'b9', kind: 'value', questionId: 'q3' },
        { id: 'b10', kind: 'choice', options: C, correct: C[lead] },
      ],
    },
    chart: { correct: 'line', title: `Breeding pairs at ${C[lead]}, ${years[0]}–${year}`, categories: years.map(String), values: P[lead], unit: 'pairs' },
    requiredFacts: required,
    trap: `${C[absLead]} added the most pairs in absolute terms, but ${C[lead]} grew fastest in percentage terms. Fledging rate is irrelevant to the objective.`,
  };
}

function lowestCost(rng: Rng, fb: FactBook, island: string, _regions: string[], year: number): Built {
  const M = rng.sample(['Seed-ball planting', 'Hand transplanting', 'Drone seeding', 'Plug planting', 'Turf relocation'], 3);
  let cost: number[], planted: number[], surv: number[], cpr: number[];
  for (;;) {
    cost = M.map(() => rng.int(18, 60) * 10);
    planted = M.map(() => rng.int(20, 90));
    surv = M.map(() => rng.int(35, 95));
    cpr = M.map((_, i) => round2(cost[i] / ((planted[i] * surv[i]) / 100)));
    const cpp = M.map((_, i) => cost[i] / planted[i]);
    const o = order(cpr.map((x) => -x));
    if (argmin(cpp) !== argmin(cpr) && cpr[o[1]] - cpr[o[0]] > 0.5 && cpr[o[2]] - cpr[o[1]] > 0.5) break;
  }
  const lead = argmin(cpr);
  const o = order(cpr.map((x) => -x));
  const high = o[2];
  const planLead = argmin(M.map((_, i) => cost[i] / planted[i]));
  const fCost = M.map((m, i) => fb.add(cost[i], '$k', m, 'programme cost', true, year));
  const fPlant = M.map((m, i) => fb.add(planted[i], 'ha', m, 'hectares planted', true, year));
  const fSurv = M.map((m, i) => fb.add(surv[i], '%', m, 'survival rate', true, year));
  const fCrew = M.map((m) => fb.add(rng.int(3, 14), 'people', m, 'crew size', false, year));
  const fPrev = M.map((m) => fb.add(rng.int(15, 55) * 10, '$k', m, 'programme cost', false, year - 1));
  const restored = M.map((_, i) => (planted[i] * surv[i]) / 100);
  const wavg = round2(cost.reduce((a, b) => a + b, 0) / restored.reduce((a, b) => a + b, 0));
  return {
    objective: `Scale up the seagrass restoration method with the lowest cost per hectare successfully restored in ${year}.`,
    narrative: [
      [`Seagrass meadows around ${island} shelter juvenile fish and lock away carbon. In ${year} the restoration team trialled three methods in parallel along the western shore.`],
      [`Not every planted hectare takes root: storms and grazing turtles remove part of each planting, so the team tracks survival separately. Crew sizes differed between trials, and ${year - 1} budgets were set before the method trials began.`],
    ],
    exhibits: [
      { id: 'ex-cost', kind: 'table', title: 'Programme cost by method ($ thousands)', columns: ['Method', `${year - 1} budget`, `${year} actual`], rows: M.map((m, i) => ({ label: m, cells: [fPrev[i], fCost[i]] })) },
      { id: 'ex-plant', kind: 'bar', title: `Hectares planted, ${year}`, unit: 'ha', xLabels: M, series: [{ name: 'Planted', facts: fPlant }] },
      { id: 'ex-ops', kind: 'table', title: 'Trial operations', columns: ['Method', 'Survival rate (%)', 'Crew size'], rows: M.map((m, i) => ({ label: m, cells: [fSurv[i], fCrew[i]] })) },
      { id: 'ex-assume', kind: 'assumptions', title: 'Assumptions', items: [['Hectares restored = hectares planted × survival rate.'], ['Cost per hectare restored = total programme cost ÷ hectares restored.'], ['All costs are in $ thousands; ignore inflation.']] },
    ],
    questions: [
      ...M.map((m, i) => ({ id: `q1${'abc'[i]}`, label: `1${'abc'[i]}`, prompt: `What was the cost per hectare restored for ${m} in ${year}? ($ thousands)`, answer: cpr[i], unit: '$k' })),
      { id: 'q2', label: '2', prompt: 'By what percentage is the cheapest method’s cost per restored hectare lower than the second cheapest? ((second − cheapest) ÷ second × 100)', answer: pct(cpr[o[1]] - cpr[o[0]], cpr[o[1]]), unit: '%' },
      { id: 'q3', label: '3', prompt: 'What is the overall cost per hectare restored across all three methods combined? (total cost ÷ total hectares restored)', answer: wavg, unit: '$k' },
    ],
    report: {
      segments: [
        `In ${year}, `, { blank: 'b1' }, ` restored seagrass most cheaply, at `, { blank: 'b2' }, ` per hectare restored — `, { blank: 'b3' }, ` lower than `, { blank: 'b4' }, `. Across all three methods, restoration cost `, { blank: 'b5' }, ` per hectare, so the leading method sits `, { blank: 'b6' }, ` the programme average. `, { blank: 'b7' }, ` looked cheapest per hectare planted, but lost more ground to storms and grazing. The most expensive method, `, { blank: 'b8' }, `, cost `, { blank: 'b9' }, ` per hectare restored. We recommend scaling up `, { blank: 'b10' }, '.',
      ],
      blanks: [
        { id: 'b1', kind: 'choice', options: M, correct: M[lead] },
        { id: 'b2', kind: 'value', questionId: `q1${'abc'[lead]}` },
        { id: 'b3', kind: 'value', questionId: 'q2' },
        { id: 'b4', kind: 'choice', options: M, correct: M[o[1]] },
        { id: 'b5', kind: 'value', questionId: 'q3' },
        { id: 'b6', kind: 'choice', options: ['above', 'below'], correct: cpr[lead] < wavg ? 'below' : 'above' },
        { id: 'b7', kind: 'choice', options: M, correct: M[planLead] },
        { id: 'b8', kind: 'choice', options: M, correct: M[high] },
        { id: 'b9', kind: 'value', questionId: `q1${'abc'[high]}` },
        { id: 'b10', kind: 'choice', options: M, correct: M[lead] },
      ],
    },
    chart: { correct: 'bar', title: `Cost per hectare restored, ${year} ($k)`, categories: M, values: cpr, unit: '$k' },
    requiredFacts: [...fCost, ...fPlant, ...fSurv],
    trap: `${M[planLead]} is cheapest per hectare planted, but survival rates change the ranking. Crew size and ${year - 1} budgets are noise.`,
  };
}

function projection(rng: Rng, fb: FactBook, island: string, regions: string[], year: number): Built {
  const Z = regions.map((r) => `${r} reef`);
  const n = 3;
  let A: number[], g: number[], proj: number[];
  for (;;) {
    A = Z.map(() => rng.int(20, 80) * 5);
    g = Z.map(() => rng.int(-6, 18));
    proj = A.map((a, i) => round2(a * Math.pow(1 + g[i] / 100, n)));
    const o = order(proj);
    if (argmax(A) !== argmax(proj) && proj[o[0]] - proj[o[1]] > 2 && g.some((x) => x < 0) && g.filter((x) => x < 0).length === 1) break;
  }
  const lead = argmax(proj);
  const decl = g.findIndex((x) => x < 0);
  const curLead = argmax(A);
  const fA = Z.map((z, i) => fb.add(A[i], 'ha', z, 'live coral cover', true, year));
  const fG = Z.map((z, i) => fb.add(g[i], '%', z, 'annual change in coral cover', true));
  const fTemp = Z.map((z) => fb.add(round2(rng.float(26, 30.5)), '°C', z, 'peak sea temperature', false, year));
  const fDive = Z.map((z) => fb.add(rng.int(4, 40) * 100, 'dives', z, 'recreational dives', false, year));
  const total = round2(proj.reduce((a, b) => a + b, 0));
  const traj = [0, 1, 2, 3].map((k) => round2(A[lead] * Math.pow(1 + g[lead] / 100, k)));
  return {
    objective: `Prioritise the reef zone projected to have the largest area of live coral cover in ${year + n}.`,
    narrative: [
      [`Three reef zones fringe ${island}. Divers mapped live coral cover in ${year}, and the marine team has estimated each zone's typical annual rate of change from past surveys.`],
      [`Funding will go to the zone expected to hold the most living coral in ${year + n}. Peak sea temperatures and dive tourism were also logged this year; the team notes these are already reflected in the annual change estimates.`],
    ],
    exhibits: [
      { id: 'ex-cover', kind: 'bar', title: `Live coral cover, ${year} (hectares)`, unit: 'ha', xLabels: Z, series: [{ name: `${year}`, facts: fA }] },
      { id: 'ex-env', kind: 'table', title: `Zone conditions, ${year}`, columns: ['Zone', 'Peak temperature (°C)', 'Recreational dives'], rows: Z.map((z, i) => ({ label: z, cells: [fTemp[i], fDive[i]] })) },
      { id: 'ex-assume', kind: 'assumptions', title: 'Assumptions', items: [...Z.map((z, i) => [`${z}: live coral cover changes by `, { fact: fG[i] }, ' each year, compounding.'] as Segment[]), [`Projected cover after n years = current cover × (1 + annual change)^n.`]] },
    ],
    questions: [
      ...Z.map((z, i) => ({ id: `q1${'abc'[i]}`, label: `1${'abc'[i]}`, prompt: `What is the projected live coral cover at ${z} in ${year + n}? (hectares)`, answer: proj[i], unit: 'ha' })),
      { id: 'q2', label: '2', prompt: `What is the combined projected live coral cover across all three zones in ${year + n}? (hectares)`, answer: total, unit: 'ha' },
      { id: 'q3', label: '3', prompt: `What share of the combined ${year + n} coral cover will the leading zone hold? (%)`, answer: pct(proj[lead], total), unit: '%' },
    ],
    report: {
      segments: [
        `By ${year + n}, `, { blank: 'b1' }, ` is projected to hold the most live coral, at `, { blank: 'b2' }, `. Today `, { blank: 'b3' }, ` has the largest cover, but it is overtaken. Combined cover across the three zones reaches `, { blank: 'b4' }, `, of which the leading zone holds `, { blank: 'b5' }, `. Coral at `, { blank: 'b6' }, ` is expected to `, { blank: 'b7' }, `, reaching `, { blank: 'b8' }, `. We recommend prioritising `, { blank: 'b9' }, '.',
      ],
      blanks: [
        { id: 'b1', kind: 'choice', options: Z, correct: Z[lead] },
        { id: 'b2', kind: 'value', questionId: `q1${'abc'[lead]}` },
        { id: 'b3', kind: 'choice', options: Z, correct: Z[curLead] },
        { id: 'b4', kind: 'value', questionId: 'q2' },
        { id: 'b5', kind: 'value', questionId: 'q3' },
        { id: 'b6', kind: 'choice', options: Z, correct: Z[decl] },
        { id: 'b7', kind: 'choice', options: ['grow', 'shrink'], correct: 'shrink' },
        { id: 'b8', kind: 'value', questionId: `q1${'abc'[decl]}` },
        { id: 'b9', kind: 'choice', options: Z, correct: Z[lead] },
      ],
    },
    chart: { correct: 'line', title: `Projected live coral cover at ${Z[lead]}, ${year}–${year + n} (ha)`, categories: [0, 1, 2, 3].map((k) => String(year + k)), values: traj, unit: 'ha' },
    requiredFacts: [...fA, ...fG],
    trap: `${Z[curLead]} has the most coral today, but compounding growth changes the ${year + n} ranking. Temperature and dive counts are already reflected in the change rates.`,
  };
}

const TEMPLATES: Record<TemplateId, typeof largestShare> = { largestShare, highestGrowth, lowestCost, projection };

export function generateStudy(seed: string, template?: TemplateId): Study {
  const rng = makeRng(`${seed}::redrock`);
  const id = template ?? rng.pick(Object.keys(TEMPLATES) as TemplateId[]);
  const fb = new FactBook('f');
  const island = rng.pick(ISLANDS);
  const regions = rng.sample(REGIONS, 3);
  const year = rng.int(2022, 2025);
  const built = TEMPLATES[id](rng, fb, island, regions, year);
  const noise = noiseExhibits(rng, fb, regions, year, rng.int(CONFIG.redRock.noiseExhibitsMin, CONFIG.redRock.noiseExhibitsMax));
  // Keep assumptions last, mix noise among the data exhibits.
  const assumptions = built.exhibits.filter((e) => e.kind === 'assumptions');
  const data = rng.shuffle([...built.exhibits.filter((e) => e.kind !== 'assumptions'), ...noise]);
  return { template: id, island, ...built, exhibits: [...data, ...assumptions], facts: fb.facts };
}

/** The spec's worked example, reproduced exactly (used as a fixed regression test). */
export function workedExample() {
  const counts = [96, 75, 60];
  const totals = [640, 410, 520];
  const shares = counts.map((c, i) => pct(c, totals[i]));
  const o = order(shares);
  return { shares, lead: round2(shares[o[0]] - shares[o[1]]), shareOfAll: pct(counts[argmax(shares)], counts.reduce((a, b) => a + b, 0)), rawLeader: argmax(counts), shareLeader: argmax(shares) };
}

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------- cases

type CaseBuilder = (rng: Rng, id: string) => Case;

const CASES: Record<CaseType, CaseBuilder[]> = {
  word: [
    (rng, id) => {
      const fb = new FactBook(`${id}f`);
      const e = rng.int(30, 90) * 100;
      const p = rng.int(8, 35);
      const fe = fb.add(e, 'kWh/day', 'Desalination plant', 'energy use', true);
      const fp = fb.add(p, '%', 'New membrane', 'energy saving', true);
      fb.add(rng.int(2, 9) * 1000, 'm³/day', 'Desalination plant', 'water output', false);
      return {
        id, type: 'word', title: 'Desalination energy', facts: fb.facts, kind: 'numeric', unit: 'kWh/day',
        text: [[`A coastal desalination plant uses `, { fact: fe }, ` of electricity. Engineers propose a new membrane that cuts energy use by `, { fact: fp }, ` while keeping water output unchanged.`]],
        question: 'What would the plant’s daily energy use be with the new membrane? (kWh/day, 2 dp)',
        answer: round2(e * (1 - p / 100)),
        explanation: 'New use = current use × (1 − saving).',
      };
    },
    (rng, id) => {
      const fb = new FactBook(`${id}f`);
      const n = rng.int(6, 14);
      const k = rng.int(8, 25);
      const T = rng.int(20, 90) * 100;
      const fn = fb.add(n, 'trees/hour', 'Volunteer', 'planting rate', true);
      const fk = fb.add(k, 'people', 'Team', 'volunteers', true);
      const fT = fb.add(T, 'trees', 'Hillside', 'planting target', true);
      fb.add(rng.int(3, 8), 'km', 'Hillside', 'distance from lodge', false);
      return {
        id, type: 'word', title: 'Reforestation crew', facts: fb.facts, kind: 'numeric', unit: 'hours',
        text: [[`Each volunteer plants `, { fact: fn }, `. A team of `, { fact: fk }, ` will replant a burned hillside with `, { fact: fT }, `.`]],
        question: 'How many hours will the team need, working together? (2 dp)',
        answer: round2(T / (n * k)),
        explanation: 'Hours = trees ÷ (rate × people).',
      };
    },
    (rng, id) => {
      const fb = new FactBook(`${id}f`);
      const W = rng.int(30, 120) * 100;
      const r = rng.int(18, 40);
      const r2 = r + rng.int(5, 20);
      const fW = fb.add(W, 'tonnes', 'Town', 'household waste', true);
      const fr = fb.add(r, '%', 'Town', 'current recycling rate', true);
      const f2 = fb.add(r2, '%', 'Town', 'target recycling rate', true);
      return {
        id, type: 'word', title: 'Recycling target', facts: fb.facts, kind: 'numeric', unit: 'tonnes',
        text: [[`A harbour town produces `, { fact: fW }, ` of household waste a year and recycles `, { fact: fr }, ` of it. The council has set a target of `, { fact: f2 }, `.`]],
        question: 'How many additional tonnes a year must be recycled to hit the target? (2 dp)',
        answer: round2((W * (r2 - r)) / 100),
        explanation: 'Extra = waste × (target − current) percentage points ÷ 100.',
      };
    },
    (rng, id) => {
      const fb = new FactBook(`${id}f`);
      const P = rng.int(40, 90) * 100;
      const H = round2(rng.int(30, 55) / 10);
      const N = rng.int(3, 12);
      const fP = fb.add(P, 'MWh/yr', 'Turbine', 'output', true);
      const fH = fb.add(H, 'MWh/yr', 'Household', 'electricity use', true);
      const fN = fb.add(N, 'turbines', 'Wind farm', 'size', true);
      return {
        id, type: 'word', title: 'Wind farm', facts: fb.facts, kind: 'numeric', unit: 'households',
        text: [[`A proposed wind farm has `, { fact: fN }, `, each generating `, { fact: fP }, `. An average island household uses `, { fact: fH }, `.`]],
        question: 'How many households could the wind farm supply? (2 dp)',
        answer: round2((N * P) / H),
        explanation: 'Households = turbines × output ÷ household use.',
      };
    },
  ],
  formula: [
    (rng, id) => {
      const opts = ['(C₁ + C₂) ÷ (N₁ + N₂)', '(C₁ ÷ N₁ + C₂ ÷ N₂) ÷ 2', '(C₁ − C₂) ÷ (N₁ − N₂)', '(N₁ + N₂) ÷ (C₁ + C₂)'];
      return {
        id, type: 'formula', title: 'Nursery costs', facts: {}, kind: 'choice', options: rng.shuffle(opts), answer: opts[0],
        text: [['Two plant nurseries supply seedlings. Nursery 1 spent C₁ to grow N₁ seedlings; Nursery 2 spent C₂ to grow N₂. Volumes differ widely between the two.']],
        question: 'Which formula gives the average cost per seedling across both nurseries?',
        explanation: 'With unequal volumes, the true average is total cost ÷ total seedlings, not the mean of the two unit costs.',
      };
    },
    (rng, id) => {
      const opts = ['(b − a) ÷ a × 100', 'b − a', '(b − a) ÷ b × 100', 'b ÷ a'];
      return {
        id, type: 'formula', title: 'Share change', facts: {}, kind: 'choice', options: rng.shuffle(opts), answer: opts[0],
        text: [['The share of electricity from renewables on an island rose from a% to b%.']],
        question: 'Which formula gives the percent change (not the percentage-point change) in the renewable share?',
        explanation: 'Percent change is relative to the starting value; b − a is the percentage-point change.',
      };
    },
    (rng, id) => {
      const opts = ['(E ÷ S)^(1/n) − 1', '(E − S) ÷ S ÷ n', '(E ÷ S) ÷ n', '(E − S)^(1/n)'];
      return {
        id, type: 'formula', title: 'Compound growth', facts: {}, kind: 'choice', options: rng.shuffle(opts), answer: opts[0],
        text: [['A kelp forest covered S hectares at the start of a restoration project and E hectares n years later.']],
        question: 'Which formula gives the compound annual growth rate?',
        explanation: 'CAGR = (end ÷ start)^(1/n) − 1. Dividing simple growth by n ignores compounding.',
      };
    },
    (rng, id) => {
      const opts = ['Animals counted ÷ habitat area', 'Habitat area ÷ animals counted', 'Animals counted × habitat area', 'Animals counted ÷ total island area'];
      return {
        id, type: 'formula', title: 'Habitat density', facts: {}, kind: 'choice', options: rng.shuffle(opts), answer: opts[0],
        text: [['Rangers want to compare how crowded two wetland habitats are for a protected wader species. Each habitat has a different area, and the island also has large areas of farmland the birds never use.']],
        question: 'Which formula best measures density for this comparison?',
        explanation: 'Density uses the habitat the species actually uses, not the whole island.',
      };
    },
  ],
  verbal: [
    (rng, id) => {
      const fb = new FactBook(`${id}f`);
      const names = rng.sample(['Ash Cove', 'Birch Point', 'Crane Lake'], 3);
      const a = names.map(() => rng.int(120, 480));
      const b = names.map(() => rng.int(120, 480));
      const variant = rng.int(0, 2);
      const i = rng.int(0, 2);
      // Avoid a tie with the average, which would make the 'more/fewer' statement ambiguous.
      if ((a[i] + b[i]) * 3 === a.concat(b).reduce((x, y) => x + y, 0)) a[i] += 1;
      const exhibit: Exhibit = {
        id: `${id}-ex`, kind: 'table', title: 'Volunteer hours logged', columns: ['Site', 'Spring', 'Autumn'],
        rows: names.map((n, i) => ({ label: n, cells: [fb.add(a[i], 'hours', n, 'spring hours', true), fb.add(b[i], 'hours', n, 'autumn hours', true)] })),
      };
      const statement =
        variant === 0
          ? `${names[i]} logged ${a[i] + b[i] > (a.concat(b).reduce((x, y) => x + y, 0)) / 3 ? 'more' : 'fewer'} hours across both seasons than the average site.`
          : variant === 1
            ? `${names[i]} logged ${a[i] > b[i] ? 'fewer' : 'more'} hours in spring than in autumn.`
            : `${names[i]}'s autumn hours ${b[i] > a[i] ? 'rose' : 'fell'} because of weather.`;
      const answer = variant === 0 ? 'True' : variant === 1 ? 'False' : 'Cannot tell';
      return {
        id, type: 'verbal', title: 'Volunteer hours', facts: fb.facts, exhibit, kind: 'choice', options: ['True', 'False', 'Cannot tell'], answer,
        text: [['Three sites run seasonal clean-up days. The table shows hours logged by volunteers.']],
        question: `Based only on the information given, is this statement true, false, or can’t you tell? “${statement}”`,
        explanation: variant === 2 ? 'The data shows no cause, so the claim about weather cannot be verified.' : 'Check the statement directly against the table.',
      };
    },
    (rng, id) => {
      const fb = new FactBook(`${id}f`);
      const before = rng.int(40, 80);
      const after = before + rng.int(-15, 20);
      const fa = fb.add(before, 'nests', 'Beach', 'turtle nests before lighting ban', true);
      const fbf = fb.add(after, 'nests', 'Beach', 'turtle nests after lighting ban', true);
      const variant = rng.int(0, 1);
      return {
        id, type: 'verbal', title: 'Lighting ban', facts: fb.facts, kind: 'choice', options: ['True', 'False', 'Cannot tell'],
        answer: variant === 0 ? 'Cannot tell' : after > before ? 'True' : 'False',
        text: [[`A beach recorded `, { fact: fa }, ` the season before a coastal lighting ban and `, { fact: fbf }, ` the season after. Sea temperatures were also unusually warm that year.`]],
        question: variant === 0 ? '“The lighting ban caused the change in nest numbers.”' : '“More nests were recorded after the lighting ban than before it.”',
        explanation: variant === 0 ? 'A before/after change with another factor at play does not show causation.' : 'Compare the two counts directly.',
      };
    },
  ],
  visual: [
    (rng, id) => {
      const items: [string, ChartType][] = [
        ['how a reserve’s annual budget is split across five programmes', 'pie'],
        ['monthly river levels over the past two years', 'line'],
        ['nesting success across four beaches this season', 'bar'],
        ['whether larger reefs host more fish species', 'scatter'],
        ['how island emissions moved from the 2023 total to the 2024 total through four drivers', 'waterfall'],
      ];
      const [msg, ans] = rng.pick(items);
      const label = (c: ChartType) => CHART_TYPES.find((x) => x.id === c)!.label;
      const opts = rng.shuffle(['line', 'bar', 'pie', 'scatter', 'waterfall'] as ChartType[]).map(label);
      return {
        id, type: 'visual', title: 'Choosing a chart', facts: {}, kind: 'choice', options: opts, answer: label(ans),
        text: [[`A report needs one chart to show ${msg}.`]],
        question: 'Which chart type communicates this message best?',
        explanation: 'Trend → line; parts of a whole → pie; compare categories → bar; relationship → scatter; bridge between totals → waterfall.',
      };
    },
  ],
  probability: [
    (rng, id) => {
      const fb = new FactBook(`${id}f`);
      const N = rng.int(30, 60);
      const j = rng.int(8, Math.floor(N / 2));
      const fN = fb.add(N, 'turtles', 'Tagging study', 'tagged turtles', true);
      const fj = fb.add(j, 'turtles', 'Tagging study', 'juveniles', true);
      return {
        id, type: 'probability', title: 'Tagged turtles', facts: fb.facts, kind: 'numeric', unit: '%',
        text: [[`Of `, { fact: fN }, ` in a study, `, { fact: fj }, ` are juveniles. Two turtles are picked at random for a health check, without replacement.`]],
        question: 'What is the probability that both are juveniles? (%, 2 dp)',
        answer: round2(((j / N) * ((j - 1) / (N - 1))) * 100),
        explanation: 'P = j/N × (j − 1)/(N − 1).',
      };
    },
  ],
};

export function generateCases(seed: string): Case[] {
  const rng = makeRng(`${seed}::redrock-cases`);
  const types: CaseType[] = ['word', 'formula', 'verbal', 'visual', rng.pick(['word', 'probability', 'formula'] as CaseType[]), rng.pick(['word', 'verbal', 'probability'] as CaseType[])];
  const used = new Map<CaseType, number[]>();
  return rng.shuffle(types).map((t, i) => {
    const pool = CASES[t].map((_, k) => k).filter((k) => !(used.get(t) ?? []).includes(k));
    const k = pool.length ? rng.pick(pool) : rng.int(0, CASES[t].length - 1);
    used.set(t, [...(used.get(t) ?? []), k]);
    return CASES[t][k](rng, `c${i}`);
  });
}

export function checkNumeric(user: number | null | undefined, answer: number): boolean {
  return user !== null && user !== undefined && Number.isFinite(user) && Math.abs(user - answer) <= CONFIG.redRock.answerTolerance;
}
