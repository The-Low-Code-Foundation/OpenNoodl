/**
 * BCN-007 — Supabase Storage, measured for the first time.
 *
 * ⚠️ **The rig has never had a Storage service.** `:8056` is plain PostgREST and
 * answers every `/storage/v1/*` with a `404 {}` (see BCN-007-FILES-PROBE-OUTPUT
 * §2). BCN-006 hit the same wall on auth and correctly *refused to flip its
 * Supabase cells* rather than write what nothing had measured; four went
 * `conditional`. So rather than implement Supabase files from documentation,
 * this task stood a real `supabase/storage-api` up against the rig's existing
 * `supabase-db` and probed it.
 *
 * The service is added to `docker-compose.yml` under the `supabase` profile so
 * the measurement is reproducible.
 *
 * Run: SUPABASE_STORAGE=http://localhost:8112 SUPABASE_SERVICE_KEY=… \
 *        node bcn-007-supabase-storage-probe.mjs > BCN-007-SUPABASE-STORAGE-OUTPUT.txt 2>&1
 */

const BASE = process.env.SUPABASE_STORAGE || 'http://localhost:8112';
const SERVICE = process.env.SUPABASE_SERVICE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY;

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
  console.log('=== BCN-007 — Supabase Storage, measured ===\n');
  if (!SERVICE) throw new Error('SUPABASE_SERVICE_KEY not set');
  const H = { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE };

  // --- buckets -------------------------------------------------------------
  console.log('--- 1. buckets ---');
  for (const [name, isPublic] of [
    ['bcn007-public', true],
    ['bcn007-private', false]
  ]) {
    await fetch(`${BASE}/bucket/${name}/empty`, { method: 'POST', headers: H }).catch(() => {});
    await fetch(`${BASE}/bucket/${name}`, { method: 'DELETE', headers: H }).catch(() => {});
    const res = await fetch(`${BASE}/bucket`, {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, id: name, public: isPublic })
    });
    observe(`create bucket ${name} (public=${isPublic})`, `${res.status} ${(await res.text()).slice(0, 160)}`);
  }

  // --- upload --------------------------------------------------------------
  console.log('\n--- 2. upload: POST /object/{bucket}/{path} ---');
  const objectPath = 'bcn007/probe.png';

  // ⚠️ Two shapes are documented for the upload body: raw bytes with a
  // Content-Type, and multipart. Measure both — the adapter has to pick one.
  const rawUp = await fetch(`${BASE}/object/bcn007-public/${objectPath}`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'image/png' },
    body: PNG
  });
  const rawBody = await rawUp.text();
  check('raw-bytes upload status', rawUp.status, 200);
  observe('raw-bytes upload body', rawBody.slice(0, 300));

  const form = new FormData();
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'probe.png');
  const mpUp = await fetch(`${BASE}/object/bcn007-public/bcn007/multipart.png`, {
    method: 'POST',
    headers: H,
    body: form
  });
  observe('multipart upload status', mpUp.status);
  observe('  body', (await mpUp.text()).slice(0, 300));

  // What does the upload response actually carry? This is the FileRef question.
  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    parsed = null;
  }
  observe('upload response keys', parsed && Object.keys(parsed));
  // ⚠️ These three are "is the field ABSENT" checks, so on a failed upload they
  // pass for the wrong reason — which is exactly what the first run of this
  // probe did against a 400. Gate them on the upload having succeeded, or they
  // are three green ticks proving nothing.
  const uploaded = rawUp.status === 200;
  check('(guard) the upload succeeded, so the absence checks below mean something', uploaded, true);
  check('⚠️ does the upload response carry a url?', uploaded && parsed && 'url' in parsed, false);
  check('…a size?', uploaded && parsed && 'size' in parsed, false);
  check('…a content type?', uploaded && parsed && ('contentType' in parsed || 'mimetype' in parsed), false);

  // --- the metadata that IS available -------------------------------------
  console.log('\n--- 3. where do contentType and size come from? ---');
  const info = await fetch(`${BASE}/object/info/public/bcn007-public/${objectPath}`);
  observe('GET /object/info/public/{bucket}/{path}', `${info.status}`);
  observe('  headers', {
    'content-type': info.headers.get('content-type'),
    'content-length': info.headers.get('content-length'),
    etag: info.headers.get('etag')
  });

  const list = await fetch(`${BASE}/object/list/bcn007-public`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: 'bcn007', limit: 10 })
  });
  const listBody = await list.json().catch(() => null);
  observe('POST /object/list/{bucket} status', list.status);
  observe('  first entry', Array.isArray(listBody) ? listBody[0] : listBody);

  // --- public url ----------------------------------------------------------
  console.log('\n--- 4. the public URL, with no credential at all ---');
  const publicUrl = `${BASE}/object/public/bcn007-public/${objectPath}`;
  const pub = await fetch(publicUrl);
  check('GET /object/public/{bucket}/{path} bare', pub.status, 200);
  observe('  content-type', pub.headers.get('content-type'));
  if (pub.status === 200) {
    const bytes = Buffer.from(await pub.arrayBuffer());
    check('  bytes match', bytes.equals(PNG), true);
  }

  // --- private bucket ------------------------------------------------------
  console.log('\n--- 5. a PRIVATE bucket ---');
  const privPath = 'bcn007/secret.png';
  const privUp = await fetch(`${BASE}/object/bcn007-private/${privPath}`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'image/png' },
    body: PNG
  });
  observe('private upload status', privUp.status);
  const privPublicUrl = `${BASE}/object/public/bcn007-private/${privPath}`;
  check('(guard) the private upload succeeded', privUp.status, 200);
  const privBare = await fetch(privPublicUrl);
  check('⚠️ the /object/public/ url of a PRIVATE bucket is refused', privBare.status, 400);
  observe('  status', privBare.status);

  // --- signing -------------------------------------------------------------
  console.log('\n--- 6. POST /object/sign/{bucket}/{path} — a real signed URL ---');
  const sign = await fetch(`${BASE}/object/sign/bcn007-private/${privPath}`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 3 })
  });
  const signed = await sign.json().catch(() => null);
  check('sign status', sign.status, 200);
  observe('sign body', signed);
  check('⚠️ the response is a RELATIVE url, not an absolute one', typeof signed?.signedURL === 'string' && signed.signedURL.startsWith('/'), true);

  const signedAbs = `${BASE}${String(signed?.signedURL || '').replace(/^\/object/, '/object')}`;
  observe('composed absolute url', signedAbs);
  const signedGet = await fetch(signedAbs);
  check('the signed url serves with NO credential', signedGet.status, 200);

  const payload = (() => {
    const t = new URL(signedAbs, BASE).searchParams.get('token');
    if (!t) return null;
    return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf8'));
  })();
  observe('signed-url jwt payload', payload);
  const ttl = payload?.exp ? payload.exp - Math.floor(Date.now() / 1000) : undefined;
  observe('measured ttl seconds (expiresIn was 3)', ttl);

  console.log('  waiting 5s…');
  await sleep(5000);
  const expired = await fetch(signedAbs);
  // Gated on the url having worked a moment ago: "stops serving" is meaningless
  // if it never served. Probe run 1 passed this check against a 404 route.
  check('⚠️ THE SIGNED URL EXPIRES', signedGet.status === 200 && expired.status !== 200, true);
  observe('  status after expiry', expired.status);
  observe('  body after expiry', (await expired.text()).slice(0, 200));

  const tampered = signedAbs.replace(/token=([^&]{10})/, 'token=AAAAAAAAAA');
  observe('a tampered token', (await fetch(tampered)).status);

  // --- delete --------------------------------------------------------------
  console.log('\n--- 7. delete ---');
  const del = await fetch(`${BASE}/object/bcn007-public/${objectPath}`, { method: 'DELETE', headers: H });
  observe('DELETE /object/{bucket}/{path} status', del.status);
  observe('  body', (await del.text()).slice(0, 200));
  const afterDelete = await fetch(publicUrl);
  check('the file stops serving after deletion', afterDelete.status !== 200, true);
  observe('  status', afterDelete.status);

  // Deleting something that never existed — does it 404 or pretend?
  const ghost = await fetch(`${BASE}/object/bcn007-public/bcn007/never-existed.png`, { method: 'DELETE', headers: H });
  observe('DELETE a path that never existed', `${ghost.status} ${(await ghost.text()).slice(0, 160)}`);

  // Does Supabase care about references? Nothing references a storage object.
  console.log('\n--- 8. anon key vs service key ---');
  if (ANON) {
    const anonUp = await fetch(`${BASE}/object/bcn007-public/bcn007/anon.png`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, 'Content-Type': 'image/png' },
      body: PNG
    });
    observe('upload with the ANON key (no RLS policies granted)', `${anonUp.status} ${(await anonUp.text()).slice(0, 200)}`);
  }

  console.log(`\n=== ${checks} checks, ${failures} failures ===`);
  process.exitCode = failures > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error('ABORTED', e);
  process.exitCode = 2;
});
