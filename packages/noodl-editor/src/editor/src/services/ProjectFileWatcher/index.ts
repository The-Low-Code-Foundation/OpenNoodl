/**
 * REL-009b — a filesystem watcher over the open project's component files.
 *
 * The editor has never had one. An agent authoring over MCP writes components to
 * disk while the editor holds a stale copy in memory, and until this exists the
 * only way to see that work is to reopen the project. This turns a directory
 * into a debounced stream of *registry component paths that changed*; deciding
 * what to do about each one is `decide.ts`, and applying it is
 * `ProjectModel.reloadComponentFromDisk`.
 *
 * ── D1, ruled here: node `fs.watch`, not `chokidar` ──────────────────────────
 *
 * `chokidar` is not a dependency of `noodl-editor` (it belongs to
 * `noodl-preview` alone), and adding one to the editor is a supply-chain and
 * bundle-size decision that buys nothing we need: `fs.watch(dir,
 * { recursive: true })` is native on macOS and Windows, which are the platforms
 * that can reach this code at all — the whole feature is gated on
 * `_retainedProjectDirectory`, which only exists under Electron. chokidar's real
 * advantages are Linux recursion and atomic-write coalescing; we do not need the
 * first, and we do not want the second, because this watcher deliberately does
 * its own coalescing by CONTENT rather than by timing (see `decide.ts`).
 *
 * 🔴 The one place `fs.watch` is genuinely weaker is recursive support on Linux
 * (node >= 20 only, and unreliable before that). If the editor is ever asked to
 * run there, this is the module to revisit — `watchFactory` is injectable
 * precisely so that swap is a one-line change and not a rewrite.
 *
 * REL-009b §1.4 also rules out extending `IFileSystem` with a watch API: it has
 * 25-odd members, no watch of any kind, and AIX-009 already declined to widen it
 * for exactly this reason. This module talks to node directly, on the editor
 * side, and the platform abstraction is untouched.
 *
 * @module noodl-editor/services/ProjectFileWatcher
 */

import { componentPathFromRelativePath } from './decide';

export { componentPathFromRelativePath, decideComponentReload } from './decide';
export type { ReloadDecision } from './decide';

/** The subset of `fs.FSWatcher` this needs. */
export interface WatchHandle {
  close(): void;
}

/**
 * Starts watching `directory` recursively, calling `onEvent` with each changed
 * path *relative to that directory*. Injectable so the watcher's coalescing and
 * mapping can be graded without a real filesystem.
 */
export type WatchFactory = (directory: string, onEvent: (relativePath: string) => void) => WatchHandle;

const defaultWatchFactory: WatchFactory = (directory, onEvent) => {
  // Required lazily: this module is imported by specs that run in plain node
  // jest, and by the editor renderer. `fs` is available in both, but keeping the
  // require here means a spec that injects its own factory never touches it.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  const watcher = fs.watch(directory, { recursive: true }, (_eventType: string, filename: string | null) => {
    if (filename) onEvent(String(filename));
  });
  // A watch on a directory that disappears (project deleted, drive unmounted)
  // emits an error; letting it throw would take the renderer down.
  watcher.on('error', () => {
    /* the watch is gone; stop() is still safe to call */
  });
  return watcher;
};

export interface ProjectFileWatcherOptions {
  /** Quiet period before a batch is reported. */
  debounceMs?: number;
  watchFactory?: WatchFactory;
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  clearTimeoutFn?: (handle: unknown) => void;
}

/**
 * Watches one project directory and reports the component paths whose files
 * changed, coalesced.
 *
 * Coalescing matters more here than it looks: saving one component writes three
 * files, each staged as a `.tmp` and renamed, so a single logical change can
 * produce six events. They collapse to one component path.
 */
export class ProjectFileWatcher {
  private handle: WatchHandle | null = null;
  private pending = new Set<string>();
  private timer: unknown = null;

  private readonly debounceMs: number;
  private readonly watchFactory: WatchFactory;
  private readonly setTimeoutFn: (fn: () => void, ms: number) => unknown;
  private readonly clearTimeoutFn: (handle: unknown) => void;

  constructor(options: ProjectFileWatcherOptions = {}) {
    this.debounceMs = options.debounceMs ?? 250;
    this.watchFactory = options.watchFactory ?? defaultWatchFactory;
    this.setTimeoutFn = options.setTimeoutFn ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimeoutFn = options.clearTimeoutFn ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  /** True while a watch is open. */
  get isWatching(): boolean {
    return this.handle !== null;
  }

  /**
   * Begins watching. `onComponentsChanged` receives registry component paths
   * ("Pages/Home"), deduplicated, at most once per debounce window.
   *
   * Starting an already-started watcher stops the previous watch first, so
   * reopening a project cannot leave two watches on one directory.
   */
  start(directory: string, onComponentsChanged: (componentPaths: string[]) => void): void {
    this.stop();

    this.handle = this.watchFactory(directory, (relativePath) => {
      const componentPath = componentPathFromRelativePath(relativePath);
      if (componentPath === null) return;

      this.pending.add(componentPath);
      if (this.timer !== null) this.clearTimeoutFn(this.timer);
      this.timer = this.setTimeoutFn(() => {
        this.timer = null;
        const batch = Array.from(this.pending);
        this.pending.clear();
        if (batch.length > 0) onComponentsChanged(batch);
      }, this.debounceMs);
    });
  }

  /** Closes the watch and drops anything pending. Safe to call when not watching. */
  stop(): void {
    if (this.timer !== null) {
      this.clearTimeoutFn(this.timer);
      this.timer = null;
    }
    this.pending.clear();
    if (this.handle) {
      try {
        this.handle.close();
      } catch {
        /* already closed */
      }
      this.handle = null;
    }
  }
}
