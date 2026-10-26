import type { TutorialCard } from '../../components/Tutorial';

export const SEAWOLF_TUTORIAL: TutorialCard[] = [
  { title: 'Your task', body: ['Three ocean sites are contaminated. For each, you will assemble a treatment of exactly three microbes.', 'You have one clock for all three sites. Aim for roughly 9–10 minutes per site.'] },
  { title: 'Site profiles', body: ['Each site lists a target range for every attribute (rated 1–10), one desired trait and one undesired trait.', 'A treatment’s attribute value is the average of its three microbes — individual microbes can sit outside a range.'] },
  { title: 'Step 1 & 2: lock, then sort', body: ['Lock two characteristics to shape your starting pool.', 'Then ten microbes arrive one at a time. Send each to the current site, the next site, or back to the pool. You only see one trait of the next site. Microbes you route to a site can appear in its offer rounds.'] },
  { title: 'Step 3: build the prospect pool', body: ['Your pool starts with six microbes. In four rounds you are offered three and keep one, ending with ten.', 'Only microbes in your pool can be used in the final treatment.'] },
  { title: 'Step 4: pick the final three', body: ['Select three microbes and watch the live averages and trait checks.', 'Effectiveness counts each attribute range and both trait conditions. A perfect score is not always possible — get as close as you can.'] },
];
