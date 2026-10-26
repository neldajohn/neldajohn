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

/**
 * Practice sorting rule. Only one characteristic of the next site is shown (its desired trait),
 * so "next" means: not a fit here, but carries the next site's desired trait.
 */
export function correctCall(m: Microbe, sites: Site[], idx: number): SortCall {
  if (fits(m, sites[idx])) return 'current';
  if (idx < sites.length - 1 && m.traits.includes(sites[idx + 1].desired)) return 'next';
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
  const fresh = routedIn.filter((m) => !exclude.has(m.id));
  // A planted microbe the player routed here always makes it into an offer round.
  const incoming = [...fresh.filter((m) => data.planted.includes(m.id)), ...fresh.filter((m) => !data.planted.includes(m.id))];
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
  hard: boolean;
  /** Desired traits of every best-effort 'noDesired' site; stripping one must not add another. */
  banned: number[];
}

function newMicrobe(ctx: Ctx, attrs: number[], traits: number[]): Microbe {
  return { id: `m${ctx.counter.n++}`, name: microbeName(ctx.rng, ctx.used), attrs, traits };
}

function randomMicrobe(ctx: Ctx, site: Site, bias: number, forceDesired = false): Microbe {
  const { rng } = ctx;
  const attrs = site.ranges.map(([lo, hi]) => {
    if (rng.chance(bias)) return rng.int(Math.max(1, lo - 1), Math.min(10, hi + 1));
    return rng.int(1, 10);
  });
  const all = Array.from({ length: ctx.traitPool }, (_, i) => i);
  let traits = rng.sample(all, ctx.per).sort();
  if (forceDesired && !traits.includes(site.desired)) traits = [site.desired, ...traits.slice(1)].sort();
  // Hard mode: the desired trait is scarce.
  else if (!forceDesired && ctx.hard && traits.includes(site.desired) && !rng.chance(CONFIG.seaWolf.hard.desiredKeep)) {
    traits = neutralTraits(rng, ctx.traitPool, ctx.per, [site.desired]);
  }
  return newMicrobe(ctx, attrs, traits);
}

const outOfRange = (rng: Rng, [lo, hi]: Range) => rng.pick([...Array.from({ length: lo - 1 }, (_, i) => i + 1), ...Array.from({ length: 10 - hi }, (_, i) => hi + 1 + i)]);

/** Hard-mode decoy: looks strong (most attributes in range) but one attribute sits far out and wrecks the average. */
function nearMiss(ctx: Ctx, site: Site): Microbe {
  const { rng } = ctx;
  const bad = rng.int(0, site.ranges.length - 1);
  const attrs = site.ranges.map(([lo, hi], k) => {
    if (k !== bad) return rng.int(lo, hi);
    return lo - 1 > 10 - hi ? rng.int(1, Math.max(1, lo - 3)) : rng.int(Math.min(10, hi + 3), 10);
  });
  const roll = rng.next();
  const traits =
    roll < 0.25 ? [site.desired, ...neutralTraits(rng, ctx.traitPool, ctx.per - 1, [site.desired, site.undesired])].sort() // tempting: has the desired trait
      : roll < 0.55 ? [site.undesired, ...neutralTraits(rng, ctx.traitPool, ctx.per - 1, [site.desired, site.undesired])].sort() // great numbers, banned trait
        : neutralTraits(rng, ctx.traitPool, ctx.per, [site.desired]);
  return newMicrobe(ctx, attrs, traits);
}

/** Enforce a best-effort site's constraint so 100% stays unreachable. */
function constrain(m: Microbe, site: Site, ctx: Ctx): void {
  const c = site.constraint;
  if (!c) return;
  if (c.kind === 'noDesired' && m.traits.includes(site.desired)) {
    const avoid = [site.desired, ...ctx.banned];
    const keep = m.traits.filter((t) => !avoid.includes(t));
    m.traits = [...keep, ...neutralTraits(ctx.rng, ctx.traitPool, ctx.per - keep.length, [...avoid, ...keep])].sort();
  }
  if (c.kind === 'edge') {
    const [lo, hi] = site.ranges[c.attr];
    // Low-edge range: every value above hi keeps the average above hi too (and vice versa).
    if (lo === 1 && m.attrs[c.attr] <= hi) m.attrs[c.attr] = ctx.rng.int(hi + 1, Math.min(10, hi + 3));
    if (hi === 10 && m.attrs[c.attr] >= lo) m.attrs[c.attr] = ctx.rng.int(Math.max(1, lo - 3), lo - 1);
  }
}

function plantTrio(ctx: Ctx, site: Site): Microbe[] {
  return ctx.hard ? plantHardTrio(ctx, site) : plantEasyTrio(ctx, site);
}

/**
 * Hard trio: no member looks perfect on its own. Microbe 0 (it goes into the sorting queue) fits the
 * site by the sorting rule; the other two each have an attribute out of range. Only one carries the
 * desired trait, and it is never microbe 0.
 */
function plantHardTrio(ctx: Ctx, site: Site): Microbe[] {
  const { rng } = ctx;
  const n = site.ranges.length;
  const need = Math.ceil((2 * n) / 3);
  for (;;) {
    const inSet = new Set(rng.sample(Array.from({ length: n }, (_, k) => k), need));
    const cols = site.ranges.map(([lo, hi], k) => {
      for (let t = 0; t < 200; t++) {
        const a = inSet.has(k) ? rng.int(lo, hi) : outOfRange(rng, [lo, hi]);
        const target = rng.int(lo * 3, hi * 3);
        const b = rng.int(1, 10);
        const c = target - a - b;
        if (c >= 1 && c <= 10) return [a, b, c];
      }
      return null;
    });
    if (cols.some((c) => !c)) continue;
    const attrsOf = (i: number) => cols.map((c) => c![i]);
    const outCount = (i: number) => attrsOf(i).filter((v, k) => !inRange(v, site.ranges[k])).length;
    if (outCount(1) === 0 || outCount(2) === 0) continue;
    const avoid = [site.desired, site.undesired];
    const carrier = rng.int(1, 2);
    return [0, 1, 2].map((i) =>
      newMicrobe(ctx, attrsOf(i), i === carrier ? [site.desired, ...neutralTraits(rng, ctx.traitPool, ctx.per - 1, avoid)].sort() : neutralTraits(rng, ctx.traitPool, ctx.per, avoid)),
    );
  }
}

function plantEasyTrio(ctx: Ctx, site: Site): Microbe[] {
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

function makeSite(rng: Rng, idx: number, name: string, nAttr: number, traitPool: number, solvable: boolean, hard: boolean): Site {
  const w = hard ? CONFIG.seaWolf.hard.rangeWidth : CONFIG.seaWolf.rangeWidth;
  const edge = hard ? CONFIG.seaWolf.hard.edgeChance : 0.3;
  const ranges: Range[] = Array.from({ length: nAttr }, () => {
    const lo = rng.chance(edge) ? rng.pick([1, 11 - w]) : rng.int(2, 10 - w);
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

export function generateSeaWolf(seed: string, variant: 'default' | 'alt' = CONFIG.seaWolf.mode, hard = false): Scenario {
  const rng = makeRng(`${seed}::seawolf${hard ? '-hard' : ''}`);
  const v = CONFIG.seaWolf.variants[variant];
  const cfg = CONFIG.seaWolf;
  const attrNames = ATTR_NAMES.slice(0, v.attributes);
  const traitNames = TRAIT_NAMES.slice(0, v.traitPool);
  const ctx: Ctx = { rng, nAttr: v.attributes, traitPool: v.traitPool, per: v.traitsPerMicrobe, used: new Set(), counter: { n: 0 }, hard, banned: [] };

  // Standard: a mix of solvable and best-effort sites. Hard: every site solvable, but well hidden.
  const flags = Array.from({ length: cfg.sites }, () => hard || rng.chance(cfg.solvableRate));
  if (!flags.some(Boolean)) flags[rng.int(0, cfg.sites - 1)] = true;
  if (!hard && cfg.sites >= 3 && flags.every(Boolean)) flags[rng.int(0, cfg.sites - 1)] = false;

  const names = rng.sample(SITE_NAMES, cfg.sites);
  const sites = flags.map((s, i) => makeSite(rng, i, names[i], v.attributes, v.traitPool, s, hard));
  const queuePlanted: (Microbe | null)[] = sites.map(() => null);

  const data: SiteData[] = sites.map((site, si) => {
    const population = Array.from({ length: 24 }, () => randomMicrobe(ctx, site, 0.45));
    const reserve = Array.from({ length: cfg.offerRounds * cfg.offerSize }, () => (hard && rng.chance(cfg.hard.offerDecoyShare) ? nearMiss(ctx, site) : randomMicrobe(ctx, site, 0.4)));
    let planted: string[] = [];
    if (hard) {
      // Decoys crowd the initial pool; planted microbes hide in the sorting queue and two offer rounds.
      for (let k = 0; k < cfg.hard.populationDecoys; k++) population[rng.int(0, population.length - 1)] = nearMiss(ctx, site);
      const trio = plantTrio(ctx, site);
      planted = trio.map((m) => m.id);
      queuePlanted[si] = trio[0];
      const rounds = rng.sample(Array.from({ length: cfg.offerRounds }, (_, r) => r), 2);
      [trio[1], trio[2]].forEach((m, k) => (reserve[rounds[k] * cfg.offerSize + rng.int(0, cfg.offerSize - 1)] = m));
    } else if (site.solvable) {
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
      // Microbes meant for the next site carry its desired trait — the one thing the preview shows.
      return randomMicrobe(ctx, target, q % 3 === 2 ? 0.1 : 0.85, target === next);
    });
    if (hard) {
      // Swap a few fits for decoys, then hide the planted microbe somewhere in the queue.
      for (let k = 0; k < 3; k++) d.queue[rng.int(0, d.queue.length - 1)] = nearMiss(ctx, d.site);
      d.queue[rng.int(0, d.queue.length - 1)] = queuePlanted[i]!;
    }
    d.queue = rng.shuffle(d.queue);
  });

  // Apply best-effort constraints to everything reachable at each site. Queue microbes are reachable
  // from two sites, so repeat until no pass changes anything.
  ctx.banned = sites.flatMap((s) => (s.constraint?.kind === 'noDesired' ? [s.desired] : []));
  const reachable = (i: number) => [...data[i].population, ...data[i].queue, ...data[i].reserve, ...(i > 0 ? data[i - 1].queue : [])];
  for (let pass = 0; pass < 20; pass++) {
    const before = JSON.stringify(data.map((d) => [d.queue, d.population, d.reserve]));
    data.forEach((d, i) => reachable(i).forEach((m) => constrain(m, d.site, ctx)));
    if (JSON.stringify(data.map((d) => [d.queue, d.population, d.reserve])) === before) break;
  }
  if (hard) limitPerfectTrios(ctx, data, reachable);
  data.forEach((d, i) => (d.designedBest = bestTrio(reachable(i), d.site, attrNames, traitNames)));

  return { variant, attrNames, traitNames, sites: data };
}

/** All 100% trios in a pool, stopping once more than `cap` are found. */
export function perfectTrios(pool: Microbe[], site: Site, cap = Infinity): string[][] {
  // Allocation-free version of evaluate(...) === 100: compare attribute sums against 3×range.
  const clean = pool.filter((m) => !m.traits.includes(site.undesired));
  const des = clean.map((m) => m.traits.includes(site.desired));
  const lo = site.ranges.map((r) => 3 * r[0]);
  const hi = site.ranges.map((r) => 3 * r[1]);
  const n = site.ranges.length;
  const out: string[][] = [];
  for (let i = 0; i < clean.length; i++)
    for (let j = i + 1; j < clean.length; j++)
      for (let k = j + 1; k < clean.length; k++) {
        if (!des[i] && !des[j] && !des[k]) continue;
        let ok = true;
        for (let a = 0; a < n && ok; a++) {
          const s = clean[i].attrs[a] + clean[j].attrs[a] + clean[k].attrs[a];
          ok = s >= lo[a] && s <= hi[a];
        }
        if (!ok) continue;
        out.push([clean[i].id, clean[j].id, clean[k].id]);
        if (out.length > cap) return out;
      }
  return out;
}

/** Hard mode: replace stray microbes until each site has only a couple of 100% trios (the planted one included). */
function limitPerfectTrios(ctx: Ctx, data: SiteData[], reachable: (i: number) => Microbe[]) {
  const cap = CONFIG.seaWolf.hard.maxPerfectTrios;
  const allPlanted = new Set(data.flatMap((d) => d.planted));
  for (let pass = 0; pass < 200; pass++) {
    let changed = false;
    data.forEach((d, i) => {
      const trios = perfectTrios(reachable(i), d.site, cap);
      if (trios.length <= cap) return;
      const victim = trios.flat().find((id) => !allPlanted.has(id));
      if (!victim) return;
      // Replace it in whichever list holds it, with a decoy for that list's own site.
      data.forEach((owner) => {
        for (const list of [owner.population, owner.queue, owner.reserve]) {
          const at = list.findIndex((m) => m.id === victim);
          if (at >= 0) list[at] = nearMiss(ctx, owner.site);
        }
      });
      changed = true;
    });
    if (!changed) return;
  }
}
