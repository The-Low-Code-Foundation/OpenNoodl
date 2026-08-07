/**
 * BCN-006 step 8 — `RestAuthAdapter` driven against the live rig.
 *
 * This is the pass that decides whether the phase's **exit criterion 4** can be
 * claimed: *"a logged-in user stays logged in across an access-token expiry, on
 * every backend that has one."*
 *
 * It drives the **real adapter** over **real HTTP** against **real servers**, on
 * **real timers**. Two things are injected and neither is the thing under test:
 * a plain object for `localStorage` (Node has none) and `isBrowserTab: () => true`
 * (the SSR guard, correctly false in Node, would switch off the very paths being
 * measured). The clock is not mocked; the tokens are not fabricated; the expiry in
 * §4 is a **genuine** one, produced by configuring PocketBase to issue 25-second
 * tokens for the duration of the run.
 *
 * ⚠️ `RestAuthAdapter` uses `fetch`, not `XMLHttpRequest`, so unlike
 * `ParseAuthAdapter` it is fully reachable from Node. The browser pass this file
 * does **not** replace is the Parse-wire one — see BCN-006-NOTES §10.
 *
 *   node bcn-006-auth-driver.build.mjs && node bcn-006-auth-driver.cjs
 */

import { RestAuthAdapter } from '../../../../packages/noodl-runtime/src/api/backends/RestAuthAdapter';
import { SessionStore } from '../../../../packages/noodl-runtime/src/api/backends/SessionStore';
import type { AuthSession, BackendHandle } from '../../../../packages/nodegx-backend-contract/src';

const DIRECTUS = 'http://localhost:8055';
const POCKETBASE = 'http://localhost:8091';

const directus: BackendHandle = { id: 'be-directus', type: 'directus', name: 'Directus', url: DIRECTUS };
const pocketbase: BackendHandle = { id: 'be-pb', type: 'pocketbase', name: 'PocketBase', url: POCKETBASE };

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++;
    console.log(`  ✅ ${label}${detail === undefined ? '' : `  — ${String(detail)}`}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}${detail === undefined ? '' : `  — ${String(detail)}`}`);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function makeAdapter(lifecycle?: { kind: 'refresh'; accessTtlSeconds: number; refreshEndpoint: string; refreshBeforeExpirySeconds: number }) {
  const storage: Record<string, unknown> = {};
  const adapter = new RestAuthAdapter({
    isBrowserTab: () => true,
    lifecycle,
    createStore: (handle) =>
      new SessionStore({ key: `NodeGX/${handle.id}/session`, storage, broadcaster: null })
  });
  return { adapter, storage };
}

const login = (adapter: RestAuthAdapter, handle: BackendHandle, username: string, password: string) =>
  new Promise<AuthSession>((resolve, reject) =>
    adapter.logIn(handle, { username, password, success: (s) => resolve(s), error: (e) => reject(new Error(String(e))) })
  );

// ── 1. Directus: login, the user record, and the expiry arithmetic ──────────

async function directusLogin() {
  console.log('\n═══ 1. Directus — login, /users/me, and `expires` ═══');
  const { adapter, storage } = makeAdapter();

  const before = Date.now();
  const session = await login(adapter, directus, 'admin@example.com', 'directus-admin-pw');

  check('logIn resolved', !!session.sessionToken);
  check('the user record is merged, not just the tokens', session.email === 'admin@example.com', session.email);
  check('`id` was normalised to `objectId`', typeof session.objectId === 'string' && !('id' in session), session.objectId);
  check('the password placeholder never reached storage', !('password' in session));
  check('a refresh token is stored', typeof session.refreshToken === 'string');

  // ⚠️ The headline arithmetic. `expires` is 900000 MILLISECONDS of remaining
  // lifetime. Read as an absolute time it lands in 1970; read as seconds it lands
  // 250 hours out. Either is silent.
  const ttl = (session.expiresAt as number) - before;
  check('`expiresAt` is ~15 minutes in the FUTURE', ttl > 890_000 && ttl < 910_000, `${Math.round(ttl / 1000)}s`);

  const stored = JSON.parse(String(storage['NodeGX/be-directus/session']));
  check('the session round-trips through storage', stored.sessionToken === session.sessionToken);

  adapter.dispose();
  return true;
}

// ── 2. Directus: a REAL scheduled refresh, ahead of expiry, with rotation ───

async function directusScheduledRefresh() {
  console.log('\n═══ 2. Directus — a scheduled refresh on real timers, with rotation ═══');
  // The margin is widened, not the clock mocked and not the TTL faked: with a
  // 900s token and an 894s margin the scheduler fires ~6s after login, which is
  // the *real* scheduling path on the *real* token. §4 below does a genuine
  // expiry as well.
  const { adapter, storage } = makeAdapter({
    kind: 'refresh',
    accessTtlSeconds: 900,
    refreshEndpoint: '/auth/refresh',
    refreshBeforeExpirySeconds: 894
  });

  const session = await login(adapter, directus, 'admin@example.com', 'directus-admin-pw');
  const firstAccess = session.sessionToken;
  const firstRefresh = session.refreshToken;

  const lost: unknown[] = [];
  adapter.on('sessionLost', (r) => lost.push(r));

  console.log('  … waiting up to 20s for the scheduled refresh (nothing is being polled)');
  let rotated = false;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const now = JSON.parse(String(storage['NodeGX/be-directus/session']));
    if (now.sessionToken !== firstAccess) {
      rotated = true;
      check('the access token was replaced WITHOUT anyone asking', true, `after ~${(i + 1) * 0.5}s`);
      check('the refresh token rotated too', now.refreshToken !== firstRefresh);
      check('no sessionLost was raised — a silent refresh is silent', lost.length === 0);

      // The new token has to actually work, and the old one has to be dead —
      // otherwise "it rotated" says nothing about whether the user is still in.
      const withNew = await fetch(`${DIRECTUS}/users/me`, { headers: { Authorization: `Bearer ${now.sessionToken}` } });
      check('the NEW access token is accepted', withNew.status === 200, `HTTP ${withNew.status}`);

      const replay = await fetch(`${DIRECTUS}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: firstRefresh, mode: 'json' })
      });
      // ⚠️ This is why single-flight is correctness and not an optimisation: two
      // parallel refreshes would each spend a token the other had already used.
      check('the OLD refresh token is now REJECTED (rotation is real)', replay.status === 401, `HTTP ${replay.status}`);
      break;
    }
  }
  check('a refresh happened at all', rotated);

  adapter.dispose();
  return rotated;
}

// ── 3. Directus: a rejected refresh is a logout; an unreachable one is not ──

async function directusFailurePolicy() {
  console.log('\n═══ 3. Directus — the failure policy, against the real 401 ═══');

  const { adapter, storage } = makeAdapter({
    kind: 'refresh',
    accessTtlSeconds: 900,
    refreshEndpoint: '/auth/refresh',
    refreshBeforeExpirySeconds: 60
  });
  await login(adapter, directus, 'admin@example.com', 'directus-admin-pw');

  // Spend the refresh token behind the adapter's back, then force a refresh.
  const stored = JSON.parse(String(storage['NodeGX/be-directus/session']));
  await fetch(`${DIRECTUS}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: stored.refreshToken, mode: 'json' })
  });

  const lost: string[] = [];
  adapter.on('sessionLost', (r) => lost.push(String(r)));

  // Expire the stored access token so the gate must refresh before proceeding.
  stored.expiresAt = Date.now() - 1;
  storage['NodeGX/be-directus/session'] = JSON.stringify(stored);
  adapter.lifecycleController(directus).sessionChanged();
  await new Promise<void>((resolve) => adapter.lifecycleController(directus).withSession(() => resolve()));
  await sleep(1500);

  check('a spent refresh token ends the session', lost.length === 1, lost[0]);
  check("…with the backend's own words, not ours", lost[0] === 'Invalid user credentials.', lost[0]);
  check('storage was cleared', storage['NodeGX/be-directus/session'] === undefined);
  adapter.dispose();

  // The other half of the policy: an unreachable backend must NOT sign anyone out.
  console.log('  — and now an unreachable backend');
  const offline = makeAdapter({
    kind: 'refresh',
    accessTtlSeconds: 900,
    refreshEndpoint: '/auth/refresh',
    refreshBeforeExpirySeconds: 60
  });
  const dead: BackendHandle = { ...directus, id: 'be-dead', url: 'http://127.0.0.1:9' };
  offline.storage['NodeGX/be-dead/session'] = JSON.stringify({
    objectId: 'u',
    sessionToken: 'still-good',
    refreshToken: 'r',
    // Still valid — the margin exists precisely to absorb this.
    expiresAt: Date.now() + 120_000
  });
  const offlineLost: string[] = [];
  offline.adapter.on('sessionLost', (r) => offlineLost.push(String(r)));
  offline.adapter.lifecycleController(dead).sessionChanged();
  await new Promise<void>((resolve) => offline.adapter.lifecycleController(dead).withSession(() => resolve()));
  await sleep(2000);

  check('a user on a dead network keeps their session', offlineLost.length === 0, offlineLost[0]);
  check('…and the session is still in storage', offline.storage['NodeGX/be-dead/session'] !== undefined);
  offline.adapter.dispose();
  return true;
}

// ── 4. PocketBase: a GENUINE token expiry, with the app open ────────────────

interface PbRestore {
  token: string;
  duration: number;
}

/** Configure the users collection to issue short-lived tokens, and say how to undo it. */
async function pocketbaseShortenTokens(seconds: number): Promise<PbRestore> {
  const auth = await fetch(`${POCKETBASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'admin@example.com', password: 'pocketbase-admin-pw' })
  });
  const { token } = (await auth.json()) as { token: string };

  const before = await (await fetch(`${POCKETBASE}/api/collections/users`, { headers: { Authorization: token } })).json();
  const duration = before?.authToken?.duration ?? 604800;

  await fetch(`${POCKETBASE}/api/collections/users`, {
    method: 'PATCH',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ authToken: { duration: seconds } })
  });
  return { token, duration };
}

async function pocketbaseRestore(restore: PbRestore) {
  await fetch(`${POCKETBASE}/api/collections/users`, {
    method: 'PATCH',
    headers: { Authorization: restore.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ authToken: { duration: restore.duration } })
  });
}

async function pocketbaseRealExpiry() {
  console.log('\n═══ 4. PocketBase — a GENUINE access-token expiry, with the app open ═══');
  console.log('  This is exit criterion 4. The backend really issues 25-second tokens for');
  console.log('  the length of this test; nothing about the clock or the token is faked.');

  const restore = await pocketbaseShortenTokens(25);
  try {
    const email = `bcn006_live_${Date.now()}@example.com`;
    const password = 'bcn006-Password-1';

    const { adapter, storage } = makeAdapter();
    const lost: unknown[] = [];
    adapter.on('sessionLost', (r) => lost.push(r));

    const session = await new Promise<AuthSession>((resolve, reject) =>
      adapter.signUp(pocketbase, {
        username: email,
        password,
        email,
        success: (s) => resolve(s),
        error: (e) => reject(new Error(String(e)))
      })
    );

    check('signUp resolved and signed the new user in', !!session.sessionToken);
    // The record the create returns omits `email` — this value can only have come
    // from the login that followed it.
    check('the new user carries the email the create would not tell us', session.email === email, session.email);
    check('`verified` was mapped to `emailVerified`', session.emailVerified === false);
    check('no refresh token exists, and that is normal here', session.refreshToken === undefined);

    const firstToken = session.sessionToken as string;
    const firstExpiry = session.expiresAt as number;
    const ttl = Math.round((firstExpiry - Date.now()) / 1000);
    check('the backend really is issuing ~25s tokens', ttl > 15 && ttl <= 26, `${ttl}s`);

    // Prove the token genuinely dies, so "it still works later" means something.
    console.log(`  … waiting ${ttl + 6}s — past the real expiry, with the session open`);
    await sleep((ttl + 6) * 1000);

    const deadCheck = await fetch(`${POCKETBASE}/api/collections/users/auth-refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${firstToken}` }
    });
    check('the ORIGINAL token has genuinely expired', deadCheck.status === 401, `HTTP ${deadCheck.status}`);

    const now = JSON.parse(String(storage['NodeGX/be-pb/session'] ?? 'null'));
    check('the user is STILL SIGNED IN', now !== null && !!now.sessionToken);
    check('…on a token that was silently replaced', now && now.sessionToken !== firstToken);
    check('…and nothing told the app the session was lost', lost.length === 0, lost[0]);

    if (now && now.sessionToken) {
      const alive = await fetch(`${POCKETBASE}/api/collections/users/auth-refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${now.sessionToken}` }
      });
      check('the replacement token is accepted by the backend', alive.status === 200, `HTTP ${alive.status}`);
    }

    // And the user-facing surface: a request made *now* must just work.
    const me = await new Promise<AuthSession | string>((resolve) =>
      adapter.fetchCurrentUser(pocketbase, { success: (u) => resolve(u as AuthSession), error: (e) => resolve(String(e)) })
    );
    check('fetchCurrentUser still works across the expiry', typeof me === 'object' && (me as AuthSession).email === email, me);

    adapter.dispose();
  } finally {
    await pocketbaseRestore(restore);
    console.log(`  (restored the users collection token duration to ${restore.duration}s)`);
  }
  return true;
}

// ── 5. Single-flight, against a rotating backend ────────────────────────────

async function directusSingleFlight() {
  console.log('\n═══ 5. Directus — ten concurrent requests cause ONE rotation ═══');
  const { adapter, storage } = makeAdapter({
    kind: 'refresh',
    accessTtlSeconds: 900,
    refreshEndpoint: '/auth/refresh',
    refreshBeforeExpirySeconds: 60
  });
  await login(adapter, directus, 'admin@example.com', 'directus-admin-pw');

  const stored = JSON.parse(String(storage['NodeGX/be-directus/session']));
  const originalRefresh = stored.refreshToken;
  stored.expiresAt = Date.now() - 1; // expired: the gate must queue
  storage['NodeGX/be-directus/session'] = JSON.stringify(stored);
  adapter.lifecycleController(directus).sessionChanged();

  const lost: unknown[] = [];
  adapter.on('sessionLost', (r) => lost.push(r));

  const controller = adapter.lifecycleController(directus);
  const handed = await Promise.all(
    Array.from({ length: 10 }, () => new Promise<AuthSession | undefined>((resolve) => controller.withSession((s) => resolve(s))))
  );
  await sleep(500);

  const after = JSON.parse(String(storage['NodeGX/be-directus/session'] ?? 'null'));
  check('all ten callers were answered', handed.length === 10 && handed.every((s) => !!s));
  check('all ten got the SAME token', new Set(handed.map((s) => s?.sessionToken)).size === 1);
  check('exactly one rotation happened, so nobody was signed out', lost.length === 0 && after !== null, lost[0]);
  // If two refreshes had raced, the second would have presented a spent token and
  // the honest reading of that 401 is "this session is over".
  check('the refresh token moved on exactly once', after && after.refreshToken !== originalRefresh);

  adapter.dispose();
  return true;
}

// ── 6. Supabase is refused rather than attempted ────────────────────────────

async function supabaseRefused() {
  console.log('\n═══ 6. Supabase — refused, and the rig says why ═══');
  const probe = await fetch('http://localhost:8056/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.c', password: 'x' })
  });
  check('there is genuinely no GoTrue in the rig', probe.status === 404, `HTTP ${probe.status}`);

  const { adapter } = makeAdapter();
  const supabase: BackendHandle = { id: 'be-sb', type: 'supabase', name: 'Supabase', url: 'http://localhost:8056' };
  const message = await new Promise<string>((resolve) =>
    adapter.logIn(supabase, { username: 'a', password: 'b', success: () => resolve('SUCCEEDED'), error: (e) => resolve(String(e)) })
  );
  check('the adapter refuses with a sentence rather than guessing a wire', message.includes('GoTrue'), message.slice(0, 80) + '…');
  adapter.dispose();
  return true;
}

// ── Run ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('BCN-006 step 8 — RestAuthAdapter against the live rig');
  console.log('====================================================');
  const started = Date.now();

  try {
    await directusLogin();
    await directusScheduledRefresh();
    await directusFailurePolicy();
    await directusSingleFlight();
    await pocketbaseRealExpiry();
    await supabaseRefused();
  } catch (e) {
    failed++;
    console.log(`\n❌ THREW: ${(e as Error).stack}`);
  }

  console.log(`\n════ ${passed} passed, ${failed} failed, in ${Math.round((Date.now() - started) / 1000)}s ════`);
  process.exit(failed === 0 ? 0 : 1);
})();
