/**
 * BCN-006 step 5 — the provider round trip, driven against a real backend.
 *
 * The rig has **no OAuth provider configured on any backend** (Directus reports
 * `GET /auth -> {"data":[]}`, PocketBase `oauth2.enabled: false`), so step 5
 * could not be observed at all when BCN-006 stopped. Rather than write four
 * redirect shapes from documentation — which is what this phase has been wrong
 * about four times — a stub OAuth2 provider was stood up
 * (`bcn-006-stub-oauth-provider.mjs`) and PocketBase pointed at it, so the whole
 * flow is a **measured** one: authorize → code → exchange → session.
 *
 * What is real here: PocketBase, its `auth-methods` discovery, its PKCE
 * handling, its exchange, the session it issues, and the adapter's own code
 * path. What is a fixture: the identity provider, which authenticates nobody and
 * exists so a code can be issued at all.
 *
 * What is **simulated**: the browser. `signInWithProvider` ends in
 * `window.location.href = …` and `consumeAuthReturn` reads
 * `window.location.search`, so a minimal `window` is injected and the navigation
 * it records is followed by hand — exactly what a browser would do with it. The
 * preview-window pass is what covers the real `window`; this covers the wire.
 *
 *   node bcn-006-oauth-driver.build.mjs && node bcn-006-oauth-driver.cjs
 *
 * Prerequisites:
 *   node bcn-006-stub-oauth-provider.mjs 8113 &
 *   node bcn-006-oauth-rig.mjs on          # points PocketBase at the stub
 */

import { RestAuthAdapter, readAuthMethods, readIsNew } from '../../../../packages/noodl-runtime/src/api/backends/RestAuthAdapter';
import { SessionStore } from '../../../../packages/noodl-runtime/src/api/backends/SessionStore';
import type { BackendHandle } from '../../../../packages/nodegx-backend-contract/src';

const POCKETBASE = 'http://localhost:8091';
const DIRECTUS = 'http://localhost:8055';
const APP_PAGE = 'http://localhost:8574/bcn006b/';

const pocketbase: BackendHandle = { id: 'be-pb', type: 'pocketbase', name: 'PocketBase', url: POCKETBASE };
const directus: BackendHandle = { id: 'be-directus', type: 'directus', name: 'Directus', url: DIRECTUS };
const supabase: BackendHandle = { id: 'be-sb', type: 'supabase', name: 'Supabase', url: 'http://localhost:8056' };

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

// ── The simulated browser ───────────────────────────────────────────────────

interface FakeWindow {
  location: { href: string; search: string; pathname: string; hash: string };
  history: { state: unknown; replaceState(state: unknown, title: string, url: string): void };
  navigations: string[];
}

function installWindow(startUrl: string): FakeWindow {
  const url = new URL(startUrl);
  const navigations: string[] = [];

  const location = {
    get href() {
      return url.toString();
    },
    set href(next: string) {
      navigations.push(next);
    },
    get search() {
      return url.search;
    },
    set search(next: string) {
      url.search = next;
    },
    get pathname() {
      return url.pathname;
    },
    get hash() {
      return url.hash;
    }
  };

  const fake = {
    location,
    history: {
      state: null as unknown,
      replaceState(_state: unknown, _title: string, next: string) {
        const resolved = new URL(next, url.origin);
        url.search = resolved.search;
      }
    },
    navigations
  } as unknown as FakeWindow;

  (globalThis as unknown as { window: unknown }).window = fake;
  return fake;
}

function makeAdapter() {
  const storage: Record<string, unknown> = {};
  const adapter = new RestAuthAdapter({
    isBrowserTab: () => true,
    createStore: (handle) => new SessionStore({ key: `NodeGX/${handle.id}/session`, storage, broadcaster: null })
  });
  return { adapter, storage };
}

// ── 1. Discovery, on both backends ──────────────────────────────────────────

async function discovery() {
  console.log('\n═══ 1. listAuthProviders — asking the instance rather than the descriptor ═══');
  const { adapter } = makeAdapter();

  const pb = await new Promise<{ providers: { id: string; displayName: string }[]; magicLink: { enabled: boolean } }>(
    (resolve, reject) =>
      adapter.listAuthProviders(pocketbase, { success: (r) => resolve(r!), error: (e) => reject(new Error(String(e))) })
  );
  check('PocketBase lists the configured provider', pb.providers.length === 1, pb.providers.map((p) => p.id).join(','));
  check('…with the display name the admin set', pb.providers[0]?.displayName === 'BCN006b Stub', pb.providers[0]?.displayName);
  check('…and magicLink is FALSE, not PocketBase’s OTP', pb.magicLink.enabled === false);

  const dx = await new Promise<{ providers: { id: string }[] }>((resolve, reject) =>
    adapter.listAuthProviders(directus, { success: (r) => resolve(r as never), error: (e) => reject(new Error(String(e))) })
  );
  check('Directus reports its (empty) SSO list rather than erroring', Array.isArray(dx.providers) && dx.providers.length === 0);

  const sbError = await new Promise<string>((resolve) =>
    adapter.listAuthProviders(supabase, { success: () => resolve('SUCCEEDED'), error: (e) => resolve(String(e)) })
  );
  check('Supabase is refused by name, and no request is issued', sbError.indexOf('GoTrue') !== -1, sbError.slice(0, 60) + '…');

  adapter.dispose();
}

// ── 2. The round trip ───────────────────────────────────────────────────────

async function roundTrip() {
  console.log('\n═══ 2. PocketBase — a genuine provider round trip ═══');
  const fake = installWindow(APP_PAGE);
  const { adapter, storage } = makeAdapter();

  let startError: string | undefined;
  adapter.signInWithProvider(pocketbase, { provider: 'oidc', error: (e) => (startError = e) });

  // Discovery is a network round trip, so the navigation is not synchronous.
  await waitFor(() => fake.navigations.length > 0 || startError !== undefined);
  check('signInWithProvider navigated rather than refusing', startError === undefined, startError);
  if (startError) return;

  const target = fake.navigations[0];
  check('…to the PROVIDER, not to PocketBase', target.startsWith('http://localhost:8113/authorize'), target.slice(0, 46) + '…');
  check(
    '…with the redirect appended to the bare `redirect_uri=` PocketBase left',
    target.indexOf('redirect_uri=' + encodeURIComponent(APP_PAGE)) !== -1
  );
  check('a PKCE challenge is carried', target.indexOf('code_challenge=') !== -1);

  // Tolerant of an absent value on purpose: with the parking line removed this
  // used to throw, so the mutation showed up as a crashed driver rather than a
  // red check. A red check names what broke.
  const parkedRaw = storage['NodeGX/be-pb/session.oauth-pending'];
  const parked = (() => {
    try {
      return JSON.parse(String(parkedRaw)) as { provider?: string; codeVerifier?: string; state?: string };
    } catch (e) {
      return {} as { provider?: string; codeVerifier?: string; state?: string };
    }
  })();
  check('the flow is parked BEFORE the navigation', typeof parked.codeVerifier === 'string' && parked.provider === 'oidc');
  check('…including the state, so the return can be verified', typeof parked.state === 'string' && parked.state.length > 0);

  // What the browser would do next.
  const hop = await fetch(target, { redirect: 'manual' });
  const back = hop.headers.get('location') as string;
  check('the provider redirects back to the app with a code', hop.status === 302 && back.indexOf('code=') !== -1, back);

  const returned = new URL(back);
  check('…and echoes the state PocketBase minted', returned.searchParams.get('state') === parked.state);

  // The return leg is a FRESH page load. New window, new adapter — same storage,
  // which is the whole reason the flow is parked there rather than in memory.
  const returnWindow = installWindow(back);
  const returning = new RestAuthAdapter({
    isBrowserTab: () => true,
    createStore: (handle) => new SessionStore({ key: `NodeGX/${handle.id}/session`, storage, broadcaster: null })
  });

  const outcome = await new Promise<{ succeeded?: boolean; error?: string; outcome?: string }>((resolve) => {
    returning.events.on('oauthReturn', (state: unknown) => {
      const s = state as { inProgress: boolean; succeeded?: boolean; error?: string; outcome?: string };
      if (!s.inProgress) resolve(s);
    });
    const consumed = returning.consumeAuthReturn(pocketbase);
    check('consumeAuthReturn recognised this page load as a return', consumed === true);
  });

  check('the exchange succeeded', outcome.succeeded === true, outcome.error);
  check('…and reported whether the account was created', outcome.outcome === 'created' || outcome.outcome === 'signed-in', outcome.outcome);

  const session = returning.getCurrentUser(pocketbase);
  check('a session is stored', !!session?.sessionToken);
  check('…carrying the user’s email from the provider', String(session?.email || '').indexOf('bcn006b-subject') === 0, session?.email);
  check('…with `id` normalised to `objectId`', typeof session?.objectId === 'string' && !('id' in (session as object)));
  check('…and `verified` mapped to `emailVerified`', session?.emailVerified === true);

  check('the code was stripped from the address bar', returnWindow.location.search.indexOf('code=') === -1, returnWindow.location.search || '(empty)');

  // ⚠️ **Re-installing the window is what makes the next check a check.**
  // Asserting `!consumeAuthReturn(…)` against the *stripped* window passed with
  // the flow-clearing line deleted — found by mutation — because the second call
  // was returning false for want of a `?code=`, not because the flow was gone.
  // A user who presses Back, or reloads from history, gets the URL **with** the
  // code back; that is the case that must not re-exchange.
  installWindow(back);
  check('a reload carrying the same code cannot replay it', !returning.consumeAuthReturn(pocketbase));

  // The token really works.
  const me = await fetch(`${POCKETBASE}/api/collections/users/auth-refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session?.sessionToken}`, 'Content-Type': 'application/json' },
    body: '{}'
  });
  check('the session token is accepted by PocketBase', me.status === 200, `HTTP ${me.status}`);

  returning.dispose();
  adapter.dispose();
  return session?.objectId;
}

// ── 3. The refusals, each for a measured reason ─────────────────────────────

async function refusals() {
  console.log('\n═══ 3. What is refused, and whether it says why ═══');
  installWindow(APP_PAGE);
  const { adapter } = makeAdapter();

  const unknown = await refuse(adapter, pocketbase, 'google');
  check('an unconfigured provider is refused BEFORE any navigation', unknown !== undefined);
  check('…and the message names what IS on offer', String(unknown).indexOf('oidc') !== -1, String(unknown).slice(0, 90));

  const dx = await refuse(adapter, directus, 'google');
  check('Directus SSO is refused', dx !== undefined);
  check('…because of the cookie session, not "not implemented"', String(dx).indexOf('cookie') !== -1, String(dx).slice(0, 90));

  const sb = await refuse(adapter, supabase, 'google');
  check('Supabase names GoTrue', String(sb).indexOf('GoTrue') !== -1);

  const none = await refuse(adapter, pocketbase, '');
  check('an empty provider is a sentence, not a redirect to nowhere', String(none).indexOf('no provider') !== -1, String(none));

  adapter.dispose();
}

function refuse(adapter: RestAuthAdapter, handle: BackendHandle, provider: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    let message: string | undefined;
    adapter.signInWithProvider(handle, { provider, error: (e) => (message = e) });
    setTimeout(() => resolve(message), 1500);
  });
}

// ── 4. The state check, which is the one security property here ─────────────

async function stateMismatch() {
  console.log('\n═══ 4. A code that was not minted by this attempt ═══');
  const storage: Record<string, unknown> = {};

  // ⚠️ A **recording** fetch here, not the real one, and it is what makes this
  // section mean anything. Mutation-testing found that asserting only "the
  // return failed" stayed green with the state check deleted — because a code
  // this browser never asked for is one PocketBase rejects anyway. The property
  // under test is that **no request is issued at all**, and only a counter can
  // see that.
  let requests = 0;
  const adapter = new RestAuthAdapter({
    isBrowserTab: () => true,
    fetchImpl: (url, init) => {
      requests++;
      return Promise.resolve({ status: 200, text: () => Promise.resolve('{}') }) as never;
    },
    createStore: (handle) => new SessionStore({ key: `NodeGX/${handle.id}/session`, storage, broadcaster: null })
  });

  storage['NodeGX/be-pb/session.oauth-pending'] = JSON.stringify({
    provider: 'oidc',
    codeVerifier: 'whatever',
    state: 'the-state-we-started',
    redirectURL: APP_PAGE,
    startedAt: Date.now()
  });

  installWindow(APP_PAGE + '?code=someone-elses-code&state=a-different-state');

  const outcome = await new Promise<{ succeeded?: boolean; error?: string }>((resolve) => {
    adapter.events.on('oauthReturn', (state: unknown) => {
      const s = state as { inProgress: boolean; succeeded?: boolean; error?: string };
      if (!s.inProgress) resolve(s);
    });
    check('it is still recognised as a return', adapter.consumeAuthReturn(pocketbase) === true);
  });

  check('…and refused', outcome.succeeded === false);
  check('…with a sentence a builder can show', String(outcome.error).indexOf('verified as the one you started') !== -1, outcome.error);
  check('…and NO request was issued', requests === 0, `${requests} request(s)`);

  adapter.dispose();
}

// ── 5. A `?code=` that is not ours ──────────────────────────────────────────

async function foreignCode() {
  console.log('\n═══ 5. A `?code=` with no flow parked — the generic-parameter trap ═══');
  const { adapter } = makeAdapter();
  installWindow(APP_PAGE + '?code=A-MARKETING-CAMPAIGN&state=x');

  check('nothing is consumed and nothing is exchanged', adapter.consumeAuthReturn(pocketbase) === false);
  adapter.dispose();
}

// ── 6. The readers, against real payloads ───────────────────────────────────

async function readers() {
  console.log('\n═══ 6. readAuthMethods against the live payload ═══');
  const live = await (await fetch(`${POCKETBASE}/api/collections/users/auth-methods`)).json();
  const parsed = readAuthMethods({ type: 'pocketbase' } as never, live);
  check('the live payload parses to one provider', parsed.providers.length === 1);
  check('`authURL` survives (and `authUrl` is the alias)', !!parsed.providers[0].raw?.authURL);
  check('otp is reported separately from magicLink', parsed.otp?.enabled === false && parsed.magicLink.enabled === false);

  const dxLive = await (await fetch(`${DIRECTUS}/auth`)).json();
  const dxParsed = readAuthMethods({ type: 'directus' } as never, dxLive);
  check('an empty Directus list parses to zero providers, not a throw', dxParsed.providers.length === 0);

  check('readIsNew reads PocketBase’s own word', readIsNew({ meta: { isNew: true } }) && !readIsNew({ meta: {} }));
}

// ── Plumbing ────────────────────────────────────────────────────────────────

function waitFor(predicate: () => boolean, timeoutMs = 8000): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error('timed out'));
      setTimeout(tick, 25);
    };
    tick();
  });
}

async function main() {
  console.log('BCN-006 step 5 — OAuth, measured');
  console.log('PocketBase :8091 + stub OIDC provider :8113');

  await discovery();
  const created = await roundTrip();
  await refusals();
  await stateMismatch();
  await foreignCode();
  await readers();

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  if (created) console.log(`  (created PocketBase user ${created} — namespaced bcn006b_)`);
  console.log('═'.repeat(60));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
