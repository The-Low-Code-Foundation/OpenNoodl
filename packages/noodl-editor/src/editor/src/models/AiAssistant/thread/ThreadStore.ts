/**
 * BLD-006 — the thread outlives the panel.
 *
 * BLD-001 moved finished turns out of the sessions and into a `history` array,
 * which is what stopped an accept from deleting the record of the build (D5).
 * But `history` was `useState` **inside `AiAuthoringPanel`**, and that is the
 * shape AIB-003 already learned the hard way one directory over: a sidebar
 * panel is hidden rather than unmounted *most* of the time, and "most of the
 * time" is the kind of lifetime guarantee that becomes a data-loss defect two
 * refactors later. So the conversation moves here, for exactly the reasons
 * `PlanSessionStore`'s header gives, and this is deliberately the same shape
 * rather than a second mechanism beside it.
 *
 * ## Keyed by project, like everything else in this family
 *
 * A thread is about a project's components; it has no meaning against another
 * project. Threads for a project that is not open stay in memory where they
 * were — only the open project has a directory to write to
 * (`installThreadPersistence`).
 *
 * ## What a switch may and may not do
 *
 * ⚠️ **Switching threads never destroys authored output.** The phase-wide rule
 * is that authored output is durable from the moment it validates and no
 * *navigation* may destroy it without the user saying so. Sending a new request
 * is the user saying so (see `AiAuthoringPanel.retire`); opening the dropdown
 * to read yesterday's conversation is not. So this store holds no opinion about
 * live sessions at all, and the panel refuses the switch while anything is
 * live rather than resolving it destructively — a disabled control with a
 * reason beats a staged eight-node component evaporating on a click.
 *
 * @module AiAssistant/thread/ThreadStore
 */

import Model from '../../../../../shared/model';
import {
  byRecency,
  emptyThread,
  isWorthWriting,
  threadTitle,
  type ThreadRecord
} from './threadRecord';
import type { Turn } from './types';

export const THREADS_CHANGED = 'aiThreadsChanged';

/**
 * Where a thread goes so it survives the process.
 *
 * Injected rather than imported, and `null` by default, for the property that
 * makes this gradeable at all: it is a plain model that runs in the plain-Node
 * runner with no filesystem, no Electron and no project on disk. The editor
 * attaches the real one at boot; a spec attaches a recording fake.
 *
 * Fire-and-forget, like `PlanSessionPersistence`: an append happens inside a
 * React state update and has nowhere to report a failure to. The implementation
 * debounces, queues and swallows — see `ThreadSidecar`.
 */
export interface ThreadPersistence {
  save(projectId: string | undefined, thread: ThreadRecord): void;
}

/** What a project's conversations are, and which one is on screen. */
export interface ThreadsState {
  threads: ThreadRecord[];
  currentId: string;
  /**
   * Whether the user picked the current thread, as opposed to the store
   * defaulting to it.
   *
   * ⚠️ This exists because "is the current thread blank?" is **not** the same
   * question as "did anybody choose it?", and a spec caught the two being
   * confused. A restore re-points away from the blank the store minted on first
   * ask — right — but a blank the *user* asked for by pressing New thread is
   * equally blank, and yanking them into last week's conversation because a
   * disk read finished is the opposite of what they said. Not persisted: it is
   * about this sitting, not about the project.
   */
  chosen: boolean;
}

/** The key for a project with no id yet — an unsaved project still has a thread. */
const UNSAVED = '__unsaved__';

/**
 * Drop every empty thread except the one being shown.
 *
 * An empty thread has nothing in it to lose and no way back to it once it is
 * not current, so keeping it means the switcher fills with identical blanks —
 * one per "New thread" the user pressed and changed their mind about, and one
 * per launch, because the store mints a blank before the disk read returns.
 */
function prune(threads: readonly ThreadRecord[], currentId: string): ThreadRecord[] {
  return threads.filter((thread) => thread.id === currentId || isWorthWriting(thread));
}

export class ThreadStore extends Model {
  static instance = new ThreadStore();

  private readonly states = new Map<string, ThreadsState>();
  private readonly savedThreadChecks = new Map<string, Promise<void>>();
  private persistence: ThreadPersistence | null = null;
  private minted = 0;

  /**
   * A project's threads, created with one empty thread on first ask.
   *
   * Returns the live object rather than a copy, like `PlanSessionStore.get`:
   * the panel reads it during render and seeds `useState` initialisers from it.
   */
  get(projectId: string | undefined): ThreadsState {
    const key = projectId ?? UNSAVED;
    let state = this.states.get(key);
    if (!state) {
      const thread = emptyThread(this.mintId(), Date.now());
      state = { threads: [thread], currentId: thread.id, chosen: false };
      this.states.set(key, state);
    }
    return state;
  }

  /** The thread the panel is showing. Never undefined — see {@link get}. */
  current(projectId: string | undefined): ThreadRecord {
    const state = this.get(projectId);
    return state.threads.find((thread) => thread.id === state.currentId) ?? state.threads[0];
  }

  /**
   * Add finished turns to the current thread.
   *
   * ⚠️ Turns arrive **frozen and re-prefixed** — `retireLive` has already
   * stripped `busy` and moved every id under `history-N-`, and that prefix is
   * the only thing stopping a restored turn from mounting a live Accept button
   * (see `liveTurns` — *the prefix is the liveness*). This store does not
   * re-key them, and must not: a renumbering here would be indistinguishable
   * from a live id on the next launch.
   *
   * Appending nothing is a no-op rather than a touch, so a send that produced
   * no turns does not bump a thread to the top of the switcher.
   */
  append(projectId: string | undefined, turns: readonly Turn[]): ThreadRecord {
    const current = this.current(projectId);
    if (turns.length === 0) return current;

    const next: ThreadRecord = {
      ...current,
      turns: [...current.turns, ...turns],
      updatedAt: Date.now()
    };
    next.title = threadTitle(next.turns);
    return this.replace(projectId, next);
  }

  /**
   * Start a new conversation and switch to it.
   *
   * The empty thread the user left behind is dropped rather than kept: pressing
   * "New thread" twice should not leave two identical blanks in the dropdown,
   * and an empty thread has, by construction, nothing in it to lose.
   */
  newThread(projectId: string | undefined): ThreadRecord {
    const state = this.get(projectId);
    const thread = emptyThread(this.mintId(), Date.now());
    this.publish(projectId, { threads: prune([...state.threads, thread], thread.id), currentId: thread.id, chosen: true });
    return thread;
  }

  /** Show an existing thread. Unknown ids are ignored rather than clearing. */
  select(projectId: string | undefined, threadId: string): void {
    const state = this.get(projectId);
    if (state.currentId === threadId) return;
    if (!state.threads.some((thread) => thread.id === threadId)) return;
    this.publish(projectId, { ...state, currentId: threadId, chosen: true });
  }

  /**
   * Seed a project's threads from disk.
   *
   * Merged rather than replaced, and that is not tidiness: the panel can have
   * mounted and started a conversation before the read comes back, and throwing
   * that away would lose the turn the user is looking at to a disk that was
   * slow. Anything already in memory wins — it is newer by definition.
   *
   * The current thread is only re-pointed when the in-memory one is still the
   * blank the store created on first ask. Someone who has already typed does
   * not get yanked into last week's conversation because a read finished.
   *
   * ⚠️ And that blank is then **pruned**, which the drive is what caught. The
   * store mints one on first `get()`, the read comes back a moment later and
   * re-points away from it — leaving an empty *"New thread"* sitting in the
   * switcher above three real conversations, on every launch, forever. It was
   * invisible to the specs because they all seeded a thread that had something
   * in it, which is the one case where nothing needs pruning.
   */
  restore(projectId: string | undefined, restored: readonly ThreadRecord[]): void {
    const state = this.get(projectId);
    const known = new Set(state.threads.map((thread) => thread.id));
    const incoming = restored.filter((thread) => !known.has(thread.id) && isWorthWriting(thread));
    if (incoming.length === 0) return;

    const adrift = !state.chosen && !isWorthWriting(this.current(projectId));
    const currentId = adrift ? byRecency(incoming)[0].id : state.currentId;
    this.publish(projectId, { ...state, threads: prune([...state.threads, ...incoming], currentId), currentId });
  }

  /**
   * Read the saved threads at most once per project.
   *
   * The same shape — and the same reason — as
   * `PlanSessionStore.consultSavedBuild`: reading needs a project directory,
   * which this store does not have, and *whether to ask again* outlives every
   * mount. A failed read counts as asked, or a project with one unreadable file
   * re-reads its directory on every render.
   */
  consultSavedThreads(projectId: string | undefined, check: () => Promise<void>): Promise<void> {
    const key = projectId ?? UNSAVED;
    let pending = this.savedThreadChecks.get(key);
    if (!pending) {
      pending = check().catch((error) => {
        console.warn('Could not read the saved AI conversations:', error);
      });
      this.savedThreadChecks.set(key, pending);
    }
    return pending;
  }

  attachPersistence(persistence: ThreadPersistence | null): void {
    this.persistence = persistence;
  }

  /** Swap one thread for an updated copy, keeping the rest and the selection. */
  private replace(projectId: string | undefined, thread: ThreadRecord): ThreadRecord {
    const state = this.get(projectId);
    const threads = state.threads.map((existing) => (existing.id === thread.id ? thread : existing));
    this.publish(projectId, { ...state, threads, currentId: state.currentId });
    if (isWorthWriting(thread)) this.persistence?.save(projectId, thread);
    return thread;
  }

  private publish(projectId: string | undefined, state: ThreadsState): void {
    this.states.set(projectId ?? UNSAVED, state);
    this.notifyListeners(THREADS_CHANGED, { projectId, state });
  }

  /**
   * An id that is also a filename.
   *
   * Time-ordered so a directory listing reads in the order the conversations
   * happened, with a counter because two threads can be minted inside one
   * millisecond and a collision would silently overwrite a file.
   */
  private mintId(): string {
    this.minted += 1;
    return `${Date.now().toString(36)}-${this.minted.toString(36)}`;
  }
}
