/**
 * WFA-001 — pushes the project's cloud functions to the running local backends.
 *
 * This is the fourth cut the phase-27 scoping found: `backend:update-workflow`
 * has existed and worked since WF-004 and **had no caller**, so a backend
 * started from the Backend Services panel reported `functions: []` no matter
 * what the project contained (finding F6). Everything phases 19 and 22 built
 * was reachable only by hand-writing a bundle into a data directory.
 *
 * ## When it pushes
 *
 * - **On save** (`ProjectModel.projectSavedToDisk`), if the cloud export's hash
 *   changed. Autosave fires ~1s after any model change, so the hash is what
 *   keeps editing a browser component from redeploying every function.
 * - **On backend start**, so a backend started after the project was opened
 *   ends up with the project's functions rather than an empty list.
 * - **On demand**, from the Backend Services card.
 *
 * On-save was chosen over an explicit deploy button for feel; the spec's
 * objection to it — that a broken function silently replaces a working one — is
 * answered by making the result visible (`deployStateChanged` drives the card,
 * and a failure raises a toast) rather than by making the push manual. Silence
 * was the problem, not the automation.
 *
 * A backend is *not* asked which projects it serves: `BackendManager` writes
 * `projectIds: []` at creation and nothing ever adds to it, so "the project's
 * backends" is, today, every running local backend.
 *
 * @module noodl-editor/services/CloudFunctionDeployer
 */

import { ipcInvoke } from '@noodl-utils/ipc';
import { ProjectModel } from '@noodl-models/projectmodel';

import { EventDispatcher } from '../../../shared/utils/EventDispatcher';
import {
  CloudComponentClassification,
  classifyCloudComponents,
  cloudBundleName,
  exportCloudFunctionsWithKits,
  getCloudFunctionNames,
  hashCloudExport
} from '../utils/exporter/cloudFunctions';
import { ToastLayer } from '../views/ToastLayer/ToastLayer';

/** Emitted whenever {@link CloudFunctionDeployer.getState} changes. */
export const CLOUD_FUNCTIONS_DEPLOY_STATE_CHANGED = 'CloudFunctionDeployer.stateChanged';

export interface CloudDeployState {
  /** Function names in the project right now, whether or not they are pushed. */
  functionNames: string[];
  /**
   * DEF-015 — the same components, each with the role that decides whether the
   * backend not serving it is news. `functionNames` is what the bundle carries;
   * this is what the backend can be *asked* about, and the card must diff on
   * the endpoints alone or it warns about every helper in every project.
   */
  cloudComponents: CloudComponentClassification[];
  /** `Date.now()` of the last successful push, per backend id. */
  lastPushedAt: Record<string, number>;
  /** Last push error, per backend id. Cleared by a success. */
  lastError: Record<string, string>;
  /** True while a push is in flight. */
  isPushing: boolean;
}

async function invokeIPC<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcInvoke<T>(channel, ...args);
}

class CloudFunctionDeployerImpl {
  /** Hash of the bundle last pushed successfully, per backend id. */
  private pushedHashes = new Map<string, string>();
  private lastPushedAt: Record<string, number> = {};
  private lastError: Record<string, string> = {};
  private isPushing = false;
  private started = false;

  public start(): void {
    if (this.started) return;
    this.started = true;

    EventDispatcher.instance.on(
      'ProjectModel.projectSavedToDisk',
      () => {
        // Fire-and-forget: a save must not wait on a backend, and a push
        // failure is reported through the state rather than thrown at the save.
        this.pushToAllRunning({ reason: 'save' }).catch(() => undefined);
      },
      this
    );

    // A different project means different functions, and hashes from the old
    // one would suppress the first push of the new one.
    EventDispatcher.instance.on(
      'ProjectModel.instanceHasChanged',
      () => {
        this.pushedHashes.clear();
        this.lastPushedAt = {};
        this.lastError = {};
        this.notify();
      },
      this
    );
  }

  public getState(): CloudDeployState {
    return {
      functionNames: ProjectModel.instance ? getCloudFunctionNames(ProjectModel.instance) : [],
      cloudComponents: ProjectModel.instance ? classifyCloudComponents(ProjectModel.instance) : [],
      lastPushedAt: { ...this.lastPushedAt },
      lastError: { ...this.lastError },
      isPushing: this.isPushing
    };
  }

  /**
   * Push to one backend.
   *
   * @param force ignore the change hash — used by the manual action and by
   *   backend start, where the backend's state is unknown rather than known to
   *   match.
   */
  public async pushToBackend(backendId: string, options: { force?: boolean; quiet?: boolean } = {}): Promise<boolean> {
    const project = ProjectModel.instance;
    if (!project) return false;

    /**
     * `null` means the project genuinely has no cloud functions — and it must
     * mean *only* that. The first version of this let an export failure return
     * the same `null`, and the result was the exact silence WFA-001 exists to
     * remove: the backend came up with `functions: []`, the editor believed it
     * had nothing to send, and nothing anywhere said so. If there are
     * components but no bundle, that is a bug, not an empty project.
     */
    const bundle = await exportCloudFunctionsWithKits(project);
    const functionCount = getCloudFunctionNames(project).length;
    if (!bundle && functionCount > 0) {
      const message = `Could not export ${functionCount} cloud function(s) from this project.`;
      this.lastError[backendId] = message;
      if (!options.quiet) ToastLayer.showError(message);
      this.notify();
      return false;
    }

    const hash = hashCloudExport(bundle);

    if (!options.force && this.pushedHashes.get(backendId) === hash) {
      return true;
    }

    // Nothing to push, and nothing was ever pushed: don't create an empty
    // bundle file on a backend that has never seen this project.
    if (!bundle && !this.pushedHashes.has(backendId)) {
      this.pushedHashes.set(backendId, hash);
      return true;
    }

    this.isPushing = true;
    this.notify();

    try {
      const result = await invokeIPC<{ success?: boolean; error?: string }>('backend:update-workflow', {
        backendId,
        name: cloudBundleName(project),
        // An emptied project still pushes — a bundle with no components is how
        // "I deleted my last function" reaches the backend.
        workflow: bundle ?? { components: [], settings: {}, metadata: {} }
      });

      if (result && result.success === false) {
        throw new Error(result.error || 'The backend rejected the function bundle.');
      }

      this.pushedHashes.set(backendId, hash);
      this.lastPushedAt[backendId] = Date.now();
      delete this.lastError[backendId];
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // The hash is deliberately NOT recorded: the next save must retry.
      this.lastError[backendId] = message;
      if (!options.quiet) {
        ToastLayer.showError(`Could not deploy cloud functions: ${message}`);
      }
      console.error('[CloudFunctionDeployer] push failed', backendId, error);
      return false;
    } finally {
      this.isPushing = false;
      this.notify();
    }
  }

  /** Push to every running local backend. */
  public async pushToAllRunning(options: { force?: boolean; reason?: string } = {}): Promise<void> {
    if (!ProjectModel.instance) return;

    let backends: { id: string }[];
    try {
      backends = (await invokeIPC<{ id: string }[]>('backend:list')) || [];
    } catch {
      // No backend subsystem (or none configured) is not an error worth a toast
      // on every save.
      return;
    }

    for (const backend of backends) {
      let running = false;
      try {
        const status = await invokeIPC<{ running?: boolean }>('backend:status', backend.id);
        running = Boolean(status && status.running);
      } catch {
        running = false;
      }

      if (!running) continue;

      // An autosave-driven push is quiet on failure only for backends that were
      // already failing; the first failure still tells the user.
      await this.pushToBackend(backend.id, {
        force: options.force,
        quiet: options.reason === 'save' && Boolean(this.lastError[backend.id])
      });
    }
  }

  /**
   * Called right after a backend starts. Always forced: a freshly started
   * backend has loaded whatever was on disk, which may be nothing (F6) or a
   * bundle from a previous session.
   */
  public async onBackendStarted(backendId: string): Promise<void> {
    this.pushedHashes.delete(backendId);
    await this.pushToBackend(backendId, { force: true });
  }

  private notify(): void {
    EventDispatcher.instance.notifyListeners(CLOUD_FUNCTIONS_DEPLOY_STATE_CHANGED, this.getState());
  }
}

export const CloudFunctionDeployer = new CloudFunctionDeployerImpl();
