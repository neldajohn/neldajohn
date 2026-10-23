import { useMemo, useRef, useState } from 'react';
import { CONFIG } from '../../config';
import { GameFrame } from '../../components/GameFrame';
import { useAutoSubmit } from '../../components/clock';
import { Button, Modal, Panel } from '../../components/ui';
import { budgetScore, calmness, combine, durationOf, mean } from '../../lib/scoring';
import type { GameResult, TelemetryEvent } from '../../lib/types';
import { logEvent, useSitting } from '../../store/sitting';
import { alignment, dimScores, generateClassic, PRIORITIES, rankingScore, resolveDecision, type ClassicDecision, type ClassicScenario } from './classic';

type Step = { kind: 'intro'; page: number } | { kind: 'rank' } | { kind: 'decide'; idx: number } | { kind: 'outcome'; idx: number };

export function Classic({ seed }: { seed: string }) {
  const sc = useMemo(() => generateClassic(seed), [seed]);
  const finishGame = useSitting((s) => s.finishGame);
  const setPhase = useSitting((s) => s.setPhase);
  const [step, setStep] = useState<Step>({ kind: 'intro', page: 0 });
  const [ranking, setRanking] = useState<number[]>([0, 1, 2, 3]);
  const [choices, setChoices] = useState<number[]>([]);
  const [shown, setShown] = useState<ClassicDecision[]>([]);
  const [tags, setTags] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const decisionStart = useRef(Date.now());
  const [times, setTimes] = useState<number[]>([]);

  const submit = (timedOut: boolean, c = choices, s = shown, t = times) =>
    finishGame(scoreClassic(sc, ranking, s, c, t, useSitting.getState().sitting!.telemetry.filter((e) => e.game === 'sflClassic'), timedOut));
  useAutoSubmit(() => submit(true));

  const current = step.kind === 'decide' || step.kind === 'outcome' ? (step.kind === 'decide' ? resolveDecision(sc, step.idx, tags) : shown[step.idx]) : null;

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j > 3) return;
    const r = ranking.slice();
    [r[i], r[j]] = [r[j], r[i]];
    setRanking(r);
    logEvent('rank_change', { ranking: r });
  };

  const sidebar = (
    <div className="space-y-4">
      <div className="rounded-md bg-blue-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-blue-800">Programme</div>
        <p className="mt-1 text-sm text-slate-700">{sc.programme}</p>
      </div>
      {step.kind !== 'intro' && step.kind !== 'rank' && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your priorities</div>
          <ol className="mt-1 list-decimal pl-5 text-sm text-slate-600">
            {ranking.map((p) => (
              <li key={p}>{PRIORITIES[p]}</li>
            ))}
          </ol>
        </div>
      )}
      {(step.kind === 'decide' || step.kind === 'outcome') && (
        <div className="text-sm text-slate-500">
          Decision {step.idx + 1} of {sc.decisions.length}
          <div className="mt-1 h-1.5 rounded bg-slate-200">
            <div className="h-1.5 rounded bg-blue-600" style={{ width: `${(100 * (step.idx + (step.kind === 'outcome' ? 1 : 0))) / sc.decisions.length}%` }} />
          </div>
          <p className="mt-2 text-xs">~{CONFIG.sflClassic.perDecisionSec}s per decision</p>
        </div>
      )}
    </div>
  );

  return (
    <GameFrame sidebar={sidebar}>
      <div className="mx-auto max-w-2xl">
        {step.kind === 'intro' && (
          <Panel title={`Briefing ${step.page + 1} of 2`}>
            <p className="text-sm leading-relaxed text-slate-700">{sc.intro[step.page]}</p>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => (step.page === 0 ? setStep({ kind: 'intro', page: 1 }) : (setStep({ kind: 'rank' }), setPhase('rank')))}>Continue</Button>
            </div>
          </Panel>
        )}

        {step.kind === 'rank' && (
          <Panel title="Rank your priorities">
            <p className="mb-4 text-sm text-slate-600">Drag (or use the arrows) to order these from most to least important for this programme. Your ranking frames the decisions that follow.</p>
            <ol className="space-y-2">
              {ranking.map((p, i) => (
                <li
                  key={p}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', String(i))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const from = Number(e.dataTransfer.getData('text/plain'));
                    const r = ranking.slice();
                    const [x] = r.splice(from, 1);
                    r.splice(i, 0, x);
                    setRanking(r);
                    logEvent('rank_change', { ranking: r });
                  }}
                  className="flex cursor-grab items-center gap-3 rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <span className="w-5 font-mono text-slate-400">{i + 1}</span>
                  <span className="flex-1 font-medium">{PRIORITIES[p]}</span>
                  <button aria-label={`Move ${PRIORITIES[p]} up`} onClick={() => move(i, -1)} className="px-1 text-slate-400 hover:text-slate-800">
                    ↑
                  </button>
                  <button aria-label={`Move ${PRIORITIES[p]} down`} onClick={() => move(i, 1)} className="px-1 text-slate-400 hover:text-slate-800">
                    ↓
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => {
                  logEvent('rank_submit', { ranking });
                  decisionStart.current = Date.now();
                  setStep({ kind: 'decide', idx: 0 });
                  setPhase('decisions');
                }}
              >
                Confirm ranking
              </Button>
            </div>
          </Panel>
        )}

        {step.kind === 'decide' && current && (
          <Panel title={current.title}>
            <p className="mb-4 text-sm leading-relaxed text-slate-700">{current.prompt}</p>
            <div className="space-y-2">
              {current.options.map((o, i) => (
                <label key={i} className={`flex cursor-pointer gap-3 rounded border p-3 text-sm leading-relaxed ${pending === i ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
                  <input type="radio" name={current.id} checked={pending === i} onChange={() => (setPending(i), logEvent('answer_change', { field: current.id, value: i }))} className="mt-1" />
                  <span>{o.text}</span>
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <Button disabled={pending === null} onClick={() => setConfirm(true)}>
                Confirm decision
              </Button>
            </div>
          </Panel>
        )}

        {step.kind === 'outcome' && current && (
          <Panel title="What happened">
            <p className="text-sm leading-relaxed text-slate-700">{current.options[choices[step.idx]].outcome}</p>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => {
                  if (step.idx + 1 >= sc.decisions.length) submit(false);
                  else {
                    decisionStart.current = Date.now();
                    setStep({ kind: 'decide', idx: step.idx + 1 });
                  }
                }}
              >
                {step.idx + 1 >= sc.decisions.length ? 'Finish' : 'Next decision'}
              </Button>
            </div>
          </Panel>
        )}
      </div>

      <Modal
        open={confirm}
        title="Confirm this decision?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (step.kind !== 'decide' || !current || pending === null) return;
                const tag = current.options[pending].tag;
                const baseId = sc.decisions[step.idx] && 'variants' in sc.decisions[step.idx] ? '' : current.id;
                if (tag && baseId) setTags((t) => ({ ...t, [baseId]: tag }));
                setChoices((c) => [...c, pending]);
                setShown((s) => [...s, current]);
                setTimes((t) => [...t, Math.round((Date.now() - decisionStart.current) / 1000)]);
                logEvent('decision', { id: current.id, option: pending });
                setPending(null);
                setConfirm(false);
                setStep({ kind: 'outcome', idx: step.idx });
              }}
            >
              Confirm
            </Button>
          </>
        }
      >
        Decisions are final once confirmed.
      </Modal>
    </GameFrame>
  );
}

export function scoreClassic(sc: ClassicScenario, ranking: number[], shown: ClassicDecision[], choices: number[], times: number[], events: TelemetryEvent[], timedOut: boolean): GameResult {
  const n = sc.decisions.length;
  const rank = rankingScore(ranking, sc.idealRanking) * 100;
  const quality = (100 * shown.reduce((a, d, i) => a + d.options[choices[i]].q, 0)) / n;
  const consistency = shown.length ? 100 * mean(shown.map((d, i) => alignment(ranking, d, choices[i]))) : 0;
  const product = Math.round(0.2 * rank + 0.6 * quality + 0.2 * consistency);
  const pace = times.length ? mean(times.map((t) => budgetScore(t, CONFIG.sflClassic.perDecisionSec))) : 0;
  const total = times.reduce((a, b) => a + b, 0);
  const calm = calmness(events, durationOf(events) || 1).score;
  const completion = (100 * shown.length) / n;
  const process = Math.round(0.4 * completion + 0.4 * pace + 0.2 * calm);
  const dims = dimScores(shown, choices);
  const weakest = Object.entries(dims).sort((a, b) => a[1] - b[1])[0];
  let habit = `Your weakest dimension was ${weakest[0]} (${weakest[1]}). Look for the option that gathers just enough information, then commits.`;
  if (completion < 100) habit = `Pace: you finished ${shown.length}/${n} decisions. Budget ~90 seconds each.`;
  else if (rank < 75) habit = 'Ranking: re-read the mandate in the briefing — it tells you what the board cares about most.';
  else if (consistency < 60) habit = 'Consistency: your decisions often favoured priorities you ranked low. Let your ranking break ties.';
  return {
    game: 'sflClassic',
    product,
    process,
    score: combine(product, process),
    timeSpentSec: total,
    timedOut,
    habit,
    details: {
      mandate: sc.mandate,
      ranking: ranking.map((p) => PRIORITIES[p]),
      idealRanking: sc.idealRanking.map((p) => PRIORITIES[p]),
      metrics: { ranking: Math.round(rank), decisionQuality: Math.round(quality), consistency: Math.round(consistency), pace: Math.round(pace), completion: Math.round(completion) },
      dims,
      decisions: shown.map((d, i) => {
        const best = d.options.reduce((b, o, k) => (o.q > d.options[b].q ? k : b), 0);
        return { title: d.title, chosen: d.options[choices[i]].text, quality: d.options[choices[i]].q, best: d.options[best].text };
      }),
    },
  };
}
