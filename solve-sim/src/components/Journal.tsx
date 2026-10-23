import { useState } from 'react';
import { beginDrag, fmtValue, useDropTarget, useFlash, type DragItem } from '../lib/drag';
import { logEvent } from '../store/sitting';

export interface JournalEntry {
  factId: string;
  value: number;
  unit?: string;
  label: string;
}

/** Research Journal: drop single values in; rename, reorder, delete; duplicates are blocked. */
export function Journal({ id, entries, setEntries, relevant }: { id: string; entries: JournalEntry[]; setEntries: (e: JournalEntry[]) => void; relevant: (factId: string) => boolean }) {
  const [flash, setFlash] = useFlash();
  const [editing, setEditing] = useState<string | null>(null);
  const drop = useDropTarget(id, (item: DragItem) => {
    if (item.kind !== 'fact') return;
    if (entries.some((e) => e.factId === item.factId)) {
      logEvent('journal_dup_blocked', { factId: item.factId });
      setFlash('Already in your journal');
      return;
    }
    setEntries([...entries, { factId: item.factId, value: item.value, unit: item.unit, label: item.label }]);
    logEvent('journal_add', { factId: item.factId, relevant: relevant(item.factId) });
    setFlash('Saved to journal');
  });
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= entries.length) return;
    const next = entries.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setEntries(next);
    logEvent('journal_reorder', { factId: entries[i].factId });
  };
  return (
    <div {...drop.props} className={`flex min-h-[200px] flex-col rounded-md border-2 border-dashed p-2 transition-colors ${drop.over ? 'border-blue-500 bg-blue-50' : drop.dragging ? 'border-blue-300' : 'border-slate-200'}`}>
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Research journal</h3>
        {flash && <span className="text-xs text-emerald-700">{flash}</span>}
      </div>
      {entries.length === 0 && <p className="px-1 text-xs text-slate-400">Drag a single value here — a table cell, chart point or highlighted fact.</p>}
      <ul className="space-y-1.5">
        {entries.map((e, i) => (
          <li key={e.factId} className="group rounded border border-slate-200 bg-white px-2 py-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span
                className="cursor-grab rounded bg-blue-50 px-1.5 py-0.5 font-mono font-semibold text-blue-800"
                onPointerDown={(ev) => beginDrag(ev, { kind: 'fact', factId: e.factId, value: e.value, label: e.label, unit: e.unit })}
                title="Drag into the calculator or an answer"
              >
                {fmtValue(e.value, e.unit)}
              </span>
              <span className="ml-auto flex gap-1 opacity-60 group-hover:opacity-100">
                <button aria-label="Move up" onClick={() => move(i, -1)} className="px-1 text-slate-500 hover:text-slate-800">
                  ↑
                </button>
                <button aria-label="Move down" onClick={() => move(i, 1)} className="px-1 text-slate-500 hover:text-slate-800">
                  ↓
                </button>
                <button aria-label="Rename" onClick={() => setEditing(e.factId)} className="px-1 text-slate-500 hover:text-slate-800">
                  ✎
                </button>
                <button
                  aria-label="Delete"
                  onClick={() => {
                    setEntries(entries.filter((x) => x.factId !== e.factId));
                    logEvent('journal_delete', { factId: e.factId, relevant: relevant(e.factId) });
                  }}
                  className="px-1 text-rose-500 hover:text-rose-700"
                >
                  ×
                </button>
              </span>
            </div>
            {editing === e.factId ? (
              <input
                autoFocus
                defaultValue={e.label}
                className="mt-1 w-full rounded border border-slate-300 px-1 py-0.5"
                onBlur={(ev) => {
                  setEntries(entries.map((x) => (x.factId === e.factId ? { ...x, label: ev.target.value } : x)));
                  logEvent('journal_rename', { factId: e.factId });
                  setEditing(null);
                }}
                onKeyDown={(ev) => ev.key === 'Enter' && (ev.target as HTMLInputElement).blur()}
              />
            ) : (
              <div className="mt-1 text-slate-500">{e.label}</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A value inside an exhibit or text that can be dragged to the journal. Enter/space adds it via keyboard. */
export function FactChip({ factId, value, unit, label, onKeyboardAdd }: { factId: string; value: number; unit?: string; label: string; onKeyboardAdd?: () => void }) {
  return (
    <span
      role="button"
      tabIndex={0}
      title={`${label} — drag to the journal`}
      onPointerDown={(e) => beginDrag(e, { kind: 'fact', factId, value, label, unit })}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onKeyboardAdd?.())}
      className="cursor-grab rounded bg-slate-100 px-1 font-medium text-slate-800 hover:bg-blue-100"
    >
      {fmtValue(value, unit)}
    </span>
  );
}
