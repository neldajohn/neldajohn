import { create } from 'zustand';
import { CONFIG, type GameId, type SittingMode } from '../config';
import { KEYS, load, remove, save } from '../lib/storage';
import type { GameResult, Settings, Sitting, TelemetryEvent } from '../lib/types';

export type View = 'home' | 'sitting' | 'complete' | 'debrief' | 'history' | 'abandoned';

export interface HistoryEntry {
  id: string;
  seed: string;
  mode: Sitting['mode'];
  games: GameId[];
  startedAt: number;
  status: Sitting['status'];
  results: GameResult[];
  telemetry?: TelemetryEvent[];
}

const DEFAULT_SETTINGS: Settings = { tutorialQuirk: false, seaWolfMode: 'default', seaWolfHard: true, legacyEcosystem: false };
const HISTORY_LIMIT = 30;
const TELEMETRY_KEEP = 5;

interface State {
  view: View;
  settings: Settings;
  sitting: Sitting | null;
  phase: string;
  /** Sitting found in storage on boot that was never finished. */
  abandoned: HistoryEntry | null;
  debriefId: string | null;

  setView(v: View): void;
  updateSettings(p: Partial<Settings>): void;
  startSitting(mode: SittingMode | 'single', seed: string, single?: GameId): void;
  log(type: string, payload?: Record<string, unknown>): void;
  setPhase(phase: string): void;
  startClock(): void;
  endTutorial(): void;
  finishGame(result: GameResult): void;
  openDebrief(id: string): void;
  dismissAbandoned(): void;
}

function toHistory(s: Sitting, keepTelemetry: boolean): HistoryEntry {
  return {
    id: s.id,
    seed: s.seed,
    mode: s.mode,
    games: s.games,
    startedAt: s.startedAt,
    status: s.status,
    results: s.runs.flatMap((r) => (r.result ? [r.result] : [])),
    telemetry: keepTelemetry ? s.telemetry : undefined,
  };
}

export function loadHistory(): HistoryEntry[] {
  return load<HistoryEntry[]>(KEYS.history, []);
}

function pushHistory(entry: HistoryEntry) {
  const hist = [entry, ...loadHistory().filter((h) => h.id !== entry.id)].slice(0, HISTORY_LIMIT);
  hist.forEach((h, i) => {
    if (i >= TELEMETRY_KEEP) delete h.telemetry;
  });
  save(KEYS.history, hist);
}

function bootAbandoned(): HistoryEntry | null {
  const prev = load<Sitting | null>(KEYS.active, null);
  if (!prev || prev.status !== 'active') return null;
  const entry = toHistory({ ...prev, status: 'abandoned' }, false);
  pushHistory(entry);
  remove(KEYS.active);
  return entry;
}

const abandonedAtBoot = typeof window !== 'undefined' ? bootAbandoned() : null;

export const useSitting = create<State>((set, get) => ({
  view: abandonedAtBoot ? 'abandoned' : 'home',
  settings: { ...DEFAULT_SETTINGS, ...load<Partial<Settings>>(KEYS.settings, {}) },
  sitting: null,
  phase: 'tutorial',
  abandoned: abandonedAtBoot,
  debriefId: null,

  setView: (view) => set({ view }),

  updateSettings: (p) => {
    const settings = { ...get().settings, ...p };
    save(KEYS.settings, settings);
    set({ settings });
  },

  startSitting: (mode, seed, single) => {
    const games = mode === 'single' ? [single ?? 'seawolf'] : CONFIG.modes[mode];
    const sitting: Sitting = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      seed,
      mode,
      games,
      index: 0,
      status: 'active',
      startedAt: Date.now(),
      runs: games.map((game) => ({ game, stage: 'tutorial' })),
      telemetry: [],
      settings: get().settings,
    };
    set({ sitting, view: 'sitting', phase: 'tutorial' });
    if (sitting.settings.tutorialQuirk) get().startClock();
    get().log('sitting_start', { mode, seed, games });
  },

  log: (type, payload) => {
    const s = get().sitting;
    if (!s || s.status !== 'active') return;
    const run = s.runs[s.index];
    const ev: TelemetryEvent = { t_ms: Date.now() - s.startedAt, game: run?.game ?? 'shell', phase: get().phase, type, payload };
    s.telemetry.push(ev); // mutate in place: telemetry is append-only and high-frequency
  },

  setPhase: (phase) => {
    if (phase === get().phase) return;
    get().log('phase_change', { from: get().phase, to: phase });
    set({ phase });
  },

  startClock: () => {
    const s = get().sitting;
    if (!s) return;
    const run = s.runs[s.index];
    if (run.endsAt) return;
    const now = Date.now();
    const runs = s.runs.slice();
    runs[s.index] = { ...run, clockStartedAt: now, endsAt: now + CONFIG.clocks[run.game] * 1000 };
    set({ sitting: { ...s, runs } });
    get().log('clock_start', { seconds: CONFIG.clocks[run.game] });
  },

  endTutorial: () => {
    const s = get().sitting;
    if (!s) return;
    get().startClock();
    const s2 = get().sitting!;
    const runs = s2.runs.slice();
    runs[s2.index] = { ...runs[s2.index], stage: 'playing' };
    set({ sitting: { ...s2, runs } });
    get().log('tutorial_end');
  },

  finishGame: (result) => {
    const s = get().sitting;
    if (!s) return;
    const runs = s.runs.slice();
    if (runs[s.index].stage === 'done') return;
    const started = runs[s.index].clockStartedAt;
    if (started) result = { ...result, timeSpentSec: Math.min(CONFIG.clocks[result.game], Math.round((Date.now() - started) / 1000)) };
    runs[s.index] = { ...runs[s.index], stage: 'done', result };
    get().log('game_submit', { score: result.score, timedOut: result.timedOut });
    const last = s.index >= s.games.length - 1;
    if (last) {
      const done: Sitting = { ...s, runs, status: 'complete' };
      pushHistory(toHistory(done, true));
      remove(KEYS.active);
      set({ sitting: done, view: 'complete', debriefId: done.id, phase: 'complete' });
      return;
    }
    const next: Sitting = { ...s, runs, index: s.index + 1 };
    set({ sitting: next, phase: 'tutorial' });
    if (s.settings.tutorialQuirk) get().startClock();
  },

  openDebrief: (id) => set({ debriefId: id, view: 'debrief' }),
  dismissAbandoned: () => set({ abandoned: null, view: 'home' }),
}));

/** Persist the active sitting so a closed tab can be detected as abandoned on next boot. */
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persistSoon() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const s = useSitting.getState().sitting;
    if (s && s.status === 'active') save(KEYS.active, s);
  }, 1000);
}
useSitting.subscribe(persistSoon);
if (typeof window !== 'undefined') setInterval(persistSoon, 5000);

export const logEvent = (type: string, payload?: Record<string, unknown>) => useSitting.getState().log(type, payload);
export const currentRun = () => {
  const s = useSitting.getState().sitting;
  return s ? s.runs[s.index] : undefined;
};
