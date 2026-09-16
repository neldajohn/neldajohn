export type Nullable<T> = T | null;

export interface SetEntry {
  id: string;
  setNumber: number;
  reps: Nullable<string>;
  load: Nullable<string>;
  rpe: Nullable<string>;
  estMax: Nullable<string>;
}

export interface CardioEntry {
  id: string;
  activity: Nullable<string>;
  durationMin: Nullable<string>;
  intensity: Nullable<string>;
  notes: Nullable<string>;
}

export interface ExerciseEntry {
  id: string;
  name: string;
  plannedSets: Nullable<string>;
  plannedReps: Nullable<string>;
  plannedLoad: Nullable<string>;
  pct1RM: Nullable<string>;
  tempo: Nullable<string>;
  plannedRPE: Nullable<string>;
  rest: Nullable<string>;
  notes: Nullable<string>;
  loggedSets: SetEntry[];
}

export type DayType =
  | "Upper"
  | "Lower"
  | "Full Body"
  | "Push"
  | "Pull"
  | "Legs"
  | "Bench"
  | "Squat"
  | "Deadlift"
  | "Cardio"
  | "Rest"
  | "Custom";

export interface DayEntry {
  id: string;
  label: string;
  dayType: string;
  exercises: ExerciseEntry[];
  cardio: CardioEntry[];
}

export interface WeekEntry {
  id: string;
  weekNumber: Nullable<number>;
  label: string;
  weekBeginDate: Nullable<string>;
  note: Nullable<string>;
  nutrition: Nullable<Record<string, string>>;
  days: DayEntry[];
}

export interface WorkoutStore {
  weeks: WeekEntry[];
  version: number;
}
