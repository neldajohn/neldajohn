import { useEffect, useState } from 'react';
import { CONFIG } from '../config';
import { useSitting } from '../store/sitting';
import { Button } from './ui';

export interface TutorialCard {
  title: string;
  body: string[];
}

/** Untimed tutorial. With the quirk toggle on, the clock is already running and the tutorial ends unannounced. */
export function Tutorial({ title, cards }: { title: string; cards: TutorialCard[] }) {
  const [i, setI] = useState(0);
  const endTutorial = useSitting((s) => s.endTutorial);
  const quirk = useSitting((s) => s.sitting?.settings.tutorialQuirk);
  useEffect(() => {
    if (!quirk) return;
    const t = setTimeout(endTutorial, CONFIG.tutorialQuirk.autoEndAfterSec * 1000);
    return () => clearTimeout(t);
  }, [quirk, endTutorial]);
  const card = cards[i];
  const last = i === cards.length - 1;
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-[640px] rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-700">{title} · Tutorial</div>
        <h2 className="mb-4 text-xl font-semibold text-slate-800">{card.title}</h2>
        <div className="min-h-[160px] space-y-3 text-sm leading-relaxed text-slate-600">
          {card.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-1">
            {cards.map((_, k) => (
              <span key={k} className={`h-1.5 w-6 rounded ${k <= i ? 'bg-blue-600' : 'bg-slate-200'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={i === 0} onClick={() => setI(i - 1)}>
              Back
            </Button>
            {last ? <Button onClick={endTutorial}>Start — the clock begins now</Button> : <Button onClick={() => setI(i + 1)}>Next</Button>}
          </div>
        </div>
        {!quirk && <p className="mt-4 text-xs text-slate-400">The tutorial is untimed. The game clock starts when you press Start.</p>}
      </div>
    </div>
  );
}
