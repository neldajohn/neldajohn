import { CONFIG } from '../../config';
import { budgetScore, calmness, combine, flipFlops, pct } from '../../lib/scoring';
import type { GameResult, TelemetryEvent } from '../../lib/types';
import { checkNumeric, factLabel, type Case, type ChartType, type Study } from './model';

export interface RedRockState {
  answers: Record<string, string>;
  blanks: Record<string, string>;
  chartType: ChartType | null;
  chartValues: string[];
  caseAnswers: string[];
  casesReached: number;
  studySec: number;
  casesSec: number;
}

export const num = (s: string | undefined) => (s === undefined || s.trim() === '' ? null : Number(s));

export function scoreRedRock(study: Study, cases: Case[], st: RedRockState, events: TelemetryEvent[], timedOut: boolean): GameResult {
  // ---- product
  const qRes = study.questions.map((q) => ({ label: q.label, prompt: q.prompt, correct: q.answer, unit: q.unit, given: st.answers[q.id] ?? '', ok: checkNumeric(num(st.answers[q.id]), q.answer) }));
  const bRes = study.report.blanks.map((b) => {
    const given = st.blanks[b.id] ?? '';
    if (b.kind === 'choice') return { id: b.id, expected: b.correct, given, ok: given === b.correct };
    const q = study.questions.find((x) => x.id === b.questionId)!;
    const givenVal = num(st.answers[given]);
    return { id: b.id, expected: `${q.answer} (Q${q.label})`, given: given ? `${st.answers[given] ?? '—'} (Q${given.slice(1)})` : '', ok: checkNumeric(givenVal, q.answer) };
  });
  const chartTypeOk = st.chartType === study.chart.correct;
  const valOk = study.chart.values.map((v, i) => checkNumeric(num(st.chartValues[i]), v));
  const caseRes = cases.map((c, i) => {
    const given = st.caseAnswers[i] ?? '';
    const ok = c.kind === 'numeric' ? checkNumeric(num(given), c.answer as number) : given === c.answer;
    return { title: c.title, type: c.type, question: c.question, expected: String(c.answer), given, ok, explanation: c.explanation };
  });
  const analysis = pct(qRes.filter((q) => q.ok).length, qRes.length);
  const written = pct(bRes.filter((b) => b.ok).length, bRes.length);
  const chartValues = chartTypeOk ? pct(valOk.filter(Boolean).length, valOk.length) : 0;
  const casesScore = pct(caseRes.filter((c) => c.ok).length, cases.length);
  const product = Math.round(0.3 * analysis + 0.25 * written + 0.1 * (chartTypeOk ? 100 : 0) + 0.1 * chartValues + 0.25 * casesScore);

  // ---- process
  const adds = events.filter((e) => e.type === 'journal_add' && e.phase !== 'cases');
  const deletes = events.filter((e) => e.type === 'journal_delete' && e.phase !== 'cases');
  const savedRelevant = adds.filter((e) => e.payload?.relevant).length;
  const precision = adds.length ? pct(savedRelevant, adds.length) : 0;
  const savedIds = new Set(adds.map((e) => String(e.payload?.factId)));
  for (const d of deletes) savedIds.delete(String(d.payload?.factId));
  const recall = pct(study.requiredFacts.filter((f) => savedIds.has(f)).length, study.requiredFacts.length);
  const flips = flipFlops(events);
  const flipScore = Math.max(0, 100 - flips * 10);
  const reached = pct(st.casesReached, cases.length);
  const studyTime = budgetScore(st.studySec, CONFIG.redRock.studyBudgetSec);
  const calm = calmness(events, st.studySec + st.casesSec).score;
  const switches = events.filter((e) => e.type === 'phase_change' && ['investigation', 'analysis'].includes(String(e.payload?.to))).length;
  const process = Math.round(0.25 * precision + 0.2 * recall + 0.1 * flipScore + 0.2 * reached + 0.15 * studyTime + 0.1 * calm);

  const missed = study.requiredFacts.filter((f) => !savedIds.has(f)).map((f) => factLabel(study.facts[f]) + ` = ${study.facts[f].value}`);
  const metrics = {
    journalPrecision: Math.round(precision),
    journalRecall: Math.round(recall),
    answerFlipFlops: flips,
    casesReached: st.casesReached,
    studyMinutes: Math.round(st.studySec / 6) / 10,
    investigationAnalysisSwitches: switches,
    calmness: Math.round(calm),
  };
  let habit = 'Solid run. Next time, write the formula in plain words before touching the calculator.';
  if (st.casesReached < cases.length) habit = `Time: you reached ${st.casesReached}/6 cases. Cap the Study at ~${Math.round(CONFIG.redRock.studyBudgetSec / 60)} minutes so every case gets ~2 minutes.`;
  else if (precision < 60) habit = 'Journal discipline: read the objective first and save only values the objective needs — about half the material is noise.';
  else if (recall < 80) habit = 'Collect before you calculate: list the inputs each question needs, then sweep exhibits for exactly those values.';
  else if (analysis < 100) habit = 'Analysis accuracy: errors cascade into the report. Re-run each calculation once and check units (% vs percentage points).';
  else if (!chartTypeOk) habit = 'Chart choice: time trend → line, compare categories → bar, parts of a whole → pie/100% stacked.';
  else if (casesScore < 70) habit = 'Cases: identify the question type first (word problem, formula, true/false/can’t tell, chart) before reading the numbers.';

  return {
    game: 'redrock',
    product,
    process,
    score: combine(product, process),
    timeSpentSec: st.studySec + st.casesSec,
    timedOut,
    habit,
    details: {
      objective: study.objective,
      trap: study.trap,
      questions: qRes,
      blanks: bRes,
      chart: { expected: study.chart.correct, given: st.chartType, values: study.chart.values, givenValues: st.chartValues, categories: study.chart.categories },
      cases: caseRes,
      missedFacts: missed,
      metrics,
      sectionScores: { analysis: Math.round(analysis), written: Math.round(written), chartType: chartTypeOk ? 100 : 0, chartValues: Math.round(chartValues), cases: Math.round(casesScore) },
    },
  };
}
