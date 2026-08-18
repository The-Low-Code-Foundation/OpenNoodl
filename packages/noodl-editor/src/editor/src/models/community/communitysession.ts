/**
 * UNI-016 — where the editor's community credential comes from.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 READ THIS BEFORE ASSUMING THERE IS A TOKEN. THERE IS NO ISSUER.
 *
 * UNI-016's handover said the composer *"already holds"* a bearer token. It does not, and
 * nothing in this editor ever did: `CommunityApiClient` had **no caller outside its own spec**,
 * there was no store to read a token from, and on the platform the only `insert into sessions`
 * statements in the whole repository are **in test files**. UNI-001's OAuth, its callback and
 * its consent screen are recorded as NOT BUILT — the sign-in button renders D2's string and is
 * inert, because the callback URLs need a domain that was unregistered when it was written.
 *
 * So: **today this function returns `null` for every real user, and that is the correct
 * answer rather than a stub.** The value of writing it is that the seam is one function with
 * one name, so UNI-001 has a single place to write to, and everything above it — the client's
 * `Write` union, the composer's two routes, the specs for both — is real, exercised and
 * gradeable now instead of after the issuer lands.
 *
 * ⚠️ **What this file must NOT become.** A "paste your token here" field would be inventing
 * product surface UNI-001 owns, and a sign-in flow that half-works is worse than one that
 * plainly does not exist. This reads a store; it never mints, prompts or negotiates.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * ⚠️ THE STORE IS `JSONStorage`, WHICH IS `localStorage` IN THE RENDERER.
 *
 * That is a real limitation and it is written down here rather than discovered later: a
 * session token in `localStorage` is readable by anything running in the renderer, and this
 * renderer is `nodeIntegration: true`. It is acceptable **only** because the token is a
 * community session — it reads and writes a public forum under a handle the user chose — and
 * because it is what a browser would do with the same credential. 🔴 If UNI-001 ever issues a
 * token that reaches anything of value (payment, an org roster, a pupil's record), this is
 * the wrong store and the OS keychain is the right one. Recorded as a condition, because a
 * store chosen for a cheap credential is exactly the store an expensive one silently inherits.
 *
 * @module models/community/communitysession
 */

import { JSONStorage } from '@noodl/platform';

/** The one key. Named for the surface rather than the task, since UNI-001 will write it. */
export const COMMUNITY_SESSION_KEY = 'nodegx.community.session';

export interface CommunitySession {
  /** The bearer token, resolved against the platform's `sessions` rows. */
  token: string;
  /** The handle it belongs to, so a composer can say who it is about to post as. */
  handle?: string;
}

/** Injected so the suite needs no editor and no `localStorage`. */
export interface SessionStore {
  get(key: string): Promise<unknown>;
}

/**
 * The stored session, or `null`.
 *
 * 🔴 **Every failure returns `null`, and none of them throws.** The caller is a composer whose
 * signed-out path is a working feature — UNI-016 AC5 keeps the browser hand-off precisely so
 * that being signed out is *a route*, not an error. A malformed record, a storage backend that
 * rejects, a token of the wrong type: all of them mean "not signed in", because the only thing
 * the caller can do with any of them is take the other route.
 *
 * ⚠️ A blank or whitespace token is `null` too. An empty string is truthy enough to build an
 * `authorization: Bearer ` header out of, which the platform answers with a 401 — so the
 * composer would show "sign in" *after* a round trip instead of before one, and a user with a
 * corrupted record would be told the server rejected them.
 */
export async function readCommunitySession(store: SessionStore = JSONStorage): Promise<CommunitySession | null> {
  let record: unknown;
  try {
    record = await store.get(COMMUNITY_SESSION_KEY);
  } catch (_error) {
    return null;
  }
  if (!record || typeof record !== 'object') return null;

  const { token, handle } = record as { token?: unknown; handle?: unknown };
  if (typeof token !== 'string' || token.trim().length === 0) return null;

  return { token: token.trim(), handle: typeof handle === 'string' ? handle : undefined };
}
