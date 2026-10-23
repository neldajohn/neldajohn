import { useState } from 'react';
import { evaluateExpression } from '../lib/calc';
import { beginDrag, fmtValue, useDropTarget } from '../lib/drag';
import { logEvent } from '../store/sitting';

export interface CalcHistory {
  expr: string;
  result: number;
}

const KEYS = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '^', '+', '(', ')', '⌫', 'C'];

/** On-screen calculator with history. Values drop in from the journal; results drag out to answers. */
export function Calculator({ history, setHistory }: { history: CalcHistory[]; setHistory: (h: CalcHistory[]) => void }) {
  const [expr, setExpr] = useState('');
  const [error, setError] = useState<string | null>(null);
  const drop = useDropTarget('calculator', (item) => {
    setExpr((e) => e + String(item.value));
    logEvent('calc_drop', { value: item.value });
  });
  const press = (k: string) => {
    logEvent('calc_key', { key: k });
    setError(null);
    if (k === 'C') setExpr('');
    else if (k === '⌫') setExpr((e) => e.slice(0, -1));
    else setExpr((e) => e + k);
  };
  const run = () => {
    try {
      const result = Math.round(evaluateExpression(expr) * 1e8) / 1e8;
      setHistory([{ expr, result }, ...history].slice(0, 30));
      logEvent('calc_eval', { expr, result });
      setExpr(String(result));
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <div className="space-y-2">
      <div {...drop.props} className={`rounded border p-2 ${drop.over ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white'}`}>
        <input
          aria-label="Calculator expression"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          onKeyDown={(e) => {
            logEvent('calc_key', { key: e.key });
            if (e.key === 'Enter') run();
          }}
          className="w-full bg-transparent text-right font-mono text-lg outline-none"
          placeholder="0"
        />
        {error && <div className="text-right text-xs text-rose-600">{error}</div>}
      </div>
      <div className="grid grid-cols-4 gap-1">
        {KEYS.map((k) => (
          <button key={k} onClick={() => press(k)} className="rounded border border-slate-200 bg-slate-50 py-1.5 font-mono text-sm hover:bg-slate-100">
            {k}
          </button>
        ))}
        <button onClick={run} className="col-span-4 rounded bg-blue-700 py-1.5 text-sm font-medium text-white hover:bg-blue-800">
          =
        </button>
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">History</div>
        <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
          {history.map((h, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded bg-slate-50 px-2 py-1">
              <span className="truncate font-mono text-slate-500">{h.expr}</span>
              <span
                className="cursor-grab rounded bg-white px-1.5 font-mono font-semibold text-slate-800 ring-1 ring-slate-200"
                onPointerDown={(e) => beginDrag(e, { kind: 'value', value: h.result, label: h.expr })}
                title="Drag into an answer box"
              >
                {fmtValue(h.result)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
