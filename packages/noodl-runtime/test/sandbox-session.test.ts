/**
 * POL-008 — the sandbox's signed-in session.
 *
 * The reported defect was not missing data. The export shipped a complete user
 * with a `sessionToken` in it; nothing ever asked for it, because `UserService`
 * requests `GET /users/me` **only if a session already exists** and no part of
 * the sandbox wrote one. So these tests are about the write, and about the two
 * things that are easy to get quietly wrong: which keys it lands under, and
 * that signing out actually clears rather than merely declining to write.
 */

import { sandboxSession, sandboxSessionKeys, seedSandboxSession } from '../src/sandbox/session';
import type { SandboxDataset } from '../src/sandbox/types';

const dataset = (): SandboxDataset => ({
  classes: {},
  user: {
    objectId: 'sandbox-user',
    id: 'sandbox-user',
    username: 'sample.user@example.com',
    email: 'sample.user@example.com',
    sessionToken: 'r:sandbox-session'
  },
  summary: 'Sample data — signed in as a sample user'
});

describe('POL-008 — which key the session lands under', () => {
  it('always includes the no-backend key, because that is the ordinary case', () => {
    // ⚠️ `Parse/undefined/currentUser` is not a bug and not a fallback. A project
    // with no backend configured resolves `publicToken` to `undefined`, and that
    // renders literally. It is the key an AI-authored preview actually uses, so
    // leaving it out would fix the rare case and miss the common one.
    expect(sandboxSessionKeys({})).toEqual(['Parse/undefined/currentUser']);
  });

  it('includes the cloudservices app id', () => {
    expect(sandboxSessionKeys({ cloudservices: { appId: 'abc123' } })).toEqual([
      'Parse/undefined/currentUser',
      'Parse/abc123/currentUser'
    ]);
  });

  it('includes every configured backend, because resolution may pick any of them', () => {
    // `UserService._handle()` falls through to `resolveBackendFromRuntime` when
    // the project has no endpoint, so the winning token is not knowable here
    // without a second copy of a resolution rule that has been rewritten twice.
    // Writing all of them is exact for whichever branch wins and harmless for
    // the rest — the sandbox has its own storage partition.
    const keys = sandboxSessionKeys({
      cloudservices: { appId: 'abc123' },
      backendServices: { backends: [{ auth: { publicToken: 'tok-1' } }, { auth: { publicToken: 'tok-2' } }, {}] }
    });
    expect(keys).toEqual([
      'Parse/undefined/currentUser',
      'Parse/abc123/currentUser',
      'Parse/tok-1/currentUser',
      'Parse/tok-2/currentUser'
    ]);
  });

  it('does not repeat a key when two sources name the same token', () => {
    const keys = sandboxSessionKeys({
      cloudservices: { appId: 'same' },
      backendServices: { backends: [{ auth: { publicToken: 'same' } }] }
    });
    expect(keys).toEqual(['Parse/undefined/currentUser', 'Parse/same/currentUser']);
  });
});

describe('POL-008 — seeding and clearing', () => {
  it('writes what a real sign-in would have written', () => {
    const storage: Record<string, unknown> = {};
    seedSandboxSession(dataset(), { cloudservices: { appId: 'abc' } }, true, { storage });

    const stored = JSON.parse(String(storage['Parse/abc/currentUser']));
    // The same record the wire's `/users/me` answers with, plus the token —
    // otherwise the store's copy and the wire's copy are two opinions about who
    // is signed in, which is the exact failure `SessionStore`'s own docblock
    // exists to prevent.
    expect(stored).toEqual(sandboxSession(dataset().user));
    expect(stored.sessionToken).toBe('r:sandbox-session');
    expect(stored.email).toBe('sample.user@example.com');
  });

  it('supplies a session token when the dataset carries none', () => {
    const storage: Record<string, unknown> = {};
    const withoutToken = dataset();
    delete withoutToken.user.sessionToken;
    seedSandboxSession(withoutToken, {}, true, { storage });

    // A session with no token reads as signed-in to the store and then fails on
    // the wire, which is worse than either state on its own.
    expect(JSON.parse(String(storage['Parse/undefined/currentUser'])).sessionToken).toBe('r:sandbox-session');
  });

  it('signing out CLEARS rather than skips', () => {
    // ⚠️ The toggle has to be able to go back. A preview left holding a session
    // after the user asked to be signed out shows the logged-in branch under a
    // strip promising the other one — the reported defect with the sign
    // reversed. Skipping the write would leave a previous seed in place.
    const storage: Record<string, unknown> = { 'Parse/undefined/currentUser': '{"objectId":"stale"}' };
    seedSandboxSession(dataset(), {}, false, { storage });
    expect('Parse/undefined/currentUser' in storage).toBe(false);
  });

  it('clears when there is no dataset at all', () => {
    const storage: Record<string, unknown> = { 'Parse/undefined/currentUser': '{"objectId":"stale"}' };
    seedSandboxSession(undefined, {}, true, { storage });
    expect('Parse/undefined/currentUser' in storage).toBe(false);
  });

  it('follows a refined candidate rather than describing the previous one', () => {
    // A refine round ships a new dataset. Re-seeding is idempotent and must
    // overwrite: a session still describing the user the last export invented
    // is the stale-state class of bug this whole surface keeps hitting.
    const storage: Record<string, unknown> = {};
    seedSandboxSession(dataset(), {}, true, { storage });

    const refined = dataset();
    refined.user.email = 'refined@example.com';
    seedSandboxSession(refined, {}, true, { storage });

    expect(JSON.parse(String(storage['Parse/undefined/currentUser'])).email).toBe('refined@example.com');
  });

  it('does nothing, quietly, where there is no storage', () => {
    // SSR and the cloud runtime have no `localStorage`. Same tolerance
    // `SessionStore` declares: a server render always sees a logged-out user.
    expect(seedSandboxSession(dataset(), {}, true, { storage: null })).toEqual([]);
  });
});
