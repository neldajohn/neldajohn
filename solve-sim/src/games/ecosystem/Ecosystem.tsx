import { useMemo, useState } from 'react';
import { GameFrame } from '../../components/GameFrame';
import { useAutoSubmit, useGameClock } from '../../components/clock';
import { Button, Panel, Pill } from '../../components/ui';
import { combine, line, listSome } from '../../lib/scoring';
import type { GameResult } from '../../lib/types';
import { logEvent, useSitting } from '../../store/sitting';
import { CONFIG } from '../../config';
import { fitsLocation, generateEcosystem, simulate, type EcoScenario } from './engine';

export function Ecosystem({ seed }: { seed: string }) {
  const sc = useMemo(() => generateEcosystem(seed), [seed]);
  const finishGame = useSitting((s) => s.finishGame);
  const [loc, setLoc] = useState<number | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [onlyFit, setOnlyFit] = useState(true);
  const size = CONFIG.ecosystem.chainSize;
  const { elapsed } = useGameClock();

  const submit = (timedOut: boolean) => finishGame(scoreEcosystem(sc, loc, picked, timedOut, elapsed));
  useAutoSubmit(() => submit(true));

  const toggle = (id: string) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < size ? [...p, id] : p));
    logEvent('answer_change', { field: 'eco-pick', id });
  };
  const L = loc === null ? null : sc.locations[loc];
  const nameOf = (id: string) => sc.pool.find((s) => s.id === id)?.name ?? id;
  const list = sc.pool.filter((s) => !L || !onlyFit || fitsLocation(s, L));

  return (
    <GameFrame
      right={
        <Panel title={`Selected (${picked.length}/${size})`}>
          <ul className="space-y-1 text-sm">
            {picked.map((id) => (
              <li key={id} className="flex justify-between">
                {nameOf(id)}
                <button className="text-rose-600" onClick={() => toggle(id)} aria-label={`Remove ${nameOf(id)}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          <Button className="mt-4 w-full" disabled={picked.length !== size || loc === null} onClick={() => submit(false)}>
            Submit ecosystem
          </Button>
        </Panel>
      }
    >
      <div className="space-y-4">
        <Panel title="1 · Choose a location">
          <div className="grid grid-cols-3 gap-2">
            {sc.locations.map((l, i) => (
              <button key={l.name} onClick={() => (setLoc(i), setPicked([]))} className={`rounded border p-3 text-left text-sm ${loc === i ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
                <div className="font-semibold">{l.name}</div>
                <div className="text-xs text-slate-500">
                  Depth {l.depth[0]}–{l.depth[1]} m · {l.temp[0]}–{l.temp[1]} °C
                </div>
              </button>
            ))}
          </div>
        </Panel>
        {L && (
          <Panel title={`2 · Choose ${size} species that form a sustainable food chain`} right={<label className="text-xs"><input type="checkbox" checked={onlyFit} onChange={(e) => setOnlyFit(e.target.checked)} /> only species suited to this location</label>}>
            <p className="mb-3 text-xs text-slate-500">
              Highest calories-provided eats first, choosing its richest available food source (ties split half/half). Every species must keep calories above zero and every animal must eat.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th />
                  <th>Species</th>
                  <th>Provides</th>
                  <th>Needs</th>
                  <th>Eats</th>
                  <th>Depth (m)</th>
                  <th>Temp (°C)</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className={`border-t border-slate-100 ${picked.includes(s.id) ? 'bg-blue-50' : ''}`}>
                    <td className="py-1">
                      <input type="checkbox" aria-label={s.name} checked={picked.includes(s.id)} onChange={() => toggle(s.id)} />
                    </td>
                    <td>
                      {s.name} {s.kind === 'producer' && <Pill tone="green">producer</Pill>}
                    </td>
                    <td className="font-mono">{s.provides}</td>
                    <td className="font-mono">{s.needs || '—'}</td>
                    <td className="text-xs text-slate-600">{s.eats.map(nameOf).join(', ') || '—'}</td>
                    <td className="font-mono text-xs">
                      {s.depth[0]}–{s.depth[1]}
                    </td>
                    <td className="font-mono text-xs">
                      {s.temp[0]}–{s.temp[1]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
      </div>
    </GameFrame>
  );
}

function scoreEcosystem(sc: EcoScenario, loc: number | null, picked: string[], timedOut: boolean, elapsed: number): GameResult {
  const L = loc === null ? null : sc.locations[loc];
  const chosen = sc.pool.filter((s) => picked.includes(s.id));
  const sim = simulate(chosen);
  const misfits = L ? chosen.filter((s) => !fitsLocation(s, L)).map((s) => s.name) : [];
  const healthy = chosen.filter((s) => sim.remaining[s.id] > 0 && !sim.problems.some((p) => p.startsWith(s.name))).length;
  const complete = chosen.length === CONFIG.ecosystem.chainSize;
  const product = complete && sim.sustainable && misfits.length === 0 ? 100 : Math.round((80 * healthy) / CONFIG.ecosystem.chainSize) - misfits.length * 5;
  const process = complete ? 100 : Math.round((100 * chosen.length) / CONFIG.ecosystem.chainSize);
  const p = Math.max(0, product);
  const sol = `${sc.locations[sc.solution.location].name} with ${sc.solution.species.map((id) => sc.pool.find((s) => s.id === id)!.name).join(', ')}`;
  const issues = [...sim.problems, ...misfits.map((m) => `${m} doesn't suit the location`)];
  const breakdown = [
    line('product', 1, 'Sustainable food chain', p,
      p >= 100 ? 'All eight species survived and were fed.' : `${healthy} of ${CONFIG.ecosystem.chainSize} species healthy${misfits.length ? `, ${misfits.length} unsuited to the location (−5 each)` : ''}. ${listSome(issues, 4)}`,
      `One working answer: ${sol}. Work bottom-up: producers with spare calories, then herbivores, then predators, and play out the eating order on paper before submitting.`),
    line('process', 1, 'Completion', process, `Picked ${chosen.length} of ${CONFIG.ecosystem.chainSize} species.`, `Submit exactly ${CONFIG.ecosystem.chainSize} species.`),
  ];
  return {
    breakdown,
    game: 'ecosystem',
    product: p,
    process,
    score: combine(p, process),
    timeSpentSec: elapsed,
    timedOut,
    habit: sim.sustainable ? 'Sustainable chain — practise doing it in under 15 minutes.' : 'Build bottom-up: pick producers with surplus calories first, then herbivores, then predators, and simulate the eating order on paper.',
    details: {
      sustainable: sim.sustainable,
      problems: [...sim.problems, ...misfits.map((m) => `${m} does not suit the chosen location.`)],
      feedings: sim.feedings.map((f) => `${sc.pool.find((s) => s.id === f.eater)?.name} eats ${f.meals.map((m) => `${Math.round(m.amount)} from ${sc.pool.find((s) => s.id === m.prey)?.name}`).join(' and ') || 'nothing'}`),
      solution: { location: sc.locations[sc.solution.location].name, species: sc.solution.species.map((id) => sc.pool.find((s) => s.id === id)!.name) },
    },
  };
}
