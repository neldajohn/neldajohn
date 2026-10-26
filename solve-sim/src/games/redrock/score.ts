import { CONFIG } from '../../config';
import { budgetScore, calmLine, calmness, combine, flipFlops, line, listSome, pct } from '../../lib/scoring';
import type { GameResult, TelemetryEvent } from '../../lib/types';
import { CHART_TYPES, checkNumeric, factLabel, type Case, type ChartType, type Study } from './model';

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
  const calmRes = calmness(events, st.studySec + st.casesSec);
  const calm = calmRes.score;
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

  const chartName = (c: ChartType | null) => (c ? CHART_TYPES.find((x) => x.id === c)!.label.toLowerCase() : 'no chart');
  const wrongQ = qRes.filter((q) => !q.ok);
  const wrongB = bRes.filter((b) => !b.ok);
  const wrongV = study.chart.categories.filter((_, i) => !valOk[i]);
  const wrongC = caseRes.map((c, i) => ({ ...c, n: i + 1 })).filter((c) => !c.ok);
  const noise = adds.filter((e) => !e.payload?.relevant).map((e) => factLabel(study.facts[String(e.payload?.factId)]));
  const flipFields = [...new Set(events.filter((e) => e.type === 'answer_change').map((e) => String(e.payload?.field)))];
  const blankText = (b: (typeof bRes)[number]) => {
    const def = study.report.blanks.find((x) => x.id === b.id)!;
    if (def.kind === 'choice') return b.given ? `"${b.given}" should be "${b.expected}"` : `left empty; should be "${b.expected}"`;
    const picked = st.blanks[b.id];
    if (picked && picked === def.questionId) return `slot used Q${picked.slice(1)}, the right question, but your answer was wrong so the error carried over (needed ${b.expected})`;
    return `${picked ? `used Q${picked.slice(1)}` : 'left empty'}; needed ${b.expected}`;
  };
  const breakdown = [
    line('product', 0.3, 'Analysis answers', analysis,
      `${qRes.length - wrongQ.length} of ${qRes.length} correct.${wrongQ.length ? ' Wrong: ' + listSome(wrongQ.map((q) => `Q${q.label} (you ${q.given || 'left it blank'}, correct ${q.correct}${q.unit === '%' ? '%' : q.unit === 'pp' ? ' pp' : ''})`)) : ''}`,
      `Redo ${wrongQ.map((q) => 'Q' + q.label).join(', ')}: follow the formula written in each question, use the exact journal values, and round to 2 decimals only at the end. Watch % vs percentage points.`),
    line('product', 0.25, 'Written report blanks', written,
      `${bRes.length - wrongB.length} of ${bRes.length} blanks correct.${wrongB.length ? ' ' + listSome(wrongB.map(blankText)) : ''}`,
      'Fix the Analysis answers first (value slots inherit them), then drop each result into the slot whose sentence matches its question. For dropdowns, re-read the sentence against your numbers — the trap answer is usually the raw-count leader.'),
    line('product', 0.1, 'Chart type', chartTypeOk ? 100 : 0,
      chartTypeOk ? `You picked the ${chartName(st.chartType)}.` : `You picked ${chartName(st.chartType)}; this message needs a ${chartName(study.chart.correct)}.`,
      study.chart.correct === 'line' ? 'The values run across years, so it is a trend over time → line chart.' : 'You are comparing a few named categories → bar chart. Pie only works for parts of a whole.'),
    line('product', 0.1, 'Chart values', chartValues,
      !chartTypeOk ? 'Chart values only count when the chart type is right.' : `${valOk.filter(Boolean).length} of ${valOk.length} values correct.${wrongV.length ? ' Wrong: ' + listSome(wrongV.map((c) => `${c} should be ${study.chart.values[study.chart.categories.indexOf(c)]}`)) : ''}`,
      `Pick the right chart type first, then enter: ${study.chart.categories.map((c, i) => `${c} = ${study.chart.values[i]}`).join(', ')}.`),
    line('product', 0.25, 'Cases', casesScore,
      `${caseRes.length - wrongC.length} of ${caseRes.length} cases correct.${wrongC.length ? ' Missed: ' + listSome(wrongC.map((c) => `case ${c.n} ${c.title} (${c.type}${c.given ? `, you ${c.given}` : ', not answered'}, answer ${c.expected})`)) : ''}`,
      wrongC.length ? listSome(wrongC.map((c) => `Case ${c.n}: ${c.explanation}`), 6) : ''),
    line('process', 0.25, 'Journal precision', precision,
      adds.length ? `${savedRelevant} of ${adds.length} saved values were needed.${noise.length ? ' Noise saved: ' + listSome(noise) : ''}` : 'You saved nothing to the journal.',
      'Before saving, ask "does the objective need this exact value?" Skip noise like tourism, rainfall, staffing, other years and densities.'),
    line('process', 0.2, 'Journal recall', recall,
      `You saved ${study.requiredFacts.length - missed.length} of ${study.requiredFacts.length} values the objective needs.${missed.length ? ' Missing: ' + listSome(missed) : ''}`,
      'List the inputs each question needs, then sweep every exhibit (including the assumptions box) and save exactly those.'),
    line('process', 0.1, 'Few answer changes', flipScore,
      flips ? `You changed answers ${flips} extra time${flips > 1 ? 's' : ''} (fields: ${listSome(flipFields)}). Each change costs 10.` : 'No answer changes.',
      'Calculate fully before typing, enter each answer once, and resist second-guessing.'),
    line('process', 0.2, 'Reached all cases', reached,
      `You reached ${st.casesReached} of ${cases.length} cases.`,
      `Leave the Study by about ${Math.round(CONFIG.redRock.studyBudgetSec / 60)} minutes so the cases get ~2 minutes each.`),
    line('process', 0.15, 'Study time', studyTime,
      `The Study took ${(st.studySec / 60).toFixed(1)} min against a ${Math.round(CONFIG.redRock.studyBudgetSec / 60)}-min budget.`,
      `Cut ${((st.studySec - CONFIG.redRock.studyBudgetSec) / 60).toFixed(1)} min: collect only the required values and don't polish the report.`),
    calmLine(0.1, calmRes.cpm, calm),
  ];

  return {
    breakdown,
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
