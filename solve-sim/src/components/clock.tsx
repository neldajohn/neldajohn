import { useEffect, useRef, useState } from 'react';
import { useSitting } from '../store/sitting';

export function useCountdown(endsAt?: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  return endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : Infinity;
}

export function useCurrentRun() {
  return useSitting((s) => (s.sitting ? s.sitting.runs[s.sitting.index] : undefined));
}

/** Seconds left on the current game's clock, plus elapsed since it started. */
export function useGameClock() {
  const run = useCurrentRun();
  const remaining = useCountdown(run?.endsAt);
  const elapsed = run?.clockStartedAt ? Math.floor((Date.now() - run.clockStartedAt) / 1000) : 0;
  return { remaining, elapsed, endsAt: run?.endsAt };
}

/** Calls onExpire exactly once when the clock hits 0:00, with the latest closure. */
export function useAutoSubmit(onExpire: () => void) {
  const { remaining } = useGameClock();
  const fn = useRef(onExpire);
  fn.current = onExpire;
  const fired = useRef(false);
  useEffect(() => {
    if (remaining <= 0 && !fired.current) {
      fired.current = true;
      fn.current();
    }
  }, [remaining]);
}

export const mmss = (sec: number) => {
  if (!Number.isFinite(sec)) return '--:--';
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export function ClockDisplay() {
  const { remaining } = useGameClock();
  if (!Number.isFinite(remaining)) return null;
  const low = remaining <= 120;
  return (
    <div className={`rounded border px-3 py-1 font-mono text-lg tabular-nums ${low ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-700'}`} aria-live="off" aria-label="Time remaining">
      {mmss(remaining)}
    </div>
  );
}
