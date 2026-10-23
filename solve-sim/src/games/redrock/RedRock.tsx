import { useMemo, useRef, useState, type ReactNode } from 'react';
import { BarChart, BubbleChart, LineChart, PreviewChart, type Pt } from '../../components/Charts';
import { Calculator, type CalcHistory } from '../../components/Calculator';
import { GameFrame } from '../../components/GameFrame';
import { FactChip, Journal, type JournalEntry } from '../../components/Journal';
import { useAutoSubmit } from '../../components/clock';
import { Button, Modal, Panel, Pill } from '../../components/ui';
import { beginDrag, fmtValue, useDropTarget } from '../../lib/drag';
import { logEvent, useSitting } from '../../store/sitting';
import { CHART_TYPES, factLabel, generateCases, generateStudy, type Case, type ChartType, type Exhibit, type Fact, type Segment, type Study } from './model';
import { scoreRedRock, type RedRockState } from './score';

type Stage = 'investigation' | 'analysis' | 'report' | 'cases';
type ReportTab = 'written' | 'graph' | 'visual';

export function RedRock({ seed }: { seed: string }) {
  const study = useMemo(() => generateStudy(seed), [seed]);
  const cases = useMemo(() => generateCases(seed), [seed]);
  const finishGame = useSitting((s) => s.finishGame);
  const setPhase = useSitting((s) => s.setPhase);

  const [stage, setStageRaw] = useState<Stage>('investigation');
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [calc, setCalc] = useState<CalcHistory[]>([]);
  const [calcIntroSeen, setCalcIntroSeen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [blanks, setBlanks] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<ReportTab>('written');
  const [chartType, setChartType] = useState<ChartType | null>(null);
  const [pendingChart, setPendingChart] = useState<ChartType | null>(null);
  const [chartValues, setChartValues] = useState<string[]>(study.chart.categories.map(() => ''));
  const [confirmReport, setConfirmReport] = useState(false);
  const [confirmCases, setConfirmCases] = useState(false);
  const [caseIdx, setCaseIdx] = useState(0);
  const [caseAnswers, setCaseAnswers] = useState<string[]>([]);
  const t0 = useRef(Date.now());
  const casesStart = useRef<number | null>(null);

  const setStage = (s: Stage) => {
    setStageRaw(s);
    setPhase(s);
    logEvent('stage_change', { to: s });
  };

  const submit = (timedOut: boolean, finalCaseAnswers = caseAnswers) => {
    const now = Date.now();
    const studyEnd = casesStart.current ?? now;
    const st: RedRockState = {
      answers,
      blanks,
      chartType,
      chartValues,
      caseAnswers: finalCaseAnswers,
      casesReached: casesStart.current ? Math.min(cases.length, finalCaseAnswers.length + (finalCaseAnswers.length < cases.length ? 1 : 0)) : 0,
      studySec: Math.round((studyEnd - t0.current) / 1000),
      casesSec: casesStart.current ? Math.round((now - casesStart.current) / 1000) : 0,
    };
    finishGame(scoreRedRock(study, cases, st, useSitting.getState().sitting!.telemetry.filter((e) => e.game === 'redrock'), timedOut));
  };
  useAutoSubmit(() => submit(true));

  const addFact = (f: Fact) => {
    if (journal.some((j) => j.factId === f.id)) return;
    setJournal([...journal, { factId: f.id, value: f.value, unit: f.unit, label: factLabel(f) }]);
    logEvent('journal_add', { factId: f.id, relevant: f.relevant, via: 'keyboard' });
  };

  const sidebar = (
    <div className="space-y-5">
      <div className="rounded-md bg-blue-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-blue-800">Objective</div>
        <p className="mt-1 text-sm text-slate-700">{stage === 'cases' ? 'Complete each case in order.' : study.objective}</p>
      </div>
      <nav className="space-y-1 text-sm">
        <div className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Study</div>
        <NavItem active={stage === 'investigation'} disabled={stage === 'report' || stage === 'cases'} onClick={() => setStage('investigation')}>
          Investigation
        </NavItem>
        <NavItem active={stage === 'analysis'} disabled={stage === 'report' || stage === 'cases'} onClick={() => setStage('analysis')}>
          Analysis
        </NavItem>
        <NavItem active={stage === 'report'} disabled={stage === 'cases'} onClick={() => stage !== 'report' && setConfirmReport(true)}>
          Report {stage === 'investigation' || stage === 'analysis' ? <span className="text-xs text-slate-400">(one-way)</span> : null}
        </NavItem>
        <div className="px-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Cases</div>
        {cases.map((c, i) => (
          <div key={c.id} className={`flex items-center justify-between rounded px-3 py-1 ${stage === 'cases' && i === caseIdx ? 'bg-blue-50 font-semibold text-blue-800' : 'text-slate-400'}`}>
            Case {i + 1}
            {i < caseAnswers.length && <span className="text-xs">✓ locked</span>}
          </div>
        ))}
      </nav>
    </div>
  );

  const right =
    stage === 'cases' ? undefined : stage === 'report' ? (
      <AnswerPalette study={study} answers={answers} />
    ) : (
      <div className="space-y-4">
        <Journal id="journal" entries={journal} setEntries={setJournal} relevant={(id) => !!study.facts[id]?.relevant} />
        {stage === 'analysis' && (
          <Panel title="Calculator">
            <Calculator history={calc} setHistory={setCalc} />
          </Panel>
        )}
      </div>
    );

  return (
    <GameFrame sidebar={sidebar} right={right} subtitle={study.island}>
      {stage === 'investigation' && (
        <div className="mx-auto max-w-3xl space-y-5">
          <Directions>Review the study information. Drag values relevant to the objective into your Research Journal. No calculator is available in this phase.</Directions>
          <Panel title="Study information">
            <div className="space-y-3 text-sm leading-relaxed text-slate-700">
              {study.narrative.map((p, i) => (
                <p key={i}>
                  <SegmentText segments={p} facts={study.facts} onAdd={addFact} />
                </p>
              ))}
            </div>
          </Panel>
          {study.exhibits.map((ex, i) => (
            <ExhibitView key={ex.id} n={i + 1} exhibit={ex} facts={study.facts} onAdd={addFact} />
          ))}
          <div className="flex justify-end">
            <Button onClick={() => setStage('analysis')}>Go to Analysis →</Button>
          </div>
        </div>
      )}

      {stage === 'analysis' && (
        <div className="mx-auto max-w-3xl space-y-4">
          <Directions>Answer each question to two decimal places. Drag values from your journal into the calculator, and results from the calculator history into the answer boxes. You can return to Investigation.</Directions>
          {study.questions.map((q) => (
            <Panel key={q.id} title={`Question ${q.label}`}>
              <p className="mb-3 text-sm text-slate-700">{q.prompt}</p>
              <AnswerBox
                id={`ans-${q.id}`}
                value={answers[q.id] ?? ''}
                unit={q.unit}
                onChange={(v) => {
                  setAnswers((a) => ({ ...a, [q.id]: v }));
                }}
                onCommit={(v) => logEvent('answer_change', { field: q.id, value: v })}
              />
            </Panel>
          ))}
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStage('investigation')}>
              ← Investigation
            </Button>
            <Button onClick={() => setConfirmReport(true)}>Continue to Report →</Button>
          </div>
          <Modal open={!calcIntroSeen} title="Using the calculator" actions={<Button onClick={() => setCalcIntroSeen(true)}>Got it</Button>}>
            <p>Type or tap an expression and press =. Each result is kept in the history panel.</p>
            <p className="mt-2">Drag journal values into the calculator display, and drag results from the history into answer boxes. Round answers to two decimal places.</p>
          </Modal>
        </div>
      )}

      {stage === 'report' && (
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex gap-1 border-b border-slate-200">
            {(['written', 'graph', 'visual'] as ReportTab[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  logEvent('tab_switch', { tab: t });
                }}
                className={`-mb-px border-b-2 px-4 py-2 text-sm ${tab === t ? 'border-blue-700 font-semibold text-blue-800' : 'border-transparent text-slate-500'}`}
              >
                {t === 'written' ? 'Written Report' : t === 'graph' ? 'Graph Selection' : 'Visual Report'}
              </button>
            ))}
          </div>
          {tab === 'written' && <WrittenReport study={study} answers={answers} blanks={blanks} setBlank={(id, v) => (setBlanks((b) => ({ ...b, [id]: v })), logEvent('answer_change', { field: id, value: v }))} />}
          {tab === 'graph' && (
            <Panel title="Choose one chart type">
              <p className="mb-3 text-sm text-slate-600">Pick the chart that best communicates your recommendation. Your choice is locked once confirmed.</p>
              <div className="grid grid-cols-3 gap-2">
                {CHART_TYPES.map((c) => (
                  <button
                    key={c.id}
                    disabled={!!chartType}
                    onClick={() => setPendingChart(c.id)}
                    className={`rounded border p-3 text-left text-sm ${chartType === c.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200'} disabled:cursor-not-allowed ${chartType && chartType !== c.id ? 'opacity-40' : ''}`}
                  >
                    <div className="font-medium">{c.label}</div>
                  </button>
                ))}
              </div>
              {chartType && <p className="mt-3 text-xs text-slate-500">Locked. Continue to the Visual Report tab.</p>}
            </Panel>
          )}
          {tab === 'visual' && (
            <Panel title={study.chart.title}>
              {!chartType ? (
                <p className="text-sm text-slate-500">Choose a chart type first.</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {study.chart.categories.map((c, i) => (
                      <label key={c} className="flex items-center gap-2 text-sm">
                        <span className="w-40 truncate text-slate-600">{c}</span>
                        <AnswerBox
                          id={`chart-${i}`}
                          value={chartValues[i]}
                          unit={study.chart.unit}
                          onChange={(v) => setChartValues((cv) => cv.map((x, k) => (k === i ? v : x)))}
                          onCommit={(v) => logEvent('answer_change', { field: `chart-${i}`, value: v })}
                        />
                      </label>
                    ))}
                  </div>
                  <PreviewChart type={chartType} categories={study.chart.categories} values={chartValues.map((v) => (v === '' ? null : Number(v)))} />
                </div>
              )}
            </Panel>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setConfirmCases(true)}>Submit report and start Cases →</Button>
          </div>
        </div>
      )}

      {stage === 'cases' && (
        <CaseRunner
          key={caseIdx}
          c={cases[caseIdx]}
          index={caseIdx}
          total={cases.length}
          onSubmit={(ans) => {
            const next = [...caseAnswers, ans];
            setCaseAnswers(next);
            logEvent('case_submit', { case: caseIdx, answer: ans });
            if (caseIdx + 1 >= cases.length) submit(false, next);
            else setCaseIdx(caseIdx + 1);
          }}
        />
      )}

      <Modal
        open={confirmReport}
        title="Proceed to the Report?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmReport(false)}>
              Stay in Study
            </Button>
            <Button
              onClick={() => {
                setConfirmReport(false);
                setStage('report');
              }}
            >
              Continue to Report
            </Button>
          </>
        }
      >
        You cannot return to the study. Your Analysis answers will be carried into the Report as they are now.
      </Modal>
      <Modal
        open={confirmCases}
        title="Submit your report?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmCases(false)}>
              Keep editing
            </Button>
            <Button
              onClick={() => {
                setConfirmCases(false);
                casesStart.current = Date.now();
                setStage('cases');
              }}
            >
              Submit and start Cases
            </Button>
          </>
        }
      >
        The report cannot be reopened. The six cases share the remaining time on this clock.
      </Modal>
      <Modal
        open={!!pendingChart}
        title="Lock this chart type?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setPendingChart(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setChartType(pendingChart);
                logEvent('chart_choice', { chart: pendingChart });
                setPendingChart(null);
                setTab('visual');
              }}
            >
              Lock {CHART_TYPES.find((c) => c.id === pendingChart)?.label}
            </Button>
          </>
        }
      >
        You will not be able to change the chart type afterwards.
      </Modal>
    </GameFrame>
  );
}

function NavItem({ active, disabled, onClick, children }: { active: boolean; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button disabled={disabled} onClick={onClick} className={`block w-full rounded px-3 py-1.5 text-left ${active ? 'bg-blue-50 font-semibold text-blue-800' : disabled ? 'text-slate-300' : 'text-slate-600 hover:bg-slate-50'}`}>
      {children}
    </button>
  );
}

function Directions({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
      <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Directions</span>
      {children}
    </div>
  );
}

function SegmentText({ segments, facts, onAdd }: { segments: Segment[]; facts: Record<string, Fact>; onAdd: (f: Fact) => void }) {
  return (
    <>
      {segments.map((s, i) => {
        if (typeof s === 'string') return <span key={i}>{s}</span>;
        const f = facts[s.fact];
        return <FactChip key={i} factId={f.id} value={f.value} unit={f.unit} label={factLabel(f)} onKeyboardAdd={() => onAdd(f)} />;
      })}
    </>
  );
}

export function ExhibitView({ exhibit: ex, facts, n, onAdd }: { exhibit: Exhibit; facts: Record<string, Fact>; n: number; onAdd: (f: Fact) => void }) {
  const entered = useRef(0);
  const pt = (id: string): Pt => {
    const f = facts[id];
    return { value: f.value, drag: { factId: f.id, label: factLabel(f), unit: f.unit } };
  };
  const chip = (id: string) => {
    const f = facts[id];
    return <FactChip factId={f.id} value={f.value} unit={f.unit === '%' ? '%' : undefined} label={factLabel(f)} onKeyboardAdd={() => onAdd(f)} />;
  };
  return (
    <div
      onMouseEnter={() => (entered.current = Date.now())}
      onMouseLeave={() => entered.current && logEvent('exhibit_hover', { exhibit: ex.id, ms: Date.now() - entered.current })}
    >
      <Panel title={`Exhibit ${n}: ${ex.title}`}>
        {ex.kind === 'table' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                {ex.columns.map((c) => (
                  <th key={c} className="py-1.5 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ex.rows.map((r) => (
                <tr key={r.label} className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-600">{r.label}</td>
                  {r.cells.map((c) => (
                    <td key={c} className="py-1.5">
                      {chip(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {ex.kind === 'bar' && <BarChart xLabels={ex.xLabels} series={ex.series.map((s) => ({ name: s.name, pts: s.facts.map(pt) }))} />}
        {ex.kind === 'line' && <LineChart xLabels={ex.xLabels} series={ex.series.map((s) => ({ name: s.name, pts: s.facts.map(pt) }))} />}
        {ex.kind === 'bubble' && <BubbleChart xLabel={ex.xLabel} yLabel={ex.yLabel} points={ex.points.map((p) => ({ label: p.label, x: pt(p.x), y: pt(p.y), size: pt(p.size) }))} />}
        {ex.kind === 'assumptions' && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {ex.items.map((it, i) => (
              <li key={i}>
                <SegmentText segments={it} facts={facts} onAdd={onAdd} />
              </li>
            ))}
          </ul>
        )}
        {'unit' in ex && (ex.kind === 'bar' || ex.kind === 'line') && <div className="mt-1 text-xs text-slate-400">Unit: {ex.unit}</div>}
        {'caption' in ex && ex.caption && <p className="mt-2 text-xs italic text-slate-500">{ex.caption}</p>}
      </Panel>
    </div>
  );
}

function AnswerBox({ id, value, unit, onChange, onCommit }: { id: string; value: string; unit?: string; onChange: (v: string) => void; onCommit: (v: string) => void }) {
  const drop = useDropTarget(id, (item) => {
    const v = String(Math.round(item.value * 100) / 100);
    onChange(v);
    onCommit(v);
  });
  return (
    <div {...drop.props} className={`flex items-center gap-2 rounded border px-2 py-1 ${drop.over ? 'border-blue-500 bg-blue-50' : drop.dragging ? 'border-blue-300' : 'border-slate-300'}`}>
      <input
        aria-label="Answer"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.\-]/g, ''))}
        onBlur={(e) => onCommit(e.target.value)}
        className="w-32 bg-transparent font-mono outline-none"
        placeholder="0.00"
      />
      {unit && <span className="text-xs text-slate-400">{unit}</span>}
    </div>
  );
}

function AnswerPalette({ study, answers }: { study: Study; answers: Record<string, string> }) {
  return (
    <Panel title="Your Analysis results">
      <p className="mb-2 text-xs text-slate-500">Drag a result into a value slot in the report.</p>
      <ul className="space-y-1.5">
        {study.questions.map((q) => (
          <li key={q.id} className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Q{q.label}</span>
            {answers[q.id] ? (
              <span
                className="cursor-grab rounded bg-blue-50 px-2 py-0.5 font-mono font-semibold text-blue-800"
                onPointerDown={(e) => beginDrag(e, { kind: 'value', value: Number(answers[q.id]), label: `Q${q.label}`, unit: q.unit, answerId: q.id })}
              >
                {fmtValue(Number(answers[q.id]), q.unit === 'pp' ? 'pp' : q.unit)}
              </span>
            ) : (
              <span className="text-xs text-slate-300">no answer</span>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function WrittenReport({ study, answers, blanks, setBlank }: { study: Study; answers: Record<string, string>; blanks: Record<string, string>; setBlank: (id: string, v: string) => void }) {
  return (
    <Panel title="Written report">
      <p className="text-sm leading-8 text-slate-700">
        {study.report.segments.map((s, i) => {
          if (typeof s === 'string') return <span key={i}>{s}</span>;
          const b = study.report.blanks.find((x) => x.id === s.blank)!;
          if (b.kind === 'choice')
            return (
              <select key={i} aria-label={`Blank ${b.id}`} value={blanks[b.id] ?? ''} onChange={(e) => setBlank(b.id, e.target.value)} className="mx-1 rounded border border-slate-300 bg-white px-1 py-0.5 text-sm">
                <option value="">select…</option>
                {b.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            );
          return <ValueSlot key={i} id={b.id} study={study} answers={answers} value={blanks[b.id] ?? ''} onChange={(v) => setBlank(b.id, v)} />;
        })}
      </p>
    </Panel>
  );
}

function ValueSlot({ id, study, answers, value, onChange }: { id: string; study: Study; answers: Record<string, string>; value: string; onChange: (qid: string) => void }) {
  const drop = useDropTarget(`slot-${id}`, (item) => item.kind === 'value' && item.answerId && onChange(item.answerId));
  return (
    <span {...drop.props} className={`mx-1 inline-block rounded border px-1 ${drop.over ? 'border-blue-500 bg-blue-50' : drop.dragging ? 'border-blue-300 border-dashed' : 'border-slate-300'}`}>
      <select aria-label={`Value slot ${id}`} value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent py-0.5 font-mono text-sm outline-none">
        <option value="">drop result</option>
        {study.questions
          .filter((q) => answers[q.id])
          .map((q) => (
            <option key={q.id} value={q.id}>
              {answers[q.id]}
              {q.unit === '%' ? '%' : q.unit === '$k' ? ' $k' : q.unit === 'pp' ? '' : ` ${q.unit}`}
            </option>
          ))}
      </select>
    </span>
  );
}

function CaseRunner({ c, index, total, onSubmit }: { c: Case; index: number; total: number; onSubmit: (a: string) => void }) {
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [calc, setCalc] = useState<CalcHistory[]>([]);
  const [ans, setAns] = useState('');
  const addFact = (f: Fact) => !journal.some((j) => j.factId === f.id) && setJournal([...journal, { factId: f.id, value: f.value, unit: f.unit, label: factLabel(f) }]);
  return (
    <div className="grid grid-cols-[1fr_300px] gap-5">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Pill tone="blue">
            Case {index + 1} of {total}
          </Pill>
          <span className="text-sm font-semibold text-slate-700">{c.title}</span>
          <span className="text-xs text-slate-400">~2 min</span>
        </div>
        <Panel>
          <div className="space-y-2 text-sm leading-relaxed text-slate-700">
            {c.text.map((p, i) => (
              <p key={i}>
                <SegmentText segments={p} facts={c.facts} onAdd={addFact} />
              </p>
            ))}
          </div>
        </Panel>
        {c.exhibit && <ExhibitView exhibit={c.exhibit} facts={c.facts} n={1} onAdd={addFact} />}
        <Panel title="Question">
          <p className="mb-3 text-sm text-slate-700">{c.question}</p>
          {c.kind === 'numeric' ? (
            <AnswerBox id={`case-${index}`} value={ans} unit={c.unit} onChange={setAns} onCommit={(v) => logEvent('answer_change', { field: `case-${index}`, value: v })} />
          ) : (
            <div className="space-y-1.5">
              {c.options!.map((o) => (
                <label key={o} className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm ${ans === o ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
                  <input
                    type="radio"
                    name={`case-${index}`}
                    checked={ans === o}
                    onChange={() => {
                      setAns(o);
                      logEvent('answer_change', { field: `case-${index}`, value: o });
                    }}
                  />
                  <span className="font-mono">{o}</span>
                </label>
              ))}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button disabled={ans === ''} onClick={() => onSubmit(ans)}>
              Submit and {index + 1 < total ? 'unlock next case' : 'finish Red Rock'}
            </Button>
          </div>
        </Panel>
      </div>
      <div className="space-y-4">
        <Journal id={`case-journal-${index}`} entries={journal} setEntries={setJournal} relevant={(id) => !!c.facts[id]?.relevant} />
        <Panel title="Calculator">
          <Calculator history={calc} setHistory={setCalc} />
        </Panel>
      </div>
    </div>
  );
}
