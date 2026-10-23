import seedrandom from 'seedrandom';

/** Seeded RNG with the helpers every generator needs. Same seed → same run. */
export interface Rng {
  seed: string;
  next(): number;
  float(min: number, max: number): number;
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: readonly T[]): T[];
  sample<T>(arr: readonly T[], n: number): T[];
  chance(p: number): boolean;
  /** Derive an independent child stream, e.g. one per game. */
  fork(label: string): Rng;
}

export function makeRng(seed: string): Rng {
  const prng = seedrandom(seed);
  const rng: Rng = {
    seed,
    next: () => prng(),
    float: (min, max) => min + prng() * (max - min),
    int: (min, max) => min + Math.floor(prng() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(prng() * arr.length)],
    shuffle: (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(prng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    sample: (arr, n) => rng.shuffle(arr).slice(0, n),
    chance: (p) => prng() < p,
    fork: (label) => makeRng(`${seed}::${label}`),
  };
  return rng;
}

export function randomSeed(): string {
  const words = ['kelp', 'tern', 'reef', 'moss', 'dune', 'fern', 'cove', 'lynx', 'otter', 'heron', 'shoal', 'basalt'];
  const w = words[Math.floor(Math.random() * words.length)];
  return `${w}-${Math.floor(Math.random() * 90000 + 10000)}`;
}

export const round2 = (x: number) => Math.round(x * 100) / 100;
export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
