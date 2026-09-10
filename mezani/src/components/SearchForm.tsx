"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CITIES } from "@/lib/seed-data";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultTime(): string {
  const now = new Date();
  const mins = now.getMinutes() < 30 ? 30 : 0;
  const hour = now.getMinutes() < 30 ? now.getHours() : now.getHours() + 1;
  return `${String(hour % 24).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function SearchForm({
  initialCity = "",
  initialDate = "",
  initialTime = "",
  initialPartySize = "2",
  variant = "hero",
}: {
  initialCity?: string;
  initialDate?: string;
  initialTime?: string;
  initialPartySize?: string;
  variant?: "hero" | "compact";
}) {
  const router = useRouter();
  const [city, setCity] = useState(initialCity);
  const [date, setDate] = useState(initialDate || todayIso());
  const [time, setTime] = useState(initialTime || defaultTime());
  const [partySize, setPartySize] = useState(initialPartySize);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (city) params.set("jiji", city);
    if (date) params.set("tarehe", date);
    if (time) params.set("saa", time);
    if (partySize) params.set("watu", partySize);
    router.push(`/mikahawa?${params.toString()}`);
  }

  const isHero = variant === "hero";

  return (
    <form
      onSubmit={handleSubmit}
      className={
        isHero
          ? "flex w-full flex-col gap-3 rounded-2xl bg-white/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-end sm:gap-2 sm:p-3"
          : "flex w-full flex-col gap-3 rounded-xl border border-black/10 bg-white p-3 sm:flex-row sm:items-end"
      }
    >
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs font-semibold text-foreground/60">Jiji</span>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-foreground focus:border-terracotta focus:outline-none"
        >
          <option value="">Miji Yote</option>
          {CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs font-semibold text-foreground/60">Tarehe</span>
        <input
          type="date"
          value={date}
          min={todayIso()}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-foreground focus:border-terracotta focus:outline-none"
        />
      </label>

      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs font-semibold text-foreground/60">Saa</span>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-foreground focus:border-terracotta focus:outline-none"
        />
      </label>

      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs font-semibold text-foreground/60">
          Idadi ya Watu
        </span>
        <select
          value={partySize}
          onChange={(e) => setPartySize(e.target.value)}
          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-foreground focus:border-terracotta focus:outline-none"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              Watu {n}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="rounded-lg bg-terracotta px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-terracotta-dark"
      >
        Tafuta
      </button>
    </form>
  );
}
