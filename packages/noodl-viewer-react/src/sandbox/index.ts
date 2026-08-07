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
 *   `noodl-sandbox-auth=out`     POL-008 — preview the signed-*out* branch.
 *                                Signed in is the default, because a profile
 *                                page is the ordinary case and it must work
 *                                with no clicks.
 *
 * The dataset itself is not in the URL; it rides in the export's metadata, so a
 * refined candidate brings new sample data without reloading the window.
 *
 * @module noodl-viewer-react/sandbox
 */

import NoodlRuntime from '@noodl/runtime';
import { installSandbox } from '@noodl/runtime/src/sandbox/install';
import { seedSandboxSession } from '@noodl/runtime/src/sandbox/session';
import { SANDBOX_METADATA_KEY, type SandboxDataset } from '@noodl/runtime/src/sandbox/types';

export interface SandboxSession {
  sessionId: string;
  /** The client id this window registers with; the editor keys its export off it. */
  clientId: string;
  useSampleData: boolean;
  /** POL-008: whether the preview runs as the sample user or signed out. */
  signedIn: boolean;
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
    useSampleData: params.get('noodl-sandbox-data') !== 'real',
    signedIn: params.get('noodl-sandbox-auth') !== 'out'
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

/**
 * POL-008 — write the session the dataset describes, so the sandbox is signed in.
 *
 * ⚠️ **Not at `startSandbox()` time.** The session key is
 * `Parse/<publicToken>/currentUser` and the token comes out of the *export's*
 * metadata, which has not arrived when the shim is installed — the shim goes in
 * before the runtime is constructed, deliberately, so no node can reach a real
 * backend even once. So this hangs off `metadataChanged` instead, which is
 * early enough: `UserService` is a lazy singleton, first constructed when a
 * `User` node initialises, and nodes are instantiated after the graph is
 * imported.
 *
 * Re-running on every metadata change is the point rather than an accident: a
 * refined candidate ships a new dataset, and the stored session has to follow
 * it instead of describing the user the previous export invented.
 */
export function attachSandboxSession(runtime: NoodlRuntimeLike, signedIn: boolean): void {
  const seed = () =>
    seedSandboxSession(
      runtime.getMetaData(SANDBOX_METADATA_KEY) as SandboxDataset | undefined,
      {
        cloudservices: runtime.getMetaData('cloudservices') as { appId?: string } | undefined,
        backendServices: runtime.getMetaData('backendServices') as
          | { backends?: Array<{ auth?: { publicToken?: string } }> }
          | undefined
      },
      signedIn
    );

  runtime.graphModel?.on('metadataChanged', seed);
  seed();
}

/**
 * The half of `NoodlRuntime` this file needs.
 *
 * Structural rather than the real type because `noodl-runtime.ts` is untyped
 * JavaScript with a hand-written declaration, and naming two methods is cheaper
 * and more honest than asserting the whole class.
 */
export interface NoodlRuntimeLike {
  getMetaData(key: string): unknown;
  graphModel?: { on(event: string, listener: () => void): void };
}
