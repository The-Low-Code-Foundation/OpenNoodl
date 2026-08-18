/**
 * UNI-001 E1 — how the editor gets a session, and the only place it negotiates for one.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 THE DEVICE FLOW, AND IT IS NOT A STYLE CHOICE. Two sentences in UNI-001's own scope
 * eliminate every other desktop OAuth pattern:
 *
 *     "A sign-in affordance in the launcher … using the system browser for the OAuth dance
 *      — no embedded webview credential entry."
 *     "All platform traffic is editor-outbound HTTPS to the platform API. No listener is
 *      opened."
 *
 * A loopback redirect (`http://127.0.0.1:<port>/callback`) is a listener. A `nodegx://`
 * protocol handler is not, but it needs an OS registration that a dev build, a portable build
 * and a second install all fight over — and whichever copy the OS picks receives a URL with a
 * live credential in it. What is left is: ask for a pair of codes, open the browser at a page
 * the person signs into normally, and POLL. Every hop here is editor-outbound.
 *
 * The platform end is `src/lib/devicepairing.ts` and `0010_uni001_device_authorizations.sql`
 * in `nodegx-community`; the migration carries the two-code security argument.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * ⚠️ EVERYTHING EXTERNAL IS INJECTED — `fetch`, the browser opener, the clock, the store.
 * Not for purity: this checkout's jest runner has no DOM, no React and no network, so a
 * module that reached for `globalThis.fetch` and `platform.openExternal` directly could only
 * be read, never run. What the suite drives is the same code the editor runs.
 *
 * 🔴 WHAT A GREEN SUITE HERE DOES NOT PROVE: that the editor's dialog calls any of it, and
 * that a real `community.nodegx.io` answers these routes. The first is a source-analysis
 * assertion (`base-dialog/measuring-copy.test.ts` is the precedent for the shape); the second
 * is E9's smoke drive on the deployed box, and nothing in this repository substitutes for it.
 *
 * @module models/community/communitysignin
 */

import { JSONStorage } from '@noodl/platform';

import { COMMUNITY_URL } from './communityorigin';
import {
  clearCommunitySession,
  readCommunitySession,
  writeCommunitySession,
  type CommunitySession,
  type SessionStore,
  type WritableSessionStore
} from './communitysession';

/**
 * What the caller shows while this is happening.
 *
 * 🔴 `waiting` CARRIES THE CODE, and that is the whole reason this is a progress callback
 * rather than a promise the caller awaits in silence. The user has to read eight characters
 * off the editor and type them into a browser; a flow that only reports its outcome would
 * leave them with a spinner and nothing to type.
 */
export type SignInProgress =
  | { phase: 'starting' }
  | { phase: 'waiting'; userCode: string; verificationUri: string }
  | { phase: 'signed-in'; handle?: string };

/**
 * ⚠️ FOUR OUTCOMES AND `cancelled` IS ONE OF THEM. A person who closes the dialog has not
 * failed at anything, and reporting it as an error would put a red message on a deliberate
 * act — the same distinction `Write`'s `unauthenticated` makes in `communityapi.ts`.
 */
export type SignInResult =
  | { outcome: 'signed-in'; session: CommunitySession }
  | { outcome: 'expired' }
  | { outcome: 'cancelled' }
  | { outcome: 'failed'; detail: string };

export type SignInDeps = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Opens the system browser. The editor passes `platform.openExternal`. */
  openExternal?: (url: string) => void;
  /** Injected so a spec does not wait fifteen real minutes. */
  wait?: (ms: number) => Promise<void>;
  /** Milliseconds since the epoch. Injected for the same reason. */
  now?: () => number;
  store?: WritableSessionStore;
  /** Returns true when the caller has given up — a closed dialog, a cancelled button. */
  isCancelled?: () => boolean;
};

type BeginResponse = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
};

type PollResponse =
  | { status: 'pending' }
  | { status: 'expired' }
  | { status: 'ready'; token: string; handle: string; expiresAt: string };

const DEFAULT_INTERVAL_SECONDS = 5;
const DEFAULT_EXPIRY_SECONDS = 15 * 60;

/**
 * Runs the whole dance and stores the session on success.
 *
 * ⚠️ THE CODE GOES IN THE URL WE OPEN, and the user still sees it in the editor. Prefilling
 * the browser field is the difference between "click the button" and "read eight characters
 * off one window and type them into another", and showing it anyway is what saves the person
 * whose browser opened on a different profile, or not at all.
 */
export async function signIntoCommunity(
  onProgress: (progress: SignInProgress) => void,
  deps: SignInDeps = {}
): Promise<SignInResult> {
  const baseUrl = (deps.baseUrl ?? COMMUNITY_URL).replace(/\/+$/, '');
  const doFetch = deps.fetchImpl ?? ((globalThis as { fetch?: typeof fetch }).fetch as typeof fetch);
  const wait = deps.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = deps.now ?? (() => Date.now());
  const cancelled = deps.isCancelled ?? (() => false);

  onProgress({ phase: 'starting' });

  let begun: BeginResponse;
  try {
    const response = await doFetch(`${baseUrl}/api/v1/auth/device`, {
      method: 'POST',
      headers: { accept: 'application/json' }
    });
    if (!response.ok) {
      return { outcome: 'failed', detail: `The community could not start a sign-in (HTTP ${response.status}).` };
    }
    begun = (await response.json()) as BeginResponse;
  } catch (err) {
    return { outcome: 'failed', detail: `The community could not be reached (${String(err)}).` };
  }
  if (!begun?.deviceCode || !begun?.userCode) {
    return { outcome: 'failed', detail: 'The community sent a sign-in with no code in it.' };
  }

  const verificationUri = begun.verificationUri || `${baseUrl}/auth/device`;
  onProgress({ phase: 'waiting', userCode: begun.userCode, verificationUri });
  deps.openExternal?.(`${verificationUri}?code=${encodeURIComponent(begun.userCode)}`);

  const intervalMs = Math.max(1, begun.interval || DEFAULT_INTERVAL_SECONDS) * 1000;
  const deadline = now() + Math.max(1, begun.expiresIn || DEFAULT_EXPIRY_SECONDS) * 1000;

  // 🔴 The loop bounds itself on the CLOCK rather than on a poll count. A count would silently
  // become a different timeout the day the platform changed its suggested interval, and the
  // two would then disagree about when a pairing has lapsed.
  while (now() < deadline) {
    if (cancelled()) return { outcome: 'cancelled' };
    await wait(intervalMs);
    if (cancelled()) return { outcome: 'cancelled' };

    let poll: PollResponse;
    try {
      const response = await doFetch(`${baseUrl}/api/v1/auth/device/token`, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ deviceCode: begun.deviceCode })
      });
      if (!response.ok) {
        return { outcome: 'failed', detail: `The community refused the sign-in (HTTP ${response.status}).` };
      }
      poll = (await response.json()) as PollResponse;
    } catch (err) {
      // ⚠️ A transient network failure mid-poll is NOT a failed sign-in — the person may be
      // on a train. Keep polling until the deadline; the deadline is what ends this.
      continue;
    }

    if (poll.status === 'expired') return { outcome: 'expired' };
    if (poll.status === 'ready') {
      const session: CommunitySession = { token: poll.token, handle: poll.handle };
      await writeCommunitySession(session, deps.store ?? JSONStorage);
      onProgress({ phase: 'signed-in', handle: poll.handle });
      return { outcome: 'signed-in', session };
    }
  }

  return { outcome: 'expired' };
}

/**
 * Signs out: revoke on the platform, THEN forget locally.
 *
 * 🔴 THE ORDER IS THE WHOLE FUNCTION. Clearing first would leave a live session on the
 * platform that nothing can reach to revoke — the token was the only handle on it. So the
 * revoke goes first, and the local clear happens **whether or not it succeeded**: a person
 * who is offline must still be able to sign out of their own editor, and a token they can no
 * longer present is inert on this machine even while its row lives on.
 *
 * ⚠️ Returns whether the platform confirmed. The caller may show it; it must not gate on it.
 */
export async function signOutOfCommunity(
  deps: SignInDeps & { readStore?: SessionStore } = {}
): Promise<{ revokedOnPlatform: boolean }> {
  const baseUrl = (deps.baseUrl ?? COMMUNITY_URL).replace(/\/+$/, '');
  const doFetch = deps.fetchImpl ?? ((globalThis as { fetch?: typeof fetch }).fetch as typeof fetch);
  const existing = await readCommunitySession(deps.readStore ?? JSONStorage);

  let revokedOnPlatform = false;
  if (existing) {
    try {
      const response = await doFetch(`${baseUrl}/api/auth/signout`, {
        method: 'POST',
        headers: { accept: 'application/json', authorization: `Bearer ${existing.token}` }
      });
      revokedOnPlatform = response.ok;
    } catch {
      revokedOnPlatform = false;
    }
  }

  await clearCommunitySession(deps.store ?? JSONStorage);
  return { revokedOnPlatform };
}
