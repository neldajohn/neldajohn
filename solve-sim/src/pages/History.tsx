import { GAME_NAMES } from '../config';
import { Button, Pill } from '../components/ui';
import { loadHistory, useSitting } from '../store/sitting';

export function History() {
  const { setView, openDebrief } = useSitting();
  const hist = loadHistory();
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 text-slate-800">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Run history</h1>
        <Button variant="secondary" onClick={() => setView('home')}>
          Home
        </Button>
      </div>
      {hist.length === 0 && <p className="text-sm text-slate-500">No runs yet.</p>}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2">Date</th>
            <th>Mode</th>
            <th>Seed</th>
            <th>Scores</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {hist.map((h) => (
            <tr key={h.id} className="border-b border-slate-100">
              <td className="py-2">{new Date(h.startedAt).toLocaleString()}</td>
              <td>{h.mode === 'single' ? 'Single' : `${h.mode} min`}</td>
              <td className="font-mono text-xs">{h.seed}</td>
              <td className="space-x-1">
                {h.status === 'abandoned' ? (
                  <Pill tone="amber">abandoned</Pill>
                ) : (
                  h.results.map((r) => (
                    <span key={r.game} title={GAME_NAMES[r.game]}>
                      <Pill tone="blue">
                        {GAME_NAMES[r.game].split(' ')[0]} {r.score}
                      </Pill>
                    </span>
                  ))
                )}
              </td>
              <td className="text-right">
                {h.status === 'complete' && (
                  <Button variant="ghost" onClick={() => openDebrief(h.id)}>
                    Debrief
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
