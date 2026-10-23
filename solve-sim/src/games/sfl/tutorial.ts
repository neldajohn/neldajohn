import type { TutorialCard } from '../../components/Tutorial';

export const ISLAND_TUTORIAL: TutorialCard[] = [
  { title: 'Lead a research team', body: ['You lead four researchers across four workstations on an island, over three project days.', 'Day 1: meet your researchers’ needs. Day 2: meet the workstations’ needs. Day 3: balance both.'] },
  { title: 'Explore', body: ['Each day you have a few Explore Requests (3, 3, then 2). Click a researcher or workstation and choose one question; one request buys one answer, saved to your Notes.', 'You can ask each person or workstation only one question per day. Cancelling a menu is free.'] },
  { title: 'Assign', body: ['Move researchers from the lodge to workstations (two per workstation at most). Each move needs a reason: preference, skill fit, today’s goal, the workstation’s need, or coverage.', 'A reason only counts if an answer you bought today supports it.'] },
  { title: 'Support and Reflect', body: ['Answer about four requests from your team. Several replies may sound reasonable — pick the one that serves today’s goal and stays consistent with what you have already said.', 'Then rate how each researcher feels. Use “I don’t know” when you have no evidence.'] },
  { title: 'Overnight reset', body: ['Each night, your notes, answers, placements and support conversations clear. Names, titles and workstation descriptions stay. Explore Requests refill.', 'Suggested pace: ~3 minutes onboarding, then ~9 minutes per day.'] },
];

export const CLASSIC_TUTORIAL: TutorialCard[] = [
  { title: 'Lead a sustainability programme', body: ['You will read a short briefing, rank four priorities, then make about twelve decisions under time pressure.', 'There are no numbers to calculate — this is about judgement.'] },
  { title: 'Decisions are final', body: ['Each decision has several paragraph-length options. After you confirm, you will see what happened. Earlier choices can change later situations.', 'One 20-minute clock covers the whole game: about 90 seconds per decision.'] },
];
