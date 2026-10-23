import type { ReactNode } from 'react';
import { beginDrag, fmtValue } from '../lib/drag';
import type { ChartType } from '../games/redrock/model';

/** Muted categorical palette — calm "research software" look. */
export const PALETTE = ['#2563eb', '#64748b', '#0d9488', '#b45309', '#7c3aed', '#be123c'];

export interface Pt {
  value: number;
  /** When set, the point can be dragged into a journal or calculator. */
  drag?: { factId?: string; label: string; unit?: string };
}

const W = 520;
const H = 240;
const PAD = { l: 48, r: 12, t: 12, b: 36 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil((v * 1.1) / p) * p;
}

function onDrag(pt: Pt) {
  return pt.drag
    ? (e: React.PointerEvent) =>
        beginDrag(e, pt.drag!.factId ? { kind: 'fact', factId: pt.drag!.factId, value: pt.value, label: pt.drag!.label, unit: pt.drag!.unit } : { kind: 'value', value: pt.value, label: pt.drag!.label, unit: pt.drag!.unit })
    : undefined;
}

function Axes({ max, min = 0, xLabels, children }: { max: number; min?: number; xLabels: string[]; children: ReactNode }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min + f * (max - min));
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  const step = (W - PAD.l - PAD.r) / xLabels.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="max-h-64 w-full select-none" role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#e2e8f0" />
          <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#94a3b8">
            {Math.round(t * 10) / 10}
          </text>
        </g>
      ))}
      {min < 0 && <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="#94a3b8" />}
      {xLabels.map((l, i) => (
        <text key={l + i} x={PAD.l + step * (i + 0.5)} y={H - PAD.b + 16} textAnchor="middle" fontSize="10" fill="#475569">
          {l.length > 18 ? l.slice(0, 17) + '…' : l}
        </text>
      ))}
      {children}
    </svg>
  );
}

export function BarChart({ xLabels, series }: { xLabels: string[]; series: { name: string; pts: Pt[] }[] }) {
  const vals = series.flatMap((s) => s.pts.map((p) => p.value));
  const max = niceMax(Math.max(...vals, 0));
  const min = Math.min(0, ...vals) < 0 ? -niceMax(-Math.min(...vals)) : 0;
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  const step = (W - PAD.l - PAD.r) / xLabels.length;
  const bw = (step * 0.7) / series.length;
  return (
    <div>
      <Axes max={max} min={min} xLabels={xLabels}>
        {series.map((s, si) =>
          s.pts.map((p, i) => {
            const x = PAD.l + step * i + step * 0.15 + bw * si;
            const top = Math.min(y(p.value), y(0));
            return (
              <g key={`${si}-${i}`} onPointerDown={onDrag(p)} className={p.drag ? 'cursor-grab' : ''}>
                <rect x={x} y={top} width={bw - 2} height={Math.abs(y(p.value) - y(0))} fill={PALETTE[si]} opacity={0.85} className="hover:opacity-100" />
                <text x={x + bw / 2 - 1} y={top - 3} textAnchor="middle" fontSize="10" fill="#334155">
                  {fmtValue(p.value)}
                </text>
              </g>
            );
          }),
        )}
      </Axes>
      <Legend names={series.map((s) => s.name)} />
    </div>
  );
}

export function LineChart({ xLabels, series }: { xLabels: string[]; series: { name: string; pts: Pt[] }[] }) {
  const vals = series.flatMap((s) => s.pts.map((p) => p.value));
  const max = niceMax(Math.max(...vals, 0));
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const step = (W - PAD.l - PAD.r) / xLabels.length;
  const x = (i: number) => PAD.l + step * (i + 0.5);
  return (
    <div>
      <Axes max={max} xLabels={xLabels}>
        {series.map((s, si) => (
          <g key={si}>
            <polyline fill="none" stroke={PALETTE[si]} strokeWidth={2} points={s.pts.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} />
            {s.pts.map((p, i) => (
              <g key={i} onPointerDown={onDrag(p)} className={p.drag ? 'cursor-grab' : ''}>
                <circle cx={x(i)} cy={y(p.value)} r={8} fill="transparent" />
                <circle cx={x(i)} cy={y(p.value)} r={3.5} fill={PALETTE[si]} />
                <text x={x(i)} y={y(p.value) - 8} textAnchor="middle" fontSize="10" fill="#334155">
                  {fmtValue(p.value)}
                </text>
              </g>
            ))}
          </g>
        ))}
      </Axes>
      <Legend names={series.map((s) => s.name)} />
    </div>
  );
}

export function BubbleChart({ points, xLabel, yLabel }: { points: { label: string; x: Pt; y: Pt; size: Pt }[]; xLabel: string; yLabel: string }) {
  const maxX = niceMax(Math.max(...points.map((p) => p.x.value)));
  const maxY = niceMax(Math.max(...points.map((p) => p.y.value)));
  const maxS = Math.max(...points.map((p) => p.size.value));
  const sx = (v: number) => PAD.l + (v / maxX) * (W - PAD.l - PAD.r);
  const sy = (v: number) => PAD.t + (1 - v / maxY) * (H - PAD.t - PAD.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="max-h-64 w-full select-none">
      <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="#cbd5e1" />
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} stroke="#cbd5e1" />
      <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#475569">
        {xLabel}
      </text>
      <text x={12} y={H / 2} textAnchor="middle" fontSize="10" fill="#475569" transform={`rotate(-90 12 ${H / 2})`}>
        {yLabel}
      </text>
      {points.map((p, i) => {
        const r = 6 + 22 * Math.sqrt(p.size.value / maxS);
        return (
          <g key={p.label}>
            <circle cx={sx(p.x.value)} cy={sy(p.y.value)} r={r} fill={PALETTE[i]} opacity={0.35} onPointerDown={onDrag(p.size)} className="cursor-grab" />
            <circle cx={sx(p.x.value)} cy={sy(p.y.value)} r={3} fill={PALETTE[i]} />
            <text x={sx(p.x.value)} y={sy(p.y.value) - r - 3} textAnchor="middle" fontSize="10" fill="#334155">
              {p.label}
            </text>
            <text x={sx(p.x.value) + 6} y={sy(p.y.value) + 12} fontSize="9" fill="#64748b" onPointerDown={onDrag(p.x)} className="cursor-grab">
              x {fmtValue(p.x.value)}
            </text>
            <text x={sx(p.x.value) + 6} y={sy(p.y.value) + 22} fontSize="9" fill="#64748b" onPointerDown={onDrag(p.y)} className="cursor-grab">
              y {fmtValue(p.y.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Legend({ names }: { names: string[] }) {
  if (names.length < 2) return null;
  return (
    <div className="mt-1 flex gap-4 text-xs text-slate-500">
      {names.map((n, i) => (
        <span key={n} className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm" style={{ background: PALETTE[i] }} />
          {n}
        </span>
      ))}
    </div>
  );
}

/** Live preview for the Visual Report tab: renders any chart type from categories + values. */
export function PreviewChart({ type, categories, values }: { type: ChartType; categories: string[]; values: (number | null)[] }) {
  const v = values.map((x) => (x === null || !Number.isFinite(x) ? 0 : x));
  const pts = v.map((value) => ({ value }));
  if (type === 'bar') return <BarChart xLabels={categories} series={[{ name: '', pts }]} />;
  if (type === 'line') return <LineChart xLabels={categories} series={[{ name: '', pts }]} />;
  if (type === 'pie') return <Pie categories={categories} values={v} />;
  if (type === 'stacked') return <Stacked categories={categories} values={v} />;
  if (type === 'scatter') {
    return (
      <BubbleChart
        xLabel="Category index"
        yLabel="Value"
        points={v.map((y, i) => ({ label: categories[i], x: { value: i + 1 }, y: { value: y }, size: { value: 1 } }))}
      />
    );
  }
  return <Waterfall categories={categories} values={v} />;
}

function Pie({ categories, values }: { categories: string[]; values: number[] }) {
  const total = values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  let a0 = -Math.PI / 2;
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="-110 -110 220 220" className="h-56 w-56">
        {values.map((val, i) => {
          const a1 = a0 + (2 * Math.PI * Math.max(0, val)) / total;
          const large = a1 - a0 > Math.PI ? 1 : 0;
          const d = `M0 0 L${100 * Math.cos(a0)} ${100 * Math.sin(a0)} A100 100 0 ${large} 1 ${100 * Math.cos(a1)} ${100 * Math.sin(a1)} Z`;
          a0 = a1;
          return <path key={i} d={d} fill={PALETTE[i % PALETTE.length]} stroke="white" />;
        })}
      </svg>
      <Legend names={categories} />
    </div>
  );
}

function Stacked({ categories, values }: { categories: string[]; values: number[] }) {
  const total = values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  return (
    <div>
      <div className="flex h-10 w-full overflow-hidden rounded">
        {values.map((v, i) => (
          <div key={i} style={{ width: `${(100 * Math.max(0, v)) / total}%`, background: PALETTE[i % PALETTE.length] }} className="text-center text-xs leading-10 text-white">
            {Math.round((100 * v) / total)}%
          </div>
        ))}
      </div>
      <Legend names={categories} />
    </div>
  );
}

function Waterfall({ categories, values }: { categories: string[]; values: number[] }) {
  let run = 0;
  const bars = values.map((v) => {
    const start = run;
    run += v;
    return { start, end: run };
  });
  const max = niceMax(Math.max(...bars.map((b) => Math.max(b.start, b.end)), 0));
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const step = (W - PAD.l - PAD.r) / categories.length;
  return (
    <Axes max={max} xLabels={categories}>
      {bars.map((b, i) => (
        <rect key={i} x={PAD.l + step * i + step * 0.2} width={step * 0.6} y={y(Math.max(b.start, b.end))} height={Math.abs(y(b.start) - y(b.end))} fill={PALETTE[i % 2]} />
      ))}
    </Axes>
  );
}
