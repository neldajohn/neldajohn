import { Button } from '../components/ui';
import { useSitting } from '../store/sitting';

export function Complete() {
  const { openDebrief, debriefId, setView } = useSitting();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-[520px] rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-xl text-blue-700">✓</div>
        <h1 className="text-xl font-semibold text-slate-800">Assessment complete</h1>
        <p className="mt-2 text-sm text-slate-600">Thank you. Your responses have been submitted. You may now close this window.</p>
        <div className="mt-8 flex justify-center gap-2 border-t border-slate-100 pt-6">
          <Button variant="secondary" onClick={() => setView('home')}>
            Home
          </Button>
          <Button onClick={() => debriefId && openDebrief(debriefId)}>Debrief (practice scoring)</Button>
        </div>
      </div>
    </div>
  );
}

export function Abandoned() {
  const { abandoned, dismissAbandoned } = useSitting();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-[520px] rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800">Attempt abandoned</h1>
        <p className="mt-2 text-sm text-slate-600">
          The previous sitting{abandoned ? ` (seed ${abandoned.seed})` : ''} was closed before it finished. As in the real assessment, it cannot be resumed.
        </p>
        <div className="mt-6">
          <Button onClick={dismissAbandoned}>Back to home</Button>
        </div>
      </div>
    </div>
  );
}
