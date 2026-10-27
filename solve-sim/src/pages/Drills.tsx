import { useMemo, useState, type ReactNode } from 'react';
import { Calculator, type CalcHistory } from '../components/Calculator';
import { FactChip, Journal, type JournalEntry } from '../components/Journal';
import { Button, Panel, Pill } from '../components/ui';
import {
  DAY_GOALS,
  DRILL_LENGTH,
  DRILLS,
  explainSort,
  GOAL_TEXT,
  gradeAnalysis,
  gradeData,
  gradeFinal,
  gradeLock,
  LEVELS,
  makeAnalysisItem,
  makeCaseItem,
  makeClassicItem,
  makeDataItem,
  makeExploreItem,
  makeFinalItem,
  makeKeepItem,
  makeLockItem,
  makeReasonItem,
  makeReflectItem,
  makeSortItem,
  makeSupportItem,
  priorityText,
  SERVES_TEXT,
  supportCorrect,
  type DrillId,
  type DrillMeta,
} from '../drills/defs';
import { AnswerBox, CaseRunner, ExhibitView, SegmentText } from '../games/redrock/RedRock';
import { checkNumeric, factLabel, type Fact } from '../games/redrock/model';
import { LiveTreatment, MicrobeCard, SiteProfile } from '../games/seawolf/SeaWolf';
import type { SortCall } from '../games/seawolf/model';
import { REASONS, REFLECT_DIMS, type Rating, type Reason } from '../games/sfl/island';
import { randomSeed } from '../lib/rng';
import { KEYS, load, save } from '../lib/storage';
import type { Settings } from '../lib/types';
import { useSitting } from '../store/sitting';

interface Graded {
  correct: boolean;
  /** 0–1 partial credit. */
  score: number;
}
type ItemProps = { seed: string; settings: Settings; onGraded: (g: Graded) => void };
type Stats = Record<string, { last: number; best: number; runs: number }>;

const loadStats = () => load<Stats>(KEYS.drills, {});

// ---------------------------------------------------------------- home section

export function DrillsSection() {
  const openDrill = useSitting((s) => s.openDrill);
  const stats = loadStats();
  const games = [...new Set(DRILLS.map((d) => d.game))];
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">Drills</h2>
      <p className="mt-1 text-sm text-slate-600">
        {DRILL_LENGTH} quick, untimed tries on one skill. You see straight away whether each answer was the best one, and why.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        {games.map((g) => (
          <div key={g} className="rounded-md border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{g}</h3>
            <ul className="space-y-1">
              {DRILLS.filter((d) => d.game === g).map((d) => (
                <li key={d.id}>
                  <button onClick={() => openDrill(d.id)} className="flex w-full items-start justify-between gap-3 rounded px-2 py-1.5 text-left hover:bg-blue-50">
                    <span>
                      <span className="block text-sm font-medium text-blue-800">{d.title}</span>
                      <span className="block text-xs text-slate-500">{d.blurb}</span>
                    </span>
                    {stats[d.id] && <span className="shrink-0 font-mono text-xs text-slate-500">best {stats[d.id].best}/{DRILL_LENGTH}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- runner

const ITEMS: Record<DrillId, (p: ItemProps) => ReactNode> = {
  'sw-sort': (p) => <SortDrill {...p} />,
  'sw-lock': (p) => <LockDrill {...p} />,
  'sw-keep': (p) => <KeepDrill {...p} />,
  'sw-final': (p) => <FinalDrill {...p} />,
  'rr-data': (p) => <DataDrill {...p} />,
  'rr-analysis': (p) => <AnalysisDrill {...p} />,
  'rr-cases': (p) => <CaseDrill {...p} />,
  'sfl-explore': (p) => <ExploreDrill {...p} />,
  'sfl-reasons': (p) => <ReasonsDrill {...p} />,
  'sfl-support': (p) => <SupportDrill {...p} />,
  'sfl-reflect': (p) => <ReflectDrill {...p} />,
  'sfl-classic': (p) => <ClassicDrill {...p} />,
};

export function DrillPage() {
  const { drillId, setView, settings } = useSitting();
  const meta = DRILLS.find((d) => d.id === drillId) as DrillMeta;
  const [runSeed, setRunSeed] = useState(randomSeed());
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<Graded[]>([]);
  const [graded, setGraded] = useState<Graded | null>(null);
  const done = results.length >= DRILL_LENGTH && !graded;
  const correct = results.filter((r) => r.correct).length;

  const next = () => {
    const all = [...results];
    setGraded(null);
    if (all.length >= DRILL_LENGTH) {
      const right = all.filter((r) => r.correct).length;
      const stats = loadStats();
      const prev = stats[meta.id];
      stats[meta.id] = { last: right, best: Math.max(right, prev?.best ?? 0), runs: (prev?.runs ?? 0) + 1 };
      save(KEYS.drills, stats);
    } else setIdx(idx + 1);
  };
  const restart = () => {
    setRunSeed(randomSeed());
    setIdx(0);
    setResults([]);
    setGraded(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-5">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-semibold">Drill · {meta.game}</span>
          <span className="text-sm text-slate-600">{meta.title}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1" aria-label="Progress">
            {Array.from({ length: DRILL_LENGTH }, (_, i) => (
              <span key={i} className={`h-2 w-5 rounded ${i < results.length ? (results[i].correct ? 'bg-emerald-500' : 'bg-rose-400') : i === idx && !done ? 'bg-blue-300' : 'bg-slate-200'}`} />
            ))}
          </div>
          <span className="font-mono text-sm">
            {correct}/{results.length}
          </span>
          <Button variant="secondary" onClick={() => setView('home')}>
            Exit
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">
        {done ? (
          <Panel title="Drill complete">
            <div className="text-4xl font-semibold">
              {correct}/{DRILL_LENGTH}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {correct === DRILL_LENGTH ? 'Every answer was the best one.' : correct >= 7 ? 'Solid. Run it again and aim for a clean ten.' : 'Re-read the feedback on the ones you missed, then run it again.'}
            </p>
            <div className="mt-5 flex gap-2">
              <Button onClick={restart}>Run again</Button>
              <Button variant="secondary" onClick={() => setView('home')}>
                Back to home
              </Button>
            </div>
          </Panel>
        ) : (
          <>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Try {idx + 1} of {DRILL_LENGTH}
            </div>
            <div key={`${runSeed}-${idx}`}>
              {ITEMS[meta.id]({
                seed: `${runSeed}-${idx}`,
                settings,
                onGraded: (g) => {
                  if (graded || results.length > idx) return;
                  setGraded(g);
                  setResults((r) => [...r, g]);
                },
              })}
            </div>
            {graded && (
              <div className="sticky bottom-0 mt-4 flex justify-end border-t border-slate-200 bg-slate-50/95 py-3">
                <Button onClick={next}>{results.length >= DRILL_LENGTH ? 'See results' : 'Next try →'}</Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Feedback({ correct, title, children }: { correct: boolean; title?: string; children: ReactNode }) {
  return (
    <div className={`mt-4 rounded-md border p-4 text-sm ${correct ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`} role="status">
      <div className={`mb-2 font-semibold ${correct ? 'text-emerald-800' : 'text-rose-800'}`}>{title ?? (correct ? '✓ Best answer' : '✗ Not the best answer')}</div>
      <div className="space-y-1 text-slate-700">{children}</div>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-0.5 pl-5">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- Sea Wolf

function SortDrill({ seed, settings, onGraded }: ItemProps) {
  const it = useMemo(() => makeSortItem(seed, settings.seaWolfMode, settings.seaWolfHard), [seed, settings.seaWolfMode, settings.seaWolfHard]);
  const [pick, setPick] = useState<SortCall | null>(null);
  const site = it.sc.sites[it.siteIdx].site;
  const next = it.sc.sites[it.siteIdx + 1]?.site;
  const choose = (c: SortCall) => {
    if (pick) return;
    setPick(c);
    onGraded({ correct: c === it.answer, score: c === it.answer ? 1 : 0 });
  };
  const label = { current: 'Current site', next: 'Next site', return: 'Return pool' };
  return (
    <div className="grid grid-cols-[1fr_280px_280px] gap-4">
      <div>
        <p className="mb-3 text-sm text-slate-600">Where does this microbe belong?</p>
        <MicrobeCard m={it.microbe} scenario={it.sc} large />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {(['current', 'next', 'return'] as SortCall[]).map((c) => (
            <Button key={c} variant={pick === c ? 'primary' : 'secondary'} disabled={!!pick || (c === 'next' && !next)} onClick={() => choose(c)}>
              {label[c]}
            </Button>
          ))}
        </div>
        {pick && (
          <Feedback correct={pick === it.answer} title={pick === it.answer ? `✓ ${label[it.answer]} is right` : `✗ Best call: ${label[it.answer]}`}>
            <Bullets items={explainSort(it)} />
          </Feedback>
        )}
      </div>
      <SiteProfile site={site} scenario={it.sc} title={`Current site (${it.siteIdx + 1} of 3)`} />
      <Panel title="Next site (preview)">
        {next ? (
          <div className="text-sm">
            <div className="font-semibold">{next.name}</div>
            <div className="mt-2">
              <Pill tone="green">Desired</Pill> {it.sc.traitNames[next.desired]}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">This is the last site.</p>
        )}
      </Panel>
    </div>
  );
}

function LockDrill({ seed, settings, onGraded }: ItemProps) {
  const it = useMemo(() => makeLockItem(seed, settings.seaWolfMode, settings.seaWolfHard), [seed, settings.seaWolfMode, settings.seaWolfHard]);
  const [picks, setPicks] = useState<string[]>([]);
  const [result, setResult] = useState<ReturnType<typeof gradeLock> | null>(null);
  const toggle = (k: string) => !result && setPicks(picks.includes(k) ? picks.filter((x) => x !== k) : picks.length < 2 ? [...picks, k] : picks);
  const submit = () => {
    const r = gradeLock(it, picks);
    setResult(r);
    onGraded({ correct: r.correct, score: r.score });
  };
  const order = it.keys.map((_, i) => i).sort((a, b) => it.counts[a] - it.counts[b]);
  return (
    <div className="grid grid-cols-[1fr_300px] gap-4">
      <Panel title="Lock two characteristics">
        <p className="mb-3 text-sm text-slate-600">Locking filters which microbes reach your starting pool. Which two do the most work for you?</p>
        <div className="grid grid-cols-2 gap-2">
          {it.keys.map((k, i) => (
            <label key={k} className={`flex items-center gap-2 rounded border px-3 py-2 text-sm ${picks.includes(k) ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
              <input type="checkbox" checked={picks.includes(k)} onChange={() => toggle(k)} disabled={!!result} />
              {it.labels[i]}
            </label>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <Button disabled={picks.length !== 2 || !!result} onClick={submit}>
            Lock
          </Button>
        </div>
        {result && (
          <Feedback correct={result.correct}>
            <p>Lock the characteristics the fewest candidates have. The lock then does the hard searching for you, and the common ones come along anyway. Candidates (out of {it.sc.sites[it.siteIdx].population.length}) that meet each:</p>
            <table className="mt-2 text-sm">
              <tbody>
                {order.map((i) => (
                  <tr key={it.keys[i]} className={picks.includes(it.keys[i]) ? 'font-semibold' : ''}>
                    <td className="pr-4">{it.labels[i]}</td>
                    <td className="font-mono">{it.counts[i]}</td>
                    <td className="pl-3 text-xs">{picks.includes(it.keys[i]) ? '← your lock' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Feedback>
        )}
      </Panel>
      <SiteProfile site={it.sc.sites[it.siteIdx].site} scenario={it.sc} title="Site profile" />
    </div>
  );
}

function KeepDrill({ seed, settings, onGraded }: ItemProps) {
  const it = useMemo(() => makeKeepItem(seed, settings.seaWolfMode, settings.seaWolfHard), [seed, settings.seaWolfMode, settings.seaWolfHard]);
  const [pick, setPick] = useState<number | null>(null);
  const site = it.sc.sites[it.siteIdx].site;
  const best = Math.max(...it.scores);
  const name = (id: string) => [...it.pool, ...it.offer].find((m) => m.id === id)?.name ?? id;
  const keep = (i: number) => {
    if (pick !== null) return;
    setPick(i);
    onGraded({ correct: it.scores[i] === best, score: best ? it.scores[i] / best : 1 });
  };
  return (
    <div className="grid grid-cols-[1fr_280px] gap-4">
      <div>
        <p className="mb-3 text-sm text-slate-600">Offer round: keep one. Which one gives your pool the best possible final trio?</p>
        <div className="grid grid-cols-3 gap-3">
          {it.offer.map((m, i) => (
            <MicrobeCard
              key={m.id}
              m={m}
              scenario={it.sc}
              site={site}
              selected={pick === i}
              action={
                pick === null ? (
                  <Button onClick={() => keep(i)}>Keep</Button>
                ) : (
                  <span className={`text-sm font-semibold ${it.scores[i] === best ? 'text-emerald-700' : 'text-slate-500'}`}>Best trio with it: {it.scores[i]}%</span>
                )
              }
            />
          ))}
        </div>
        {pick !== null && (
          <Feedback correct={it.scores[pick] === best}>
            <p>
              Keeping {it.offer[pick].name} lets you reach {it.scores[pick]}%. The best keep reaches {best}%
              {it.scores.filter((s) => s === best).length > 1 ? ' (more than one keep ties)' : ''}.
            </p>
            <p>Best trio after the best keep: {it.trios[it.scores.indexOf(best)].map(name).join(', ')}.</p>
            <p className="text-slate-500">Tip: look for the check your pool can’t pass yet (often the desired trait or an edge range) and keep the microbe that fixes it.</p>
          </Feedback>
        )}
        <h4 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">Your pool so far ({it.pool.length})</h4>
        <div className="grid grid-cols-3 gap-2 xl:grid-cols-4">
          {it.pool.map((m) => (
            <MicrobeCard key={m.id} m={m} scenario={it.sc} site={site} />
          ))}
        </div>
      </div>
      <SiteProfile site={site} scenario={it.sc} title="Site profile" />
    </div>
  );
}

function FinalDrill({ seed, settings, onGraded }: ItemProps) {
  const it = useMemo(() => makeFinalItem(seed, settings.seaWolfMode, settings.seaWolfHard), [seed, settings.seaWolfMode, settings.seaWolfHard]);
  const [sel, setSel] = useState<string[]>([]);
  const [result, setResult] = useState<ReturnType<typeof gradeFinal> | null>(null);
  const site = it.sc.sites[it.siteIdx].site;
  const toggle = (id: string) => !result && setSel(sel.includes(id) ? sel.filter((x) => x !== id) : sel.length < 3 ? [...sel, id] : sel);
  const name = (id: string) => it.pool.find((m) => m.id === id)!.name;
  return (
    <div className="grid grid-cols-[1fr_280px] gap-4">
      <div>
        <p className="mb-3 text-sm text-slate-600">Pick the best three for this site.</p>
        <LiveTreatment scenario={it.sc} site={site} trio={it.pool.filter((m) => sel.includes(m.id))} />
        <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-3">
          {it.pool.map((m) => (
            <MicrobeCard key={m.id} m={m} scenario={it.sc} site={site} selected={sel.includes(m.id) || (!!result && it.best.trio.includes(m.id) && !sel.includes(m.id))} onClick={() => toggle(m.id)} />
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            disabled={sel.length !== 3 || !!result}
            onClick={() => {
              const r = gradeFinal(it, sel);
              setResult(r);
              onGraded({ correct: r.correct, score: r.score });
            }}
          >
            Submit treatment
          </Button>
        </div>
        {result && (
          <Feedback correct={result.correct} title={result.correct ? `✓ ${result.ev.score}% — the best this pool allows` : `✗ ${result.ev.score}% — this pool allowed ${it.best.score}%`}>
            <p>Best trio: {it.best.trio.map(name).join(', ')}.</p>
            <Bullets items={it.best.checks.map((c) => `${c.pass ? '✓' : '✗'} ${c.label} (${c.detail})`)} />
            {!result.correct && <p className="text-slate-500">Start from the scarce check (desired trait or tightest range), then pick partners whose values pull each average back to the middle.</p>}
          </Feedback>
        )}
      </div>
      <SiteProfile site={site} scenario={it.sc} title="Site profile" />
    </div>
  );
}

// ---------------------------------------------------------------- Red Rock

function DataDrill({ seed, onGraded }: ItemProps) {
  const study = useMemo(() => makeDataItem(seed), [seed]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [result, setResult] = useState<ReturnType<typeof gradeData> | null>(null);
  const add = (f: Fact) => !journal.some((j) => j.factId === f.id) && setJournal([...journal, { factId: f.id, value: f.value, unit: f.unit, label: factLabel(f) }]);
  return (
    <div className="grid grid-cols-[1fr_300px] gap-5">
      <div className="space-y-4">
        <div className="rounded-md bg-blue-50 p-3 text-sm">
          <span className="font-semibold text-blue-800">Objective: </span>
          {study.objective}
        </div>
        <p className="text-sm text-slate-600">Drag every value the objective needs into the journal, and nothing else. No maths needed.</p>
        <Panel title="Study information">
          <div className="space-y-3 text-sm leading-relaxed">
            {study.narrative.map((p, i) => (
              <p key={i}>
                <SegmentText segments={p} facts={study.facts} onAdd={add} />
              </p>
            ))}
          </div>
        </Panel>
        {study.exhibits.map((ex, i) => (
          <ExhibitView key={ex.id} n={i + 1} exhibit={ex} facts={study.facts} onAdd={add} />
        ))}
      </div>
      <div className="space-y-3">
        <div className="sticky top-4 space-y-3">
          <Journal id="drill-journal" entries={journal} setEntries={(e) => !result && setJournal(e)} relevant={() => true} />
          <Button
            className="w-full"
            disabled={!!result || journal.length === 0}
            onClick={() => {
              const r = gradeData(
                study,
                journal.map((j) => j.factId),
              );
              setResult(r);
              onGraded({ correct: r.correct, score: r.score });
            }}
          >
            Check my journal
          </Button>
          {result && (
            <Feedback correct={result.correct} title={result.correct ? '✓ Exactly the right values' : `✗ ${result.hits.length} right, ${result.missed.length} missed, ${result.noise.length} noise`}>
              {result.missed.length > 0 && (
                <>
                  <p className="font-medium">Missed:</p>
                  <Bullets items={result.missed} />
                </>
              )}
              {result.noise.length > 0 && (
                <>
                  <p className="font-medium">Not needed:</p>
                  <Bullets items={result.noise} />
                </>
              )}
              <p className="text-slate-500">Trap: {study.trap}</p>
            </Feedback>
          )}
        </div>
      </div>
    </div>
  );
}

function AnalysisDrill({ seed, onGraded }: ItemProps) {
  const it = useMemo(() => makeAnalysisItem(seed), [seed]);
  const [calc, setCalc] = useState<CalcHistory[]>([]);
  const [ans, setAns] = useState('');
  const [done, setDone] = useState<boolean | null>(null);
  const q = it.question;
  const unit = q.unit === '%' ? '%' : q.unit === 'pp' ? ' pp' : q.unit === '$k' ? ' $k' : ` ${q.unit}`;
  return (
    <div className="grid grid-cols-[1fr_300px] gap-5">
      <div className="space-y-4">
        <div className="rounded-md bg-blue-50 p-3 text-sm">
          <span className="font-semibold text-blue-800">Objective: </span>
          {it.study.objective}
        </div>
        <Panel title="Your journal">
          <table className="w-full text-sm">
            <tbody>
              {it.facts.map((f) => (
                <tr key={f.id} className="border-b border-slate-100">
                  <td className="py-1 text-slate-600">{factLabel(f)}</td>
                  <td className="py-1 text-right">
                    <FactChip factId={f.id} value={f.value} unit={f.unit === '%' ? '%' : undefined} label={factLabel(f)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title={`Question ${q.label}`}>
          <p className="mb-3 text-sm">{q.prompt}</p>
          <div className="flex items-center gap-3">
            <AnswerBox id="drill-answer" value={ans} unit={q.unit} onChange={(v) => done === null && setAns(v)} onCommit={() => undefined} />
            <Button
              disabled={ans === '' || done !== null}
              onClick={() => {
                const ok = gradeAnalysis(it, Number(ans));
                setDone(ok);
                onGraded({ correct: ok, score: ok ? 1 : 0 });
              }}
            >
              Check
            </Button>
          </div>
          {done !== null && (
            <Feedback correct={done} title={done ? `✓ ${q.answer}${unit}` : `✗ Correct answer: ${q.answer}${unit}`}>
              {!done && checkNumeric(Number(ans), Math.round(q.answer)) && <p>Close — check your rounding: answers are to two decimals.</p>}
              {!done && q.unit === 'pp' && <p>Percentage points are a plain difference between two percentages — not a percent change.</p>}
              <p className="text-slate-500">Method: follow the formula in brackets in the question, use the exact journal values, and round only at the end.</p>
            </Feedback>
          )}
        </Panel>
      </div>
      <Panel title="Calculator">
        <Calculator history={calc} setHistory={setCalc} />
      </Panel>
    </div>
  );
}

function CaseDrill({ seed, onGraded }: ItemProps) {
  const c = useMemo(() => makeCaseItem(seed), [seed]);
  const [given, setGiven] = useState<string | null>(null);
  const ok = given !== null && (c.kind === 'numeric' ? checkNumeric(Number(given), c.answer as number) : given === c.answer);
  return (
    <div>
      <div className={given !== null ? 'pointer-events-none opacity-60' : ''}>
        <CaseRunner
          c={c}
          index={0}
          total={2}
          onSubmit={(a) => {
            if (given !== null) return;
            setGiven(a);
            const right = c.kind === 'numeric' ? checkNumeric(Number(a), c.answer as number) : a === c.answer;
            onGraded({ correct: right, score: right ? 1 : 0 });
          }}
        />
      </div>
      {given !== null && (
        <Feedback correct={ok} title={ok ? `✓ ${c.answer}${c.unit === '%' ? '%' : ''}` : `✗ You said ${given}; answer: ${c.answer}${c.unit === '%' ? '%' : ''}`}>
          <p>
            <Pill>{c.type}</Pill> {c.explanation}
          </p>
        </Feedback>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- SFL

function DayHeader({ day }: { day: number }) {
  return (
    <div className="mb-4 rounded-md bg-blue-50 p-3 text-sm">
      <span className="font-semibold text-blue-800">Day {day + 1} goal: </span>
      {GOAL_TEXT[DAY_GOALS[day]]}
    </div>
  );
}

function Notes({ items }: { items: { who: string; text: string }[] }) {
  return (
    <Panel title="Your notes today">
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">No notes yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((n, i) => (
            <li key={i} className="rounded bg-slate-50 p-2">
              <div className="text-xs font-semibold text-slate-600">{n.who}</div>
              {n.text}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Choices({ options, pick, onPick, mark }: { options: string[]; pick: number | null; onPick: (i: number) => void; mark?: (i: number) => ReactNode }) {
  return (
    <div className="space-y-2">
      {options.map((o, i) => (
        <button
          key={i}
          disabled={pick !== null}
          onClick={() => onPick(i)}
          className={`block w-full rounded border p-3 text-left text-sm ${pick === i ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-400'} disabled:cursor-default`}
        >
          {o}
          {pick !== null && mark && <div className="mt-1 text-xs">{mark(i)}</div>}
        </button>
      ))}
    </div>
  );
}

const nameOf = (sc: { researchers: { id: string; name: string }[]; stations: { id: string; name: string }[] }, id: string) =>
  sc.researchers.find((r) => r.id === id)?.name ?? sc.stations.find((s) => s.id === id)?.name ?? id;

function ExploreDrill({ seed, onGraded }: ItemProps) {
  const it = useMemo(() => makeExploreItem(seed), [seed]);
  const [pick, setPick] = useState<number | null>(null);
  return (
    <div className="grid grid-cols-[1fr_300px] gap-4">
      <div>
        <DayHeader day={it.day} />
        <p className="mb-3 text-sm text-slate-600">You have one Explore Request left. Which question do you buy?</p>
        <Choices
          options={it.options.map((o) => o.label)}
          pick={pick}
          onPick={(i) => {
            setPick(i);
            onGraded({ correct: i === it.correct, score: i === it.correct ? 1 : 0 });
          }}
          mark={(i) => <span className={i === it.correct ? 'text-emerald-700' : 'text-slate-500'}>{it.options[i].why}</span>}
        />
        {pick !== null && (
          <Feedback correct={pick === it.correct}>
            <p>{it.options[it.correct].why}</p>
          </Feedback>
        )}
      </div>
      <Notes items={it.notes.map((n) => ({ who: nameOf(it.sc, n.target), text: n.answer }))} />
    </div>
  );
}

const REASON_NEEDS: Record<Reason, string> = {
  preference: 'an answer from the researcher saying they want this workstation',
  skill: 'an answer from the researcher about their strongest skill (and, if you asked the station, a matching need)',
  need: 'an answer from this workstation about what it needs',
  coverage: 'an answer from this workstation saying it needs people today',
  goal: 'an answer tied to today’s goal: a matching preference on Day 1, the station’s need or coverage on Day 2, either on Day 3',
};

function ReasonsDrill({ seed, onGraded }: ItemProps) {
  const it = useMemo(() => makeReasonItem(seed), [seed]);
  const [pick, setPick] = useState<number | null>(null);
  const r = it.sc.researchers[it.researcher];
  const s = it.sc.stations[it.station];
  return (
    <div className="grid grid-cols-[1fr_300px] gap-4">
      <div>
        <DayHeader day={it.day} />
        <p className="mb-3 text-sm">
          You are moving <b>{r.name}</b> to <b>{s.name}</b>. Which reason do your notes back up?
        </p>
        <Choices
          options={REASONS.map((x) => x.label)}
          pick={pick}
          onPick={(i) => {
            setPick(i);
            const ok = it.supported.includes(REASONS[i].id);
            onGraded({ correct: ok, score: ok ? 1 : 0 });
          }}
          mark={(i) => (it.supported.includes(REASONS[i].id) ? <span className="text-emerald-700">Supported by your notes</span> : <span className="text-slate-500">Needs {REASON_NEEDS[REASONS[i].id]}.</span>)}
        />
        {pick !== null && (
          <Feedback correct={it.supported.includes(REASONS[pick].id)}>
            <p>Supported here: {it.supported.map((x) => REASONS.find((y) => y.id === x)!.label).join(', ')}.</p>
            <p className="text-slate-500">A reason only counts when an answer you bought today backs it. Check the notes before picking.</p>
          </Feedback>
        )}
      </div>
      <Notes items={it.notes.map((n) => ({ who: nameOf(it.sc, n.target), text: n.answer }))} />
    </div>
  );
}

function SupportDrill({ seed, onGraded }: ItemProps) {
  const it = useMemo(() => makeSupportItem(seed), [seed]);
  const [pick, setPick] = useState<number | null>(null);
  const who = it.sc.researchers.find((r) => r.id === it.request.from)!;
  return (
    <div className="max-w-3xl">
      <DayHeader day={it.day} />
      {it.earlier && (
        <p className="mb-3 rounded border border-slate-200 bg-white p-3 text-sm text-slate-600">
          Earlier today you told {it.earlier.who}: “{it.earlier.said}”
        </p>
      )}
      <Panel title={`Request from ${who.name}`}>
        <p className="mb-4 text-sm">
          “{it.request.cue} {it.request.text}”
        </p>
        <Choices
          options={it.request.options.map((o) => o.text)}
          pick={pick}
          onPick={(i) => {
            setPick(i);
            const ok = supportCorrect(it, i);
            onGraded({ correct: ok, score: ok ? 1 : 0 });
          }}
          mark={(i) => <span className={supportCorrect(it, i) ? 'text-emerald-700' : 'text-slate-500'}>This reply {SERVES_TEXT[it.request.options[i].serves]}.</span>}
        />
        {pick !== null && (
          <Feedback correct={supportCorrect(it, pick)}>
            <p>
              Today’s goal is “{GOAL_TEXT[DAY_GOALS[it.day]]}”, so the best reply {SERVES_TEXT[DAY_GOALS[it.day]]}.
              {it.earlier ? ' It also matches what you already told the team earlier — consistency counts.' : ''}
            </p>
          </Feedback>
        )}
      </Panel>
    </div>
  );
}

function ReflectDrill({ seed, onGraded }: ItemProps) {
  const it = useMemo(() => makeReflectItem(seed), [seed]);
  const [pick, setPick] = useState<Rating | null>(null);
  const r = it.sc.researchers[it.researcher];
  const options: Rating[] = [...LEVELS, 'unknown'];
  return (
    <div className="grid grid-cols-[1fr_300px] gap-4">
      <div>
        <DayHeader day={it.day} />
        <Panel title="Reflect">
          <p className="mb-3 text-sm">
            {REFLECT_DIMS[it.day]} Rate <b>{r.name}</b>.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {options.map((o) => (
              <Button
                key={o}
                variant={pick === o ? 'primary' : 'secondary'}
                disabled={pick !== null}
                onClick={() => {
                  setPick(o);
                  onGraded({ correct: o === it.answer, score: o === it.answer ? 1 : 0 });
                }}
              >
                {o === 'unknown' ? 'I don’t know' : o[0].toUpperCase() + o.slice(1)}
              </Button>
            ))}
          </div>
          {pick && (
            <Feedback correct={pick === it.answer} title={pick === it.answer ? '✓ Matches the evidence' : `✗ Best answer: ${it.answer === 'unknown' ? 'I don’t know' : it.answer}`}>
              {it.evidence === 'none' ? (
                <p>Your notes say nothing about how {r.name.split(' ')[0]} feels today, so “I don’t know” is the honest rating. (They actually felt {it.truth}, but you had no way to know.)</p>
              ) : (
                <p>
                  {it.evidence === 'asked' ? 'You asked them directly' : 'They told you in a Support request'}, and what they said shows {it.truth}.
                </p>
              )}
            </Feedback>
          )}
        </Panel>
      </div>
      <Notes items={it.notes} />
    </div>
  );
}

function ClassicDrill({ seed, onGraded }: ItemProps) {
  const it = useMemo(() => makeClassicItem(seed), [seed]);
  const [pick, setPick] = useState<number | null>(null);
  const opts = it.decision.options;
  const quality = (q: number) => (q >= 0.9 ? 'strong' : q >= 0.6 ? 'reasonable' : 'weak');
  return (
    <div className="max-w-3xl space-y-4">
      <div className="rounded-md bg-blue-50 p-3 text-sm">
        <span className="font-semibold text-blue-800">Mandate: </span>
        {it.sc.mandate}
        <div className="mt-1 text-xs text-slate-600">Implied priorities: {priorityText(it.sc)}</div>
      </div>
      <Panel title={it.decision.title}>
        <p className="mb-4 text-sm leading-relaxed">{it.decision.prompt}</p>
        <Choices
          options={opts.map((o) => o.text)}
          pick={pick}
          onPick={(i) => {
            setPick(i);
            const ok = opts[i].q >= opts[it.best].q;
            onGraded({ correct: ok, score: opts[i].q / opts[it.best].q });
          }}
          mark={(i) => <span className={i === it.best ? 'text-emerald-700' : 'text-slate-500'}>{quality(opts[i].q)} option</span>}
        />
        {pick !== null && (
          <Feedback correct={opts[pick].q >= opts[it.best].q}>
            <p>
              <b>What happened:</b> {opts[pick].outcome}
            </p>
            {pick !== it.best && (
              <p>
                <b>Strongest option:</b> {opts[it.best].text} <span className="text-slate-500">→ {opts[it.best].outcome}</span>
              </p>
            )}
            <p className="text-slate-500">Strong options usually gather just enough information or bring stakeholders in, then commit — avoiding both reckless speed and endless delay.</p>
          </Feedback>
        )}
      </Panel>
    </div>
  );
}
