/**
 * AAQ-011 / F10 — the project's backend follows the project.
 *
 * ## The defect
 *
 * Nothing started a project's backend when the project was opened. `backend:start`
 * had exactly two callers — `provisionBackend.ts` (once, at the moment the AI
 * plan creates it) and the Backend Services panel's Start button — and neither is
 * on the project-open path. So a wizard-built app reopened the next day was dead:
 * Record nodes failed, the Data Browser could not count rows, and the only repair
 * was finding a panel most users have never opened and pressing Start.
 *
 * ## What this does, and what it deliberately does not
 *
 * On every `ProjectModel.instanceHasChanged` it reconciles one fact — *the open
 * project's bound backend should be running* — in both directions:
 *
 * - **Start** the backend the open project is bound to, if it is a local one and
 *   it is not already up.
 * - **Adopt** it instead, if it is already running. Nothing is restarted. A
 *   backend that is up is serving requests and holding open SSE streams, and a
 *   restart to reach an identical state is a way to drop them for nothing. The
 *   consequence is recorded below: an adopted backend is not stopped on close,
 *   because we did not start it.
 * - **Stop** a backend *we* started once its project is no longer open.
 *
 * It does **not** touch a backend the user started by hand, and it does not touch
 * a project bound to Noodl Cloud or to any endpoint that is not a local backend
 * on this machine — the test for "local" is membership of `backend:list`, which
 * is authoritative, rather than the `type` field, which predates the local
 * backend and is absent on older bindings.
 *
 * ## Why stopping on close is the smaller half
 *
 * Richard's constraint on this task is that no orphan may survive *any* stop
 * case, including the ones that run no handler at all. This close path is the
 * happy one; the guarantee lives in `BackendProcessRegistry` (main process),
 * which records every spawn durably and reaps the unowned survivors at the next
 * launch. Read that module before changing anything here.
 *
 * ## Two windows, two tabs, two editors
 *
 * The editor takes `app.requestSingleInstanceLock()` (`main.js:176`) and runs one
 * window, so "the same project open twice" is not reachable today; project tabs
 * are in-renderer and share this one `ProjectModel.instance`. Even so, nothing
 * here assumes it:
 *
 * - Starting is idempotent at the main process — `BackendManager.startBackend`
 *   returns the current status for a backend that is already running — so a
 *   second opener adopts rather than double-spawns.
 * - Stopping is guarded by {@link ourStarts}: this service stops only the ids it
 *   started itself, in this session.
 * - Across *processes*, the spawn record's owner field is what keeps one editor
 *   from reaping another's backends.
 *
 * @module noodl-editor/services/ProjectBackendLifecycle
 */

import { getIpc } from '@noodl-utils/ipc';
import { ProjectModel } from '@noodl-models/projectmodel';
import { getCloudServices } from '@noodl-models/projectmodel.editor';

import { EventDispatcher } from '../../../shared/utils/EventDispatcher';
import { CloudFunctionDeployer } from './CloudFunctionDeployer';

/** Emitted whenever {@link ProjectBackendLifecycle.getState} changes. */
export const PROJECT_BACKEND_STATE_CHANGED = 'ProjectBackendLifecycle.stateChanged';

export type ProjectBackendPhase =
  /** No open project, or one that is not bound to a local backend. */
  | 'idle'
  /** A start is in flight. This is the phase a surface must not render as frozen. */
  | 'starting'
  /** We started it, and it answered. */
  | 'running'
  /** It was already running when the project opened; left alone, and will be left alone on close. */
  | 'adopted'
  /** The start was attempted and failed. `error` says why. */
  | 'failed';

export interface ProjectBackendState {
  phase: ProjectBackendPhase;
  backendId?: string;
  backendName?: string;
  /** Present once the backend is answering. */
  endpoint?: string;
  /** Set only in `failed`. A sentence, not a code. */
  error?: string;
}

interface LocalBackendMeta {
  id: string;
  name: string;
  port: number;
}

interface BackendStatus {
  running: boolean;
  port?: number;
  endpoint?: string;
}

async function invokeIPC<T>(channel: string, ...args: unknown[]): Promise<T> {
  const ipc = getIpc();
  if (!ipc) throw new Error(`This build has no connection to its main process, so "${channel}" is unavailable.`);
  return (await ipc.invoke(channel, ...args)) as T;
}

/**
 * Everything this service does to the world outside itself.
 *
 * Injectable because the *decisions* are the whole of it — adopt or start, stop
 * or leave alone, whose start it was — and none of them can be asserted through
 * a real IPC channel: the editor's Jasmine suite runs in a renderer with no
 * `window.require`, so `getIpc()` is `null` there and every real call would be a
 * no-op that passes for the wrong reason.
 */
export interface ProjectBackendLifecycleDeps {
  hasIpc(): boolean;
  invoke<T>(channel: string, ...args: unknown[]): Promise<T>;
  /** The bound backend id of the open project, or undefined. */
  boundBackendId(): string | undefined;
  notify(state: ProjectBackendState): void;
  /** WFA-001's post-start push. Failures here never make the backend look dead. */
  onBackendStarted(backendId: string): Promise<unknown>;
}

const defaultDeps: ProjectBackendLifecycleDeps = {
  hasIpc: () => !!getIpc(),
  invoke: invokeIPC,
  boundBackendId: () => {
    const project = ProjectModel.instance;
    return project ? getCloudServices(project).id : undefined;
  },
  notify: (state) => EventDispatcher.instance.notifyListeners(PROJECT_BACKEND_STATE_CHANGED, state),
  onBackendStarted: (backendId) => CloudFunctionDeployer.onBackendStarted(backendId)
};

export class ProjectBackendLifecycleImpl {
  private deps: ProjectBackendLifecycleDeps;
  private installed = false;
  private state: ProjectBackendState = { phase: 'idle' };

  /**
   * Backend ids this service started in this session — and therefore the only
   * ids it may stop. A backend the user started from Backend Services, or one
   * that was already up when the project opened, is never in here.
   */
  private ourStarts = new Set<string>();

  /**
   * Reconciles are serialised through this, and each one carries a generation.
   * Two project changes in quick succession (open a project, go back, open
   * another) must not leave the *first* one's start writing state after the
   * second one's, which is how a panel ends up saying "starting Puppies" about a
   * project that is no longer open.
   */
  private generation = 0;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(deps: Partial<ProjectBackendLifecycleDeps> = {}) {
    this.deps = { ...defaultDeps, ...deps };
  }

  public install(): void {
    if (this.installed) return;
    this.installed = true;

    EventDispatcher.instance.on(
      'ProjectModel.instanceHasChanged',
      () => {
        this.reconcile();
      },
      this
    );

    // The first project of a session is opened before this runs in some launch
    // orders (a project passed on the command line, a lesson), so do not wait
    // for an event that has already fired.
    this.reconcile();
  }

  public getState(): ProjectBackendState {
    return { ...this.state };
  }

  /**
   * Bring the running backends in line with the open project. Safe to call at
   * any time; calls are serialised and only the newest one may write state.
   */
  public reconcile(): Promise<void> {
    const generation = ++this.generation;
    const run = this.queue.then(() => this.run(generation)).catch(() => undefined);
    this.queue = run;
    return run;
  }

  /** For specs: forget everything without touching any backend. */
  public resetForTests(): void {
    this.ourStarts.clear();
    this.state = { phase: 'idle' };
    this.generation = 0;
    this.queue = Promise.resolve();
  }

  private setState(generation: number, next: ProjectBackendState): void {
    // A stale reconcile has nothing true left to say.
    if (generation !== this.generation) return;
    this.state = next;
    this.deps.notify(next);
  }

  private async run(generation: number): Promise<void> {
    // No main process (the Jasmine suite, a web build): there is nothing to
    // start and nothing to apologise for.
    if (!this.deps.hasIpc()) return;

    const wantedId = this.deps.boundBackendId();

    // ── Stop what we started for a project that is no longer open ───────────
    for (const id of Array.from(this.ourStarts)) {
      if (id === wantedId) continue;
      this.ourStarts.delete(id);
      try {
        await this.deps.invoke('backend:stop', id);
      } catch (e) {
        // A stop that failed is not a user-facing event — but it IS the case
        // the reaper exists for, and its record is deliberately still on disk.
        console.log('[ProjectBackendLifecycle] Could not stop backend', id, e);
      }
    }

    if (!wantedId) {
      this.setState(generation, { phase: 'idle' });
      return;
    }

    // ── Is this a local backend at all? ────────────────────────────────────
    let meta: LocalBackendMeta | undefined;
    try {
      const backends = await this.deps.invoke<LocalBackendMeta[]>('backend:list');
      meta = (backends ?? []).find((b) => b.id === wantedId);
    } catch (e) {
      this.setState(generation, { phase: 'idle' });
      return;
    }
    if (!meta) {
      // Noodl Cloud, a self-hosted endpoint, or a local backend that has been
      // deleted. None of them is ours to start.
      this.setState(generation, { phase: 'idle' });
      return;
    }
    if (generation !== this.generation) return;

    // ── Already up? Adopt it. ──────────────────────────────────────────────
    try {
      const status = await this.deps.invoke<BackendStatus>('backend:status', meta.id);
      if (status?.running) {
        this.setState(generation, {
          phase: 'adopted',
          backendId: meta.id,
          backendName: meta.name,
          endpoint: status.endpoint ?? `http://localhost:${status.port ?? meta.port}`
        });
        return;
      }
    } catch (e) {
      // Treat an unreadable status as "not running" and try to start it; the
      // start is the loud one, and it is where the error belongs.
    }
    if (generation !== this.generation) return;

    // ── Start it ───────────────────────────────────────────────────────────
    this.setState(generation, { phase: 'starting', backendId: meta.id, backendName: meta.name });
    try {
      const status = await this.deps.invoke<BackendStatus>('backend:start', meta.id, {});
      this.ourStarts.add(meta.id);

      // WFA-001's rule, and it applies here for the same reason it applies to
      // the panel's Start button: a backend loads its workflows from disk at
      // start, so without this it comes up with whatever the last session left
      // rather than what this project contains. Not awaited into the failure
      // path — a function push that fails must not make the backend look dead.
      this.deps.onBackendStarted(meta.id).catch(() => undefined);

      this.setState(generation, {
        phase: 'running',
        backendId: meta.id,
        backendName: meta.name,
        endpoint: status?.endpoint ?? `http://localhost:${status?.port ?? meta.port}`
      });
    } catch (error) {
      this.setState(generation, {
        phase: 'failed',
        backendId: meta.id,
        backendName: meta.name,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const ProjectBackendLifecycle = new ProjectBackendLifecycleImpl();
