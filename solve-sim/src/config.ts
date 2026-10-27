/**
 * Every timing, count and weight in one place. Values are candidate-reported
 * (see REPORTED_FACTS.md) and expected to drift — tweak here, not in components.
 */
export type GameId = 'redrock' | 'seawolf' | 'sflIsland' | 'ecosystem';
export type SittingMode = 65 | 95;

export const GAME_NAMES: Record<GameId, string> = {
  redrock: 'Red Rock Study',
  seawolf: 'Sea Wolf',
  sflIsland: 'Sustainable Futures Lab',
  ecosystem: 'Ecosystem Building (legacy)',
};

export const CONFIG = {
  defaultMode: 95 as SittingMode,
  modes: {
    65: ['redrock', 'seawolf'],
    95: ['redrock', 'seawolf', 'sflIsland'],
  } as Record<SittingMode, GameId[]>,

  /** Game clocks in seconds. Unused time never carries over. */
  clocks: {
    redrock: 35 * 60,
    seawolf: 30 * 60,
    sflIsland: 30 * 60,
    ecosystem: 35 * 60,
  } as Record<GameId, number>,

  /** Reported quirk: tutorial ends without warning, clock already running. */
  tutorialQuirk: { autoEndAfterSec: 60 },

  minDesktopWidth: 1024,

  redRock: {
    questionsMin: 2,
    questionsMax: 4,
    reportBlanksMin: 8,
    cases: 6,
    caseBudgetSec: 120,
    /** Suggested split of the 35-min clock. */
    studyBudgetSec: 23 * 60,
    answerTolerance: 0.011,
    noiseExhibitsMin: 2,
    noiseExhibitsMax: 3,
  },

  seaWolf: {
    mode: 'default' as 'default' | 'alt',
    variants: {
      default: { attributes: 3, traitPool: 4, traitsPerMicrobe: 1 },
      alt: { attributes: 7, traitPool: 5, traitsPerMicrobe: 2 },
    },
    sites: 3,
    locks: 2,
    queueSize: 10,
    initialPool: 6,
    offerRounds: 4,
    offerSize: 3,
    trioSize: 3,
    rangeWidth: 3,
    /** Share of sites where a 100% trio is reachable. */
    solvableRate: 0.6,
    siteBudgetSec: 9 * 60,
    /** Harder generation; every site still has a reachable 100% trio. */
    hard: {
      rangeWidth: 2,
      edgeChance: 0.6,
      /** Chance a random microbe that rolled the site's desired trait keeps it. */
      desiredKeep: 0.2,
      /** Near-miss decoys added to the initial-pool population. */
      populationDecoys: 8,
      /** Share of free offer slots filled with near-miss decoys. */
      offerDecoyShare: 0.6,
      /** Upper bound on distinct 100% trios reachable at a site. */
      maxPerfectTrios: 2,
    },
  },

  sflIsland: {
    researchers: 4,
    workstations: 4,
    days: 3,
    /** Usually 3 per day; some reports have 2 on Day 3. */
    exploreRequests: [3, 3, 2],
    stationCapacity: 2,
    supportProblemsPerDay: 3,
    openingBudgetSec: 2 * 60,
    perDayBudgetSec: 10 * 60,
    day1WarnElapsedSec: 12 * 60,
  },

  ecosystem: { chainSize: 8, poolSize: 39 },

  scoring: {
    /** Practice model only — McKinsey has never published its method. */
    productWeight: 0.7,
    processWeight: 0.3,
    erraticClicksPerMin: 45,
  },
};
