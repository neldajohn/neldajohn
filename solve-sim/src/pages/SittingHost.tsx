import { useEffect } from 'react';
import { GAME_NAMES, type GameId } from '../config';
import { Tutorial, type TutorialCard } from '../components/Tutorial';
import { Ecosystem } from '../games/ecosystem/Ecosystem';
import { RedRock } from '../games/redrock/RedRock';
import { REDROCK_TUTORIAL } from '../games/redrock/tutorial';
import { SeaWolf } from '../games/seawolf/SeaWolf';
import { Classic } from '../games/sfl/Classic';
import { Island } from '../games/sfl/Island';
import { CLASSIC_TUTORIAL, ISLAND_TUTORIAL } from '../games/sfl/tutorial';
import { SEAWOLF_TUTORIAL } from '../games/seawolf/tutorial';
import { useSitting } from '../store/sitting';

const TUTORIALS: Record<GameId, TutorialCard[]> = {
  redrock: REDROCK_TUTORIAL,
  seawolf: SEAWOLF_TUTORIAL,
  sflIsland: ISLAND_TUTORIAL,
  sflClassic: CLASSIC_TUTORIAL,
  ecosystem: [
    { title: 'Build a sustainable ecosystem (legacy game)', body: ['Choose a location, then eight species from the pool that form a sustainable food chain. Species must suit the location’s depth and temperature.', 'The animal with the highest calories provided eats first, choosing its richest available food source; ties split half/half. Every species must keep calories above zero, and every animal must eat.'] },
  ],
};

const FIRST_PHASE: Record<GameId, string> = { redrock: 'investigation', seawolf: 'site-1', sflIsland: 'onboarding', sflClassic: 'briefing', ecosystem: 'build' };

export function SittingHost() {
  const sitting = useSitting((s) => s.sitting);
  const setPhase = useSitting((s) => s.setPhase);
  const run = sitting?.runs[sitting.index];
  useEffect(() => {
    if (run?.stage === 'playing') setPhase(FIRST_PHASE[run.game]);
  }, [run?.stage, run?.game, setPhase]);
  if (!sitting || !run) return null;
  const key = `${sitting.id}-${run.game}`;
  if (run.stage === 'tutorial') return <Tutorial key={key} title={GAME_NAMES[run.game]} cards={TUTORIALS[run.game]} />;
  const seed = sitting.seed;
  switch (run.game) {
    case 'redrock':
      return <RedRock key={key} seed={seed} />;
    case 'seawolf':
      return <SeaWolf key={key} seed={seed} variant={sitting.settings.seaWolfMode} hard={sitting.settings.seaWolfHard ?? false} />;
    case 'sflIsland':
      return <Island key={key} seed={seed} />;
    case 'sflClassic':
      return <Classic key={key} seed={seed} />;
    case 'ecosystem':
      return <Ecosystem key={key} seed={seed} />;
  }
}
