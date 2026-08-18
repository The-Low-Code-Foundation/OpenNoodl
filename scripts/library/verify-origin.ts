#!/usr/bin/env ts-node
/**
 * CN-016 / ✅ D21 — npm run library:verify-origin
 *
 * The divergence gate. `library:check` grades the *sources* under `library/`;
 * `library:verify-dist` grades the *artefact* under `library-dist/`. Neither
 * looks at what users actually receive. This one does: it fetches the two
 * library indexes from the **live content origin** — the URL the editor itself
 * would call, obtained by calling `getContentEndpoint()` rather than by keeping
 * a copy of it — and compares them against `library/`.
 *
 * 🔴 **WHAT THIS CHECKS: COVERAGE, BY LABEL. NOT CONTENT.**
 *
 * It answers exactly one question — *does every entry under `library/` have a
 * published counterpart, and does every published entry still have a source?* —
 * and it must not be read as answering any more than that:
 *
 *   - **It does not check that the published zip matches the source.** A
 *     published entry could carry entirely different code under a matching
 *     label and this gate would call it covered. Content equality cannot be
 *     asserted until a publish from `library/` has happened at least once
 *     (phase 65's LBR-001); until then there is no published payload derived
 *     from these sources to hash against. When LBR-001 lands, this script is
 *     where the payload hash comparison belongs, and §"When LBR-001 lands"
 *     below says what changes.
 *   - **It cannot compare slugs or filenames.** The published fleet carries
 *     legacy pre-LIB-001 names (`chartjs-module-1-4`, `gsheets-1`, `modal-0`,
 *     `pagesandrows-0`) that no `library/` entry would produce. `label` is the
 *     only field the two naming schemes share.
 *
 * Why a gate at all: D21 descoped CN-016 AC1 from "installs from the real
 * origin" to "installs from a built artefact **plus a gate that fails the
 * moment the origin and `library/` diverge**", and the gate is the load-bearing
 * half. Descoping alone would have closed phase 69 and left the origin rotting
 * further, which is the state that produced the problem. Nothing publishes
 * `library/` yet — that is LBR-001 — so this gate's job today is to stop the
 * gap *widening* unnoticed while LBR-001 is unbuilt.
 *
 * ## The baseline, and why one exists
 *
 * The origin and `library/` already diverge, so a gate that simply demanded
 * equality would be red on the day it was written and switched off the week
 * after. `origin-baseline.json` records the divergence as measured, and the
 * rule is:
 *
 *   **the divergence set must equal the baseline — no bigger, no smaller.**
 *
 * A *new* divergence is red because it is drift nobody chose. A *stale*
 * baseline entry (something that is published now, or a source that has been
 * deleted) is also red, because the fix is deleting one line and a baseline
 * that is never pruned stops describing anything. Both failures print the exact
 * edit to make.
 *
 * ## When LBR-001 lands
 *
 * Publishing `library/` should empty `unpublished` in the baseline. At that
 * point this script should grow a second, stronger check — hash the published
 * zip against a freshly built one — and the banner it prints must change with
 * it, because a gate that implies more than it checks is worse than no gate.
 *
 * ## Network
 *
 * ⚠️ This gate needs egress by construction: an origin it cannot reach is an
 * origin it cannot compare. It retries a few times to ride out a GitHub Pages
 * blip, and then **fails loudly as UNAVAILABLE (exit 2)**. It never treats
 * "could not check" as "checked and fine" — that failure mode is precisely the
 * silence D21 exists to end.
 *
 * Usage:
 *   npm run library:verify-origin
 *   ts-node -P ./scripts/tsconfig.json ./scripts/library/verify-origin.ts [--json] [--update-baseline]
 *
 * Exit codes: 0 = matches the baseline, 1 = divergence changed, 2 = origin
 * unavailable or usage/IO error.
 */
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// The editor's own endpoint, called — not copied.
// ---------------------------------------------------------------------------
//
// `getContentEndpoint.ts` requires `@electron/remote` at module scope, which
// throws outside Electron, so it is stubbed at the resolver before the import
// below runs. Everything else about the module is the real thing: if the origin
// is repointed again (as it was on 2026-08-13, ALPHA-006 B5) this gate follows
// the repoint with no edit. A regex over the source would have been shorter and
// would have been a second declaration of a shared value, checked by nothing.
const Module = require('module');
const REMOTE_STUB_ID = '\0stub:electron-remote';
const realResolveFilename = (Module as { _resolveFilename: (...a: unknown[]) => string })._resolveFilename;
(Module as { _resolveFilename: unknown })._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === '@electron/remote') return REMOTE_STUB_ID;
  return realResolveFilename.call(this, request, ...rest);
};
require.cache[REMOTE_STUB_ID] = {
  id: REMOTE_STUB_ID,
  filename: REMOTE_STUB_ID,
  loaded: true,
  // `useLocalDocs` false is the shipped branch: the published origin, not a
  // Docusaurus dev server. A gate that graded localhost would grade nothing.
  exports: { getGlobal: (name: string) => (name === 'useLocalDocs' ? false : undefined) }
} as never;

// eslint-disable-next-line import/first
import getContentEndpoint from '../../packages/noodl-editor/src/editor/src/utils/getContentEndpoint';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LIBRARY_DIR = path.join(REPO_ROOT, 'library');
const BASELINE_PATH = path.join(__dirname, 'origin-baseline.json');

const TYPES = ['prefabs', 'modules'] as const;
type LibraryType = (typeof TYPES)[number];

const argv = process.argv.slice(2);
const AS_JSON = argv.includes('--json');
const UPDATE_BASELINE = argv.includes('--update-baseline');

const ATTEMPTS = 3;
const TIMEOUT_MS = 20_000;

interface Baseline {
  $comment: string;
  measuredOn: string;
  /** Labels present under `library/` with no published counterpart. */
  unpublished: Record<LibraryType, string[]>;
  /** Labels published at the origin with no source under `library/`. */
  orphaned: Record<LibraryType, string[]>;
}

interface Divergence {
  unpublished: Record<LibraryType, string[]>;
  orphaned: Record<LibraryType, string[]>;
}

/** Labels are the only field the two naming schemes share; only whitespace is normalised. */
function normaliseLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ');
}

function readLocalLabels(type: LibraryType): { label: string; slug: string }[] {
  const dir = path.join(LIBRARY_DIR, type);
  if (!fs.existsSync(dir)) throw new Error(`no ${path.relative(REPO_ROOT, dir)}/`);
  const out: { label: string; slug: string }[] = [];
  for (const slug of fs.readdirSync(dir).sort()) {
    const manifest = path.join(dir, slug, 'library.json');
    if (!fs.existsSync(manifest)) continue;
    const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    if (typeof parsed.label !== 'string' || !parsed.label.trim()) {
      // `library:check` gates this against the schema; reaching here means the
      // two scripts disagree, which is worth saying rather than skipping.
      throw new Error(`${type}/${slug}/library.json has no usable "label" — library:check should have caught this`);
    }
    out.push({ label: normaliseLabel(parsed.label), slug });
  }
  return out;
}

/**
 * The two ways an index can be "fetched successfully" and still be unusable: a
 * CDN answering 200 with an error document, and a half-written file. Both are
 * pulled out as a pure function so the self-test below can prove this gate
 * rejects them without needing a server to lie to it.
 */
function parseIndexBody(body: string): { label: string }[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    throw new Error(`200 but not JSON (${(err as Error).message})`);
  }
  if (!Array.isArray(parsed)) throw new Error('200 but the index is not an array');
  return parsed as { label: string }[];
}

async function fetchIndex(url: string, attempts = ATTEMPTS): Promise<{ label: string }[]> {
  let lastError = '';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) lastError = `HTTP ${res.status}`;
      else return parseIndexBody(await res.text());
    } catch (err) {
      lastError = (err as Error).message;
    }
    if (attempt < attempts) await new Promise((r) => setTimeout(r, attempt * 1000));
  }
  throw new Error(`UNAVAILABLE ${url}: ${lastError}`);
}

/**
 * 🔴 The property that matters most here is a NEGATIVE one: this gate must
 * never exit 0 when it did not actually compare anything. An absence assertion
 * is only worth reading beside a known-firing signal, so the failure paths are
 * exercised on every run rather than checked by hand once:
 *
 *   - a dead endpoint must raise UNAVAILABLE, not resolve to an empty index
 *     (an empty index would read as "the origin publishes nothing", which is a
 *     divergence report, not an outage — the wrong verdict entirely);
 *   - a 200 carrying an error document or truncated JSON must throw;
 *   - and a well-formed index must still parse, so the checks above are shown
 *     to be discriminating rather than merely strict.
 *
 * Port 1 on loopback refuses instantly and needs no DNS, so this costs
 * milliseconds. `attempts` is 1 so the retry backoff is not paid for a failure
 * that is certain.
 */
async function selfTest(): Promise<string[]> {
  const failures: string[] = [];

  try {
    const resolved = await fetchIndex('http://127.0.0.1:1/library/prefabs/index.json', 1);
    failures.push(
      `self-test: a dead endpoint resolved to ${JSON.stringify(resolved)} instead of raising UNAVAILABLE — ` +
        `this gate could report "no divergence" without reaching the origin`
    );
  } catch (err) {
    if (!/^UNAVAILABLE /.test((err as Error).message)) {
      failures.push(`self-test: a dead endpoint failed, but not as UNAVAILABLE: ${(err as Error).message}`);
    }
  }

  for (const [body, what] of [
    ['{"error":"NoSuchKey"}', '200 with a JSON object instead of an array'],
    ['[{"label": "truncated"', '200 with truncated JSON']
  ] as const) {
    try {
      parseIndexBody(body);
      failures.push(`self-test: ${what} parsed as a usable index`);
    } catch {
      /* expected */
    }
  }

  try {
    const ok = parseIndexBody('[{"label":"A"}]');
    if (ok.length !== 1) failures.push('self-test: a well-formed index did not parse to one entry');
  } catch (err) {
    failures.push(`self-test: a well-formed index was rejected: ${(err as Error).message}`);
  }

  return failures;
}

function diff(local: string[], remote: string[]): { unpublished: string[]; orphaned: string[] } {
  const remoteSet = new Set(remote);
  const localSet = new Set(local);
  return {
    unpublished: local.filter((l) => !remoteSet.has(l)).sort(),
    orphaned: remote.filter((l) => !localSet.has(l)).sort()
  };
}

function sameList(a: string[] = [], b: string[] = []): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

async function main() {
  const endpoint = getContentEndpoint();
  if (typeof endpoint !== 'string' || !endpoint.startsWith('http')) {
    console.error(`getContentEndpoint() returned ${JSON.stringify(endpoint)} — cannot address the origin.`);
    process.exit(2);
  }

  const selfTestFailures = await selfTest();
  if (selfTestFailures.length) {
    console.error('\n🔴 This gate cannot be trusted to fail — its own failure paths are broken:');
    for (const f of selfTestFailures) console.error(`   ${f}`);
    process.exit(2);
  }

  const divergence: Divergence = { unpublished: { prefabs: [], modules: [] }, orphaned: { prefabs: [], modules: [] } };
  const counts: Record<string, { local: number; origin: number; shared: number }> = {};

  for (const type of TYPES) {
    const local = readLocalLabels(type);
    let remote: { label: string }[];
    try {
      remote = await fetchIndex(`${endpoint}/library/${type}/index.json`);
    } catch (err) {
      console.error(`\n🔴 ORIGIN UNAVAILABLE — nothing was compared.\n   ${(err as Error).message}`);
      console.error(
        `\nThis is NOT a pass. The gate needs egress to the content origin by construction;\n` +
          `an origin it cannot reach is an origin it cannot compare. Re-run with network access.`
      );
      process.exit(2);
    }
    const localLabels = local.map((e) => e.label);
    const remoteLabels = remote
      .map((e) => (typeof e.label === 'string' ? normaliseLabel(e.label) : ''))
      .filter(Boolean);
    const d = diff(localLabels, remoteLabels);
    divergence.unpublished[type] = d.unpublished;
    divergence.orphaned[type] = d.orphaned;
    counts[type] = {
      local: localLabels.length,
      origin: remoteLabels.length,
      shared: localLabels.filter((l) => remoteLabels.includes(l)).length
    };
  }

  if (UPDATE_BASELINE) {
    const existing: Baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    const next: Baseline = { ...existing, unpublished: divergence.unpublished, orphaned: divergence.orphaned };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
    console.log(`Wrote ${path.relative(REPO_ROOT, BASELINE_PATH)}. 🔴 Update "measuredOn" and say WHY in the commit.`);
    process.exit(0);
  }

  const baseline: Baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  const problems: string[] = [];
  for (const type of TYPES) {
    for (const kind of ['unpublished', 'orphaned'] as const) {
      const actual = divergence[kind][type];
      const expected = baseline[kind]?.[type] || [];
      if (sameList(actual, expected)) continue;
      const appeared = actual.filter((l) => !expected.includes(l));
      const gone = expected.filter((l) => !actual.includes(l));
      for (const label of appeared) {
        problems.push(
          kind === 'unpublished'
            ? `NEW DIVERGENCE  [${type}] "${label}" is under library/ and is NOT published at the origin.`
            : `NEW DIVERGENCE  [${type}] "${label}" is published at the origin with no source under library/.`
        );
      }
      for (const label of gone) {
        problems.push(
          `STALE BASELINE  [${type}] "${label}" is listed as ${kind} and no longer is — ` +
            `delete it from ${path.relative(REPO_ROOT, BASELINE_PATH)}.`
        );
      }
    }
  }

  if (AS_JSON) {
    console.log(JSON.stringify({ endpoint, counts, divergence, baseline, problems }, null, 2));
    process.exit(problems.length ? 1 : 0);
  }

  console.log(`Origin: ${endpoint}`);
  console.log(`🔴 This gate checks COVERAGE, BY LABEL. It does NOT check that published content matches library/.`);
  console.log(`   Content equality is unassertable until a publish from library/ has happened once — phase 65 LBR-001.`);
  console.log('');
  for (const type of TYPES) {
    const c = counts[type];
    console.log(`${type}: library/ ${c.local}, origin ${c.origin}, sharing ${c.shared} labels`);
  }
  console.log('');
  for (const type of TYPES) {
    for (const kind of ['unpublished', 'orphaned'] as const) {
      for (const label of divergence[kind][type]) {
        const known = (baseline[kind]?.[type] || []).includes(label);
        console.log(`  ${known ? 'known ' : '🔴 NEW'} [${type}] ${kind}: ${label}`);
      }
    }
  }
  if (problems.length) {
    console.log('');
    for (const p of problems) console.log(`  ${p}`);
    console.log(
      `\n🔴 The origin and library/ diverge differently than ${path.relative(REPO_ROOT, BASELINE_PATH)} records.\n` +
        `If the change is intended, re-run with --update-baseline and say WHY in the commit message.`
    );
  } else {
    console.log(
      `\nCoverage matches the baseline (measured ${baseline.measuredOn}).\n` +
        `🔴 This does NOT say the published content is library/'s content — only that the labels line up.`
    );
  }
  process.exit(problems.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(2);
});
