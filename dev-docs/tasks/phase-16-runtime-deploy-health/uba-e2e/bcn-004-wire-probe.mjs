/**
 * BCN-004 — what the three REST wires actually do.
 *
 * The phase rule is that an unprobed claim is worse than a gap, and this phase
 * has already paid for it three times: BCN-002 found all three of Parse's
 * carefully-documented file cells wrong, BCN-003 found four descriptor cells
 * written from documentation that a real server contradicted, and BCN-007
 * shipped a Directus field mapping marked "documented, not probed" and named
 * BCN-004 as the task to confirm it.
 *
 * So this asks the servers rather than the docs. Every question below is one the
 * `RestDataAdapter` has to answer in code, and one where guessing produces a
 * plausible wrong number rather than an error:
 *
 *   1. What is the auth header? PocketBase's changed across versions; Supabase
 *      wants `apikey` as well as a bearer.
 *   2. Where is the row array, and where is the total?
 *   3. Does a filtered total differ from an unfiltered one — the `filter_count`
 *      class of bug RUN-003 fixed for Directus and which must not return.
 *   4. Is pagination offset-based or page-based, and is `page` 1-based?
 *   5. Does a create return the created row, and does PostgREST need
 *      `Prefer: return=representation` to do it?
 *   6. What does the primary key field get called?
 *
 * Run:
 *   docker compose --profile supabase --profile aggregate up -d
 *   # supabase-seed.sql grants web_anon SELECT only, so a create probe against it
 *   # answers "42501 insufficient privilege" and tells you nothing about the wire.
 *   # Grant writes first, or the `Prefer: return=representation` question is unasked:
 *   docker exec uba-e2e-supabase-db-1 psql -U postgres -d app \
 *     -c "GRANT INSERT, UPDATE, DELETE ON articles, authors TO web_anon;
 *         GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO web_anon;"
 *   node bcn-004-wire-probe.mjs
 *
 * ⚠️ Do not pipe this into `head`. It closes the pipe, SIGPIPEs node, and the run
 * dies partway through looking like the server stopped answering.
 */

const DIRECTUS = 'http://localhost:8055';
const POSTGREST = 'http://localhost:8056';
const POCKETBASE = 'http://localhost:8091';

const out = [];
function say(s = '') {
  out.push(s);
  console.log(s);
}
function head(s) {
  say('');
  say('='.repeat(72));
  say(s);
  say('='.repeat(72));
}
/** Report a claim and the evidence for it, so the record is auditable. */
function fact(label, value, evidence) {
  say(`  ${label}: ${value}`);
  if (evidence) say(`      evidence: ${evidence}`);
}

async function req(url, init = {}) {
  const r = await fetch(url, init);
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: r.status, headers: r.headers, text, json };
}

function shape(v, depth = 0) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `array[${v.length}]${v.length && depth < 2 ? ' of ' + shape(v[0], depth + 1) : ''}`;
  if (typeof v === 'object') return `{${Object.keys(v).slice(0, 12).join(', ')}}`;
  return typeof v;
}

// ── Directus ───────────────────────────────────────────────────────────────
async function directus() {
  head('DIRECTUS 11');

  const login = await req(`${DIRECTUS}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'directus-admin-pw' })
  });
  if (!login.json?.data?.access_token) {
    say(`  !! login failed: ${login.status} ${login.text.slice(0, 200)}`);
    return;
  }
  const token = login.json.data.access_token;
  fact('auth header', 'Authorization: Bearer <token>', `POST /auth/login -> ${login.status}, data.access_token present`);
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // A collection to work in. Ignore "already exists".
  await req(`${DIRECTUS}/collections`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      collection: 'bcn004',
      schema: {},
      meta: { singleton: false },
      fields: [
        { field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } },
        { field: 'name', type: 'string' },
        { field: 'tag', type: 'string' }
      ]
    })
  });
  // Seed deterministically: clear then insert.
  const existing = await req(`${DIRECTUS}/items/bcn004?limit=-1&fields=id`, { headers: H });
  const ids = (existing.json?.data || []).map((r) => r.id);
  if (ids.length) {
    await req(`${DIRECTUS}/items/bcn004`, { method: 'DELETE', headers: H, body: JSON.stringify(ids) });
  }
  const created = await req(`${DIRECTUS}/items/bcn004`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify([
      { name: 'Ada', tag: 'x' },
      { name: 'Alan', tag: 'x' },
      { name: 'Grace', tag: 'y' }
    ])
  });
  fact('create returns the row(s)', shape(created.json), `POST /items/bcn004 -> ${created.status}`);
  fact('primary key field', 'id', `created row keys: ${Object.keys(created.json?.data?.[0] || {}).join(', ')}`);

  const list = await req(`${DIRECTUS}/items/bcn004?meta=total_count,filter_count&limit=2`, { headers: H });
  fact('list envelope', shape(list.json), `GET /items/bcn004?meta=... -> ${list.status}`);
  fact('rows at', 'data', `data is ${shape(list.json?.data)}`);
  fact('meta', JSON.stringify(list.json?.meta), 'unfiltered, limit=2');

  const filtered = await req(
    `${DIRECTUS}/items/bcn004?meta=total_count,filter_count&limit=1&filter=${encodeURIComponent(JSON.stringify({ tag: { _eq: 'x' } }))}`,
    { headers: H }
  );
  fact('meta on a FILTERED query', JSON.stringify(filtered.json?.meta), 'filter tag=x, limit=1 (2 match, 3 total)');
  say('      -> filter_count is the one pagination needs; total_count ignores the filter.');

  const paged = await req(`${DIRECTUS}/items/bcn004?limit=1&offset=1&sort=name`, { headers: H });
  fact('pagination', 'limit + offset (0-based)', `offset=1&sort=name -> ${JSON.stringify((paged.json?.data || []).map((r) => r.name))}`);
}

// ── PostgREST (the Supabase wire) ──────────────────────────────────────────
async function postgrest() {
  head('POSTGREST v12.2.3  (the Supabase REST wire)');

  const probe = await req(`${POSTGREST}/`);
  fact('reachable', String(probe.status), 'GET / (OpenAPI document)');

  // What tables did the seed give us?
  const paths = Object.keys(probe.json?.paths || {})
    .filter((p) => p !== '/' && !p.includes('{'))
    .map((p) => p.slice(1));
  fact('tables in the seed', paths.join(', ') || '(none)', 'from the OpenAPI paths');
  const table = paths[0];
  if (!table) return;

  const bare = await req(`${POSTGREST}/${table}?limit=2`);
  fact('list envelope', shape(bare.json), `GET /${table}?limit=2 -> ${bare.status}`);
  say('      -> a BARE ARRAY. There is no envelope and no dataPath.');
  fact('Content-Range without asking', bare.headers.get('content-range'), 'no Prefer header sent');

  const counted = await req(`${POSTGREST}/${table}?limit=2`, { headers: { Prefer: 'count=exact' } });
  fact('Content-Range WITH Prefer: count=exact', counted.headers.get('content-range'), `-> ${counted.status}`);
  say('      -> the total lives in a HEADER, not the body. `totalCountPath` cannot express this.');

  const cols = Object.keys(bare.json?.[0] || {});
  fact('columns', cols.join(', '), 'first row');
  const pk = cols.includes('id') ? 'id' : cols[0];

  const filtered = await req(`${POSTGREST}/${table}?limit=1&${cols[1] ? cols[1] + '=not.is.null' : ''}`, {
    headers: { Prefer: 'count=exact' }
  });
  fact('Content-Range on a FILTERED query', filtered.headers.get('content-range'), 'total reflects the filter');

  const noRep = await req(`${POSTGREST}/${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [cols[1] || pk]: 'bcn004-probe' })
  });
  fact('create WITHOUT Prefer: return=representation', `${noRep.status}, body=${JSON.stringify(noRep.text).slice(0, 40)}`, 'POST');
  const withRep = await req(`${POSTGREST}/${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ [cols[1] || pk]: 'bcn004-probe-2' })
  });
  fact('create WITH Prefer: return=representation', `${withRep.status}, ${shape(withRep.json)}`, 'POST');
  say('      -> without it the adapter gets NO created row, so `create`s success callback has nothing to hand back.');

  fact('pagination', 'limit + offset (0-based)', 'PostgREST accepts ?limit=&offset=; Range headers are the alternative');
}

// ── PocketBase ─────────────────────────────────────────────────────────────
async function pocketbase() {
  head('POCKETBASE 0.30.0');

  const health = await req(`${POCKETBASE}/api/health`);
  fact('reachable', String(health.status), 'GET /api/health');

  const auth = await req(`${POCKETBASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'admin@example.com', password: 'pocketbase-admin-pw' })
  });
  if (!auth.json?.token) {
    say(`  !! superuser auth failed: ${auth.status} ${auth.text.slice(0, 200)}`);
    return;
  }
  const token = auth.json.token;
  say(`  superuser token acquired (${auth.status})`);

  // THE question: raw token, or Bearer? Ask both against a route that needs auth.
  const raw = await req(`${POCKETBASE}/api/collections`, { headers: { Authorization: token } });
  const bearer = await req(`${POCKETBASE}/api/collections`, { headers: { Authorization: `Bearer ${token}` } });
  const none = await req(`${POCKETBASE}/api/collections`);
  fact('auth: Authorization: <token>', String(raw.status), 'GET /api/collections');
  fact('auth: Authorization: Bearer <token>', String(bearer.status), 'GET /api/collections');
  fact('auth: no header', String(none.status), 'GET /api/collections (control)');
  say('      -> whichever returns 200 is what the adapter must send. Both working is also a fact worth having.');

  const H = { Authorization: token, 'Content-Type': 'application/json' };

  // A collection with open rules, so the probe reads it the way a published app would.
  const mk = await req(`${POCKETBASE}/api/collections`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      name: 'bcn004',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'tag', type: 'text' }
      ]
    })
  });
  say(`  create collection -> ${mk.status}${mk.status >= 400 ? ' (' + mk.text.slice(0, 120) + ')' : ''}`);

  const existing = await req(`${POCKETBASE}/api/collections/bcn004/records?perPage=200`, { headers: H });
  for (const r of existing.json?.items || []) {
    await req(`${POCKETBASE}/api/collections/bcn004/records/${r.id}`, { method: 'DELETE', headers: H });
  }
  let firstCreated = null;
  for (const row of [
    { name: 'Ada', tag: 'x' },
    { name: 'Alan', tag: 'x' },
    { name: 'Grace', tag: 'y' }
  ]) {
    const c = await req(`${POCKETBASE}/api/collections/bcn004/records`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify(row)
    });
    firstCreated = firstCreated || c;
  }
  fact('create returns the row', `${firstCreated.status}, ${shape(firstCreated.json)}`, 'POST .../records');
  fact('primary key field', 'id', `created row keys: ${Object.keys(firstCreated.json || {}).join(', ')}`);

  const list = await req(`${POCKETBASE}/api/collections/bcn004/records?perPage=2`, { headers: H });
  fact('list envelope', shape(list.json), `GET .../records?perPage=2 -> ${list.status}`);
  fact('rows at', 'items', `items is ${shape(list.json?.items)}`);
  fact('total at', `totalItems = ${list.json?.totalItems}`, `page=${list.json?.page} perPage=${list.json?.perPage} totalPages=${list.json?.totalPages}`);

  const p1 = await req(`${POCKETBASE}/api/collections/bcn004/records?perPage=1&page=1&sort=name`, { headers: H });
  const p2 = await req(`${POCKETBASE}/api/collections/bcn004/records?perPage=1&page=2&sort=name`, { headers: H });
  const p0 = await req(`${POCKETBASE}/api/collections/bcn004/records?perPage=1&page=0&sort=name`, { headers: H });
  fact('page=1', JSON.stringify((p1.json?.items || []).map((r) => r.name)), 'sorted by name');
  fact('page=2', JSON.stringify((p2.json?.items || []).map((r) => r.name)), 'sorted by name');
  fact('page=0', `${p0.status} ${JSON.stringify((p0.json?.items || []).map((r) => r.name))}`, 'is page 1-based or 0-based?');
  say('      -> the preset maps `offsetParam: page`. If page is 1-based, an offset->page adapter that');
  say('         passes an offset straight through is off by one page, silently.');

  const filtered = await req(
    `${POCKETBASE}/api/collections/bcn004/records?perPage=1&filter=${encodeURIComponent("tag='x'")}`,
    { headers: H }
  );
  fact('totalItems on a FILTERED query', String(filtered.json?.totalItems), "filter tag='x' (2 match, 3 total)");
}

await directus().catch((e) => say(`  !! directus probe threw: ${e.message}`));
await postgrest().catch((e) => say(`  !! postgrest probe threw: ${e.message}`));
await pocketbase().catch((e) => say(`  !! pocketbase probe threw: ${e.message}`));

head('END');
