import { CONFIG } from '../../config';
import { makeRng, type Rng } from '../../lib/rng';

export interface Species {
  id: string;
  name: string;
  kind: 'producer' | 'animal';
  provides: number;
  needs: number;
  eats: string[];
  depth: [number, number];
  temp: [number, number];
}

export interface Location {
  name: string;
  depth: [number, number];
  temp: [number, number];
}

export interface Feeding {
  eater: string;
  meals: { prey: string; amount: number }[];
  met: boolean;
}

export interface SimResult {
  sustainable: boolean;
  order: string[];
  feedings: Feeding[];
  remaining: Record<string, number>;
  problems: string[];
}

const overlap = (a: [number, number], b: [number, number]) => a[0] <= b[1] && b[0] <= a[1];
export const fitsLocation = (s: Species, l: Location) => overlap(s.depth, l.depth) && overlap(s.temp, l.temp);

/**
 * Eating rules (ported from the public description of the legacy game):
 * the animal with the highest calories provided eats first; it eats the available food source
 * with the highest (current) calories provided; ties split the need half/half. Eating subtracts
 * the predator's need from the prey's calories provided. Sustainable only if every species keeps
 * calories provided > 0 and every need is met.
 */
export function simulate(selected: Species[]): SimResult {
  const remaining: Record<string, number> = Object.fromEntries(selected.map((s) => [s.id, s.provides]));
  const ids = new Set(selected.map((s) => s.id));
  const animals = selected.filter((s) => s.kind === 'animal').sort((a, b) => b.provides - a.provides || a.id.localeCompare(b.id));
  const feedings: Feeding[] = [];
  const problems: string[] = [];
  for (const a of animals) {
    const options = a.eats.filter((p) => ids.has(p) && remaining[p] > 0);
    if (!options.length) {
      feedings.push({ eater: a.id, meals: [], met: false });
      problems.push(`${a.name} has no available food source.`);
      continue;
    }
    const top = Math.max(...options.map((p) => remaining[p]));
    const tied = options.filter((p) => remaining[p] === top);
    const share = a.needs / tied.length;
    const meals = tied.map((p) => {
      remaining[p] -= share;
      return { prey: p, amount: share };
    });
    // The need is always taken in full; an over-eaten prey shows up as a problem below.
    feedings.push({ eater: a.id, meals, met: true });
  }
  for (const s of selected) if (remaining[s.id] <= 0) problems.push(`${s.name} was eaten down to ${Math.round(remaining[s.id])} calories.`);
  return { sustainable: problems.length === 0, order: animals.map((a) => a.id), feedings, remaining, problems };
}

const PROD_A = ['Glasswort', 'Lantern', 'Ribbon', 'Velvet', 'Brine', 'Copper', 'Silt', 'Pearl'];
const PROD_B = ['Kelp', 'Algae', 'Seagrass', 'Plankton', 'Moss'];
const ANI_A = ['Dusk', 'Saltfin', 'Spotted', 'Glimmer', 'Reed', 'Hollow', 'Ember', 'Frost', 'Tidal', 'Slate', 'Moon', 'Thorn'];
const ANI_B = ['Shrimp', 'Perch', 'Eel', 'Snail', 'Crab', 'Ray', 'Goby', 'Squid', 'Urchin', 'Wrasse', 'Prawn', 'Pike'];

export interface EcoScenario {
  locations: Location[];
  pool: Species[];
  /** Index of the location the planted solution lives in, and its species ids. */
  solution: { location: number; species: string[] };
}

function range(rng: Rng, lo: number, hi: number, w: number): [number, number] {
  const a = rng.int(lo, hi - w);
  return [a, a + w];
}

export function generateEcosystem(seed: string): EcoScenario {
  const rng = makeRng(`${seed}::ecosystem`);
  const locations: Location[] = [
    { name: 'Shallow lagoon', depth: [0, 30], temp: [18, 28] },
    { name: 'Kelp shelf', depth: [20, 80], temp: [10, 18] },
    { name: 'Twilight slope', depth: [150, 400], temp: [4, 10] },
  ];
  const locIdx = rng.int(0, 2);
  const L = locations[locIdx];
  const used = new Set<string>();
  const name = (a: string[], b: string[]) => {
    for (;;) {
      const n = `${rng.pick(a)} ${rng.pick(b)}`;
      if (!used.has(n)) {
        used.add(n);
        return n;
      }
    }
  };
  let n = 0;
  const mk = (kind: Species['kind'], provides: number, needs: number, eats: string[], loc: Location | null): Species => ({
    id: `sp${n++}`,
    name: kind === 'producer' ? name(PROD_A, PROD_B) : name(ANI_A, ANI_B),
    kind,
    provides,
    needs,
    eats,
    depth: loc ? [Math.max(0, loc.depth[0] - rng.int(0, 10)), loc.depth[1] + rng.int(0, 20)] : range(rng, 0, 500, rng.int(20, 120)),
    temp: loc ? [loc.temp[0] - rng.int(0, 2), loc.temp[1] + rng.int(0, 2)] : range(rng, 2, 30, rng.int(4, 10)),
  });

  // Plant a sustainable 8-species web, retrying until the rules agree.
  let planted: Species[] = [];
  for (let tries = 0; tries < 500; tries++) {
    n = 0;
    used.clear();
    const P = [0, 1, 2].map(() => mk('producer', rng.int(30, 50) * 100, 0, [], L));
    const H = [0, 1, 2].map(() => mk('animal', rng.int(14, 22) * 100, rng.int(5, 10) * 100, rng.sample(P, 2).map((p) => p.id), L));
    const C = [0, 1].map(() => mk('animal', rng.int(6, 12) * 100, rng.int(3, 7) * 100, rng.sample(H, 2).map((h) => h.id), L));
    planted = [...P, ...H, ...C];
    if (simulate(planted).sustainable) break;
  }

  const distractors: Species[] = [];
  const total = CONFIG.ecosystem.poolSize;
  while (planted.length + distractors.length < total) {
    const roll = rng.next();
    const loc = rng.chance(0.5) ? L : rng.pick(locations);
    const all = [...planted, ...distractors];
    if (roll < 0.2) distractors.push(mk('producer', rng.int(20, 50) * 100, 0, [], loc));
    else distractors.push(mk('animal', rng.int(4, 26) * 100, rng.int(3, 14) * 100, rng.sample(all, rng.int(1, 3)).map((s) => s.id), loc));
  }
  const pool = rng.shuffle([...planted, ...distractors]);
  return { locations, pool, solution: { location: locIdx, species: planted.map((s) => s.id) } };
}
