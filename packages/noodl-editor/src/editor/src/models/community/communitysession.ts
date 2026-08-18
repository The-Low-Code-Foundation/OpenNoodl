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
 * plainly does not exist. This reads and writes a store; it never mints, prompts or negotiates.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * ✅ **2026-08-19 — UNI-001 E1 LANDED THE ISSUER, so the paragraph above is now history
 * rather than the state of the world.** `readCommunitySession()` still returns `null` for a
 * user who has not signed in, which is the ordinary answer; what changed is that there is a
 * way to stop being that user. The minting is on the platform (`src/lib/session.ts` and the
 * device flow in `src/lib/devicepairing.ts`); the negotiation is in `communitysignin.ts`;
 * this file is still only the store. 🔴 **Keep it that way** — the reason the seam was worth
 * writing before the issuer existed is that it is ONE function with ONE name, and a second
 * place that writes this key is a second place a stale token can come from.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * ⚠️ THE STORE IS `JSONStorage`, WHICH IS A **PLAINTEXT JSON FILE IN `userData`**.
 *
 * 🔴 **This paragraph used to say `localStorage`, and that was wrong** — measured 2026-08-18 in
 * a running editor rather than reasoned about. `@noodl/platform-electron` calls
 * `setStorage(new StorageNode())` at import, and `StorageNode` writes
 * `<userData>/<key>.json` through the filesystem; the renderer's `localStorage` never sees it.
 * On this machine that is
 * `~/Library/Application Support/NodeGX/nodegx.community.session.json`, confirmed by writing a
 * session and watching the launcher's chip appear, and by watching sign-out delete the file.
 *
 * ⚠️ **The conclusion survives the correction, and the reasoning had to be redone to know
 * that.** A plaintext file at 0644 in `userData` is readable by any process running as this
 * user, and this renderer is `nodeIntegration: true`, so it is also readable by anything
 * running *in* the renderer. It is acceptable **only** because the token is a community
 * session — it reads and writes a public forum under a handle the user chose. 🔴 If UNI-001
 * ever issues a token that reaches anything of value (payment, an org roster, a pupil's
 * record), this is the wrong store and the OS keychain is the right one. Recorded as a
 * condition, because a store chosen for a cheap credential is exactly the store an expensive
 * one silently inherits.
 *
 * ⚠️ **UNI-001's scope says the token is stored `0600`. It is not** — `StorageNode` writes with
 * the process umask, like every other file it writes, and nothing here narrows it. The
 * relay-token precedent OBS-004 set is a different code path. Left as a recorded gap rather
 * than fixed silently in a launcher task: making it true means changing `StorageNode` for all
 * of its callers, which is a decision about the platform layer and not about this key.
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

/** The writing half, kept separate so a reader cannot be handed a store that writes. */
export interface WritableSessionStore {
  set(key: string, data: { [key: string]: unknown }): Promise<void>;
  remove(key: string): Promise<void>;
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

/**
 * Stores a session. 🔴 The ONLY writer of {@link COMMUNITY_SESSION_KEY}.
 *
 * ⚠️ `handle` is stored beside the token because the composer's primary button says *"Post
 * to the community as @nia-builds"*, and asking the platform who you are on every dialog
 * open would put a network round trip in front of a button. It is a CACHE of a fact the
 * platform owns: if a handle is renamed, this is stale until the next sign-in, and the
 * consequence is a button with the wrong name on it rather than a post from the wrong
 * account — the token is what decides the author, and only the platform reads it.
 */
export async function writeCommunitySession(
  session: CommunitySession,
  store: WritableSessionStore = JSONStorage
): Promise<void> {
  const token = session.token.trim();
  // 🔴 Refusing to store a blank is not defensive tidying. `readCommunitySession` maps a
  // blank to `null`, so writing one would produce a store that says "signed in" to anything
  // reading the raw key and "signed out" to the reader — two answers to one question.
  if (token.length === 0) throw new Error('refusing to store a blank community token');
  await store.set(COMMUNITY_SESSION_KEY, session.handle ? { token, handle: session.handle } : { token });
}

/**
 * Forgets the stored session — the editor's half of signing out.
 *
 * ⚠️ **Local only, and the name says less than the caller means.** This removes our copy; it
 * does NOT revoke the row on the platform, which is `POST /api/auth/signout` and needs the
 * token we are about to throw away. 🔴 A caller that wants a real sign-out must revoke FIRST
 * and clear second — clearing first leaves a live session nobody can reach to revoke, which
 * is the worse of the two failure orders.
 */
export async function clearCommunitySession(store: WritableSessionStore = JSONStorage): Promise<void> {
  await store.remove(COMMUNITY_SESSION_KEY);
}
