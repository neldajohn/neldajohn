"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkout } from "@/context/WorkoutContext";
import DayPanel from "@/components/DayPanel";
import { formatDate, dayTypeBadgeClass } from "@/lib/ui";

const DAY_TYPE_PRESETS = ["Upper", "Lower", "Push", "Pull", "Legs", "Full Body", "Bench", "Squat", "Deadlift", "Custom"];

export default function WeekDetailPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = use(params);
  const { store, ready, addDay, deleteWeek, updateWeek } = useWorkout();
  const router = useRouter();

  const week = store.weeks.find((w) => w.id === weekId);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [showAddDay, setShowAddDay] = useState(false);
  const [newDayNumber, setNewDayNumber] = useState("");
  const [newDayType, setNewDayType] = useState("Upper");
  const [confirmDeleteWeek, setConfirmDeleteWeek] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(week?.label ?? "");

  if (!ready) return <div className="p-8 text-center text-pink-400">Loading…</div>;

  if (!week) {
    return (
      <div className="card p-8 text-center">
        <p className="text-gray-500">This week doesn&apos;t exist (maybe it was deleted).</p>
        <Link href="/weeks" className="btn-primary mt-4 inline-block">
          Back to Weeks
        </Link>
      </div>
    );
  }

  const currentDay = week.days.find((d) => d.id === activeDayId) ?? week.days[0] ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/weeks" className="text-xs font-semibold text-pink-500 hover:underline">
          ← All weeks
        </Link>
      </div>

      <div className="card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {editingLabel ? (
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  autoFocus
                />
                <button
                  className="btn-primary"
                  onClick={() => {
                    updateWeek(week.id, { label: labelDraft });
                    setEditingLabel(false);
                  }}
                >
                  Save
                </button>
              </div>
            ) : (
              <h1
                className="cursor-text truncate text-xl font-extrabold text-gray-800 hover:text-pink-700"
                onClick={() => setEditingLabel(true)}
                title="Click to rename"
              >
                {week.label}
              </h1>
            )}
            <p className="text-sm text-gray-400">Week begins {formatDate(week.weekBeginDate)}</p>
          </div>
          {confirmDeleteWeek ? (
            <span className="inline-flex shrink-0 gap-1">
              <button
                className="rounded bg-rose-500 px-2 py-1 text-xs font-bold text-white"
                onClick={() => {
                  deleteWeek(week.id);
                  router.push("/weeks");
                }}
              >
                Confirm delete
              </button>
              <button
                className="rounded bg-gray-100 px-2 py-1 text-xs font-bold text-gray-500"
                onClick={() => setConfirmDeleteWeek(false)}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button className="btn-secondary shrink-0" onClick={() => setConfirmDeleteWeek(true)}>
              Delete week
            </button>
          )}
        </div>

        {week.nutrition && Object.keys(week.nutrition).length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-pink-100 pt-3">
            {Object.entries(week.nutrition).map(([k, v]) => (
              <span key={k} className="badge bg-gray-100 text-gray-600">
                {k}: {v}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {week.days.map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveDayId(d.id)}
            className={`badge cursor-pointer text-sm ${
              currentDay?.id === d.id ? "ring-2 ring-pink-400" : "opacity-70"
            } ${dayTypeBadgeClass(d.dayType)}`}
          >
            {d.label}
          </button>
        ))}
        {showAddDay ? (
          <div className="flex flex-wrap items-center gap-2 rounded-full bg-gray-50 px-3 py-1">
            <input
              className="input w-14 py-1"
              placeholder="#"
              value={newDayNumber}
              onChange={(e) => setNewDayNumber(e.target.value)}
            />
            <select className="input py-1" value={newDayType} onChange={(e) => setNewDayType(e.target.value)}>
              {DAY_TYPE_PRESETS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              className="btn-primary py-1"
              onClick={() => {
                const num = newDayNumber || String(week.days.length + 1);
                addDay(week.id, `Day ${num} - ${newDayType}`, newDayType);
                setShowAddDay(false);
                setNewDayNumber("");
              }}
            >
              Add
            </button>
            <button className="text-xs text-gray-400" onClick={() => setShowAddDay(false)}>
              ✕
            </button>
          </div>
        ) : (
          <button className="badge bg-white text-pink-500 ring-1 ring-pink-200 hover:bg-pink-50" onClick={() => setShowAddDay(true)}>
            + Add day
          </button>
        )}
      </div>

      {currentDay ? (
        <DayPanel weekId={week.id} day={currentDay} />
      ) : (
        <p className="rounded-xl border border-dashed border-pink-200 p-8 text-center text-sm text-gray-400">
          No training days yet — add one above to start logging.
        </p>
      )}
    </div>
  );
}
