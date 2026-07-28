/**
 * "A backend started, stopped, appeared or went away" (WFA-005, closing F47/F34).
 *
 * Three panels describe another process's state — Workflows, Execution History
 * and Triggers — and the sidebar keeps an inactive panel MOUNTED AND HIDDEN, so
 * switching away and back neither remounts nor refetches. Each of them worked
 * around that by refetching on `activeChanged`, which cannot help the case that
 * actually bites: the panel is already open and in front of you when the backend
 * starts, and it goes on saying "no backend is running" until Refresh is pressed.
 *
 * There was nothing to listen to. `BackendManager` now broadcasts
 * `backend:statusChanged` on create/start/stop/delete and on an *unexpected*
 * exit — the last being the state that was previously invisible, because a
 * crashed backend left every panel still describing a running one.
 *
 * Deliberately not a store: what a panel wants is "read your own state again",
 * not a shared cache of somebody else's, and each panel's read is different
 * (workflow definitions, execution rows, triggers).
 *
 * @module hooks/useBackendStatusChanged
 */

import { useEffect, useRef } from 'react';

export interface BackendStatusChange {
  backendId: string;
  reason: 'created' | 'started' | 'stopped' | 'deleted' | 'exited';
  /** True only for `started` — the others all mean "not running now". */
  running: boolean;
  at: string;
}

/**
 * Run `onChange` whenever any backend's lifecycle changes.
 *
 * The callback is held in a ref, so a panel may pass an inline arrow without
 * re-subscribing on every render — the subscription lasts as long as the
 * component, which is what a hidden-but-mounted panel needs.
 */
export function useBackendStatusChanged(onChange: (change: BackendStatusChange) => void) {
  const handler = useRef(onChange);
  handler.current = onChange;

  useEffect(() => {
    // Guarded: the editor's specs render these panels outside Electron, where
    // there is no ipcRenderer, and a panel must not fail to mount over an
    // event it only uses to stay fresh.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const electron = (window as any).require ? (window as any).require('electron') : null;
    const ipcRenderer = electron?.ipcRenderer;
    if (!ipcRenderer) return;

    const listener = (_event: unknown, change: BackendStatusChange) => handler.current(change);
    ipcRenderer.on('backend:statusChanged', listener);
    return () => ipcRenderer.removeListener('backend:statusChanged', listener);
  }, []);
}
