"use client";

import { useState } from "react";
import { ExerciseEntry } from "@/types/workout";
import { useWorkout } from "@/context/WorkoutContext";
import SetRow from "@/components/SetRow";
import { exerciseIsComplete, toNumber } from "@/lib/calculations";
import Link from "next/link";

interface ExerciseCardProps {
  weekId: string;
  dayId: string;
  exercise: ExerciseEntry;
}

export default function ExerciseCard({ weekId, dayId, exercise }: ExerciseCardProps) {
  const { addSet, updateSet, deleteSet, updateExercise, deleteExercise } = useWorkout();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(exercise.notes ?? "");
  const [confirmDeleteExercise, setConfirmDeleteExercise] = useState(false);

  const complete = exerciseIsComplete(exercise);
  const plannedSets = toNumber(exercise.plannedSets);

  return (
    <div className="rounded-xl border border-pink-100 bg-pink-50/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            href={`/exercises?name=${encodeURIComponent(exercise.name)}`}
            className="font-bold text-gray-800 hover:text-pink-600 hover:underline"
          >
            {exercise.name}
          </Link>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
            {plannedSets && <span>Plan: {exercise.plannedSets} × {exercise.plannedReps ?? "—"}</span>}
            {exercise.plannedRPE && <span>Target RPE {exercise.plannedRPE}</span>}
            {exercise.rest && <span>Rest {exercise.rest}</span>}
            {exercise.tempo && <span>Tempo {exercise.tempo}</span>}
            {exercise.pct1RM && <span>{exercise.pct1RM}% 1RM</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {plannedSets ? (
            <span className={`badge ${complete ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              {exercise.loggedSets.length}/{exercise.plannedSets} sets
            </span>
          ) : (
            <span className="badge bg-gray-100 text-gray-500">{exercise.loggedSets.length} sets</span>
          )}
          {confirmDeleteExercise ? (
            <span className="inline-flex gap-1">
              <button
                className="rounded bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white"
                onClick={() => deleteExercise(weekId, dayId, exercise.id)}
              >
                Confirm
              </button>
              <button
                className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500"
                onClick={() => setConfirmDeleteExercise(false)}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              className="text-xs text-gray-300 hover:text-rose-500"
              onClick={() => setConfirmDeleteExercise(true)}
              aria-label="Delete exercise"
            >
              🗑
            </button>
          )}
        </div>
      </div>

      {exercise.loggedSets.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full max-w-md table-fixed text-sm">
            <colgroup>
              <col className="w-8" />
              <col className="w-20" />
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
                <th className="pb-1 pr-2 text-center">Est 1RM</th>
                <th className="pb-1 pr-1"></th>
              </tr>
            </thead>
            <tbody>
              {exercise.loggedSets
                .slice()
                .sort((a, b) => a.setNumber - b.setNumber)
                .map((set) => (
                  <SetRow
                    key={set.id}
                    set={set}
                    onUpdate={(patch) => updateSet(weekId, dayId, exercise.id, set.id, patch)}
                    onDelete={() => deleteSet(weekId, dayId, exercise.id, set.id)}
                  />
                ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          className="btn-ghost-pink"
          onClick={() => addSet(weekId, dayId, exercise.id, {})}
        >
          + Add set
        </button>
        {!editingNotes && (
          <button className="text-xs font-semibold text-gray-400 hover:text-pink-600" onClick={() => setEditingNotes(true)}>
            {exercise.notes ? "Edit notes" : "+ Add note"}
          </button>
        )}
      </div>

      {editingNotes ? (
        <div className="mt-2 flex gap-2">
          <input
            className="input flex-1"
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="How did it feel? Form cues, substitutions…"
            autoFocus
          />
          <button
            className="btn-primary"
            onClick={() => {
              updateExercise(weekId, dayId, exercise.id, { notes: notesDraft || null });
              setEditingNotes(false);
            }}
          >
            Save
          </button>
        </div>
      ) : (
        exercise.notes && <p className="mt-2 text-xs italic text-gray-500">&quot;{exercise.notes}&quot;</p>
      )}
    </div>
  );
}
