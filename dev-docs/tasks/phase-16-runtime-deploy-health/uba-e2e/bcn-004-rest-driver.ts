/**
 * BCN-004 — `RestDataAdapter` against three real servers.
 *
 * This drives **the adapter**, not a re-implementation of it. `RestDataAdapter`
 * is imported from `noodl-runtime/src/api/backends/`, bundled with esbuild
 * (`bcn-004-rest-driver.build.mjs`), and every request below is one the shipped
 * class built. A driver that assembled its own URLs would prove something about
 * the driver — which is the mistake RUN-003 made with its second Directus
 * translator, and it took a live 403 to find.
 *
 * ## What it asks, and why each one
 *
 * Every check is a place where getting it wrong returns a **plausible wrong
 * value** rather than an error:
 *
 * 1. **Query with a filter.** Three of five rows match.
 * 2. **The total on a filtered query.** Directus's `total_count` says five and
 *    `filter_count` says three; the preset points at the first. This is the
 *    RUN-003 defect and the reason the profiles exist.
 * 3. **Pagination against the filtered set.** `limit=2, skip=2` must return the
 *    third matching row and not the third row of the collection. On PocketBase
 *    this also exercises the offset→1-based-page conversion, which is
 *    correct-looking on page one and wrong on every page after it.
 * 4. **Create.** ⚠️ PostgREST answers `201` with an **empty body** without
 *    `Prefer: return=representation`, so this is the check that the adapter
 *    never calls `success` with nothing.
 * 5. **Update and delete**, including the empty-body trap on `PATCH` — which
 *    the profile does not name, because the probe found it on `POST`.
 * 6. **`aggregate` on PocketBase must refuse.** BCN-001 measured that
 *    PocketBase answers `200` with un-aggregated rows for every spelling, so a
 *    green "it worked" here would be the failure.
 *
 * ## Running it
 *
 *   docker compose --profile supabase --profile aggregate up -d
 *   node bcn-004-rest-driver.build.mjs && node bcn-004-rest-driver.cjs
 *
 * The Supabase write grants the create/update/delete checks need:
 *
 *   docker exec uba-e2e-supabase-db-1 psql -U postgres -d app \
 *     -c "GRANT INSERT, UPDATE, DELETE ON articles, authors TO web_anon;
 *         GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO web_anon;"
 *
 * ⚠️ Do not pipe this into `head`. It closes the pipe, SIGPIPEs node, and the
 * run dies partway through looking like the server stopped answering. Redirect
 * to a file.
 *
 * ⚠️ **The rig's PostgREST is not mounted where Supabase mounts it.** Supabase
 * serves the same PostgREST under `/rest/v1/`, which is what the wire profile
 * says and what a real project's base URL implies; the rig serves it at the
 * root. So the driver stands up a tiny reverse proxy that mounts the rig at
 * `/rest/v1/` rather than changing the profile — the point is to exercise the
 * path the shipped adapter builds, not a path invented for the test.
 */

import * as http from 'node:http';

import type { BackendHandle, QueryOptions } from '@noodl/backend-contract';
import { RestDataAdapter } from '../../../../packages/noodl-runtime/src/api/backends/RestDataAdapter';

const DIRECTUS = 'http://localhost:8055';
const POSTGREST = 'http://localhost:8056';
const POSTGREST_AGG = 'http://localhost:8058'; // the same binary with db-aggregates-enabled
const POCKETBASE = 'http://localhost:8091';

const COLLECTION = 'bcn004a';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function say(line = '') {
  console.log(line);
}
function head(title: string) {
  say('');
  say('='.repeat(72));
  say(title);
  say('='.repeat(72));
}

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
    say(`  PASS  ${label}`);
  } else {
    fail++;
    failures.push(`${label}: expected ${e}, got ${a}`);
    say(`  FAIL  ${label}`);
    say(`          expected ${e}`);
    say(`          got      ${a}`);
  }
}

/** A check whose whole point is that the adapter refused. */
function checkRefused(label: string, result: Outcome<unknown>, matcher: RegExp) {
  if (!result.ok && matcher.test(result.error)) {
    pass++;
    say(`  PASS  ${label}`);
    say(`          refused with: ${result.error.slice(0, 110)}`);
  } else {
    fail++;
    failures.push(`${label}: expected a refusal matching ${matcher}, got ${JSON.stringify(result)}`);
    say(`  FAIL  ${label} — expected a refusal, got ${JSON.stringify(result).slice(0, 160)}`);
  }
}

// ── Callback → promise, so the driver reads top to bottom ──────────────────

type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };

function call<T>(run: (success: (value: T) => void, error: (message?: string) => void) => void): Promise<Outcome<T>> {
  return new Promise((resolve) => {
    let settled = false;
    run(
      (value) => {
        if (!settled) {
          settled = true;
          resolve({ ok: true, value });
        }
      },
      (message) => {
        if (!settled) {
          settled = true;
          resolve({ ok: false, error: message ?? '(no message)' });
        }
      }
    );
  });
}

const names = (records: Array<Record<string, unknown>>, field = 'name') => records.map((r) => r[field]);

/**
 * `query` hands `success` two arguments and {@link call} only carries one, so
 * this keeps the total alongside the rows. The total is the whole point of half
 * the checks below, and dropping it would leave them unable to see the bug.
 */
function query(
  api: RestDataAdapter,
  handle: BackendHandle,
  options: Omit<QueryOptions, 'success' | 'error'>
): Promise<Outcome<{ rows: Array<Record<string, unknown>>; count?: number }>> {
  return call((success, error) =>
    api.query(handle, Object.assign({}, options, { success: (rows, count) => success({ rows, count }), error }))
  );
}

// ── Plain HTTP, for seeding only — never for a check ───────────────────────

async function req(url: string, init: Record<string, unknown> = {}) {
  const r = await fetch(url, init as RequestInit);
  const text = await r.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: r.status, text, json: json as never };
}

/**
 * Mount an upstream under `/rest/v1/`, so the adapter's Supabase profile path
 * reaches a bare PostgREST. See the module comment.
 */
function mountAsSupabase(upstream: string): Promise<{ url: string; close: () => void }> {
  const server = http.createServer((request, response) => {
    const path = (request.url ?? '').replace(/^\/rest\/v1/, '');
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const headers = Object.assign({}, request.headers);
      delete headers.host;
      delete headers['content-length'];
      fetch(upstream + path, {
        method: request.method,
        headers: headers as Record<string, string>,
        body: chunks.length ? Buffer.concat(chunks) : undefined
      })
        .then(async (upstreamResponse) => {
          const body = Buffer.from(await upstreamResponse.arrayBuffer());
          const out: Record<string, string> = {};
          upstreamResponse.headers.forEach((value, key) => {
            if (key !== 'content-encoding' && key !== 'transfer-encoding') out[key] = value;
          });
          response.writeHead(upstreamResponse.status, out);
          response.end(body);
        })
        .catch((e) => {
          response.writeHead(502);
          response.end(String(e));
        });
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

// ── The corpus, five rows, three of them matching ─────────────────────────

const ROWS = [
  { name: 'Ada', tag: 'x', rating: 5 },
  { name: 'Alan', tag: 'x', rating: 3 },
  { name: 'Grace', tag: 'x', rating: 4 },
  { name: 'Edsger', tag: 'y', rating: 2 },
  { name: 'Barbara', tag: 'y', rating: 1 }
];

/**
 * The whole point of the pagination checks: sorted by name, the three rows
 * matching `tag = x` are Ada, Alan, Grace. Sorted by name, the first three rows
 * of the *collection* are Ada, Alan, Barbara. So a `skip` applied to the
 * unfiltered set, or a total taken from `total_count`, produces a different
 * answer here — which is exactly what the wrong implementations do.
 */
const MATCHING_SORTED = ['Ada', 'Alan', 'Grace'];

const adapter = new RestDataAdapter({
  // The `conditional` Supabase aggregate cell, settled affirmatively for the
  // one instance that has `db-aggregates-enabled=true`. The default (nothing
  // probed) is what the Supabase section below asserts first.
  probedCapabilities: []
});

const probedAdapter = new RestDataAdapter({ probedCapabilities: ['data.aggregate'] });

// ── Directus ───────────────────────────────────────────────────────────────

async function seedDirectus(): Promise<string | undefined> {
  const login = await req(`${DIRECTUS}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'directus-admin-pw' })
  });
  const token = login.json?.data?.access_token as string | undefined;
  if (!token) {
    say(`  !! Directus login failed: ${login.status} ${login.text.slice(0, 150)}`);
    return undefined;
  }
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  await req(`${DIRECTUS}/collections`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      collection: COLLECTION,
      schema: {},
      meta: { singleton: false },
      fields: [
        { field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } },
        { field: 'name', type: 'string' },
        { field: 'tag', type: 'string' },
        { field: 'rating', type: 'integer' }
      ]
    })
  });

  const existing = await req(`${DIRECTUS}/items/${COLLECTION}?limit=-1&fields=id`, { headers: H });
  const ids = ((existing.json?.data ?? []) as Array<{ id: number }>).map((row) => row.id);
  if (ids.length) await req(`${DIRECTUS}/items/${COLLECTION}`, { method: 'DELETE', headers: H, body: JSON.stringify(ids) });
  await req(`${DIRECTUS}/items/${COLLECTION}`, { method: 'POST', headers: H, body: JSON.stringify(ROWS) });
  return token;
}

async function runDirectus() {
  head('DIRECTUS 11 — via RestDataAdapter');
  const token = await seedDirectus();
  if (!token) return;

  // A negative control, printed rather than asserted: it is the evidence that
  // the filtered-total check below *could* have failed. If the two numbers were
  // equal on this data, a `total_count` implementation would pass it and the
  // check would be worthless.
  const control = await req(
    `${DIRECTUS}/items/${COLLECTION}?limit=1&meta=total_count,filter_count&filter=` +
      encodeURIComponent(JSON.stringify({ tag: { _eq: 'x' } })),
    { headers: { Authorization: `Bearer ${token}` } }
  );
  say(`  control: raw Directus meta on the filtered query is ${JSON.stringify(control.json?.meta)}`);
  say('           — total_count says 5, filter_count says 3, so the check below discriminates.');

  const handle: BackendHandle = {
    id: 'd',
    type: 'directus',
    name: 'Directus',
    url: DIRECTUS,
    publicToken: token
  };
  await runCommon(handle, adapter);

  // Directus is the only one of the three that answers `distinct` and
  // `aggregate` for real, so it is the one where those are checked positively.
  const distinct = await call<unknown[]>((success, error) =>
    adapter.distinct(handle, { collection: COLLECTION, property: 'tag', success, error })
  );
  check('distinct(tag)', distinct.ok ? (distinct.value as string[]).sort() : distinct, ['x', 'y']);

  const aggregate = await call<Record<string, unknown>>((success, error) =>
    adapter.aggregate(handle, {
      collection: COLLECTION,
      where: { tag: { equalTo: 'x' } },
      group: { n: { count: '*' }, best: { max: 'rating' } },
      success,
      error
    })
  );
  check('aggregate over the filtered set', aggregate.ok ? aggregate.value : aggregate, { n: 3, best: 5 });
}

// ── Supabase (PostgREST, mounted at /rest/v1) ─────────────────────────────

async function runSupabase() {
  head('POSTGREST v12.2.3 as the Supabase wire — via RestDataAdapter');

  const proxy = await mountAsSupabase(POSTGREST);
  say(`  rig mounted at ${proxy.url}/rest/v1/ (see the module comment)`);

  // Seed through PostgREST itself. `articles` is the seeded table; `status` is
  // the tag analogue and `title` the name.
  await req(`${POSTGREST}/articles?title=like.bcn004a-*`, { method: 'DELETE' });
  await req(`${POSTGREST}/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      // ⚠️ `status` is a Postgres ENUM (`article_status`), so it cannot hold an
      // arbitrary tag — PostgREST answers `invalid input value for enum`. `body`
      // is plain text and is the tag column here.
      ROWS.map((row) => ({ title: `bcn004a-${row.name}`, body: `bcn004a-${row.tag}`, rating: row.rating }))
    )
  });

  const handle: BackendHandle = { id: 's', type: 'supabase', name: 'Supabase', url: proxy.url, publicToken: undefined };
  await runCommon(handle, adapter, {
    collection: 'articles',
    nameField: 'title',
    tagField: 'body',
    prefix: 'bcn004a-'
  });

  // The `conditional` aggregate cell, both ways round.
  const refused = await call<Record<string, unknown>>((success, error) =>
    adapter.aggregate(handle, { collection: 'articles', group: { n: { count: '*' } }, success, error })
  );
  checkRefused('aggregate refused while the conditional cell is unprobed', refused, /switched on for your Supabase project/);

  const aggProxy = await mountAsSupabase(POSTGREST_AGG);
  const aggHandle: BackendHandle = { id: 's2', type: 'supabase', name: 'Supabase (aggregates on)', url: aggProxy.url };
  const aggWhere = { status: { equalTo: 'published' } };

  // The expectation is **derived from the rows**, not written down. An earlier
  // draft hardcoded it and the driver failed for the honest reason that the
  // guess was wrong — which would have looked exactly like an adapter defect.
  const aggRows = await query(probedAdapter, aggHandle, { collection: 'articles', where: aggWhere, limit: 1000 });
  const expected = aggRows.ok
    ? {
        n: aggRows.value.rows.length,
        total: aggRows.value.rows.reduce((sum, row) => sum + (Number(row.rating) || 0), 0)
      }
    : { n: -1, total: -1 };

  const aggregated = await call<Record<string, unknown>>((success, error) =>
    probedAdapter.aggregate(aggHandle, {
      collection: 'articles',
      where: aggWhere,
      group: { n: { count: '*' }, total: { sum: 'rating' } },
      success,
      error
    })
  );
  check(
    'aggregate matches the same rows counted and summed by hand (db-aggregates-enabled instance)',
    aggregated.ok ? aggregated.value : aggregated,
    expected
  );
  aggProxy.close();

  const distinct = await call<unknown[]>((success, error) =>
    adapter.distinct(handle, { collection: 'articles', property: 'status', success, error })
  );
  checkRefused('distinct refused', distinct, /no way to list the distinct values/);

  await req(`${POSTGREST}/articles?title=like.bcn004a-*`, { method: 'DELETE' });
  proxy.close();
}

// ── PocketBase ─────────────────────────────────────────────────────────────

async function seedPocketBase(): Promise<string | undefined> {
  const auth = await req(`${POCKETBASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'admin@example.com', password: 'pocketbase-admin-pw' })
  });
  const token = auth.json?.token as string | undefined;
  if (!token) {
    say(`  !! PocketBase auth failed: ${auth.status} ${auth.text.slice(0, 150)}`);
    return undefined;
  }
  const H = { Authorization: token, 'Content-Type': 'application/json' };

  await req(`${POCKETBASE}/api/collections`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      name: COLLECTION,
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'tag', type: 'text' },
        { name: 'rating', type: 'number' }
      ]
    })
  });

  const existing = await req(`${POCKETBASE}/api/collections/${COLLECTION}/records?perPage=500`, { headers: H });
  for (const row of (existing.json?.items ?? []) as Array<{ id: string }>) {
    await req(`${POCKETBASE}/api/collections/${COLLECTION}/records/${row.id}`, { method: 'DELETE', headers: H });
  }
  for (const row of ROWS) {
    await req(`${POCKETBASE}/api/collections/${COLLECTION}/records`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify(row)
    });
  }
  return token;
}

async function runPocketBase() {
  head('POCKETBASE 0.30.0 — via RestDataAdapter');
  const token = await seedPocketBase();
  if (!token) return;

  const handle: BackendHandle = { id: 'p', type: 'pocketbase', name: 'PocketBase', url: POCKETBASE, publicToken: token };
  await runCommon(handle, adapter);

  // ⚠️ The refusal that matters most in the phase. PocketBase answers 200 with
  // ordinary rows for every aggregate spelling — nothing downstream could tell.
  const aggregate = await call<Record<string, unknown>>((success, error) =>
    adapter.aggregate(handle, { collection: COLLECTION, group: { n: { count: '*' } }, success, error })
  );
  checkRefused('⚠️ aggregate REFUSED rather than answered with wrong numbers', aggregate, /total or average/);

  const distinct = await call<unknown[]>((success, error) =>
    adapter.distinct(handle, { collection: COLLECTION, property: 'tag', success, error })
  );
  checkRefused('distinct refused (PocketBase returns every row for ?distinct=)', distinct, /distinct values/);

  // The one atomic increment among the three.
  const first = await query(adapter, handle, { collection: COLLECTION, where: { name: { equalTo: 'Ada' } } });
  if (first.ok && first.value.rows[0]) {
    const incremented = await call<Record<string, unknown>>((success, error) =>
      adapter.increment(handle, {
        collection: COLLECTION,
        objectId: String(first.value.rows[0].objectId),
        properties: { rating: 3 },
        success,
        error
      })
    );
    check('increment is atomic here (5 + 3)', incremented.ok ? incremented.value.rating : incremented, 8);
  }

  // ⚠️ An offset that is not a whole number of pages. Rounding it would return
  // rows 0–1 labelled as rows 1–2.
  const inexact = await query(adapter, handle, { collection: COLLECTION, limit: 2, skip: 1 });
  checkRefused('⚠️ a row offset that is not a whole page is REFUSED, not rounded', inexact, /cannot start at row 1/);
}

// ── The five checks every backend answers ─────────────────────────────────

interface Shape {
  collection: string;
  nameField: string;
  tagField: string;
  prefix: string;
}

async function runCommon(
  handle: BackendHandle,
  api: RestDataAdapter,
  shape: Shape = { collection: COLLECTION, nameField: 'name', tagField: 'tag', prefix: '' }
) {
  const { collection, nameField, tagField, prefix } = shape;
  const matching = MATCHING_SORTED.map((name) => prefix + name);
  const where = { [tagField]: { equalTo: `${prefix}x` } };

  // 1 + 2. Query with a filter, and the total on the filtered set.
  const filtered = await query(api, handle, { collection, where, sort: [nameField], count: true });
  check(
    'query with a filter returns the 3 matching rows',
    filtered.ok ? names(filtered.value.rows, nameField) : filtered,
    matching
  );
  check('⚠️ the total is the FILTERED count (3), not the collection size (5)', filtered.ok ? filtered.value.count : filtered, 3);

  // 3. Pagination against the filtered set.
  const page1 = await query(api, handle, { collection, where, sort: [nameField], limit: 2, skip: 0 });
  const page2 = await query(api, handle, { collection, where, sort: [nameField], limit: 2, skip: 2 });
  check('page 1 of the filtered set', page1.ok ? names(page1.value.rows, nameField) : page1, matching.slice(0, 2));
  check('page 2 of the filtered set', page2.ok ? names(page2.value.rows, nameField) : page2, matching.slice(2));

  // ⚠️ **The discriminating pagination case, and the reason the two above are
  // not enough.** With `limit=2, skip=2` the conversion `floor(2/2)+1` gives
  // page 2 — and passing the raw `skip` through as a page number *also* gives
  // page 2. The two implementations agree there, so that check cannot tell them
  // apart. With `limit=1, skip=2` the right answer is page 3 (Grace) and the
  // wrong one is page 2 (Alan).
  const third = await query(api, handle, { collection, where, sort: [nameField], limit: 1, skip: 2 });
  check(
    'row 3 of the filtered set — page 3, not page 2 (this is the one that catches skip-as-page)',
    third.ok ? names(third.value.rows, nameField) : third,
    matching.slice(2)
  );

  // `count` as its own method.
  const counted = await call<number>((success, error) => api.count(handle, { collection, where, success, error }));
  check('count() over the filtered set', counted.ok ? counted.value : counted, 3);

  // 4. Create. ⚠️ The empty-body trap.
  const created = await call<Record<string, unknown>>((success, error) =>
    api.create(handle, { collection, data: { [nameField]: `${prefix}Driver`, [tagField]: `${prefix}z` }, success, error })
  );
  // ⚠️ **Not `typeof === 'string'`.** Directus and PostgREST key on an integer
  // primary key and hand back `objectId: 4`, while the contract types the field
  // `string`. The value is carried across as the wire gave it — see the decision
  // and its reasoning in `BCN-004-NOTES-TRANSPORT.md`. What matters is that it
  // identifies the record, which the fetch below proves.
  check(
    'create hands back a record carrying its identity',
    created.ok ? created.value.objectId !== undefined && created.value.objectId !== null : created,
    true
  );
  if (!created.ok) {
    say('  (the rest of the write checks need the created record and are skipped)');
    return;
  }
  const objectId = String(created.value.objectId);

  // 5. Update.
  const saved = await call<Record<string, unknown>>((success, error) =>
    api.save(handle, { collection, objectId, data: { [nameField]: `${prefix}Driver2` }, success, error })
  );
  check('save hands back the updated record', saved.ok ? saved.value[nameField] : saved, `${prefix}Driver2`);

  // The saved record round-trips through fetch under the contract's id name.
  const fetched = await call<Record<string, unknown>>((success, error) =>
    api.fetch(handle, { collection, objectId, success, error })
  );
  check('fetch by objectId round-trips', fetched.ok ? fetched.value[nameField] : fetched, `${prefix}Driver2`);

  // 6. Delete.
  const deleted = await call<void>((success, error) => api.delete(handle, { collection, objectId, success, error }));
  check('delete succeeds', deleted.ok, true);

  const after = await call<number>((success, error) => api.count(handle, { collection, where, success, error }));
  check('the collection is back to 3 matching rows', after.ok ? after.value : after, 3);
}

// ── Run ────────────────────────────────────────────────────────────────────

async function main() {
  await runDirectus().catch((e) => say(`  !! directus threw: ${(e as Error).message}`));
  await runSupabase().catch((e) => say(`  !! supabase threw: ${(e as Error).message}`));
  await runPocketBase().catch((e) => say(`  !! pocketbase threw: ${(e as Error).message}`));

  head('RESULT');
  say(`  ${pass} passed, ${fail} failed`);
  for (const failure of failures) say(`    - ${failure}`);
  process.exit(fail === 0 ? 0 : 1);
}

void main();
