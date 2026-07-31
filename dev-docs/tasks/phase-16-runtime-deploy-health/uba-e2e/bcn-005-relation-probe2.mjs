/**
 * BCN-005 relation probe, round two — the questions round one left ambiguous.
 *
 * Round one (`bcn-005-relation-probe.mjs`) wrote before it read, so three of
 * its checks ran against data its own writes had made uniform and could not
 * have discriminated. It also asked PostgREST for an M2M embed through a
 * junction with a surrogate `id` primary key and got `PGRST200`. This round
 * fixes the ordering and asks the follow-up questions:
 *
 *  1. Directus O2M read — round one printed `undefined` with no status.
 *  2. PostgREST M2M through a junction whose **primary key is the pair**.
 *  3. PostgREST `!inner` versus a plain embed, on data where they differ.
 *  4. Directus nested filter, on data where it differs.
 *  5. PocketBase `=` versus `?=` on a multi-valued relation path.
 *  6. PocketBase `+`/`-` against a single-valued relation, both directions.
 *  7. Whether relation metadata is readable **without an admin token** — the
 *     runtime does not have one.
 */

const DIRECTUS = 'http://localhost:8055';
const POSTGREST = 'http://localhost:8056';
const POCKETBASE = 'http://localhost:8091';

function say(l = '') {
  console.log(l);
}
function head(t) {
  say('');
  say('='.repeat(74));
  say(t);
  say('='.repeat(74));
}
function fact(l, v) {
  say(`  · ${l}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
}

async function req(url, init = {}) {
  const r = await fetch(url, init);
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /**/
  }
  return { status: r.status, text, json };
}

const J = (t, bearer = true) => ({
  'Content-Type': 'application/json',
  ...(t ? { Authorization: bearer ? `Bearer ${t}` : t } : {})
});

async function psql(sql) {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('docker', ['exec', '-i', 'uba-e2e-supabase-db-1', 'psql', '-U', 'postgres', '-d', 'app', '-c', sql], {
    encoding: 'utf8'
  });
  return (r.stdout || '') + (r.stderr || '');
}

// ── 1, 4, 7: Directus ──────────────────────────────────────────────────────

async function directus() {
  head('DIRECTUS — O2M read, a discriminating filter, and the unauthenticated case');
  const login = await req(`${DIRECTUS}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'directus-admin-pw' })
  });
  const token = login.json?.data?.access_token;
  const H = J(token);

  // Restore discriminating data: article 1 → Ada (London), article 2 → Grace (New York)
  await req(`${DIRECTUS}/items/bcn005_articles/1`, { method: 'PATCH', headers: H, body: JSON.stringify({ author: 1 }) });
  await req(`${DIRECTUS}/items/bcn005_articles/2`, { method: 'PATCH', headers: H, body: JSON.stringify({ author: 2 }) });

  say('');
  say('  1. O2M read, with the status this time');
  const o2m = await req(`${DIRECTUS}/items/bcn005_authors?fields=*,articles.*&sort=id`, { headers: H });
  fact('GET authors?fields=*,articles.*', `${o2m.status} ${o2m.text.slice(0, 340)}`);

  const o2mAlias = await req(`${DIRECTUS}/fields/bcn005_authors`, { headers: H });
  fact(
    'authors fields (is the reverse alias there?)',
    JSON.stringify((o2mAlias.json?.data ?? []).map((f) => `${f.field}:${f.type}:${JSON.stringify(f.meta?.special)}`))
  );

  say('');
  say('  4. nested filter on discriminating data (a1=Ada/London, a2=Grace/New York)');
  const nested = encodeURIComponent(JSON.stringify({ author: { city: { _eq: 'London' } } }));
  const f = await req(`${DIRECTUS}/items/bcn005_articles?filter=${nested}&fields=id,title&sort=id`, { headers: H });
  fact('filter {author:{city:{_eq:London}}}', `${f.status} ${JSON.stringify(f.json?.data)}`);

  say('');
  say('  M2M include: what a one-hop `tags.*` returns versus `tags.tag_id.*`');
  const oneHop = await req(`${DIRECTUS}/items/bcn005_articles/1?fields=*,tags.*`, { headers: H });
  fact('one hop  tags.*', oneHop.text.slice(0, 220));
  const twoHop = await req(`${DIRECTUS}/items/bcn005_articles/1?fields=*,tags.tag_id.*`, { headers: H });
  fact('two hops tags.tag_id.*', twoHop.text.slice(0, 260));

  say('');
  say('  7. relation metadata without a token');
  const anon = await req(`${DIRECTUS}/relations`);
  fact('GET /relations unauthenticated', `${anon.status} ${anon.text.slice(0, 160)}`);
  const anonFields = await req(`${DIRECTUS}/fields/bcn005_articles`);
  fact('GET /fields unauthenticated', `${anonFields.status} ${anonFields.text.slice(0, 160)}`);
  const scoped = await req(`${DIRECTUS}/relations/bcn005_articles`, { headers: H });
  fact('GET /relations/{collection} (scoped, admin)', `${scoped.status} ${scoped.text.slice(0, 300)}`);
}

// ── 2, 3: PostgREST ────────────────────────────────────────────────────────

async function postgrest() {
  head('POSTGREST — the junction primary key, and !inner on discriminating data');

  say('  2. rebuild the junction with the PAIR as the primary key');
  const out = await psql(`
    DROP TABLE IF EXISTS bcn005_articles_tags;
    CREATE TABLE bcn005_articles_tags (
      article_id INTEGER NOT NULL REFERENCES bcn005_articles(id),
      tag_id INTEGER NOT NULL REFERENCES bcn005_tags(id),
      PRIMARY KEY (article_id, tag_id));
    GRANT SELECT, INSERT, UPDATE, DELETE ON bcn005_articles_tags TO web_anon;
    UPDATE bcn005_articles SET author_id = 1 WHERE id = 1;
    UPDATE bcn005_articles SET author_id = 2 WHERE id = 2;
    INSERT INTO bcn005_articles_tags VALUES (1,1);
    NOTIFY pgrst, 'reload schema';
  `);
  if (/ERROR/.test(out)) say('     psql: ' + out.split('\n').filter((l) => /ERROR/.test(l)).join(' | '));
  await new Promise((r) => setTimeout(r, 1500));

  const m2m = await req(`${POSTGREST}/bcn005_articles?select=id,title,bcn005_tags(*)&order=id`);
  fact('M2M embed with a COMPOSITE-PK junction', `${m2m.status} ${m2m.text.slice(0, 300)}`);

  const m2mVia = await req(`${POSTGREST}/bcn005_articles?select=id,title,bcn005_articles_tags(bcn005_tags(*))&order=id`);
  fact('explicit two-hop through the junction', `${m2mVia.status} ${m2mVia.text.slice(0, 300)}`);

  say('');
  say('  3. !inner versus a plain embed (a1→Ada/London, a2→Grace/New York)');
  const plain = await req(`${POSTGREST}/bcn005_articles?select=id,title,bcn005_authors(*)&bcn005_authors.city=eq.London&order=id`);
  fact('PLAIN embed + a filter on it', `${plain.status} ${plain.text.replace(/\s+/g, ' ').slice(0, 300)}`);
  const inner = await req(
    `${POSTGREST}/bcn005_articles?select=id,title,bcn005_authors!inner(*)&bcn005_authors.city=eq.London&order=id`
  );
  fact('!inner embed + the same filter', `${inner.status} ${inner.text.replace(/\s+/g, ' ').slice(0, 300)}`);

  const m2mInner = await req(
    `${POSTGREST}/bcn005_articles?select=id,title,bcn005_tags!inner(*)&bcn005_tags.label=eq.algebra&order=id`
  );
  fact('M2M !inner filter, composite-PK junction', `${m2mInner.status} ${m2mInner.text.replace(/\s+/g, ' ').slice(0, 300)}`);

  say('');
  say('  duplicate add against a composite PK');
  const dup = await req(`${POSTGREST}/bcn005_articles_tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ article_id: 1, tag_id: 1 })
  });
  fact('POST an existing pair', `${dup.status} ${dup.text.slice(0, 220)}`);
  const upsert = await req(`${POSTGREST}/bcn005_articles_tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify({ article_id: 1, tag_id: 1 })
  });
  fact('POST with resolution=merge-duplicates (upsert)', `${upsert.status} ${upsert.text.slice(0, 220)}`);

  say('');
  say('  the OpenAPI spec after the PK change — is the junction any more visible?');
  const spec = await req(`${POSTGREST}/`);
  const def = spec.json?.definitions?.bcn005_articles_tags;
  fact('junction definition', JSON.stringify(def).slice(0, 400));
}

// ── 5, 6: PocketBase ───────────────────────────────────────────────────────

async function pocketbase() {
  head('POCKETBASE — ?= versus =, and + / - on a single-valued relation');
  const login = await req(`${POCKETBASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'admin@example.com', password: 'pocketbase-admin-pw' })
  });
  const H = J(login.json?.token, false);

  const cols = await req(`${POCKETBASE}/api/collections?perPage=200`, { headers: H });
  const byName = Object.fromEntries((cols.json?.items ?? []).map((c) => [c.name, c]));
  const arts = await req(`${POCKETBASE}/api/collections/bcn005_articles/records?sort=title`, { headers: H });
  const authors = await req(`${POCKETBASE}/api/collections/bcn005_authors/records?sort=name`, { headers: H });
  const tags = await req(`${POCKETBASE}/api/collections/bcn005_tags/records?sort=label`, { headers: H });
  const a = Object.fromEntries((arts.json?.items ?? []).map((r) => [r.title, r.id]));
  const au = Object.fromEntries((authors.json?.items ?? []).map((r) => [r.name, r.id]));
  const tg = Object.fromEntries((tags.json?.items ?? []).map((r) => [r.label, r.id]));
  fact('ids', { a, au, tg });

  const patch = (id, body) =>
    req(`${POCKETBASE}/api/collections/bcn005_articles/records/${id}`, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify(body)
    });

  // Restore discriminating data.
  await patch(a['Notes on the Engine'], { author: au.Ada, tags: [tg.algebra, tg.compilers] });
  await patch(a['A Compiler Story'], { author: au.Grace, tags: [] });

  say('');
  say('  5. filter across a MULTI-valued relation');
  for (const expr of ["tags.label='algebra'", "tags.label?='algebra'", "tags.label~'alge'", "tags.label?~'alge'"]) {
    const r = await req(
      `${POCKETBASE}/api/collections/bcn005_articles/records?filter=${encodeURIComponent(expr)}&fields=title`,
      { headers: H }
    );
    fact(`filter ${expr}`, `${r.status} ${JSON.stringify(r.json?.items ?? r.json)}`);
  }

  say('');
  say('  and across a SINGLE-valued one (a1→Ada/London, a2→Grace/New York)');
  for (const expr of ["author.city='London'", "author.city?='London'"]) {
    const r = await req(
      `${POCKETBASE}/api/collections/bcn005_articles/records?filter=${encodeURIComponent(expr)}&fields=title`,
      { headers: H }
    );
    fact(`filter ${expr}`, `${r.status} ${JSON.stringify(r.json?.items ?? r.json)}`);
  }

  say('');
  say('  6. + and - on a single-valued relation (maxSelect 1)');
  const before = await req(`${POCKETBASE}/api/collections/bcn005_articles/records/${a['A Compiler Story']}`, { headers: H });
  fact('before', before.json?.author);
  const plus = await patch(a['A Compiler Story'], { 'author+': au.Ada });
  fact('"author+": Ada while author is Grace', `${plus.status} author=${JSON.stringify(plus.json?.author)}`);
  const minus = await patch(a['A Compiler Story'], { 'author-': plus.json?.author });
  fact('"author-": the current value', `${minus.status} author=${JSON.stringify(minus.json?.author)}`);
  const minusWrong = await patch(a['A Compiler Story'], { 'author-': au.Grace });
  fact('"author-": a value that is not set', `${minusWrong.status} author=${JSON.stringify(minusWrong.json?.author)}`);

  say('');
  say('  does + on a multi-valued field respect maxSelect?');
  const cap = await patch(a['Notes on the Engine'], { 'tags+': tg.algebra });
  fact('append a duplicate (set semantics?)', `${cap.status} ${JSON.stringify(cap.json?.tags)}`);

  say('');
  say('  7. relation metadata without an admin token');
  const anon = await req(`${POCKETBASE}/api/collections?perPage=200`);
  fact('GET /api/collections unauthenticated', `${anon.status} ${anon.text.slice(0, 160)}`);

  say('');
  say('  what the collection field entry looks like in full (the parser input)');
  fact('bcn005_articles.fields', JSON.stringify(byName.bcn005_articles?.fields));
}

(async () => {
  say('BCN-005 relation probe round 2 — ' + new Date().toISOString());
  for (const [name, fn] of [
    ['directus', directus],
    ['postgrest', postgrest],
    ['pocketbase', pocketbase]
  ]) {
    try {
      await fn();
    } catch (e) {
      say(`  !! ${name} threw: ${e}`);
    }
  }
  say('');
  say('done.');
})();
