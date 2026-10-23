import { useMemo, useRef, useState } from 'react';
import { CONFIG } from '../../config';
import { GameFrame } from '../../components/GameFrame';
import { mmss, useAutoSubmit, useGameClock } from '../../components/clock';
import { Button, Modal, Panel } from '../../components/ui';
import { logEvent, useSitting } from '../../store/sitting';
import {
  answerText,
  DAY_GOALS,
  GOAL_TEXT,
  generateIsland,
  LEVELS,
  questionsFor,
  REASONS,
  REFLECT_DIMS,
  reasonSupported,
  type Purchase,
  type QuestionKind,
  type Rating,
  type Reason,
} from './island';
import { scoreIsland, type IslandDay } from './islandScore';

type Stage = 'explore' | 'assign' | 'support' | 'reflect';
const STAGES: Stage[] = ['explore', 'assign', 'support', 'reflect'];
const STAGE_TEXT: Record<Stage, string> = {
  explore: 'Spend Explore Requests to ask researchers and workstations one question each. Answers go to your Notes.',
  assign: 'Move researchers from the lodge to workstations (max 2 each). Every move needs a reason backed by today’s answers.',
  support: 'Respond to requests from your team. Choose what best serves today’s goal and stays consistent with what you have said.',
  reflect: 'Rate each researcher based on the evidence you gathered today. Choose “I don’t know” if you have none.',
};

export function Island({ seed }: { seed: string }) {
  const sc = useMemo(() => generateIsland(seed), [seed]);
  const finishGame = useSitting((s) => s.finishGame);
  const setPhase = useSitting((s) => s.setPhase);
  const cfg = CONFIG.sflIsland;
  const { elapsed } = useGameClock();

  const [onboarding, setOnboarding] = useState(true);
  const [day, setDay] = useState(0);
  const [stage, setStageRaw] = useState<Stage>('explore');
  const [requestsLeft, setRequestsLeft] = useState(cfg.exploreRequests[0]);
  const [buys, setBuys] = useState<Purchase[]>([]);
  const [placement, setPlacement] = useState<(number | null)[]>(sc.researchers.map(() => null));
  const [reasons, setReasons] = useState<Record<number, Reason>>({});
  const [supportIdx, setSupportIdx] = useState(0);
  const [supportChoices, setSupportChoices] = useState<number[]>([]);
  const [pendingOpt, setPendingOpt] = useState<number | null>(null);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [days, setDays] = useState<IslandDay[]>([]);
  const [menu, setMenu] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<number | null>(null);
  const [night, setNight] = useState(false);
  const t0 = useRef(Date.now());
  const dayStart = useRef(Date.now());
  const onboardingSec = useRef(0);

  const goal = DAY_GOALS[day];
  const todayBuys = buys.filter((b) => b.day === day);
  const supportReqs = sc.support[day];

  const setStage = (s: Stage) => {
    setStageRaw(s);
    setPhase(`day${day + 1}-${s}`);
  };

  const snapshotDay = (): IslandDay => {
    const evidence: Record<string, boolean> = {};
    sc.researchers.forEach((r) => {
      const bought = todayBuys.some((b) => b.target === r.id && b.kind === 'feeling');
      const heard = supportReqs.slice(0, supportChoices.length).some((q) => q.from === r.id);
      evidence[r.id] = bought || heard;
    });
    return {
      day,
      placement,
      reasons: placement.flatMap((st, ri) => (st === null || !reasons[ri] ? [] : [{ researcher: ri, station: st, reason: reasons[ri], supported: reasonSupported(sc, day, buys, ri, st, reasons[ri]) }])),
      support: supportChoices,
      ratings,
      evidence,
      purchases: todayBuys,
      requestsAvailable: cfg.exploreRequests[day],
      seconds: Math.round((Date.now() - dayStart.current) / 1000),
    };
  };

  const submit = (timedOut: boolean, final: IslandDay[]) => {
    finishGame(scoreIsland(sc, final, useSitting.getState().sitting!.telemetry.filter((e) => e.game === 'sflIsland'), timedOut, onboardingSec.current));
  };
  useAutoSubmit(() => submit(true, onboarding || night ? days : [...days, snapshotDay()]));

  const buy = (target: string, kind: QuestionKind) => {
    const answer = answerText(sc, day, target, kind);
    setBuys((b) => [...b, { day, target, kind, answer }]);
    setRequestsLeft((n) => n - 1);
    logEvent('explore_purchase', { day, target, kind });
    setMenu(null);
  };

  const assign = (ri: number, station: number | null, reason: Reason | null) => {
    if (station !== null && placement.filter((p, i) => p === station && i !== ri).length >= cfg.stationCapacity) return;
    setPlacement((p) => p.map((x, i) => (i === ri ? station : x)));
    setReasons((r) => {
      const n = { ...r };
      if (reason && station !== null) n[ri] = reason;
      else delete n[ri];
      return n;
    });
    logEvent('assign', { day, researcher: ri, station, reason, supported: station !== null && reason ? reasonSupported(sc, day, buys, ri, station, reason) : false });
    setAssigning(null);
  };

  const finishDay = () => {
    const snap = snapshotDay();
    const all = [...days, snap];
    setDays(all);
    logEvent('day_complete', { day });
    if (day + 1 >= cfg.days) {
      submit(false, all);
      return;
    }
    setNight(true);
  };

  const startNextDay = () => {
    // Overnight reset: keep names, titles, station descriptions; clear answers, notes, placements, support.
    const d = day + 1;
    setDay(d);
    setRequestsLeft(cfg.exploreRequests[d]);
    setPlacement(sc.researchers.map(() => null));
    setReasons({});
    setSupportIdx(0);
    setSupportChoices([]);
    setRatings({});
    setNight(false);
    setStageRaw('explore');
    setPhase(`day${d + 1}-explore`);
    dayStart.current = Date.now();
  };

  if (onboarding) {
    return (
      <GameFrame subtitle="Onboarding">
        <div className="mx-auto max-w-3xl space-y-4">
          <Panel title="Welcome to the field station">
            <p className="text-sm leading-relaxed text-slate-700">
              You lead a small research team on {sc.island} for a three-day project. Each day has a goal. You will explore what people and workstations need, assign researchers, support your team, and reflect on how
              they feel. Explore Requests are limited and reset each morning; so do your notes and placements.
            </p>
            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              {DAY_GOALS.map((g, i) => (
                <li key={g}>
                  <span className="font-semibold">Day {i + 1}:</span> {GOAL_TEXT[g]} · {cfg.exploreRequests[i]} Explore Requests
                </li>
              ))}
            </ul>
          </Panel>
          <div className="grid grid-cols-2 gap-4">
            <Panel title="Your researchers">
              <ul className="space-y-2 text-sm">
                {sc.researchers.map((r) => (
                  <li key={r.id}>
                    <div className="font-semibold text-slate-700">
                      {r.name} <span className="font-normal text-slate-400">· {r.title}</span>
                    </div>
                    <div className="text-xs text-slate-500">{r.bio}</div>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Workstations">
              <ul className="space-y-2 text-sm">
                {sc.stations.map((s) => (
                  <li key={s.id}>
                    <div className="font-semibold text-slate-700">{s.name}</div>
                    <div className="text-xs text-slate-500">{s.description}</div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Suggested: ~{cfg.onboardingBudgetSec / 60} minutes on onboarding.</span>
            <Button
              onClick={() => {
                onboardingSec.current = Math.round((Date.now() - t0.current) / 1000);
                setOnboarding(false);
                setPhase('day1-explore');
                dayStart.current = Date.now();
              }}
            >
              Begin Day 1
            </Button>
          </div>
        </div>
      </GameFrame>
    );
  }

  const sidebar = (
    <div className="space-y-4">
      <div className="rounded-md bg-blue-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-blue-800">
          Day {day + 1} of {cfg.days} · Today’s goal
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
      <p className="text-xs leading-relaxed text-slate-500">{STAGE_TEXT[stage]}</p>
      {day === 0 && elapsed > cfg.day1WarnElapsedSec && <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">You are past {mmss(cfg.day1WarnElapsedSec)} on Day 1. Move on to keep time for Days 2 and 3.</div>}
    </div>
  );

  const notes = (
    <Panel title="Notes">
      {todayBuys.length === 0 && <p className="text-xs text-slate-400">Answers you buy today appear here. Notes clear overnight.</p>}
      <ul className="space-y-2 text-sm">
        {todayBuys.map((b, i) => {
          const who = sc.researchers.find((r) => r.id === b.target)?.name ?? sc.stations.find((s) => s.id === b.target)?.name;
          return (
            <li key={i} className="rounded bg-slate-50 p-2">
              <div className="text-xs font-semibold text-slate-600">{who}</div>
              <div className="text-slate-700">{b.answer}</div>
            </li>
          );
        })}
        {stage !== 'explore' &&
          supportReqs.slice(0, supportChoices.length).map((q) => (
            <li key={q.id} className="rounded bg-slate-50 p-2">
              <div className="text-xs font-semibold text-slate-600">{sc.researchers.find((r) => r.id === q.from)?.name} (said in Support)</div>
              <div className="text-slate-700">“{q.cue}”</div>
            </li>
          ))}
      </ul>
    </Panel>
  );

  const asked = (target: string) => todayBuys.some((b) => b.target === target);

  return (
    <GameFrame sidebar={sidebar} right={notes} subtitle={`${sc.island} · Day ${day + 1}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold capitalize text-slate-800">
          Day {day + 1} · {stage}
        </h2>
        <div className="rounded border border-slate-200 bg-white px-3 py-1 text-sm">
          Explore Requests: <span className="font-mono font-semibold">{requestsLeft}</span> / {cfg.exploreRequests[day]}
        </div>
      </div>

      {(stage === 'explore' || stage === 'assign') && (
        <IslandMap
          sc={sc}
          placement={placement}
          asked={asked}
          onResearcher={(ri) => (stage === 'explore' ? setMenu(sc.researchers[ri].id) : setAssigning(ri))}
          onStation={(si) => stage === 'explore' && setMenu(sc.stations[si].id)}
          reasons={reasons}
        />
      )}

      {stage === 'explore' && (
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setStage('assign')}>Done exploring → Assign</Button>
        </div>
      )}
      {stage === 'assign' && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-slate-500">Click a researcher to move them. Unplaced researchers stay at the lodge.</span>
          <Button onClick={() => setStage('support')}>Confirm assignments → Support</Button>
        </div>
      )}

      {stage === 'support' && supportIdx < supportReqs.length && (
        <Panel title={`Request ${supportIdx + 1} of ${supportReqs.length}`}>
          {(() => {
            const q = supportReqs[supportIdx];
            const who = sc.researchers.find((r) => r.id === q.from)!;
            return (
              <div>
                <div className="mb-1 text-sm font-semibold text-slate-700">{who.name}</div>
                <p className="mb-4 text-sm text-slate-700">
                  “{q.cue} {q.text}”
                </p>
                <div className="space-y-2">
                  {q.options.map((o, i) => (
                    <label key={i} className={`flex cursor-pointer gap-3 rounded border p-3 text-sm ${pendingOpt === i ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
                      <input type="radio" name={q.id} checked={pendingOpt === i} onChange={() => setPendingOpt(i)} className="mt-1" />
                      <span>{o.text}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    disabled={pendingOpt === null}
                    onClick={() => {
                      logEvent('support_choice', { day, request: q.id, option: pendingOpt, serves: q.options[pendingOpt!].serves });
                      const next = [...supportChoices, pendingOpt!];
                      setSupportChoices(next);
                      setPendingOpt(null);
                      if (next.length >= supportReqs.length) setStage('reflect');
                      else setSupportIdx(supportIdx + 1);
                    }}
                  >
                    Confirm response
                  </Button>
                </div>
              </div>
            );
          })()}
        </Panel>
      )}

      {stage === 'reflect' && (
        <Panel title={REFLECT_DIMS[day]}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-2">Researcher</th>
                {[...LEVELS, 'unknown'].map((l) => (
                  <th key={l} className="py-2 text-center font-medium capitalize">
                    {l === 'unknown' ? 'I don’t know' : l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sc.researchers.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="py-2">{r.name}</td>
                  {([...LEVELS, 'unknown'] as Rating[]).map((l) => (
                    <td key={l} className="text-center">
                      <input
                        type="radio"
                        aria-label={`${r.name} ${l}`}
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
            <Button disabled={sc.researchers.some((r) => !ratings[r.id])} onClick={finishDay}>
              {day + 1 >= cfg.days ? 'Finish project' : `End Day ${day + 1}`}
            </Button>
          </div>
        </Panel>
      )}

      {menu && (
        <ExploreMenu
          title={sc.researchers.find((r) => r.id === menu)?.name ?? sc.stations.find((s) => s.id === menu)!.name}
          questions={questionsFor(!!sc.researchers.find((r) => r.id === menu), day)}
          disabled={requestsLeft <= 0 || asked(menu)}
          reasonDisabled={requestsLeft <= 0 ? 'No Explore Requests left today.' : asked(menu) ? 'You have already asked here today.' : null}
          onAsk={(k) => buy(menu, k)}
          onCancel={() => setMenu(null)}
        />
      )}

      {assigning !== null && (
        <AssignDialog
          name={sc.researchers[assigning].name}
          stations={sc.stations.map((s, si) => ({ name: s.name, full: placement.filter((p, i) => p === si && i !== assigning).length >= cfg.stationCapacity }))}
          current={placement[assigning]}
          onAssign={(st, reason) => assign(assigning, st, reason)}
          onCancel={() => setAssigning(null)}
        />
      )}

      <Modal open={night} title={`Night falls on Day ${day + 1}`} actions={<Button onClick={startNextDay}>Begin Day {day + 2}</Button>}>
        <p>The team heads back to the lodge. Overnight, your notes, answers, placements and support conversations are cleared.</p>
        <p className="mt-2">
          Tomorrow’s goal: <span className="font-semibold">{GOAL_TEXT[DAY_GOALS[day + 1] ?? 'balance']}</span>. You will have {cfg.exploreRequests[day + 1]} Explore Requests.
        </p>
      </Modal>
    </GameFrame>
  );
}

function IslandMap({
  sc,
  placement,
  asked,
  onResearcher,
  onStation,
  reasons,
}: {
  sc: ReturnType<typeof generateIsland>;
  placement: (number | null)[];
  asked: (id: string) => boolean;
  onResearcher: (ri: number) => void;
  onStation: (si: number) => void;
  reasons: Record<number, Reason>;
}) {
  const person = (ri: number) => {
    const r = sc.researchers[ri];
    const initials = r.name
      .split(' ')
      .map((p) => p[0])
      .join('');
    return (
      <button key={r.id} onClick={() => onResearcher(ri)} title={`${r.name} · ${r.title}`} className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-white py-0.5 pl-0.5 pr-2 text-xs shadow-sm hover:border-blue-500">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ${asked(r.id) ? 'bg-blue-700' : 'bg-slate-500'}`}>{initials}</span>
        {r.name.split(' ')[0]}
        {reasons[ri] && <span className="text-slate-400">· {REASONS.find((x) => x.id === reasons[ri])?.label.split(' ')[0]}</span>}
      </button>
    );
  };
  return (
    <div className="relative h-[460px] overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br from-sky-100 to-sky-50">
      <div className="absolute inset-[8%] rounded-[45%] bg-emerald-50 ring-1 ring-emerald-200" />
      <div className="absolute left-1/2 top-1/2 w-56 -translate-x-1/2 -translate-y-1/2 rounded-md border border-amber-200 bg-amber-50 p-2 text-center">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">Lodge</div>
        <div className="flex flex-wrap justify-center gap-1">{sc.researchers.map((_, ri) => (placement[ri] === null ? person(ri) : null))}</div>
      </div>
      {sc.stations.map((s, si) => (
        <div key={s.id} className="absolute w-52 -translate-x-1/2 -translate-y-1/2" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
          <button onClick={() => onStation(si)} className={`w-full rounded-t-md border px-2 py-1 text-left text-sm font-semibold ${asked(s.id) ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-slate-300 bg-white text-slate-700'} hover:border-blue-500`}>
            {s.name}
          </button>
          <div className="flex min-h-[40px] flex-wrap gap-1 rounded-b-md border border-t-0 border-slate-300 bg-white/80 p-1.5">{sc.researchers.map((_, ri) => (placement[ri] === si ? person(ri) : null))}</div>
        </div>
      ))}
    </div>
  );
}

function ExploreMenu({ title, questions, disabled, reasonDisabled, onAsk, onCancel }: { title: string; questions: { kind: QuestionKind; text: string }[]; disabled: boolean; reasonDisabled: string | null; onAsk: (k: QuestionKind) => void; onCancel: () => void }) {
  return (
    <Modal open title={`Ask ${title}`} actions={<Button variant="secondary" onClick={onCancel}>Cancel (free)</Button>}>
      <p className="mb-3 text-xs text-slate-500">Each question costs one Explore Request. One question per person or workstation per day.</p>
      {reasonDisabled && <p className="mb-2 text-xs text-amber-700">{reasonDisabled}</p>}
      <div className="space-y-2">
        {questions.map((q) => (
          <button key={q.kind} disabled={disabled} onClick={() => onAsk(q.kind)} className="block w-full rounded border border-slate-200 px-3 py-2 text-left text-sm hover:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
            {q.text}
          </button>
        ))}
      </div>
    </Modal>
  );
}

function AssignDialog({ name, stations, current, onAssign, onCancel }: { name: string; stations: { name: string; full: boolean }[]; current: number | null; onAssign: (s: number | null, r: Reason | null) => void; onCancel: () => void }) {
  const [st, setSt] = useState<number | null>(current);
  const [reason, setReason] = useState<Reason | null>(null);
  return (
    <Modal
      open
      title={`Move ${name}`}
      actions={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          {current !== null && (
            <Button variant="secondary" onClick={() => onAssign(null, null)}>
              Return to lodge
            </Button>
          )}
          <Button disabled={st === null || !reason} onClick={() => onAssign(st, reason)}>
            Move
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workstation</span>
          <select className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" value={st ?? ''} onChange={(e) => setSt(e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">Choose…</option>
            {stations.map((s, i) => (
              <option key={s.name} value={i} disabled={s.full}>
                {s.name}
                {s.full ? ' (full)' : ''}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</legend>
          <div className="mt-1 space-y-1">
            {REASONS.map((r) => (
              <label key={r.id} className="flex items-center gap-2">
                <input type="radio" name="reason" checked={reason === r.id} onChange={() => setReason(r.id)} />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="text-xs text-slate-400">A reason counts only if an answer you bought today supports it.</p>
      </div>
    </Modal>
  );
}

