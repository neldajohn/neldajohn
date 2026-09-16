"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EXERCISE_CATALOG } from "@/data/exerciseCatalog";

interface ExercisePickerProps {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  id?: string;
}

export default function ExercisePicker({ value, onChange, placeholder, id }: ExercisePickerProps) {
  const [query, setQuery] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  if (value !== prevValue) {
    setPrevValue(value);
    setQuery(value);
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? EXERCISE_CATALOG.filter((e) => e.name.toLowerCase().includes(q))
      : EXERCISE_CATALOG;
    return list.slice(0, 200);
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const ex of filtered) {
      const arr = map.get(ex.category) ?? [];
      arr.push(ex);
      map.set(ex.category, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  function selectExercise(name: string) {
    onChange(name);
    setQuery(name);
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <input
        id={id}
        className="input w-full"
        placeholder={placeholder ?? "Search exercises…"}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (filtered[highlight]) selectExercise(filtered[highlight].name);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-pink-200 bg-white shadow-lg">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <div className="sticky top-0 bg-pink-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-pink-500">
                {category}
              </div>
              {items.map((ex) => {
                const globalIndex = filtered.indexOf(ex);
                return (
                  <button
                    type="button"
                    key={ex.name}
                    onClick={() => selectExercise(ex.name)}
                    className={`block w-full px-3 py-1.5 text-left text-sm ${
                      globalIndex === highlight ? "bg-pink-100 text-pink-800" : "hover:bg-pink-50"
                    }`}
                  >
                    {ex.name}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute z-40 mt-1 w-full rounded-xl border border-pink-200 bg-white p-3 text-sm text-gray-400 shadow-lg">
          No matches — you can still use &quot;{query}&quot; as a custom exercise.
        </div>
      )}
    </div>
  );
}
