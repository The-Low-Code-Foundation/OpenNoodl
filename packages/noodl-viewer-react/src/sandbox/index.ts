/**
 * AIX-008 — Sandbox preview: viewer-side entry
 *
 * Reads the sandbox contract out of the URL and starts the runtime's network
 * shim. Two query parameters, both set by the editor when it opens the preview
 * webview:
 *
 *   `noodl-sandbox=<sessionId>`  register as `sandbox-<sessionId>` so the
 *                                editor feeds this window the staged candidate
 *   `noodl-sandbox-data=real`    the "Real backend" toggle — connect the graph
 *                                to whatever the project is actually configured
 *                                against, no interception
 *
 * The dataset itself is not in the URL; it rides in the export's metadata, so a
 * refined candidate brings new sample data without reloading the window.
 *
 * @module noodl-viewer-react/sandbox
 */

import NoodlRuntime from '@noodl/runtime';
import { installSandbox } from '@noodl/runtime/src/sandbox/install';
import { SANDBOX_METADATA_KEY, type SandboxDataset } from '@noodl/runtime/src/sandbox/types';

export interface SandboxSession {
  sessionId: string;
  /** The client id this window registers with; the editor keys its export off it. */
  clientId: string;
  useSampleData: boolean;
}

export const SANDBOX_CLIENT_PREFIX = 'sandbox-';

export function readSandboxSession(search?: string): SandboxSession | null {
  const query = search ?? (typeof location !== 'undefined' ? location.search : '');
  if (!query) return null;

  const params = new URLSearchParams(query);
  const sessionId = params.get('noodl-sandbox');
  if (!sessionId) return null;

  return {
    sessionId,
    clientId: SANDBOX_CLIENT_PREFIX + sessionId,
    useSampleData: params.get('noodl-sandbox-data') !== 'real'
  };
}

let uninstall: (() => void) | null = null;

/** Install the network shim. Idempotent. */
export function startSandbox(): void {
  if (uninstall) return;
  uninstall = installSandbox(
    () => NoodlRuntime.instance?.getMetaData(SANDBOX_METADATA_KEY) as SandboxDataset | undefined
  );
}

export function stopSandbox(): void {
  if (!uninstall) return;
  uninstall();
  uninstall = null;
}
