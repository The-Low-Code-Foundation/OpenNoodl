/**
 * RUN-003 slice 4 — verifies the REAL parseSupabaseSchema against a live
 * PostgREST-served OpenAPI spec (Supabase's /rest/v1/ root serves exactly this
 * document; PostgREST *is* Supabase's REST layer). Also exercises the query
 * path shape (PostgREST filter syntax) the Supabase preset assumes.
 *
 * Run (stack up first: docker compose --profile supabase up -d):
 *   node build-byob.mjs supabase && node supabase-driver.cjs
 */
import { parseSupabaseSchema } from '../../../../packages/noodl-editor/src/editor/src/models/BackendServices/schemaParsers';
import { supabasePreset } from '../../../../packages/noodl-editor/src/editor/src/models/BackendServices/presets';

const BASE = 'http://localhost:8056'; // PostgREST; Supabase equivalent is <project>/rest/v1
const hr = (s: string) => console.log('\n' + '─'.repeat(78) + '\n' + s + '\n' + '─'.repeat(78));

async function main() {
  // ── A: REAL parseSupabaseSchema on a live OpenAPI spec ─────────────────────
  hr('A — REAL parseSupabaseSchema on live PostgREST OpenAPI (what Supabase serves)');
  const specRes = await fetch(`${BASE}/`, { headers: { Accept: 'application/openapi+json' } });
  const spec = await specRes.json();
  console.log(`OpenAPI fetched: HTTP ${specRes.status}, ${Object.keys(spec.definitions || {}).length} definitions`);

  const schema = parseSupabaseSchema(spec);
  for (const c of schema.collections) {
    console.log(`\n  collection "${c.name}" (pk=${c.primaryKey}):`);
    for (const f of c.fields) console.log(`    - ${f.name}: type=${f.type} native=${f.nativeType}`);
  }

  const articles = schema.collections.find((c) => c.name === 'articles');
  const status = articles?.fields.find((f) => f.name === 'status');
  const featured = articles?.fields.find((f) => f.name === 'featured');
  const authorId = articles?.fields.find((f) => f.name === 'author_id');
  console.log(
    `\n→ Parser: ${schema.collections.length >= 2 ? 'WORKS' : 'FAILED'} ` +
      `(collections=${schema.collections.map((c) => c.name).join(',')}).`
  );
  console.log(`  boolean mapped: ${featured?.type === 'boolean'}`);
  console.log(
    `  enum (postgres ENUM "article_status"): enumValues=${JSON.stringify(status?.enumValues)} ` +
      `default=${JSON.stringify(status?.defaultValue)} → ${status?.enumValues ? 'WORKS' : 'FAILED'}`
  );
  console.log(`  pk from <pk/> annotation: articles.primaryKey=${articles?.primaryKey} → ${articles?.primaryKey === 'id' ? 'WORKS' : 'FAILED'}`);
  console.log(
    `  M2O from <fk/> annotation: author_id → ${authorId?.relationTarget} (${authorId?.relationType}) → ${
      authorId?.relationTarget === 'authors' ? 'WORKS' : 'FAILED'
    }`
  );
  console.log(`  required from required[]: title=${articles?.fields.find((f) => f.name === 'title')?.required}`);

  // ── B: the preset's query shape against live PostgREST ─────────────────────
  hr('B — Supabase preset endpoints + PostgREST filter syntax, live');
  console.log('preset list endpoint:', supabasePreset.endpoints.list, '| dataPath:', JSON.stringify(supabasePreset.responseConfig.dataPath));
  // Supabase preset: /rest/v1/{table}; our PostgREST base has no /rest/v1 prefix,
  // so substitute the table the same way byob nodes template the path.
  const listPath = '/{table}'.replace('{table}', 'articles');
  const q = await fetch(`${BASE}${listPath}?status=eq.published&limit=10`);
  const rows = await q.json();
  console.log(`GET ${listPath}?status=eq.published → HTTP ${q.status}, ${Array.isArray(rows) ? rows.length : '?'} row(s)`);
  console.log('  first row title:', rows?.[0]?.title);
  console.log(
    `\n→ Query path: ${q.ok && Array.isArray(rows) && rows.length ? 'WORKS' : 'FAILED'} — response is a BARE ARRAY, ` +
      `matching the preset's dataPath "" (Directus-style {data:[…]} unwrap must NOT be applied).`
  );
}

main().catch((e) => {
  console.error('DRIVER ERROR:', e);
  process.exit(1);
});
