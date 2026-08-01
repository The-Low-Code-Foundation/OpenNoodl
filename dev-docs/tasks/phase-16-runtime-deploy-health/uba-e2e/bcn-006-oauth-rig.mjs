/**
 * Point the rig's PocketBase at the stub OAuth provider, and put it back.
 *
 * The rig is **shared** — several workers drive it at once — so the change this
 * makes is narrow, named and reversible: it enables `oauth2` on the `users`
 * collection with one provider called `oidc` pointing at
 * `bcn-006-stub-oauth-provider.mjs`. Password sign-in on the same collection is
 * untouched, which is the reason the setting can be left on between runs without
 * disturbing anyone. `off` removes the provider and switches `oauth2` back off,
 * restoring what `auth-methods` reported before: `{providers:[], enabled:false}`.
 *
 * ⚠️ `tokenURL` and `userInfoURL` are `host.docker.internal` and `authURL` is
 * `localhost`, and the split is not a typo. PocketBase calls the first two
 * **server-side, from inside its container**; the browser follows the third.
 *
 *   node bcn-006-oauth-rig.mjs on
 *   node bcn-006-oauth-rig.mjs status
 *   node bcn-006-oauth-rig.mjs off
 *   node bcn-006-oauth-rig.mjs clean     # delete the bcn006b_ users it created
 */

const PB = process.env.POCKETBASE_URL || 'http://localhost:8091';
const ADMIN = { identity: 'admin@example.com', password: 'pocketbase-admin-pw' };
const STUB_HOST_FOR_BROWSER = 'http://localhost:8113';
const STUB_HOST_FOR_POCKETBASE = 'http://host.docker.internal:8113';

async function token() {
  const response = await fetch(`${PB}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ADMIN)
  });
  const body = await response.json();
  if (!body.token) throw new Error(`could not authenticate as PocketBase superuser: ${JSON.stringify(body)}`);
  return body.token;
}

async function patch(oauth2) {
  const auth = await token();
  const response = await fetch(`${PB}/api/collections/users`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify({ oauth2 })
  });
  const body = await response.json();
  console.log(`PATCH /api/collections/users -> ${response.status}`);
  console.log(JSON.stringify(body.oauth2 ?? body, null, 1));
}

const commands = {
  async on() {
    await patch({
      enabled: true,
      providers: [
        {
          name: 'oidc',
          clientId: 'bcn006b-client',
          clientSecret: 'bcn006b-secret',
          displayName: 'BCN006b Stub',
          authURL: `${STUB_HOST_FOR_BROWSER}/authorize`,
          tokenURL: `${STUB_HOST_FOR_POCKETBASE}/token`,
          userInfoURL: `${STUB_HOST_FOR_POCKETBASE}/userinfo`,
          pkce: true
        }
      ],
      mappedFields: { id: '', name: 'name', username: '', avatarURL: '' }
    });
  },

  async off() {
    await patch({
      enabled: false,
      providers: [],
      // The rig's own defaults, read back before this was ever switched on.
      mappedFields: { id: '', name: 'name', username: '', avatarURL: 'avatar' }
    });
  },

  async status() {
    const response = await fetch(`${PB}/api/collections/users/auth-methods`);
    const body = await response.json();
    console.log(JSON.stringify({ oauth2: body.oauth2, otp: body.otp, password: body.password }, null, 1));
  },

  async clean() {
    const auth = await token();
    const list = await (
      await fetch(`${PB}/api/collections/users/records?perPage=200&filter=${encodeURIComponent('email~"bcn006b-subject"')}`, {
        headers: { Authorization: auth }
      })
    ).json();
    for (const record of list.items || []) {
      const response = await fetch(`${PB}/api/collections/users/records/${record.id}`, {
        method: 'DELETE',
        headers: { Authorization: auth }
      });
      console.log(`deleted ${record.id} ${record.email} -> ${response.status}`);
    }
    console.log(`${(list.items || []).length} removed`);
  }
};

const command = commands[process.argv[2]];
if (!command) {
  console.error('usage: node bcn-006-oauth-rig.mjs on|off|status|clean');
  process.exit(2);
}
command().catch((e) => {
  console.error(e);
  process.exit(1);
});
