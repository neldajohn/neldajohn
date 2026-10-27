/** localStorage wrappers — every access can throw (private mode, quota), so never let it break a run. */
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable or full — run continues in memory */
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const KEYS = {
  active: 'solve-sim:active',
  history: 'solve-sim:history',
  settings: 'solve-sim:settings',
  drills: 'solve-sim:drills',
};
