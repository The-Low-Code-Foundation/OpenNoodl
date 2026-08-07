/**
 * BCN-004 — do the wire PROFILES agree with the servers?
 *
 * `wire.test.ts` asserts the profile helpers against fixtures I wrote from the
 * probe output. That is a test of my transcription, not of the wire, and this
 * phase's own rule says a green unit test against your own fixture proves
 * nothing. BCN-003 answered the same objection by keeping three twins of the
 * filter semantics in agreement; this is the equivalent for the envelope.
 *
 * So: issue real requests, hand the real responses to the real profile helpers,
 * and check the answers against what the server independently says is true.
 *
 * The profiles are TypeScript in `@noodl/backend-contract`, so the helpers are
 * re-implemented here **deliberately** — an independent reading of the same
 * profile data. If the two disagree, one of them is wrong and that is the point.
 * The profile *data* is imported as JSON-ish via a regex read of wire.ts so the
 * numbers cannot drift silently.
 *
 * Run (after `docker compose --profile supabase --profile aggregate up -d`):
 *   node bcn-004-profile-check.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WIRE_TS = join(HERE, '../../../../packages/nodegx-backend-contract/src/wire.ts');

const DIRECTUS = 'http://localhost:8055';
const POSTGREST = 'http://localhost:8056';
const POCKETBASE = 'http://localhost:8091';

let failures = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

/** Read the shipped profile values out of wire.ts, so this cannot drift from it. */
function profileFromSource(typeName) {
  const src = readFileSync(WIRE_TS, 'utf8');
  const block = src.split(`type: '${typeName}'`)[1];
  if (!block) throw new Error(`no profile block for ${typeName}`);
  const upto = block.slice(0, block.indexOf('};'));
  const pick = (key) => {
    const m = upto.match(new RegExp(`\\b${key}:\\s*'([^']*)'`));
    return m ? m[1] : undefined;
  };
  const totalPath = upto.match(/totalCount:\s*\{[^}]*path:\s*'([^']*)'/);
  return {
    dataPath: pick('dataPath'),
    recordDataPath: pick('recordDataPath'),
    totalCountKind: upto.match(/totalCount:\s*\{\s*kind:\s*'([^']*)'/)?.[1],
    totalCountPath: totalPath ? totalPath[1] : undefined,
    paginationKind: upto.match(/pagination:\s*\{\s*kind:\s*'([^']*)'/)?.[1],
    firstPage: Number(upto.match(/firstPage:\s*(\d+)/)?.[1] ?? NaN),
    createResponseKind: upto.match(/createResponse:\s*\{\s*kind:\s*'([^']*)'/)?.[1],
    idField: pick('idField')
  };
}

const dig = (body, path) => {
  if (path === '') return body;
  let c = body;
  for (const s of path.split('.')) {
    if (c === null || typeof c !== 'object') return undefined;
    c = c[s];
  }
  return c;
};
const rowsOf = (p, body) => (p.dataPath === '' ? (Array.isArray(body) ? body : []) : dig(body, p.dataPath) ?? []);
const totalOf = (p, body, headers) => {
  if (p.totalCountKind === 'content-range') {
    const t = headers.get('content-range')?.split('/')[1];
    return !t || t === '*' ? undefined : Number(t);
  }
  if (p.totalCountKind === 'body-path') return dig(body, p.totalCountPath);
  return undefined;
};
const recordOf = (p, body) => {
  if (p.createResponseKind === 'array-of-one') return (Array.isArray(body) ? body : [])[0];
  return dig(body, p.recordDataPath);
};

async function get(url, init) {
  const r = await fetch(url, init);
  const t = await r.text();
  let j = null;
  try {
    j = JSON.parse(t);
  } catch {}
  return { status: r.status, headers: r.headers, json: j, text: t };
}

console.log('BCN-004 — profiles vs. the live servers\n');

// ── Directus ───────────────────────────────────────────────────────────────
console.log('DIRECTUS');
{
  const p = profileFromSource('directus');
  const login = await get(`${DIRECTUS}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'directus-admin-pw' })
  });
  const H = { Authorization: `Bearer ${login.json.data.access_token}`, 'Content-Type': 'application/json' };

  const filter = encodeURIComponent(JSON.stringify({ tag: { _eq: 'x' } }));
  const res = await get(`${DIRECTUS}/items/bcn004?meta=total_count,filter_count&limit=1&filter=${filter}`, {
    headers: H
  });

  // The server's own answer, obtained a different way: count the matching rows.
  const all = await get(`${DIRECTUS}/items/bcn004?limit=-1&filter=${filter}`, { headers: H });
  const trueMatching = all.json.data.length;

  check('rows land at the profile’s dataPath', rowsOf(p, res.json).length, 1);
  check('the profile’s total equals the real matching count', totalOf(p, res.json), trueMatching);
  check('and that is NOT the unfiltered total', res.json.meta.total_count !== trueMatching, true);

  const created = await get(`${DIRECTUS}/items/bcn004`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ name: 'ProfileCheck', tag: 'z' })
  });
  const rec = recordOf(p, created.json);
  check('a created record is found at recordDataPath', typeof rec === 'object' && rec !== null, true);
  check('and carries the profile’s idField', rec?.[p.idField] !== undefined, true);
  if (rec) await get(`${DIRECTUS}/items/bcn004/${rec[p.idField]}`, { method: 'DELETE', headers: H });
}

// ── PostgREST / Supabase ───────────────────────────────────────────────────
console.log('\nSUPABASE (PostgREST)');
{
  const p = profileFromSource('supabase');
  const res = await get(`${POSTGREST}/articles?limit=1`, { headers: { Prefer: 'count=exact' } });
  const all = await get(`${POSTGREST}/articles`);
  const trueTotal = all.json.length;

  check('a bare array is read with an empty dataPath', rowsOf(p, res.json).length, 1);
  check('Content-Range gives the real total', totalOf(p, res.json, res.headers), trueTotal);

  const noPrefer = await get(`${POSTGREST}/articles?limit=1`);
  check('without Prefer the total is unknown, not zero', totalOf(p, noPrefer.json, noPrefer.headers), undefined);

  const bare = await get(`${POSTGREST}/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'profile-check-bare' })
  });
  check('a create without Prefer yields no record', recordOf(p, bare.json), undefined);

  const withRep = await get(`${POSTGREST}/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ title: 'profile-check-rep' })
  });
  const rec = recordOf(p, withRep.json);
  check('a create WITH Prefer yields one record', typeof rec === 'object' && rec !== null, true);
  check('and carries the profile’s idField', rec?.[p.idField] !== undefined, true);

  await get(`${POSTGREST}/articles?title=like.profile-check*`, { method: 'DELETE' });
}

// ── PocketBase ─────────────────────────────────────────────────────────────
console.log('\nPOCKETBASE');
{
  const p = profileFromSource('pocketbase');
  const auth = await get(`${POCKETBASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'admin@example.com', password: 'pocketbase-admin-pw' })
  });
  const H = { Authorization: auth.json.token, 'Content-Type': 'application/json' };

  const res = await get(`${POCKETBASE}/api/collections/bcn004/records?perPage=1&filter=${encodeURIComponent("tag='x'")}`, {
    headers: H
  });
  const all = await get(`${POCKETBASE}/api/collections/bcn004/records?perPage=200&filter=${encodeURIComponent("tag='x'")}`, {
    headers: H
  });

  check('rows land at the profile’s dataPath', rowsOf(p, res.json).length, 1);
  check('the profile’s total equals the real matching count', totalOf(p, res.json), all.json.items.length);

  // The page conversion, against the server. perPage=1 over rows sorted by name.
  const ordered = await get(`${POCKETBASE}/api/collections/bcn004/records?perPage=200&sort=name`, { headers: H });
  const names = ordered.json.items.map((r) => r.name);
  const pageFor = (skip, perPage) => Math.floor(skip / perPage) + p.firstPage;
  for (let skip = 0; skip < names.length; skip++) {
    const page = await get(
      `${POCKETBASE}/api/collections/bcn004/records?perPage=1&sort=name&page=${pageFor(skip, 1)}`,
      { headers: H }
    );
    check(`skip=${skip} -> page=${pageFor(skip, 1)} returns row ${skip} (${names[skip]})`, page.json.items[0]?.name, names[skip]);
  }

  const created = await get(`${POCKETBASE}/api/collections/bcn004/records`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ name: 'ProfileCheck', tag: 'z' })
  });
  const rec = recordOf(p, created.json);
  check('a created record is found at recordDataPath (top level, not items)', typeof rec === 'object' && rec !== null, true);
  check('and carries the profile’s idField', rec?.[p.idField] !== undefined, true);
  if (rec) await get(`${POCKETBASE}/api/collections/bcn004/records/${rec[p.idField]}`, { method: 'DELETE', headers: H });
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
