"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import {
  DayEntry,
  ExerciseEntry,
  SetEntry,
  WeekEntry,
  WorkoutStore,
} from "@/types/workout";
import { makeId } from "@/lib/id";
import { getSeedStore, loadStore, saveStore } from "@/lib/storage";

type Action =
  | { type: "HYDRATE"; payload: WorkoutStore }
  | { type: "IMPORT_STORE"; payload: WorkoutStore }
  | { type: "RESET_TO_SEED" }
  | { type: "ADD_WEEK"; payload: { label: string; weekBeginDate: string | null; note?: string | null } }
  | { type: "DELETE_WEEK"; payload: { weekId: string } }
  | { type: "UPDATE_WEEK"; payload: { weekId: string; patch: Partial<WeekEntry> } }
  | { type: "ADD_DAY"; payload: { weekId: string; label: string; dayType: string } }
  | { type: "DELETE_DAY"; payload: { weekId: string; dayId: string } }
  | {
      type: "ADD_EXERCISE";
      payload: {
        weekId: string;
        dayId: string;
        exercise: Partial<Omit<ExerciseEntry, "id" | "loggedSets">> & { name: string };
      };
    }
  | {
      type: "ADD_EXERCISE_WITH_SETS";
      payload: {
        weekId: string;
        dayId: string;
        exercise: Partial<Omit<ExerciseEntry, "id" | "loggedSets">> & { name: string };
        sets: Array<Partial<Omit<SetEntry, "id">>>;
      };
    }
  | {
      type: "UPDATE_EXERCISE";
      payload: { weekId: string; dayId: string; exerciseId: string; patch: Partial<ExerciseEntry> };
    }
  | { type: "DELETE_EXERCISE"; payload: { weekId: string; dayId: string; exerciseId: string } }
  | {
      type: "ADD_SET";
      payload: {
        weekId: string;
        dayId: string;
        exerciseId: string;
        set: Partial<Omit<SetEntry, "id">>;
      };
    }
  | {
      type: "UPDATE_SET";
      payload: { weekId: string; dayId: string; exerciseId: string; setId: string; patch: Partial<SetEntry> };
    }
  | { type: "DELETE_SET"; payload: { weekId: string; dayId: string; exerciseId: string; setId: string } }
  | {
      type: "ADD_CARDIO";
      payload: { weekId: string; dayId: string; cardio: { activity: string | null; durationMin: string | null; intensity: string | null; notes: string | null } };
    }
  | { type: "DELETE_CARDIO"; payload: { weekId: string; dayId: string; cardioId: string } }
  | { type: "BULK_LOAD_WEEKS"; payload: { weeks: WeekEntry[] } };

function mapWeek(store: WorkoutStore, weekId: string, fn: (w: WeekEntry) => WeekEntry): WorkoutStore {
  return { ...store, weeks: store.weeks.map((w) => (w.id === weekId ? fn(w) : w)) };
}

function mapDay(week: WeekEntry, dayId: string, fn: (d: DayEntry) => DayEntry): WeekEntry {
  return { ...week, days: week.days.map((d) => (d.id === dayId ? fn(d) : d)) };
}

function mapExercise(day: DayEntry, exerciseId: string, fn: (e: ExerciseEntry) => ExerciseEntry): DayEntry {
  return { ...day, exercises: day.exercises.map((e) => (e.id === exerciseId ? fn(e) : e)) };
}

function reducer(store: WorkoutStore, action: Action): WorkoutStore {
  switch (action.type) {
    case "HYDRATE":
      return action.payload;

    case "IMPORT_STORE":
      return action.payload;

    case "RESET_TO_SEED":
      return getSeedStore();

    case "ADD_WEEK": {
      const newWeek: WeekEntry = {
        id: makeId("week"),
        weekNumber: null,
        label: action.payload.label,
        weekBeginDate: action.payload.weekBeginDate,
        note: action.payload.note ?? null,
        nutrition: null,
        days: [],
      };
      return { ...store, weeks: [...store.weeks, newWeek] };
    }

    case "DELETE_WEEK":
      return { ...store, weeks: store.weeks.filter((w) => w.id !== action.payload.weekId) };

    case "UPDATE_WEEK":
      return mapWeek(store, action.payload.weekId, (w) => ({ ...w, ...action.payload.patch }));

    case "ADD_DAY": {
      const newDay: DayEntry = {
        id: makeId("day"),
        label: action.payload.label,
        dayType: action.payload.dayType,
        exercises: [],
        cardio: [],
      };
      return mapWeek(store, action.payload.weekId, (w) => ({ ...w, days: [...w.days, newDay] }));
    }

    case "DELETE_DAY":
      return mapWeek(store, action.payload.weekId, (w) => ({
        ...w,
        days: w.days.filter((d) => d.id !== action.payload.dayId),
      }));

    case "ADD_EXERCISE": {
      const newExercise: ExerciseEntry = {
        id: makeId("ex"),
        name: action.payload.exercise.name,
        plannedSets: action.payload.exercise.plannedSets ?? null,
        plannedReps: action.payload.exercise.plannedReps ?? null,
        plannedLoad: action.payload.exercise.plannedLoad ?? null,
        pct1RM: action.payload.exercise.pct1RM ?? null,
        tempo: action.payload.exercise.tempo ?? null,
        plannedRPE: action.payload.exercise.plannedRPE ?? null,
        rest: action.payload.exercise.rest ?? null,
        notes: action.payload.exercise.notes ?? null,
        loggedSets: [],
      };
      return mapWeek(store, action.payload.weekId, (w) =>
        mapDay(w, action.payload.dayId, (d) => ({ ...d, exercises: [...d.exercises, newExercise] }))
      );
    }

    case "ADD_EXERCISE_WITH_SETS": {
      const loggedSets: SetEntry[] = action.payload.sets.map((s, i) => ({
        id: makeId("set"),
        setNumber: s.setNumber ?? i + 1,
        reps: s.reps ?? null,
        load: s.load ?? null,
        rpe: s.rpe ?? null,
        estMax: s.estMax ?? null,
      }));
      const newExercise: ExerciseEntry = {
        id: makeId("ex"),
        name: action.payload.exercise.name,
        plannedSets: action.payload.exercise.plannedSets ?? null,
        plannedReps: action.payload.exercise.plannedReps ?? null,
        plannedLoad: action.payload.exercise.plannedLoad ?? null,
        pct1RM: action.payload.exercise.pct1RM ?? null,
        tempo: action.payload.exercise.tempo ?? null,
        plannedRPE: action.payload.exercise.plannedRPE ?? null,
        rest: action.payload.exercise.rest ?? null,
        notes: action.payload.exercise.notes ?? null,
        loggedSets,
      };
      return mapWeek(store, action.payload.weekId, (w) =>
        mapDay(w, action.payload.dayId, (d) => ({ ...d, exercises: [...d.exercises, newExercise] }))
      );
    }

    case "UPDATE_EXERCISE":
      return mapWeek(store, action.payload.weekId, (w) =>
        mapDay(w, action.payload.dayId, (d) =>
          mapExercise(d, action.payload.exerciseId, (e) => ({ ...e, ...action.payload.patch }))
        )
      );

    case "DELETE_EXERCISE":
      return mapWeek(store, action.payload.weekId, (w) =>
        mapDay(w, action.payload.dayId, (d) => ({
          ...d,
          exercises: d.exercises.filter((e) => e.id !== action.payload.exerciseId),
        }))
      );

    case "ADD_SET": {
      return mapWeek(store, action.payload.weekId, (w) =>
        mapDay(w, action.payload.dayId, (d) =>
          mapExercise(d, action.payload.exerciseId, (e) => {
            const nextSetNumber = e.loggedSets.length
              ? Math.max(...e.loggedSets.map((s) => s.setNumber)) + 1
              : 1;
            const newSet: SetEntry = {
              id: makeId("set"),
              setNumber: action.payload.set.setNumber ?? nextSetNumber,
              reps: action.payload.set.reps ?? null,
              load: action.payload.set.load ?? null,
              rpe: action.payload.set.rpe ?? null,
              estMax: action.payload.set.estMax ?? null,
            };
            return { ...e, loggedSets: [...e.loggedSets, newSet] };
          })
        )
      );
    }

    case "UPDATE_SET":
      return mapWeek(store, action.payload.weekId, (w) =>
        mapDay(w, action.payload.dayId, (d) =>
          mapExercise(d, action.payload.exerciseId, (e) => ({
            ...e,
            loggedSets: e.loggedSets.map((s) =>
              s.id === action.payload.setId ? { ...s, ...action.payload.patch } : s
            ),
          }))
        )
      );

    case "DELETE_SET":
      return mapWeek(store, action.payload.weekId, (w) =>
        mapDay(w, action.payload.dayId, (d) =>
          mapExercise(d, action.payload.exerciseId, (e) => ({
            ...e,
            loggedSets: e.loggedSets.filter((s) => s.id !== action.payload.setId),
          }))
        )
      );

    case "ADD_CARDIO":
      return mapWeek(store, action.payload.weekId, (w) =>
        mapDay(w, action.payload.dayId, (d) => ({
          ...d,
          cardio: [...d.cardio, { id: makeId("cardio"), ...action.payload.cardio }],
        }))
      );

    case "DELETE_CARDIO":
      return mapWeek(store, action.payload.weekId, (w) =>
        mapDay(w, action.payload.dayId, (d) => ({
          ...d,
          cardio: d.cardio.filter((c) => c.id !== action.payload.cardioId),
        }))
      );

    case "BULK_LOAD_WEEKS":
      return { ...store, weeks: [...store.weeks, ...action.payload.weeks] };

    default:
      return store;
  }
}

interface WorkoutContextValue {
  store: WorkoutStore;
  ready: boolean;
  dispatch: React.Dispatch<Action>;
  addWeek: (label: string, weekBeginDate: string | null, note?: string | null) => string;
  deleteWeek: (weekId: string) => void;
  updateWeek: (weekId: string, patch: Partial<WeekEntry>) => void;
  addDay: (weekId: string, label: string, dayType: string) => string;
  deleteDay: (weekId: string, dayId: string) => void;
  addExercise: (
    weekId: string,
    dayId: string,
    exercise: Partial<Omit<ExerciseEntry, "id" | "loggedSets">> & { name: string }
  ) => void;
  addExerciseWithSets: (
    weekId: string,
    dayId: string,
    exercise: Partial<Omit<ExerciseEntry, "id" | "loggedSets">> & { name: string },
    sets: Array<Partial<Omit<SetEntry, "id">>>
  ) => void;
  updateExercise: (weekId: string, dayId: string, exerciseId: string, patch: Partial<ExerciseEntry>) => void;
  deleteExercise: (weekId: string, dayId: string, exerciseId: string) => void;
  addSet: (weekId: string, dayId: string, exerciseId: string, set: Partial<Omit<SetEntry, "id">>) => void;
  updateSet: (weekId: string, dayId: string, exerciseId: string, setId: string, patch: Partial<SetEntry>) => void;
  deleteSet: (weekId: string, dayId: string, exerciseId: string, setId: string) => void;
  addCardio: (
    weekId: string,
    dayId: string,
    cardio: { activity: string | null; durationMin: string | null; intensity: string | null; notes: string | null }
  ) => void;
  deleteCardio: (weekId: string, dayId: string, cardioId: string) => void;
  importStore: (next: WorkoutStore) => void;
  resetToSeed: () => void;
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [store, dispatch] = useReducer(reducer, undefined, () => getSeedStore());
  const [ready, setReady] = React.useState(false);

  useEffect(() => {
    // One-time sync from the external localStorage system on mount (SSR has no
    // access to it, so this can't happen during the initial render). `ready` is
    // real state (not a ref) so the autosave effect below only ever observes it
    // as true on the same render where `store` already reflects the hydrated
    // data — a ref flipped here would go true a render early, while `store`
    // still held the seed closure, and the autosave effect would immediately
    // clobber real localStorage data with the seed.
    dispatch({ type: "HYDRATE", payload: loadStore() });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveStore(store);
  }, [store, ready]);

  const value = useMemo<WorkoutContextValue>(
    () => ({
      store,
      ready,
      dispatch,
      addWeek: (label, weekBeginDate, note) => {
        const id = makeId("week");
        dispatch({ type: "ADD_WEEK", payload: { label, weekBeginDate, note } });
        return id;
      },
      deleteWeek: (weekId) => dispatch({ type: "DELETE_WEEK", payload: { weekId } }),
      updateWeek: (weekId, patch) => dispatch({ type: "UPDATE_WEEK", payload: { weekId, patch } }),
      addDay: (weekId, label, dayType) => {
        const id = makeId("day");
        dispatch({ type: "ADD_DAY", payload: { weekId, label, dayType } });
        return id;
      },
      deleteDay: (weekId, dayId) => dispatch({ type: "DELETE_DAY", payload: { weekId, dayId } }),
      addExercise: (weekId, dayId, exercise) =>
        dispatch({ type: "ADD_EXERCISE", payload: { weekId, dayId, exercise } }),
      addExerciseWithSets: (weekId, dayId, exercise, sets) =>
        dispatch({ type: "ADD_EXERCISE_WITH_SETS", payload: { weekId, dayId, exercise, sets } }),
      updateExercise: (weekId, dayId, exerciseId, patch) =>
        dispatch({ type: "UPDATE_EXERCISE", payload: { weekId, dayId, exerciseId, patch } }),
      deleteExercise: (weekId, dayId, exerciseId) =>
        dispatch({ type: "DELETE_EXERCISE", payload: { weekId, dayId, exerciseId } }),
      addSet: (weekId, dayId, exerciseId, set) =>
        dispatch({ type: "ADD_SET", payload: { weekId, dayId, exerciseId, set } }),
      updateSet: (weekId, dayId, exerciseId, setId, patch) =>
        dispatch({ type: "UPDATE_SET", payload: { weekId, dayId, exerciseId, setId, patch } }),
      deleteSet: (weekId, dayId, exerciseId, setId) =>
        dispatch({ type: "DELETE_SET", payload: { weekId, dayId, exerciseId, setId } }),
      addCardio: (weekId, dayId, cardio) => dispatch({ type: "ADD_CARDIO", payload: { weekId, dayId, cardio } }),
      deleteCardio: (weekId, dayId, cardioId) =>
        dispatch({ type: "DELETE_CARDIO", payload: { weekId, dayId, cardioId } }),
      importStore: (next) => dispatch({ type: "IMPORT_STORE", payload: next }),
      resetToSeed: () => dispatch({ type: "RESET_TO_SEED" }),
    }),
    [store, ready]
  );

  return <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>;
}

export function useWorkout(): WorkoutContextValue {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error("useWorkout must be used within a WorkoutProvider");
  return ctx;
}
