import type { TutorialCard } from '../../components/Tutorial';

export const REDROCK_TUTORIAL: TutorialCard[] = [
  { title: 'You are a researcher on an island', body: ['One 35-minute clock covers two parts: a Study (Investigation, Analysis, Report) and six short Cases.', 'Investigation and Analysis are freely navigable. The Report is one-way: once you enter it, you cannot return to the Study.'] },
  { title: 'Investigation', body: ['Read the objective, narrative and exhibits. Drag single values into your Research Journal on the right.', 'Much of the material is irrelevant. There is no calculator in this phase.'] },
  { title: 'Analysis', body: ['Answer 2–4 questions to two decimal places using the on-screen calculator. Drag journal values into the calculator and results into answer boxes.', 'Your Analysis answers carry into the Report — mistakes propagate.'] },
  { title: 'Report', body: ['Fill a written report with dropdowns and your Analysis results, choose ONE chart type (locked once chosen), then enter the values that populate it.'] },
  { title: 'Cases', body: ['Six standalone mini-cases (~2 minutes each) on the same clock. Each has its own data; the journal resets. Complete one to unlock the next — no going back.'] },
];
