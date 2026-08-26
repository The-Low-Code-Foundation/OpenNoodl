/**
 * SB-006 — the public site, authored through the real MCP surface **beside the
 * admin panel**, because the template is one app.
 *
 * 🔴 **Read this before reading a green run as evidence of anything.** Four
 * sessions in this phase have produced a green authoring run; three of them
 * shipped something broken. Everything below is a claim about graphs on disk.
 * **The behavioural claim — that an anonymous visitor sees a published page and
 * 404s an unpublished one, through this site — is SB-008's**, and SB-006 §5
 * lists it as unmet. Nothing here stands in for it.
 *
 * Both panels are authored into one project on purpose. Two of this suite's
 * checks are about the *pair* and cannot be made on either alone:
 *
 *  - the Router's page patterns must be unambiguous, and the public site is a
 *    catch-all, so every admin path is part of that question (acceptance 2);
 *  - the theme keys and the section payload are contracts between the panel and
 *    the site, written in two files, checked in neither until now (acceptance 5).
 */
import * as fs from 'fs';
import * as path from 'path';

import type { TestSession } from './helpers';
import { call, connect, copyFixture } from './helpers';
import {
  ADMIN_PATH_PREFIX,
  SB005_COMPONENTS,
  createPass as createPass005
} from './sb005Components';
import {
  CONTACT_REFUSAL_TEXT,
  NOT_FOUND_TEXT,
  SB006_COMPONENTS,
  SITE_URL_PATH,
  THEME_KEYS,
  createPass
} from './sb006Components';

jest.setTimeout(120000);

interface Diag {
  code: string;
  severity: string;
  message: string;
}
interface CreateResponse {
  created: string;
  legacyName: string;
  type: string;
  registeredPages?: { router: string; added: string[]; startPage?: string };
  validation: { summary: { errors: number; warnings: number; infos: number }; diagnostics?: Diag[] };
}
interface ErrorResponse {
  error: { code: string; message: string; details?: { readable?: string[]; newErrors?: Diag[] } };
}
type Either = CreateResponse & ErrorResponse;

interface GraphNode {
  id: string;
  type: string;
  /** The one stable handle a lookup may use — node ids are reallocated (SB-004 F9). */
  label?: string;
  parameters?: Record<string, unknown>;
  children?: string[];
  ports?: Array<{ name: string; type?: string; plug?: string }>;
}
interface Graph {
  nodes: GraphNode[];
  visualRoots?: string[];
}
interface Wire {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}
interface Wires {
  connections: Wire[];
}
interface RegistryFile {
  components: Record<string, { type?: string; path?: string }>;
}

const readJson = <T>(dir: string, rel: string): T =>
  JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf-8')) as T;

/** Print whatever the door said, so a rejection is evidence rather than a red. */
function say(label: string, res: { isError: boolean; data: Either }): void {
  const readable = res.data?.error?.details?.readable;
  // eslint-disable-next-line no-console
  console.log(
    `\n[${label}] isError=${res.isError}` +
      (res.data?.validation?.summary ? ` summary=${JSON.stringify(res.data.validation.summary)}` : '') +
      (res.data?.error ? `\n  ${res.data.error.code}: ${res.data.error.message}` : '') +
      (readable ? `\n  ${readable.join('\n  ')}` : '')
  );
}

interface Written {
  graph: Graph;
  wires: Wire[];
}
const readWritten = (dir: string, key: string): Written => ({
  graph: readJson<Graph>(dir, `components/${key}/nodes.json`),
  wires: readJson<Wires>(dir, `components/${key}/connections.json`).connections
});
const clone = (w: Written): Written => JSON.parse(JSON.stringify(w)) as Written;

/**
 * 🔴 Resolve by TYPE and label, never by the id that was sent — node ids are
 * made unique across the PROJECT, so an authored `sections` may land as
 * `sections-2` (SB-004 F9).
 */
function byType(w: Written, type: string): GraphNode[] {
  return w.graph.nodes.filter((n) => n.type === type);
}
function byLabel(w: Written, type: string, label: string): GraphNode {
  const found = w.graph.nodes.filter((n) => n.type === type && n.label === label);
  expect(`${type}/${label}:${found.length}`).toBe(`${type}/${label}:1`);
  return found[0];
}
const scriptOf = (n: GraphNode): string => String(n.parameters?.functionScript ?? '');

// ── The Router's own matching rule, re-implemented ───────────────────────────

/**
 * `router.tsx:747-757`, verbatim in behaviour: split both sides on `/`, a
 * `{name}` segment matches any segment, a literal must be equal, and the pattern
 * must not be longer than the path. A pattern SHORTER than the path still
 * matches — the remainder is handed to a nested router — which is exactly why
 * distance, below, is the thing that separates a catch-all from an exact hit.
 */
function matches(pathParts: string[], patternParts: string[]): boolean {
  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];
    if (p[0] === '{' && p[p.length - 1] === '}') {
      if (pathParts[i] === undefined) return false;
    } else if (pathParts[i] === undefined || p !== pathParts[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Which page the Router would show for a concrete path, and whether anything
 * ties with it.
 *
 * `router.tsx:775-783` keeps the smallest `|patternParts − pathParts|` and, on a
 * tie, the **first** page in the Router's list — the guard is `bestMatchLength >
 * dist`, not `>=`. So a tie is not a bug in itself; it is a silent dependence on
 * the order the components happened to be written in, which is what this returns
 * so a test can refuse it.
 */
function resolve(
  urlPath: string,
  pages: ReadonlyArray<{ component: string; pattern: string }>
): { winners: string[]; distance: number } {
  const pathParts = urlPath.replace(/^\//, '').split('/');
  let best = Number.MAX_SAFE_INTEGER;
  let winners: string[] = [];
  for (const page of pages) {
    const patternParts = page.pattern.replace(/^\//, '').replace(/\/$/, '').split('/');
    if (!matches(pathParts, patternParts)) continue;
    const dist = Math.abs(patternParts.length - pathParts.length);
    if (dist < best) {
      best = dist;
      winners = [page.component];
    } else if (dist === best) {
      winners.push(page.component);
    }
  }
  return { winners, distance: best };
}

/** A concrete URL that page is meant to answer on: its own pattern, filled in. */
function sampleUrl(pattern: string): string {
  return (
    '/' +
    pattern
      .replace(/^\//, '')
      .split('/')
      .map((seg, i) => (seg.startsWith('{') ? `sample${i}` : seg))
      .join('/')
  );
}

// ── The checks, as pure functions so a mutant can be graded against them ─────

/**
 * Acceptance 2 — every page of this template is reachable at its own URL, with
 * nothing tying for it.
 *
 * The mutant that matters is the one this criterion was written from: put an
 * admin page back at one segment and it ties with `{slug}` on its own URL.
 */
export function assertUnambiguousRouting(pages: ReadonlyArray<{ component: string; pattern: string }>): void {
  for (const page of pages) {
    const url = sampleUrl(page.pattern);
    const { winners } = resolve(url, pages);
    // Both halves in the message: which URL, and everything that answered it.
    expect(`${url} → ${winners.join(' AND ')}`).toBe(`${url} → ${page.component}`);
  }
}

/** Acceptance 4's port-filtered half — SB-005's rule, unchanged, on this side. */
export function assertPortFilteredQuery(w: Written, label: string, property: string): void {
  const node = byLabel(w, 'DbCollection2', label);
  expect(node.parameters?.['runOnChange-collectionName']).toBe(false);
  expect(node.parameters?.['runOnChange-querySettings']).toBe(false);

  const filter = node.parameters?.visualFilter as {
    rules?: Array<{ property?: string; input?: string; value?: unknown; operator?: string }>;
  };
  const rule = (filter?.rules ?? []).find((r) => r.property === property);
  expect(rule).toBeDefined();
  // `points to` is the operator that needs a schema and widens when it cannot
  // narrow (SB-004 F13).
  expect(rule?.operator).toBe('equal to');
  expect(typeof rule?.input).toBe('string');

  // A rule whose minted port has no wire narrows nothing: `collectFilterParameters`
  // drops a rule with an undefined value, and a dropped rule matches every row.
  const port = `qp-${rule?.input}`;
  const feeds = w.wires.filter((c) => c.toId === node.id && c.toProperty === port);
  expect(`${label} feeds:${feeds.length}`).toBe(`${label} feeds:1`);

  const filterSource = feeds[0].fromId;
  for (const t of w.wires.filter((c) => c.toId === node.id && c.toProperty === 'storageFetch')) {
    const from = w.graph.nodes.find((n) => n.id === t.fromId);
    expect(`${label} triggered by ${from?.label}:${t.fromId === filterSource ? 'THE FILTER SOURCE' : 'ok'}`).toBe(
      `${label} triggered by ${from?.label}:ok`
    );
  }
}

/**
 * Acceptance 4's other half, and the shape SB-005 did not have: a query filtered
 * by a **literal**.
 *
 * `visualQueryToNeutral` reads `rule.value` when there is no `input`
 * (`saved.ts:271`) and `collectFilterParameters` mints no port for it
 * (`queryutils.ts:204-208`) — so the graph-build fetch is already narrowed and
 * there is no parameter left for anything to set. Switching the boxes off here
 * would leave the query with no trigger at all, which is s4's `claimSite`
 * defect: **the precondition of SB-004's fix is a filter PORT, not a filter.**
 */
export function assertLiteralFilteredQuery(w: Written, label: string, property: string): void {
  const node = byLabel(w, 'DbCollection2', label);
  const filter = node.parameters?.visualFilter as {
    rules?: Array<{ property?: string; input?: string; value?: unknown; operator?: string }>;
  };
  const rule = (filter?.rules ?? []).find((r) => r.property === property);
  expect(rule).toBeDefined();
  expect(rule?.input).toBeUndefined();
  expect(rule?.value).not.toBeUndefined();

  // Stated as presence, so the message says which setting is wrong rather than
  // "expected false to be undefined".
  expect(`${label} runOnChange-collectionName`).toBe(
    `${label} runOnChange-collectionName${node.parameters?.['runOnChange-collectionName'] === false ? ' SUPPRESSED' : ''}`
  );
  expect(`${label} runOnChange-querySettings`).toBe(
    `${label} runOnChange-querySettings${node.parameters?.['runOnChange-querySettings'] === false ? ' SUPPRESSED' : ''}`
  );
}

/** And the third: an unfiltered singleton, which keeps its load-time fetch too. */
export function assertUnfilteredQuery(w: Written, label: string): void {
  const node = byLabel(w, 'DbCollection2', label);
  expect(node.parameters?.visualFilter).toBeUndefined();
  expect(`${label} runOnChange-collectionName`).toBe(
    `${label} runOnChange-collectionName${node.parameters?.['runOnChange-collectionName'] === false ? ' SUPPRESSED' : ''}`
  );
}

/**
 * Acceptance 3 — the public site writes nothing, and there is exactly one door
 * out of it.
 *
 * `ContactMessage.create` is `nobody` (SB-004 §4): the class is only ever
 * written by `submitContactForm`, running as system. A `Create Record` here
 * would be refused by the backend at run time and accepted by every gate, so
 * this is asserted as an absence rather than left to review.
 */
export function assertReadOnlySite(entries: ReadonlyArray<readonly [string, Written]>): void {
  for (const [key, w] of entries) {
    for (const type of ['NewDbModelProperties', 'SetDbModelProperties', 'DeleteDbModelProperties']) {
      const found = byType(w, type).map((n) => n.label ?? n.id);
      expect(`${key} ${type}: ${found.join(', ')}`).toBe(`${key} ${type}: `);
    }
  }
}

/**
 * Acceptance 6 — the not-found panel is not wired from `isEmpty`.
 *
 * `isEmpty` is `true` before the first query has run, by its own description
 * (`dbcollectionnode2.ts:410-419`). A "page not found" wired to it is visible to
 * every visitor until the query answers — and on a port-filtered query the first
 * fetch waits for the slug, so that is a state and not a flash. The panel's
 * visibility must come from something that did not exist before a fetch.
 */
export function assertNotFoundIsNotIsEmpty(w: Written): void {
  const reads = w.wires
    .filter((c) => c.fromProperty === 'isEmpty')
    .map((c) => `${w.graph.nodes.find((n) => n.id === c.fromId)?.label}.isEmpty`);
  expect(reads).toEqual([]);

  const notFound = w.graph.nodes.find((n) => n.parameters?.text === NOT_FOUND_TEXT);
  expect(notFound).toBeDefined();
  // Authored hidden, and only a code node may reveal it.
  expect(notFound?.parameters?.visible).toBe(false);
  const feeds = w.wires.filter((c) => c.toId === notFound?.id && c.toProperty === 'visible');
  expect(feeds.length).toBe(1);
  const source = w.graph.nodes.find((n) => n.id === feeds[0].fromId);
  expect(source?.type).toBe('JavaScriptFunction');
  // And that code node must abstain until rows have arrived, or its first,
  // rows-less run publishes `missing: true` to the very same port.
  expect(scriptOf(source as GraphNode)).toContain('if (Inputs.rows === undefined) return;');
}

/**
 * Acceptance 7 — the two halves of a `Page` node's SEO surface, which look
 * identical from the outside and are not.
 *
 * `description` (and every other metatag) is forwarded to `Noodl.SEO.setMeta` on
 * each update (`Page.tsx:162-168`), so the port is live. `title` is not: the
 * Router sets the document title from `routerIndex.pages[].title`
 * (`router.tsx:584`), which the exporter copies out of the **parameter**. A wire
 * into `Page.title` therefore looks like the fix and does nothing, on the one
 * template whose whole point is SEO.
 */
export function assertSeoSplit(w: Written): void {
  const page = byLabel(w, 'Page', 'Site');

  const intoTitle = w.wires.filter((c) => c.toId === page.id && c.toProperty === 'title');
  expect(`wires into Page.title: ${intoTitle.length}`).toBe('wires into Page.title: 0');

  const intoDescription = w.wires.filter((c) => c.toId === page.id && c.toProperty === 'description');
  expect(`wires into Page.description: ${intoDescription.length}`).toBe('wires into Page.description: 1');

  const seo = w.graph.nodes.find(
    (n) => n.type === 'JavaScriptFunction' && scriptOf(n).includes('Noodl.SEO.setTitle')
  );
  expect(seo).toBeDefined();
  expect(w.wires.some((c) => c.toId === seo?.id && c.toProperty === 'in-title')).toBe(true);
}

/**
 * Acceptance 8 — every browser global a code node touches is tested for first.
 *
 * `createNoodlAPI` returns `window.Noodl` **or `{}`**
 * (`javascriptnodeparser.js:497-501`), and the SSR/SSG entries render this
 * bundle with no `document`. This is the template most likely to be deployed
 * server-rendered, so an unguarded reference is a page that fails to render
 * rather than a page that renders plainly.
 */
export function assertGlobalsGuarded(entries: ReadonlyArray<readonly [string, Written]>): string[] {
  const guarded: string[] = [];
  for (const [key, w] of entries) {
    for (const node of byType(w, 'JavaScriptFunction')) {
      const script = scriptOf(node);
      const row = `${key}/${node.label}`;
      if (/\bdocument\b/.test(script)) {
        expect(
          `${row} document${script.includes("typeof document === 'undefined'") ? ' guarded' : ' UNGUARDED'}`
        ).toBe(`${row} document guarded`);
        guarded.push(`${row}:document`);
      }
      if (/\bNoodl\./.test(script)) {
        expect(`${row} Noodl${/if \(!Noodl \|\| !Noodl\./.test(script) ? ' guarded' : ' UNGUARDED'}`).toBe(
          `${row} Noodl guarded`
        );
        guarded.push(`${row}:Noodl`);
      }
    }
  }
  return guarded;
}

/** One row per code node: what its script *calls* as a signal, and what it declares. */
function signalPortRows(entries: ReadonlyArray<readonly [string, Written]>): string[] {
  const rows: string[] = [];
  for (const [key, w] of entries) {
    for (const node of byType(w, 'JavaScriptFunction')) {
      const script = scriptOf(node);
      const emitted = [...new Set([...script.matchAll(/Outputs\.(\w+)\s*\(\)/g)].map((m) => m[1]))].sort();
      const declared = (node.ports ?? [])
        .filter((p) => p.plug === 'output' && p.type === 'signal')
        .map((p) => p.name.replace(/^out-/, ''))
        .sort();
      rows.push(`${key}/${node.label}: emits=${emitted.join('|')} declared=${declared.join('|')}`);
    }
  }
  return rows;
}

/** The keys a script reads off an object, as `prefix.key`. */
function keysRead(script: string, prefix: string): string[] {
  return [...new Set([...script.matchAll(new RegExp(`\\b${prefix}\\.(\\w+)`, 'g'))].map((m) => m[1]))].sort();
}

describe('SB-006: the public site, beside the panel it shares a router with', () => {
  let session: TestSession;
  let dir: string;
  const written: Record<string, Written> = {};
  const results: Record<string, { isError: boolean; data: Either }> = {};
  let registration: CreateResponse['registeredPages'];
  let router: GraphNode | undefined;

  beforeAll(async () => {
    dir = copyFixture();
    session = await connect(dir);

    // 🔴 The known-firing arm for the two-pass structure, and it runs FIRST, on
    // a project where `/Pages/Site` does not exist — otherwise "we authored in
    // two passes" is a habit rather than a measurement. This is the whole
    // component, back-link and all, offered exactly as an agent would offer it.
    const cyclic = SB006_COMPONENTS.find((c) => c.deferred?.length)!;
    results.__control__ = await call<Either>(session, 'create_component', {
      path: cyclic.path,
      nodes: cyclic.nodes,
      connections: cyclic.connections
    });
    say(`CONTROL: ${cyclic.path} with its back-link, nothing else authored`, results.__control__);

    // 🔴 **The site is authored FIRST, and the order is load-bearing.** The door
    // makes the first page it writes the router's start page when home is up for
    // grabs (`registerPages` → `resolvePageRegistration`), so authoring the panel
    // first leaves the app opening on `/Pages/PageEditor` — a page whose URL
    // pattern requires a `{pageId}` nobody has. Measured, not assumed; the
    // property that matters is asserted below rather than the order.
    for (const c of SB006_COMPONENTS) {
      const payload = createPass(c);
      const res = await call<Either>(session, 'create_component', {
        path: c.path,
        nodes: payload.nodes,
        connections: payload.connections
      });
      say(`create ${c.path}`, res);
      results[c.key] = res;
      if (res.data?.registeredPages) registration = res.data.registeredPages;
    }
    // …then close the cycle the create pass could not name.
    for (const c of SB006_COMPONENTS) {
      if (!c.deferred?.length) continue;
      const res = await call<Either>(session, 'update_component', {
        path: c.path,
        set: { nodes: c.nodes, connections: c.connections }
      });
      say(`close ${c.path}`, res);
      results[`${c.key}:update`] = res;
    }

    // Then the panel, which shares this site's router. Its own suite grades it;
    // here it is the other half of the routing question.
    for (const c of SB005_COMPONENTS) {
      const payload = createPass005(c);
      await call<Either>(session, 'create_component', {
        path: c.path,
        nodes: payload.nodes,
        connections: payload.connections
      });
    }
    for (const c of SB005_COMPONENTS) {
      if (!c.deferred?.length) continue;
      await call<Either>(session, 'update_component', { path: c.path, set: { nodes: c.nodes, connections: c.connections } });
    }
    router = readJson<{ nodes: GraphNode[] }>(dir, 'components/App/nodes.json').nodes.find((n) => n.type === 'Router');

    for (const c of [...SB005_COMPONENTS, ...SB006_COMPONENTS]) {
      if (fs.existsSync(path.join(dir, `components/${c.key}/nodes.json`))) written[c.key] = readWritten(dir, c.key);
    }
  });
  afterAll(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const siteEntries = (): Array<readonly [string, Written]> =>
    SB006_COMPONENTS.map((c) => [c.key, written[c.key]] as const);

  /** Every page in the finished template, as the Router sees it. */
  const allPages = (): Array<{ component: string; pattern: string }> =>
    [...SB005_COMPONENTS, ...SB006_COMPONENTS]
      .filter((c) => c.isPage)
      .map((c) => {
        const page = byType(written[c.key], 'Page')[0];
        return { component: c.legacyName, pattern: String(page.parameters?.urlPath) };
      });

  it('lands all five surfaces, the site with a Page root (acceptance 1)', () => {
    const registry = readJson<RegistryFile>(dir, 'components/_registry.json');
    for (const c of SB006_COMPONENTS) {
      expect(`${c.path}:${results[c.key].isError}`).toBe(`${c.path}:false`);
      expect(`${c.path}:${results[c.key].data.legacyName}`).toBe(`${c.path}:${c.legacyName}`);
      expect(registry.components[c.key]).toBeDefined();
      if (c.isPage) {
        const roots = written[c.key].graph.visualRoots ?? [];
        const rootNode = written[c.key].graph.nodes.find((n) => n.id === roots[0]);
        expect(`${c.path} root:${rootNode?.type}`).toBe(`${c.path} root:Page`);
      }
    }
    // And it went into the router the panel already uses, not a second one.
    expect(registration?.added).toEqual(['/Pages/Site']);
    expect(registration?.router).toBe('/App');
  });

  /**
   * The start page, and a property rather than a name.
   *
   * The Router falls back to `pages.startPage` only when nothing matched the URL
   * (`router.tsx:466`), which a catch-all makes rare — but "rare" is the wrong
   * safety margin for the page an app opens on. What must hold is that the start
   * page and the page the **root URL** resolves to are the same one. Where they
   * differ, the fallback shows something no address would, and for this template
   * the difference was `/Pages/PageEditor` — `admin/page/{pageId}`, an editor for
   * no record.
   *
   * ⚠️ The door chooses the **first page written** when home is unclaimed, so a
   * template's authoring order decides where its app opens. Authoring the panel
   * first put the page editor here — measured, and the reason the site is
   * authored first above.
   */
  it('the app opens on the page the root URL resolves to', () => {
    const pages = (router?.parameters?.pages ?? {}) as { startPage?: string; routes?: string[] };
    expect(pages.routes).toContain('/Pages/Site');
    const atRoot = resolve('/', allPages()).winners;
    expect(`startPage ${pages.startPage} · root URL ${atRoot.join(' AND ')}`).toBe(
      `startPage /Pages/Site · root URL /Pages/Site`
    );
  });

  it('CONTROL: the nav link really is refused before the page it points at exists', () => {
    const res = results.__control__;
    expect(res.isError).toBe(true);
    // Named by CODE, not by "it errored": the arm is worthless if the rejection
    // could have been a bad port or a malformed script.
    const readable = (res.data.error?.details?.readable ?? []).join('\n');
    expect(readable).toContain('unresolved-navigation');
    expect(readable).toContain('/Pages/Site');
    // And nothing was written — the second half of why a second pass is needed.
    const cyclic = SB006_COMPONENTS.find((c) => c.deferred?.length)!;
    expect(results[cyclic.key].isError).toBe(false);
    expect(results[`${cyclic.key}:update`].isError).toBe(false);
  });

  /**
   * Acceptance 2, and the one check that could only be made with both panels in
   * the same project.
   */
  it('every page of the template answers on its own URL, with nothing tying (acceptance 2)', () => {
    const pages = allPages();
    // The census first: five pages, and the site's is the catch-all.
    expect(pages.length).toBe(5);
    expect(pages.filter((p) => p.pattern === SITE_URL_PATH).map((p) => p.component)).toEqual(['/Pages/Site']);
    expect(pages.filter((p) => p.component !== '/Pages/Site').every((p) => p.pattern.split('/').length >= 2)).toBe(true);

    assertUnambiguousRouting(pages);

    // And the two URLs no page's own pattern produces: the root, and an
    // ordinary content slug. Both are the catch-all's, uniquely.
    expect(resolve('/', pages).winners).toEqual(['/Pages/Site']);
    expect(resolve('/about', pages).winners).toEqual(['/Pages/Site']);
    // The admin landing, which is the one that used to tie.
    expect(resolve(`/${ADMIN_PATH_PREFIX}/pages`, pages).winners).toEqual(['/Pages/Admin']);
  });

  it("MUTANT: an admin page back at one segment ties with the site's catch-all", () => {
    const pages = allPages().map((p) => (p.component === '/Pages/Admin' ? { ...p, pattern: ADMIN_PATH_PREFIX } : p));
    // The tie is real and it is a tie — both names come back, and which one wins
    // is the order the Router's list happens to be in.
    expect(resolve(`/${ADMIN_PATH_PREFIX}`, pages).winners.sort()).toEqual(['/Pages/Admin', '/Pages/Site']);
    expect(() => assertUnambiguousRouting(pages)).toThrow();
  });

  it('MUTANT: a second page at the catch-all pattern reddens', () => {
    // The version an author actually writes: a separate `Home` page at `''`
    // beside `{slug}`. Both are one segment and both match the root.
    const pages = [...allPages(), { component: '/Pages/Home', pattern: '' }];
    expect(() => assertUnambiguousRouting(pages)).toThrow();
  });

  it('the three query shapes, asserted together (acceptance 4)', () => {
    const site = written['Pages/Site'];
    // Port-filtered: the boxes off, and no trigger from the filter's own source.
    assertPortFilteredQuery(site, 'The page with this slug', 'slug');
    assertPortFilteredQuery(site, "This page's sections", 'pageId');
    // Literal-filtered: the boxes ON, because there is no port to trigger it.
    assertLiteralFilteredQuery(written['Site/Nav'], 'Pages in the navigation', 'showInNav');
    // Unfiltered singletons: the boxes ON, for the same reason.
    assertUnfilteredQuery(site, 'SiteSettings (one row)');
    assertUnfilteredQuery(site, 'Theme (one row)');
  });

  it("MUTANT: suppressing the nav query's load-time fetch reddens (s4's claimSite defect)", () => {
    const mutant = clone(written['Site/Nav']);
    const q = mutant.graph.nodes.find((n) => n.label === 'Pages in the navigation')!;
    q.parameters!['runOnChange-collectionName'] = false;
    q.parameters!['runOnChange-querySettings'] = false;
    expect(() => assertLiteralFilteredQuery(mutant, 'Pages in the navigation', 'showInNav')).toThrow();
  });

  it('MUTANT: the nav filter taking its value from a port instead of a literal reddens', () => {
    // The natural "improvement", and the one that turns this into a query with a
    // parameter nothing sets — which is a query with no filter at all.
    const mutant = clone(written['Site/Nav']);
    const q = mutant.graph.nodes.find((n) => n.label === 'Pages in the navigation')!;
    const filter = q.parameters!.visualFilter as { rules: Array<Record<string, unknown>> };
    delete filter.rules[0].value;
    filter.rules[0].input = 'showInNav';
    expect(() => assertLiteralFilteredQuery(mutant, 'Pages in the navigation', 'showInNav')).toThrow();
  });

  it('MUTANT: the page-by-slug query fetching at load reddens', () => {
    const mutant = clone(written['Pages/Site']);
    const q = mutant.graph.nodes.find((n) => n.label === 'The page with this slug')!;
    delete q.parameters!['runOnChange-querySettings'];
    expect(() => assertPortFilteredQuery(mutant, 'The page with this slug', 'slug')).toThrow();
  });

  it('MUTANT: triggering the sections query from its own filter source reddens', () => {
    const mutant = clone(written['Pages/Site']);
    const q = mutant.graph.nodes.find((n) => n.label === "This page's sections")!;
    const feed = mutant.wires.find((c) => c.toId === q.id && c.toProperty === 'qp-pageId')!;
    mutant.wires.push({ fromId: feed.fromId, fromProperty: 'out-found', toId: q.id, toProperty: 'storageFetch' });
    expect(() => assertPortFilteredQuery(mutant, "This page's sections", 'pageId')).toThrow();
  });

  it('the sections render in the order the admin gave them', () => {
    // `Section.order` exists for one reader and this is it. Without a sort the
    // rows arrive in whatever order the backend returns, which is stable enough
    // to look deliberate and is not.
    const q = byLabel(written['Pages/Site'], 'DbCollection2', "This page's sections");
    expect(q.parameters?.visualSort).toEqual([{ property: 'order', order: 'ascending' }]);
    const nav = byLabel(written['Site/Nav'], 'DbCollection2', 'Pages in the navigation');
    expect(nav.parameters?.visualSort).toEqual([{ property: 'navOrder', order: 'ascending' }]);
  });

  it('the public site writes nothing (acceptance 3)', () => {
    assertReadOnlySite(siteEntries());
    // The positive half: there IS a door, and it is the public cloud function.
    const calls = byType(written['Site/ContactForm'], 'CloudFunction2');
    expect(calls.map((n) => n.parameters?.function)).toEqual(['submitContactForm']);
  });

  it('MUTANT: a Create Record on the public site reddens', () => {
    // The version an author writes when the form "obviously" just needs a row:
    // `ContactMessage.create` is `nobody`, so the backend refuses it at run time
    // and every gate here passes it.
    const mutant = clone(written['Site/ContactForm']);
    mutant.graph.nodes.push({
      id: 'writeIt',
      type: 'NewDbModelProperties',
      label: 'Write the message',
      parameters: { collectionName: 'ContactMessage' }
    });
    expect(() => assertReadOnlySite([['Site/ContactForm', mutant]])).toThrow();
  });

  it('the not-found panel is not wired from isEmpty (acceptance 6)', () => {
    assertNotFoundIsNotIsEmpty(written['Pages/Site']);
  });

  it('MUTANT: wiring the not-found panel to isEmpty reddens', () => {
    const mutant = clone(written['Pages/Site']);
    const q = mutant.graph.nodes.find((n) => n.label === 'The page with this slug')!;
    const notFound = mutant.graph.nodes.find((n) => n.parameters?.text === NOT_FOUND_TEXT)!;
    mutant.wires = mutant.wires.filter((c) => !(c.toId === notFound.id && c.toProperty === 'visible'));
    mutant.wires.push({ fromId: q.id, fromProperty: 'isEmpty', toId: notFound.id, toProperty: 'visible' });
    expect(() => assertNotFoundIsNotIsEmpty(mutant)).toThrow();
  });

  it('MUTANT: a not-found reader that acts before rows arrive reddens', () => {
    const mutant = clone(written['Pages/Site']);
    const reader = mutant.graph.nodes.find(
      (n) => n.type === 'JavaScriptFunction' && scriptOf(n).includes('Outputs.missing')
    )!;
    reader.parameters!.functionScript = scriptOf(reader).replace('if (Inputs.rows === undefined) return;\n', '');
    expect(() => assertNotFoundIsNotIsEmpty(mutant)).toThrow();
  });

  it('the title goes through Noodl.SEO and the description through the port (acceptance 7)', () => {
    assertSeoSplit(written['Pages/Site']);
  });

  it('MUTANT: setting the document title by wiring Page.title reddens', () => {
    // The fix that looks right: the port exists, the door accepts the wire, and
    // nothing reads it after export.
    const mutant = clone(written['Pages/Site']);
    const page = mutant.graph.nodes.find((n) => n.type === 'Page')!;
    const reader = mutant.graph.nodes.find(
      (n) => n.type === 'JavaScriptFunction' && scriptOf(n).includes('Outputs.missing')
    )!;
    mutant.wires.push({ fromId: reader.id, fromProperty: 'out-title', toId: page.id, toProperty: 'title' });
    expect(() => assertSeoSplit(mutant)).toThrow();
  });

  it('every browser global a code node touches is guarded (acceptance 8)', () => {
    const guarded = assertGlobalsGuarded(siteEntries());
    // The census half: the loop must have SEEN both globals, or "no unguarded
    // references" would mean "no references".
    expect(guarded.sort()).toEqual([
      'Pages/Site/The document title:Noodl',
      'Pages/Site/The theme record, as CSS variables:document'
    ]);
  });

  it('MUTANT: dropping the SSR guard from the theme applier reddens', () => {
    const mutant = clone(written['Pages/Site']);
    const applier = mutant.graph.nodes.find(
      (n) => n.type === 'JavaScriptFunction' && scriptOf(n).includes('document.documentElement')
    )!;
    applier.parameters!.functionScript = scriptOf(applier).replace("if (typeof document === 'undefined') return;\n", '');
    expect(() => assertGlobalsGuarded([['Pages/Site', mutant]])).toThrow();
  });

  /**
   * Acceptance 5 — the two contracts between the panel and the site, checked
   * across the two files that hold them.
   *
   * Neither is expressible in a type and neither has ever been checked: SB-005
   * writes `Theme.tokens` and `Section.data` and SB-006 reads them, and the two
   * could drift on any edit that reached one file.
   */
  it('the theme keys the panel writes are the keys the site reads (acceptance 5)', () => {
    const build = written['Pages/ThemeEditor'].graph.nodes.find(
      (n) => n.type === 'JavaScriptFunction' && scriptOf(n).includes('Outputs.tokens')
    )!;
    // What `buildTokens` puts on the object it stores.
    const writes = [...new Set([...scriptOf(build).matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]))].sort();

    const apply = written['Pages/Site'].graph.nodes.find(
      (n) => n.type === 'JavaScriptFunction' && scriptOf(n).includes('document.documentElement')
    )!;
    const reads = keysRead(scriptOf(apply), 't');

    expect(`site reads ${reads.join('|')}`).toBe(`site reads ${writes.join('|')}`);
    // And the three colour keys name real tokens from the project's own style
    // vocabulary, not invented custom properties nothing else uses.
    for (const [key, token] of Object.entries(THEME_KEYS)) {
      expect(`${key} → ${token} in applier: ${scriptOf(apply).includes(`'${token}'`)}`).toBe(
        `${key} → ${token} in applier: true`
      );
    }
  });

  it('MUTANT: renaming a theme key on one side only reddens', () => {
    const mutant = clone(written['Pages/Site']);
    const apply = mutant.graph.nodes.find(
      (n) => n.type === 'JavaScriptFunction' && scriptOf(n).includes('document.documentElement')
    )!;
    apply.parameters!.functionScript = scriptOf(apply).replace(/t\.colorText/g, 't.colorForeground');
    const build = written['Pages/ThemeEditor'].graph.nodes.find(
      (n) => n.type === 'JavaScriptFunction' && scriptOf(n).includes('Outputs.tokens')
    )!;
    const writes = [...new Set([...scriptOf(build).matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]))].sort();
    const reads = keysRead(scriptOf(apply), 't');
    expect(() => expect(`site reads ${reads.join('|')}`).toBe(`site reads ${writes.join('|')}`)).toThrow();
  });

  it('the section fields the site renders are fields the panel can write (acceptance 5)', () => {
    // `Admin/SectionRow` folds the author's edits into `data`; whatever it can
    // set is the whole vocabulary a section view may read.
    const merge = written['Admin/SectionRow'].graph.nodes.find(
      (n) => n.type === 'JavaScriptFunction' && scriptOf(n).includes('Outputs.data')
    )!;
    const writes = new Set([...scriptOf(merge).matchAll(/\bnext\.(\w+)\s*=/g)].map((m) => m[1]));

    const unpack = written['Site/SectionView'].graph.nodes.find(
      (n) => n.type === 'JavaScriptFunction' && scriptOf(n).includes('Inputs.data')
    )!;
    const reads = keysRead(scriptOf(unpack), 'd');

    // A field with no author renders blank on every real page and green in
    // every spec, so this is a subset check with the offenders named.
    const orphans = reads.filter((k) => !writes.has(k));
    expect(`section fields with no author: ${orphans.join(', ')}`).toBe('section fields with no author: ');
    expect(reads.length).toBeGreaterThan(0);
  });

  it('MUTANT: a section view reading a field the panel cannot write reddens', () => {
    const merge = written['Admin/SectionRow'].graph.nodes.find(
      (n) => n.type === 'JavaScriptFunction' && scriptOf(n).includes('Outputs.data')
    )!;
    const writes = new Set([...scriptOf(merge).matchAll(/\bnext\.(\w+)\s*=/g)].map((m) => m[1]));
    // `heading` is the field a section view obviously wants and no control writes.
    const reads = keysRead("const d = Inputs.data || {};\nOutputs.heading = d.heading || '';", 'd');
    const orphans = reads.filter((k) => !writes.has(k));
    expect(() =>
      expect(`section fields with no author: ${orphans.join(', ')}`).toBe('section fields with no author: ')
    ).toThrow();
  });

  it("every code node's signal outputs are declared as ports (SB-004 F10)", () => {
    const rows = signalPortRows(siteEntries());
    for (const row of rows) {
      const [, emits, declared] = row.match(/emits=(.*) declared=(.*)$/)!;
      expect(`${row.split(':')[0]} ${emits}`).toBe(`${row.split(':')[0]} ${declared}`);
    }
    // The census half: the loop must have seen every code node, and three of
    // them must actually declare something — otherwise "no mismatches" could
    // mean the door never persisted `ports` and the check compared '' with ''.
    expect(rows.length).toBe(8);
    expect(rows.filter((r) => !r.endsWith('declared=')).length).toBe(3);
  });

  it('MUTANT: dropping a declared signal port reddens', () => {
    const mutant = clone(written['Site/ContactForm']);
    const code = mutant.graph.nodes.find(
      (n) => n.type === 'JavaScriptFunction' && scriptOf(n).includes('Outputs.go()')
    )!;
    code.ports = [];
    expect(() => {
      for (const row of signalPortRows([['Site/ContactForm', mutant]])) {
        const [, emits, declared] = row.match(/emits=(.*) declared=(.*)$/)!;
        expect(`${row.split(':')[0]} ${emits}`).toBe(`${row.split(':')[0]} ${declared}`);
      }
    }).toThrow();
  });

  it('the contact form answers with two constants and reads no error', () => {
    const w = written['Site/ContactForm'];
    const refusal = w.graph.nodes.filter((n) => n.parameters?.text === CONTACT_REFUSAL_TEXT);
    expect(refusal.length).toBe(1);
    expect(w.wires.some((c) => c.toId === refusal[0].id && c.toProperty === 'text')).toBe(false);
    const errorReads = w.wires
      .filter((c) => c.fromProperty === 'error')
      .map((c) => `${w.graph.nodes.find((n) => n.id === c.fromId)?.label}.error`);
    expect(errorReads).toEqual([]);
  });

  /**
   * The census, and it is not decoration.
   *
   * Every check above is a loop over nodes of a type, and a loop over an empty
   * list passes. These counts are what make the greens above mean "checked"
   * rather than "not present" — the trap this phase has hit more than once.
   */
  it('CENSUS: the checks above ran over the nodes they claim to cover', () => {
    const count = (type: string) => SB006_COMPONENTS.reduce((n, c) => n + byType(written[c.key], type).length, 0);
    expect({
      queries: count('DbCollection2'),
      functions: count('CloudFunction2'),
      repeaters: count('For Each'),
      code: count('JavaScriptFunction'),
      pages: count('Page'),
      navigations: count('RouterNavigate'),
      pageInputs: count('PageInputs')
    }).toEqual({
      // The page by slug, its sections, the two singletons, and the nav's.
      queries: 5,
      // `submitContactForm`, and nothing else — a visitor calls one endpoint.
      functions: 1,
      // Sections, and nav links.
      repeaters: 2,
      // NavLink 0, SectionView 1, ContactForm 1, Nav 0, Site 6.
      code: 8,
      pages: 1,
      // One: the nav link. The site never navigates away from itself.
      navigations: 1,
      pageInputs: 1
    });
  });
});
