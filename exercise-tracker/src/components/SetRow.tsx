"use client";

import { useState } from "react";
import { SetEntry } from "@/types/workout";
import { setEstimatedMax } from "@/lib/calculations";
import { rpeBadgeClass } from "@/lib/ui";

interface SetRowProps {
  set: SetEntry;
  onUpdate: (patch: Partial<SetEntry>) => void;
  onDelete: () => void;
}

export default function SetRow({ set, onUpdate, onDelete }: SetRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const estMax = setEstimatedMax(set);

  return (
    <tr className="border-t border-pink-50 text-sm">
      <td className="py-1.5 pr-2 text-center font-semibold text-pink-400">{set.setNumber}</td>
      <td className="py-1.5 pr-2">
        <input
          className="input w-16 py-1 text-center"
          value={set.reps ?? ""}
          placeholder="—"
          onChange={(e) => onUpdate({ reps: e.target.value || null })}
        />
      </td>
      <td className="py-1.5 pr-2">
        <input
          className="input w-20 py-1 text-center"
          value={set.load ?? ""}
          placeholder="—"
          onChange={(e) => onUpdate({ load: e.target.value || null })}
        />
      </td>
      <td className="py-1.5 pr-2">
        <input
          className={`input w-16 py-1 text-center font-semibold ${rpeBadgeClass(set.rpe)}`}
          value={set.rpe ?? ""}
          placeholder="—"
          onChange={(e) => onUpdate({ rpe: e.target.value || null })}
        />
      </td>
      <td className="py-1.5 pr-2 text-center text-xs text-gray-400">{estMax ?? "—"}</td>
      <td className="py-1.5 pr-1 text-center">
        {confirmDelete ? (
          <span className="inline-flex gap-1">
            <button
              className="rounded bg-rose-500 px-1.5 py-0.5 text-[11px] font-bold text-white"
              onClick={onDelete}
            >
              Confirm
            </button>
            <button
              className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-bold text-gray-500"
              onClick={() => setConfirmDelete(false)}
            >
              ✕
            </button>
          </span>
        ) : (
          <button
            aria-label="Delete set"
            className="text-gray-300 hover:text-rose-500"
            onClick={() => setConfirmDelete(true)}
          >
            🗑
          </button>
        )}
      </td>
    </tr>
  );
}
