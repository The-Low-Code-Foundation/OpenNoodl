/**
 * BCN-003 — the live equivalence pass.
 *
 * **The deliverable of the task, not its scaffolding.** BCN-003's own trap says
 * why: *"a shape test cannot catch a wrong-rows bug"*. RUN-003's flat dotted
 * relation path passed every unit test and failed on the first live fetch, and
 * the failure this whole task is about — a condition that is dropped instead of
 * refused — makes a query **succeed** and return more rows than it was asked
 * for. Nothing but a real request against a real server can see that.
 *
 * So: one logical corpus, seeded into five backends; one set of neutral
 * filters; and an assertion that every backend that declares it can express a
 * filter returns *the same people*.
 *
 * | Backend | Where | Dialect under test |
 * |---|---|---|
 * | Built-in (`nodegx`) | `nodegx-backend serve` on :8093 | `toParseWhere` → our SQL translator |
 * | Parse Server 7.3.0 | `parse` profile, :8092 | `toParseWhere` → MongoDB |
 * | Directus 11 | default profile, :8055 | `toDirectusFilter` |
 * | PostgREST 12.2 | `aggregate` profile, :8057 | `toPostgrest` |
 * | PocketBase 0.30 | `aggregate` profile, :8091 | `toPocketBaseFilter` |
 *
 * The translators are imported from `@noodl/backend-contract` — the code that
 * ships, not a reimplementation of it. A driver that translated the filters
 * itself would prove something about the driver.
 *
 * Run:
 *   docker compose --profile aggregate --profile parse down -v   # the SQL seed only runs on a fresh volume
 *   docker compose --profile aggregate --profile parse up -d
 *   (cd ../../../../packages/nodegx-backend && node bin/nodegx-backend.js serve --data-dir /tmp/bcn003-backend --port 8093 &)
 *   node build-bcn-003.mjs && node bcn-003-equivalence-driver.cjs
 *
 * Recorded output: BCN-003-EQUIVALENCE-OUTPUT.txt.
 */

import { descriptorFor } from '../../../../packages/nodegx-backend-contract/src/descriptors';
import type { BackendType, FilterOperator } from '../../../../packages/nodegx-backend-contract/src';
import type { Filter } from '../../../../packages/nodegx-backend-contract/src/filter';
import {
  bindPocketBaseFilter,
  toDirectusFilter,
  toParseWhere,
  toPocketBaseFilter,
  toPostgrest,
  FilterTranslationError
} from '../../../../packages/nodegx-backend-contract/src/translators';

// ── the corpus ─────────────────────────────────────────────────────────────

interface Person {
  name: string;
  age: number;
  city: string;
  active: boolean;
  bio: string | null;
}

/**
 * Seven people, each of whom exists to separate two operators a careless
 * translator would confuse. Mirrors `bcn-003-people-seed.sql`, which is the
 * PostgREST half — the other four are seeded over their APIs below.
 */
const PEOPLE: Person[] = [
  { name: 'Ada', age: 36, city: 'London', active: true, bio: 'mathematician' },
  { name: 'Adam', age: 41, city: 'Bristol', active: false, bio: '' },
  { name: 'Grace', age: 45, city: 'New York', active: true, bio: null },
  { name: 'adaline', age: 29, city: 'London', active: true, bio: 'engineer' },
  { name: 'Charles', age: 60, city: 'London', active: false, bio: 'inventor' },
  { name: 'Q"uote && Co', age: 1, city: 'Edge', active: true, bio: '100% sure' },
  { name: 'Thousand', age: 2, city: 'Edge', active: true, bio: '1000 words' }
];

interface Case {
  title: string;
  filter: Filter;
  /** The operator whose capability cell decides whether a backend is asked. */
  operator: FilterOperator;
  /** Names, sorted. */
  expected: string[];
}

/**
 * The pass/fail rule, and the thing this run actually asserts.
 *
 * Not "every backend returns the same rows" — that is false, and a run that
 * demanded it would be measuring the world rather than our claims about it.
 * What is asserted is stronger and more useful:
 *
 *   **A backend whose cell says `supported` returns exactly the expected rows.
 *   A backend that returns anything else has a cell that already said so.**
 *
 * So a `degraded` cell buys a divergence and nothing else does. Every one of
 * the six divergences below was a `supported` cell before this run — Directus's
 * unescapable LIKE wildcards, PocketBase's missing NULL, Directus's `_empty`
 * matching a NULL — and each became `degraded`, with a sentence, *because* the
 * run found it. That is the capability model doing the job it exists for.
 */

const CASES: Case[] = [
  { title: 'equalTo city=London', operator: 'equalTo', filter: { city: { equalTo: 'London' } },
    expected: ['Ada', 'Charles', 'adaline'] },
  { title: 'notEqualTo city=London', operator: 'notEqualTo', filter: { city: { notEqualTo: 'London' } },
    expected: ['Adam', 'Grace', 'Q"uote && Co', 'Thousand'] },
  { title: 'greaterThan age>40', operator: 'greaterThan', filter: { age: { greaterThan: 40 } },
    expected: ['Adam', 'Charles', 'Grace'] },
  { title: 'lessThanOrEqualTo age<=36', operator: 'lessThanOrEqualTo', filter: { age: { lessThanOrEqualTo: 36 } },
    expected: ['Ada', 'Q"uote && Co', 'Thousand', 'adaline'] },
  { title: 'between age 30..45', operator: 'between', filter: { age: { between: [30, 45] } },
    expected: ['Ada', 'Adam', 'Grace'] },
  { title: 'notBetween age 30..45', operator: 'notBetween', filter: { age: { notBetween: [30, 45] } },
    expected: ['Charles', 'Q"uote && Co', 'Thousand', 'adaline'] },
  { title: 'containedIn city in (London,Bristol)', operator: 'containedIn',
    filter: { city: { containedIn: ['London', 'Bristol'] } },
    expected: ['Ada', 'Adam', 'Charles', 'adaline'] },
  { title: 'notContainedIn city not in (London,Bristol)', operator: 'notContainedIn',
    filter: { city: { notContainedIn: ['London', 'Bristol'] } },
    expected: ['Grace', 'Q"uote && Co', 'Thousand'] },

  // ── the eleven lowered operators ─────────────────────────────────────────
  // These are the ones `convertFilterOp` had no branch for, so on the
  // Parse-family backends every one of them used to return the whole
  // collection. `am` rather than `Ada` because PocketBase's `~` is
  // case-insensitive and cannot be made otherwise — the case-sensitive
  // question is asked separately below, as a divergence.
  { title: 'contains name~am', operator: 'contains', filter: { name: { contains: 'am' } },
    expected: ['Adam'] },
  { title: 'notContains name!~am', operator: 'notContains', filter: { name: { notContains: 'am' } },
    expected: ['Ada', 'Charles', 'Grace', 'Q"uote && Co', 'Thousand', 'adaline'] },
  { title: 'containsIgnoreCase name~ADA', operator: 'containsIgnoreCase',
    filter: { name: { containsIgnoreCase: 'ADA' } },
    expected: ['Ada', 'Adam', 'adaline'] },
  { title: 'startsWith name^Gr', operator: 'startsWith', filter: { name: { startsWith: 'Gr' } },
    expected: ['Grace'] },
  { title: 'notStartsWith name!^Ada', operator: 'notStartsWith', filter: { name: { notStartsWith: 'Ada' } },
    expected: ['Charles', 'Grace', 'Q"uote && Co', 'Thousand', 'adaline'] },
  { title: 'endsWith name$ce', operator: 'endsWith', filter: { name: { endsWith: 'ce' } },
    expected: ['Grace'] },
  { title: 'notEndsWith name!$ce', operator: 'notEndsWith', filter: { name: { notEndsWith: 'ce' } },
    expected: ['Ada', 'Adam', 'Charles', 'Q"uote && Co', 'Thousand', 'adaline'] },

  // ── the cases that only a live request can settle ────────────────────────
  {
    title: 'equalTo name=Q"uote && Co  (the injection case)',
    operator: 'equalTo',
    filter: { name: { equalTo: 'Q"uote && Co' } },
    expected: ['Q"uote && Co']
  },
  {
    title: 'contains bio~100%  (the LIKE-wildcard case)',
    operator: 'contains',
    // Unescaped, `%` is a wildcard: `LIKE '%100%%'` also matches "1000 words".
    filter: { bio: { contains: '100%' } },
    expected: ['Q"uote && Co']
  },
  {
    title: 'matchesRegex name=^Ada$',
    operator: 'matchesRegex',
    // The built-in backend's headline defect: this was `LIKE '%^Ada$%'`, a
    // search for that literal text, matching nothing and reporting nothing.
    filter: { name: { matchesRegex: '^Ada$' } },
    expected: ['Ada']
  },

  // ── presence, which is three different questions ─────────────────────────
  { title: 'exists bio=false', operator: 'exists', filter: { bio: { exists: false } },
    expected: ['Grace'] },
  { title: 'exists bio=true', operator: 'exists', filter: { bio: { exists: true } },
    expected: ['Ada', 'Adam', 'Charles', 'Q"uote && Co', 'Thousand', 'adaline'] },
  { title: 'isEmpty bio', operator: 'isEmpty', filter: { bio: { isEmpty: true } },
    expected: ['Adam'] },

  // ── a nested group ───────────────────────────────────────────────────────
  {
    title: 'and[ city=London, or[ age<30, age>50 ] ]',
    operator: 'equalTo',
    filter: {
      and: [{ city: { equalTo: 'London' } }, { or: [{ age: { lessThan: 30 } }, { age: { greaterThan: 50 } }] }]
    },
    expected: ['Charles', 'adaline']
  }
];

// ── targets ────────────────────────────────────────────────────────────────

interface Target {
  label: string;
  type: BackendType;
  seed(): Promise<void>;
  run(filter: Filter): Promise<string[]>;
  /** Skipped with a reason rather than failing, when the server is not up. */
  available: boolean;
}

const DIRECTUS = 'http://localhost:8055';
const POSTGREST = 'http://localhost:8057';
const POCKETBASE = 'http://localhost:8091';
const PARSE = 'http://localhost:8092/parse';
const NODEGX = 'http://127.0.0.1:8093';

async function http(
  url: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; json: any; text: string }> {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { ok: res.ok, status: res.status, json, text };
  } catch (e) {
    return { ok: false, status: 0, json: undefined, text: String(e) };
  }
}

// ── the Parse-family targets (built-in and upstream Parse) ─────────────────

function parseFamilyTarget(label: string, type: BackendType, url: string, appId: string): Target {
  const headers = { 'X-Parse-Application-Id': appId, 'Content-Type': 'application/json' };
  return {
    label,
    type,
    available: true,
    async seed() {
      const existing = await http(`${url}/classes/Person?limit=1000`, { headers });
      const have: Person[] = existing.json?.results ?? [];
      if (have.length >= PEOPLE.length) return;
      for (const person of PEOPLE) {
        // Parse stores an explicit null; the seed relies on it for `exists`.
        await http(`${url}/classes/Person`, { method: 'POST', headers, body: JSON.stringify(person) });
      }
    },
    async run(filter) {
      const where = toParseWhere(filter, { backend: type });
      const res = await http(`${url}/classes/Person`, {
        method: 'POST',
        headers,
        // The `{_method:'GET'}` POST tunnel the wire has always used, so a
        // large filter is not truncated at the URL length limit.
        body: JSON.stringify({ _method: 'GET', where, limit: 1000 })
      });
      if (!res.ok) throw new Error(`${res.status} ${res.text.slice(0, 200)}`);
      return (res.json.results as Person[]).map((p) => p.name);
    }
  };
}

// ── Directus ───────────────────────────────────────────────────────────────

function directusTarget(token: string): Target {
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  return {
    label: 'Directus 11 (:8055)',
    type: 'directus',
    available: true,
    async seed() {
      const existing = await http(`${DIRECTUS}/items/people?limit=1`, { headers: auth });
      if (existing.ok && (existing.json?.data?.length ?? 0) > 0) return;

      if (!existing.ok) {
        await http(`${DIRECTUS}/collections`, {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({
            collection: 'people',
            schema: {},
            meta: { singleton: false },
            fields: [
              { field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } },
              { field: 'name', type: 'string' },
              { field: 'age', type: 'integer' },
              { field: 'city', type: 'string' },
              { field: 'active', type: 'boolean' },
              { field: 'bio', type: 'text' }
            ]
          })
        });
      }
      for (const person of PEOPLE) {
        await http(`${DIRECTUS}/items/people`, { method: 'POST', headers: auth, body: JSON.stringify(person) });
      }
    },
    async run(filter) {
      const directus = toDirectusFilter(filter, { backend: 'directus' });
      const url = `${DIRECTUS}/items/people?limit=-1&filter=${encodeURIComponent(JSON.stringify(directus))}`;
      const res = await http(url, { headers: auth });
      if (!res.ok) throw new Error(`${res.status} ${res.text.slice(0, 200)}`);
      return (res.json.data as Person[]).map((p) => p.name);
    }
  };
}

// ── PostgREST ──────────────────────────────────────────────────────────────

const postgrestTarget: Target = {
  label: 'PostgREST 12.2 (:8057)',
  type: 'supabase',
  available: true,
  async seed() {
    // Seeded by bcn-003-people-seed.sql on a fresh volume — PostgREST cannot
    // create a table, which is the whole reason that file exists.
  },
  async run(filter) {
    const { params } = toPostgrest(filter, { backend: 'supabase' });
    // The translator returns values in PostgREST's own grammar, unencoded.
    // Percent-encoding is the caller's job, and `URLSearchParams` is exactly
    // right for it: without this, the `&&` in a value splits the query string.
    const query = new URLSearchParams(params);
    query.set('limit', '1000');
    const res = await http(`${POSTGREST}/people?${query.toString()}`);
    if (!res.ok) throw new Error(`${res.status} ${res.text.slice(0, 200)}`);
    return (res.json as Person[]).map((p) => p.name);
  }
};

// ── PocketBase ─────────────────────────────────────────────────────────────

function pocketbaseTarget(token: string): Target {
  const auth = { Authorization: token, 'Content-Type': 'application/json' };
  return {
    label: 'PocketBase 0.30 (:8091)',
    type: 'pocketbase',
    available: true,
    async seed() {
      const existing = await http(`${POCKETBASE}/api/collections/people/records?perPage=1`, { headers: auth });
      if (existing.ok && (existing.json?.totalItems ?? 0) >= PEOPLE.length) return;

      if (!existing.ok) {
        await http(`${POCKETBASE}/api/collections`, {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({
            name: 'people',
            type: 'base',
            listRule: '',
            viewRule: '',
            fields: [
              { name: 'name', type: 'text' },
              { name: 'age', type: 'number' },
              { name: 'city', type: 'text' },
              { name: 'active', type: 'bool' },
              { name: 'bio', type: 'text' }
            ]
          })
        });
      }
      for (const person of PEOPLE) {
        await http(`${POCKETBASE}/api/collections/people/records`, {
          method: 'POST',
          headers: auth,
          // PocketBase has no NULL for a text field — an absent value is the
          // empty string. Recorded as a divergence rather than worked around,
          // because working around it in the seed would hide it.
          body: JSON.stringify({ ...person, bio: person.bio ?? '' })
        });
      }
    },
    async run(filter) {
      const pb = toPocketBaseFilter(filter, { backend: 'pocketbase' });
      const query = new URLSearchParams({ perPage: '200', filter: bindPocketBaseFilter(pb) });
      const res = await http(`${POCKETBASE}/api/collections/people/records?${query.toString()}`, { headers: auth });
      if (!res.ok) throw new Error(`${res.status} ${res.text.slice(0, 200)}`);
      return (res.json.items as Person[]).map((p) => p.name);
    }
  };
}

// ── reporting ──────────────────────────────────────────────────────────────

let checks = 0;
let failures = 0;
const divergences: string[] = [];

function hr(title: string) {
  console.log('\n' + '═'.repeat(78));
  console.log(title);
  console.log('═'.repeat(78));
}

const sorted = (names: string[]) => [...names].sort();
const same = (a: string[], b: string[]) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

async function main() {
  hr('BCN-003 — filter equivalence across five backends');
  console.log(`corpus: ${PEOPLE.length} people, ${CASES.length} filters\n`);

  const targets: Target[] = [];

  // Built-in and upstream Parse.
  for (const [label, type, url, appId] of [
    ['Built-in / nodegx-backend (:8093)', 'nodegx', NODEGX, 'bcn-003-probe'],
    ['Parse Server 7.3.0 (:8092)', 'parse', PARSE, 'uba-e2e-app']
  ] as const) {
    const health = await http(`${url}/classes/Person?limit=1`, { headers: { 'X-Parse-Application-Id': appId } });
    if (health.status === 0) {
      console.log(`  SKIP ${label} — not reachable`);
      continue;
    }
    targets.push(parseFamilyTarget(label, type, url, appId));
  }

  // Directus.
  const login = await http(`${DIRECTUS}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'directus-admin-pw' })
  });
  if (login.ok && login.json?.data?.access_token) targets.push(directusTarget(login.json.data.access_token));
  else console.log('  SKIP Directus — not reachable or login failed');

  // PostgREST.
  const pgHealth = await http(`${POSTGREST}/people?limit=1`);
  if (pgHealth.status !== 0) targets.push(postgrestTarget);
  else console.log('  SKIP PostgREST — not reachable');
  if (pgHealth.status === 404) {
    console.log('  !! PostgREST is up but has no `people` table — the SQL seed only runs on a FRESH volume.');
    console.log('     docker compose --profile aggregate down -v && docker compose --profile aggregate up -d');
    failures++;
  }

  // PocketBase.
  const pbAuth = await http(`${POCKETBASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'admin@example.com', password: 'pocketbase-admin-pw' })
  });
  if (pbAuth.ok && pbAuth.json?.token) targets.push(pocketbaseTarget(pbAuth.json.token));
  else console.log('  SKIP PocketBase — not reachable or superuser auth failed');

  hr('seeding');
  for (const target of targets) {
    try {
      await target.seed();
      console.log(`  ${target.label} — seeded`);
    } catch (e) {
      console.log(`  ${target.label} — SEED FAILED: ${(e as Error).message}`);
      target.available = false;
      failures++;
    }
  }

  const live = targets.filter((t) => t.available);

  hr('equivalence');
  for (const testCase of CASES) {
    console.log(`\n${testCase.title}`);
    console.log(`  expected: ${JSON.stringify(sorted(testCase.expected))}`);

    for (const target of live) {
      const cell = descriptorFor(target.type).filters[testCase.operator];
      const usable = cell.state === 'supported' || cell.state === 'degraded';

      if (!usable) {
        // Not a failure. The point of the capability table is that a backend
        // may decline, in a sentence, before anything reaches the wire.
        console.log(
          `  ${target.label.padEnd(34)} gated (${cell.state}): ${'reason' in cell ? cell.reason.slice(0, 58) : ''}…`
        );
        continue;
      }

      checks++;
      try {
        const got = await target.run(testCase.filter);
        if (same(got, testCase.expected)) {
          console.log(`  ${target.label.padEnd(34)} ✓ ${JSON.stringify(sorted(got))}`);
        } else if (cell.state === 'degraded') {
          divergences.push(
            `${testCase.title} / ${target.label}\n      got: ${JSON.stringify(sorted(got))}\n      declared: ${'reason' in cell ? cell.reason : ''}`
          );
          console.log(`  ${target.label.padEnd(34)} ≠ ${JSON.stringify(sorted(got))}  (declared degraded)`);
        } else {
          failures++;
          console.log(`  ${target.label.padEnd(34)} ✗ ${JSON.stringify(sorted(got))}  — cell says "supported"`);
        }
      } catch (e) {
        failures++;
        const kind = e instanceof FilterTranslationError ? 'REFUSED' : 'ERROR';
        console.log(`  ${target.label.padEnd(34)} ✗ ${kind}: ${(e as Error).message.slice(0, 120)}`);
      }
    }
  }

  hr('result');
  console.log(`${checks} checks across ${live.length} backends`);
  console.log(`${failures} failure(s) — a backend whose cell says "supported" returning the wrong rows`);
  if (divergences.length) {
    console.log(`\n${divergences.length} divergence(s), each one predicted by a "degraded" cell:`);
    for (const d of divergences) console.log(`\n  - ${d}`);
  }
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
