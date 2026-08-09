/**
 * AIB-002's run clock, extracted by BLD-005 so the pinned header and the
 * operation rows tick off one implementation.
 *
 * @module noodl-editor/views/panels/AiAuthoringPanel/thread/useElapsedClock
 */

import { useEffect, useState } from 'react';

/**
 * A clock that re-renders once a second while the run is working, and only
 * while the panel is actually on screen.
 *
 * Elapsed is always *derived* from the timestamps `PlanRun` publishes, never
 * accumulated here, which is what makes both halves of the WFA-002 trap fall
 * out for free: a hidden panel stops re-rendering (nobody is reading it) and a
 * panel that comes back computes the right number on its first frame instead of
 * restarting from zero.
 *
 * ⚠️ `offsetParent` is the whole of the second half. The sidebar **hides a panel
 * it has not unmounted** (`display: none`), so a `setInterval` here would
 * otherwise keep firing for a panel nobody is looking at — and, in an occluded
 * Electron window, at a clamped rate that makes the numbers wrong as well as
 * pointless.
 */
export function useElapsedClock(active: boolean, ref: React.RefObject<HTMLElement>): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      if (ref.current && ref.current.offsetParent === null) return;
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [active, ref]);
  return now;
}
