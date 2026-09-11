import { ipcRenderer } from 'electron';
import { useCallback, useEffect, useState } from 'react';

/**
 * The main process's update state, mirrored into a component.
 *
 * One state object rather than a stream of events, and it is replayed on mount
 * via `update:get-state`. Both matter: this hook is used from two places at
 * once (the launcher and the editor's title bar), a window can be created
 * mid-download, and a set of independent events would let two surfaces disagree
 * about whether an update is in flight.
 */
export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';

export interface UpdateVersion {
  version: string;
  tag: string;
  name: string;
  notes: string;
  prerelease: boolean;
  publishedAt: string;
}

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  targetVersion: string | null;
  releaseNotes: string | null;
  releaseName: string | null;
  versions: UpdateVersion[];
  includePrereleases: boolean;
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
  error: string | null;
  dismissed: boolean;
}

const INITIAL: UpdateState = {
  status: 'idle',
  currentVersion: '',
  targetVersion: null,
  releaseNotes: null,
  releaseName: null,
  versions: [],
  includePrereleases: false,
  percent: 0,
  transferred: 0,
  total: 0,
  bytesPerSecond: 0,
  error: null,
  dismissed: false
};

export function useUpdateState() {
  const [state, setState] = useState<UpdateState>(INITIAL);

  useEffect(() => {
    let cancelled = false;

    const onState = (_event: unknown, next: UpdateState) => setState(next);
    ipcRenderer.on('update:state', onState);

    // Replay, so a window opened mid-download shows the download rather than
    // waiting for the next progress tick to learn there is one.
    ipcRenderer
      .invoke('update:get-state')
      .then((next: UpdateState) => {
        if (!cancelled && next) setState(next);
      })
      .catch(() => {
        // No handler registered — Linux, or `autoUpdate=no`. There is nothing
        // to show and nothing to report; the UI simply never appears.
      });

    return () => {
      cancelled = true;
      ipcRenderer.off('update:state', onState);
    };
  }, []);

  const check = useCallback(() => ipcRenderer.invoke('update:check').catch(() => undefined), []);
  const listVersions = useCallback(() => ipcRenderer.invoke('update:list-versions').catch(() => undefined), []);
  const download = useCallback(
    (version?: string) => ipcRenderer.invoke('update:download', version).catch(() => undefined),
    []
  );
  const install = useCallback(() => ipcRenderer.invoke('update:install').catch(() => undefined), []);
  const dismiss = useCallback(() => ipcRenderer.invoke('update:dismiss').catch(() => undefined), []);
  const setIncludePrereleases = useCallback(
    (include: boolean) => ipcRenderer.invoke('update:set-include-prereleases', include).catch(() => undefined),
    []
  );

  return { state, check, listVersions, download, install, dismiss, setIncludePrereleases };
}

/** `169836068` → `162 MB`. */
export function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

/**
 * Seconds remaining, as a phrase, or `null` when it cannot be known.
 *
 * Deliberately coarse. A precise-looking countdown that jumps around is worse
 * than a vague one that does not: the number here exists to answer "is it worth
 * waiting?", not to be accurate.
 */
export function formatRemaining(state: UpdateState): string | null {
  if (!state.bytesPerSecond || !state.total || state.transferred >= state.total) return null;
  const seconds = (state.total - state.transferred) / state.bytesPerSecond;
  if (!Number.isFinite(seconds)) return null;
  if (seconds < 45) return 'less than a minute left';
  return `about ${Math.round(seconds / 60)} minute${Math.round(seconds / 60) === 1 ? '' : 's'} left`;
}
