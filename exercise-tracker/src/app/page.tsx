"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useWorkout } from "@/context/WorkoutContext";
import StatCard from "@/components/StatCard";
import {
  completedDaysCount,
  countAllSets,
  totalVolumeAllTime,
  toNumber,
  setEstimatedMax,
} from "@/lib/calculations";
import { rpeBadgeClass } from "@/lib/ui";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function DashboardPage() {
  const { store, ready } = useWorkout();
  const weeks = store.weeks;

  const stats = useMemo(() => {
    const totalSets = countAllSets(weeks);
    const totalVolume = totalVolumeAllTime(weeks);
    const totalDays = completedDaysCount(weeks);
    return { totalSets, totalVolume, totalDays };
  }, [weeks]);

  const currentWeek = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let best: (typeof weeks)[number] | null = null;
    for (const w of weeks) {
      if (!w.weekBeginDate) continue;
      if (w.weekBeginDate <= today) {
        if (!best || w.weekBeginDate > (best.weekBeginDate ?? "")) best = w;
      }
    }
    return best ?? weeks[weeks.length - 1] ?? null;
  }, [weeks]);

  const recentSets = useMemo(() => {
    type Row = {
      key: string;
      weekLabel: string;
      weekId: string;
      dayLabel: string;
      exerciseName: string;
      load: string | null;
      reps: string | null;
      rpe: string | null;
      estMax: number | null;
    };
    const rows: Row[] = [];
    for (const w of weeks) {
      for (const d of w.days) {
        for (const e of d.exercises) {
          for (const s of e.loggedSets) {
            rows.push({
              key: s.id,
              weekLabel: w.label,
              weekId: w.id,
              dayLabel: d.label,
              exerciseName: e.name,
              load: s.load,
              reps: s.reps,
              rpe: s.rpe,
              estMax: setEstimatedMax(s),
            });
          }
        }
      }
    }
    return rows.slice(-8).reverse();
  }, [weeks]);

  const volumeByWeek = useMemo(() => {
    return weeks
      .filter((w) => w.weekBeginDate)
      .map((w) => {
        let vol = 0;
        for (const d of w.days) {
          for (const e of d.exercises) {
            for (const s of e.loggedSets) {
              vol += (toNumber(s.load) ?? 0) * (toNumber(s.reps) ?? 0);
            }
          }
        }
        return { label: `W${w.weekNumber ?? "?"}`, volume: Math.round(vol) };
      })
      .filter((p) => p.volume > 0)
      .slice(-16);
  }, [weeks]);

  if (!ready) {
    return <div className="p-8 text-center text-pink-400">Loading your program…</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="card overflow-hidden bg-gradient-to-br from-pink-500 to-rose-500 p-6 text-white shadow-lg">
        <p className="text-sm font-medium text-pink-100">Welcome back</p>
        <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Hey Nelda, let&apos;s lift 💪🩷</h1>
        <p className="mt-2 max-w-xl text-sm text-pink-50">
          {weeks.length} weeks logged in your program so far. Pick up where you left off or jump straight
          into logging today&apos;s session.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/log" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-pink-700 shadow hover:bg-pink-50">
            + Log a workout
          </Link>
          {currentWeek && (
            <Link
              href={`/weeks/${currentWeek.id}`}
              className="rounded-full bg-pink-600/40 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/50 hover:bg-pink-600/60"
            >
              View {currentWeek.label}
            </Link>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Weeks Tracked" value={String(weeks.length)} icon="🗓️" />
        <StatCard label="Workouts Completed" value={String(stats.totalDays)} icon="✅" />
        <StatCard label="Sets Logged" value={stats.totalSets.toLocaleString()} icon="🔢" />
        <StatCard
          label="Total Volume"
          value={`${Math.round(stats.totalVolume).toLocaleString()} kg`}
          icon="🏋️"
        />
      </section>

      {volumeByWeek.length > 1 && (
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-bold text-gray-600">Training volume by week</h2>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeByWeek} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#fce7f3" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #f9a8d4", fontSize: 12 }}
                  formatter={(v) => [`${Number(v).toLocaleString()} kg`, "Volume"]}
                />
                <Area type="monotone" dataKey="volume" stroke="#db2777" fill="url(#volGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-600">Recently logged sets</h2>
          <Link href="/exercises" className="text-xs font-semibold text-pink-600 hover:underline">
            See progress →
          </Link>
        </div>
        {recentSets.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No sets logged yet — head to Log Workout to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-400">
                  <th className="pb-2 pr-3">Exercise</th>
                  <th className="pb-2 pr-3">Week / Day</th>
                  <th className="pb-2 pr-3">Load</th>
                  <th className="pb-2 pr-3">Reps</th>
                  <th className="pb-2 pr-3">RPE</th>
                  <th className="pb-2 pr-3">Est. 1RM</th>
                </tr>
              </thead>
              <tbody>
                {recentSets.map((row) => (
                  <tr key={row.key} className="border-t border-pink-50">
                    <td className="py-2 pr-3 font-semibold text-gray-700">{row.exerciseName}</td>
                    <td className="py-2 pr-3 text-gray-500">
                      <Link href={`/weeks/${row.weekId}`} className="hover:text-pink-600 hover:underline">
                        {row.weekLabel.split("(")[0].trim()}
                      </Link>{" "}
                      · {row.dayLabel}
                    </td>
                    <td className="py-2 pr-3">{row.load ?? "—"}</td>
                    <td className="py-2 pr-3">{row.reps ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <span className={`badge ${rpeBadgeClass(row.rpe)}`}>{row.rpe ?? "—"}</span>
                    </td>
                    <td className="py-2 pr-3 text-gray-500">{row.estMax ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/weeks" className="card flex items-center gap-3 p-4 hover:border-pink-300">
          <span className="text-2xl">🗓️</span>
          <div>
            <p className="font-bold text-gray-700">Browse Weeks</p>
            <p className="text-xs text-gray-400">See every training week</p>
          </div>
        </Link>
        <Link href="/exercises" className="card flex items-center gap-3 p-4 hover:border-pink-300">
          <span className="text-2xl">📈</span>
          <div>
            <p className="font-bold text-gray-700">Exercise Progress</p>
            <p className="text-xs text-gray-400">Charts &amp; personal records</p>
          </div>
        </Link>
        <Link href="/settings" className="card flex items-center gap-3 p-4 hover:border-pink-300">
          <span className="text-2xl">💾</span>
          <div>
            <p className="font-bold text-gray-700">Backup Data</p>
            <p className="text-xs text-gray-400">Export, import, reset</p>
          </div>
        </Link>
      </section>
    </div>
  );
}
