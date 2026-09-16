"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkout } from "@/context/WorkoutContext";
import ExercisePicker from "@/components/ExercisePicker";
import StatCard from "@/components/StatCard";
import { buildExerciseHistory, computePRs, distinctLoggedExerciseNames } from "@/lib/calculations";
import { formatDate } from "@/lib/ui";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

function ExercisesPageInner() {
  const searchParams = useSearchParams();
  const { store, ready } = useWorkout();
  const [selected, setSelected] = useState(searchParams.get("name") ?? "");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const HISTORY_PAGE_SIZE = 50;

  const loggedNames = useMemo(() => distinctLoggedExerciseNames(store.weeks), [store.weeks]);

  const history = useMemo(
    () => (selected ? buildExerciseHistory(store.weeks, selected) : []),
    [store.weeks, selected]
  );
  const prs = useMemo(
    () => (selected ? computePRs(history, store.weeks, selected) : null),
    [history, store.weeks, selected]
  );

  const chartData = useMemo(
    () =>
      history.slice(-100).map((h, i) => ({
        index: i + 1,
        label: h.weekNumber ? `W${h.weekNumber}` : h.weekLabel.slice(0, 8),
        topLoad: h.topLoad,
        estMax: h.topEstMax,
      })),
    [history]
  );

  if (!ready) return <div className="p-8 text-center text-pink-400">Loading…</div>;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-extrabold text-gray-800">Exercise Progress</h1>
        <p className="text-sm text-gray-400">Pick any exercise to see how it&apos;s trending over time.</p>
      </div>

      <div className="card p-4">
        <label className="mb-1 block text-xs font-semibold text-gray-500">Exercise</label>
        <ExercisePicker
          value={selected}
          onChange={(name) => {
            setSelected(name);
            setShowAllHistory(false);
          }}
          placeholder="Choose an exercise…"
        />
        {loggedNames.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-[11px] font-semibold text-gray-400">Logged before:</span>
            {loggedNames.slice(0, 14).map((n) => (
              <button
                key={n}
                onClick={() => {
                  setSelected(n);
                  setShowAllHistory(false);
                }}
                className={`badge ${selected === n ? "bg-pink-600 text-white" : "bg-pink-50 text-pink-600 hover:bg-pink-100"}`}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {!selected && (
        <p className="card p-10 text-center text-sm text-gray-400">
          Search or pick an exercise above to view its history, chart and personal records.
        </p>
      )}

      {selected && history.length === 0 && (
        <p className="card p-10 text-center text-sm text-gray-400">
          No logged sets yet for <strong>{selected}</strong>. Go log a workout to start tracking it!
        </p>
      )}

      {selected && history.length > 0 && prs && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Best Load" value={prs.maxLoad ? `${prs.maxLoad.value}` : "—"} sublabel={prs.maxLoad?.weekLabel.split("(")[0]} icon="🏆" />
            <StatCard label="Best Est. 1RM" value={prs.maxEstMax ? `${prs.maxEstMax.value}` : "—"} sublabel={prs.maxEstMax?.weekLabel.split("(")[0]} icon="🚀" />
            <StatCard label="Most Reps (1 set)" value={prs.maxReps ? `${prs.maxReps.value}` : "—"} sublabel={prs.maxReps?.weekLabel.split("(")[0]} icon="🔁" />
            <StatCard label="Biggest Session Volume" value={prs.maxVolumeSession ? `${Math.round(prs.maxVolumeSession.value).toLocaleString()}` : "—"} sublabel={prs.maxVolumeSession?.weekLabel.split("(")[0]} icon="📦" />
          </div>

          {chartData.length > 1 && (
            <div className="card p-4">
              <h2 className="mb-3 text-sm font-bold text-gray-600">Top set load &amp; estimated 1RM</h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#fce7f3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #f9a8d4", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="topLoad" name="Top set load" stroke="#db2777" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                    <Line type="monotone" dataKey="estMax" name="Est. 1RM" stroke="#9ca3af" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="card overflow-x-auto p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-600">History</h2>
              <span className="text-xs text-gray-400">{history.length} sessions logged</span>
            </div>
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-400">
                  <th className="pb-2 pr-3">Week</th>
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Day</th>
                  <th className="pb-2 pr-3">Top Set</th>
                  <th className="pb-2 pr-3">Sets</th>
                  <th className="pb-2 pr-3">Volume</th>
                  <th className="pb-2 pr-3">Avg RPE</th>
                </tr>
              </thead>
              <tbody>
                {history
                  .slice()
                  .reverse()
                  .slice(0, showAllHistory ? undefined : HISTORY_PAGE_SIZE)
                  .map((h) => (
                    <tr key={`${h.weekId}-${h.exerciseId}`} className="border-t border-pink-50">
                      <td className="py-2 pr-3 font-semibold text-gray-700">{h.weekLabel.split("(")[0].trim()}</td>
                      <td className="py-2 pr-3 text-gray-400">{formatDate(h.weekBeginDate)}</td>
                      <td className="py-2 pr-3 text-gray-500">{h.dayLabel}</td>
                      <td className="py-2 pr-3">
                        {h.topSet ? `${h.topSet.reps ?? "—"} × ${h.topSet.load ?? "—"}` : "—"}
                      </td>
                      <td className="py-2 pr-3">{h.totalSets}</td>
                      <td className="py-2 pr-3">{Math.round(h.totalVolume).toLocaleString()}</td>
                      <td className="py-2 pr-3">{h.avgRPE ?? "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {history.length > HISTORY_PAGE_SIZE && (
              <button
                className="btn-ghost-pink mt-3"
                onClick={() => setShowAllHistory((v) => !v)}
              >
                {showAllHistory ? "Show fewer" : `Show all ${history.length} sessions`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function ExercisesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-pink-400">Loading…</div>}>
      <ExercisesPageInner />
    </Suspense>
  );
}
