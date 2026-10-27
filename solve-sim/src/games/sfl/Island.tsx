import { useMemo, useRef, useState } from 'react';
import { CONFIG } from '../../config';
import { GameFrame } from '../../components/GameFrame';
import { mmss, useAutoSubmit, useGameClock } from '../../components/clock';
import { Button, Modal, Panel, Pill } from '../../components/ui';
import { makeRng } from '../../lib/rng';
import { logEvent, useSitting } from '../../store/sitting';
import {
  answerText,
  applyArchetype,
  ARCHETYPE_TEXT,
  clampState,
  consequenceText,
  DAY_GOALS,
  first,
  generateIsland,
  GOAL_TEXT,
  moveDelta,
  questionText,
  ratingText,
  reactionText,
  REASONS,
  reasonSupported,
  relevantKinds,
  type Archetype,
  type IslandScenario,
  type Purchase,
  type QuestionKind,
  type Rating,
  type Reason,
  type State,
} from './island';
import { scoreIsland, type DayRecord } from './islandScore';

type Stage = 'explore' | 'assign' | 'support' | 'reflect';
const STAGES: Stage[] = ['explore', 'assign', 'support', 'reflect'];
const STAGE_HELP: Record<Stage, string> = {
  explore: 'Spend all of today’s requests. Each person or station offers two questions; each answers one question a day.',
  assign: 'Move people only when you have a reason your notes back up. A station can be empty or hold two. Placements carry over to tomorrow.',
  support: 'Several problems have arrived. Choose the order (deadlines first), then respond to each. Read every consequence.',
  reflect: 'Say how each person ended the day, from what you saw. “I don’t know” is valid when you saw nothing.',
};

interface Note {
  day: number;
  who: string;
  text: string;
  source: 'answer' | 'reaction' | 'consequence';
}

export function Island({ seed, learning }: { seed: string; learning: boolean }) {
  const sc = useMemo(() => generateIsland(seed), [seed]);
  const finishGame = useSitting((s) => s.finishGame);
  const setPhase = useSitting((s) => s.setPhase);
  const cfg = CONFIG.sflIsland;
  const { elapsed } = useGameClock();
  const rng = useMemo(() => makeRng(`${seed}::sfl-ui`), [seed]);

  const [opening, setOpening] = useState<string[]>(() => sc.opening.map((q) => q.id));
  const [openingDone, setOpeningDone] = useState<string[] | null>(null);
  const [started, setStarted] = useState(false);
  const [day, setDay] = useState(0);
  const [stage, setStageRaw] = useState<Stage>('explore');
  const [requestsLeft, setRequestsLeft] = useState(cfg.exploreRequests[0]);
  const [buys, setBuys] = useState<Purchase[]>([]);
  const [placement, setPlacement] = useState<number[]>(() => sc.researchers.map((r) => r.home));
  const [states, setStates] = useState<State[]>(() => sc.researchers.map((r) => r.morning0));
  const [observed, setObserved] = useState<Record<string, State>>({});
  const [notes, setNotes] = useState<Note[]>([]);
  const [moves, setMoves] = useState<DayRecord['moves']>([]);
  const [order, setOrder] = useState<string[]>(() => sc.problems[0].map((p) => p.id));
  const [orderLocked, setOrderLocked] = useState(false);
  const [choices, setChoices] = useState<Record<string, Archetype>>({});
  const [pendingOpt, setPendingOpt] = useState<number | null>(null);
  const [consequence, setConsequence] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [menu, setMenu] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<number | null>(null);
  const [hint, setHint] = useState<{ title: string; lines: string[]; then: () => void } | null>(null);
  const [night, setNight] = useState(false);
  const t0 = useRef(Date.now());
  const dayStart = useRef(Date.now());
  const openingSec = useRef(0);

  const R = sc.researchers;
  const S = sc.stations;
  const goal = DAY_GOALS[day];
  const todayBuys = buys.filter((b) => b.day === day);
  const probs = sc.problems[day];
  const nameOf = (id: string) => R.find((r) => r.id === id)?.name ?? S.find((s) => s.id === id)?.name ?? id;

  const setStage = (s: Stage) => {
    setStageRaw(s);
    setPhase(`day${day + 1}-${s}`);
  };
  /** In learning mode, show a review before moving on; otherwise go straight on. */
  const review = (title: string, lines: string[], then: () => void) => (learning ? setHint({ title, lines, then }) : then());

  const record = (): DayRecord => ({
    day,
    purchases: todayBuys,
    moves,
    placement,
    order: orderLocked ? order : [],
    choices,
    ratings,
    expected: Object.fromEntries(R.map((r) => [r.id, observed[r.id] ?? 'unknown'])),
    requestsAvailable: cfg.exploreRequests[day],
    seconds: Math.round((Date.now() - dayStart.current) / 1000),
  });

  const submit = (timedOut: boolean, all: DayRecord[]) =>
    finishGame(scoreIsland(sc, openingDone, all, useSitting.getState().sitting!.telemetry.filter((e) => e.game === 'sflIsland'), timedOut, openingSec.current));
  useAutoSubmit(() => submit(true, !started || night ? records : [...records, record()]));

  // ---------------------------------------------------------------- actions

  const buy = (target: string, kind: QuestionKind) => {
    const ri = R.findIndex((r) => r.id === target);
    const answer = answerText(sc, day, target, kind, ri >= 0 ? states[ri] : undefined, rng);
    setBuys((b) => [...b, { day, target, kind, answer }]);
    setNotes((n) => [...n, { day, who: nameOf(target), text: answer, source: 'answer' }]);
    if (kind === 'mood' && ri >= 0) setObserved((o) => ({ ...o, [target]: states[ri] }));
    setRequestsLeft((x) => x - 1);
    logEvent('explore_purchase', { day, target, kind });
    setMenu(null);
  };

  const move = (ri: number, to: number, reason: Reason) => {
    const from = placement[ri];
    if (to === from) return setAssigning(null);
    if (placement.filter((p, i) => p === to && i !== ri).length >= cfg.stationCapacity) return;
    const r = R[ri];
    const delta = moveDelta(r, from, to);
    const after = clampState(states[ri] + delta);
    const supported = reasonSupported(sc, day, buys, ri, to, reason);
    setPlacement((p) => p.map((x, i) => (i === ri ? to : x)));
    setStates((s) => s.map((x, i) => (i === ri ? after : x)));
    setObserved((o) => ({ ...o, [r.id]: after }));
    setNotes((n) => [...n, { day, who: r.name, text: reactionText(to, after, sc, delta), source: 'reaction' }]);
    setMoves((m) => [...m, { researcher: ri, from, to, reason, supported }]);
    logEvent('assign', { day, researcher: ri, from, to, reason, supported });
    setAssigning(null);
  };

  const respond = () => {
    const p = probs.find((x) => x.id === order[Object.keys(choices).length])!;
    const a = p.options[pendingOpt!].archetype;
    const after = applyArchetype(states[p.from], a);
    setStates((s) => s.map((x, i) => (i === p.from ? after : x)));
    setObserved((o) => ({ ...o, [R[p.from].id]: after }));
    const text = consequenceText(sc, p, a, after);
    setNotes((n) => [...n, { day, who: R[p.from].name, text, source: 'consequence' }]);
    setChoices((c) => ({ ...c, [p.id]: a }));
    setConsequence(text);
    setPendingOpt(null);
    logEvent('support_choice', { day, problem: p.id, archetype: a });
  };

  const endDay = () => {
    const rec = record();
    const all = [...records, rec];
    setRecords(all);
    logEvent('day_complete', { day });
    const expected = rec.expected;
    review(
      `Day ${day + 1} · Reflect review`,
      R.map((r) => `${r.name}: you said ${ratingText(ratings[r.id])}; from what you saw, the right answer was ${ratingText(expected[r.id])}${expected[r.id] === 'unknown' ? ' (nothing observed today)' : ''}.`),
      () => (day + 1 >= cfg.days ? submit(false, all) : setNight(true)),
    );
  };

  const startNextDay = () => {
    const d = day + 1;
    // Overnight: placements and notes carry over; each person's morning follows from how they ended the day.
    setStates((s) => s.map((x, i) => clampState(x + R[i].drift[d])));
    setDay(d);
    setRequestsLeft(cfg.exploreRequests[d]);
    setObserved({});
    setMoves([]);
    setOrder(sc.problems[d].map((p) => p.id));
    setOrderLocked(false);
    setChoices({});
    setRatings({});
    setConsequence(null);
    setNight(false);
    setStageRaw('explore');
    setPhase(`day${d + 1}-explore`);
    dayStart.current = Date.now();
  };

  // ---------------------------------------------------------------- opening exercise

  if (!started) {
    const moveQ = (i: number, d: number) => {
      const j = i + d;
      if (j < 0 || j >= opening.length || openingDone) return;
      const o = opening.slice();
      [o[i], o[j]] = [o[j], o[i]];
      setOpening(o);
    };
    return (
      <GameFrame subtitle="Before Day 1">
        <div className="mx-auto max-w-3xl space-y-4">
          <Panel title="Opening: what would you ask first?">
            <p className="mb-3 text-sm text-slate-600">
              You are taking over an environmental research team on {sc.island} for three days. Rank the questions you would ask the team, most important first. Then read the answers — they are your context for the whole game.
            </p>
            <ol className="space-y-2">
              {opening.map((id, i) => {
                const q = sc.opening.find((x) => x.id === id)!;
                return (
                  <li
                    key={id}
                    draggable={!openingDone}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', String(i))}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      if (openingDone) return;
                      const from = Number(e.dataTransfer.getData('text/plain'));
                      const o = opening.slice();
                      const [x] = o.splice(from, 1);
                      o.splice(i, 0, x);
                      setOpening(o);
                    }}
                    className={`rounded border border-slate-200 bg-white px-3 py-2 text-sm ${openingDone ? '' : 'cursor-grab'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 font-mono text-slate-400">{i + 1}</span>
                      <span className="flex-1 font-medium">{q.text}</span>
                      {!openingDone && (
                        <>
                          <button aria-label={`Move up: ${q.text}`} onClick={() => moveQ(i, -1)} className="px-1 text-slate-400 hover:text-slate-800">
                            ↑
                          </button>
                          <button aria-label={`Move down: ${q.text}`} onClick={() => moveQ(i, 1)} className="px-1 text-slate-400 hover:text-slate-800">
                            ↓
                          </button>
                        </>
                      )}
                    </div>
                    {openingDone && <p className="mt-1 pl-8 text-slate-600">{q.answer}</p>}
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 flex justify-end">
              {!openingDone ? (
                <Button
                  onClick={() => {
                    setOpeningDone(opening);
                    logEvent('opening_rank', { order: opening });
                  }}
                >
                  Ask in this order
                </Button>
              ) : (
                <Button
                  onClick={() =>
                    review(
                      'Opening review',
                      [
                        `Strongest order: ${sc.openingIdeal.map((id) => `“${sc.opening.find((q) => q.id === id)!.text}”`).join(' → ')}.`,
                        'Deliverable and deadline first, then who is who, what each station does, and the rules you work under. Budget and lodging change nothing.',
                        'Note who is experienced where: that is where everyone starts on Day 1.',
                      ],
                      () => {
                        openingSec.current = Math.round((Date.now() - t0.current) / 1000);
                        setStarted(true);
                        setPhase('day1-explore');
                        dayStart.current = Date.now();
                      },
                    )
                  }
                >
                  Begin Day 1
                </Button>
              )}
            </div>
          </Panel>
        </div>
        <HintModal hint={hint} close={() => setHint(null)} />
      </GameFrame>
    );
  }

  // ---------------------------------------------------------------- day screens

  const sidebar = (
    <div className="space-y-4">
      <div className="rounded-md bg-blue-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-blue-800">
          Day {day + 1} of {cfg.days} · Goal
        </div>
        <p className="mt-1 text-sm font-medium text-slate-700">{GOAL_TEXT[goal]}</p>
      </div>
      <ol className="space-y-1 text-sm">
        {STAGES.map((s, i) => (
          <li key={s} className={`rounded px-3 py-1.5 capitalize ${s === stage ? 'bg-blue-50 font-semibold text-blue-800' : STAGES.indexOf(stage) > i ? 'text-slate-400 line-through' : 'text-slate-500'}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      <p className="text-xs leading-relaxed text-slate-500">{STAGE_HELP[stage]}</p>
      {learning && <Pill tone="amber">Learning mode: review after each stage</Pill>}
      {day === 0 && elapsed > cfg.day1WarnElapsedSec && (
        <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">Past {mmss(cfg.day1WarnElapsedSec)} and still on Day 1 — you are using Day 3’s time.</div>
      )}
    </div>
  );

  const notesPanel = (
    <Panel title="Notes">
      {notes.length === 0 && <p className="text-xs text-slate-400">What people and stations tell you appears here, with each reaction and consequence.</p>}
      <div className="space-y-3">
        {[...new Set(notes.map((n) => n.day))]
          .sort((a, b) => b - a)
          .map((d) => (
            <div key={d}>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Day {d + 1}</div>
              <ul className="space-y-1.5 text-sm">
                {notes
                  .filter((n) => n.day === d)
                  .map((n, i) => (
                    <li key={i} className={`rounded p-2 ${d === day ? 'bg-slate-50' : 'bg-slate-50/50 text-slate-500'}`}>
                      <div className="text-xs font-semibold text-slate-600">
                        {n.who} <span className="font-normal text-slate-400">· {n.source === 'answer' ? 'answered' : n.source === 'reaction' ? 'on being moved' : 'after support'}</span>
                      </div>
                      {n.text}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
      </div>
    </Panel>
  );

  const askedToday = (id: string) => todayBuys.some((b) => b.target === id);
  const currentProblem = orderLocked ? probs.find((p) => p.id === order[Object.keys(choices).length]) : undefined;

  return (
    <GameFrame sidebar={sidebar} right={notesPanel} subtitle={`${sc.island} · Day ${day + 1}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold capitalize text-slate-800">
          Day {day + 1} · {stage}
        </h2>
        <div className="rounded border border-slate-200 bg-white px-3 py-1 text-sm">
          Requests: <span className="font-mono font-semibold">{requestsLeft}</span> / {cfg.exploreRequests[day]}
        </div>
      </div>

      {(stage === 'explore' || stage === 'assign') && (
        <TeamMap
          sc={sc}
          placement={placement}
          day={day}
          asked={askedToday}
          onPerson={(ri) => (stage === 'explore' ? setMenu(R[ri].id) : setAssigning(ri))}
          onStation={(si) => stage === 'explore' && setMenu(S[si].id)}
        />
      )}

      {stage === 'explore' && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-slate-500">{requestsLeft > 0 ? `Use all ${requestsLeft} remaining request${requestsLeft > 1 ? 's' : ''} before assigning.` : 'All requests used.'}</span>
          <Button
            disabled={requestsLeft > 0}
            onClick={() => {
              const rel = relevantKinds(day);
              review(
                `Day ${day + 1} · Explore review`,
                [
                  `Today’s goal: ${GOAL_TEXT[goal]}. Most useful: ${goal === 'people' ? 'where people contribute most, and how they are doing' : goal === 'stations' ? 'what stations need and what could go wrong' : 'a mix — people’s strengths and stations’ needs'}.`,
                  ...todayBuys.map((b) => `${rel.includes(b.kind) || b.kind === 'mood' ? '✓' : '✗'} ${nameOf(b.target)}: “${questionText(b.kind)}”`),
                  ...(todayBuys.some((b) => b.kind === 'mood') ? [] : ['You didn’t ask anyone how they were doing — Reflect will be guesswork.']),
                ],
                () => setStage('assign'),
              );
            }}
          >
            Done exploring → Assign
          </Button>
        </div>
      )}
      {stage === 'assign' && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-slate-500">Click a person to move them. Leave people in place unless you have a reason.</span>
          <Button
            onClick={() => {
              const bp = sc.bestPlacement[day];
              review(
                `Day ${day + 1} · Assign review`,
                [
                  `Suggested placement for today’s goal: ${R.map((r, i) => `${first(r.name)} → ${S[bp.placement[i]].name}`).join(', ')}.`,
                  ...(moves.length
                    ? moves.map((m) => `${m.supported ? '✓' : '✗'} ${first(R[m.researcher].name)} → ${S[m.to].name} for “${REASONS.find((x) => x.id === m.reason)!.label}”${m.supported ? '' : ` — needs ${REASONS.find((x) => x.id === m.reason)!.needs}`}`)
                    : ['You made no moves today.']),
                ],
                () => setStage('support'),
              );
            }}
          >
            Confirm assignments → Support
          </Button>
        </div>
      )}

      {stage === 'support' && !orderLocked && (
        <Panel title="Problems arriving now — choose the order to handle them">
          <ol className="space-y-2">
            {order.map((id, i) => {
              const p = probs.find((x) => x.id === id)!;
              return (
                <li key={id} className="flex items-center gap-3 rounded border border-slate-200 bg-white p-3 text-sm">
                  <span className="w-5 font-mono text-slate-400">{i + 1}</span>
                  <div className="flex-1">
                    <div className="font-semibold">
                      {R[p.from].name} <span className="font-normal text-slate-500">· due {p.deadline}</span>
                    </div>
                    <div className="text-slate-600">{p.text}</div>
                  </div>
                  <button aria-label="Move up" className="px-1 text-slate-400 hover:text-slate-800" onClick={() => i > 0 && setOrder(swap(order, i, i - 1))}>
                    ↑
                  </button>
                  <button aria-label="Move down" className="px-1 text-slate-400 hover:text-slate-800" onClick={() => i < order.length - 1 && setOrder(swap(order, i, i + 1))}>
                    ↓
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => {
                setOrderLocked(true);
                logEvent('support_order', { day, order });
              }}
            >
              Handle in this order
            </Button>
          </div>
        </Panel>
      )}

      {stage === 'support' && orderLocked && currentProblem && !consequence && (
        <Panel title={`Problem ${Object.keys(choices).length + 1} of ${probs.length} · due ${currentProblem.deadline}`}>
          <div className="mb-1 text-sm font-semibold">{R[currentProblem.from].name}</div>
          <p className="mb-4 text-sm">“{currentProblem.text}”</p>
          <div className="space-y-2">
            {currentProblem.options.map((o, i) => (
              <label key={i} className={`flex cursor-pointer gap-3 rounded border p-3 text-sm ${pendingOpt === i ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
                <input type="radio" name={currentProblem.id} checked={pendingOpt === i} onChange={() => setPendingOpt(i)} className="mt-1" />
                <span>{o.text}</span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button disabled={pendingOpt === null} onClick={respond}>
              Respond
            </Button>
          </div>
        </Panel>
      )}

      {stage === 'support' && consequence && (
        <Panel title="What happened">
          <p className="text-sm">{consequence}</p>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => {
                setConsequence(null);
                if (Object.keys(choices).length >= probs.length) {
                  const ideal = [...probs].sort((a, b) => a.deadlineRank - b.deadlineRank);
                  review(
                    `Day ${day + 1} · Support review`,
                    [
                      `Deadline order: ${ideal.map((p) => `${first(R[p.from].name)} (${p.deadline})`).join(' → ')}. ${order.join() === ideal.map((p) => p.id).join() ? '✓ You matched it.' : '✗ Yours differed.'}`,
                      ...probs.map((p) => {
                        const best = p.options.find((o) => o.archetype === 'middle')!;
                        const mine = choices[p.id];
                        return `${mine === 'middle' ? '✓' : '✗'} ${first(R[p.from].name)}: strongest — “${best.text}”${mine !== 'middle' ? ` Yours: ${ARCHETYPE_TEXT[mine].split(' — ')[0].toLowerCase()}.` : ''}`;
                      }),
                    ],
                    () => setStage('reflect'),
                  );
                }
              }}
            >
              {Object.keys(choices).length >= probs.length ? 'Continue to Reflect' : 'Next problem'}
            </Button>
          </div>
        </Panel>
      )}

      {stage === 'reflect' && (
        <Panel title="How did each person end the day?">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-2">Researcher</th>
                {([0, 1, 2, 'unknown'] as Rating[]).map((l) => (
                  <th key={String(l)} className="py-2 text-center font-medium">
                    {ratingText(l)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {R.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="py-2">
                    {r.name} <span className="text-xs text-slate-400">· {r.role}</span>
                  </td>
                  {([0, 1, 2, 'unknown'] as Rating[]).map((l) => (
                    <td key={String(l)} className="text-center">
                      <input
                        type="radio"
                        aria-label={`${r.name} ${ratingText(l)}`}
                        name={`rate-${r.id}`}
                        checked={ratings[r.id] === l}
                        onChange={() => {
                          setRatings((x) => ({ ...x, [r.id]: l }));
                          logEvent('answer_change', { field: `reflect-${day}-${r.id}`, value: l });
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end">
            <Button disabled={R.some((r) => ratings[r.id] === undefined)} onClick={endDay}>
              {day + 1 >= cfg.days ? 'Finish the project' : `End Day ${day + 1}`}
            </Button>
          </div>
        </Panel>
      )}

      {menu && (
        <ExploreMenu
          sc={sc}
          id={menu}
          day={day}
          askedToday={askedToday(menu)}
          noRequests={requestsLeft <= 0}
          onAsk={(k) => buy(menu, k)}
          onCancel={() => setMenu(null)}
        />
      )}
      {assigning !== null && (
        <AssignDialog sc={sc} ri={assigning} placement={placement} onMove={(to, reason) => move(assigning, to, reason)} onCancel={() => setAssigning(null)} />
      )}
      <Modal open={night} title={`End of Day ${day + 1}`} actions={<Button onClick={startNextDay}>Begin Day {day + 2}</Button>}>
        <p>Everyone stays where you left them. Your notes carry over; what happened today is the context for tomorrow.</p>
        <p className="mt-2">
          Tomorrow’s goal: <span className="font-semibold">{GOAL_TEXT[DAY_GOALS[day + 1] ?? 'balance']}</span>. You will have {cfg.exploreRequests[day + 1]} requests.
        </p>
      </Modal>
      <HintModal hint={hint} close={() => setHint(null)} />
    </GameFrame>
  );
}

const swap = <T,>(a: T[], i: number, j: number) => {
  const b = a.slice();
  [b[i], b[j]] = [b[j], b[i]];
  return b;
};

function HintModal({ hint, close }: { hint: { title: string; lines: string[]; then: () => void } | null; close: () => void }) {
  if (!hint) return null;
  return (
    <Modal
      open
      title={hint.title}
      actions={
        <Button
          onClick={() => {
            close();
            hint.then();
          }}
        >
          Continue
        </Button>
      }
    >
      <ul className="max-h-[60vh] list-disc space-y-1.5 overflow-y-auto pl-5">
        {hint.lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </Modal>
  );
}

function TeamMap({ sc, placement, day, asked, onPerson, onStation }: { sc: IslandScenario; placement: number[]; day: number; asked: (id: string) => boolean; onPerson: (ri: number) => void; onStation: (si: number) => void }) {
  const POS = [
    { x: 24, y: 26 },
    { x: 76, y: 26 },
    { x: 24, y: 74 },
    { x: 76, y: 74 },
  ];
  return (
    <div className="relative h-[440px] overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br from-sky-100 to-sky-50">
      <div className="absolute inset-[7%] rounded-[45%] bg-emerald-50 ring-1 ring-emerald-200" />
      {sc.stations.map((s, si) => (
        <div key={s.id} className="absolute w-60 -translate-x-1/2 -translate-y-1/2" style={{ left: `${POS[si].x}%`, top: `${POS[si].y}%` }}>
          <button
            onClick={() => onStation(si)}
            className={`w-full rounded-t-md border px-2 py-1 text-left text-sm font-semibold ${asked(s.id) ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-slate-300 bg-white text-slate-700'} hover:border-blue-500`}
          >
            {s.name}
          </button>
          <div className="flex min-h-[44px] flex-wrap gap-1 rounded-b-md border border-t-0 border-slate-300 bg-white/85 p-1.5">
            {sc.researchers.map((r, ri) =>
              placement[ri] === si ? (
                <button
                  key={r.id}
                  onClick={() => onPerson(ri)}
                  title={`${r.name} · ${r.role}`}
                  className={`flex items-center gap-1.5 rounded-full border bg-white py-0.5 pl-0.5 pr-2 text-xs shadow-sm hover:border-blue-500 ${r.unavailable === day ? 'border-dashed border-slate-300 text-slate-400' : 'border-slate-300'}`}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ${asked(r.id) ? 'bg-blue-700' : 'bg-slate-500'}`}>
                    {r.name
                      .split(' ')
                      .map((x) => x[0])
                      .join('')}
                  </span>
                  {first(r.name)} <span className="text-slate-400">· {r.role}</span>
                </button>
              ) : null,
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ExploreMenu({ sc, id, day, askedToday, noRequests, onAsk, onCancel }: { sc: IslandScenario; id: string; day: number; askedToday: boolean; noRequests: boolean; onAsk: (k: QuestionKind) => void; onCancel: () => void }) {
  const r = sc.researchers.find((x) => x.id === id);
  const s = sc.stations.find((x) => x.id === id);
  const kinds = sc.offers[day][id];
  const blocked = r?.unavailable === day ? `${r.name} is out at the field site today and can’t be asked.` : askedToday ? 'Already asked today — one question per person or station per day.' : noRequests ? 'No requests left today.' : null;
  return (
    <Modal open title={r ? `${r.name} · ${r.role}` : s!.name} actions={<Button variant="secondary" onClick={onCancel}>Cancel (free)</Button>}>
      {s && <p className="mb-2 text-xs text-slate-500">{s.description}</p>}
      {blocked && <p className="mb-2 text-xs text-amber-700">{blocked}</p>}
      <div className="space-y-2">
        {kinds.map((k) => (
          <button key={k} disabled={!!blocked} onClick={() => onAsk(k)} className="block w-full rounded border border-slate-200 px-3 py-2 text-left text-sm hover:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
            {questionText(k)}
            <span className="ml-2 text-xs text-slate-400">{k === 'strength' || k === 'mood' ? 'about the person' : 'about the work'}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function AssignDialog({ sc, ri, placement, onMove, onCancel }: { sc: IslandScenario; ri: number; placement: number[]; onMove: (to: number, reason: Reason) => void; onCancel: () => void }) {
  const r = sc.researchers[ri];
  const [to, setTo] = useState<number | null>(null);
  const [reason, setReason] = useState<Reason | null>(null);
  const full = (si: number) => placement.filter((p, i) => p === si && i !== ri).length >= CONFIG.sflIsland.stationCapacity;
  return (
    <Modal
      open
      title={`Move ${r.name} (${r.role})`}
      actions={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Leave in place
          </Button>
          <Button disabled={to === null || !reason} onClick={() => onMove(to!, reason!)}>
            Move
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-slate-500">Currently at the {sc.stations[placement[ri]].name}.</p>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Station</span>
        <select className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" value={to ?? ''} onChange={(e) => setTo(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">Choose…</option>
          {sc.stations.map((s, si) => (
            <option key={s.id} value={si} disabled={si === placement[ri] || full(si)}>
              {s.name}
              {si === placement[ri] ? ' (current)' : full(si) ? ' (full)' : ''}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="mt-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</legend>
        <div className="mt-1 space-y-1">
          {REASONS.map((x) => (
            <label key={x.id} className="flex items-center gap-2">
              <input type="radio" name="reason" checked={reason === x.id} onChange={() => setReason(x.id)} />
              {x.label}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-2 text-xs text-slate-400">Pick the reason your notes actually support.</p>
    </Modal>
  );
}

