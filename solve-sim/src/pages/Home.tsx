import { useState } from 'react';
import { CONFIG, GAME_NAMES, type GameId, type SittingMode } from '../config';
import { Button, Panel } from '../components/ui';
import { randomSeed } from '../lib/rng';
import { useSitting } from '../store/sitting';

const MODE_TEXT: Record<SittingMode, string> = {
  65: 'Red Rock → Sea Wolf',
  85: 'Red Rock → Sea Wolf → SFL Classic',
  95: 'Red Rock → Sea Wolf → SFL Island',
};

export function Home() {
  const { settings, updateSettings, startSitting, setView } = useSitting();
  const [mode, setMode] = useState<SittingMode | 'single'>(CONFIG.defaultMode);
  const [single, setSingle] = useState<GameId>('seawolf');
  const [seed, setSeed] = useState('');
  const [confirm, setConfirm] = useState(false);

  const singles: GameId[] = ['redrock', 'seawolf', 'sflIsland', 'sflClassic', ...(settings.legacyEcosystem ? (['ecosystem'] as GameId[]) : [])];
  const start = () => startSitting(mode, seed.trim() || randomSeed(), mode === 'single' ? single : undefined);
  const minutes = mode === 'single' ? CONFIG.clocks[single] / 60 : CONFIG.modes[mode].reduce((a, g) => a + CONFIG.clocks[g], 0) / 60;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 text-slate-800">
      <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-blue-700">Unofficial practice tool</div>
      <h1 className="text-3xl font-semibold">Solve Practice Simulator</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        A personal, single-player replica of the problem-solving game assessment, rebuilt from public candidate reports. Not affiliated with or endorsed by McKinsey &amp; Company. All scenarios are
        original and procedurally generated; timings and scoring are a practice model.
      </p>

      <div className="mt-8 grid grid-cols-4 gap-3">
        {([65, 85, 95] as SittingMode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`rounded-md border p-4 text-left ${mode === m ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <div className="text-2xl font-semibold">{m} min</div>
            <div className="mt-1 text-xs text-slate-500">{MODE_TEXT[m]}</div>
            {m === CONFIG.defaultMode && <div className="mt-2 text-xs font-medium text-blue-700">Default · matches your invite</div>}
          </button>
        ))}
        <button onClick={() => setMode('single')} className={`rounded-md border p-4 text-left ${mode === 'single' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
          <div className="text-lg font-semibold">Single game</div>
          <div className="mt-1 text-xs text-slate-500">Practise one game on its own clock</div>
        </button>
      </div>

      {mode === 'single' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {singles.map((g) => (
            <button key={g} onClick={() => setSingle(g)} className={`rounded border px-3 py-1.5 text-sm ${single === g ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white'}`}>
              {GAME_NAMES[g]}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4">
        <Panel title="Seed (optional)">
          <input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Leave blank for a fresh run" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          <p className="mt-2 text-xs text-slate-500">The same seed regenerates the same scenarios — use it to replay a run from History.</p>
        </Panel>
        <Panel title="Settings">
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.tutorialQuirk} onChange={(e) => updateSettings({ tutorialQuirk: e.target.checked })} />
              Mimic the tutorial quirk (clock already running, tutorial ends without warning)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.seaWolfMode === 'alt'} onChange={(e) => updateSettings({ seaWolfMode: e.target.checked ? 'alt' : 'default' })} />
              Sea Wolf alt mode (7 attributes, 5 traits)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.legacyEcosystem} onChange={(e) => updateSettings({ legacyEcosystem: e.target.checked })} />
              Show legacy Ecosystem Building game
            </label>
          </div>
        </Panel>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setView('history')}>
          Run history
        </Button>
        <Button onClick={() => setConfirm(true)}>Begin {mode === 'single' ? 'practice' : 'sitting'} ({Math.round(minutes)} min)</Button>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40">
          <div className="w-[480px] rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold">Before you begin</h2>
            <ul className="mb-5 list-disc space-y-1 pl-5 text-sm text-slate-600">
              <li>Games run in a fixed order. You cannot return to a previous game.</li>
              <li>Each game has its own clock; unused time does not carry over.</li>
              <li>Closing or reloading the tab forfeits the attempt.</li>
              <li>Each game starts with an untimed tutorial.</li>
            </ul>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button onClick={start}>Start</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
