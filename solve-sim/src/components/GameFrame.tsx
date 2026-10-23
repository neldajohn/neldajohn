import type { ReactNode } from 'react';
import { GAME_NAMES } from '../config';
import { useSitting } from '../store/sitting';
import { ClockDisplay } from './clock';

/** Standard three-column layout: phase sidebar left, work area centre, reference panel right. */
export function GameFrame({ sidebar, children, right, subtitle }: { sidebar?: ReactNode; children: ReactNode; right?: ReactNode; subtitle?: ReactNode }) {
  const sitting = useSitting((s) => s.sitting);
  if (!sitting) return null;
  const game = sitting.games[sitting.index];
  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-800" onClickCapture={(e) => logClick(e.target as HTMLElement)}>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-semibold text-slate-800">{GAME_NAMES[game]}</span>
          <span className="text-xs text-slate-400">
            Game {sitting.index + 1} of {sitting.games.length}
          </span>
          {subtitle && <span className="text-xs text-slate-500">{subtitle}</span>}
        </div>
        <ClockDisplay />
      </header>
      <div className="flex min-h-0 flex-1">
        {sidebar && <aside className="w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4">{sidebar}</aside>}
        <main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
        {right && <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">{right}</aside>}
      </div>
    </div>
  );
}

function logClick(el: HTMLElement) {
  const label = el.closest('button,[role=button],a,input,select')?.textContent?.slice(0, 40) ?? el.tagName;
  useSitting.getState().log('click', { label });
}
