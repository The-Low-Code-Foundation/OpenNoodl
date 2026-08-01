/**
 * BCN-006 step 5 — what the rig can actually tell us about OAuth.
 *
 * Written before a line of `signInWithProvider`, for the reason this phase has
 * relearned four times: a documented wire is a guess. This probe records what
 * Directus 11 and PocketBase 0.30 answer for provider discovery, for the start
 * leg, and for the exchange leg with a code that is not real.
 *
 *   node bcn-006-oauth-probe.mjs > BCN-006-OAUTH-PROBE-OUTPUT.txt 2>&1
 */

const DIRECTUS = 'http://localhost:8055';
const POCKETBASE = 'http://localhost:8091';
const PARSE = 'http://localhost:8092';

async function show(label, url, init) {
  try {
    const response = await fetch(url, Object.assign({ redirect: 'manual' }, init));
    const text = await response.text();
    console.log(`\n${label}`);
    console.log(`  ${init?.method || 'GET'} ${url}`);
    console.log(`  -> ${response.status}`);
    const location = response.headers.get('location');
    if (location) console.log(`  location: ${location}`);
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) console.log(`  set-cookie: ${setCookie.slice(0, 200)}`);
    console.log(`  body: ${text.slice(0, 900)}`);
    return { status: response.status, text, location };
  } catch (e) {
    console.log(`\n${label}`);
    console.log(`  ${init?.method || 'GET'} ${url}`);
    console.log(`  -> THREW ${e.message}`);
    return { status: 0, text: '', location: null };
  }
}

async function main() {
  console.log('═══ Directus provider discovery ═══');
  await show('list SSO providers', `${DIRECTUS}/auth`);
  await show('server info (public_registration, sso)', `${DIRECTUS}/server/info`);
  await show('start a flow for a provider that is not configured', `${DIRECTUS}/auth/login/google`);
  await show('start a flow with a redirect', `${DIRECTUS}/auth/login/google?redirect=${encodeURIComponent('http://localhost:8574/')}`);

  console.log('\n\n═══ PocketBase provider discovery ═══');
  await show('auth-methods (the documented discovery call)', `${POCKETBASE}/api/collections/users/auth-methods`);
  await show('exchange with a bogus code', `${POCKETBASE}/api/collections/users/auth-with-oauth2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'google',
      code: 'bcn006b-not-a-real-code',
      codeVerifier: 'bcn006b-verifier',
      redirectURL: 'http://localhost:8574/'
    })
  });
  await show('exchange with no provider at all', `${POCKETBASE}/api/collections/users/auth-with-oauth2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  console.log('\n\n═══ Parse (for comparison — the one return leg that exists) ═══');
  await show('parse auth providers', `${PARSE}/auth/providers`, {
    headers: { 'X-Parse-Application-Id': 'uba-e2e-app' }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
