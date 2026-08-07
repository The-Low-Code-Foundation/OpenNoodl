/**
 * CED-001 (B1/B3) — code history, backed by a sidecar file.
 *
 * The previous store wrote snapshots into node metadata, which meant they serialised
 * with the graph. Snapshots are local scratch: they are for the person who is editing,
 * they are worthless to a collaborator, and they must never reach `project.json` or a
 * deploy. So they live in `<project>/.nodegx/code-history.json` — a directory the
 * deploy walk already excludes by default (see `compilation/build/ignore.ts`) and that
 * this store adds to the project's `.gitignore` the first time it writes.
 *
 * Everything is best-effort. A project with no directory on disk yet, a read-only
 * checkout, or a corrupt sidecar all degrade to "no history", never to a failed save
 * of the user's actual code.
 *
 * @module models/CodeHistory
 */

import { filesystem } from '@noodl/platform';

import { ProjectModel } from '@noodl-models/projectmodel';
// AIB-003 slice 4 gave `.nodegx/` a second resident (the unapplied AI build), so
// "create it and make sure git ignores it" moved out of here and into one place
// both can share. The reasoning that put code history in a sidecar is unchanged.
import { ensureSidecarDirectory, sidecarPath as nodegxPath } from '@noodl-utils/nodegxSidecar';

/** A single code snapshot. Structurally the core-ui `CodeSnapshot`. */
export interface CodeSnapshot {
  code: string;
  /** ISO 8601. */
  timestamp: string;
  /** For deduplication — not cryptographic. */
  hash: string;
}

/** On-disk shape. `entries` is keyed by `<nodeId>/<parameterName>`. */
interface CodeHistoryFile {
  version: number;
  entries: Record<string, CodeSnapshot[]>;
}

const SIDECAR_FILE = 'code-history.json';
const FORMAT_VERSION = 1;

/** Kept from the previous store — twenty versions is plenty to walk back through. */
const MAX_SNAPSHOTS_PER_PARAMETER = 20;

/**
 * Entries for deleted nodes have nothing to delete them, so they are aged out on
 * write instead. Thirty days is well past the point where a snapshot is useful.
 */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function historyKey(nodeId: string, parameterName: string): string {
  return `${nodeId}/${parameterName}`;
}

/**
 * A cheap non-cryptographic hash, used only to notice that the code has not changed
 * since the last snapshot.
 */
function hashCode(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash = hash & hash; // Coerce back to a 32-bit integer
  }
  return hash.toString(36);
}

function isSnapshot(value: unknown): value is CodeSnapshot {
  const snapshot = value as CodeSnapshot;
  return (
    !!snapshot &&
    typeof snapshot.code === 'string' &&
    typeof snapshot.timestamp === 'string' &&
    typeof snapshot.hash === 'string'
  );
}

export class CodeHistoryStore {
  public static instance = new CodeHistoryStore();

  /** The directory `cache` was loaded from, so opening another project drops it. */
  private cachedDirectory: string | undefined;
  private cache: CodeHistoryFile | undefined;

  /**
   * Saves are read-modify-write, and two ports can be saved in the same tick when a
   * popout closes. Chaining them keeps the last write from losing the one before it.
   */
  private queue: Promise<unknown> = Promise.resolve();

  /** The open project's directory, or undefined for a project not yet on disk. */
  private projectDirectory(): string | undefined {
    return ProjectModel.instance?._retainedProjectDirectory;
  }

  /** Whether history can be stored at all right now. */
  public isAvailable(): boolean {
    return !!this.projectDirectory();
  }

  /**
   * Snapshots for one parameter, oldest first. Empty when there are none, when the
   * project has no directory, or when the sidecar cannot be read.
   */
  public async getHistory(nodeId: string, parameterName: string): Promise<CodeSnapshot[]> {
    const directory = this.projectDirectory();
    if (!directory) {
      return [];
    }

    const file = await this.load(directory);
    return file.entries[historyKey(nodeId, parameterName)] ?? [];
  }

  /**
   * Append a snapshot, unless it is identical to the newest one already stored.
   */
  public saveSnapshot(nodeId: string, parameterName: string, code: string): Promise<void> {
    const directory = this.projectDirectory();
    if (!directory || !code || code.trim() === '') {
      return Promise.resolve();
    }

    return this.enqueue(async () => {
      const file = await this.load(directory);
      const key = historyKey(nodeId, parameterName);
      const history = file.entries[key] ?? [];

      const hash = hashCode(code);
      if (history.length > 0 && history[history.length - 1].hash === hash) {
        return;
      }

      history.push({ code, timestamp: new Date().toISOString(), hash });

      if (history.length > MAX_SNAPSHOTS_PER_PARAMETER) {
        history.splice(0, history.length - MAX_SNAPSHOTS_PER_PARAMETER);
      }

      file.entries[key] = history;

      await this.persist(directory, file);
    });
  }

  /**
   * A `CodeHistoryProvider` bound to one parameter, for the code editor's History
   * button. The design-system package gets this rather than reaching into the editor
   * for a model (CED-001, B4).
   */
  public providerFor(nodeId: string, parameterName: string) {
    return {
      getHistory: () => this.getHistory(nodeId, parameterName)
    };
  }

  /** Drop the in-memory copy. Called when a project closes. */
  public reset(): void {
    this.cachedDirectory = undefined;
    this.cache = undefined;
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work);
    // Keep the chain alive even if this link rejects.
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async load(directory: string): Promise<CodeHistoryFile> {
    if (this.cache && this.cachedDirectory === directory) {
      return this.cache;
    }

    const empty: CodeHistoryFile = { version: FORMAT_VERSION, entries: {} };
    const path = this.sidecarPath(directory);

    if (!filesystem.exists(path)) {
      this.cachedDirectory = directory;
      this.cache = empty;
      return empty;
    }

    try {
      const parsed = await filesystem.readJson<CodeHistoryFile>(path);
      const entries: Record<string, CodeSnapshot[]> = {};

      // Hand-edited or half-written sidecars are common enough in a file people can
      // see; take what is well formed and ignore the rest rather than throwing.
      for (const [key, value] of Object.entries(parsed?.entries ?? {})) {
        if (Array.isArray(value)) {
          entries[key] = value.filter(isSnapshot);
        }
      }

      this.cachedDirectory = directory;
      this.cache = { version: FORMAT_VERSION, entries };
      return this.cache;
    } catch (error) {
      console.warn('Could not read code history sidecar, starting fresh:', error);
      this.cachedDirectory = directory;
      this.cache = empty;
      return empty;
    }
  }

  private async persist(directory: string, file: CodeHistoryFile): Promise<void> {
    this.prune(file);

    try {
      if (!(await ensureSidecarDirectory(directory))) return;
      await filesystem.writeJson(this.sidecarPath(directory), file);
    } catch (error) {
      // Losing a snapshot is not worth surfacing; losing the user's code would be.
      console.warn('Could not write code history sidecar:', error);
    }
  }

  /** Drop parameters whose newest snapshot has aged out. */
  private prune(file: CodeHistoryFile): void {
    const cutoff = Date.now() - MAX_AGE_MS;

    for (const [key, history] of Object.entries(file.entries)) {
      const newest = history[history.length - 1];
      const at = newest ? Date.parse(newest.timestamp) : NaN;

      if (!newest || (Number.isFinite(at) && at < cutoff)) {
        delete file.entries[key];
      }
    }
  }

  private sidecarPath(directory: string): string {
    return nodegxPath(directory, SIDECAR_FILE);
  }
}
