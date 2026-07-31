#!/usr/bin/env node
/**
 * BCN-001 §5.3 — the two descriptor cells that could not be resolved from the
 * repo, because they are facts about other people's products:
 *
 *   - Can PocketBase aggregate?  (believed absent)
 *   - Can Supabase aggregate?    (believed opt-in via PostgREST settings)
 *
 * Docs are not evidence here. PostgREST's `db-aggregates-enabled` default has
 * moved at least once, and Supabase's hosted platform sets it independently of
 * the PostgREST default — so the probe runs the SAME requests against two
 * identically-seeded PostgREST 12.2.3 servers that differ in exactly that one
 * setting. The delta is the finding.
 *
 * Along the way it also resolves `data.count` and `data.distinct` for both
 * backends, since the descriptor needs all three and they are the same trip.
 *
 * Run:
 *   docker compose --profile aggregate up -d
 *   node bcn-001-aggregate-probe.mjs
 *   docker compose --profile aggregate down -v
 *
 * Output of a full run is recorded in BCN-001-AGGREGATE-PROBE-OUTPUT.txt and
 * the conclusions are transcribed into the capability descriptor source.
 */

const PGRST_DEFAULT = 'http://localhost:8057';
const PGRST_ENABLED = 'http://localhost:8058';
const POCKETBASE = 'http://localhost:8091';

const PB_ADMIN = { identity: 'admin@example.com', password: 'pocketbase-admin-pw' };

let failures = 0;

function hr(title) {
  console.log('\n' + '═'.repeat(74));
  console.log(title);
  console.log('═'.repeat(74));
}

function sub(title) {
  console.log('\n── ' + title + ' ' + '─'.repeat(Math.max(0, 70 - title.length)));
}

async function req(url, init = {}) {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      /* not json */
    }
    return { ok: res.ok, status: res.status, headers: res.headers, text, json };
  } catch (err) {
    return { ok: false, status: 0, text: String(err), networkError: true };
  }
}

/** Print a probe result compactly; `expect` is prose, not an assertion. */
function report(label, res, { showBody = true, maxBody = 300 } = {}) {
  const body = res.text.length > maxBody ? res.text.slice(0, maxBody) + ' …' : res.text;
  console.log(`  ${res.status === 0 ? 'ERR' : res.status}  ${label}`);
  if (showBody && body.trim()) console.log(`       ${body.replace(/\n/g, '\n       ')}`);
}

async function waitFor(url, name, tries = 60) {
  for (let i = 0; i < tries; i++) {
    const res = await req(url);
    if (res.status !== 0) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error(`!! ${name} never came up at ${url}`);
  failures++;
  return false;
}

// ───────────────────────────────────────────────────────────────────────────
// PostgREST — Supabase's REST layer
// ───────────────────────────────────────────────────────────────────────────

/**
 * The requests below are exactly what an adapter would emit for
 * `CloudStore.aggregate({collection, group, where})`. PostgREST expresses
 * aggregation entirely through `select`: aggregate functions are suffixes
 * (`rating.sum()`), and every non-aggregate column in the select list becomes
 * a GROUP BY key implicitly. There is no separate group parameter.
 */
const PGRST_PROBES = [
  ['count() over the whole table', '/articles?select=count()'],
  ['sum of a column', '/articles?select=rating.sum()'],
  ['avg + max together', '/articles?select=rating.avg(),rating.max()'],
  ['GROUP BY status with avg', '/articles?select=status,rating.avg()&order=status'],
  ['GROUP BY with a where clause', '/articles?select=status,rating.sum()&featured=eq.false&order=status'],
  ['aggregate over an embedded relation', '/authors?select=name,articles(count)']
];

async function probePostgrest(base, label) {
  sub(`PostgREST ${label} — ${base}`);
  const root = await req(base + '/');
  console.log(`  server header: ${root.headers?.get?.('server') ?? '(none)'}`);

  for (const [name, path] of PGRST_PROBES) {
    const res = await req(base + path);
    report(`${name}   GET ${path}`, res);
  }
  return null;
}

async function probePostgrestCountAndDistinct(base) {
  sub(`PostgREST count & distinct — ${base}`);

  // `count` is NOT the aggregate feature. PostgREST answers it with a header,
  // governed by the Prefer/Range pair, and it works irrespective of
  // db-aggregates-enabled. This is why data.count and data.aggregate are
  // separate capability keys.
  const counted = await req(base + '/articles?select=id', {
    headers: { Prefer: 'count=exact', Range: '0-0' }
  });
  console.log(`  ${counted.status}  count via Prefer: count=exact + Range: 0-0`);
  console.log(`       content-range: ${counted.headers?.get?.('content-range')}`);

  // DISTINCT has no query-string form in PostgREST. Both plausible spellings
  // are probed so the descriptor records what was actually tried.
  for (const [name, path] of [
    ['?distinct= query param', '/articles?select=status&distinct=status'],
    ['distinct() as a select suffix', '/articles?select=status.distinct()']
  ]) {
    const res = await req(base + path);
    report(`distinct attempt: ${name}   GET ${path}`, res, { maxBody: 220 });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// PocketBase
// ───────────────────────────────────────────────────────────────────────────

async function pbAuth() {
  const res = await req(`${POCKETBASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(PB_ADMIN)
  });
  if (!res.ok) {
    console.error(`  !! superuser auth failed (${res.status}): ${res.text.slice(0, 300)}`);
    failures++;
    return null;
  }
  return res.json.token;
}

async function pbSeed(token) {
  const auth = { Authorization: token, 'Content-Type': 'application/json' };

  const existing = await req(`${POCKETBASE}/api/collections/articles`, { headers: auth });
  if (existing.ok) {
    console.log('  articles collection already present — reusing');
  } else {
    const created = await req(`${POCKETBASE}/api/collections`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        name: 'articles',
        type: 'base',
        listRule: '',
        viewRule: '',
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'status', type: 'select', maxSelect: 1, values: ['draft', 'published', 'archived'] },
          { name: 'rating', type: 'number' },
          { name: 'featured', type: 'bool' }
        ]
      })
    });
    if (!created.ok) {
      console.error(`  !! collection create failed (${created.status}): ${created.text.slice(0, 500)}`);
      failures++;
      return false;
    }
    console.log('  articles collection created');
  }

  // Same 7 rows as the SQL seed, so the two backends are answering about the
  // same data.
  const rows = [
    ['Published one', 'published', 5, true],
    ['Published two', 'published', 3, false],
    ['Published three', 'published', 4, false],
    ['Draft one', 'draft', 2, false],
    ['Draft two', 'draft', 4, false],
    ['Archived one', 'archived', 5, false],
    ['Archived two', 'archived', 2, false]
  ];
  const before = await req(`${POCKETBASE}/api/collections/articles/records?perPage=1`, { headers: auth });
  if ((before.json?.totalItems ?? 0) >= rows.length) {
    console.log(`  ${before.json.totalItems} records already present — not re-seeding`);
    return true;
  }
  for (const [title, status, rating, featured] of rows) {
    const res = await req(`${POCKETBASE}/api/collections/articles/records`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ title, status, rating, featured })
    });
    if (!res.ok) {
      console.error(`  !! record create failed (${res.status}): ${res.text.slice(0, 300)}`);
      failures++;
      return false;
    }
  }
  console.log(`  ${rows.length} records seeded`);
  return true;
}

async function probePocketbase(token) {
  const auth = { Authorization: token };

  sub('PocketBase count — the one that works');
  const listed = await req(`${POCKETBASE}/api/collections/articles/records?perPage=1`, { headers: auth });
  console.log(`  ${listed.status}  GET …/records?perPage=1`);
  console.log(`       totalItems: ${listed.json?.totalItems}   totalPages: ${listed.json?.totalPages}`);

  sub('PocketBase aggregate — every spelling an adapter might try');
  // PocketBase's records API has no aggregate parameter. The probe tries the
  // shapes an adapter author would reach for, because HOW it fails matters:
  // a 400 is a gateable error, a silently-ignored parameter is a node that
  // returns wrong numbers with no error at all.
  const attempts = [
    ['SQL-ish count in fields', '/api/collections/articles/records?fields=count(*)'],
    ['aggregate suffix in fields', '/api/collections/articles/records?fields=rating.sum()'],
    ['colon-style aggregate', '/api/collections/articles/records?fields=rating:sum'],
    ['a group parameter', '/api/collections/articles/records?group=status'],
    ['groupBy parameter', '/api/collections/articles/records?groupBy=status&fields=rating'],
    ['unknown parameter, as a control', '/api/collections/articles/records?thisParamDoesNotExist=1&perPage=1']
  ];
  for (const [name, path] of attempts) {
    const res = await req(POCKETBASE + path, { headers: auth });
    report(`${name}   GET ${path}`, res, { maxBody: 260 });
  }

  sub('PocketBase distinct');
  for (const [name, path] of [
    ['distinct parameter', '/api/collections/articles/records?distinct=status'],
    ['fields=status only', '/api/collections/articles/records?fields=status&perPage=50']
  ]) {
    const res = await req(POCKETBASE + path, { headers: auth });
    report(`${name}   GET ${path}`, res, { maxBody: 400 });
  }

  sub('PocketBase view collections — the only aggregate mechanism it has');
  // A `view` collection wraps an arbitrary SELECT, so a user CAN get a
  // server-side aggregate out of PocketBase — by authoring schema in the admin
  // UI. That is not something an adapter can do at runtime from a node's
  // ports, which is what the descriptor is about. Recorded so the next reader
  // does not mistake it for a `supported` cell.
  await req(`${POCKETBASE}/api/collections/articles_by_status`, {
    method: 'DELETE',
    headers: { Authorization: token }
  });
  const created = await req(`${POCKETBASE}/api/collections`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'articles_by_status',
      type: 'view',
      listRule: '',
      viewRule: '',
      viewQuery:
        "SELECT (ROW_NUMBER() OVER()) as id, status, COUNT(*) as n, AVG(rating) as avg_rating FROM articles GROUP BY status"
    })
  });
  console.log(`  ${created.status}  POST /api/collections  (type: view, GROUP BY in viewQuery)`);
  if (created.ok) {
    const read = await req(`${POCKETBASE}/api/collections/articles_by_status/records?perPage=10`, {
      headers: auth
    });
    report('reading the view', read, { maxBody: 500 });
  } else {
    console.log(`       ${created.text.slice(0, 400)}`);
  }
}

// ───────────────────────────────────────────────────────────────────────────

async function main() {
  hr('BCN-001 aggregate-capability probe');
  console.log(`node ${process.version}`);

  hr('SUPABASE / PostgREST 12.2.3 — identical servers, one setting apart');
  const upDefault = await waitFor(PGRST_DEFAULT + '/articles?select=id&limit=1', 'agg-rest-default');
  const upEnabled = await waitFor(PGRST_ENABLED + '/articles?select=id&limit=1', 'agg-rest-enabled');
  if (upDefault) {
    await probePostgrest(PGRST_DEFAULT, 'STOCK CONFIG (db-aggregates-enabled unset)');
    await probePostgrestCountAndDistinct(PGRST_DEFAULT);
  }
  if (upEnabled) {
    await probePostgrest(PGRST_ENABLED, 'PGRST_DB_AGGREGATES_ENABLED=true');
  }

  hr('POCKETBASE 0.30.0');
  if (await waitFor(POCKETBASE + '/api/health', 'pocketbase')) {
    const health = await req(POCKETBASE + '/api/health');
    console.log(`  health: ${health.text.slice(0, 200)}`);
    const token = await pbAuth();
    if (token && (await pbSeed(token))) await probePocketbase(token);
  }

  hr('VERDICTS — transcribed into the BCN-001 capability descriptor');
  console.log(`
  SUPABASE / PostgREST  data.aggregate .......... conditional
      Stock PostgREST 12.2.3 refuses every aggregate with PGRST123 "Use of
      aggregate functions is not allowed". The same binary with
      db-aggregates-enabled=true answers all of them, GROUP BY and WHERE
      included. It is a per-instance setting, which is the definition of
      \`conditional\`. Supabase's hosted platform sets it independently of the
      PostgREST default — newer projects have it on, older ones do not — so a
      connect-time probe is the only honest answer. Probe request:
      GET /<table>?select=count()  → 200 means supported, PGRST123 means not.

  SUPABASE / PostgREST  data.count ............... supported
      Answered by the Content-Range header under Prefer: count=exact, not by
      the aggregate machinery. Worked with aggregates disabled. This is why
      data.count and data.aggregate are separate capability keys.

  SUPABASE / PostgREST  data.distinct ............ unsupported
      No query-string form. Both plausible spellings are parse errors
      (PGRST100). DISTINCT would need a database view or an RPC.

  ⚠ Embedded-relation count is NOT gated by db-aggregates-enabled.
      /authors?select=name,articles(count) returned 200 on BOTH servers. So
      "can this instance count related rows" and "can this instance aggregate"
      are different questions, and probing with the wrong one reports
      supported on an instance that cannot sum anything.

  POCKETBASE  data.aggregate ..................... unsupported
      Not "refused" — IGNORED. Every spelling tried returned HTTP 200 with
      ordinary un-aggregated rows: ?group=, ?groupBy=, ?fields=count(*) (which
      returned seven empty objects), and an invented parameter behaved
      identically. ?fields=rating:sum returned 200 with Content-Type
      application/json and Content-Length: 0 — an empty body that JSON.parse
      throws on.
      This is the worst possible shape for the phase's claim: an aggregate node
      pointed at PocketBase would not error, it would return wrong numbers.
      There is nothing to catch at runtime, so the descriptor gate is the only
      thing that can stop it. Exactly the case BCN-010 exists for.

  POCKETBASE  data.count ......................... supported
      totalItems / totalPages on every list response.

  POCKETBASE  data.distinct ...................... unsupported
      ?distinct=status silently returned all seven rows. Same ignore-the-
      parameter failure mode.

  ⚠ PocketBase CAN aggregate — via a \`view\` collection, and only there.
      A view collection wrapping "SELECT … GROUP BY status" was created and
      read back correctly. But that is schema authored by hand in the admin UI,
      not something an adapter can express from a node's ports at runtime. It
      does not make data.aggregate supported; it is what the reason string
      should point a user towards.
`);

  hr(failures ? `DONE — ${failures} probe(s) could not run` : 'DONE — all probes ran');
  process.exit(failures ? 1 : 0);
}

main();
