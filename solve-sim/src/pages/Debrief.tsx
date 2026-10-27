import type { ReactNode } from 'react';
import { GAME_NAMES, type GameId } from '../config';
import { PALETTE } from '../components/Charts';
import { mmss } from '../components/clock';
import { Button, Panel, Pill } from '../components/ui';
import { pointsLost } from '../lib/scoring';
import type { GameResult, TelemetryEvent } from '../lib/types';
import { loadHistory, useSitting, type HistoryEntry } from '../store/sitting';

export function Debrief() {
  const { debriefId, setView, startSitting } = useSitting();
  const entry = loadHistory().find((h) => h.id === debriefId);
  if (!entry) {
    return (
      <div className="p-10">
        <p className="text-sm text-slate-600">Debrief not found (storage may be unavailable).</p>
        <Button className="mt-4" onClick={() => setView('home')}>
          Home
        </Button>
      </div>
    );
  }
  const weakest = [...entry.results].sort((a, b) => a.score - b.score)[0];
  return (
    <div className="mx-auto max-w-5xl px-6 py-10 text-slate-800">
      <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-blue-700">Practice debrief · not McKinsey’s scoring</div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Debrief</h1>
          <p className="text-sm text-slate-500">
            {new Date(entry.startedAt).toLocaleString()} · {entry.mode === 'single' ? 'Single game' : `${entry.mode}-minute sitting`} · seed <span className="font-mono">{entry.seed}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setView('history')}>
            History
          </Button>
          <Button variant="secondary" onClick={() => setView('home')}>
            Home
          </Button>
          <Button onClick={() => startSitting(entry.mode, entry.seed, entry.mode === 'single' ? entry.games[0] : undefined)}>Replay this seed</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(entry.results.length, 1)}, minmax(0, 1fr))` }}>
        {entry.results.map((r) => (
          <div key={r.game} className="rounded-md border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{GAME_NAMES[r.game] ?? r.game}</div>
            <div className="mt-1 text-4xl font-semibold">{r.score}</div>
            <div className="mt-1 text-xs text-slate-500">
              Product {r.product} · Process {r.process} · {mmss(r.timeSpentSec)} used {r.timedOut && <Pill tone="amber">timed out</Pill>}
            </div>
          </div>
        ))}
      </div>

      {weakest && (
        <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-800">The one habit to fix next run</div>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-semibold">{GAME_NAMES[weakest.game] ?? weakest.game}:</span> {weakest.habit}
          </p>
        </div>
      )}

      {entry.telemetry && <Timeline entry={entry} />}

      {entry.results.map((r) => (
        <GameSection key={r.game} r={r} />
      ))}
    </div>
  );
}

function Timeline({ entry }: { entry: HistoryEntry }) {
  const ev = entry.telemetry!;
  const segs = phaseSegments(ev);
  const end = ev.length ? ev[ev.length - 1].t_ms : 1;
  const phases = [...new Set(segs.map((s) => s.phase))];
  const color = (p: string) => PALETTE[phases.indexOf(p) % PALETTE.length];
  const games = [...new Set(segs.map((s) => s.game))] as GameId[];
  return (
    <Panel title="Where your time went" className="mt-6">
      <div className="space-y-3">
        {games.map((g) => (
          <div key={g}>
            <div className="mb-1 text-xs text-slate-500">{GAME_NAMES[g] ?? g}</div>
            <div className="relative h-6 rounded bg-slate-100">
              {segs
                .filter((s) => s.game === g)
                .map((s, i) => (
                  <div
                    key={i}
                    title={`${s.phase}: ${mmss((s.end - s.start) / 1000)}`}
                    className="absolute top-0 h-6 border-r border-white"
                    style={{ left: `${(100 * s.start) / end}%`, width: `${Math.max(0.3, (100 * (s.end - s.start)) / end)}%`, background: color(s.phase), opacity: 0.8 }}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
        {phases.map((p) => (
          <span key={p} className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: color(p), opacity: 0.8 }} />
            {p} ({mmss(segs.filter((s) => s.phase === p).reduce((a, s) => a + s.end - s.start, 0) / 1000)})
          </span>
        ))}
      </div>
    </Panel>
  );
}

export function phaseSegments(ev: TelemetryEvent[]) {
  const segs: { game: string; phase: string; start: number; end: number }[] = [];
  let cur: { game: string; phase: string; start: number } | null = null;
  for (const e of ev) {
    if (!cur || e.game !== cur.game || e.phase !== cur.phase) {
      if (cur) segs.push({ ...cur, end: e.t_ms });
      cur = { game: e.game, phase: e.phase, start: e.t_ms };
    }
  }
  if (cur && ev.length) segs.push({ ...cur, end: ev[ev.length - 1].t_ms });
  return segs.filter((s) => s.game !== 'shell' && s.end > s.start);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 border-b border-slate-200 pb-1 text-lg font-semibold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Metrics({ m }: { m: Record<string, number | string> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(m).map(([k, v]) => (
        <span key={k} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs">
          <span className="text-slate-500">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}:</span> <span className="font-mono font-semibold">{v}</span>
        </span>
      ))}
    </div>
  );
}

const Ok = ({ ok }: { ok: boolean }) => <span className={ok ? 'text-emerald-700' : 'text-rose-700'}>{ok ? '✓' : '✗'}</span>;

function Breakdown({ r }: { r: GameResult }) {
  if (!r.breakdown) return <p className="text-sm text-slate-500">This run was saved before score breakdowns existed. Replay the seed to see one.</p>;
  const lines = [...r.breakdown].sort((a, b) => pointsLost(b) - pointsLost(a));
  const losing = lines.filter((l) => l.score < 100);
  const perfect = lines.filter((l) => l.score >= 100);
  const pts = (x: number) => (Math.round(x * 10) / 10).toString();
  return (
    <Panel title={`Why you scored ${r.score} — and how to get to 100`}>
      <p className="mb-3 text-sm text-slate-600">
        Your score is 70% answers (product) and 30% how you worked (process). Each row below shows what that part is worth, what you earned, why you lost points and what to change. Biggest losses come first.
      </p>
      {losing.length === 0 ? (
        <p className="text-sm text-emerald-700">Full marks on every part. Nothing to fix.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Part</th>
                <th className="py-2 pr-3 text-right">Points</th>
                <th className="py-2 pr-3">Why you lost points</th>
                <th className="py-2">To get full marks</th>
              </tr>
            </thead>
            <tbody>
              {losing.map((l) => (
                <tr key={l.label} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-slate-800">{l.label}</div>
                    <div className="text-xs text-slate-400">{l.area === 'product' ? 'answers' : 'how you worked'}</div>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right font-mono tabular-nums">
                    {pts((l.weight * l.score))}/{pts(l.weight * 100)}
                    <div className="text-xs text-rose-700">−{pts(pointsLost(l))}</div>
                  </td>
                  <td className="py-2 pr-3 text-slate-600">{l.reason}</td>
                  <td className="py-2 text-slate-700">{l.fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {perfect.length > 0 && losing.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Full marks already: {perfect.map((l) => `${l.label} (${pts(l.weight * 100)})`).join(', ')}.
        </p>
      )}
    </Panel>
  );
}

function GameSection({ r }: { r: GameResult }) {
  const d = r.details as any;
  if (r.game === 'redrock')
    return (
      <Section title="Red Rock Study">
        <Breakdown r={r} />
        <Metrics m={{ ...d.metrics, ...Object.fromEntries(Object.entries(d.sectionScores).map(([k, v]) => [`${k}Score`, v as number])) }} />
        <Panel title="Objective & trap">
          <p className="text-sm">{d.objective}</p>
          <p className="mt-2 text-sm text-amber-800">Trap: {d.trap}</p>
        </Panel>
        <Panel title="Analysis answers">
          <table className="w-full text-sm">
            <tbody>
              {d.questions.map((q: any) => (
                <tr key={q.label} className="border-b border-slate-100">
                  <td className="w-10 py-1">
                    <Ok ok={q.ok} />
                  </td>
                  <td className="py-1 text-slate-600">
                    Q{q.label}. {q.prompt}
                  </td>
                  <td className="py-1 pl-4 text-right font-mono">{q.given || '—'}</td>
                  <td className="py-1 pl-4 text-right font-mono text-emerald-700">{q.correct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Report">
          <p className="text-sm">
            Blanks correct: {d.blanks.filter((b: any) => b.ok).length}/{d.blanks.length}. Chart: you chose <b>{d.chart.given ?? 'nothing'}</b>; best is <b>{d.chart.expected}</b> ({d.chart.categories.map((c: string, i: number) => `${c} ${d.chart.values[i]}`).join(', ')}).
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
            {d.blanks.map((b: any) => (
              <li key={b.id}>
                <Ok ok={b.ok} /> {b.given || '—'} {!b.ok && <span className="text-slate-500">→ {b.expected}</span>}
              </li>
            ))}
          </ul>
        </Panel>
        {d.missedFacts.length > 0 && (
          <Panel title="Required facts you did not collect">
            <ul className="list-disc pl-5 text-sm text-slate-600">
              {d.missedFacts.map((f: string) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Panel>
        )}
        <Panel title="Cases">
          <table className="w-full text-sm">
            <tbody>
              {d.cases.map((c: any, i: number) => (
                <tr key={i} className="border-b border-slate-100 align-top">
                  <td className="w-10 py-1">
                    <Ok ok={c.ok} />
                  </td>
                  <td className="py-1">
                    <div className="font-medium">
                      {i + 1}. {c.title} <Pill>{c.type}</Pill>
                    </div>
                    <div className="text-xs text-slate-500">{c.explanation}</div>
                  </td>
                  <td className="py-1 text-right font-mono">{c.given || '—'}</td>
                  <td className="py-1 text-right font-mono text-emerald-700">{c.expected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </Section>
    );
  if (r.game === 'seawolf')
    return (
      <Section title="Sea Wolf">
        <Breakdown r={r} />
        <Metrics m={d.metrics} />
        <div className="grid grid-cols-3 gap-3">
          {d.sites.map((s: any, i: number) => {
            const o = d.outcomes[i];
            return (
              <Panel key={s.name} title={`Site ${i + 1}: ${s.name}`}>
                <div className="text-sm">
                  <div>
                    Your treatment: <b>{o ? `${o.score}%` : 'not submitted'}</b>
                  </div>
                  <div>Best trio in your pool: {o ? `${o.poolBest.score}%` : '—'}</div>
                  <div>
                    Best achievable at this site: <b>{s.designedBest}%</b> {s.solvable ? <Pill tone="green">solvable</Pill> : <Pill tone="amber">best-effort</Pill>}
                  </div>
                  {o && <div>Sorting: {o.calls.filter((c: string, k: number) => c === o.truth[k]).length}/{o.truth.length} correct</div>}
                </div>
                {o && (
                  <ul className="mt-2 text-xs">
                    {o.poolBest.checks.map((c: any) => (
                      <li key={c.label}>
                        <Ok ok={c.pass} /> {c.label} ({c.detail})
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            );
          })}
        </div>
      </Section>
    );
  if (r.game === 'sflIsland')
    return (
      <Section title="Sustainable Futures Lab">
        <Breakdown r={r} />
        {d.stages ? (
          <>
            <Panel title="Score by stage">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    {['Day', 'Goal', 'Explore', 'Assign', 'Support', 'Reflect', 'Time'].map((h) => (
                      <th key={h} className="py-1">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.perDay.map((p: any) => (
                    <tr key={p.day} className="border-t border-slate-100">
                      <td className="py-1">{p.day}</td>
                      <td>{p.goal}</td>
                      {['explore', 'assign', 'support', 'reflect', 'time'].map((k) => (
                        <td key={k} className="font-mono tabular-nums">
                          {p[k]}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200 font-semibold">
                    <td className="py-1" colSpan={2}>
                      Overall (opening {d.stages.opening})
                    </td>
                    {['explore', 'assign', 'support', 'reflect'].map((k) => (
                      <td key={k} className="font-mono tabular-nums">
                        {d.stages[k]}
                      </td>
                    ))}
                    <td />
                  </tr>
                </tbody>
              </table>
              <p className="mt-2 text-xs text-slate-500">Low Explore or Reflect means attention to the team, not judgement. Low Support means judgement under a dilemma.</p>
            </Panel>
            <Panel title="Your support pattern">
              {Object.keys(d.pattern).length === 0 ? (
                <p className="text-sm text-slate-500">No support responses recorded.</p>
              ) : (
                <>
                  <Metrics m={d.pattern} />
                  <p className="mt-2 text-sm">{d.drift ? `You drift towards: ${d.drift.toLowerCase()}. That is the habit to correct.` : 'No consistent drift away from the middle path.'}</p>
                </>
              )}
            </Panel>
            <Panel title="What was true (hidden during the game)">
              <table className="w-full text-sm">
                <tbody>
                  {d.truth.map((t: any) => (
                    <tr key={t.name} className="border-b border-slate-100">
                      <td className="py-1 font-medium">{t.name}</td>
                      <td className="text-slate-600">{t.role}</td>
                      <td className="text-slate-600">starts at: {t.home}</td>
                      <td className="text-slate-600">contributes most at: {t.strength}</td>
                    </tr>
                  ))}
                  {d.stations.map((s: any) => (
                    <tr key={s.name} className="border-b border-slate-100">
                      <td className="py-1 font-medium">{s.name}</td>
                      <td className="text-slate-600" colSpan={3}>
                        needs by day: {s.needs.join(' / ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </>
        ) : (
          <p className="text-sm text-slate-500">This run used the earlier version of the game, so only the breakdown is shown.</p>
        )}
      </Section>
    );
  if (r.game !== 'ecosystem') return null; // runs saved by games that no longer exist
  return (
    <Section title="Ecosystem Building (legacy)">
      <Breakdown r={r} />
      <Panel title={d.sustainable ? 'Sustainable ✓' : 'Not sustainable'}>
        <ul className="list-disc pl-5 text-sm">
          {d.problems.map((p: string) => (
            <li key={p}>{p}</li>
          ))}
          {d.feedings.map((p: string) => (
            <li key={p} className="text-slate-500">
              {p}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm">
          A working answer: {d.solution.location} with {d.solution.species.join(', ')}.
        </p>
      </Panel>
    </Section>
  );
}
