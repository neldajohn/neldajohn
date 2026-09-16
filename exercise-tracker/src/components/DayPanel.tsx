"use client";

import { useState } from "react";
import { DayEntry } from "@/types/workout";
import { useWorkout } from "@/context/WorkoutContext";
import ExerciseCard from "@/components/ExerciseCard";
import ExercisePicker from "@/components/ExercisePicker";
import { dayTypeBadgeClass } from "@/lib/ui";

interface DayPanelProps {
  weekId: string;
  day: DayEntry;
}

export default function DayPanel({ weekId, day }: DayPanelProps) {
  const { addExercise, addCardio, deleteCardio, deleteDay } = useWorkout();
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [exName, setExName] = useState("");
  const [plannedSets, setPlannedSets] = useState("3");
  const [plannedReps, setPlannedReps] = useState("8-10");
  const [plannedRPE, setPlannedRPE] = useState("8");

  const [showAddCardio, setShowAddCardio] = useState(false);
  const [cardioActivity, setCardioActivity] = useState("");
  const [cardioDuration, setCardioDuration] = useState("");
  const [cardioIntensity, setCardioIntensity] = useState("");

  const [confirmDeleteDay, setConfirmDeleteDay] = useState(false);

  function submitExercise() {
    if (!exName.trim()) return;
    addExercise(weekId, day.id, {
      name: exName.trim(),
      plannedSets: plannedSets || null,
      plannedReps: plannedReps || null,
      plannedRPE: plannedRPE || null,
    });
    setExName("");
    setShowAddExercise(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`badge ${dayTypeBadgeClass(day.dayType)}`}>{day.label}</span>
        {confirmDeleteDay ? (
          <span className="inline-flex gap-1 text-xs">
            <button
              className="rounded bg-rose-500 px-2 py-0.5 font-bold text-white"
              onClick={() => deleteDay(weekId, day.id)}
            >
              Confirm delete day
            </button>
            <button
              className="rounded bg-gray-100 px-2 py-0.5 font-bold text-gray-500"
              onClick={() => setConfirmDeleteDay(false)}
            >
              Cancel
            </button>
          </span>
        ) : (
          <button className="text-xs text-gray-300 hover:text-rose-500" onClick={() => setConfirmDeleteDay(true)}>
            Delete day
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {day.exercises.map((ex) => (
          <ExerciseCard key={ex.id} weekId={weekId} dayId={day.id} exercise={ex} />
        ))}
        {day.exercises.length === 0 && (
          <p className="rounded-xl border border-dashed border-pink-200 p-6 text-center text-sm text-gray-400">
            No exercises yet for this day.
          </p>
        )}
      </div>

      {showAddExercise ? (
        <div className="card flex flex-col gap-2 p-3">
          <ExercisePicker value={exName} onChange={setExName} placeholder="Exercise name…" />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-400">Sets</label>
              <input className="input w-full" value={plannedSets} onChange={(e) => setPlannedSets(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-400">Reps</label>
              <input className="input w-full" value={plannedReps} onChange={(e) => setPlannedReps(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-400">Target RPE</label>
              <input className="input w-full" value={plannedRPE} onChange={(e) => setPlannedRPE(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={!exName.trim()} onClick={submitExercise}>
              Add exercise
            </button>
            <button className="btn-secondary" onClick={() => setShowAddExercise(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-ghost-pink self-start" onClick={() => setShowAddExercise(true)}>
          + Add exercise
        </button>
      )}

      <div className="mt-2 border-t border-pink-100 pt-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Cardio</p>
        {day.cardio.length > 0 && (
          <ul className="mb-2 flex flex-col gap-1">
            {day.cardio.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg bg-fuchsia-50 px-3 py-1.5 text-sm">
                <span>
                  <strong>{c.activity ?? "Activity"}</strong>
                  {c.durationMin && ` · ${c.durationMin} min`}
                  {c.intensity && ` · Intensity ${c.intensity}`}
                  {c.notes && <span className="text-gray-400"> — {c.notes}</span>}
                </span>
                <button className="text-gray-300 hover:text-rose-500" onClick={() => deleteCardio(weekId, day.id, c.id)}>
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
        {showAddCardio ? (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-400">Activity</label>
              <input className="input w-40" value={cardioActivity} onChange={(e) => setCardioActivity(e.target.value)} placeholder="Walking" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-400">Duration (min)</label>
              <input className="input w-28" value={cardioDuration} onChange={(e) => setCardioDuration(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-400">Intensity</label>
              <input className="input w-24" value={cardioIntensity} onChange={(e) => setCardioIntensity(e.target.value)} />
            </div>
            <button
              className="btn-primary"
              onClick={() => {
                addCardio(weekId, day.id, {
                  activity: cardioActivity || null,
                  durationMin: cardioDuration || null,
                  intensity: cardioIntensity || null,
                  notes: null,
                });
                setCardioActivity("");
                setCardioDuration("");
                setCardioIntensity("");
                setShowAddCardio(false);
              }}
            >
              Add
            </button>
            <button className="btn-secondary" onClick={() => setShowAddCardio(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn-ghost-pink" onClick={() => setShowAddCardio(true)}>
            + Log cardio
          </button>
        )}
      </div>
    </div>
  );
}
