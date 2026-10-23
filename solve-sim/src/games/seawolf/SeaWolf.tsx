import { useMemo, useRef, useState } from 'react';
import { CONFIG } from '../../config';
import { GameFrame } from '../../components/GameFrame';
import { useAutoSubmit } from '../../components/clock';
import { Button, Modal, Panel, Pill, Steps } from '../../components/ui';
import type { GameResult } from '../../lib/types';
import { logEvent, useSitting } from '../../store/sitting';
import {
  bestTrio,
  buildOffers,
  correctCall,
  evaluate,
  generateSeaWolf,
  initialPool,
  inRange,
  type Evaluation,
  type Microbe,
  type Scenario,
  type Site,
  type SortCall,
} from './model';
import { scoreSeaWolf, type SiteOutcome } from './score';

const STEPS = ['Lock characteristics', 'Sort the queue', 'Build prospect pool', 'Pick final 3'];

export function SeaWolf({ seed, variant }: { seed: string; variant: 'default' | 'alt' }) {
  const scenario = useMemo(() => generateSeaWolf(seed, variant), [seed, variant]);
  const finishGame = useSitting((s) => s.finishGame);
  const cfg = CONFIG.seaWolf;
  const sites = scenario.sites.map((d) => d.site);

  const [siteIdx, setSiteIdx] = useState(0);
  const [step, setStep] = useState(0);
  const [locks, setLocks] = useState<string[]>([]);
  const [calls, setCalls] = useState<SortCall[]>([]);
  const [routedNext, setRoutedNext] = useState<Microbe[]>([]);
  const [pool, setPool] = useState<Microbe[]>([]);
  const [offers, setOffers] = useState<Microbe[][]>([]);
  const [round, setRound] = useState(0);
  const [selection, setSelection] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<SiteOutcome[]>([]);
  const [showResult, setShowResult] = useState<Evaluation | null>(null);
  const siteStart = useRef(Date.now());

  const data = scenario.sites[siteIdx];
  const site = data.site;
  const done = outcomes.length === sites.length;

  const submitAll = (timedOut: boolean, final = outcomes) => {
    const r: GameResult = scoreSeaWolf(scenario, final, useSitting.getState().sitting!.telemetry.filter((e) => e.game === 'seawolf'), timedOut);
    finishGame(r);
  };
  const makeOutcome = (): SiteOutcome => {
    const trio = pool.filter((m) => selection.includes(m.id));
    const ev = evaluate(trio, site, scenario.attrNames, scenario.traitNames);
    return {
      site: siteIdx,
      score: ev.score,
      evaluation: ev,
      poolBest: bestTrio(pool, site, scenario.attrNames, scenario.traitNames),
      designedBest: data.designedBest,
      poolIds: pool.map((m) => m.id),
      selection,
      calls,
      truth: data.queue.map((m) => correctCall(m, sites, siteIdx)),
      locks,
      seconds: Math.round((Date.now() - siteStart.current) / 1000),
    };
  };

  useAutoSubmit(() => {
    // Auto-submit current state: a complete trio on the open site still counts.
    const pending = step === 3 && selection.length === cfg.trioSize && outcomes.length === siteIdx;
    submitAll(true, pending ? [...outcomes, makeOutcome()] : outcomes);
  });

  // ---- step transitions
  const confirmLocks = () => {
    logEvent('lock', { site: siteIdx, locks });
    setPool(initialPool(data, locks));
    setCalls([]);
    setStep(1);
  };

  const sortCall = (c: SortCall) => {
    const m = data.queue[calls.length];
    const truth = correctCall(m, sites, siteIdx);
    logEvent('sort_decision', { site: siteIdx, microbe: m.id, call: c, truth, correct: c === truth });
    const next = [...calls, c];
    setCalls(next);
    if (next.length === data.queue.length) {
      const routedHere = [...routedNext, ...data.queue.filter((_, i) => next[i] === 'current')];
      setOffers(buildOffers(data, routedHere, new Set(pool.map((p) => p.id))));
      setRound(0);
      setStep(2);
    }
  };

  const keepOffer = (m: Microbe) => {
    logEvent('pool_pick', { site: siteIdx, round, microbe: m.id });
    setPool((p) => [...p, m]);
    if (round + 1 >= offers.length) {
      setStep(3);
      setSelection([]);
    } else setRound(round + 1);
  };

  const toggleSel = (id: string) => {
    setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < cfg.trioSize ? [...s, id] : s));
    logEvent('answer_change', { field: `seawolf-${siteIdx}-select`, id });
  };

  const submitSite = () => {
    const outcome = makeOutcome();
    logEvent('final_selection', { site: siteIdx, selection, score: outcome.score });
    setOutcomes((o) => [...o, outcome]);
    setRoutedNext(data.queue.filter((_, i) => calls[i] === 'next'));
    setShowResult(outcome.evaluation);
  };

  const nextSite = () => {
    setShowResult(null);
    if (siteIdx + 1 >= sites.length) {
      submitAll(false);
      return;
    }
    setSiteIdx(siteIdx + 1);
    setStep(0);
    setLocks([]);
    setPool([]);
    siteStart.current = Date.now();
    useSitting.getState().setPhase(`site-${siteIdx + 2}`);
  };

  const sidebar = (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Objective</div>
        <p className="mt-1 text-sm text-slate-600">Treat each contaminated site with exactly three microbes whose averaged attributes fall in the target ranges and whose traits suit the site.</p>
      </div>
      <div className="space-y-1">
        {sites.map((s, i) => (
          <div key={s.id} className={`rounded px-3 py-2 text-sm ${i === siteIdx ? 'bg-blue-50 font-semibold text-blue-800' : 'text-slate-500'}`}>
            Site {i + 1}: {s.name}
            {outcomes[i] && <span className="float-right font-mono">{outcomes[i].score}%</span>}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400">Suggested pace: ~{Math.round(cfg.siteBudgetSec / 60)} min per site.</p>
    </div>
  );

  return (
    <GameFrame sidebar={sidebar} right={<SiteProfile site={site} scenario={scenario} title="Current site profile" />} subtitle={`Site ${siteIdx + 1}: ${site.name}`}>
      <nav className="mb-4 flex gap-2 border-b border-slate-200">
        {sites.map((s, i) => (
          <div key={s.id} className={`-mb-px border-b-2 px-4 py-2 text-sm ${i === siteIdx ? 'border-blue-700 font-semibold text-blue-800' : 'border-transparent text-slate-400'}`}>
            {s.name}
          </div>
        ))}
      </nav>
      <div className="mb-6">
        <Steps steps={STEPS} current={step} />
      </div>

      {step === 0 && <LockStep scenario={scenario} site={site} locks={locks} setLocks={setLocks} onConfirm={confirmLocks} />}

      {step === 1 && (
        <SortStep
          scenario={scenario}
          microbe={data.queue[calls.length]}
          index={calls.length}
          total={data.queue.length}
          calls={calls}
          nextSite={sites[siteIdx + 1]}
          onCall={sortCall}
        />
      )}

      {step === 2 && (
        <div>
          <p className="mb-3 text-sm text-slate-600">
            Round {round + 1} of {offers.length}: three microbes are offered. Keep one for your prospect pool ({pool.length} so far). Only pool microbes can be used in the final treatment.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {offers[round]?.map((m) => (
              <MicrobeCard key={m.id} m={m} scenario={scenario} site={site} action={<Button onClick={() => keepOffer(m)}>Keep</Button>} />
            ))}
          </div>
          <PoolList pool={pool} scenario={scenario} site={site} />
        </div>
      )}

      {step === 3 && (
        <div>
          <p className="mb-3 text-sm text-slate-600">Select exactly three microbes from your prospect pool. Averages update live.</p>
          <LiveTreatment scenario={scenario} site={site} trio={pool.filter((m) => selection.includes(m.id))} />
          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-3">
            {pool.map((m) => (
              <MicrobeCard key={m.id} m={m} scenario={scenario} site={site} selected={selection.includes(m.id)} onClick={() => toggleSel(m.id)} />
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button disabled={selection.length !== cfg.trioSize || done} onClick={submitSite}>
              Submit treatment
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={!!showResult}
        title={`${site.name}: treatment submitted`}
        actions={<Button onClick={nextSite}>{siteIdx + 1 >= sites.length ? 'Finish Sea Wolf' : 'Continue to next site'}</Button>}
      >
        <div className="mb-2 text-3xl font-semibold text-slate-800">{showResult?.score}% effective</div>
        <ul className="space-y-1">
          {showResult?.checks.map((c) => (
            <li key={c.label} className={c.pass ? 'text-emerald-700' : 'text-rose-700'}>
              {c.pass ? '✓' : '✗'} {c.label} ({c.detail})
            </li>
          ))}
        </ul>
      </Modal>
    </GameFrame>
  );
}

function LockStep({ scenario, site, locks, setLocks, onConfirm }: { scenario: Scenario; site: Site; locks: string[]; setLocks: (l: string[]) => void; onConfirm: () => void }) {
  const opts = [
    ...site.ranges.map((r, k) => ({ key: `attr:${k}`, label: `${scenario.attrNames[k]} in ${r[0]}–${r[1]}` })),
    { key: 'desired', label: `Has ${scenario.traitNames[site.desired]}` },
    { key: 'undesired', label: `Not ${scenario.traitNames[site.undesired]}` },
  ];
  const toggle = (k: string) => setLocks(locks.includes(k) ? locks.filter((x) => x !== k) : locks.length < CONFIG.seaWolf.locks ? [...locks, k] : locks);
  return (
    <Panel title="Step 1 · Lock two characteristics">
      <p className="mb-3 text-sm text-slate-600">Locking filters which microbes appear in your initial prospect pool of {CONFIG.seaWolf.initialPool}. It does not affect sorting later.</p>
      <div className="grid grid-cols-2 gap-2">
        {opts.map((o) => (
          <label key={o.key} className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm ${locks.includes(o.key) ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
            <input type="checkbox" checked={locks.includes(o.key)} onChange={() => toggle(o.key)} />
            {o.label}
          </label>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Button disabled={locks.length !== CONFIG.seaWolf.locks} onClick={onConfirm}>
          Lock and continue
        </Button>
      </div>
    </Panel>
  );
}

function SortStep({ scenario, microbe, index, total, calls, nextSite, onCall }: { scenario: Scenario; microbe: Microbe; index: number; total: number; calls: SortCall[]; nextSite?: Site; onCall: (c: SortCall) => void }) {
  const count = (c: SortCall) => calls.filter((x) => x === c).length;
  return (
    <div className="grid grid-cols-[1fr_260px] gap-4">
      <div>
        <p className="mb-3 text-sm text-slate-600">
          Microbe {index + 1} of {total}. Decide where it belongs. Each microbe gets one call.
        </p>
        <MicrobeCard m={microbe} scenario={scenario} large />
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Button onClick={() => onCall('current')}>Current site ({count('current')})</Button>
          <Button variant="secondary" disabled={!nextSite} onClick={() => onCall('next')}>
            Next site ({count('next')})
          </Button>
          <Button variant="secondary" onClick={() => onCall('return')}>
            Return pool ({count('return')})
          </Button>
        </div>
      </div>
      {nextSite ? (
        <Panel title="Next site (partial preview)">
          <div className="text-sm font-semibold text-slate-700">{nextSite.name}</div>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {nextSite.ranges.map((r, k) => (
              <li key={k}>
                {scenario.attrNames[k]}: {k === 0 ? `${r[0]}–${r[1]}` : <span className="text-slate-300">hidden</span>}
              </li>
            ))}
            <li>Desired: {scenario.traitNames[nextSite.desired]}</li>
            <li>
              Undesired: <span className="text-slate-300">hidden</span>
            </li>
          </ul>
        </Panel>
      ) : (
        <Panel title="Next site">
          <p className="text-sm text-slate-500">This is the last site.</p>
        </Panel>
      )}
    </div>
  );
}

export function SiteProfile({ site, scenario, title }: { site: Site; scenario: Scenario; title: string }) {
  return (
    <Panel title={title}>
      <div className="mb-3 text-sm font-semibold text-slate-700">{site.name}</div>
      <table className="w-full text-sm">
        <tbody>
          {site.ranges.map((r, k) => (
            <tr key={k} className="border-b border-slate-100">
              <td className="py-1.5 text-slate-500">{scenario.attrNames[k]}</td>
              <td className="py-1.5 text-right font-mono">
                {r[0]}–{r[1]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 space-y-1 text-sm">
        <div>
          <Pill tone="green">Desired</Pill> {scenario.traitNames[site.desired]}
        </div>
        <div>
          <Pill tone="red">Undesired</Pill> {scenario.traitNames[site.undesired]}
        </div>
      </div>
    </Panel>
  );
}

function MicrobeCard({ m, scenario, site, selected, onClick, action, large }: { m: Microbe; scenario: Scenario; site?: Site; selected?: boolean; onClick?: () => void; action?: React.ReactNode; large?: boolean }) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => onClick && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick())}
      className={`rounded-md border bg-white p-3 ${selected ? 'border-blue-600 ring-2 ring-blue-200' : 'border-slate-200'} ${onClick ? 'cursor-pointer hover:border-blue-400' : ''} ${large ? 'max-w-md p-5' : ''}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-sm font-semibold italic text-slate-700">{m.name}</span>
        {selected && <Pill tone="blue">selected</Pill>}
      </div>
      <div className="space-y-1">
        {m.attrs.map((a, k) => {
          const ok = site ? inRange(a, site.ranges[k]) : undefined;
          return (
            <div key={k} className="flex items-center gap-2 text-xs">
              <span className="w-28 shrink-0 text-slate-500">{scenario.attrNames[k]}</span>
              <div className="h-2 flex-1 rounded bg-slate-100">
                <div className={`h-2 rounded ${ok === undefined ? 'bg-slate-400' : ok ? 'bg-blue-500' : 'bg-slate-300'}`} style={{ width: `${a * 10}%` }} />
              </div>
              <span className="w-5 text-right font-mono">{a}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {m.traits.map((t) => (
          <Pill key={t} tone={site ? (t === site.desired ? 'green' : t === site.undesired ? 'red' : 'slate') : 'slate'}>
            {scenario.traitNames[t]}
          </Pill>
        ))}
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

function PoolList({ pool, scenario, site }: { pool: Microbe[]; scenario: Scenario; site: Site }) {
  return (
    <div className="mt-6">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Prospect pool ({pool.length})</h4>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {pool.map((m) => (
          <MicrobeCard key={m.id} m={m} scenario={scenario} site={site} />
        ))}
      </div>
    </div>
  );
}

function LiveTreatment({ scenario, site, trio }: { scenario: Scenario; site: Site; trio: Microbe[] }) {
  const ev = evaluate(trio, site, scenario.attrNames, scenario.traitNames);
  return (
    <Panel title={`Live treatment (${trio.length}/3)`}>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        {ev.checks.map((c) => (
          <li key={c.label} className={trio.length === 0 ? 'text-slate-400' : c.pass ? 'text-emerald-700' : 'text-rose-700'}>
            {trio.length === 0 ? '·' : c.pass ? '✓' : '✗'} {c.label} {trio.length > 0 && <span className="font-mono">({c.detail})</span>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
