/**
 * Debounced project-directory watcher.
 *
 * The thing being watched is a directory another process writes: an agent
 * saving a component touches three files, the editor's component saver stages
 * temp files and renames them. So the watcher's job is not to be fast — it is
 * to fire *once* per logical edit, after the writing has stopped. Every event
 * restarts the debounce timer; a burst of twelve writes produces one rebuild.
 *
 * Torn reads are still possible (a file renamed between our stat and our read),
 * and are handled where they surface: `loadPreview` returns an `error` result
 * and the server keeps the last good build on screen.
 *
 * @module noodl-preview/watcher
 */

import chokidar, { type FSWatcher } from 'chokidar';

export interface WatchOptions {
  /** Directory to watch. */
  dir: string;
  /** Quiet period before a rebuild, in ms. */
  debounceMs: number;
  /** Called once per settled burst of changes. */
  onChange: (paths: string[]) => void;
}

/**
 * Paths that change constantly without changing the project. `.git` in
 * particular churns on every editor autosave-plus-commit and would otherwise
 * rebuild the preview for nothing.
 */
export const IGNORED = [
  /(^|[/\\])\.git([/\\]|$)/,
  /(^|[/\\])\.DS_Store$/,
  /(^|[/\\])node_modules([/\\]|$)/,
  /(^|[/\\])\.nodegx-backup([/\\]|$)/,
  // Editor/OS scratch files: the component saver's staged temp writes, vim/emacs
  // swap files, and JetBrains/VS Code backups.
  /\.(tmp|temp|swp|swx|bak|orig)$/,
  /(^|[/\\])~\$/,
  /(^|[/\\])\.#/,
  /~$/
];

export function startWatching({ dir, debounceMs, onChange }: WatchOptions): FSWatcher {
  const watcher = chokidar.watch(dir, {
    ignored: IGNORED,
    ignoreInitial: true,
    // Wait for the writer to finish before reporting an add — cuts most torn
    // reads without adding latency to the common (already-complete) case.
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 }
  });

  let timer: NodeJS.Timeout | null = null;
  let pending: string[] = [];

  const schedule = (file: string) => {
    pending.push(file);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const paths = pending;
      pending = [];
      timer = null;
      onChange(paths);
    }, debounceMs);
  };

  watcher.on('add', schedule);
  watcher.on('change', schedule);
  watcher.on('unlink', schedule);
  watcher.on('unlinkDir', schedule);

  return watcher;
}
