import type { GameId, SittingMode } from '../config';

export interface TelemetryEvent {
  t_ms: number;
  game: GameId | 'shell';
  phase: string;
  type: string;
  payload?: Record<string, unknown>;
}

export interface GameResult {
  game: GameId;
  product: number;
  process: number;
  score: number;
  timeSpentSec: number;
  timedOut: boolean;
  /** Game-specific debrief data (missed items, optimal answers, metrics). */
  details: Record<string, unknown>;
  habit: string;
}

export interface Settings {
  tutorialQuirk: boolean;
  seaWolfMode: 'default' | 'alt';
  legacyEcosystem: boolean;
}

export type GameStage = 'tutorial' | 'playing' | 'done';

export interface GameRun {
  game: GameId;
  stage: GameStage;
  clockStartedAt?: number;
  endsAt?: number;
  result?: GameResult;
}

export interface Sitting {
  id: string;
  seed: string;
  mode: SittingMode | 'single';
  games: GameId[];
  index: number;
  status: 'active' | 'complete' | 'abandoned';
  startedAt: number;
  runs: GameRun[];
  telemetry: TelemetryEvent[];
  settings: Settings;
}
