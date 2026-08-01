/**
 * BCN-005 — relations, through the shipped adapters, against four real servers.
 *
 * The task's success criterion, in one file: *"for each backend, create two
 * records, relate them, read the parent with the relation included, filter on a
 * dotted path across the relation, then unrelate — and assert the row sets."*
 *
 * ## What it drives
 *
 * `RestDataAdapter` and `ParseWireAdapter` are **imported**, not reimplemented,
 * and so are the relation parsers. Every request below is one the shipped code
 * built. That is the RUN-003 lesson: its second Directus translator emitted a
 * flat `"author.city"` key that every unit test accepted and a live Directus
 * answered with a 403.
 *
 * The relation **descriptors** are likewise parsed from each backend's real
 * metadata response by the shipped `relationsFromDirectus` /
 * `relationsFromPostgrestSpec` / `relationsFromPocketBase` — the driver never
 * writes one by hand. A hand-written descriptor would make the junction checks
 * a test of the author's memory.
 *
 * ## The checks, and why each one can fail
 *
 * Every one is a place where getting it wrong returns a **plausible wrong
 * value** rather than an error:
 *
 * 1. **The parsed descriptor.** A Directus M2M must come out junction-shaped
 *    with a two-hop read path; a PostgREST junction must be seen only when the
 *    pair is its primary key.
 * 2. **Read a related record back.** ⚠️ BCN-004-NOTES-TRANSPORT §3.4: *"no live
 *    check reads a related record back on any backend."* This is that check.
 *    On Directus the wrong (one-hop) answer is a 200 carrying junction rows.
 * 3. **Filter across the relation.** Two parents, one matching. The wrong
 *    answer is two rows (Directus flat path, PostgREST plain embed) or zero
 *    rows (PocketBase `=` on a to-many).
 * 4. **Add is set-shaped.** Adding twice must leave one member. The wrong
 *    answer on Directus is two junction rows and a relation that still looks
 *    right.
 * 5. **Remove.** And the relation is gone afterwards, read back.
 * 6. **A relation the schema does not describe is REFUSED**, with no request
 *    made — because relation metadata is admin-only and guessing a junction
 *    table's name is the failure this whole phase is written against.
 * 7. **`relatedTo`**, executed rather than authored, against a real Parse
 *    Server. It has been on the carried-forward register since BCN-003.
 *
 * ## Running it
 *
 *   docker compose --profile supabase --profile aggregate --profile parse up -d
 *   node bcn-005-relation-driver.build.mjs && node bcn-005-relation-driver.cjs
 *
 * ⚠️ Do not pipe into `head`. It closes the pipe, SIGPIPEs node, and the run
 * dies partway through looking like the server stopped answering.
 *
 * ⚠️ The rig is shared. This driver owns the `bcn005_*` collections/tables only,
 * and never touches `articles`, `authors`, `bcn004a` or `bcn004n`.
 */

import * as http from 'node:http';
import { spawnSync } from 'node:child_process';

// `ParseWireAdapter._makeRequest` branches on this: undefined means "in a
// browser" and reaches for `XMLHttpRequest`, which node does not have. The
// fetch branch is the one a driver can exercise, and it is the branch BCN-002's
// driver used for the same reason. `_noodl_cloudservices` is left undefined so
// the handle supplies the endpoint and app id — which is also the configuration
// whose master-key defect BCN-002 found.
(globalThis as Record<string, unknown>)._noodl_cloud_runtime_version = 'bcn-005-driver';

import type { BackendHandle, QueryOptions, RelationDescriptor } from '@noodl/backend-contract';
import {
  relationsFromCachedCollections,
  relationsFromDirectus,
  relationsFromPocketBase,
  relationsFromPostgrestSpec
} from '@noodl/backend-contract';
import { RestDataAdapter } from '../../../../packages/noodl-runtime/src/api/backends/RestDataAdapter';
import { ParseWireAdapter } from '../../../../packages/noodl-runtime/src/api/backends/ParseWireAdapter';
import { toParseWhere } from '@noodl/backend-contract/translators';

const DIRECTUS = 'http://localhost:8055';
const POSTGREST = 'http://localhost:8056';
const POCKETBASE = 'http://localhost:8091';
const PARSE = 'http://localhost:8092/parse';
const PARSE_APP = 'uba-e2e-app';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function say(line = '') {
  console.log(line);
}
function head(title: string) {
  say('');
  say('='.repeat(74));
  say(title);
  say('='.repeat(74));
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

function checkRefused(label: string, result: Outcome<unknown>, matcher: RegExp) {
  if (!result.ok && matcher.test(result.error)) {
    pass++;
    say(`  PASS  ${label}`);
    say(`          refused with: ${result.error.slice(0, 120)}`);
  } else {
    fail++;
    failures.push(`${label}: expected a refusal matching ${matcher}, got ${JSON.stringify(result)}`);
    say(`  FAIL  ${label} — expected a refusal, got ${JSON.stringify(result).slice(0, 200)}`);
  }
}

// ── Callback → promise ─────────────────────────────────────────────────────

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

function query(
  api: { query: (h: BackendHandle, o: QueryOptions) => void },
  handle: BackendHandle,
  options: Omit<QueryOptions, 'success' | 'error'>
): Promise<Outcome<Array<Record<string, unknown>>>> {
  return call((success, error) =>
    api.query(handle, Object.assign({}, options, { success: (rows: never) => success(rows), error }))
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

function psql(sql: string) {
  const r = spawnSync(
    'docker',
    ['exec', '-i', 'uba-e2e-supabase-db-1', 'psql', '-U', 'postgres', '-d', 'app', '-c', sql],
    { encoding: 'utf8' }
  );
  return (r.stdout || '') + (r.stderr || '');
}

/** Mount an upstream at `/rest/v1/`, where the Supabase profile expects it. */
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

// ── The corpus ─────────────────────────────────────────────────────────────
//
// Two authors in two cities, two articles one each, two tags — the smallest
// shape in which a filter across a relation can return the WRONG answer. With
// one article, "filter by the author's city" returns it either way.

const CORPUS = {
  authors: [
    { name: 'Ada', city: 'London' },
    { name: 'Grace', city: 'New York' }
  ],
  tags: [{ label: 'algebra' }, { label: 'compilers' }],
  articles: ['Notes on the Engine', 'A Compiler Story']
};

/**
 * The one relation check that runs identically on every backend.
 *
 * This is the register's *"a relation in the equivalence corpus"*: **one**
 * neutral filter, `{'<relation>.city': {equalTo: 'London'}}`, translated by each
 * backend's own dialect, asserted to return the same single row. Three dialects
 * spell it three ways — nested JSON, a query parameter plus an `!inner` embed,
 * and a `?=`-quantified expression — and BCN-003's corpus had no case that
 * crossed a relation at all.
 */
type RelationSuite = {
  label: string;
  handle: BackendHandle;
  adapter: RestDataAdapter;
  collection: string;
  /** The to-one relation field, and the to-many one. */
  toOne: string;
  toMany: string;
  /** Ids, resolved during seeding. */
  ids: { articles: string[]; tags: string[]; authors: string[] };
  /** The label field on the target of `toMany`. */
  titleField: string;
  relations: RelationDescriptor[];
};

async function runRelationSuite(suite: RelationSuite) {
  const { adapter, handle, collection, toOne, toMany, ids, titleField } = suite;

  // ── 2. read a related record back ────────────────────────────────────────
  const withAuthor = await call<Record<string, unknown>>((success, error) =>
    adapter.fetch(handle, { collection, objectId: ids.articles[0], include: [toOne], success, error })
  );
  check(
    'the to-one relation comes back as a NESTED RECORD, not the id it already had',
    withAuthor.ok ? nestedField(withAuthor.value[toOne], 'city') : withAuthor,
    'London'
  );

  // ── 3. filter across the to-one relation ─────────────────────────────────
  const byCity = await query(adapter, handle, {
    collection,
    where: { [`${toOne}.city`]: { equalTo: 'London' } },
    include: [toOne],
    sort: [titleField]
  });
  check(
    'a dotted filter across the relation narrows the PARENT rows',
    byCity.ok ? byCity.value.map((row) => row[titleField]) : byCity,
    ['Notes on the Engine']
  );

  // ── 4. add ───────────────────────────────────────────────────────────────
  //
  // ⚠️ **Two tags, not one, and the second one is the whole reason this section
  // is shaped the way it is.** The first draft related one tag and then filtered
  // for it — and a mutation test that removed PocketBase's `?` quantifier
  // entirely **passed all 41 checks**, because on a record holding exactly one
  // related record "every related record matches" and "at least one does" are
  // the same question. Only a parent with two of them tells the two apart. This
  // is the BCN-004 pagination trap, one task later and in a new place.
  const relate = (article: string, tag: string) =>
    call<Record<string, unknown>>((success, error) =>
      adapter.addRelation(handle, {
        collection,
        objectId: article,
        key: toMany,
        targetObjectId: tag,
        targetCollection: 'tags',
        success,
        error
      })
    );

  const added = await relate(ids.articles[0], ids.tags[0]);
  check('addRelation succeeds', added.ok, true);
  if (!added.ok) say(`          error: ${added.error}`);

  const addedSecond = await relate(ids.articles[0], ids.tags[1]);
  check('a second member goes on the same relation', addedSecond.ok, true);
  // The other parent gets the OTHER tag, so a filter for `algebra` has a row it
  // must exclude as well as one it must find.
  await relate(ids.articles[1], ids.tags[1]);

  const afterAdd = await call<Record<string, unknown>>((success, error) =>
    adapter.fetch(handle, { collection, objectId: ids.articles[0], include: [toMany], success, error })
  );
  check(
    'both related records read back, with their own fields',
    afterAdd.ok ? labelsOf(afterAdd.value[toMany], toMany, afterAdd.value) : afterAdd,
    ['algebra', 'compilers']
  );

  // ── 4b. adding an existing member leaves the set alone ───────────────────
  //
  // ⚠️ **Both halves are asserted, and the second one was missing.** A mutation
  // that removed PostgREST's `Prefer: resolution=merge-duplicates` left the
  // *state* correct — the first insert had already worked — and passed all 50
  // checks, because only the read-back was being asserted. What the mutation
  // actually broke is the **callback**: without the header the duplicate insert
  // is a `409 23505`, so `addRelation` calls `error` and an Add Record Relation
  // node's Success signal never fires. Set semantics is a claim about the
  // answer as much as about the rows.
  const addedAgain = await relate(ids.articles[0], ids.tags[0]);
  check('…and reports SUCCESS rather than a duplicate-key error', addedAgain.ok, true);
  if (!addedAgain.ok) say(`          error: ${addedAgain.error}`);

  const afterTwice = await call<Record<string, unknown>>((success, error) =>
    adapter.fetch(handle, { collection, objectId: ids.articles[0], include: [toMany], success, error })
  );
  check(
    '⚠️ adding a member that is already there changes nothing, as a Parse Relation would',
    afterTwice.ok ? labelsOf(afterTwice.value[toMany], toMany, afterTwice.value) : afterTwice,
    ['algebra', 'compilers']
  );

  // ── 3b. filter across the to-many relation ───────────────────────────────
  //
  // Article 1 holds BOTH tags; article 2 holds only `compilers`. So:
  //   · a quantifier that means "all related records match" returns nothing;
  //   · a filter that does not narrow the parent returns both articles;
  //   · the right answer is one row, and only the right answer gives it.
  const byTag = await query(adapter, handle, {
    collection,
    where: { [`${toMany}.label`]: { equalTo: 'algebra' } },
    include: [toMany],
    sort: [titleField]
  });
  check(
    '⚠️ a dotted filter across a to-MANY relation returns the one matching parent',
    byTag.ok ? byTag.value.map((row) => row[titleField]) : byTag,
    ['Notes on the Engine']
  );

  // ── 5. remove ────────────────────────────────────────────────────────────
  const removed = await call<Record<string, unknown>>((success, error) =>
    adapter.removeRelation(handle, {
      collection,
      objectId: ids.articles[0],
      key: toMany,
      targetObjectId: ids.tags[0],
      targetCollection: 'tags',
      success,
      error
    })
  );
  check('removeRelation succeeds', removed.ok, true);
  if (!removed.ok) say(`          error: ${removed.error}`);

  const afterRemove = await call<Record<string, unknown>>((success, error) =>
    adapter.fetch(handle, { collection, objectId: ids.articles[0], include: [toMany], success, error })
  );
  check(
    '…and removes ONLY the member named, leaving the other',
    afterRemove.ok ? labelsOf(afterRemove.value[toMany], toMany, afterRemove.value) : afterRemove,
    ['compilers']
  );

  await call((success, error) =>
    adapter.removeRelation(handle, {
      collection,
      objectId: ids.articles[0],
      key: toMany,
      targetObjectId: ids.tags[1],
      targetCollection: 'tags',
      success,
      error
    })
  );
  const afterBoth = await call<Record<string, unknown>>((success, error) =>
    adapter.fetch(handle, { collection, objectId: ids.articles[0], include: [toMany], success, error })
  );
  check(
    'and the relation is EMPTY once both are removed',
    afterBoth.ok ? labelsOf(afterBoth.value[toMany], toMany, afterBoth.value) : afterBoth,
    []
  );

  // Removing something that is not there is success, on every backend — the
  // wire cannot say otherwise (Directus 204, PostgREST 200 [], PocketBase 200).
  const removeAbsent = await call((success, error) =>
    adapter.removeRelation(handle, {
      collection,
      objectId: ids.articles[0],
      key: toMany,
      targetObjectId: ids.tags[0],
      targetCollection: 'tags',
      success,
      error
    })
  );
  check('removing a member that is not there reports success, not an error', removeAbsent.ok, true);

  // ── 6. the refusal that stayed ───────────────────────────────────────────
  const unknown = await call((success, error) =>
    adapter.addRelation(handle, {
      collection,
      objectId: ids.articles[0],
      key: 'no_such_relation',
      targetObjectId: ids.tags[0],
      targetCollection: 'tags',
      success,
      error
    })
  );
  checkRefused(
    '⚠️ a relation the synced schema does not describe is REFUSED, not guessed at',
    unknown,
    /does not know how "no_such_relation" relates/
  );
}

/** `record.city` through whatever nesting the backend used. */
function nestedField(value: unknown, field: string): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) return (value as Record<string, unknown>)[field];
  return value;
}

/**
 * The labels of a to-many relation, sorted, whatever shape it arrived in.
 *
 * PocketBase puts the expanded records under `expand`, not on the field — the
 * field itself keeps the ids. Both are the backend's own shape and the contract
 * does not currently normalise the second (recorded in BCN-005-NOTES.md), so the
 * driver reads both rather than asserting one and calling PocketBase broken.
 */
function labelsOf(value: unknown, field: string, record: Record<string, unknown>): unknown {
  const expand = record.expand as Record<string, unknown> | undefined;
  const expanded = expand?.[field];
  const list = Array.isArray(expanded) ? expanded : Array.isArray(value) ? value : [];
  return list
    .map((entry) => (entry && typeof entry === 'object' ? (entry as Record<string, unknown>).label : entry))
    .filter((entry) => entry !== undefined)
    .sort();
}

// ── Directus ───────────────────────────────────────────────────────────────

const D = { authors: 'bcn005_authors', tags: 'bcn005_tags', articles: 'bcn005_articles', junction: 'bcn005_articles_tags' };

async function seedDirectus() {
  const login = await req(`${DIRECTUS}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'directus-admin-pw' })
  });
  const token = login.json?.data?.access_token as string | undefined;
  if (!token) {
    say(`  !! Directus login failed: ${login.status}`);
    return undefined;
  }
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Rebuild from scratch: the probe left fixtures behind and a half-seeded
  // relation is worse than none.
  for (const c of [D.junction, D.articles, D.tags, D.authors]) {
    await req(`${DIRECTUS}/collections/${c}`, { method: 'DELETE', headers: H });
  }

  const pk = { field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } };
  const mk = (collection: string, fields: unknown[]) =>
    req(`${DIRECTUS}/collections`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ collection, schema: {}, meta: { singleton: false }, fields })
    });

  await mk(D.authors, [pk, { field: 'name', type: 'string' }, { field: 'city', type: 'string' }]);
  await mk(D.tags, [pk, { field: 'label', type: 'string' }]);
  await mk(D.articles, [pk, { field: 'title', type: 'string' }, { field: 'author', type: 'integer' }]);
  await mk(D.junction, [pk, { field: 'article_id', type: 'integer' }, { field: 'tag_id', type: 'integer' }]);

  await req(`${DIRECTUS}/relations`, {
    method: 'POST',
    headers: H,
    // `meta.one_field` is what makes Directus record the reverse one-to-many.
    // ⚠️ It records the *relation* and does not create the alias *field*, so
    // `?fields=*,articles.*` on the authors side answers 403 — measured, and
    // recorded in BCN-005-NOTES.md as a divergence between what /relations
    // describes and what can be read.
    body: JSON.stringify({
      collection: D.articles,
      field: 'author',
      related_collection: D.authors,
      meta: { one_field: 'articles' }
    })
  });
  await req(`${DIRECTUS}/fields/${D.articles}`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ field: 'tags', type: 'alias', meta: { interface: 'list-m2m', special: ['m2m'] } })
  });
  await req(`${DIRECTUS}/relations`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      collection: D.junction,
      field: 'article_id',
      related_collection: D.articles,
      meta: { one_field: 'tags', junction_field: 'tag_id' }
    })
  });
  await req(`${DIRECTUS}/relations`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      collection: D.junction,
      field: 'tag_id',
      related_collection: D.tags,
      meta: { junction_field: 'article_id' }
    })
  });

  const authors = await req(`${DIRECTUS}/items/${D.authors}`, { method: 'POST', headers: H, body: JSON.stringify(CORPUS.authors) });
  const authorIds = (authors.json?.data ?? []).map((r: { id: number }) => String(r.id));
  const tags = await req(`${DIRECTUS}/items/${D.tags}`, { method: 'POST', headers: H, body: JSON.stringify(CORPUS.tags) });
  const tagIds = (tags.json?.data ?? []).map((r: { id: number }) => String(r.id));
  const articles = await req(`${DIRECTUS}/items/${D.articles}`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify(CORPUS.articles.map((title, i) => ({ title, author: Number(authorIds[i]) })))
  });
  const articleIds = (articles.json?.data ?? []).map((r: { id: number }) => String(r.id));

  return { token, ids: { authors: authorIds, tags: tagIds, articles: articleIds }, headers: H };
}

async function runDirectus() {
  head('DIRECTUS 11 — relations through RestDataAdapter');
  const seeded = await seedDirectus();
  if (!seeded) return;

  // ── 1. the descriptor, parsed from the REAL GET /relations ───────────────
  const raw = await req(`${DIRECTUS}/relations`, { headers: seeded.headers });
  const rows = ((raw.json?.data ?? []) as Array<{ collection?: string }>).filter((r) =>
    (r.collection ?? '').startsWith('bcn005')
  );
  const relations = relationsFromDirectus(rows);
  const m2m = relations.find((r) => r.collection === D.articles && r.field === 'tags');
  check('GET /relations yields the M2M as a junction write', m2m?.write, {
    kind: 'junction',
    collection: D.junction,
    sourceField: 'article_id',
    targetField: 'tag_id',
    idempotent: false
  });
  check('…with a TWO-hop read path, because one hop returns junction rows', m2m?.readPath, 'tags.tag_id');
  check(
    'and the O2M reverse puts the foreign key on the TARGET',
    // Named by Directus's own `meta.one_field` — `articles`, not the collection.
    relations.find((r) => r.collection === D.authors && r.field === 'articles')?.write,
    { kind: 'foreignKey', field: 'author', on: 'target' }
  );

  const handle: BackendHandle = { id: 'd', type: 'directus', name: 'Directus', url: DIRECTUS, publicToken: seeded.token };
  // ⚠️ **No `schemaFor`.** The cardinality and the junction path both come from
  // the relation descriptors, merged by the adapter — so this run proves the
  // product path rather than a schema the driver helpfully filled in.
  const adapter = new RestDataAdapter({ relationsFor: () => relations });

  await runRelationSuite({
    label: 'directus',
    handle,
    adapter,
    collection: D.articles,
    toOne: 'author',
    toMany: 'tags',
    ids: seeded.ids,
    titleField: 'title',
    relations
  });

  // ⚠️ **The one-to-many write direction, which the shared suite cannot reach.**
  // Relating an article to an author through the *authors* side must write the
  // ARTICLE's `author` column. The wrong side answers 200 and writes an article
  // id into the authors table, so there is nothing to catch downstream.
  const o2mAdapter = new RestDataAdapter({ relationsFor: () => relations });
  const o2m = await call<Record<string, unknown>>((success, error) =>
    o2mAdapter.addRelation(handle, {
      collection: D.authors,
      objectId: seeded.ids.authors[1],
      key: 'articles',
      targetObjectId: seeded.ids.articles[0],
      targetCollection: D.articles,
      success,
      error
    })
  );
  check('a one-to-many add succeeds', o2m.ok, true);
  if (!o2m.ok) say(`          error: ${o2m.error}`);
  const movedArticle = await req(`${DIRECTUS}/items/${D.articles}/${seeded.ids.articles[0]}?fields=author`, {
    headers: seeded.headers
  });
  check(
    '⚠️ …and writes the foreign key on the CHILD, not on the collection it was addressed to',
    String(movedArticle.json?.data?.author),
    seeded.ids.authors[1]
  );
  // Put it back, so the control below reads the seeded shape.
  await req(`${DIRECTUS}/items/${D.articles}/${seeded.ids.articles[0]}`, {
    method: 'PATCH',
    headers: seeded.headers,
    body: JSON.stringify({ author: Number(seeded.ids.authors[0]) })
  });

  // A negative control, printed rather than asserted, and run **after** the
  // suite has left a junction row in place — the evidence that the two-hop
  // check above could have failed. Printed before the assertion would have
  // shown an empty relation and proved nothing.
  await req(`${DIRECTUS}/items/${D.junction}`, {
    method: 'POST',
    headers: seeded.headers,
    body: JSON.stringify({ article_id: Number(seeded.ids.articles[0]), tag_id: Number(seeded.ids.tags[0]) })
  });
  const oneHop = await req(`${DIRECTUS}/items/${D.articles}/${seeded.ids.articles[0]}?fields=*,tags.*`, {
    headers: seeded.headers
  });
  const twoHop = await req(`${DIRECTUS}/items/${D.articles}/${seeded.ids.articles[0]}?fields=*,tags.tag_id.*`, {
    headers: seeded.headers
  });
  say(`  control: the ONE-hop include answers ${JSON.stringify(oneHop.json?.data?.tags)}`);
  say(`           the TWO-hop include answers ${JSON.stringify(twoHop.json?.data?.tags)}`);
  say('           — junction rows versus tags, both with a 200. Nothing downstream could tell.');

  // ⚠️ The cached-schema derivation is what a running app actually has, and it
  // is a strict subset. Asserted rather than assumed: the junction is
  // recoverable, but under the target collection's name rather than the alias.
  const cached = relationsFromCachedCollections([
    { name: D.articles, fields: [{ name: 'id', primaryKey: true }, { name: 'title' }, { name: 'author', relationTarget: D.authors, relationType: 'many-to-one' }] },
    { name: D.authors, fields: [{ name: 'id', primaryKey: true }, { name: 'name' }, { name: 'city' }] },
    { name: D.tags, fields: [{ name: 'id', primaryKey: true }, { name: 'label' }] },
    {
      name: D.junction,
      fields: [
        { name: 'id', primaryKey: true },
        { name: 'article_id', relationTarget: D.articles, relationType: 'many-to-one' },
        { name: 'tag_id', relationTarget: D.tags, relationType: 'many-to-one' }
      ]
    }
  ]);
  check(
    '⚠️ the cached schema recovers the junction, but names it after the TARGET, not the alias',
    cached.find((r) => r.collection === D.articles && r.field === D.tags)?.write,
    { kind: 'junction', collection: D.junction, sourceField: 'article_id', targetField: 'tag_id', idempotent: false }
  );
}

// ── PostgREST ──────────────────────────────────────────────────────────────

async function runPostgrest() {
  head('POSTGREST v12.2.3 as the Supabase wire — relations through RestDataAdapter');

  const out = psql(`
    DROP TABLE IF EXISTS bcn005_articles_tags;
    DROP TABLE IF EXISTS bcn005_articles;
    DROP TABLE IF EXISTS bcn005_tags;
    DROP TABLE IF EXISTS bcn005_authors;
    CREATE TABLE bcn005_authors (id SERIAL PRIMARY KEY, name TEXT, city TEXT);
    CREATE TABLE bcn005_tags (id SERIAL PRIMARY KEY, label TEXT);
    CREATE TABLE bcn005_articles (id SERIAL PRIMARY KEY, title TEXT,
      author_id INTEGER REFERENCES bcn005_authors(id));
    CREATE TABLE bcn005_articles_tags (
      article_id INTEGER NOT NULL REFERENCES bcn005_articles(id),
      tag_id INTEGER NOT NULL REFERENCES bcn005_tags(id),
      PRIMARY KEY (article_id, tag_id));
    GRANT SELECT, INSERT, UPDATE, DELETE ON bcn005_authors, bcn005_tags, bcn005_articles, bcn005_articles_tags TO web_anon;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO web_anon;
    INSERT INTO bcn005_authors (name, city) VALUES ('Ada','London'), ('Grace','New York');
    INSERT INTO bcn005_tags (label) VALUES ('algebra'), ('compilers');
    INSERT INTO bcn005_articles (title, author_id) VALUES ('Notes on the Engine', 1), ('A Compiler Story', 2);
    NOTIFY pgrst, 'reload schema';
  `);
  if (/ERROR/.test(out)) say('  !! psql: ' + out.split('\n').filter((l) => /ERROR/.test(l)).join(' | '));
  await new Promise((r) => setTimeout(r, 1500));

  // ── 1. the descriptor, parsed from the REAL OpenAPI document ─────────────
  const spec = await req(`${POSTGREST}/`);
  const relations = relationsFromPostgrestSpec(spec.json).filter((r) => r.collection.startsWith('bcn005'));
  check(
    '⚠️ the composite-PK junction is seen as a junction',
    relations.find((r) => r.collection === 'bcn005_articles' && r.field === 'bcn005_tags')?.write,
    { kind: 'junction', collection: 'bcn005_articles_tags', sourceField: 'article_id', targetField: 'tag_id', idempotent: true }
  );

  // The negative control this phase asks for: the SAME two tables with a
  // surrogate key, and PostgREST cannot see the relation at all.
  psql(`
    DROP TABLE IF EXISTS bcn005_surrogate_junction;
    CREATE TABLE bcn005_surrogate_junction (
      id SERIAL PRIMARY KEY,
      article_id INTEGER NOT NULL REFERENCES bcn005_articles(id),
      tag_id INTEGER NOT NULL REFERENCES bcn005_tags(id));
    GRANT SELECT ON bcn005_surrogate_junction TO web_anon;
    NOTIFY pgrst, 'reload schema';
  `);
  await new Promise((r) => setTimeout(r, 1200));
  const spec2 = await req(`${POSTGREST}/`);
  const surrogateEmbed = await req(`${POSTGREST}/bcn005_articles?select=id,bcn005_tags(*)`);
  say(`  control: with BOTH junctions present the M2M embed answers ${surrogateEmbed.status}`);
  const withSurrogate = relationsFromPostgrestSpec(spec2.json).filter(
    (r) => r.write.kind === 'junction' && r.write.collection === 'bcn005_surrogate_junction'
  );
  check(
    '⚠️ a surrogate-key junction is NOT emitted, because PostgREST cannot embed through it',
    withSurrogate.length,
    0
  );
  psql(`DROP TABLE IF EXISTS bcn005_surrogate_junction; NOTIFY pgrst, 'reload schema';`);
  await new Promise((r) => setTimeout(r, 1200));

  const proxy = await mountAsSupabase(POSTGREST);
  const handle: BackendHandle = { id: 's', type: 'supabase', name: 'Supabase', url: proxy.url };
  const adapter = new RestDataAdapter({ relationsFor: () => relations });

  try {
    await runRelationSuite({
      label: 'supabase',
      handle,
      adapter,
      collection: 'bcn005_articles',
      // PostgREST names an embed after the table; there is no alias field.
      toOne: 'bcn005_authors',
      toMany: 'bcn005_tags',
      ids: { authors: ['1', '2'], tags: ['1', '2'], articles: ['1', '2'] },
      titleField: 'title',
      relations
    });

    // The idempotence claim above rests on one header, so it gets its own
    // negative control: the raw insert without it.
    const raw409 = await req(`${POSTGREST}/bcn005_articles_tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ article_id: 1, tag_id: 1 })
    });
    const raw409b = await req(`${POSTGREST}/bcn005_articles_tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ article_id: 1, tag_id: 1 })
    });
    say(`  control: the same insert WITHOUT merge-duplicates answers ${raw409.status} then ${raw409b.status}`);
    say('           — so the adapter\'s idempotent add is the Prefer header, not luck.');
    await req(`${POSTGREST}/bcn005_articles_tags?article_id=eq.1&tag_id=eq.1`, { method: 'DELETE' });
  } finally {
    proxy.close();
  }
}

// ── PocketBase ─────────────────────────────────────────────────────────────

async function seedPocketbase() {
  const login = await req(`${POCKETBASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'admin@example.com', password: 'pocketbase-admin-pw' })
  });
  const token = login.json?.token as string | undefined;
  if (!token) {
    say('  !! PocketBase admin login failed');
    return undefined;
  }
  const H = { Authorization: token, 'Content-Type': 'application/json' };

  for (const name of ['bcn005_articles', 'bcn005_tags', 'bcn005_authors']) {
    await req(`${POCKETBASE}/api/collections/${name}`, { method: 'DELETE', headers: H });
  }
  const open = { listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '' };
  const mk = (body: unknown) => req(`${POCKETBASE}/api/collections`, { method: 'POST', headers: H, body: JSON.stringify(body) });

  const authors = await mk({
    name: 'bcn005_authors',
    type: 'base',
    fields: [{ name: 'name', type: 'text' }, { name: 'city', type: 'text' }],
    ...open
  });
  const tags = await mk({ name: 'bcn005_tags', type: 'base', fields: [{ name: 'label', type: 'text' }], ...open });
  await mk({
    name: 'bcn005_articles',
    type: 'base',
    fields: [
      { name: 'title', type: 'text' },
      { name: 'author', type: 'relation', collectionId: authors.json?.id, maxSelect: 1, cascadeDelete: false },
      { name: 'tags', type: 'relation', collectionId: tags.json?.id, maxSelect: 99, cascadeDelete: false }
    ],
    ...open
  });

  const mkRec = (c: string, data: unknown) =>
    req(`${POCKETBASE}/api/collections/${c}/records`, { method: 'POST', headers: H, body: JSON.stringify(data) });
  const authorIds: string[] = [];
  for (const author of CORPUS.authors) authorIds.push((await mkRec('bcn005_authors', author)).json?.id);
  const tagIds: string[] = [];
  for (const tag of CORPUS.tags) tagIds.push((await mkRec('bcn005_tags', tag)).json?.id);
  const articleIds: string[] = [];
  for (let i = 0; i < CORPUS.articles.length; i++) {
    articleIds.push((await mkRec('bcn005_articles', { title: CORPUS.articles[i], author: authorIds[i] })).json?.id);
  }

  return { token, headers: H, ids: { authors: authorIds, tags: tagIds, articles: articleIds } };
}

async function runPocketbase() {
  head('POCKETBASE 0.30.0 — relations through RestDataAdapter (first ever exercise)');
  const seeded = await seedPocketbase();
  if (!seeded) return;

  // ── 1. the descriptor, parsed from the REAL collections list ─────────────
  const list = await req(`${POCKETBASE}/api/collections?perPage=200`, { headers: seeded.headers });
  const collections = ((list.json?.items ?? []) as Array<{ name?: string }>).filter((c) =>
    (c.name ?? '').startsWith('bcn005')
  );
  const relations = relationsFromPocketBase(list.json?.items ?? []).filter((r) => r.collection.startsWith('bcn005'));
  check(
    'a relation field resolves its target from the collection ID',
    relations.find((r) => r.field === 'tags'),
    { collection: 'bcn005_articles', field: 'tags', target: 'bcn005_tags', cardinality: 'many', write: { kind: 'arrayField', field: 'tags', setSemantics: true } }
  );
  check(
    '⚠️ the collections carry `fields`, not `schema` — which is what the editor parser reads',
    collections.map((c) => ('fields' in c ? 'fields' : 'schema' in c ? 'schema' : 'neither'))[0],
    'fields'
  );

  const handle: BackendHandle = { id: 'p', type: 'pocketbase', name: 'PocketBase', url: POCKETBASE, publicToken: seeded.token };
  const adapter = new RestDataAdapter({ relationsFor: () => relations });

  await runRelationSuite({
    label: 'pocketbase',
    handle,
    adapter,
    collection: 'bcn005_articles',
    toOne: 'author',
    toMany: 'tags',
    ids: seeded.ids,
    titleField: 'title',
    relations
  });

  // The `?=` claim rests on one character, so it gets a control — run against
  // a parent restored to TWO tags, because with one the two spellings agree and
  // the control would print a reassuring number that means nothing.
  await req(`${POCKETBASE}/api/collections/bcn005_articles/records/${seeded.ids.articles[0]}`, {
    method: 'PATCH',
    headers: seeded.headers,
    body: JSON.stringify({ tags: seeded.ids.tags })
  });
  const wrongWay = await req(
    `${POCKETBASE}/api/collections/bcn005_articles/records?filter=` + encodeURIComponent(`tags.label = "algebra"`),
    { headers: seeded.headers }
  );
  const rightWay = await req(
    `${POCKETBASE}/api/collections/bcn005_articles/records?filter=` + encodeURIComponent(`tags.label ?= "algebra"`),
    { headers: seeded.headers }
  );
  say(
    `  control: on a parent with TWO tags, \`tags.label = "algebra"\` returns ` +
      `${(wrongWay.json?.items ?? []).length} rows and \`?=\` returns ${(rightWay.json?.items ?? []).length}`
  );
  say('           — which is why the schema\'s cardinality has to reach the translator.');
}

// ── Parse — `relatedTo`, executed at last ──────────────────────────────────

async function runParseRelatedTo() {
  head('PARSE SERVER 7.3.0 — `relatedTo`, executed rather than authored');

  const H = { 'X-Parse-Application-Id': PARSE_APP, 'Content-Type': 'application/json' };
  const health = await req(`${PARSE}/classes/Bcn005Tag?limit=1`, { headers: H });
  if (health.status >= 400 && health.status !== 404) {
    say(`  !! Parse not reachable (${health.status}) — is the parse profile up?`);
    return;
  }

  // Clean, then seed: two tags, one article, one of the tags related.
  for (const cls of ['Bcn005Tag', 'Bcn005Article']) {
    const existing = await req(`${PARSE}/classes/${cls}?limit=1000`, { headers: H });
    for (const row of (existing.json?.results ?? []) as Array<{ objectId: string }>) {
      await req(`${PARSE}/classes/${cls}/${row.objectId}`, { method: 'DELETE', headers: H });
    }
  }
  const algebra = await req(`${PARSE}/classes/Bcn005Tag`, { method: 'POST', headers: H, body: JSON.stringify({ label: 'algebra' }) });
  const compilers = await req(`${PARSE}/classes/Bcn005Tag`, { method: 'POST', headers: H, body: JSON.stringify({ label: 'compilers' }) });
  const article = await req(`${PARSE}/classes/Bcn005Article`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ title: 'Notes on the Engine' })
  });

  const handle: BackendHandle = { id: 'x', type: 'parse', name: 'Parse', url: PARSE, publicToken: PARSE_APP };
  const adapter = new ParseWireAdapter({});

  // The relation write, through the shipped adapter — and with the NEW field
  // name, which is the rename's live check.
  const related = await call<Record<string, unknown>>((success, error) =>
    adapter.addRelation(handle, {
      collection: 'Bcn005Article',
      objectId: article.json?.objectId,
      key: 'tags',
      targetObjectId: algebra.json?.objectId,
      targetCollection: 'Bcn005Tag',
      success,
      error
    })
  );
  check('addRelation through the contract\'s NEW `targetCollection` field', related.ok, true);
  if (!related.ok) say(`          error: ${related.error}`);

  // …and the deprecated spelling still reaches the same wire.
  const legacy = await call<Record<string, unknown>>((success, error) =>
    adapter.addRelation(handle, {
      collection: 'Bcn005Article',
      objectId: article.json?.objectId,
      key: 'tags',
      targetObjectId: algebra.json?.objectId,
      targetClass: 'Bcn005Tag',
      success,
      error
    })
  );
  check('…and the deprecated `targetClass` alias still works', legacy.ok, true);

  // ⚠️ The register item: `relatedTo` has been authored since BCN-003 and never
  // run. Two tags exist; only one is related, so a translator that dropped the
  // condition would return both.
  // ⚠️ **`ParseWireAdapter` takes an already-translated Parse `where`, not a
  // neutral filter.** `cloudstore.js`'s `usesNeutralFilter` is false for the
  // Parse family precisely because `queryutils.convertVisualFilter` translates
  // all the way to Parse for it — so the product path runs `toParseWhere` above
  // the adapter, and so does this. Handing the adapter `{relatedTo: …}` raw
  // sends that object to Parse as the query and the error comes back with **no
  // message at all**, which is how this was found.
  const relatedToFilter = { relatedTo: { id: article.json?.objectId as string, key: 'tags', className: 'Bcn005Article' } };
  const parseWhere = toParseWhere(relatedToFilter, { backend: 'parse' });
  check('the neutral relatedTo translates to Parse\'s own operator', Object.keys(parseWhere), ['$relatedTo']);

  const members = await query(adapter, handle, {
    collection: 'Bcn005Tag',
    where: parseWhere as never,
    sort: ['label']
  });
  check(
    '⚠️ relatedTo returns ONLY the related record — executed for the first time',
    members.ok ? members.value.map((row) => row.label) : members,
    ['algebra']
  );
  const allTags = await query(adapter, handle, { collection: 'Bcn005Tag', sort: ['label'] });
  say(`  control: unfiltered, the collection answers ${JSON.stringify(allTags.ok ? allTags.value.map((r) => r.label) : allTags)}`);
  say('           — two rows, so a relatedTo that dropped its condition would be visible.');
  void compilers;

  const removed = await call<Record<string, unknown>>((success, error) =>
    adapter.removeRelation(handle, {
      collection: 'Bcn005Article',
      objectId: article.json?.objectId,
      key: 'tags',
      targetObjectId: algebra.json?.objectId,
      targetCollection: 'Bcn005Tag',
      success,
      error
    })
  );
  check('removeRelation succeeds', removed.ok, true);

  const afterRemove = await query(adapter, handle, {
    collection: 'Bcn005Tag',
    where: toParseWhere(relatedToFilter, { backend: 'parse' }) as never
  });
  check('and relatedTo then returns nothing', afterRemove.ok ? afterRemove.value.length : afterRemove, 0);
}

// ── main ───────────────────────────────────────────────────────────────────

(async () => {
  say('BCN-005 relation live pass — ' + new Date().toISOString());
  for (const [name, fn] of [
    ['directus', runDirectus],
    ['postgrest', runPostgrest],
    ['pocketbase', runPocketbase],
    ['parse', runParseRelatedTo]
  ] as const) {
    try {
      await fn();
    } catch (e) {
      fail++;
      failures.push(`${name} threw: ${e}`);
      say(`  !! ${name} threw: ${e}`);
    }
  }

  say('');
  say('='.repeat(74));
  say(`${pass} passed, ${fail} failed`);
  for (const failure of failures) say(`  - ${failure}`);
  say('='.repeat(74));
  process.exit(fail === 0 ? 0 : 1);
})();
