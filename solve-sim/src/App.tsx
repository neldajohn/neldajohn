import { useEffect, useState } from 'react';
import { CONFIG } from './config';
import { DragLayer } from './lib/drag';
import { Abandoned, Complete } from './pages/EndScreens';
import { Debrief } from './pages/Debrief';
import { DrillPage } from './pages/Drills';
import { History } from './pages/History';
import { Home } from './pages/Home';
import { SittingHost } from './pages/SittingHost';
import { useSitting } from './store/sitting';

export function App() {
  const view = useSitting((s) => s.view);
  const active = useSitting((s) => s.sitting?.status === 'active');
  const narrow = useNarrow();

  // No re-entry: block the browser back button and warn before closing mid-sitting.
  useEffect(() => {
    if (!active) return;
    history.pushState(null, '', location.href);
    const pop = () => history.pushState(null, '', location.href);
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('popstate', pop);
    window.addEventListener('beforeunload', unload);
    return () => {
      window.removeEventListener('popstate', pop);
      window.removeEventListener('beforeunload', unload);
    };
  }, [active]);

  return (
    <>
      {narrow && (
        <div className="fixed inset-x-0 top-0 z-50 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Desktop only: this simulator needs a window at least {CONFIG.minDesktopWidth}px wide, like the real assessment.
        </div>
      )}
      {view === 'home' && <Home />}
      {view === 'sitting' && <SittingHost />}
      {view === 'complete' && <Complete />}
      {view === 'debrief' && <Debrief />}
      {view === 'history' && <History />}
      {view === 'abandoned' && <Abandoned />}
      {view === 'drill' && <DrillPage />}
      <DragLayer />
    </>
  );
}

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.innerWidth < CONFIG.minDesktopWidth);
  useEffect(() => {
    const f = () => setNarrow(window.innerWidth < CONFIG.minDesktopWidth);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return narrow;
}
