import { useEffect, useState, useSyncExternalStore } from 'react';
import { Simulation } from './core/simulation';

export function useSimulation(): Simulation {
  const [simulation] = useState(() => new Simulation());
  useSyncExternalStore(simulation.subscribe, simulation.getSnapshot);
  useEffect(() => {
    let frame = 0, previous: number | null = null;
    const tick = (now: number) => {
      const elapsed = previous === null ? 0 : Math.min((now - previous) / 1000, 0.1);
      previous = now;
      if (!document.hidden && (simulation.traveling || simulation.pedestrians.length)) simulation.step(elapsed);
      frame = requestAnimationFrame(tick);
    };
    // Background tabs do not accumulate elapsed time or jump forward on return.
    const visibility = () => { previous = null; };
    const leave = () => simulation.dispose();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', leave);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame); simulation.dispose();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', leave);
    };
  }, [simulation]);
  return simulation;
}
