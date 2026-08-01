/**
 * BCN-007 — probe 2: the three checks that failed in probe 1, with the
 * instrument confounds removed.
 *
 * Probe 1's three failures were each *plausibly* a defect in the probe rather
 * than a fact about the wire, and this phase has already shipped two checks that
 * "passed" against a broken implementation. So each is re-measured with the
 * confound eliminated, and only what survives goes into a descriptor.
 *
 *   1. Directus deleted a "referenced" file with a 204. But the field was
 *      created with a `schema.foreign_key_table` that Directus may simply have
 *      ignored — so there may never have been a real reference. Re-measured with
 *      the relation created explicitly through `POST /relations`.
 *   2. PocketBase served a `protected: true` file with no token. But the create
 *      may have dropped the option. Re-measured by reading the field back.
 *   3. nodegx's signed URL still served 4s past a 3s ttl. But `devOpen` was ON
 *      and `files.read` is `public`, so nothing was ever gated. Re-measured with
 *      `devOpen: false`.
 *
 * Run:  node bcn-007-files-probe2.mjs > BCN-007-FILES-PROBE2-OUTPUT.txt 2>&1
 */

const DIRECTUS = 'http://localhost:8055';
const POCKETBASE = 'http://localhost:8091';
const NODEGX = 'http://127.0.0.1:8110';
const NODEGX_ADMIN_TOKEN = process.env.NODEGX_ADMIN_TOKEN;

let checks = 0;
let failures = 0;
const check = (label, actual, expected) => {
  checks++;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
};
const observe = (label, value) => console.log(`  ....  ${label}: ${JSON.stringify(value)}`);
const section = (t) => console.log(`\n=== ${t} ===`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// ─────────────────────────────────────────────── 1. Directus, real relation

async function directusLogin() {
  const res = await fetch(`${DIRECTUS}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'directus-admin-pw' })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`directus login ${res.status}`);
  return body.data.access_token;
}

async function directusReferencedDelete() {
  section('1. Directus — does a REAL file relation stop a delete?');
  const token = await directusLogin();
  const H = { Authorization: `Bearer ${token}` };
  const HJ = { ...H, 'Content-Type': 'application/json' };

  await fetch(`${DIRECTUS}/collections/bcn007_ref`, { method: 'DELETE', headers: H });

  await fetch(`${DIRECTUS}/collections`, {
    method: 'POST',
    headers: HJ,
    body: JSON.stringify({
      collection: 'bcn007_ref',
      schema: {},
      meta: {},
      fields: [
        { field: 'id', type: 'integer', meta: { hidden: true }, schema: { is_primary_key: true, has_auto_increment: true } },
        { field: 'title', type: 'string', meta: {}, schema: {} }
      ]
    })
  });

  // The field, then the relation — the two-step Directus actually requires.
  const f = await fetch(`${DIRECTUS}/fields/bcn007_ref`, {
    method: 'POST',
    headers: HJ,
    body: JSON.stringify({ field: 'attachment', type: 'uuid', meta: { interface: 'file', special: ['file'] }, schema: {} })
  });
  observe('field create status', f.status);

  const rel = await fetch(`${DIRECTUS}/relations`, {
    method: 'POST',
    headers: HJ,
    body: JSON.stringify({
      collection: 'bcn007_ref',
      field: 'attachment',
      related_collection: 'directus_files',
      schema: { on_delete: 'SET NULL' }
    })
  });
  const relBody = await rel.text();
  observe('POST /relations status', rel.status);
  if (rel.status >= 400) observe('  body', relBody.slice(0, 300));

  const relRead = await fetch(`${DIRECTUS}/relations/bcn007_ref/attachment`, { headers: H });
  const relJson = await relRead.json().catch(() => null);
  check('the relation now exists', relRead.status, 200);
  observe('relation schema', relJson?.data?.schema);

  const form = new FormData();
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'bcn007-ref.png');
  const up = await fetch(`${DIRECTUS}/files`, { method: 'POST', headers: H, body: form });
  const fileId = (await up.json()).data.id;
  observe('uploaded file id', fileId);

  const row = await fetch(`${DIRECTUS}/items/bcn007_ref`, {
    method: 'POST',
    headers: HJ,
    body: JSON.stringify({ title: 'referenced', attachment: fileId })
  });
  const rowId = (await row.json()).data.id;
  observe('referencing row id', rowId);

  const del = await fetch(`${DIRECTUS}/files/${fileId}`, { method: 'DELETE', headers: H });
  const delText = await del.text();
  observe('DELETE /files/{id} with a REAL relation pointing at it', del.status);
  observe('  body', delText.slice(0, 300));

  const after = await fetch(`${DIRECTUS}/items/bcn007_ref/${rowId}`, { headers: H });
  const afterRow = (await after.json()).data;
  observe('the referencing row after the delete', afterRow);

  check(
    "⚠️ the SPEC's trap — 'Directus will not delete a file that is referenced' — holds?",
    del.status >= 400,
    true
  );
  check(
    'what actually happens instead: the delete succeeds and the reference is nulled',
    { status: del.status, attachment: afterRow?.attachment },
    { status: 204, attachment: null }
  );

  await fetch(`${DIRECTUS}/collections/bcn007_ref`, { method: 'DELETE', headers: H });
}

// ─────────────────────────────────────── 2. PocketBase, protected round-trip

async function pbToken() {
  const res = await fetch(`${POCKETBASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'admin@example.com', password: 'pocketbase-admin-pw' })
  });
  if (!res.ok) throw new Error(`pb login ${res.status}`);
  return (await res.json()).token;
}

async function pocketbaseProtected() {
  section('2. PocketBase — did `protected: true` survive the collection create?');
  const token = await pbToken();
  const H = { Authorization: token };

  await fetch(`${POCKETBASE}/api/collections/bcn007_prot`, { method: 'DELETE', headers: H });
  const create = await fetch(`${POCKETBASE}/api/collections`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'bcn007_prot',
      type: 'base',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'open', type: 'file', maxSelect: 1, protected: false },
        { name: 'secret', type: 'file', maxSelect: 1, protected: true }
      ],
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: ''
    })
  });
  const created = await create.json();
  observe('create status', create.status);
  const secretField = (created.fields || []).find((f) => f.name === 'secret');
  const openField = (created.fields || []).find((f) => f.name === 'open');
  observe('as PocketBase stored it — secret', secretField);
  check('`protected` round-tripped as true', secretField?.protected, true);
  check('…and the other field is false', openField?.protected, false);

  const form = new FormData();
  form.append('title', 'prot');
  form.append('open', new Blob([PNG], { type: 'image/png' }), 'open.png');
  form.append('secret', new Blob([PNG], { type: 'image/png' }), 'secret.png');
  const up = await fetch(`${POCKETBASE}/api/collections/bcn007_prot/records`, { method: 'POST', headers: H, body: form });
  const rec = await up.json();
  observe('record', { id: rec.id, open: rec.open, secret: rec.secret });

  const openUrl = `${POCKETBASE}/api/files/${rec.collectionName}/${rec.id}/${rec.open}`;
  const secretUrl = `${POCKETBASE}/api/files/${rec.collectionName}/${rec.id}/${rec.secret}`;

  check('the open file serves with no credential', (await fetch(openUrl)).status, 200);
  const bare = await fetch(secretUrl);
  check('⚠️ the PROTECTED file is refused with no credential', bare.status !== 200, true);
  observe('  status', bare.status);

  // ⚠️ If that just failed: `protected` may defer to the collection's view rule
  // rather than being absolute. This collection was created with `viewRule: ''`
  // — PocketBase for "anyone may view this record". Re-run the same check on a
  // collection nobody may view, which separates "protected is inert" from
  // "protected only bites when the record itself is not public".
  await fetch(`${POCKETBASE}/api/collections/bcn007_prot2`, { method: 'DELETE', headers: H });
  const c2 = await fetch(`${POCKETBASE}/api/collections`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'bcn007_prot2',
      type: 'base',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'secret', type: 'file', maxSelect: 1, protected: true }
      ]
      // No rules at all → admin-only (PocketBase's `null` rule).
    })
  });
  observe('admin-only collection create status', c2.status);
  const f2 = new FormData();
  f2.append('title', 'x');
  f2.append('secret', new Blob([PNG], { type: 'image/png' }), 'secret2.png');
  const r2 = await (await fetch(`${POCKETBASE}/api/collections/bcn007_prot2/records`, { method: 'POST', headers: H, body: f2 })).json();
  const url2 = `${POCKETBASE}/api/files/bcn007_prot2/${r2.id}/${r2.secret}`;
  const bare2 = await fetch(url2);
  check('protected file on an ADMIN-ONLY collection, no credential', bare2.status !== 200, true);
  observe('  status', bare2.status);
  const tok2 = await (await fetch(`${POCKETBASE}/api/files/token`, { method: 'POST', headers: H })).json();
  const withTok2 = await fetch(`${url2}?token=${encodeURIComponent(tok2.token)}`);
  observe('…and with a file token minted as the superuser', withTok2.status);
  await fetch(`${POCKETBASE}/api/collections/bcn007_prot2`, { method: 'DELETE', headers: H });

  // A protected file with the *admin session* token as ?token= — the wrong kind.
  const withSession = await fetch(`${secretUrl}?token=${encodeURIComponent(token)}`);
  observe('protected + ?token=<auth token, not a file token>', withSession.status);

  const tok = await (await fetch(`${POCKETBASE}/api/files/token`, { method: 'POST', headers: H })).json();
  const withFileToken = await fetch(`${secretUrl}?token=${encodeURIComponent(tok.token)}`);
  check('protected + ?token=<FILE token> serves', withFileToken.status, 200);

  const payload = JSON.parse(Buffer.from(tok.token.split('.')[1], 'base64url').toString('utf8'));
  observe('file-token payload (note: no `iat`, so ttl must come from exp - now)', payload);
  const ttl = payload.exp - Math.floor(Date.now() / 1000);
  observe('file-token ttl seconds, measured against the clock', ttl);
  check('the file token is short-lived (PocketBase default is 120s)', ttl > 0 && ttl <= 300, true);

  // Observe the expiry for real: 120s is long but it is the only genuinely
  // short-lived token in the rig apart from ours.
  if (ttl > 0 && ttl <= 150) {
    console.log(`  waiting ${ttl + 3}s to watch the file token actually expire…`);
    await sleep((ttl + 3) * 1000);
    const expired = await fetch(`${secretUrl}?token=${encodeURIComponent(tok.token)}`);
    check('⚠️ the file token STOPS working once expired', expired.status !== 200, true);
    observe('  status', expired.status);
  } else {
    observe('skipped the live expiry wait — ttl too long', ttl);
  }

  await fetch(`${POCKETBASE}/api/collections/bcn007_prot`, { method: 'DELETE', headers: H });
}

// ────────────────────────────────────────── 3. nodegx, signature enforced

async function nodegxSignatureEnforced() {
  section('3. nodegx-backend — signature expiry with devOpen OFF');
  if (!NODEGX_ADMIN_TOKEN) throw new Error('NODEGX_ADMIN_TOKEN not set');
  // ⚠️ `X-NodeGX-Admin-Token` is the *admin dashboard's* header and works on
  // `/admin/*`. `security/state.ts::resolvePrincipal` reads the admin credential
  // from `X-Parse-Master-Key` or `Authorization: Bearer` — probe 2's first run
  // sent the dashboard header at a Parse-wire route and got a 403 that looked
  // like a permission finding and was an instrument defect.
  const A = { 'X-Parse-Master-Key': NODEGX_ADMIN_TOKEN };

  const name = 'bcn007-enforced.png';
  const up = await fetch(`${NODEGX}/files/${name}`, {
    method: 'POST',
    headers: { ...A, 'Content-Type': 'image/png', 'X-NodeGX-File-Private': 'true' },
    body: PNG
  });
  const body = await up.json().catch(() => ({}));
  check('private upload status (admin, enforced)', up.status, 201);
  observe('body', body);
  const stored = body.name;

  const anon = await fetch(body.url);
  check('⚠️ the PLAIN url of a private file is refused anonymously', anon.status !== 200, true);
  observe('  status', anon.status);

  const sign = await fetch(`${NODEGX}/files/${encodeURIComponent(stored)}/sign`, { headers: A });
  const signed = await sign.json().catch(() => ({}));
  check('sign status', sign.status, 200);
  observe('signed', signed);

  const now = await fetch(signed.url);
  check('the signed url serves ANONYMOUSLY — this is the point of signing', now.status, 200);

  console.log('  waiting 4s for the 3s signature to expire…');
  await sleep(4200);
  const later = await fetch(signed.url);
  check('⚠️ the signed url STOPS serving after its ttl', later.status !== 200, true);
  observe('  status after expiry', later.status);
  observe('  body after expiry', (await later.text()).slice(0, 200));

  // A tampered signature must fail too, or "expiry" might just be the exp
  // parameter being ignored and the sig never checked.
  const fresh = await (await fetch(`${NODEGX}/files/${encodeURIComponent(stored)}/sign`, { headers: A })).json();
  const tampered = fresh.url.replace(/sig=([0-9a-f]{4})/, 'sig=0000');
  const tamperRes = await fetch(tampered);
  check('a tampered signature is refused (so the sig is really verified)', tamperRes.status !== 200, true);
  observe('  status', tamperRes.status);

  await fetch(`${NODEGX}/files/${encodeURIComponent(stored)}`, { method: 'DELETE', headers: A });
  const afterDelete = await fetch(body.url, { headers: A });
  check('the file stops serving after deletion', afterDelete.status !== 200, true);
  observe('  status', afterDelete.status);
}

async function main() {
  console.log('=== BCN-007 probe 2 — the three probe-1 failures, confounds removed ===');
  for (const [name, fn] of [
    ['directus', directusReferencedDelete],
    ['pocketbase', pocketbaseProtected],
    ['nodegx', nodegxSignatureEnforced]
  ]) {
    try {
      await fn();
    } catch (e) {
      failures++;
      console.log(`\n  !!!!  ${name} ABORTED: ${e && e.stack ? e.stack : e}`);
    }
  }
  console.log(`\n=== ${checks} checks, ${failures} failures ===`);
  process.exitCode = failures > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error('ABORTED', e);
  process.exitCode = 2;
});
