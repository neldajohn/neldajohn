import { WorkoutStore } from "@/types/workout";
import seedRaw from "@/data/seedData.json";

const STORAGE_KEY = "nelda-exercise-tracker:v1";

export function getSeedStore(): WorkoutStore {
  // Deep clone so callers can freely mutate without touching the bundled seed.
  return JSON.parse(JSON.stringify(seedRaw)) as WorkoutStore;
}

export function loadStore(): WorkoutStore {
  if (typeof window === "undefined") return getSeedStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getSeedStore();
    const parsed = JSON.parse(raw) as WorkoutStore;
    if (!parsed || !Array.isArray(parsed.weeks)) return getSeedStore();
    return parsed;
  } catch {
    return getSeedStore();
  }
}

export function saveStore(store: WorkoutStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.error("Failed to save workout data to localStorage", err);
  }
}

export function exportStoreAsJSON(store: WorkoutStore): string {
  return JSON.stringify(store, null, 2);
}

export function downloadStoreBackup(store: WorkoutStore): void {
  const json = exportStoreAsJSON(store);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `nelda-exercise-tracker-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function parseImportedStore(text: string): WorkoutStore {
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.weeks)) {
    throw new Error("This file doesn't look like a valid backup.");
  }
  return parsed as WorkoutStore;
}
