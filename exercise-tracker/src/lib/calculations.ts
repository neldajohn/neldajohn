import { ExerciseEntry, SetEntry, WeekEntry } from "@/types/workout";

export function toNumber(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const cleaned = v.replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Epley formula estimated 1RM. */
export function estimate1RM(load: number | null, reps: number | null): number | null {
  if (load === null || reps === null || reps <= 0) return null;
  if (reps === 1) return Math.round(load * 10) / 10;
  return Math.round(load * (1 + reps / 30) * 10) / 10;
}

export function setEstimatedMax(set: SetEntry): number | null {
  const explicit = toNumber(set.estMax);
  if (explicit !== null) return explicit;
  return estimate1RM(toNumber(set.load), toNumber(set.reps));
}

export function setVolume(set: SetEntry): number {
  const load = toNumber(set.load) ?? 0;
  const reps = toNumber(set.reps) ?? 0;
  return load * reps;
}

export interface ExerciseHistoryPoint {
  weekId: string;
  weekLabel: string;
  weekNumber: number | null;
  weekBeginDate: string | null;
  dayId: string;
  dayLabel: string;
  exerciseId: string;
  notes: string | null;
  topSet: SetEntry | null;
  topLoad: number | null;
  topEstMax: number | null;
  totalVolume: number;
  totalSets: number;
  avgRPE: number | null;
}

export function buildExerciseHistory(
  weeks: WeekEntry[],
  exerciseName: string
): ExerciseHistoryPoint[] {
  const points: ExerciseHistoryPoint[] = [];
  const target = exerciseName.trim().toLowerCase();

  for (const week of weeks) {
    for (const day of week.days) {
      for (const ex of day.exercises) {
        if (ex.name.trim().toLowerCase() !== target) continue;
        if (ex.loggedSets.length === 0) continue;

        let topSet: SetEntry | null = null;
        let topLoad = -Infinity;
        let totalVolume = 0;
        let rpeSum = 0;
        let rpeCount = 0;

        for (const set of ex.loggedSets) {
          const load = toNumber(set.load) ?? 0;
          if (load >= topLoad) {
            topLoad = load;
            topSet = set;
          }
          totalVolume += setVolume(set);
          const rpe = toNumber(set.rpe);
          if (rpe !== null) {
            rpeSum += rpe;
            rpeCount += 1;
          }
        }

        points.push({
          weekId: week.id,
          weekLabel: week.label,
          weekNumber: week.weekNumber,
          weekBeginDate: week.weekBeginDate,
          dayId: day.id,
          dayLabel: day.label,
          exerciseId: ex.id,
          notes: ex.notes,
          topSet,
          topLoad: topSet ? toNumber(topSet.load) : null,
          topEstMax: topSet ? setEstimatedMax(topSet) : null,
          totalVolume,
          totalSets: ex.loggedSets.length,
          avgRPE: rpeCount ? Math.round((rpeSum / rpeCount) * 10) / 10 : null,
        });
      }
    }
  }

  points.sort((a, b) => {
    const ad = a.weekBeginDate ?? "";
    const bd = b.weekBeginDate ?? "";
    if (ad && bd && ad !== bd) return ad.localeCompare(bd);
    return (a.weekNumber ?? 0) - (b.weekNumber ?? 0);
  });

  return points;
}

export interface ExercisePR {
  maxLoad: { value: number; weekLabel: string; reps: string | null } | null;
  maxEstMax: { value: number; weekLabel: string } | null;
  maxReps: { value: number; weekLabel: string; load: string | null } | null;
  maxVolumeSession: { value: number; weekLabel: string } | null;
}

export function computePRs(history: ExerciseHistoryPoint[], weeks: WeekEntry[], exerciseName: string): ExercisePR {
  const target = exerciseName.trim().toLowerCase();
  let maxLoad: ExercisePR["maxLoad"] = null;
  let maxEstMax: ExercisePR["maxEstMax"] = null;
  let maxReps: ExercisePR["maxReps"] = null;
  let maxVolumeSession: ExercisePR["maxVolumeSession"] = null;

  for (const week of weeks) {
    for (const day of week.days) {
      for (const ex of day.exercises) {
        if (ex.name.trim().toLowerCase() !== target) continue;
        for (const set of ex.loggedSets) {
          const load = toNumber(set.load);
          const reps = toNumber(set.reps);
          const estMax = setEstimatedMax(set);
          if (load !== null && (!maxLoad || load > maxLoad.value)) {
            maxLoad = { value: load, weekLabel: week.label, reps: set.reps };
          }
          if (estMax !== null && (!maxEstMax || estMax > maxEstMax.value)) {
            maxEstMax = { value: estMax, weekLabel: week.label };
          }
          if (reps !== null && (!maxReps || reps > maxReps.value)) {
            maxReps = { value: reps, weekLabel: week.label, load: set.load };
          }
        }
      }
    }
  }

  for (const point of history) {
    if (!maxVolumeSession || point.totalVolume > maxVolumeSession.value) {
      maxVolumeSession = { value: point.totalVolume, weekLabel: point.weekLabel };
    }
  }

  return { maxLoad, maxEstMax, maxReps, maxVolumeSession };
}

export function distinctLoggedExerciseNames(weeks: WeekEntry[]): string[] {
  const names = new Set<string>();
  for (const week of weeks) {
    for (const day of week.days) {
      for (const ex of day.exercises) {
        if (ex.loggedSets.length > 0) names.add(ex.name);
      }
    }
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

export function countAllSets(weeks: WeekEntry[]): number {
  let count = 0;
  for (const week of weeks) {
    for (const day of week.days) {
      for (const ex of day.exercises) count += ex.loggedSets.length;
    }
  }
  return count;
}

export function totalVolumeAllTime(weeks: WeekEntry[]): number {
  let total = 0;
  for (const week of weeks) {
    for (const day of week.days) {
      for (const ex of day.exercises) {
        for (const set of ex.loggedSets) total += setVolume(set);
      }
    }
  }
  return total;
}

export function completedDaysCount(weeks: WeekEntry[]): number {
  let count = 0;
  for (const week of weeks) {
    for (const day of week.days) {
      const hasLog = day.exercises.some((e) => e.loggedSets.length > 0) || day.cardio.some((c) => c.activity);
      if (hasLog) count += 1;
    }
  }
  return count;
}

export function exerciseIsComplete(ex: ExerciseEntry): boolean {
  const planned = toNumber(ex.plannedSets) ?? 0;
  return planned > 0 && ex.loggedSets.length >= planned;
}
