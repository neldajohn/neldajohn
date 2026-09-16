"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useWorkout } from "@/context/WorkoutContext";
import ExercisePicker from "@/components/ExercisePicker";
import { makeId } from "@/lib/id";

interface DraftSet {
  id: string;
  reps: string;
  load: string;
  rpe: string;
}

interface DraftExercise {
  id: string;
  name: string;
  sets: DraftSet[];
}

const DAY_TYPE_PRESETS = ["Upper", "Lower", "Push", "Pull", "Legs", "Full Body", "Bench", "Squat", "Deadlift", "Custom"];

function newSet(): DraftSet {
  return { id: makeId("draft-set"), reps: "", load: "", rpe: "" };
}

function newExercise(): DraftExercise {
  return { id: makeId("draft-ex"), name: "", sets: [newSet()] };
}

export default function LogWorkoutPage() {
  const { store, addExerciseWithSets, addDay, addWeek } = useWorkout();

  const sortedWeeks = useMemo(
    () =>
      store.weeks
        .slice()
        .sort((a, b) => (a.weekBeginDate ?? "").localeCompare(b.weekBeginDate ?? "")),
    [store.weeks]
  );

  const [weekId, setWeekId] = useState<string>(sortedWeeks[sortedWeeks.length - 1]?.id ?? "");
  const week = store.weeks.find((w) => w.id === weekId) ?? null;

  const [dayId, setDayId] = useState<string>(week?.days[0]?.id ?? "");
  const day = week?.days.find((d) => d.id === dayId) ?? null;

  const [showNewDay, setShowNewDay] = useState(false);
  const [newDayType, setNewDayType] = useState("Upper");

  const [exercises, setExercises] = useState<DraftExercise[]>([newExercise()]);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  function handleWeekChange(id: string) {
    setWeekId(id);
    const w = store.weeks.find((x) => x.id === id);
    setDayId(w?.days[0]?.id ?? "");
  }

  function updateExercise(id: string, patch: Partial<DraftExercise>) {
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function updateSet(exId: string, setId: string, patch: Partial<DraftSet>) {
    setExercises((prev) =>
      prev.map((e) =>
        e.id === exId ? { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) } : e
      )
    );
  }

  function addSetRow(exId: string) {
    setExercises((prev) => prev.map((e) => (e.id === exId ? { ...e, sets: [...e.sets, newSet()] } : e)));
  }

  function removeSetRow(exId: string, setId: string) {
    setExercises((prev) =>
      prev.map((e) => (e.id === exId ? { ...e, sets: e.sets.filter((s) => s.id !== setId) } : e))
    );
  }

  function removeExercise(exId: string) {
    setExercises((prev) => prev.filter((e) => e.id !== exId));
  }

  function canSave() {
    if (!weekId || !dayId) return false;
    return exercises.some((e) => e.name.trim() && e.sets.some((s) => s.reps || s.load || s.rpe));
  }

  function handleSave() {
    if (!weekId || !dayId) return;
    let setsSaved = 0;
    for (const ex of exercises) {
      if (!ex.name.trim()) continue;
      const validSets = ex.sets.filter((s) => s.reps || s.load || s.rpe);
      if (validSets.length === 0) continue;
      addExerciseWithSets(
        weekId,
        dayId,
        { name: ex.name.trim() },
        validSets.map((s, idx) => ({
          setNumber: idx + 1,
          reps: s.reps || null,
          load: s.load || null,
          rpe: s.rpe || null,
        }))
      );
      setsSaved += validSets.length;
    }
    setSavedCount(setsSaved);
    setExercises([newExercise()]);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-extrabold text-gray-800">Log a Workout</h1>
        <p className="text-sm text-gray-400">Pick a week &amp; day, then record every exercise and set.</p>
      </div>

      <div className="card flex flex-col gap-3 p-4 sm:flex-row">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold text-gray-500">Week</label>
          <select className="input w-full" value={weekId} onChange={(e) => handleWeekChange(e.target.value)}>
            <option value="">Select a week…</option>
            {sortedWeeks.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold text-gray-500">Day</label>
          <select className="input w-full" value={dayId} onChange={(e) => setDayId(e.target.value)} disabled={!week}>
            <option value="">Select a day…</option>
            {week?.days.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {week && (
        <div>
          {showNewDay ? (
            <div className="card flex flex-wrap items-end gap-2 p-3">
              <select className="input" value={newDayType} onChange={(e) => setNewDayType(e.target.value)}>
                {DAY_TYPE_PRESETS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                className="btn-primary"
                onClick={() => {
                  const num = week.days.length + 1;
                  addDay(week.id, `Day ${num} - ${newDayType}`, newDayType);
                  setShowNewDay(false);
                }}
              >
                Add day to {week.label.split("(")[0].trim()}
              </button>
              <button className="btn-secondary" onClick={() => setShowNewDay(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="text-xs font-semibold text-pink-500 hover:underline" onClick={() => setShowNewDay(true)}>
              + This week needs a new day
            </button>
          )}
        </div>
      )}

      {!week && (
        <button
          className="btn-ghost-pink self-start"
          onClick={() => {
            const label = `WEEK ${store.weeks.length + 1}`;
            addWeek(label, new Date().toISOString().slice(0, 10));
          }}
        >
          + Create a new week to get started
        </button>
      )}

      {day && (
        <>
          <div className="flex flex-col gap-4">
            {exercises.map((ex, exIndex) => (
              <div key={ex.id} className="card flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-pink-400">Exercise {exIndex + 1}</span>
                  {exercises.length > 1 && (
                    <button className="text-xs text-gray-300 hover:text-rose-500" onClick={() => removeExercise(ex.id)}>
                      Remove
                    </button>
                  )}
                </div>
                <ExercisePicker value={ex.name} onChange={(name) => updateExercise(ex.id, { name })} />

                <div className="overflow-x-auto">
                  <table className="w-full max-w-sm table-fixed text-sm">
                    <colgroup>
                      <col className="w-8" />
                      <col className="w-20" />
                      <col className="w-20" />
                      <col className="w-20" />
                      <col className="w-8" />
                    </colgroup>
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                        <th className="pb-1 pr-2 text-center">#</th>
                        <th className="pb-1 pr-2">Reps</th>
                        <th className="pb-1 pr-2">Load</th>
                        <th className="pb-1 pr-2">RPE</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ex.sets.map((s, i) => (
                        <tr key={s.id}>
                          <td className="py-1 pr-2 text-center font-semibold text-pink-400">{i + 1}</td>
                          <td className="py-1 pr-2">
                            <input
                              className="input w-16 py-1 text-center"
                              value={s.reps}
                              onChange={(e) => updateSet(ex.id, s.id, { reps: e.target.value })}
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              className="input w-20 py-1 text-center"
                              value={s.load}
                              onChange={(e) => updateSet(ex.id, s.id, { load: e.target.value })}
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              className="input w-16 py-1 text-center"
                              value={s.rpe}
                              onChange={(e) => updateSet(ex.id, s.id, { rpe: e.target.value })}
                            />
                          </td>
                          <td>
                            {ex.sets.length > 1 && (
                              <button className="text-gray-300 hover:text-rose-500" onClick={() => removeSetRow(ex.id, s.id)}>
                                🗑
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="btn-ghost-pink self-start" onClick={() => addSetRow(ex.id)}>
                  + Add set
                </button>
              </div>
            ))}
          </div>

          <button className="btn-secondary self-start" onClick={() => setExercises((prev) => [...prev, newExercise()])}>
            + Add another exercise
          </button>

          <button className="btn-primary self-start" disabled={!canSave()} onClick={handleSave}>
            Save Workout
          </button>

          {savedCount !== null && (
            <div className="card border-green-200 bg-green-50 p-4 text-sm text-green-700">
              🎉 Saved {savedCount} set{savedCount === 1 ? "" : "s"}!{" "}
              <Link href={`/weeks/${weekId}`} className="font-bold underline">
                View this week
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
