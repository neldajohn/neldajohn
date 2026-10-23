import { useEffect } from 'react';
import { GAME_NAMES, type GameId } from '../config';
import { Tutorial, type TutorialCard } from '../components/Tutorial';
import { RedRock } from '../games/redrock/RedRock';
import { REDROCK_TUTORIAL } from '../games/redrock/tutorial';
import { SeaWolf } from '../games/seawolf/SeaWolf';
import { SEAWOLF_TUTORIAL } from '../games/seawolf/tutorial';
import { useSitting } from '../store/sitting';

const TUTORIALS: Partial<Record<GameId, TutorialCard[]>> = {
  redrock: REDROCK_TUTORIAL,
  seawolf: SEAWOLF_TUTORIAL,
};

export function SittingHost() {
  const sitting = useSitting((s) => s.sitting);
  const setPhase = useSitting((s) => s.setPhase);
  const run = sitting?.runs[sitting.index];
  useEffect(() => {
    if (run?.stage === 'playing') setPhase('start');
  }, [run?.stage, run?.game, setPhase]);
  if (!sitting || !run) return null;
  const key = `${sitting.id}-${run.game}`;
  if (run.stage === 'tutorial') return <Tutorial key={key} title={GAME_NAMES[run.game]} cards={TUTORIALS[run.game] ?? [{ title: GAME_NAMES[run.game], body: ['Coming soon.'] }]} />;
  const seed = sitting.seed;
  switch (run.game) {
    case 'redrock':
      return <RedRock key={key} seed={seed} />;
    case 'seawolf':
      return <SeaWolf key={key} seed={seed} variant={sitting.settings.seaWolfMode} />;
    default:
      return <div className="p-10">Not built yet.</div>;
  }
}
