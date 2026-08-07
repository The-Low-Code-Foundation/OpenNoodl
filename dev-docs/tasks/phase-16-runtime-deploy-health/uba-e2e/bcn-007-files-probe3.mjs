/**
 * BCN-007 — probe 3: why a "private" nodegx file served anonymously, and
 * whether a signed URL expires when the file is genuinely restricted.
 *
 * Probe 2 uploaded with `X-NodeGX-File-Private: true` **as the admin**, and the
 * plain URL still served to an anonymous caller — which also made the expiry
 * check vacuous, because nothing was ever being gated. `files.ts::upload` sets
 * `owner = ctx.principal.kind === 'user' ? principal.userId : null`, so an admin
 * upload produces a private record **with no owner**, and `assertReadable`'s
 * fallback has nobody to exclude.
 *
 * So this uploads as a real signed-in *user*, which is the case an app actually
 * produces, and re-runs the expiry check against a file that is genuinely
 * restricted. That distinction is the difference between "the signature expires"
 * and "the signature was never load-bearing".
 *
 * Run: NODEGX_MASTER_KEY=… node bcn-007-files-probe3.mjs > BCN-007-FILES-PROBE3-OUTPUT.txt 2>&1
 */

const NODEGX = 'http://127.0.0.1:8110';
const MK = process.env.NODEGX_MASTER_KEY;

let checks = 0;
let failures = 0;
const check = (label, actual, expected) => {
  checks++;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
};
const observe = (label, value) => console.log(`  ....  ${label}: ${JSON.stringify(value)}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

async function main() {
  console.log('=== BCN-007 probe 3 — a private file with a real owner ===\n');
  if (!MK) throw new Error('NODEGX_MASTER_KEY not set');
  const A = { 'X-Parse-Master-Key': MK };

  // --- a real end user -----------------------------------------------------
  const username = `bcn007_${Date.now().toString(36)}`;
  const signup = await fetch(`${NODEGX}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'pw-bcn007', email: `${username}@example.com` })
  });
  const user = await signup.json().catch(() => ({}));
  observe('signup status', signup.status);
  observe('user', { objectId: user.objectId, hasSession: !!user.sessionToken });
  const session = user.sessionToken;
  check('a signed-in end user exists', typeof session, 'string');

  const S = { 'X-Parse-Session-Token': session };

  // A second user, so "someone else" is a real principal rather than anonymous.
  const other = `bcn007_other_${Date.now().toString(36)}`;
  const otherRes = await fetch(`${NODEGX}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: other, password: 'pw-bcn007', email: `${other}@example.com` })
  });
  const otherUser = await otherRes.json().catch(() => ({}));
  const OTHER = { 'X-Parse-Session-Token': otherUser.sessionToken };

  // --- upload as the user, private ----------------------------------------
  console.log('\n--- private upload, as the USER ---');
  const up = await fetch(`${NODEGX}/files/bcn007-owned.png`, {
    method: 'POST',
    headers: { ...S, 'Content-Type': 'image/png', 'X-NodeGX-File-Private': 'true' },
    body: PNG
  });
  const body = await up.json().catch(() => ({}));
  check('upload status', up.status, 201);
  observe('body', body);
  const stored = body.name;

  check('the owner can read it with their session', (await fetch(body.url, { headers: S })).status, 200);

  const anon = await fetch(body.url);
  check('⚠️ anonymous cannot read a private file', anon.status !== 200, true);
  observe('  status', anon.status);

  const byOther = await fetch(body.url, { headers: OTHER });
  check('a DIFFERENT signed-in user cannot read it either', byOther.status !== 200, true);
  observe('  status', byOther.status);

  // --- the signed URL, and its expiry -------------------------------------
  console.log('\n--- sign, then watch it expire (ttl is 3s in this data dir) ---');
  const sign = await fetch(`${NODEGX}/files/${encodeURIComponent(stored)}/sign`, { headers: S });
  const signed = await sign.json().catch(() => ({}));
  check('sign status', sign.status, 200);
  observe('signed', signed);
  check('ttlSeconds is the configured 3', signed.ttlSeconds, 3);

  const now = await fetch(signed.url);
  check('the signed url serves ANONYMOUSLY — the whole point of signing', now.status, 200);

  const tampered = signed.url.replace(/sig=[0-9a-f]{8}/, 'sig=00000000');
  const tamperRes = await fetch(tampered);
  check('a tampered signature is refused', tamperRes.status !== 200, true);
  observe('  status', tamperRes.status);

  const noSig = signed.url.split('?')[0];
  check('and the bare url (signature stripped) is refused', (await fetch(noSig)).status !== 200, true);

  console.log('  waiting 4.2s…');
  await sleep(4200);
  const later = await fetch(signed.url);
  check('⚠️ THE SIGNED URL STOPS SERVING AFTER ITS TTL', later.status !== 200, true);
  observe('  status after expiry', later.status);
  observe('  body after expiry', (await later.text()).slice(0, 160));

  // --- delete, then confirm the read fails --------------------------------
  console.log('\n--- delete ---');
  const del = await fetch(`${NODEGX}/files/${encodeURIComponent(stored)}`, { method: 'DELETE', headers: A });
  observe('DELETE status (master key)', del.status);
  const afterDelete = await fetch(body.url, { headers: S });
  check('the owner can no longer read it after deletion', afterDelete.status, 404);

  // --- and a PUBLIC upload, so the contrast is on the record --------------
  console.log('\n--- a public upload, for contrast ---');
  const pub = await fetch(`${NODEGX}/files/bcn007-public.png`, {
    method: 'POST',
    headers: { ...S, 'Content-Type': 'image/png' },
    body: PNG
  });
  const pubBody = await pub.json();
  check('a non-private file serves anonymously', (await fetch(pubBody.url)).status, 200);
  // Signing a public file is legal and produces a url that also just works.
  const pubSigned = await (
    await fetch(`${NODEGX}/files/${encodeURIComponent(pubBody.name)}/sign`, { headers: S })
  ).json();
  observe('signing a public file', pubSigned);
  await sleep(4200);
  check(
    '⚠️ an EXPIRED signature on a PUBLIC file still serves — the file was never gated',
    (await fetch(pubSigned.url)).status,
    200
  );
  await fetch(`${NODEGX}/files/${encodeURIComponent(pubBody.name)}`, { method: 'DELETE', headers: A });

  console.log(`\n=== ${checks} checks, ${failures} failures ===`);
  process.exitCode = failures > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error('ABORTED', e);
  process.exitCode = 2;
});
