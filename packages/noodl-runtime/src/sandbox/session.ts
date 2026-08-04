/**
 * POL-008 — Sandbox preview: the signed-in session
 *
 * `installSandbox` intercepts **the network and only the network**. That was
 * enough for every data node, which asks the backend a question and gets the
 * dataset's answer — and it was not enough for the user, because
 * `UserService`'s constructor asks the *session store* first and only issues
 * `GET /users/me` `if (currentUser)`. Nothing wrote one, so a fresh sandbox
 * window had no session, `UserService.current` stayed `undefined`, the `User`
 * node's `_internal.model` was never set, and `username`/`email` returned
 * `undefined` — leaving every bound Text showing its design-time parameter
 * under a toolbar reading *"Sample data — signed in as a sample user"*.
 *
 * Reported as *"I clicked 'sample data' and nothing came up"*. The dataset was
 * there, complete, with a `sessionToken` in it. Nobody ever asked for it.
 *
 * So this is the second half of the seam: write the session the sandbox's own
 * dataset already describes, and let the existing `/users/me` interception do
 * the rest. No node grows a sandbox branch.
 *
 * ## ⚠️ Why every candidate key is written, not the one right key
 *
 * `UserService` reads `Parse/<publicToken>/currentUser`, where the token comes
 * from `_handle()` — which is the `cloudservices` app id, *or* a
 * `backendServices` entry's token when the project has no endpoint, *or*
 * `undefined`. Reproducing that if/else here would be a second copy of a
 * resolution rule that has already been rewritten twice (BCN-006, BCN-009), and
 * a copy that drifts fails **silently**: the preview just goes back to showing
 * placeholders, which is the defect this file exists to remove.
 *
 * Writing all of them is exact for whichever branch wins and harmless for the
 * rest, because the sandbox runs in its own Electron storage partition
 * (`persist:nodegx-authoring-sandbox`) whose only inhabitant is this fake user.
 * A stray key there cannot reach a real session — that isolation is the reason
 * the partition exists.
 *
 * @module noodl-runtime/sandbox/session
 */

import { parseSessionKey } from '../api/backends/SessionStore';
import type { SandboxDataset, SandboxRecord } from './types';

/** As much of the metadata as key resolution reads. Structural, so nothing is imported for it. */
interface SessionMetaDataSources {
  cloudservices?: { appId?: string };
  backendServices?: { backends?: Array<{ auth?: { publicToken?: string } }> };
}

/**
 * Every `Parse/<token>/currentUser` key `UserService` could resolve to.
 *
 * `undefined` is deliberately in the set and is the *common* case: a project
 * with no backend configured resolves `publicToken` to `undefined`, and
 * `parseSessionKey` renders that as the literal `Parse/undefined/currentUser`.
 * That is the key the AI authoring loop's own previews use, so leaving it out
 * would fix the case nobody has and miss the case everybody has.
 */
export function sandboxSessionKeys(sources: SessionMetaDataSources): string[] {
  const tokens: Array<string | undefined> = [undefined, sources.cloudservices?.appId];
  for (const backend of sources.backendServices?.backends ?? []) {
    if (backend?.auth?.publicToken) tokens.push(backend.auth.publicToken);
  }

  const keys: string[] = [];
  for (const token of tokens) {
    const key = parseSessionKey(token);
    if (keys.indexOf(key) === -1) keys.push(key);
  }
  return keys;
}

/**
 * What a real sign-in would have written.
 *
 * Shaped to match `respondUser`'s `/users/me` answer exactly — the same record
 * plus a `sessionToken` — so the store's copy and the wire's copy cannot
 * disagree about who is signed in.
 */
export function sandboxSession(user: SandboxRecord): Record<string, unknown> {
  return { ...user, sessionToken: String(user.sessionToken ?? 'r:sandbox-session') };
}

export interface SeedOptions {
  /** Defaults to the ambient `localStorage`. Injected for tests. */
  storage?: Record<string, unknown> | null;
}

/**
 * Sign the sandbox in, or sign it out.
 *
 * Idempotent and safe to call again whenever the dataset changes — a refined
 * candidate ships a new one, and the session must follow it rather than keep
 * describing the user the previous export invented.
 *
 * Returns the keys it touched, so a caller can say what it did rather than
 * assume it worked.
 */
export function seedSandboxSession(
  dataset: SandboxDataset | undefined,
  sources: SessionMetaDataSources,
  signedIn: boolean,
  options: SeedOptions = {}
): string[] {
  // Bare `typeof`, not `globalThis.localStorage`: webpack's DefinePlugin
  // substitutes identifiers and the latter is not a substitution site. Same
  // rule `SessionStore` records for the same reason.
  const storage =
    options.storage !== undefined
      ? options.storage
      : typeof localStorage === 'undefined'
        ? undefined
        : (localStorage as unknown as Record<string, unknown>);
  if (!storage) return [];

  const keys = sandboxSessionKeys(sources);
  for (const key of keys) {
    // ⚠️ Signed out **clears**, it does not skip. The toggle has to be able to
    // go back: a preview left holding a session after the user asked to be
    // signed out would show the logged-in branch under a strip promising the
    // other one, which is the reported defect with the sign reversed.
    if (!signedIn || !dataset) delete storage[key];
    else storage[key] = JSON.stringify(sandboxSession(dataset.user));
  }
  return keys;
}
