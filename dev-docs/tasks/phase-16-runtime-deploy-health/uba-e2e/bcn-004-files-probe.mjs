/**
 * BCN-004 / BCN-007 remainder — the Directus file payload, measured.
 *
 * BCN-007 shipped a Directus file field map (`filename_disk` / `filename_download`
 * / `type` / `filesize`) marked **"documented, not probed"**, and named BCN-004 as
 * the task that owes the confirmation. This is that confirmation.
 *
 * It also answers the second thing BCN-007-NOTES §3 lists as never observed: what
 * a real upload's 201 actually carries, as opposed to what the literal fixture in
 * `file-ref.test.ts` asserts.
 *
 * Run:  node bcn-004-files-probe.mjs > BCN-004-FILES-PROBE-OUTPUT.txt 2>&1
 *
 * ⚠️ Do NOT pipe this into `head` — a closed pipe SIGPIPEs node partway through
 * and the run looks like the server stopped answering.
 */

const DIRECTUS = 'http://localhost:8055';
const EMAIL = 'admin@example.com';
const PASSWORD = 'directus-admin-pw';

let checks = 0;
let failures = 0;

function check(label, actual, expected) {
  checks++;
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

function observe(label, value) {
  console.log(`  ....  ${label}: ${JSON.stringify(value)}`);
}

async function login() {
  const res = await fetch(`${DIRECTUS}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`login ${res.status}: ${JSON.stringify(body)}`);
  return body.data.access_token;
}

async function main() {
  console.log('=== BCN-004 / BCN-007 — the Directus file payload, measured ===\n');
  console.log(`Directus: ${DIRECTUS}`);

  const token = await login();
  console.log('logged in.\n');

  // ---------------------------------------------------------------- upload
  console.log('--- 1. POST /files (multipart) — the response BCN-007 never observed ---');

  // A 1x1 transparent PNG, so `type` is a real image type rather than octet-stream.
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  const form = new FormData();
  form.append('title', 'bcn-004 probe');
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'bcn-004-probe.png');

  const up = await fetch(`${DIRECTUS}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  const upText = await up.text();
  console.log(`  status: ${up.status}`);
  console.log(`  content-type: ${up.headers.get('content-type')}`);
  let upBody;
  try {
    upBody = JSON.parse(upText);
  } catch {
    console.log(`  body (unparseable): ${upText.slice(0, 400)}`);
    throw new Error('upload response was not JSON');
  }
  console.log(`  body:\n${JSON.stringify(upBody, null, 2).split('\n').map((l) => '    ' + l).join('\n')}`);

  const file = upBody.data;
  console.log('\n  The four fields BCN-007 documented but never probed:');
  check('`filename_disk` present', typeof file?.filename_disk, 'string');
  check('`filename_download` present', typeof file?.filename_download, 'string');
  check('`type` present', typeof file?.type, 'string');
  observe('`type` value', file?.type);
  observe('`filesize` value + JS type', `${JSON.stringify(file?.filesize)} (${typeof file?.filesize})`);
  observe('`id` value', file?.id);
  check('no `url` field on the payload (adapter must synthesise)', file?.url, undefined);
  check('no `contentType` field (Directus calls it `type`)', file?.contentType, undefined);
  check('no `size` field (Directus calls it `filesize`)', file?.size, undefined);
  observe('all keys', Object.keys(file ?? {}).sort());

  // ------------------------------------------------------- the asset URL
  console.log('\n--- 2. GET /assets/{id} — does the synthesised URL actually serve? ---');
  const assetUrl = `${DIRECTUS}/assets/${file.id}`;
  observe('composed url', assetUrl);
  const asset = await fetch(assetUrl, { headers: { Authorization: `Bearer ${token}` } });
  check('/assets/{id} serves', asset.status, 200);
  observe('served content-type', asset.headers.get('content-type'));
  const bytes = Buffer.from(await asset.arrayBuffer());
  check('served bytes match what was uploaded', bytes.equals(PNG), true);

  const anon = await fetch(assetUrl);
  observe('unauthenticated GET /assets/{id} status', anon.status);

  // --------------------------------------------------------- read it back
  console.log('\n--- 3. GET /files/{id} — read shape vs upload shape ---');
  const readRes = await fetch(`${DIRECTUS}/files/${file.id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const readBody = await readRes.json();
  check('read status', readRes.status, 200);
  const read = readBody.data;
  check('read `filename_disk` matches upload', read?.filename_disk, file?.filename_disk);
  check('read `type` matches upload', read?.type, file?.type);
  check('read `filesize` matches upload', String(read?.filesize), String(file?.filesize));
  const upKeys = Object.keys(file ?? {}).sort().join(',');
  const readKeys = Object.keys(read ?? {}).sort().join(',');
  check('read payload has the same keys as the upload payload', readKeys, upKeys);
  if (readKeys !== upKeys) {
    observe('keys only on read', Object.keys(read ?? {}).filter((k) => !(k in file)));
    observe('keys only on upload', Object.keys(file ?? {}).filter((k) => !(k in read)));
  }

  // -------------------------------------------------------------- cleanup
  console.log('\n--- 4. DELETE /files/{id} ---');
  const del = await fetch(`${DIRECTUS}/files/${file.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  check('delete status', del.status, 204);
  // ⚠️ Directus answers **403 FORBIDDEN**, not 404, for a file id that does not
  // exist — with an admin token, and for a well-formed-but-unused uuid and for a
  // string that is not a uuid at all. It is deliberate information hiding, and it
  // means an adapter **cannot tell "deleted" from "not allowed"** on this wire.
  // Mapping 403 to "check your token" would give the wrong message for a file
  // that is simply gone.
  const gone = await fetch(`${DIRECTUS}/files/${file.id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  check('reading a deleted file is 403, not 404 (Directus hides existence)', gone.status, 403);
  const neverExisted = await fetch(`${DIRECTUS}/files/00000000-0000-4000-8000-000000000000`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  check('...and a never-existed id is the same 403, so the two are indistinguishable', neverExisted.status, 403);

  console.log(`\n=== ${checks} checks, ${failures} failures ===`);
  process.exitCode = failures > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error('\nPROBE ABORTED:', err);
  process.exitCode = 2;
});
