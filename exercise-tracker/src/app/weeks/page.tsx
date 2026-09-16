"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useWorkout } from "@/context/WorkoutContext";
import { formatDate } from "@/lib/ui";
import { countAllSets } from "@/lib/calculations";

export default function WeeksPage() {
  const { store, ready, addWeek } = useWorkout();
  const [search, setSearch] = useState("");
  const [showNewWeek, setShowNewWeek] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDate, setNewDate] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return store.weeks;
    return store.weeks.filter((w) => w.label.toLowerCase().includes(q));
  }, [store.weeks, search]);

  if (!ready) return <div className="p-8 text-center text-pink-400">Loading…</div>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-800">All Weeks</h1>
          <p className="text-sm text-gray-400">{store.weeks.length} weeks in your program</p>
        </div>
        <div className="flex gap-2">
          <input
            className="input w-full sm:w-56"
            placeholder="Search weeks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn-primary whitespace-nowrap" onClick={() => setShowNewWeek((s) => !s)}>
            + New Week
          </button>
        </div>
      </div>

      {showNewWeek && (
        <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-gray-500">Week label</label>
            <input
              className="input w-full"
              placeholder="e.g. WEEK 48 (WB 20/9/26)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Week begins</label>
            <input type="date" className="input" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </div>
          <button
            className="btn-primary"
            disabled={!newLabel.trim()}
            onClick={() => {
              addWeek(newLabel.trim(), newDate || null);
              setNewLabel("");
              setNewDate("");
              setShowNewWeek(false);
            }}
          >
            Create
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((week) => {
          const totalSets = countAllSets([week]);
          const loggedDays = week.days.filter(
            (d) => d.exercises.some((e) => e.loggedSets.length > 0) || d.cardio.some((c) => c.activity)
          ).length;
          return (
            <Link
              key={week.id}
              href={`/weeks/${week.id}`}
              className="card flex flex-col gap-2 p-4 transition hover:border-pink-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-extrabold text-gray-700">
                  {week.weekNumber !== null ? `Week ${week.weekNumber}` : week.label.split("(")[0].trim()}
                </p>
                {loggedDays > 0 && (
                  <span className="badge shrink-0 bg-pink-100 text-pink-700">
                    {loggedDays}/{week.days.length} days
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">{formatDate(week.weekBeginDate)}</p>
              {week.note && <p className="text-xs font-medium text-fuchsia-500">{week.note}</p>}
              <div className="mt-1 flex flex-wrap gap-1">
                {week.days.map((d) => (
                  <span key={d.id} className="badge bg-gray-100 text-gray-500">
                    {d.dayType}
                  </span>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-400">{totalSets} sets logged</p>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-gray-400">No weeks match &quot;{search}&quot;.</p>
        )}
      </div>
    </div>
  );
}
