/**
 * RUN-003 first-contact driver — drives the REAL UBAClient + SchemaParser
 * against a live containerised Directus, to record empirically what breaks.
 *
 * Both UBA source files import only `import type`, so esbuild bundles them as
 * standalone modules (types erased) — no editor/Electron runtime is needed.
 *
 * Build + run:
 *   docker compose up -d && (wait for http://localhost:8055/server/health = 200)
 *   node seed.mjs
 *   ../../../../node_modules/.bin/esbuild driver.ts --bundle --platform=node \
 *     --format=cjs --target=node22 --outfile=driver.cjs
 *   node driver.cjs
 *
 * The recorded output is in FIRST-CONTACT-OUTPUT.txt; the finding it supports
 * is in ../RUN-003-ASSESSMENT.md.
 */
import { UBAClient } from '../../../../packages/noodl-editor/src/editor/src/services/UBA/UBAClient';
import { SchemaParser } from '../../../../packages/noodl-editor/src/editor/src/models/UBA/SchemaParser';

const BASE = 'http://localhost:8055';
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'directus-admin-pw';

function hr(label: string) { console.log('\n' + '─'.repeat(78) + '\n' + label + '\n' + '─'.repeat(78)); }
function j(x: unknown) { return JSON.stringify(x, null, 2); }

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`login failed ${res.status}: ${j(body)}`);
  return body.data.access_token as string;
}

async function main() {
  const token = await login();
  console.log('Authenticated to Directus. Access token acquired (bearer).');

  // ── PROBE 1: health — the ONE endpoint that maps ────────────────────────────
  hr('PROBE 1 — UBAClient.health() against Directus /server/health');
  const health = await UBAClient.health(`${BASE}/server/health`,
    { type: 'bearer' }, { token });
  console.log('HealthResult:', j(health));
  console.log(`→ VERDICT: ${health.healthy ? 'WORKS — Directus /server/health maps to UBA health' : 'FAILS'}`);

  // ── PROBE 2: configure — the core protocol mismatch ─────────────────────────
  hr('PROBE 2 — UBAClient.configure() — UBA expects a "config" ingest endpoint');
  console.log('UBA model: POST the config form values to schema.backend.endpoints.config.');
  console.log('Directus has no such endpoint. Trying the conventional guess http://localhost:8055/configure ...');
  try {
    const cfg = await UBAClient.configure(`${BASE}/configure`,
      { database: { host: 'localhost' } }, { type: 'bearer' }, { token });
    console.log('ConfigureResult:', j(cfg));
    console.log('→ VERDICT: unexpectedly succeeded');
  } catch (err: any) {
    console.log(`UBAClientError: ${err.message}`);
    console.log(`  status=${err.status}`);
    console.log('→ VERDICT: FAILS — Directus exposes no config-ingest endpoint. UBA\'s');
    console.log('  "POST your config to the backend" model assumes a UBA-protocol server,');
    console.log('  not a real BaaS. Nothing to configure against.');
  }

  // ── PROBE 3: the UBAPanel flow — fetch a "schema URL" and SchemaParser.parse ─
  hr('PROBE 3 — SchemaParser.parse() on what Directus serves at its schema URLs');
  const parser = new SchemaParser();
  for (const path of ['/collections', '/fields']) {
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    const doc = await res.json();
    const result = parser.parse(doc);
    console.log(`\nDirectus ${path} → SchemaParser.parse():`);
    if (result.success) {
      console.log('  success=true (unexpected)');
    } else {
      console.log('  success=FALSE. Errors:');
      for (const e of result.errors) console.log(`    - [${e.path}] ${e.message}`);
    }
  }
  console.log('\n→ VERDICT: FAILS — Directus does not serve a UBASchema. UBASchema is a');
  console.log('  config-FORM description (sections/fields/visible_when), not a data schema.');
  console.log('  No translation layer (adapter) exists to turn Directus meta into a UBASchema.');

  // ── PROBE 4: what Directus ACTUALLY offers — the real adapter surface ────────
  hr('PROBE 4 — What a REAL Directus adapter would consume (introspection)');
  const collRes = await fetch(`${BASE}/collections`, { headers: { Authorization: `Bearer ${token}` } });
  const collections = (await collRes.json()).data as any[];
  const userColls = collections.filter(c => !c.collection.startsWith('directus_'));
  console.log(`User collections: ${userColls.map(c => c.collection).join(', ') || '(none seeded yet)'}`);
  for (const c of userColls) {
    const fRes = await fetch(`${BASE}/fields/${c.collection}`, { headers: { Authorization: `Bearer ${token}` } });
    const fields = (await fRes.json()).data as any[];
    console.log(`\n  collection "${c.collection}":`);
    for (const f of fields) {
      const rel = f.schema?.foreign_key_table ? ` → FK ${f.schema.foreign_key_table}` : '';
      const choices = f.meta?.options?.choices ? ` choices=[${f.meta.options.choices.map((x: any) => x.value).join(',')}]` : '';
      console.log(`    - ${f.field}: type=${f.type} interface=${f.meta?.interface || '-'}${rel}${choices}`);
    }
  }
  console.log('\n→ This rich per-field metadata (type, interface, FK relations, enum choices)');
  console.log('  is exactly what "pick a table, see the fields" needs — and what UBA currently');
  console.log('  has no code to consume. This is the net-new work RUN-003 actually implies.');
}

main().catch(e => { console.error('DRIVER ERROR:', e); process.exit(1); });
