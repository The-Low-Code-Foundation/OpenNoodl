#!/usr/bin/env ts-node
/**
 * LIB-008 — npm run docs:verify-origin
 *
 * **The gate that would have caught 0.2.3.** `opennoodl-docs` was renamed to
 * `nodegx-content` on 2026-08-07. GitHub Pages, unlike git and unlike the API,
 * does not follow a repo-rename redirect — so the old origin became a hard 404
 * while every other reference to the old name kept working, which is exactly why
 * nobody noticed. `getContentEndpoint()` was repointed at the time.
 * `getDocsEndpoint()` was not, and shipped dead: every documentation link in the
 * editor, across 176 node pages, the property panel, the node picker and the MCP
 * settings help link.
 *
 * Nothing measured that. This does.
 *
 * ## Both endpoints, one sweep
 *
 * 🔴 **`getContentEndpoint` is checked here too, and that is the point.** It is
 * healthy today and was equally healthy right up until a rename; the two
 * functions were split on 2026-08-13 precisely so they could move independently,
 * and within six months they had diverged into one live origin and one dead one.
 * A sweep that only covered the one that broke would have learned nothing from
 * the thing that happened.
 *
 * ## What a verdict means
 *
 * Both origins are called, never copied: this imports the editor's own modules,
 * so a repoint is followed with no edit here. A regex over the source would have
 * been shorter and would have been a second declaration of a shared value,
 * checked by nothing.
 *
 *   - **UNAVAILABLE (exit 2)** — the host did not answer at all: DNS, connect,
 *     timeout. *Nothing was checked.* This is never a pass; "could not check" is
 *     not "checked and fine", which is the silence this gate exists to end.
 *   - **ORIGIN GONE (exit 1)** — the host answered, but the origin's liveness
 *     probe is not 200. The site itself is not being served. **This is the
 *     0.2.3 shape**: a renamed repo, a disabled Pages, a changed `baseUrl`.
 *   - **PATH MOVED (exit 1)** — the origin is alive and a known page is not
 *     there. **This is the shape a naive repoint leaves behind**: dropping in the
 *     new repo name without `getDocsEndpoint`'s `/docs` suffix turns a 404 *site*
 *     into a 404 *path*, and looks fixed. Distinguishing the two is what tells
 *     you whether to fix the origin or the suffix.
 *   - **exit 0** — every required probe answered 200.
 *
 * The liveness probe is per-origin rather than "the site root", because the two
 * sites are built differently and their roots disagree: the docs site serves a
 * landing page at `/`, while the content origin's legacy Pages build has no
 * document at `/static/` at all (measured 2026-09-11: 404 on a perfectly healthy
 * origin). Using a root as a liveness signal would have declared the content
 * origin dead every run.
 *
 * ## Where the paths come from
 *
 * The docs page probes are resolved through **`nodeDocsPath()`**, the same
 * function the editor's help surfaces call — not through path literals. A gate
 * holding its own copy of the route scheme would go green on a derivation that
 * had stopped matching the site, which is half of what LIB-008 found.
 *
 * Its offline counterpart is `tests-unit/alpha-006/nodeDocs.test.ts`, which
 * asserts every catalog node's path names a page `generate-node-docs.js` actually
 * wrote. That one runs on every PR with no network; this one asks the question
 * that needs egress — *is the thing we publish actually being served?*
 *
 * Usage:
 *   npm run docs:verify-origin
 *   ts-node -P ./scripts/tsconfig.json ./scripts/docs/verify-origin.ts [--json]
 *
 * Exit codes: 0 = every required probe is 200, 1 = ORIGIN GONE or PATH MOVED,
 * 2 = UNAVAILABLE, or this gate's own failure paths are broken.
 */

// ---------------------------------------------------------------------------
// The editor's own endpoints, called — not copied.
// ---------------------------------------------------------------------------
//
// Both modules require `@electron/remote` at module scope, which throws outside
// Electron, so it is stubbed at the resolver before the imports below run.
// Everything else about them is the real thing.
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
  // `useLocalDocs` false is the shipped branch: the published origins, not a
  // dev server. A gate that graded localhost would grade nothing.
  exports: { getGlobal: (name: string) => (name === 'useLocalDocs' ? false : undefined) }
} as never;

/* eslint-disable import/first */
import getContentEndpoint from '../../packages/noodl-editor/src/editor/src/utils/getContentEndpoint';
import getDocsEndpoint from '../../packages/noodl-editor/src/editor/src/utils/getDocsEndpoint';
import { nodeDocsPath } from '../../packages/noodl-editor/src/editor/src/utils/nodeDocs';
/* eslint-enable import/first */

const AS_JSON = process.argv.slice(2).includes('--json');

const ATTEMPTS = 3;
const TIMEOUT_MS = 20_000;

interface Probe {
  /** Site-relative, joined to the endpoint. */
  path: string;
  /** What breaks for a person when this is not there. */
  what: string;
  /**
   * Optional payloads are reported and not gated. Today that is the what's-new
   * feed, which `whats-new.ts` documents as decoration: "not having one is a
   * normal state, not a failure". Gating it would make this sweep red for a
   * reason nobody intends to fix, and a gate that has been red for days reads as
   * furniture.
   */
  optional?: boolean;
}

interface Origin {
  name: string;
  endpoint: string;
  /** Where the endpoint is declared, for the failure message. */
  source: string;
  /**
   * The path suffix the endpoint carries because of how that site is built —
   * `/docs` for Docusaurus's `routeBasePath`, `/static` for the content repo's
   * legacy Pages build. Stripping it gives the **site root**, and that is what
   * makes ORIGIN GONE distinguishable from PATH MOVED: a renamed repo takes the
   * root down with it, while a wrong suffix leaves a perfectly healthy root
   * above a tree of 404s.
   *
   * ⚠️ This is not asserted against the endpoint. If a future endpoint carries no
   * suffix the site root is the endpoint itself, the liveness probe still
   * answers, and a dropped suffix shows up where it should — as every page
   * probe 404ing under a live root, which reads out as PATH MOVED.
   */
  suffix: string;
  /**
   * A document that exists whenever this site is served **and does not sit under
   * the suffix**, resolved against the site root. Per-origin because the two
   * sites are built differently and neither serves the obvious thing: Docusaurus
   * publishes no document at its own `routeBasePath`, and the content origin has
   * no `index.html` at all (measured 2026-09-11: `/nodegx-content/` is 404 on a
   * perfectly healthy origin). Using "the root" as a liveness signal would have
   * called both of them dead.
   */
  liveness: Probe;
  probes: Probe[];
}

type Verdict = 'ok' | 'PATH MOVED';

interface Result extends Probe {
  url: string;
  status: number | null;
  /** Set when the request never got an HTTP answer. */
  error?: string;
}

/**
 * One request, retried to ride out a Pages blip. Returns the **final** status
 * after redirects: Docusaurus 301s `/docs/nodes/logic/and` to the same path with
 * a trailing slash, and treating that as a failure would fail every node page.
 *
 * `null` status means no HTTP answer at all — the UNAVAILABLE case, which is
 * categorically different from a 404 and must never collapse into one.
 */
async function probe(url: string, attempts = ATTEMPTS): Promise<{ status: number | null; error?: string }> {
  let lastError = '';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
      return { status: res.status };
    } catch (err) {
      lastError = (err as Error).message;
    }
    if (attempt < attempts) await new Promise((r) => setTimeout(r, attempt * 1000));
  }
  return { status: null, error: lastError };
}

/**
 * 🔴 The property that matters most here is a NEGATIVE one: this gate must never
 * exit 0 without having reached anything. An absence assertion is only worth
 * reading beside a known-firing signal, so the failure paths are exercised on
 * every run rather than checked by hand once.
 *
 * AC3 asks for this explicitly — *prove it by pointing the check at a dead host
 * and watching it fail* — and asks that the proof distinguish unreachable from
 * wrong path, so both are armed here:
 *
 *   - a dead host must come back with a `null` status (UNAVAILABLE), not a
 *     status code, and not an exception this script would report as a crash;
 *   - `classify()` must return ORIGIN GONE for that, and PATH MOVED for a live
 *     origin with a missing page — the two verdicts LIB-008 is about;
 *   - and a healthy origin must still classify as `ok`, so the checks above are
 *     shown to be discriminating rather than merely strict.
 *
 * Port 1 on loopback refuses instantly and needs no DNS, so the network half
 * costs milliseconds. `attempts` is 1 so the retry backoff is not paid for a
 * failure that is certain.
 */
async function selfTest(): Promise<string[]> {
  const failures: string[] = [];

  const dead = await probe('http://127.0.0.1:1/docs/', 1);
  if (dead.status !== null) {
    failures.push(
      `self-test: a dead host answered with status ${dead.status} instead of nothing — ` +
        `this gate could report a verdict without reaching an origin`
    );
  }

  const cases: Array<[string, Result[], ReturnType<typeof classify>]> = [
    ['a dead host', [{ path: '/', what: 'liveness', url: 'x', status: null, error: 'ECONNREFUSED' }], 'UNAVAILABLE'],
    ['a 404 liveness probe', [{ path: '/', what: 'liveness', url: 'x', status: 404 }], 'ORIGIN GONE'],
    ['a live origin missing a page', [{ path: '/', what: 'liveness', url: 'x', status: 200 }], 'ok']
  ];
  for (const [what, results, expected] of cases) {
    const actual = classify(results[0], []);
    if (actual !== expected) failures.push(`self-test: ${what} classified as ${actual}, expected ${expected}`);
  }

  const moved = classify({ path: '/', what: 'liveness', url: 'x', status: 200 }, [
    { path: '/nodes/logic/and', what: 'a node page', url: 'x', status: 404 }
  ]);
  if (moved !== 'PATH MOVED') {
    failures.push(`self-test: a live origin with a 404 page classified as ${moved}, expected PATH MOVED`);
  }

  // The negative control for the control: an optional 404 must NOT move the
  // verdict, or "everything is required" would pass every row above too.
  const optional = classify({ path: '/', what: 'liveness', url: 'x', status: 200 }, [
    { path: '/whats-new/feed.json', what: 'decoration', url: 'x', status: 404, optional: true }
  ]);
  if (optional !== 'ok') failures.push(`self-test: an optional 404 changed the verdict to ${optional}`);

  return failures;
}

function classify(liveness: Result, pages: Result[]): Verdict | 'UNAVAILABLE' | 'ORIGIN GONE' {
  if (liveness.status === null) return 'UNAVAILABLE';
  if (liveness.status !== 200) return 'ORIGIN GONE';
  // A page that could not be reached at all, on an origin that just answered,
  // is a blip rather than an outage — but it is still not a 200, and calling it
  // one would be the failure mode this whole file is about.
  if (pages.some((p) => !p.optional && p.status !== 200)) return 'PATH MOVED';
  return 'ok';
}

/** The docs origin's probes, resolved through the editor's own derivation. */
function docsProbes(): Probe[] {
  return [
    // A generated node page, addressed exactly as the property panel and the
    // node picker address it. `And` is in the catalog and its page is generated.
    { path: nodeDocsPath('And'), what: 'a node page (property panel, node picker)' },
    // A node whose legacy URL and generated route DISAGREE. Before LIB-008 this
    // one resolved to `/nodes/data/user/log-in` and 404'd on a healthy origin —
    // it is here so a regression to the legacy derivation cannot pass.
    { path: nodeDocsPath('net.noodl.user.LogIn'), what: 'a node whose legacy URL and route disagree' },
    // A hand-authored page, so this is not only a claim about generated output.
    { path: '/custom-nodes', what: 'the hand-authored custom-nodes guide' }
  ];
}

const ORIGINS: Origin[] = [
  {
    name: 'docs',
    endpoint: getDocsEndpoint(),
    source: 'packages/noodl-editor/src/editor/src/utils/getDocsEndpoint.ts',
    suffix: '/docs',
    // The Docusaurus landing page. `/docs/` itself is a 404 on a healthy site —
    // Docusaurus creates no document at `routeBasePath` unless a doc claims
    // `slug: /`, and none does — so the root above the suffix is the signal.
    liveness: { path: '/', what: 'the docs site itself' },
    probes: docsProbes()
  },
  {
    name: 'content',
    endpoint: getContentEndpoint(),
    source: 'packages/noodl-editor/src/editor/src/utils/getContentEndpoint.ts',
    suffix: '/static',
    // The repo's own README, served verbatim because the rename re-ran Pages as
    // a *legacy* build that publishes the repo tree. It is the only document on
    // this origin that is not under `/static`, which is exactly what makes it
    // able to tell a gone origin from a moved suffix.
    //
    // ⚠️ Its failure mode is a false ORIGIN GONE if that README is ever deleted.
    // That is loud, lands beside four payload probes that would still be green,
    // and is a one-line fix here — the opposite of the silence LIB-008 was.
    liveness: { path: '/README.md', what: "the content repo's README, served above /static" },
    probes: [
      { path: '/library/prefabs/index.json', what: 'the prefab library index' },
      { path: '/library/modules/index.json', what: 'the module library index' },
      { path: '/lessons/index.json', what: 'the Learn lesson list' },
      { path: '/tutorials/index.json', what: 'the tutorials list' },
      { path: '/whats-new/feed.json', what: "the what's-new feed", optional: true }
    ]
  }
];

/** The site root: the endpoint with its build-shaped suffix taken off. */
function siteRoot(origin: Origin): string {
  return origin.endpoint.endsWith(origin.suffix)
    ? origin.endpoint.slice(0, -origin.suffix.length)
    : origin.endpoint;
}

async function run(origin: Origin) {
  const resolve = async (base: string, p: Probe): Promise<Result> => {
    const url = `${base}${p.path}`;
    const { status, error } = await probe(url);
    return { ...p, url, status, error };
  };

  const liveness = await resolve(siteRoot(origin), origin.liveness);
  // Nothing below a dead liveness probe is worth asking: on a gone origin every
  // page 404s, and printing ten of them buries the one fact that matters.
  const pages =
    liveness.status === 200 ? await Promise.all(origin.probes.map((p) => resolve(origin.endpoint, p))) : [];
  return { origin, liveness, pages, verdict: classify(liveness, pages) };
}

async function main() {
  for (const origin of ORIGINS) {
    if (typeof origin.endpoint !== 'string' || !origin.endpoint.startsWith('http')) {
      console.error(`${origin.name}: endpoint is ${JSON.stringify(origin.endpoint)} — cannot address the origin.`);
      process.exit(2);
    }
  }

  const selfTestFailures = await selfTest();
  if (selfTestFailures.length) {
    console.error('\n🔴 This gate cannot be trusted to fail — its own failure paths are broken:');
    for (const f of selfTestFailures) console.error(`   ${f}`);
    process.exit(2);
  }

  const runs = await Promise.all(ORIGINS.map(run));

  if (AS_JSON) {
    console.log(
      JSON.stringify(
        runs.map((r) => ({
          origin: r.origin.name,
          endpoint: r.origin.endpoint,
          verdict: r.verdict,
          liveness: { path: r.liveness.path, status: r.liveness.status, error: r.liveness.error },
          pages: r.pages.map((p) => ({ path: p.path, status: p.status, optional: !!p.optional, error: p.error }))
        })),
        null,
        2
      )
    );
  } else {
    console.log('LIB-008 — both editor origins, resolved by calling the editor\'s own functions.\n');
    for (const r of runs) {
      console.log(`${r.origin.name}: ${r.origin.endpoint}`);
      const show = (p: Result, label: string) => {
        const mark = p.status === 200 ? '   ok  ' : p.optional ? '   note' : '   🔴  ';
        const code = p.status === null ? `no answer (${p.error})` : String(p.status);
        console.log(`${mark} ${code.padEnd(22)} ${label}${p.path}  — ${p.what}`);
      };
      show(r.liveness, 'liveness ');
      for (const p of r.pages) show(p, '         ');
      console.log('');
    }

    for (const r of runs) {
      if (r.verdict === 'ok') continue;
      if (r.verdict === 'UNAVAILABLE') {
        console.error(
          `🔴 ${r.origin.name}: ORIGIN UNAVAILABLE — nothing was checked.\n` +
            `   ${r.liveness.url}: ${r.liveness.error}\n` +
            `   This is NOT a pass. Re-run with network access.`
        );
      } else if (r.verdict === 'ORIGIN GONE') {
        console.error(
          `🔴 ${r.origin.name}: ORIGIN GONE — the host answered ${r.liveness.status} for ${r.liveness.url}.\n` +
            `   The site is not being served there. GitHub Pages does NOT follow a repo-rename\n` +
            `   redirect, so a rename, a disabled Pages, or a changed baseUrl all look like this.\n` +
            `   Fix the origin in ${r.origin.source}.`
        );
      } else {
        const moved = r.pages.filter((p) => !p.optional && p.status !== 200);
        console.error(
          `🔴 ${r.origin.name}: PATH MOVED — the origin is alive, ${moved.length} known ` +
            `${moved.length === 1 ? 'page is' : 'pages are'} not where the editor looks.\n` +
            moved.map((p) => `   ${p.status ?? 'no answer'}  ${p.url}  — ${p.what}`).join('\n') +
            `\n   The origin is right and the path is wrong: check the suffix in ${r.origin.source}\n` +
            `   against how that site is built, and the path derivation that produced these.`
        );
      }
    }
  }

  const failed = runs.filter((r) => r.verdict !== 'ok');
  if (!failed.length) {
    if (!AS_JSON) console.log('Both origins serve every page the editor asks them for.');
    process.exit(0);
  }
  process.exit(failed.some((r) => r.verdict === 'UNAVAILABLE') ? 2 : 1);
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(2);
});
