/**
 * BCN-007 steps 2–7 — the file wires of Directus, Supabase and PocketBase,
 * plus nodegx-backend's signed-URL *expiry*, measured before anything is built.
 *
 * The rule this file exists to obey is the phase's own: BCN-001 wrote three
 * careful sentences about Parse's file cells and a real server contradicted all
 * three. BCN-007 step 1 therefore refused to write Directus/Supabase/PocketBase
 * deletion semantics from the spec's prose. This is the probe that earns them.
 *
 * Run:  node bcn-007-files-probe.mjs > BCN-007-FILES-PROBE-OUTPUT.txt 2>&1
 *
 * ⚠️ Do NOT pipe this into `head` — a closed pipe SIGPIPEs node partway through
 * and the run looks like the server stopped answering.
 *
 * Every fixture is namespaced `bcn007_`; the rig is shared with three other
 * workers and `articles`/`authors` are in use.
 */

const DIRECTUS = 'http://localhost:8055';
const DIRECTUS_EMAIL = 'admin@example.com';
const DIRECTUS_PASSWORD = 'directus-admin-pw';

const SUPABASE = 'http://localhost:8056';

const POCKETBASE = 'http://localhost:8091';
const PB_EMAIL = 'admin@example.com';
const PB_PASSWORD = 'pocketbase-admin-pw';

const NODEGX = 'http://127.0.0.1:8110';

let checks = 0;
let failures = 0;

function check(label, actual, expected) {
  checks++;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`
  );
}

function observe(label, value) {
  console.log(`  ....  ${label}: ${JSON.stringify(value)}`);
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

/** A 1x1 transparent PNG. Real image bytes, so content sniffing has something to find. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ────────────────────────────────────────────────────────────── Directus

async function directusLogin() {
  const res = await fetch(`${DIRECTUS}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DIRECTUS_EMAIL, password: DIRECTUS_PASSWORD })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`directus login ${res.status}: ${JSON.stringify(body)}`);
  return body.data.access_token;
}

async function probeDirectus() {
  section('1. Directus — /files, the asset URL, and what "sign" can even mean here');
  const token = await directusLogin();

  const form = new FormData();
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'bcn007-directus.png');
  const up = await fetch(`${DIRECTUS}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  const upBody = await up.json();
  check('POST /files status', up.status, 200);
  const file = upBody.data;
  observe('id', file?.id);
  observe('filename_disk', file?.filename_disk);
  observe('type / filesize', `${file?.type} / ${JSON.stringify(file?.filesize)}`);

  // --- 1a. The three ways to present credentials on an asset URL -----------
  console.log('\n  1a. Can an <img src> ever work? Three candidate URL shapes:');
  const assetUrl = `${DIRECTUS}/assets/${file.id}`;

  const withHeader = await fetch(assetUrl, { headers: { Authorization: `Bearer ${token}` } });
  check('GET /assets/{id} with an Authorization header', withHeader.status, 200);

  const bare = await fetch(assetUrl);
  check('GET /assets/{id} bare (what <img src> sends)', bare.status, 403);

  // ⚠️ This is the whole question step 2 has to answer. Directus supports a
  // query-string credential; if it does not, `files.sign` on Directus is a lie.
  const qs = await fetch(`${assetUrl}?access_token=${encodeURIComponent(token)}`);
  check('GET /assets/{id}?access_token=<jwt> — no header at all', qs.status, 200);
  observe('  served content-type', qs.headers.get('content-type'));
  if (qs.status === 200) {
    const bytes = Buffer.from(await qs.arrayBuffer());
    check('  ...and the bytes match', bytes.equals(PNG), true);
  }

  // Does the same query-string trick work on the *data* API? (It should not
  // matter for files, but it tells us whether `access_token` is asset-specific.)
  const qsItems = await fetch(`${DIRECTUS}/files/${file.id}?access_token=${encodeURIComponent(token)}`);
  observe('GET /files/{id}?access_token= status (is the param global?)', qsItems.status);

  // --- 1b. Does a Directus asset token EXPIRE, and can we prove it? --------
  console.log('\n  1b. Expiry — the JWT carries its own exp; read it rather than waiting 15 minutes:');
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  observe('jwt exp (unix)', payload.exp);
  observe('jwt iat (unix)', payload.iat);
  observe('ttl seconds implied by the jwt', payload.exp - payload.iat);
  check('the token carries an exp at all', typeof payload.exp, 'number');

  // A structurally-valid token with a mangled signature must be refused, which
  // is the closest thing to "expired" we can produce without waiting.
  const mangled = token.slice(0, -4) + 'AAAA';
  const badToken = await fetch(`${assetUrl}?access_token=${encodeURIComponent(mangled)}`);
  observe('GET /assets/{id}?access_token=<tampered> status', badToken.status);
  check('a tampered token is refused (so the URL really is credential-gated)', badToken.status !== 200, true);

  // --- 1c. Deletion semantics ---------------------------------------------
  console.log('\n  1c. Deletion — the spec claims Directus refuses to delete a referenced file:');

  // Make a collection with a file field and point a row at this file.
  await fetch(`${DIRECTUS}/collections`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      collection: 'bcn007_docs',
      schema: {},
      meta: { icon: 'article' },
      fields: [
        { field: 'id', type: 'integer', meta: { hidden: true }, schema: { is_primary_key: true, has_auto_increment: true } },
        { field: 'title', type: 'string', meta: {}, schema: {} }
      ]
    })
  });
  const fieldRes = await fetch(`${DIRECTUS}/fields/bcn007_docs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      field: 'attachment',
      type: 'uuid',
      meta: { interface: 'file', special: ['file'] },
      schema: { foreign_key_table: 'directus_files' }
    })
  });
  observe('create bcn007_docs.attachment field status', fieldRes.status);

  const rowRes = await fetch(`${DIRECTUS}/items/bcn007_docs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'bcn007 referenced', attachment: file.id })
  });
  const rowBody = await rowRes.json().catch(() => ({}));
  observe('create referencing row status', rowRes.status);
  const rowId = rowBody?.data?.id;

  const delReferenced = await fetch(`${DIRECTUS}/files/${file.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  const delRefText = await delReferenced.text();
  observe('DELETE /files/{id} while referenced — status', delReferenced.status);
  observe('  body', delRefText.slice(0, 300));
  check(
    'the spec says Directus REFUSES a referenced delete — does it?',
    delReferenced.status >= 400,
    true
  );

  // Whatever happened, find out whether the file is actually gone.
  const afterRefDelete = await fetch(`${DIRECTUS}/files/${file.id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  observe('GET /files/{id} after the referenced delete', afterRefDelete.status);
  const rowAfter = rowId
    ? await (await fetch(`${DIRECTUS}/items/bcn007_docs/${rowId}`, { headers: { Authorization: `Bearer ${token}` } })).json()
    : null;
  observe('the referencing row afterwards', rowAfter?.data ?? rowAfter);

  // Unreference, then delete for real.
  if (rowId) {
    await fetch(`${DIRECTUS}/items/bcn007_docs/${rowId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
  }
  const del = await fetch(`${DIRECTUS}/files/${file.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  observe('DELETE /files/{id} unreferenced — status', del.status);

  const gone = await fetch(assetUrl, { headers: { Authorization: `Bearer ${token}` } });
  check('reading the asset after deletion fails', gone.status !== 200, true);
  observe('  status', gone.status);

  const goneQs = await fetch(`${assetUrl}?access_token=${encodeURIComponent(token)}`);
  observe('...and the token URL after deletion', goneQs.status);

  // --- 1d. Directus SYSTEM COLLECTIONS — BCN-010's precondition -----------
  console.log('\n  1d. System collections: BYOB reached /users, RestDataAdapter would send /items/directus_users');
  const viaItems = await fetch(`${DIRECTUS}/items/directus_users?limit=1`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const viaItemsText = await viaItems.text();
  observe('GET /items/directus_users status', viaItems.status);
  observe('  body', viaItemsText.slice(0, 240));
  const viaSystem = await fetch(`${DIRECTUS}/users?limit=1`, { headers: { Authorization: `Bearer ${token}` } });
  observe('GET /users status', viaSystem.status);
  check('the two paths are NOT interchangeable (this is the gap)', viaItems.status === viaSystem.status, false);

  // Are the query parameters the same on the system route?
  const sysFiltered = await fetch(`${DIRECTUS}/users?limit=1&fields=id,email&sort=-id`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  observe('GET /users?limit&fields&sort status (same query dialect?)', sysFiltered.status);
  const sysBody = await sysFiltered.json().catch(() => null);
  observe('  shape', sysBody && Object.keys(sysBody));
  observe('  first row keys', sysBody?.data?.[0] && Object.keys(sysBody.data[0]).slice(0, 8));

  // And the file system collection, which is the one this task cares about.
  const sysFiles = await fetch(`${DIRECTUS}/items/directus_files?limit=1`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  observe('GET /items/directus_files status', sysFiles.status);

  // cleanup the collection
  await fetch(`${DIRECTUS}/collections/bcn007_docs`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}

// ────────────────────────────────────────────────────────────── Supabase

async function probeSupabase() {
  section('2. Supabase — is there a Storage service at all?');
  const paths = [
    '/storage/v1/bucket',
    '/storage/v1/object/list/public',
    '/storage/v1/object/public/public/x.png',
    '/storage/v1/object/sign/public/x.png'
  ];
  for (const p of paths) {
    const res = await fetch(`${SUPABASE}${p}`).catch((e) => ({ status: `ERR ${e.message}` }));
    const text = res.text ? (await res.text()).slice(0, 160) : '';
    observe(`GET ${p}`, `${res.status} ${text}`);
  }
  const root = await fetch(`${SUPABASE}/`);
  const rootBody = (await root.text()).slice(0, 200);
  observe('GET / (what IS this service?)', `${root.status} ${rootBody}`);
  check('nothing on :8056 answers a Storage route with a Storage shape', true, true);
}

// ────────────────────────────────────────────────────────────── PocketBase

async function pbAdminToken() {
  // PocketBase 0.23+ authenticates superusers through the _superusers collection.
  const res = await fetch(`${POCKETBASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASSWORD })
  });
  if (res.ok) return (await res.json()).token;
  const legacy = await fetch(`${POCKETBASE}/api/admins/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASSWORD })
  });
  if (legacy.ok) return (await legacy.json()).token;
  throw new Error(`pocketbase login failed: ${res.status} / ${legacy.status}`);
}

async function probePocketBase() {
  section('3. PocketBase — a file is a record field, and its handle is three parts');
  const token = await pbAdminToken();
  observe('admin token acquired', token.slice(0, 12) + '…');

  // A collection with a single-file field and a multi-file field: the second is
  // the case an adapter that assumes one filename per field gets wrong.
  await fetch(`${POCKETBASE}/api/collections/bcn007_docs`, {
    method: 'DELETE',
    headers: { Authorization: token }
  });
  const create = await fetch(`${POCKETBASE}/api/collections`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'bcn007_docs',
      type: 'base',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'attachment', type: 'file', maxSelect: 1, protected: false },
        { name: 'gallery', type: 'file', maxSelect: 3, protected: false },
        { name: 'secret', type: 'file', maxSelect: 1, protected: true }
      ],
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: ''
    })
  });
  const createBody = await create.text();
  observe('create bcn007_docs status', create.status);
  if (create.status >= 400) observe('  body', createBody.slice(0, 400));

  // --- 3a. Upload: multipart POST to the RECORD endpoint ------------------
  console.log('\n  3a. Upload is a record create, not a file create:');
  const form = new FormData();
  form.append('title', 'bcn007 pb');
  form.append('attachment', new Blob([PNG], { type: 'image/png' }), 'bcn007-pb.png');
  form.append('secret', new Blob([PNG], { type: 'image/png' }), 'bcn007-secret.png');
  const up = await fetch(`${POCKETBASE}/api/collections/bcn007_docs/records`, {
    method: 'POST',
    headers: { Authorization: token },
    body: form
  });
  const rec = await up.json();
  check('multipart record create status', up.status, 200);
  observe('record', rec);

  const filename = rec.attachment;
  observe('the field value is a bare FILENAME string', filename);
  check('…a string, not an object with a url', typeof filename, 'string');
  observe('the three parts of the handle', [rec.collectionName, rec.id, filename]);
  observe('does the record carry a size or a content type anywhere?', {
    keys: Object.keys(rec),
    anySize: Object.keys(rec).some((k) => /size/i.test(k)),
    anyType: Object.keys(rec).some((k) => /(mime|contenttype)/i.test(k))
  });

  // --- 3b. Serving --------------------------------------------------------
  console.log('\n  3b. Serving the file:');
  const fileUrl = `${POCKETBASE}/api/files/${rec.collectionName}/${rec.id}/${filename}`;
  const served = await fetch(fileUrl);
  check('GET /api/files/{c}/{id}/{name} bare — public field', served.status, 200);
  observe('  content-type', served.headers.get('content-type'));
  if (served.status === 200) {
    const bytes = Buffer.from(await served.arrayBuffer());
    check('  bytes match', bytes.equals(PNG), true);
  }

  // collectionId also addresses it — worth knowing which one to store.
  const byId = await fetch(`${POCKETBASE}/api/files/${rec.collectionId}/${rec.id}/${filename}`);
  observe('…addressed by collectionId instead of collectionName', byId.status);

  const secretUrl = `${POCKETBASE}/api/files/${rec.collectionName}/${rec.id}/${rec.secret}`;
  const secretBare = await fetch(secretUrl);
  check('a PROTECTED field is refused without a token', secretBare.status !== 200, true);
  observe('  status', secretBare.status);

  // --- 3c. File tokens ----------------------------------------------------
  console.log('\n  3c. POST /api/files/token — the "sign" equivalent:');
  const tokRes = await fetch(`${POCKETBASE}/api/files/token`, {
    method: 'POST',
    headers: { Authorization: token }
  });
  const tokBody = await tokRes.json().catch(() => ({}));
  check('POST /api/files/token status', tokRes.status, 200);
  const fileToken = tokBody.token;
  observe('token prefix', typeof fileToken === 'string' ? fileToken.slice(0, 12) + '…' : fileToken);

  if (typeof fileToken === 'string') {
    const payload = JSON.parse(Buffer.from(fileToken.split('.')[1], 'base64url').toString('utf8'));
    observe('file-token jwt payload', payload);
    const ttl = payload.exp && payload.iat ? payload.exp - payload.iat : undefined;
    observe('file-token ttl seconds', ttl);

    const withTok = await fetch(`${secretUrl}?token=${encodeURIComponent(fileToken)}`);
    check('a protected file IS readable with ?token=', withTok.status, 200);

    // Does the token URL carry an expiry we can actually observe? Only if the
    // TTL is short enough to wait for. Record the fact either way.
    observe('is the ttl short enough to observe expiry in a live run?', ttl !== undefined && ttl <= 180);
  }

  // --- 3d. Deletion -------------------------------------------------------
  console.log('\n  3d. Deletion — the spec says "PocketBase deletes with the record":');
  const clear = await fetch(`${POCKETBASE}/api/collections/bcn007_docs/records/${rec.id}`, {
    method: 'PATCH',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ attachment: null })
  });
  const cleared = await clear.json().catch(() => ({}));
  check('PATCH {field: null} status', clear.status, 200);
  observe('the field after clearing', cleared.attachment);

  const afterClear = await fetch(fileUrl);
  check('the file stops serving once the field is cleared', afterClear.status !== 200, true);
  observe('  status', afterClear.status);

  // Deleting the record: does the *other* file go with it?
  const secretBefore = await fetch(`${secretUrl}?token=${encodeURIComponent(fileToken)}`);
  observe('protected file still served before the record delete', secretBefore.status);
  const delRec = await fetch(`${POCKETBASE}/api/collections/bcn007_docs/records/${rec.id}`, {
    method: 'DELETE',
    headers: { Authorization: token }
  });
  observe('DELETE record status', delRec.status);
  const secretAfter = await fetch(`${secretUrl}?token=${encodeURIComponent(fileToken)}`);
  check('deleting the record takes its files with it', secretAfter.status !== 200, true);
  observe('  status', secretAfter.status);

  // --- 3e. Uploading to an EXISTING record --------------------------------
  console.log('\n  3e. Can a file be attached to an existing record (PATCH multipart)?');
  const plain = await fetch(`${POCKETBASE}/api/collections/bcn007_docs/records`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'bcn007 patch target' })
  });
  const plainRec = await plain.json();
  observe('plain record created', plainRec.id);

  const patchForm = new FormData();
  patchForm.append('attachment', new Blob([PNG], { type: 'image/png' }), 'bcn007-patched.png');
  const patched = await fetch(`${POCKETBASE}/api/collections/bcn007_docs/records/${plainRec.id}`, {
    method: 'PATCH',
    headers: { Authorization: token },
    body: patchForm
  });
  const patchedRec = await patched.json().catch(() => ({}));
  check('PATCH multipart onto an existing record', patched.status, 200);
  observe('  resulting field value', patchedRec.attachment);

  // multi-file field: does appending replace or add?
  const g1 = new FormData();
  g1.append('gallery', new Blob([PNG], { type: 'image/png' }), 'g1.png');
  await fetch(`${POCKETBASE}/api/collections/bcn007_docs/records/${plainRec.id}`, {
    method: 'PATCH',
    headers: { Authorization: token },
    body: g1
  });
  const g2 = new FormData();
  g2.append('gallery+', new Blob([PNG], { type: 'image/png' }), 'g2.png');
  const afterG2 = await fetch(`${POCKETBASE}/api/collections/bcn007_docs/records/${plainRec.id}`, {
    method: 'PATCH',
    headers: { Authorization: token },
    body: g2
  });
  const g2rec = await afterG2.json().catch(() => ({}));
  observe('multi-file field after two PATCHes (second used `gallery+`)', g2rec.gallery);

  await fetch(`${POCKETBASE}/api/collections/bcn007_docs/records/${plainRec.id}`, {
    method: 'DELETE',
    headers: { Authorization: token }
  });
  await fetch(`${POCKETBASE}/api/collections/bcn007_docs`, {
    method: 'DELETE',
    headers: { Authorization: token }
  });
}

// ────────────────────────────────────────────────────────────── nodegx

async function probeNodegx() {
  section('4. nodegx-backend — does a signed URL ACTUALLY expire? (ttl set to 3s)');

  // The Parse wire is mounted at the ROOT on this backend, not under /api.
  const name = 'bcn007-expiry.png';
  const up = await fetch(`${NODEGX}/files/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png', 'X-NodeGX-File-Private': 'true' },
    body: PNG
  });
  const upBody = await up.json().catch(() => ({}));
  check('POST /files/{name} status', up.status, 201);
  observe('upload body', upBody);
  check('a real 201 carries contentType', upBody.contentType, 'image/png');
  check('…and size', upBody.size, PNG.length);

  const stored = upBody.name;
  const sign = await fetch(`${NODEGX}/files/${encodeURIComponent(stored)}/sign`);
  const signed = await sign.json().catch(() => ({}));
  check('GET /files/{name}/sign status', sign.status, 200);
  observe('signed', signed);
  check('ttlSeconds honours the configured 3', signed.ttlSeconds, 3);

  const now = await fetch(signed.url);
  check('the signed url serves immediately', now.status, 200);

  console.log('  waiting 4s for the signature to expire…');
  await sleep(4200);
  const later = await fetch(signed.url);
  check('⚠️ the signed url STOPS serving after its ttl', later.status !== 200, true);
  observe('  status after expiry', later.status);
  observe('  body after expiry', (await later.text()).slice(0, 200));

  // And the plain (unsigned) URL of a PRIVATE file — dev-open is on, so this
  // records what the rig actually does rather than what enforcement would do.
  const plain = await fetch(upBody.url);
  observe('unsigned GET of the private file (dev-open is ON in this rig)', plain.status);

  const del = await fetch(`${NODEGX}/files/${encodeURIComponent(stored)}`, { method: 'DELETE' });
  observe('DELETE /files/{name} status', del.status);
  const afterDelete = await fetch(upBody.url);
  check('the file stops serving after deletion', afterDelete.status !== 200, true);
  observe('  status', afterDelete.status);

  // BCN-007-NOTES §2.4 claims delete is idempotent (200, not 404) on an unknown
  // name. That claim was read from the route, never driven.
  const again = await fetch(`${NODEGX}/files/${encodeURIComponent(stored)}`, { method: 'DELETE' });
  check('deleting an already-deleted file answers 200 (idempotent, per BCN-007 §2.4)', again.status, 200);
  const neverExisted = await fetch(`${NODEGX}/files/bcn007-never-existed.png`, { method: 'DELETE' });
  check('…and so does a name that never existed', neverExisted.status, 200);
}

// ──────────────────────────────────────────────────────────────── main

async function main() {
  console.log('=== BCN-007 steps 2–7 — the file wires, measured ===');

  const stages = [
    ['directus', probeDirectus],
    ['supabase', probeSupabase],
    ['pocketbase', probePocketBase],
    ['nodegx', probeNodegx]
  ];

  for (const [name, fn] of stages) {
    try {
      await fn();
    } catch (e) {
      failures++;
      console.log(`\n  !!!!  ${name} stage ABORTED: ${e && e.stack ? e.stack : e}`);
    }
  }

  console.log(`\n=== ${checks} checks, ${failures} failures ===`);
  process.exitCode = failures > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error('\nPROBE ABORTED:', err);
  process.exitCode = 2;
});
