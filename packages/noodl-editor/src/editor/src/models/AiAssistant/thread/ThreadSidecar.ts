/**
 * BLD-006 — the conversation, on disk.
 *
 * `<project>/.nodegx/threads/<id>.jsonl`. One file per thread, beside the
 * unapplied build that `PlanSessionSidecar` writes to `.nodegx/plan/`, and
 * sharing its directory rules: created on first write, gitignored on first
 * write, excluded from the deploy walk (`compilation/build/ignore.ts`), never
 * inside the project's own files.
 *
 * ⚠️ **The task doc said `.noodl/ai-threads/`.** There is no `.noodl/` anywhere
 * in this codebase — the sidecar directory is `.nodegx/` and has been since the
 * rebrand, with one helper (`utils/nodegxSidecar`) that both existing writers go
 * through precisely so that "make sure git ignores it" cannot exist in two
 * copies that disagree. Inventing a second scratch directory to match a path in
 * a task doc would have shipped a folder nothing gitignores. Q2's *decision* —
 * machine records, not prose; not in a pull request — is honoured exactly.
 *
 * ## Why the writes are debounced and queued
 *
 * Same answer as `PlanSessionSidecar`, one level up: an append lands on every
 * accept, discard and send, a thread is tens of kilobytes once it has a few
 * builds in it, and `CodeHistoryStore` already settled the shape — coalesce on
 * a trailing timer, chain the timer's callback behind the previous write rather
 * than racing it.
 *
 * ⚠️ **And unlike the plan sidecar's, this `flush()` has a caller.** AIB-003
 * built one "for the quit path" and nothing ever called it, so a build staged
 * inside the last 750ms of a session never reached disk. Both are wired now —
 * see `installThreadPersistence`.
 *
 * @module AiAssistant/thread/ThreadSidecar
 */

import { filesystem } from '@noodl/platform';

import { ensureSidecarDirectory, sidecarPath } from '../../../utils/nodegxSidecar';
import { parseThreadFile, serialiseThread, type ThreadRecord } from './threadRecord';

const THREADS_DIR = 'threads';
const EXTENSION = '.jsonl';

/** Long enough to coalesce a burst, short enough to be there after a crash. */
const WRITE_DEBOUNCE_MS = 750;

/**
 * How many conversations one project's directory is read back at a time.
 *
 * Not an eviction policy: **nothing is ever deleted**, and what is skipped is
 * logged rather than quietly dropped. It is a bound on the work a panel mount
 * does, and the files are named by mint time so the newest are the ones read.
 */
export const THREAD_READ_LIMIT = 25;

export class ThreadSidecar {
  static instance = new ThreadSidecar();

  /**
   * Threads waiting to be written, by absolute file path.
   *
   * The project directory is carried alongside rather than recovered from the
   * path: `.nodegx/threads/x.jsonl` is three segments up, and a rule like
   * "two `dirname`s" is one directory-layout change away from writing a
   * project's conversations into its parent folder.
   */
  private pending = new Map<string, { projectDirectory: string; thread: ThreadRecord }>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private queue: Promise<unknown> = Promise.resolve();

  /**
   * Every readable thread in a project, newest file first.
   *
   * An unreadable or foreign file is skipped, never thrown: a directory people
   * can open and hand-edit will eventually contain something that is not a
   * thread, and the panel must still open.
   */
  async readAll(projectDirectory: string): Promise<ThreadRecord[]> {
    const directory = sidecarPath(projectDirectory, THREADS_DIR);
    if (!filesystem.exists(directory)) return [];

    let entries: { fullPath: string; name: string; isDirectory: boolean }[];
    try {
      entries = await filesystem.listDirectory(directory);
    } catch (error) {
      console.warn('Could not list the saved AI conversations:', error);
      return [];
    }

    const files = entries
      .filter((entry) => !entry.isDirectory && entry.name.endsWith(EXTENSION))
      // Ids are `<base36 ms>-<counter>`, so a plain descending sort on the name
      // is newest-first without opening anything.
      .sort((a, b) => b.name.localeCompare(a.name));

    if (files.length > THREAD_READ_LIMIT) {
      console.info(
        `${files.length} saved AI conversations in ${directory}; reading the ${THREAD_READ_LIMIT} newest. ` +
          'The rest are still on disk and none have been deleted.'
      );
    }

    const threads: ThreadRecord[] = [];
    for (const file of files.slice(0, THREAD_READ_LIMIT)) {
      try {
        const thread = parseThreadFile(await filesystem.readFile(file.fullPath));
        if (thread) threads.push(thread);
      } catch (error) {
        console.warn(`Could not read the AI conversation ${file.name}, skipping it:`, error);
      }
    }
    return threads;
  }

  write(projectDirectory: string, thread: ThreadRecord): void {
    this.pending.set(this.path(projectDirectory, thread.id), { projectDirectory, thread });
    this.schedule();
  }

  /** Write everything outstanding now. For the quit path, and for tests. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.drain();
    await this.queue;
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.drain();
    }, WRITE_DEBOUNCE_MS);
  }

  private drain(): void {
    if (this.pending.size === 0) return;
    const batch = [...this.pending.entries()];
    this.pending.clear();
    for (const [path, { projectDirectory, thread }] of batch) {
      this.enqueue(() => this.persist(projectDirectory, path, thread));
    }
  }

  private enqueue(work: () => Promise<void>): void {
    // `.then(work, work)` keeps the chain running past a rejected link — one
    // unwritable project must not stop another.
    this.queue = this.queue.then(work, work).catch(() => undefined);
  }

  private async persist(projectDirectory: string, path: string, thread: ThreadRecord): Promise<void> {
    try {
      const directory = await ensureSidecarDirectory(projectDirectory, THREADS_DIR);
      if (!directory) return;
      await filesystem.writeFileOverride(path, serialiseThread(thread));
    } catch (error) {
      // Losing the sidecar loses a restart's worth of history; throwing here
      // would reach a React state update in the panel.
      console.warn('Could not save the AI conversation:', error);
    }
  }

  private path(projectDirectory: string, threadId: string): string {
    return sidecarPath(projectDirectory, THREADS_DIR, `${threadId}${EXTENSION}`);
  }
}
