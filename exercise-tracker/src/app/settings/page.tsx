"use client";

import { useRef, useState } from "react";
import { useWorkout } from "@/context/WorkoutContext";
import { downloadStoreBackup, parseImportedStore } from "@/lib/storage";
import { countAllSets } from "@/lib/calculations";

export default function SettingsPage() {
  const { store, importStore, resetToSeed } = useWorkout();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseImportedStore(String(reader.result));
        importStore(parsed);
        setMessage({ kind: "success", text: `Imported ${parsed.weeks.length} weeks successfully.` });
      } catch (err) {
        setMessage({ kind: "error", text: err instanceof Error ? err.message : "Import failed." });
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-extrabold text-gray-800">Settings &amp; Backup</h1>
        <p className="text-sm text-gray-400">Your data lives in this browser&apos;s storage. Back it up regularly!</p>
      </div>

      {message && (
        <div
          className={`card p-3 text-sm ${
            message.kind === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="card p-4">
        <h2 className="font-bold text-gray-700">Current data</h2>
        <p className="mt-1 text-sm text-gray-400">
          {store.weeks.length} weeks · {countAllSets(store.weeks).toLocaleString()} sets logged
        </p>
      </div>

      <div className="card flex flex-col gap-2 p-4">
        <h2 className="font-bold text-gray-700">Export backup</h2>
        <p className="text-sm text-gray-400">Download everything as a JSON file you can keep safe or move to another device.</p>
        <button className="btn-primary self-start" onClick={() => downloadStoreBackup(store)}>
          Download backup
        </button>
      </div>

      <div className="card flex flex-col gap-2 p-4">
        <h2 className="font-bold text-gray-700">Import backup</h2>
        <p className="text-sm text-gray-400">Restore from a previously exported JSON file. This replaces all current data.</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file);
            e.target.value = "";
          }}
        />
        <button className="btn-secondary self-start" onClick={() => fileInputRef.current?.click()}>
          Choose file…
        </button>
      </div>

      <div className="card flex flex-col gap-2 border-rose-200 p-4">
        <h2 className="font-bold text-rose-600">Danger zone</h2>
        <p className="text-sm text-gray-400">
          Reset back to the original imported program (your 47-week history). Anything you&apos;ve added or changed since will be lost.
        </p>
        {confirmReset ? (
          <div className="flex gap-2">
            <button
              className="rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-bold text-white"
              onClick={() => {
                resetToSeed();
                setConfirmReset(false);
                setMessage({ kind: "success", text: "Data reset to the original program." });
              }}
            >
              Yes, reset everything
            </button>
            <button className="btn-secondary" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="self-start rounded-lg bg-rose-50 px-3 py-1.5 text-sm font-bold text-rose-600 hover:bg-rose-100" onClick={() => setConfirmReset(true)}>
            Reset to original data
          </button>
        )}
      </div>
    </div>
  );
}
