/**
 * BCN-005 — what the relation wire actually does, on three real servers.
 *
 * Written **before** any adapter code, for the reason this phase has now paid
 * for four times: BCN-002 found three carefully-documented Parse file cells
 * wrong, BCN-003 found four descriptor cells a real server contradicted,
 * BCN-004 found the preset's Directus total ignores the filter, and BCN-007
 * shipped a field map marked "documented, not probed" that BCN-004 had to
 * confirm.
 *
 * BCN-004-NOTES-TRANSPORT.md §3.4 records the specific hole this fills:
 * *"no live check reads a related record back on any backend."*
 *
 * ## What it asks
 *
 * Per backend, for a many-to-one and a many-to-many:
 *
 *  A. **relation metadata** — what does the backend say about its own
 *     relations, and does it describe the junction where one exists?
 *  B. **read** — does the `include`/`expand`/embed syntax actually nest the
 *     related record, or does it silently return the id it already had?
 *  C. **filter across the relation** — a dotted path, and whether it narrows
 *     the *parent* rows or merely the nested ones (the PostgREST `!inner` trap).
 *  D. **add** — the write that makes the relation exist.
 *  E. **remove** — and whether removing something that was never there errors.
 *
 * ## Running it
 *
 *   docker compose --profile supabase --profile aggregate up -d
 *   node bcn-005-relation-probe.mjs > BCN-005-RELATION-PROBE-OUTPUT.txt
 *
 * ⚠️ Do not pipe into `head`: it SIGPIPEs node partway through and the run
 * looks like a server that stopped answering.
 *
 * ⚠️ The Directus token expires in 15 minutes. This probe re-logs-in per
 * section rather than holding one.
 */

const DIRECTUS = 'http://localhost:8055';
const POSTGREST = 'http://localhost:8056';
const POCKETBASE = 'http://localhost:8091';

const PB_ADMIN = { identity: 'admin@example.com', password: 'pocketbase-admin-pw' };

function say(line = '') {
  console.log(line);
}
function head(title) {
  say('');
  say('='.repeat(74));
  say(title);
  say('='.repeat(74));
}
function fact(label, value) {
  say(`  · ${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
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
  return { status: r.status, text, json, headers: r.headers };
}

const J = (token, bearer = true) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: bearer ? `Bearer ${token}` : token } : {})
});

// ── Directus ───────────────────────────────────────────────────────────────

async function directusLogin() {
  const r = await req(`${DIRECTUS}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'directus-admin-pw' })
  });
  return r.json?.data?.access_token;
}

const D_A = 'bcn005_authors';
const D_ART = 'bcn005_articles';
const D_TAG = 'bcn005_tags';
const D_JUNC = 'bcn005_articles_tags';

async function directusTeardown(token) {
  const H = J(token);
  for (const c of [D_JUNC, D_ART, D_TAG, D_A]) {
    await req(`${DIRECTUS}/collections/${c}`, { method: 'DELETE', headers: H });
  }
}

async function directusSeed(token) {
  const H = J(token);
  const mk = (collection, fields) =>
    req(`${DIRECTUS}/collections`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ collection, schema: {}, meta: { singleton: false }, fields })
    });

  const pk = { field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } };

  await mk(D_A, [pk, { field: 'name', type: 'string' }, { field: 'city', type: 'string' }]);
  await mk(D_TAG, [pk, { field: 'label', type: 'string' }]);
  await mk(D_ART, [pk, { field: 'title', type: 'string' }, { field: 'author', type: 'integer' }]);
  await mk(D_JUNC, [pk, { field: 'article_id', type: 'integer' }, { field: 'tag_id', type: 'integer' }]);

  // M2O + its O2M reverse. `meta.one_field` is what makes the reverse alias
  // exist on the authors side; without it Directus records the FK but there is
  // no `articles` field to include.
  const r1 = await req(`${DIRECTUS}/relations`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      collection: D_ART,
      field: 'author',
      related_collection: D_A,
      meta: { one_field: 'articles' }
    })
  });
  fact('POST /relations (M2O articles.author → authors)', r1.status);

  // M2M: an alias field on articles, plus the two junction relations.
  const alias = await req(`${DIRECTUS}/fields/${D_ART}`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ field: 'tags', type: 'alias', meta: { interface: 'list-m2m', special: ['m2m'] } })
  });
  fact('POST /fields (alias articles.tags)', alias.status);

  const r2 = await req(`${DIRECTUS}/relations`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      collection: D_JUNC,
      field: 'article_id',
      related_collection: D_ART,
      meta: { one_field: 'tags', junction_field: 'tag_id' }
    })
  });
  const r3 = await req(`${DIRECTUS}/relations`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      collection: D_JUNC,
      field: 'tag_id',
      related_collection: D_TAG,
      meta: { junction_field: 'article_id' }
    })
  });
  fact('POST /relations (junction → articles, → tags)', `${r2.status}, ${r3.status}`);

  const authors = await req(`${DIRECTUS}/items/${D_A}`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify([
      { name: 'Ada', city: 'London' },
      { name: 'Grace', city: 'New York' }
    ])
  });
  const authorIds = (authors.json?.data ?? []).map((r) => r.id);

  const tags = await req(`${DIRECTUS}/items/${D_TAG}`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify([{ label: 'algebra' }, { label: 'compilers' }])
  });
  const tagIds = (tags.json?.data ?? []).map((r) => r.id);

  const articles = await req(`${DIRECTUS}/items/${D_ART}`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify([
      { title: 'Notes on the Engine', author: authorIds[0] },
      { title: 'A Compiler Story', author: authorIds[1] }
    ])
  });
  const articleIds = (articles.json?.data ?? []).map((r) => r.id);

  return { authorIds, tagIds, articleIds };
}

async function probeDirectus() {
  head('DIRECTUS 11 — relations');
  const token = await directusLogin();
  if (!token) return say('  !! login failed');
  const H = J(token);

  await directusTeardown(token);
  const ids = await directusSeed(token);
  fact('seeded ids', ids);

  // ── A. metadata ─────────────────────────────────────────────────────────
  say('');
  say('  A. GET /relations');
  const rels = await req(`${DIRECTUS}/relations`, { headers: H });
  const mine = (rels.json?.data ?? []).filter((r) => r.collection?.startsWith('bcn005'));
  for (const r of mine) {
    say(
      `     ${r.collection}.${r.field} → ${r.related_collection}   ` +
        `meta{one_field:${JSON.stringify(r.meta?.one_field)}, junction_field:${JSON.stringify(r.meta?.junction_field)}, ` +
        `one_collection:${JSON.stringify(r.meta?.one_collection)}}`
    );
  }
  fact('rows for bcn005', mine.length);

  // What does GET /fields say about the alias, i.e. can M2M be seen without
  // /relations at all?
  const fields = await req(`${DIRECTUS}/fields/${D_ART}`, { headers: H });
  for (const f of fields.json?.data ?? []) {
    say(
      `     field ${f.field}: type=${f.type} special=${JSON.stringify(f.meta?.special)} ` +
        `fk=${JSON.stringify(f.schema?.foreign_key_table)}`
    );
  }

  // ── D. add ──────────────────────────────────────────────────────────────
  say('');
  say('  D. add a relation');
  const junc = await req(`${DIRECTUS}/items/${D_JUNC}`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ article_id: ids.articleIds[0], tag_id: ids.tagIds[0] })
  });
  fact('POST junction row', `${junc.status} ${JSON.stringify(junc.json?.data)}`);

  // The other spelling: PATCH the parent with the alias field.
  const viaAlias = await req(`${DIRECTUS}/items/${D_ART}/${ids.articleIds[0]}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ tags: { create: [{ tag_id: ids.tagIds[1] }], update: [], delete: [] } })
  });
  fact('PATCH parent with tags.create', viaAlias.status);

  // M2O: write the FK.
  const fk = await req(`${DIRECTUS}/items/${D_ART}/${ids.articleIds[1]}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ author: ids.authorIds[0] })
  });
  fact('PATCH FK (M2O add)', fk.status);

  // ── B. read ─────────────────────────────────────────────────────────────
  say('');
  say('  B. read the parent with the relation included');
  const readM2O = await req(`${DIRECTUS}/items/${D_ART}?fields=*,author.*&sort=id`, { headers: H });
  fact('fields=*,author.*', JSON.stringify(readM2O.json?.data));

  const readM2M = await req(`${DIRECTUS}/items/${D_ART}?fields=*,tags.*&sort=id`, { headers: H });
  fact('fields=*,tags.*', JSON.stringify(readM2M.json?.data?.[0]));

  const readM2MDeep = await req(`${DIRECTUS}/items/${D_ART}?fields=*,tags.tag_id.*&sort=id`, { headers: H });
  fact('fields=*,tags.tag_id.* (through the junction)', JSON.stringify(readM2MDeep.json?.data?.[0]));

  const readO2M = await req(`${DIRECTUS}/items/${D_A}?fields=*,articles.*&sort=id`, { headers: H });
  fact('O2M fields=*,articles.*', JSON.stringify(readO2M.json?.data?.[0]));

  // ── C. filter across ────────────────────────────────────────────────────
  say('');
  say('  C. filter on a dotted path');
  const nested = encodeURIComponent(JSON.stringify({ author: { city: { _eq: 'London' } } }));
  const f1 = await req(`${DIRECTUS}/items/${D_ART}?filter=${nested}&fields=id,title&sort=id`, { headers: H });
  fact('filter {author:{city:{_eq:London}}}', `${f1.status} ${JSON.stringify(f1.json?.data ?? f1.json?.errors?.[0]?.message)}`);

  const flat = encodeURIComponent(JSON.stringify({ 'author.city': { _eq: 'London' } }));
  const f2 = await req(`${DIRECTUS}/items/${D_ART}?filter=${flat}&fields=id,title`, { headers: H });
  fact('flat "author.city" (the RUN-003 403)', `${f2.status} ${(f2.json?.errors?.[0]?.message ?? '').slice(0, 90)}`);

  const m2m = encodeURIComponent(JSON.stringify({ tags: { tag_id: { label: { _eq: 'algebra' } } } }));
  const f3 = await req(`${DIRECTUS}/items/${D_ART}?filter=${m2m}&fields=id,title&sort=id`, { headers: H });
  fact('filter across M2M via junction', `${f3.status} ${JSON.stringify(f3.json?.data ?? f3.json?.errors?.[0]?.message)}`);

  // ── E. remove ───────────────────────────────────────────────────────────
  say('');
  say('  E. remove');
  const find = await req(
    `${DIRECTUS}/items/${D_JUNC}?filter=` +
      encodeURIComponent(JSON.stringify({ article_id: { _eq: ids.articleIds[0] }, tag_id: { _eq: ids.tagIds[0] } })),
    { headers: H }
  );
  fact('find junction row', JSON.stringify(find.json?.data));
  const rowId = find.json?.data?.[0]?.id;
  const del = await req(`${DIRECTUS}/items/${D_JUNC}/${rowId}`, { method: 'DELETE', headers: H });
  fact('DELETE junction row', del.status);
  const delMissing = await req(`${DIRECTUS}/items/${D_JUNC}/999999`, { method: 'DELETE', headers: H });
  fact('DELETE a junction row that never existed', delMissing.status);

  const after = await req(`${DIRECTUS}/items/${D_ART}?fields=*,tags.*&sort=id`, { headers: H });
  fact('after remove, article 1 tags', JSON.stringify(after.json?.data?.[0]?.tags));

  // M2O removal is nulling the FK.
  const nulled = await req(`${DIRECTUS}/items/${D_ART}/${ids.articleIds[1]}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ author: null })
  });
  fact('PATCH FK → null (M2O remove)', nulled.status);
}

// ── PostgREST ──────────────────────────────────────────────────────────────

const PGSQL = (sql) => ['exec', '-i', 'uba-e2e-supabase-db-1', 'psql', '-U', 'postgres', '-d', 'app', '-c', sql];

async function psql(sql) {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('docker', PGSQL(sql), { encoding: 'utf8' });
  return (r.stdout || '') + (r.stderr || '');
}

async function probePostgrest() {
  head('POSTGREST v12.2.3 (the Supabase wire) — relations');

  say('  seeding bcn005 tables …');
  await psql(`
    DROP TABLE IF EXISTS bcn005_articles_tags;
    DROP TABLE IF EXISTS bcn005_articles;
    DROP TABLE IF EXISTS bcn005_tags;
    DROP TABLE IF EXISTS bcn005_authors;
    CREATE TABLE bcn005_authors (id SERIAL PRIMARY KEY, name TEXT, city TEXT);
    CREATE TABLE bcn005_tags (id SERIAL PRIMARY KEY, label TEXT);
    CREATE TABLE bcn005_articles (id SERIAL PRIMARY KEY, title TEXT,
      author_id INTEGER REFERENCES bcn005_authors(id));
    CREATE TABLE bcn005_articles_tags (
      id SERIAL PRIMARY KEY,
      article_id INTEGER NOT NULL REFERENCES bcn005_articles(id),
      tag_id INTEGER NOT NULL REFERENCES bcn005_tags(id));
    GRANT SELECT, INSERT, UPDATE, DELETE ON bcn005_authors, bcn005_tags, bcn005_articles, bcn005_articles_tags TO web_anon;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO web_anon;
    INSERT INTO bcn005_authors (name, city) VALUES ('Ada','London'), ('Grace','New York');
    INSERT INTO bcn005_tags (label) VALUES ('algebra'), ('compilers');
    INSERT INTO bcn005_articles (title, author_id) VALUES ('Notes on the Engine', 1), ('A Compiler Story', 2);
    NOTIFY pgrst, 'reload schema';
  `);
  // PostgREST caches the schema; the NOTIFY above is the documented reload.
  await new Promise((r) => setTimeout(r, 1500));

  // ── A. metadata ─────────────────────────────────────────────────────────
  say('');
  say('  A. the OpenAPI spec is the only relation metadata');
  const spec = await req(`${POSTGREST}/`);
  const defs = spec.json?.definitions ?? {};
  for (const name of Object.keys(defs).filter((n) => n.startsWith('bcn005'))) {
    const props = defs[name].properties ?? {};
    for (const [field, def] of Object.entries(props)) {
      const fk = /<fk table='([^']+)' column='([^']*)'\/>/.exec(def.description ?? '');
      const pkFlag = (def.description ?? '').includes('<pk/>');
      if (fk || pkFlag) say(`     ${name}.${field}  ${pkFlag ? 'PK' : ''}${fk ? `FK → ${fk[1]}.${fk[2]}` : ''}`);
    }
  }
  fact(
    'reverse (O2M) or junction described anywhere?',
    JSON.stringify(Object.keys(defs).filter((n) => n.startsWith('bcn005')))
  );

  // ── B. read ─────────────────────────────────────────────────────────────
  say('');
  say('  B. embeds');
  const m2o = await req(`${POSTGREST}/bcn005_articles?select=*,bcn005_authors(*)&order=id`);
  fact('select=*,bcn005_authors(*)', `${m2o.status} ${m2o.text.slice(0, 220)}`);

  const m2oAlias = await req(`${POSTGREST}/bcn005_articles?select=*,author:bcn005_authors(*)&order=id`);
  fact('aliased embed author:bcn005_authors(*)', `${m2oAlias.status} ${m2oAlias.text.slice(0, 200)}`);

  const byFk = await req(`${POSTGREST}/bcn005_articles?select=*,author_id(*)&order=id`);
  fact('embed named by the FK COLUMN, author_id(*)', `${byFk.status} ${byFk.text.slice(0, 200)}`);

  const o2m = await req(`${POSTGREST}/bcn005_authors?select=*,bcn005_articles(*)&order=id`);
  fact('O2M select=*,bcn005_articles(*)', `${o2m.status} ${o2m.text.slice(0, 220)}`);

  const m2m = await req(`${POSTGREST}/bcn005_articles?select=*,bcn005_tags(*)&order=id`);
  fact('M2M through the junction, bcn005_tags(*)', `${m2m.status} ${m2m.text.slice(0, 240)}`);

  // ── D. add ──────────────────────────────────────────────────────────────
  say('');
  say('  D. add');
  const ins = await req(`${POSTGREST}/bcn005_articles_tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ article_id: 1, tag_id: 1 })
  });
  fact('POST junction row', `${ins.status} ${ins.text.slice(0, 140)}`);

  const dup = await req(`${POSTGREST}/bcn005_articles_tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ article_id: 1, tag_id: 1 })
  });
  fact('POST the SAME pair twice (no unique constraint)', `${dup.status} ${dup.text.slice(0, 140)}`);

  const patchFk = await req(`${POSTGREST}/bcn005_articles?id=eq.2`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ author_id: 1 })
  });
  fact('PATCH FK (M2O add)', `${patchFk.status} ${patchFk.text.slice(0, 140)}`);

  const m2mAfter = await req(`${POSTGREST}/bcn005_articles?select=id,title,bcn005_tags(*)&order=id`);
  fact('M2M after add', `${m2mAfter.status} ${m2mAfter.text.slice(0, 260)}`);

  // ── C. filter ───────────────────────────────────────────────────────────
  say('');
  say('  C. filter across the relation');
  const noEmbed = await req(`${POSTGREST}/bcn005_articles?select=id,title&bcn005_authors.city=eq.London&order=id`);
  fact('dotted filter with NO embed selected', `${noEmbed.status} ${noEmbed.text.slice(0, 220)}`);

  const plainEmbed = await req(
    `${POSTGREST}/bcn005_articles?select=id,title,bcn005_authors(*)&bcn005_authors.city=eq.London&order=id`
  );
  fact('with a PLAIN embed (does it narrow the parent?)', `${plainEmbed.status} ${plainEmbed.text.slice(0, 300)}`);

  const innerEmbed = await req(
    `${POSTGREST}/bcn005_articles?select=id,title,bcn005_authors!inner(*)&bcn005_authors.city=eq.London&order=id`
  );
  fact('with an !inner embed', `${innerEmbed.status} ${innerEmbed.text.slice(0, 300)}`);

  const m2mFilter = await req(
    `${POSTGREST}/bcn005_articles?select=id,title,bcn005_tags!inner(*)&bcn005_tags.label=eq.algebra&order=id`
  );
  fact('M2M !inner filter', `${m2mFilter.status} ${m2mFilter.text.slice(0, 260)}`);

  // ── E. remove ───────────────────────────────────────────────────────────
  say('');
  say('  E. remove');
  const del = await req(`${POSTGREST}/bcn005_articles_tags?article_id=eq.1&tag_id=eq.1`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' }
  });
  fact('DELETE by the pair', `${del.status} ${del.text.slice(0, 200)}`);

  const delMissing = await req(`${POSTGREST}/bcn005_articles_tags?article_id=eq.99&tag_id=eq.99`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' }
  });
  fact('DELETE a pair that never existed', `${delMissing.status} ${delMissing.text.slice(0, 200)}`);

  const nulled = await req(`${POSTGREST}/bcn005_articles?id=eq.2`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ author_id: null })
  });
  fact('PATCH FK → null (M2O remove)', `${nulled.status} ${nulled.text.slice(0, 140)}`);
}

// ── PocketBase ─────────────────────────────────────────────────────────────

async function pbLogin() {
  const r = await req(`${POCKETBASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(PB_ADMIN)
  });
  return r.json?.token;
}

async function probePocketbase() {
  head('POCKETBASE 0.30.0 — relations (first contact: never exercised before)');
  const token = await pbLogin();
  if (!token) return say('  !! admin login failed — is the pocketbase profile up?');
  const H = J(token, false);

  // teardown
  for (const name of ['bcn005_articles', 'bcn005_tags', 'bcn005_authors']) {
    await req(`${POCKETBASE}/api/collections/${name}`, { method: 'DELETE', headers: H });
  }

  const mk = (body) => req(`${POCKETBASE}/api/collections`, { method: 'POST', headers: H, body: JSON.stringify(body) });

  const authors = await mk({
    name: 'bcn005_authors',
    type: 'base',
    fields: [
      { name: 'name', type: 'text' },
      { name: 'city', type: 'text' }
    ],
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: ''
  });
  fact('create bcn005_authors', `${authors.status} ${authors.status >= 300 ? authors.text.slice(0, 200) : ''}`);
  const tags = await mk({
    name: 'bcn005_tags',
    type: 'base',
    fields: [{ name: 'label', type: 'text' }],
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: ''
  });
  fact('create bcn005_tags', tags.status);

  const authorsId = authors.json?.id;
  const tagsId = tags.json?.id;

  const articles = await mk({
    name: 'bcn005_articles',
    type: 'base',
    fields: [
      { name: 'title', type: 'text' },
      { name: 'author', type: 'relation', collectionId: authorsId, maxSelect: 1, cascadeDelete: false },
      { name: 'tags', type: 'relation', collectionId: tagsId, maxSelect: 99, cascadeDelete: false }
    ],
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: ''
  });
  fact('create bcn005_articles', `${articles.status} ${articles.status >= 300 ? articles.text.slice(0, 300) : ''}`);

  // ── A. metadata ─────────────────────────────────────────────────────────
  say('');
  say('  A. GET /api/collections — what a relation field looks like');
  const list = await req(`${POCKETBASE}/api/collections?perPage=200`, { headers: H });
  const article = (list.json?.items ?? []).find((c) => c.name === 'bcn005_articles');
  fact('does the collection carry `schema` (the parser reads this)?', article ? 'schema' in article : 'n/a');
  fact('does it carry `fields`?', article ? 'fields' in article : 'n/a');
  for (const f of article?.fields ?? article?.schema ?? []) {
    say(
      `     field ${f.name}: type=${f.type} collectionId=${JSON.stringify(f.collectionId ?? f.options?.collectionId)} ` +
        `maxSelect=${JSON.stringify(f.maxSelect ?? f.options?.maxSelect)}`
    );
  }
  fact('is the target named by id or by name?', 'see collectionId above vs ' + JSON.stringify({ authorsId, tagsId }));

  // seed rows
  const mkRec = (c, data) =>
    req(`${POCKETBASE}/api/collections/${c}/records`, { method: 'POST', headers: H, body: JSON.stringify(data) });
  const ada = await mkRec('bcn005_authors', { name: 'Ada', city: 'London' });
  const grace = await mkRec('bcn005_authors', { name: 'Grace', city: 'New York' });
  const alg = await mkRec('bcn005_tags', { label: 'algebra' });
  const comp = await mkRec('bcn005_tags', { label: 'compilers' });
  const a1 = await mkRec('bcn005_articles', { title: 'Notes on the Engine', author: ada.json?.id });
  const a2 = await mkRec('bcn005_articles', { title: 'A Compiler Story', author: grace.json?.id });
  fact('seeded', {
    ada: ada.json?.id,
    grace: grace.json?.id,
    alg: alg.json?.id,
    comp: comp.json?.id,
    a1: a1.json?.id,
    a2: a2.json?.id
  });

  // ── D. add ──────────────────────────────────────────────────────────────
  say('');
  say('  D. add to a multi-valued relation');
  const plus = await req(`${POCKETBASE}/api/collections/bcn005_articles/records/${a1.json?.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ 'tags+': alg.json?.id })
  });
  fact('PATCH {"tags+": id} — is the append operator real?', `${plus.status} ${plus.text.slice(0, 200)}`);

  const plus2 = await req(`${POCKETBASE}/api/collections/bcn005_articles/records/${a1.json?.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ 'tags+': comp.json?.id })
  });
  fact('append a second', `${plus2.status} ${JSON.stringify(plus2.json?.tags)}`);

  const plusDup = await req(`${POCKETBASE}/api/collections/bcn005_articles/records/${a1.json?.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ 'tags+': alg.json?.id })
  });
  fact('append one that is ALREADY there', `${plusDup.status} ${JSON.stringify(plusDup.json?.tags)}`);

  const single = await req(`${POCKETBASE}/api/collections/bcn005_articles/records/${a2.json?.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ 'author+': ada.json?.id })
  });
  fact('"+" on a SINGLE-valued relation (maxSelect 1)', `${single.status} ${single.text.slice(0, 200)}`);

  // ── B. read ─────────────────────────────────────────────────────────────
  say('');
  say('  B. expand');
  const exp = await req(`${POCKETBASE}/api/collections/bcn005_articles/records?expand=author,tags&sort=title`, {
    headers: H
  });
  fact('expand=author,tags', `${exp.status} ${exp.text.slice(0, 500)}`);

  const noExpand = await req(`${POCKETBASE}/api/collections/bcn005_articles/records?sort=title`, { headers: H });
  fact('without expand', noExpand.text.slice(0, 300));

  const backRel = await req(`${POCKETBASE}/api/collections/bcn005_authors/records?expand=bcn005_articles_via_author`, {
    headers: H
  });
  fact('back-relation expand (O2M)', `${backRel.status} ${backRel.text.slice(0, 320)}`);

  // ── C. filter ───────────────────────────────────────────────────────────
  say('');
  say('  C. filter across the relation');
  const f1 = await req(
    `${POCKETBASE}/api/collections/bcn005_articles/records?filter=${encodeURIComponent("author.city='London'")}`,
    { headers: H }
  );
  fact("filter author.city='London'", `${f1.status} ${f1.text.slice(0, 260)}`);

  const f2 = await req(
    `${POCKETBASE}/api/collections/bcn005_articles/records?filter=${encodeURIComponent("tags.label='algebra'")}`,
    { headers: H }
  );
  fact("filter tags.label='algebra' (multi-valued)", `${f2.status} ${f2.text.slice(0, 260)}`);

  // ── E. remove ───────────────────────────────────────────────────────────
  say('');
  say('  E. remove');
  const minus = await req(`${POCKETBASE}/api/collections/bcn005_articles/records/${a1.json?.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ 'tags-': alg.json?.id })
  });
  fact('PATCH {"tags-": id}', `${minus.status} ${JSON.stringify(minus.json?.tags)}`);

  const minusMissing = await req(`${POCKETBASE}/api/collections/bcn005_articles/records/${a1.json?.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ 'tags-': alg.json?.id })
  });
  fact('remove one that is NOT there', `${minusMissing.status} ${JSON.stringify(minusMissing.json?.tags)}`);

  const minusSingle = await req(`${POCKETBASE}/api/collections/bcn005_articles/records/${a2.json?.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ 'author-': grace.json?.id })
  });
  fact('"-" on a single-valued relation', `${minusSingle.status} ${minusSingle.text.slice(0, 200)}`);
}

// ── main ───────────────────────────────────────────────────────────────────

(async () => {
  say('BCN-005 relation wire probe — ' + new Date().toISOString());
  try {
    await probeDirectus();
  } catch (e) {
    say('  !! directus section threw: ' + e);
  }
  try {
    await probePostgrest();
  } catch (e) {
    say('  !! postgrest section threw: ' + e);
  }
  try {
    await probePocketbase();
  } catch (e) {
    say('  !! pocketbase section threw: ' + e);
  }
  say('');
  say('done.');
})();
