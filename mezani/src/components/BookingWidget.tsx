"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { generateTimeSlots } from "@/lib/time-slots";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BookingWidget({
  slug,
  opensAt,
  closesAt,
  initialDate,
  initialTime,
  initialPartySize,
}: {
  slug: string;
  opensAt: string;
  closesAt: string;
  initialDate?: string;
  initialTime?: string;
  initialPartySize?: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate || todayIso());
  const [partySize, setPartySize] = useState(initialPartySize || "2");
  const [selectedTime, setSelectedTime] = useState(initialTime);

  const slots = useMemo(
    () => generateTimeSlots(opensAt, closesAt, `${slug}-${date}`),
    [slug, opensAt, closesAt, date],
  );

  function bookSlot(time: string) {
    setSelectedTime(time);
    const params = new URLSearchParams();
    params.set("tarehe", date);
    params.set("saa", time);
    params.set("watu", partySize);
    router.push(`/mkahawa/${slug}/weka?${params.toString()}`);
  }

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-forest-dark">Weka Nafasi</h2>

      <div className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-foreground/60">
            Idadi ya Watu
          </span>
          <select
            value={partySize}
            onChange={(e) => setPartySize(e.target.value)}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm focus:border-terracotta focus:outline-none"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Watu {n}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-foreground/60">
            Tarehe
          </span>
          <input
            type="date"
            value={date}
            min={todayIso()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm focus:border-terracotta focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-4">
        <span className="text-xs font-semibold text-foreground/60">
          Saa Zilizopo
        </span>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {slots.map((slot) => (
            <button
              key={slot.time}
              type="button"
              disabled={!slot.available}
              onClick={() => bookSlot(slot.time)}
              className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                !slot.available
                  ? "cursor-not-allowed bg-black/5 text-black/25 line-through"
                  : slot.time === selectedTime
                    ? "bg-terracotta text-white"
                    : "bg-sand text-forest-dark hover:bg-terracotta hover:text-white"
              }`}
            >
              {slot.time}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-foreground/50">
          Saa zisizopatikana zimezimwa. Chagua saa nyingine au badilisha
          tarehe.
        </p>
      </div>
    </div>
  );
}
