import { CONFIG } from '../../config';
import { makeRng, type Rng } from '../../lib/rng';

export type Range = [number, number];

export interface Microbe {
  id: string;
  name: string;
  attrs: number[];
  traits: number[];
}

export interface Site {
  id: string;
  name: string;
  ranges: Range[];
  desired: number;
  undesired: number;
  /** Designed so a 100% trio is reachable. */
  solvable: boolean;
  /** Why a best-effort site can't reach 100%. */
  constraint?: { kind: 'noDesired' } | { kind: 'edge'; attr: number };
}

export interface SiteData {
  site: Site;
  /** Candidates the two locks filter into the initial pool. */
  population: Microbe[];
  /** Microbes shown one at a time in the sorting step. */
  queue: Microbe[];
  /** Fallback microbes for the offer rounds (planted trio lives here on solvable sites). */
  reserve: Microbe[];
  planted: string[];
  designedBest: Evaluation & { trio: string[] };
}

export interface Scenario {
  variant: 'default' | 'alt';
  attrNames: string[];
  traitNames: string[];
  sites: SiteData[];
}

export interface Check {
  label: string;
  pass: boolean;
  detail: string;
}

export interface Evaluation {
  checks: Check[];
  score: number;
  averages: number[];
}

export const ATTR_NAMES = ['Permeability', 'Mobility', 'Energy', 'Salinity tolerance', 'Growth rate', 'Adhesion', 'Resilience'];
export const TRAIT_NAMES = ['Phosphorus-removing', 'Light-sensitive', 'Salt-tolerant', 'Spore-forming', 'Oxygen-dependent'];
const SITE_NAMES = ['Brackwater Inlet', 'Saltmere Shelf', 'Cobalt Reach', 'Gannet Shoals', 'Ironweed Bay', 'Lantern Trench', 'Pellucid Flats', 'Skerry Sound'];
const PRE = ['Halo', 'Thermo', 'Cyano', 'Rhodo', 'Pelago', 'Litho', 'Sulfo', 'Nitro', 'Aero', 'Myxo', 'Chloro', 'Thalasso'];
const SUF = ['bacter', 'coccus', 'monas', 'spira', 'vibrio', 'philus', 'myces', 'lobus', 'fex', 'nema'];

export const inRange = (x: number, [lo, hi]: Range) => x >= lo - 1e-9 && x <= hi + 1e-9;

export function evaluate(trio: Microbe[], site: Site, attrNames: string[], traitNames: string[]): Evaluation {
  const n = site.ranges.length;
  const averages = site.ranges.map((_, k) => (trio.length ? trio.reduce((a, m) => a + m.attrs[k], 0) / trio.length : 0));
  const checks: Check[] = site.ranges.map((r, k) => ({
    label: `${attrNames[k]} average in ${r[0]}–${r[1]}`,
    pass: trio.length > 0 && inRange(averages[k], r),
    detail: averages[k].toFixed(2),
  }));
  const hasDesired = trio.some((m) => m.traits.includes(site.desired));
  const hasUndesired = trio.some((m) => m.traits.includes(site.undesired));
  checks.push({ label: `At least one is ${traitNames[site.desired]}`, pass: hasDesired, detail: hasDesired ? 'yes' : 'no' });
  checks.push({ label: `None is ${traitNames[site.undesired]}`, pass: trio.length > 0 && !hasUndesired, detail: hasUndesired ? 'present' : 'clear' });
  const passed = checks.filter((c) => c.pass).length;
  void n;
  return { checks, averages, score: Math.round((100 * passed) / checks.length) };
}

/** Practice rule for the sorting step: enough attributes in range and no undesired trait. */
export function fits(m: Microbe, site: Site): boolean {
  const need = Math.ceil((2 * site.ranges.length) / 3);
  const ok = site.ranges.filter((r, k) => inRange(m.attrs[k], r)).length;
  return ok >= need && !m.traits.includes(site.undesired);
}

export type SortCall = 'current' | 'next' | 'return';

export function correctCall(m: Microbe, sites: Site[], idx: number): SortCall {
  if (fits(m, sites[idx])) return 'current';
  if (idx < sites.length - 1 && fits(m, sites[idx + 1])) return 'next';
  return 'return';
}

export function bestTrio(pool: Microbe[], site: Site, attrNames: string[], traitNames: string[]) {
  let best: Evaluation & { trio: string[] } = { checks: [], averages: [], score: -1, trio: [] };
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++)
      for (let k = j + 1; k < pool.length; k++) {
        const e = evaluate([pool[i], pool[j], pool[k]], site, attrNames, traitNames);
        if (e.score > best.score) best = { ...e, trio: [pool[i].id, pool[j].id, pool[k].id] };
        if (best.score === 100) return best;
      }
  return best;
}

/** Locks are 'attr:k', 'desired' or 'undesired'. */
export function matchesLock(m: Microbe, site: Site, lock: string): boolean {
  if (lock === 'desired') return m.traits.includes(site.desired);
  if (lock === 'undesired') return !m.traits.includes(site.undesired);
  const k = Number(lock.split(':')[1]);
  return inRange(m.attrs[k], site.ranges[k]);
}

export function initialPool(data: SiteData, locks: string[], size = CONFIG.seaWolf.initialPool): Microbe[] {
  const score = (m: Microbe) => locks.filter((l) => matchesLock(m, data.site, l)).length;
  return data.population
    .map((m, i) => ({ m, s: score(m), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, size)
    .map((x) => x.m);
}

/** Offer rounds: reserve microbes, with non-planted slots replaced by microbes the player routed here. */
export function buildOffers(data: SiteData, routedIn: Microbe[], exclude: Set<string>): Microbe[][] {
  const { offerRounds, offerSize } = CONFIG.seaWolf;
  const incoming = routedIn.filter((m) => !exclude.has(m.id));
  const rounds: Microbe[][] = [];
  let ri = 0;
  for (let r = 0; r < offerRounds; r++) {
    const slots = data.reserve.slice(r * offerSize, (r + 1) * offerSize).map((m) => {
      if (data.planted.includes(m.id) || ri >= incoming.length) return m;
      return incoming[ri++];
    });
    rounds.push(slots);
  }
  return rounds;
}

// ---------------------------------------------------------------- generation

function microbeName(rng: Rng, used: Set<string>): string {
  for (;;) {
    const n = `${rng.pick(PRE)}${rng.pick(SUF)} ${rng.pick(['', 'ss. '])}${rng.int(10, 99)}`.replace('  ', ' ');
    if (!used.has(n)) {
      used.add(n);
      return n;
    }
  }
}

function neutralTraits(rng: Rng, pool: number, per: number, avoid: number[]): number[] {
  const opts = Array.from({ length: pool }, (_, i) => i).filter((t) => !avoid.includes(t));
  return rng.sample(opts, Math.min(per, opts.length)).sort();
}

interface Ctx {
  rng: Rng;
  nAttr: number;
  traitPool: number;
  per: number;
  used: Set<string>;
  counter: { n: number };
}

function newMicrobe(ctx: Ctx, attrs: number[], traits: number[]): Microbe {
  return { id: `m${ctx.counter.n++}`, name: microbeName(ctx.rng, ctx.used), attrs, traits };
}

function randomMicrobe(ctx: Ctx, site: Site, bias: number): Microbe {
  const { rng } = ctx;
  const attrs = site.ranges.map(([lo, hi]) => {
    if (rng.chance(bias)) return rng.int(Math.max(1, lo - 1), Math.min(10, hi + 1));
    return rng.int(1, 10);
  });
  const traits = Array.from({ length: ctx.traitPool }, (_, i) => i);
  return newMicrobe(ctx, attrs, rng.sample(traits, ctx.per).sort());
}

/** Enforce a best-effort site's constraint so 100% stays unreachable. */
function constrain(m: Microbe, site: Site, ctx: Ctx): void {
  const c = site.constraint;
  if (!c) return;
  if (c.kind === 'noDesired' && m.traits.includes(site.desired)) {
    m.traits = neutralTraits(ctx.rng, ctx.traitPool, ctx.per, [site.desired, ...m.traits.filter((t) => t !== site.desired)]).slice(0, 1);
    while (m.traits.length < ctx.per) {
      const extra = neutralTraits(ctx.rng, ctx.traitPool, 1, [site.desired, ...m.traits]);
      if (!extra.length) break;
      m.traits = [...m.traits, ...extra].sort();
    }
  }
  if (c.kind === 'edge') {
    const [lo, hi] = site.ranges[c.attr];
    // Low-edge range: every value above hi keeps the average above hi too (and vice versa).
    if (lo === 1 && m.attrs[c.attr] <= hi) m.attrs[c.attr] = ctx.rng.int(hi + 1, Math.min(10, hi + 3));
    if (hi === 10 && m.attrs[c.attr] >= lo) m.attrs[c.attr] = ctx.rng.int(Math.max(1, lo - 3), lo - 1);
  }
}

function plantTrio(ctx: Ctx, site: Site): Microbe[] {
  const { rng } = ctx;
  const cols = site.ranges.map(([lo, hi]) => {
    for (;;) {
      const target = rng.int(lo * 3, hi * 3); // sum whose average lands in range
      const a = rng.int(1, 10);
      const b = rng.int(1, 10);
      const c = target - a - b;
      if (c >= 1 && c <= 10) return rng.shuffle([a, b, c]);
    }
  });
  const avoid = [site.desired, site.undesired];
  return [0, 1, 2].map((i) => {
    const traits = i === 0 ? [site.desired, ...neutralTraits(rng, ctx.traitPool, ctx.per - 1, avoid)].sort() : neutralTraits(rng, ctx.traitPool, ctx.per, avoid);
    return newMicrobe(ctx, cols.map((col) => col[i]), traits);
  });
}

function makeSite(rng: Rng, idx: number, name: string, nAttr: number, traitPool: number, solvable: boolean): Site {
  const w = CONFIG.seaWolf.rangeWidth;
  const ranges: Range[] = Array.from({ length: nAttr }, () => {
    const lo = rng.chance(0.3) ? rng.pick([1, 11 - w]) : rng.int(2, 10 - w);
    return [lo, lo + w - 1] as Range;
  });
  const [desired, undesired] = rng.sample(Array.from({ length: traitPool }, (_, i) => i), 2);
  const site: Site = { id: `s${idx}`, name, ranges, desired, undesired, solvable };
  if (!solvable) {
    const edgeAttrs = ranges.map((r, k) => (r[0] === 1 || r[1] === 10 ? k : -1)).filter((k) => k >= 0);
    if (edgeAttrs.length && rng.chance(0.5)) site.constraint = { kind: 'edge', attr: rng.pick(edgeAttrs) };
    else site.constraint = { kind: 'noDesired' };
  }
  return site;
}

export function generateSeaWolf(seed: string, variant: 'default' | 'alt' = CONFIG.seaWolf.mode): Scenario {
  const rng = makeRng(`${seed}::seawolf`);
  const v = CONFIG.seaWolf.variants[variant];
  const cfg = CONFIG.seaWolf;
  const attrNames = ATTR_NAMES.slice(0, v.attributes);
  const traitNames = TRAIT_NAMES.slice(0, v.traitPool);
  const ctx: Ctx = { rng, nAttr: v.attributes, traitPool: v.traitPool, per: v.traitsPerMicrobe, used: new Set(), counter: { n: 0 } };

  // Guarantee a mix: at least one solvable and (with 3+ sites) at least one best-effort.
  const flags = Array.from({ length: cfg.sites }, () => rng.chance(cfg.solvableRate));
  if (!flags.some(Boolean)) flags[rng.int(0, cfg.sites - 1)] = true;
  if (cfg.sites >= 3 && flags.every(Boolean)) flags[rng.int(0, cfg.sites - 1)] = false;

  const names = rng.sample(SITE_NAMES, cfg.sites);
  const sites = flags.map((s, i) => makeSite(rng, i, names[i], v.attributes, v.traitPool, s));

  const data: SiteData[] = sites.map((site) => {
    const population = Array.from({ length: 24 }, () => randomMicrobe(ctx, site, 0.45));
    const reserve = Array.from({ length: cfg.offerRounds * cfg.offerSize }, () => randomMicrobe(ctx, site, 0.4));
    let planted: string[] = [];
    if (site.solvable) {
      const trio = plantTrio(ctx, site);
      planted = trio.map((m) => m.id);
      // One planted microbe per offer round 1–3, in a random slot.
      trio.forEach((m, r) => (reserve[r * cfg.offerSize + rng.int(0, cfg.offerSize - 1)] = m));
    }
    return { site, population, queue: [], reserve, planted, designedBest: { checks: [], averages: [], score: 0, trio: [] } };
  });

  // Sorting queue per site: a blend of fits for this site, the next site, and duds.
  data.forEach((d, i) => {
    const next = sites[i + 1];
    d.queue = Array.from({ length: cfg.queueSize }, (_, q) => {
      const target = q % 3 === 1 && next ? next : d.site;
      return randomMicrobe(ctx, target, q % 3 === 2 ? 0.1 : 0.85);
    });
    d.queue = rng.shuffle(d.queue);
  });

  // Apply best-effort constraints to everything reachable at each site. Queue microbes are reachable
  // from two sites, so repeat until no pass changes anything.
  const reachable = (i: number) => [...data[i].population, ...data[i].queue, ...data[i].reserve, ...(i > 0 ? data[i - 1].queue : [])];
  for (let pass = 0; pass < 20; pass++) {
    const before = JSON.stringify(data.map((d) => [d.queue, d.population, d.reserve]));
    data.forEach((d, i) => reachable(i).forEach((m) => constrain(m, d.site, ctx)));
    if (JSON.stringify(data.map((d) => [d.queue, d.population, d.reserve])) === before) break;
  }
  data.forEach((d, i) => (d.designedBest = bestTrio(reachable(i), d.site, attrNames, traitNames)));

  return { variant, attrNames, traitNames, sites: data };
}
