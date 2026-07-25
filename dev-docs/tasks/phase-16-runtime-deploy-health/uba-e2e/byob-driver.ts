/**
 * RUN-003 BYOB reality check — drives the REAL BackendServices introspection
 * and the REAL byob-utils runtime helpers against live Directus, establishing
 * that the already-built BYOB adapter works (see ../RUN-003-ASSESSMENT.md
 * correction box). Recorded run: BYOB-CONTACT-OUTPUT.txt.
 *
 * Build + run (Directus up + seeded first, see README.md):
 *   node build-byob.mjs && node byob-driver.cjs
 *
 * The editor/runtime sources bundle standalone with three tiny stubs:
 * stub-projectmodel.js / stub-model.js (BackendServices' editor deps, unused by
 * the parsers) and stub-noodl-runtime.js (byob-utils' runtime singleton,
 * redirected by a resolve plugin in build-byob.mjs so metadata is injectable).
 */
import { BackendServices } from '../../../../packages/noodl-editor/src/editor/src/models/BackendServices/BackendServices';
import { directusPreset } from '../../../../packages/noodl-editor/src/editor/src/models/BackendServices/presets';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const byobUtils = require('../../../../packages/noodl-runtime/src/nodes/std-library/data/byob-utils.js');
// Same module instance byob-utils resolves to (via the build plugin):
// eslint-disable-next-line @typescript-eslint/no-var-requires
const NoodlRuntime = require('./stub-noodl-runtime.js');

const BASE = 'http://localhost:8055';
const hr = (s: string) => console.log('\n' + '─'.repeat(78) + '\n' + s + '\n' + '─'.repeat(78));

async function login(): Promise<string> {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'directus-admin-pw' })
  });
  const b = await r.json();
  return b.data.access_token;
}

async function main() {
  const token = await login();

  // ── A: REAL editor introspection (BackendServices.parseDirectusSchema) ──────
  hr('A — REAL BackendServices introspection of live Directus /fields');
  const fieldsRes = await fetch(`${BASE}/fields`, { headers: { Authorization: `Bearer ${token}` } });
  const fieldsDoc = await fieldsRes.json();
  const bs = new BackendServices();
  // parseSchemaResponse is private; reach it the way fetchSchema does, via the type dispatch
  const parsed = (bs as any).parseSchemaResponse('directus', fieldsDoc);
  const userColls = parsed.collections.filter((c: any) => !c.name.startsWith('directus_'));
  console.log(`Parsed ${parsed.collections.length} collections (${userColls.length} user).`);
  for (const c of userColls) {
    console.log(`\n  collection "${c.name}" (pk=${c.primaryKey}):`);
    for (const f of c.fields) {
      const extra = [
        f.primaryKey ? 'PK' : '',
        f.required ? 'required' : '',
        f.enumValues ? `enum[${f.enumValues.join(',')}]` : '',
        f.relationTarget ? `→${f.relationTarget}` : ''
      ]
        .filter(Boolean)
        .join(' ');
      console.log(`    - ${f.name}: type=${f.type}${extra ? '  ' + extra : ''}`);
    }
  }
  const articles = userColls.find((c: any) => c.name === 'articles');
  const hasRelation = articles?.fields.some((f: any) => f.relationTarget);
  console.log(
    `\n→ Introspection: ${userColls.length >= 2 ? 'WORKS' : 'FAILED'}. ` +
      `Enum parsed: ${!!articles?.fields.find((f: any) => f.enumValues)}. ` +
      `Relations parsed: ${hasRelation ? 'yes' : 'NO (gap — foreign_key_table not read)'}.`
  );

  // ── B: REAL byob-utils runtime helpers (resolveBackend/buildUrl/headers) ────
  hr('B — REAL byob-utils runtime query path against live Directus');
  // seed the runtime metadata the way the editor would persist it
  const backendId = 'backend_test';
  NoodlRuntime.instance.__setMeta('backendServices', {
    activeBackendId: backendId,
    backends: [
      {
        id: backendId,
        type: 'directus',
        url: BASE,
        auth: { method: 'bearer', publicToken: token },
        endpoints: directusPreset.endpoints
      }
    ]
  });
  const resolved = byobUtils.resolveBackend('_active_');
  console.log(
    'resolveBackend(_active_):',
    resolved ? `url=${resolved.url} type=${resolved.type} hasToken=${!!resolved.token}` : 'NULL'
  );
  const url = byobUtils.buildUrl(resolved, 'articles', 'items');
  const headers = byobUtils.buildHeaders(resolved.token);
  console.log('buildUrl → ' + url);

  // create a record (mirrors byob-create-record) then query it (mirrors byob-query-data)
  const createRes = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: 'RUN-003 smoke', status: 'published', rating: 5 })
  });
  const created = await createRes.json();
  console.log(`CREATE items/articles → HTTP ${createRes.status}, id=${created?.data?.id}`);

  const filter = encodeURIComponent(JSON.stringify({ status: { _eq: 'published' } }));
  const queryRes = await fetch(`${url}?filter=${filter}&limit=10`, { headers });
  const queried = await queryRes.json();
  console.log(
    `QUERY items/articles?filter={status=published} → HTTP ${queryRes.status}, ${queried?.data?.length ?? 0} record(s)`
  );
  console.log('  first record title:', queried?.data?.[0]?.title);
  console.log(`\n→ Runtime CRUD path: ${queryRes.ok && queried?.data?.length ? 'WORKS end-to-end' : 'FAILED'}.`);

  // ── C: field→port mapping (the "see the fields" UX core) ─────────────────────
  hr('C — REAL getEnhancedFieldType (field → Noodl port type)');
  const rawFields = fieldsDoc.data.filter((f: any) => f.collection === 'articles');
  for (const f of rawFields) {
    const pt = byobUtils.getEnhancedFieldType(f);
    const t =
      typeof pt.type === 'object' ? `${pt.type.name}(${pt.type.enums?.map((e: any) => e.value).join(',')})` : pt.type;
    console.log(`    ${f.field} (${f.type}/${f.meta?.interface || '-'}) → port ${t}`);
  }
}
main().catch((e) => {
  console.error('DRIVER ERROR:', e);
  process.exit(1);
});
