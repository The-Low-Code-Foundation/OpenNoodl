/**
 * AAQ-011 / F10, slice 4 — what the user sees while the backend starts.
 *
 * Auto-starting a child process on project open is only defensible if it is
 * *visible*. Starting a `nodegx-backend` is a spawn plus a READY handshake with a
 * 15-second ceiling, and until this existed the whole of it happened behind a
 * silent editor: a project whose backend failed to start looked exactly like one
 * whose backend was fine, right up until a Record node failed.
 *
 * Three rules, and the first is the one that keeps this from being noise:
 *
 * 1. **The spinner is delayed.** A start that finishes inside
 *    {@link SPINNER_DELAY_MS} shows nothing at all. A toast that appears and
 *    vanishes inside 300ms is a flicker the user reads as a glitch, and this
 *    fires on *every* project open — the most repeated moment in the editor.
 * 2. **Success is silent.** The backend running is the expected state; saying so
 *    every time trains people to dismiss the toast that matters.
 * 3. **Failure is loud, sticky, and says where to go.** `showError` defaults to
 *    no auto-dismiss, and the action opens Backend Services, which is where the
 *    Start button and the persistence error live.
 *
 * Kept out of `ProjectBackendLifecycle` on purpose: that module's decisions are
 * asserted in a spec that runs without React, and importing the toast layer
 * would drag `react-hot-toast` into it. This subscribes to the state event
 * instead — the same seam the Backend Services panel could use.
 *
 * @module noodl-editor/services/projectBackendStatusToasts
 */

import { SidebarModel } from '@noodl-models/sidebar';

import { EventDispatcher } from '../../../shared/utils/EventDispatcher';
import { ToastLayer } from '../views/ToastLayer/ToastLayer';
import { PROJECT_BACKEND_STATE_CHANGED, type ProjectBackendState } from './ProjectBackendLifecycle';

/** One id, so a second project open replaces the first one's spinner. */
const TOAST_ID = 'project-backend-start';

/** Below this, a start is fast enough that showing anything is worse than not. */
export const SPINNER_DELAY_MS = 600;

/** The sidebar id Backend Services is registered under (router.setup.ts:277). */
const BACKEND_SERVICES_PANEL_ID = 'backend-services';

/**
 * The pure half: what should be on screen for this state, given whether a
 * spinner is currently up. Exported so the rules can be asserted without a DOM.
 */
export type ToastIntent =
  | { kind: 'none' }
  | { kind: 'spinner-after-delay'; message: string }
  | { kind: 'hide' }
  | { kind: 'error'; message: string; title: string };

export function intentFor(state: ProjectBackendState): ToastIntent {
  switch (state.phase) {
    case 'starting':
      return {
        kind: 'spinner-after-delay',
        message: `Starting ${state.backendName || 'the project backend'}…`
      };
    case 'running':
    case 'adopted':
    case 'idle':
      return { kind: 'hide' };
    case 'failed':
      return {
        kind: 'error',
        title: `${state.backendName || 'The project backend'} could not be started`,
        message:
          `${state.error || 'The backend service did not start.'}\n\n` +
          'Data nodes and the Data Browser will not work until it is running.'
      };
    default:
      return { kind: 'none' };
  }
}

let installed = false;
let pendingSpinner: ReturnType<typeof setTimeout> | null = null;
let spinnerShown = false;

function clearSpinner() {
  if (pendingSpinner) {
    clearTimeout(pendingSpinner);
    pendingSpinner = null;
  }
  if (spinnerShown) {
    ToastLayer.hideActivity(TOAST_ID);
    spinnerShown = false;
  }
}

export function applyIntent(intent: ToastIntent): void {
  switch (intent.kind) {
    case 'spinner-after-delay':
      clearSpinner();
      pendingSpinner = setTimeout(() => {
        pendingSpinner = null;
        spinnerShown = true;
        ToastLayer.showActivity(intent.message, TOAST_ID);
      }, SPINNER_DELAY_MS);
      break;
    case 'hide':
      clearSpinner();
      break;
    case 'error':
      clearSpinner();
      ToastLayer.showError(intent.message, {
        title: intent.title,
        actions: [
          {
            label: 'Open Backend Services',
            onClick: () => SidebarModel.instance.switch(BACKEND_SERVICES_PANEL_ID)
          }
        ]
      });
      break;
    case 'none':
    default:
      break;
  }
}

/** Subscribe the toasts to the lifecycle service. Idempotent. */
export function installProjectBackendStatusToasts(): void {
  if (installed) return;
  installed = true;

  EventDispatcher.instance.on(
    PROJECT_BACKEND_STATE_CHANGED,
    (state: ProjectBackendState) => applyIntent(intentFor(state)),
    // No group to unbind: this lives for the lifetime of the editor window, the
    // same as the service it listens to.
    {}
  );
}
