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
  FOOTER_HOME_TEXT,
  NO_BACKEND_DEADLINE_MS,
  NO_BACKEND_TEXT,
  NOT_AVAILABLE_TEXT,
  NOT_FOUND_TEXT,
  NOT_SET_UP_TEXT,
  FILL_THE_PARENT_EXEMPTIONS,
  RAW_DIMENSION_EXEMPTIONS,
  SB006_COMPONENTS,
  SITE_CURRENT_SLUG_VAR,
  SITE_URL_PATH,
  THEME_KEYS,
  createPass,
  exemptionKey
} from './sb006Components';
import { RAW_COLOR_LITERAL, STYLE_VALUE_PORT } from './siteBuilderStyleScan';
import {
  planRunOnValueChangeMigration,
  type MigrationProjectLike
} from '../../noodl-editor/src/editor/src/models/ProjectPatches/runOnValueChangeMigration';

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

/**
 * Every node a browser would render as a heading. One function, used by the
 * claim and by its mutant — a mutant that re-implements the predicate grades a
 * copy of it and can be green while the shipped one matches nothing.
 */
const headingsOf = (w: Written): GraphNode[] =>
  w.graph.nodes.filter((n) => /^h[1-6]$/.test(String(n.parameters?.as ?? '')));

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

  /**
   * 🔴 SBR-004 moved the visibility one node OUT, and the invariant moved with
   * it rather than being dropped: the panel is now a centred card and the
   * `Text` is its only child, so the thing that must be authored hidden — and
   * revealed by a code node and nothing else — is the CARD.
   *
   * Found by walking `children` rather than by name, because the id the door
   * assigned is not the id that was sent (SB-004 F9) and a label is a string
   * someone will reword.
   */
  const card = w.graph.nodes.find((n) => (n.children ?? []).includes(notFound!.id));
  expect(`the not-found text has a wrapper: ${card !== undefined}`).toBe('the not-found text has a wrapper: true');

  // 🔴 `mounted`, NOT `visible`. `visible: false` is `visibility: hidden`, which
  // "keeps the space it occupies in the layout" by the port's own description —
  // SBR-004's drive measured a hidden wrapper holding 365px of empty page.
  // `mounted: false` removes the element. Authored hidden either way, and only a
  // code node may reveal it.
  expect(card?.parameters?.mounted).toBe(false);
  expect(`the card holds its space when hidden: ${card?.parameters?.visible !== undefined}`).toBe(
    'the card holds its space when hidden: false'
  );
  // And the Text inside it must NOT carry a second visibility owner.
  expect(notFound?.parameters?.visible).toBeUndefined();
  expect(notFound?.parameters?.mounted).toBeUndefined();
  expect(
    w.wires.filter((c) => c.toId === notFound?.id && (c.toProperty === 'visible' || c.toProperty === 'mounted'))
  ).toEqual([]);

  const feeds = w.wires.filter((c) => c.toId === card?.id && c.toProperty === 'mounted');
  expect(feeds.length).toBe(1);
  const source = w.graph.nodes.find((n) => n.id === feeds[0].fromId);
  expect(source?.type).toBe('JavaScriptFunction');

  /**
   * And that code node must abstain until something has answered, or its
   * first, input-less run publishes `visible: true` over a page that is about
   * to render.
   *
   * ⚠️ This used to assert the guard's SOURCE TEXT
   * (`toContain('if (Inputs.rows === undefined) return;')`). That passes on a
   * guard that has been commented out, moved below the first write, or made
   * unreachable — and it broke the moment SB-015 F27 rewrote the node with an
   * equivalent guard over different inputs, which is the tell that it was
   * pinning a spelling rather than a property. It now RUNS the script with no
   * inputs and asserts nothing is published, which is the actual invariant.
   */
  const script = scriptOf(source as GraphNode);
  const published: Record<string, unknown> = {};
  const Outputs = new Proxy(published, {
    set(target, key, value) {
      target[key as string] = value;
      return true;
    }
  });
  // eslint-disable-next-line no-new-func
  new Function('Inputs', 'Outputs', script)({}, Outputs);
  expect(published).toEqual({});
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
/**
 * SBR-004 AC3 / the seed of SBR-012 — every style value in the public site is a
 * `var(--token)` or a named exemption.
 *
 * ⚠️ **Deliberately narrower than SBR-012.** This scans the five SB-006
 * component sets as they came back from the door. SBR-012 widens the same idea
 * to the generated artefact and the other two sets, adds the "every consumed
 * token resolves" arm (a `var(--tpyo)` renders as *nothing*, which no
 * raw-colour check can see) and owns the global severity question. Leaving the
 * artefact out here is a scope line, not an oversight — it is written down so
 * the next reader does not mistake this green for that one.
 *
 * Two arms, because the port a raw value arrives on decides which one can see
 * it:
 *
 *  1. **Any string value anywhere** that looks like a literal colour. This
 *     catches the hole `RawColorLiteral` has by construction — it reads only
 *     *colour-typed* ports (`parameterValues.ts:976`), so a hex smuggled through
 *     a `*` port or a code node's script body evades it entirely.
 *  2. **A numeric or `{value, unit}` value on a port whose NAME is a dimension,
 *     colour or typography port.** Enum-ish style ports (`flexDirection: 'row'`,
 *     `borderStyle: 'solid'`, `textAlignX: 'center'`) are values the vocabulary
 *     has no token for and never should — they are arrangement, not measurement
 *     — so the arm only fires on numbers and unit objects.
 */
// 🔴 The two patterns moved to `siteBuilderStyleScan.ts` when SBR-012 widened
// this scan to the generated artefact. They are IMPORTED rather than copied:
// two suites enforcing "no raw colour" from two definitions of "colour" would
// drift the moment either is tightened, and the first symptom would be a green
// gate over a population it no longer describes.
export function rawStyleValues(entries: ReadonlyArray<readonly [string, Written]>): string[] {
  const found: string[] = [];
  for (const [key, w] of entries) {
    for (const node of w.graph.nodes) {
      const label = node.label ?? node.type;
      for (const [port, value] of Object.entries(node.parameters ?? {})) {
        // Arm 1: a colour literal, wherever it is hiding — including a script.
        if (typeof value === 'string' && RAW_COLOR_LITERAL.test(value)) {
          found.push(`${key} :: ${exemptionKey(label, port)} (raw colour)`);
          continue;
        }
        if (!STYLE_VALUE_PORT.test(port)) continue;
        // Arm 2: a measurement that is not a token.
        const isUnitObject = typeof value === 'object' && value !== null && 'value' in (value as object);
        if (typeof value === 'number' || isUnitObject) {
          found.push(`${key} :: ${exemptionKey(label, port)}`);
        }
      }
    }
  }
  return found.sort();
}

/**
 * SBR-004 AC2 — the current-page distinction is DERIVED, in both channels.
 *
 * Extracted rather than written inline so the mutants below can run the real
 * assertion. A mutant that only re-checks the edit it just made kills nothing,
 * and reads exactly like one that kills something.
 */
export function assertNavLinkStateIsDerived(w: Written): void {
  const state = w.graph.nodes.find(
    (n) => n.type === 'JavaScriptFunction' && scriptOf(n).includes('Outputs.color')
  )!;
  expect(state).toBeDefined();
  const link = w.graph.nodes.find((n) => n.type === 'Text')!;

  // Both style ports are OWNED by the decider — an authored colour here would
  // be overwritten on every link and look like a rendering bug on none.
  for (const port of ['color', 'fontWeight']) {
    const feeds = w.wires.filter((c) => c.toId === link.id && c.toProperty === port);
    expect(`${port} fed by the decider: ${feeds.length === 1 && feeds[0].fromId === state.id}`).toBe(
      `${port} fed by the decider: true`
    );
    expect(`${port} authored on the link: ${link.parameters?.[port] !== undefined}`).toBe(
      `${port} authored on the link: false`
    );
  }

  // The two answers differ, and they differ in BOTH channels. Colour alone is
  // not a distinction every reader can see.
  const script = scriptOf(state);
  for (const token of ['var(--primary)', 'var(--muted-foreground)', 'var(--font-semibold)', 'var(--font-normal)']) {
    expect(`${token} in the decider: ${script.includes(token)}`).toBe(`${token} in the decider: true`);
  }

  // The comparison is against the record's own slug and the app-wide variable.
  expect(w.wires.some((c) => c.toId === state.id && c.toProperty === 'in-slug')).toBe(true);
  const variable = w.graph.nodes.find((n) => n.type === 'Variable2')!;
  expect(variable?.parameters?.name).toBe(SITE_CURRENT_SLUG_VAR);
  // Both producers: the value, and the signal that the value moved.
  expect(
    w.wires
      .filter((c) => c.fromId === variable.id)
      .map((c) => c.fromProperty)
      .sort()
  ).toEqual(['changed', 'value']);
}

/** SBR-004 — the footer names the site and links to the home the RECORD names. */
export function assertFooter(w: Written): void {
  const footer = w.graph.nodes.find((n) => n.parameters?.as === 'footer');
  expect(`the page has a footer element: ${footer !== undefined}`).toBe('the page has a footer element: true');

  // The name is the record's, and it comes from the SAME read the header uses —
  // one settings reader, two consumers, no second query.
  const settingsReader = w.graph.nodes.find(
    (n) => n.type === 'JavaScriptFunction' && scriptOf(n).includes('Outputs.siteName')
  )!;
  const nameTargets = w.wires
    .filter((c) => c.fromId === settingsReader.id && c.fromProperty === 'out-siteName')
    .map((c) => w.graph.nodes.find((n) => n.id === c.toId)?.label)
    .sort();
  expect(nameTargets).toEqual(['Footer site name', 'Site name']);

  // 🔴 SB-018 (3): the footer's record-fed Text carries a standing value, or it
  // renders the literal word "Text" until the settings row lands.
  const footerName = w.graph.nodes.find((n) => n.label === 'Footer site name')!;
  expect(footerName?.parameters?.text).toBe('');

  // The way back is the home slug the RECORD names, never a hard-coded 'home'.
  const home = w.graph.nodes.find((n) => n.parameters?.text === FOOTER_HOME_TEXT)!;
  const nav = w.graph.nodes.find((n) => n.type === 'RouterNavigate' && n.label === 'To the home page')!;
  expect(w.wires.some((c) => c.fromId === home.id && c.toId === nav.id && c.toProperty === 'navigate')).toBe(true);
  const slugFeed = w.wires.find((c) => c.toId === nav.id && c.toProperty === 'pm-slug');
  expect(`the home link's slug arrives over a wire: ${slugFeed !== undefined}`).toBe(
    "the home link's slug arrives over a wire: true"
  );
  expect(w.graph.nodes.find((n) => n.id === slugFeed!.fromId)?.label).toBe('Read the settings row');
  expect(slugFeed!.fromProperty).toBe('out-homeSlug');
  // And nothing authored a literal beside it — a parameter and a wire on one
  // port is two owners, and the parameter is the one that survives a deploy
  // where the wire never publishes.
  expect(nav.parameters?.['pm-slug']).toBeUndefined();
}

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
      // 🔴 SBR-004 widened this arm from per-SCRIPT to per-PROPERTY. It used to
      // ask "does this script contain a `Noodl` guard anywhere", which a script
      // touching `Noodl.SEO` and `Noodl.Variables` passes on one guard — the
      // hole shaped like the defect, since the second reference is the one that
      // throws. Now every distinct `Noodl.<prop>` must be named by a guard of
      // its own.
      //
      // Two accepted shapes, because two are genuinely needed: the early return
      // (`if (!Noodl || !Noodl.SEO) return;`) when the whole node is about that
      // global, and the inline test (`if (Noodl && Noodl.Variables) { … }`) when
      // the write is one step of a script that must finish either way —
      // `resolveSlug` still owes its `Outputs.ready()` on a server render.
      const properties = [...new Set([...script.matchAll(/\bNoodl\.(\w+)/g)].map((m) => m[1]))].sort();
      for (const property of properties) {
        const early = new RegExp(`if \\(!Noodl \\|\\| !Noodl\\.${property}\\b`).test(script);
        const inline = new RegExp(`Noodl && Noodl\\.${property}\\b`).test(script);
        expect(`${row} Noodl.${property}${early || inline ? ' guarded' : ' UNGUARDED'}`).toBe(
          `${row} Noodl.${property} guarded`
        );
        guarded.push(`${row}:Noodl.${property}`);
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
    // The census first: six pages, and the site's is the catch-all.
    // 🔴 5 → 6 is SBR-017's `/Pages/SignIn` at `admin/signin`, and it is exactly
    // the kind of page this check exists for: a NEW page is the only way the
    // catch-all can start tying with something, and `assertUnambiguousRouting`
    // below is what says it does not.
    // 🔴 6 → 7 is SBR-010's `/Pages/Messages` at `admin/messages`, and it is the
    // second page to arrive since this arm was written — which is the arm doing
    // its job rather than a number being maintained. A new page is the only way
    // the catch-all can start tying, and the resolution below is what says it
    // does not.
    expect(pages.length).toBe(7);
    expect(pages.filter((p) => p.pattern === SITE_URL_PATH).map((p) => p.component)).toEqual(['/Pages/Site']);
    expect(pages.filter((p) => p.component !== '/Pages/Site').every((p) => p.pattern.split('/').length >= 2)).toBe(true);

    assertUnambiguousRouting(pages);

    // And the two URLs no page's own pattern produces: the root, and an
    // ordinary content slug. Both are the catch-all's, uniquely.
    expect(resolve('/', pages).winners).toEqual(['/Pages/Site']);
    expect(resolve('/about', pages).winners).toEqual(['/Pages/Site']);
    // The admin landing, which is the one that used to tie.
    expect(resolve(`/${ADMIN_PATH_PREFIX}/pages`, pages).winners).toEqual(['/Pages/Admin']);
    // …and SBR-010's, which is the one this run is about: two segments, so it
    // cannot tie with the site, and it resolves to exactly one component.
    expect(resolve(`/${ADMIN_PATH_PREFIX}/messages`, pages).winners).toEqual(['/Pages/Messages']);
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

  /**
   * ⚠️ This mutant is aimed at whatever node CURRENTLY drives the panel's
   * `visible`, found through the wire rather than by script content.
   *
   * It used to find the node by `scriptOf(n).includes('Outputs.missing')` — the
   * page reader — and when SB-015 F27 moved visibility onto `diagnoseNotFound`
   * the mutant kept mutating a node the assertion no longer reads, and stopped
   * reddening. It failed loudly (a mutant that survives is a red spec), which is
   * the only reason it did not quietly become decoration. Resolved by the wire,
   * it follows the assertion wherever the graph puts the decision.
   */
  it('MUTANT: a not-found reader that acts before its inputs arrive reddens', () => {
    const mutant = clone(written['Pages/Site']);
    const notFound = mutant.graph.nodes.find((n) => n.parameters?.text === NOT_FOUND_TEXT)!;
    // SBR-004: the `visible` wire lands on the card that WRAPS the text, so the
    // walk is one hop longer. Still resolved structurally — through `children`
    // and then the wire — rather than by any name the graph happens to use.
    const card = mutant.graph.nodes.find((n) => (n.children ?? []).includes(notFound.id))!;
    const feed = mutant.wires.find((c) => c.toId === card.id && c.toProperty === 'mounted')!;
    const reader = mutant.graph.nodes.find((n) => n.id === feed.fromId)!;
    // Strip every early return, whatever it guards on: the property under test
    // is "publishes nothing before an answer", not any one spelling of it.
    reader.parameters!.functionScript = scriptOf(reader)
      .split('\n')
      .filter((line) => !/return;\s*$/.test(line) || /^\s*\}/.test(line))
      .join('\n');
    expect(() => assertNotFoundIsNotIsEmpty(mutant)).toThrow();
  });

  /**
   * The three causes are three DIFFERENT strings (SB-015 F27).
   *
   * The defect this guards is the one F27 measured: one panel, three causes, one
   * sentence — an author reading "That page could not be found." on their own
   * home page reaches for the publication boundary, which is SB-015 §2's arm A.
   */
  it('the not-found panel says which of its three causes it is (SB-015 F27)', () => {
    const w = written['Pages/Site'];
    const notFound = w.graph.nodes.find((n) => n.parameters?.text === NOT_FOUND_TEXT)!;
    const feed = w.wires.find((c) => c.toId === notFound.id && c.toProperty === 'text');
    expect(feed).toBeDefined();
    const decider = w.graph.nodes.find((n) => n.id === feed!.fromId)!;
    const script = scriptOf(decider);

    const run = (inputs: Record<string, unknown>) => {
      const out: Record<string, unknown> = {};
      // eslint-disable-next-line no-new-func
      new Function('Inputs', 'Outputs', script)(inputs, out);
      return out;
    };

    // 1. A refused read on a site that HAS been set up — not reported as
    // "not found".
    const refused = run({ error: 'Permission denied', claimed: true });
    expect(refused.visible).toBe(true);
    expect(refused.text).toBe(NOT_AVAILABLE_TEXT);

    /**
     * 🔴 PRECEDENCE, and the drive is what established it.
     *
     * An unclaimed site makes the Page query FAIL rather than return empty —
     * `claimSite` is what writes the first rows, so before it runs there is no
     * collection to query. Both conditions are therefore true at once, and the
     * one that EXPLAINS the other has to win: `sb015-first-local-run` measured
     * this exact state reporting itself as a refusal, which is true and
     * useless. Asserted here so the order cannot be swapped back silently.
     */
    expect(run({ error: 'Failed to fetch', claimed: false }).text).toBe(NOT_SET_UP_TEXT);

    /**
     * 🔴 REFUSED SETTINGS vs ABSENT SETTINGS — the pair the drive separated.
     *
     * `claimed` is computed from the settings query's `items`, and a REFUSED
     * query publishes an empty `items` exactly like an EMPTY one does (`Run` is
     * additive, so the reader runs on `items` arriving whether or not `fetched`
     * ever fired). So `claimed === false` alone cannot tell "nobody set this
     * site up" from "you may not read the settings" — and
     * `sb015-default-policy-drive`'s arm C is the second case, which the first
     * version of this reported as the first.
     *
     * The settings query's own `error` is the known-firing signal that
     * separates them. Both rows below carry `claimed: false`; only the error
     * differs.
     */
    expect(run({ claimed: false, settingsError: 'Failed to fetch' }).text).toBe(NOT_AVAILABLE_TEXT);
    expect(run({ claimed: false }).text).toBe(NOT_SET_UP_TEXT);

    // And `claimed: undefined` is "the settings query has not answered", which
    // must NOT read as "no row" — that would put the not-set-up screen on every
    // site for the moment before its settings arrive.
    expect(run({ error: 'Failed to fetch' }).text).toBe(NOT_AVAILABLE_TEXT);
    expect(run({ claimed: undefined, missing: undefined })).toEqual({});

    // 2. A site nobody has claimed: no SiteSettings row.
    const unclaimed = run({ missing: true, claimed: false });
    expect(unclaimed.visible).toBe(true);
    expect(unclaimed.text).toBe(NOT_SET_UP_TEXT);

    // 3. A claimed site, a slug with no published page — the genuine 404.
    const genuine = run({ missing: true, claimed: true });
    expect(genuine.visible).toBe(true);
    expect(genuine.text).toBe(NOT_FOUND_TEXT);

    // And the panel stays down when the page WAS found.
    expect(run({ missing: false, claimed: true })).toEqual({ visible: false });

    // The three are actually distinct — the whole point.
    expect(new Set([refused.text, unclaimed.text, genuine.text]).size).toBe(3);

    // ⚠️ None of them names a credential, a collection or a policy: all three
    // are read by visitors, not only by the author.
    for (const t of [refused.text, unclaimed.text, genuine.text] as string[]) {
      expect(t).not.toMatch(/token|secret|policy|permission|admin|SiteSettings/i);
    }
  });

  /**
   * SBR-002 — the FOURTH state: nothing answered at all.
   *
   * 🔴 It has no signal of its own and cannot get one from the queries: with no
   * backend the editor preview's SPA fallback answers `undefined/classes/…`
   * with 200 + HTML, the wire adapter throws on `response.results`, and the
   * query publishes neither `fetched` nor `error` (measured 2026-08-28,
   * `visibleText: 0`). So the signal is a deadline — a Delay armed at mount —
   * and the decider's watchdog arm speaks ONLY when nothing has answered.
   */
  it('SBR-002: the deadline shows the no-backend sentence only when NOTHING answered', () => {
    const w = written['Pages/Site'];
    const notFound = w.graph.nodes.find((n) => n.parameters?.text === NOT_FOUND_TEXT)!;
    const feed = w.wires.find((c) => c.toId === notFound.id && c.toProperty === 'text')!;
    const decider = w.graph.nodes.find((n) => n.id === feed.fromId)!;
    const script = scriptOf(decider);

    const run = (inputs: Record<string, unknown>) => {
      const out: Record<string, unknown> = {};
      // eslint-disable-next-line no-new-func
      new Function('Inputs', 'Outputs', script)(inputs, out);
      return out;
    };

    // The state itself: deadline passed, no query ever spoke.
    const dead = run({ watchdog: true });
    expect(dead.visible).toBe(true);
    expect(dead.text).toBe(NO_BACKEND_TEXT);

    // 🔴 The twin the task file demands: a backend that ANSWERED keeps the
    // panel down even after the deadline — without this row, "the panel shows"
    // is satisfiable by an always-on div.
    expect(run({ watchdog: true, missing: false, claimed: true })).toEqual({ visible: false });

    // And the control where a DIFFERENT state fires instead: same deadline,
    // but the site answered "no such page" — the 404 wins, not the watchdog.
    const found404 = run({ watchdog: true, missing: true, claimed: true });
    expect(found404.text).toBe(NOT_FOUND_TEXT);

    // Every real signal beats the deadline: an answered-empty settings row is
    // "not set up", a refused read is "not available" — never "no backend".
    expect(run({ watchdog: true, claimed: false }).text).toBe(NOT_SET_UP_TEXT);
    expect(run({ watchdog: true, settingsError: 'refused' }).text).toBe(NOT_AVAILABLE_TEXT);
    expect(run({ watchdog: true, error: 'refused' }).text).toBe(NOT_AVAILABLE_TEXT);

    // 🔴 The signal lands on a VALUE port, so it writes true-then-false — and
    // the s4 DRIVE measured that the input queue holds ONE entry per input
    // name, so the script runs ONCE, with `false`. "Defined at all" is the
    // deadline having passed; `false` must therefore SPEAK, not abstain (the
    // abstain design was the silent watchdog AC4 caught live).
    const deadFalse = run({ watchdog: false });
    expect(deadFalse.visible).toBe(true);
    expect(deadFalse.text).toBe(NO_BACKEND_TEXT);
    // The abstain case is `undefined` — the deadline has NOT passed.
    expect(run({})).toEqual({});

    // The fourth sentence is genuinely a fourth sentence.
    expect(new Set([NO_BACKEND_TEXT, NOT_FOUND_TEXT, NOT_SET_UP_TEXT, NOT_AVAILABLE_TEXT]).size).toBe(4);
  });

  it('SBR-002: the deadline is armed at mount and lands on the decider watchdog port', () => {
    const w = written['Pages/Site'];
    // Cardinality where two producers could meet: exactly one deadline.
    const timers = byType(w, 'Timer');
    expect(timers.length).toBe(1);
    const timer = timers[0];
    expect(timer.parameters?.duration).toBe(NO_BACKEND_DEADLINE_MS);

    const page = w.graph.nodes.find((n) => n.type === 'Page')!;
    expect(
      w.wires.some((c) => c.fromId === page.id && c.fromProperty === 'didMount' && c.toId === timer.id && c.toProperty === 'start')
    ).toBe(true);

    const notFound = w.graph.nodes.find((n) => n.parameters?.text === NOT_FOUND_TEXT)!;
    const decider = w.graph.nodes.find((n) => n.id === w.wires.find((c) => c.toId === notFound.id && c.toProperty === 'text')!.fromId)!;
    expect(
      w.wires.some(
        (c) => c.fromId === timer.id && c.fromProperty === 'timerFinished' && c.toId === decider.id && c.toProperty === 'in-watchdog'
      )
    ).toBe(true);
  });

  it('MUTANT: a watchdog arm that ignores an arrived answer reddens', () => {
    // The defect the guard exists for: a deadline that speaks over a site that
    // answered. Strip the arm's nothing-answered guard and the twin above must
    // catch it.
    const w = written['Pages/Site'];
    const notFound = w.graph.nodes.find((n) => n.parameters?.text === NOT_FOUND_TEXT)!;
    const decider = w.graph.nodes.find((n) => n.id === w.wires.find((c) => c.toId === notFound.id && c.toProperty === 'text')!.fromId)!;
    const mutantScript = scriptOf(decider).replace(
      "Inputs.watchdog !== undefined && Inputs.claimed === undefined && Inputs.missing === undefined",
      'Inputs.watchdog !== undefined'
    );
    expect(mutantScript).not.toBe(scriptOf(decider));
    const out: Record<string, unknown> = {};
    // eslint-disable-next-line no-new-func
    new Function('Inputs', 'Outputs', mutantScript)({ watchdog: true, missing: false, claimed: true }, out);
    // The mutant answers "no backend" over a healthy page — the property the
    // real script must not have.
    expect(out.text).toBe(NO_BACKEND_TEXT);
    const real: Record<string, unknown> = {};
    // eslint-disable-next-line no-new-func
    new Function('Inputs', 'Outputs', scriptOf(decider))({ watchdog: true, missing: false, claimed: true }, real);
    expect(real).toEqual({ visible: false });
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
    // The census half: the loop must have SEEN every global reference, or "no
    // unguarded references" would mean "no references". SBR-004 added the two
    // `Noodl.Variables` rows — the write on the page and the read in the link —
    // and made every row name its property rather than just the object.
    expect(guarded.sort()).toEqual([
      'Pages/Site/The document title:Noodl.SEO',
      'Pages/Site/The slug to show:Noodl.Variables',
      'Pages/Site/The theme record, as CSS variables:document',
      'Site/NavLink/Is this the page being read:Noodl.Variables'
    ]);
  });

  it('MUTANT: a second Noodl property guarded by the first one reddens (SBR-004)', () => {
    // 🔴 The hole this arm used to have, planted deliberately: a script whose
    // `Noodl.SEO` guard stands and whose `Noodl.Variables` dereference has none.
    // Per-script the guard is present and the old checker said "guarded"; the
    // reference that throws on a server render is the second one.
    const mutant = clone(written['Pages/Site']);
    const seo = mutant.graph.nodes.find(
      (n) => n.type === 'JavaScriptFunction' && scriptOf(n).includes('Noodl.SEO.setTitle')
    )!;
    seo.parameters!.functionScript = scriptOf(seo) + '\nNoodl.Variables.lastTitle = Inputs.title;';
    expect(() => assertGlobalsGuarded([['Pages/Site', mutant]])).toThrow();
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

  /**
   * Every node in `Admin/SectionRow` that folds a change back into `data`.
   *
   * 🔴 **A `.find` here read one writer of three and passed, which is how this
   * check would have gone quiet exactly when it mattered.** Until SBR-005 the
   * row had a single `merge`; the gallery split the picture fold onto `absorb`
   * (whose only trigger is the upload) and the undo onto `dropLast`, and a
   * subset check whose "writes" set came from whichever node `find` reached
   * first would have reported `image` and `images` as fields with no author
   * while both were being written one node along.
   *
   * So it is a union AND a cardinality: a fourth writer must be added here
   * deliberately rather than arriving unmeasured.
   */
  const sectionDataWriters = () => {
    const rows = written['Admin/SectionRow'].graph.nodes.filter(
      (n) => n.type === 'JavaScriptFunction' && scriptOf(n).includes('Outputs.data')
    );
    // `merge` (the words), `absorb` (an uploaded picture), `dropLast` (the undo).
    expect(`data writers in Admin/SectionRow: ${rows.length}`).toBe('data writers in Admin/SectionRow: 3');
    return new Set(rows.flatMap((n) => [...scriptOf(n).matchAll(/\bnext\.(\w+)\s*=/g)].map((m) => m[1])));
  };

  it('the section fields the site renders are fields the panel can write (acceptance 5)', () => {
    // `Admin/SectionRow` folds the author's edits into `data`; whatever it can
    // set is the whole vocabulary a section view may read.
    const writes = sectionDataWriters();

    const unpack = written['Site/SectionView'].graph.nodes.find(
      (n) => n.type === 'JavaScriptFunction' && scriptOf(n).includes('Inputs.data')
    )!;
    const reads = keysRead(scriptOf(unpack), 'd');

    // A field with no author renders blank on every real page and green in
    // every spec, so this is a subset check with the offenders named.
    const orphans = reads.filter((k) => !writes.has(k));
    expect(`section fields with no author: ${orphans.join(', ')}`).toBe('section fields with no author: ');
    // 🔴 SBR-005 AC5's floor, and it is a cardinality rather than a `> 0`: the
    // five kinds read six fields between them, and a dispatch that quietly
    // stopped reading `images` would still satisfy "reads something".
    expect(`section fields read: ${reads.join(', ')}`).toBe(
      'section fields read: body, heading, image, images, linkLabel, linkTarget'
    );
  });

  it('MUTANT: a section view reading a field the panel cannot write reddens', () => {
    const writes = sectionDataWriters();
    // 🔴 The old mutant used `heading`, and SBR-005 gave `heading` an author —
    // a control that stops being a control is a spec that passes for the wrong
    // reason. `caption` is the field a gallery obviously wants next and that no
    // control writes today; if a later task adds one, this line must move again.
    expect(`caption has an author: ${writes.has('caption')}`).toBe('caption has an author: false');
    const reads = keysRead("const d = Inputs.data || {};\nOutputs.caption = d.caption || '';", 'd');
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
    // 9 since SB-015 F27 added `diagnoseNotFound` to `Site`; 10 since SBR-004
    // added `linkState` to `NavLink`.
    //
    // SBR-005 moves it twice and lands back on 10: **+1** for `Site/CtaSection`'s
    // `route` (the one code node in the five kinds, and the one that fires
    // `Outputs.go()`), **−1** for `/Pages/Site`'s `readSections`, which went with
    // the duplicate page-level contact form — see D37.
    expect(rows.length).toBe(10);
    // The code nodes that DO emit a signal, and therefore must declare a port:
    // `Site/ContactForm`'s `gather`, `/Pages/Site`'s two, and — SBR-005 —
    // `Site/CtaSection`'s `route`.
    expect(rows.filter((r) => !r.endsWith('declared=')).length).toBe(4);
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
   * REL-011c residual 2 — the contact kind draws ONE heading, and the author
   * writes it.
   *
   * 🔴 **The census above is the population; this is the claim.** Deleting
   * `Site/ContactForm | Contact heading` from the expected list would pass on
   * its own the moment somebody re-adds the node and updates the literal — the
   * same failure mode SB-017 acceptance 6 records four times over. What has to
   * stay true is the shape: the card holds no heading of its own, and the
   * section's single heading is WIRED rather than authored, so it says what the
   * person typed into the panel and nothing when they typed nothing.
   */
  it("REL-011c: a contact section draws one heading, and it is the author's", () => {
    const form = written['Site/ContactForm'];
    const section = written['Site/ContactSection'];

    // Half one: the card opens with a field, not a title.
    expect(headingsOf(form)).toEqual([]);

    // Half two: the section has exactly one, and its text arrives on a wire.
    const headings = headingsOf(section);
    expect(headings.map((n) => n.label)).toEqual(['Contact heading']);
    expect(section.wires.some((c) => c.toId === headings[0].id && c.toProperty === 'text')).toBe(true);
    // …and it is hidden until it has one — `showHeading` is `heading !== ''`,
    // so an author who writes no heading gets no empty line above the card.
    expect(headings[0].parameters?.mounted).toBe(false);
    expect(section.wires.some((c) => c.toId === headings[0].id && c.toProperty === 'mounted')).toBe(true);
  });

  it('MUTANT: a fixed heading back inside the card reddens', () => {
    // The state the photograph caught, and the control on half one: `toEqual([])`
    // is also what a predicate that matches nothing returns, so the same
    // `headingsOf` must find the planted node.
    //
    // ⚠️ Stated as "one MORE than the card really has" rather than as a literal,
    // so this arm grades the PREDICATE and stays green whatever the artefact
    // does. On the reverted source it is the claim above and the AC1 census that
    // redden — measured, both of them — and a mutant that reddened with them
    // would be reporting the same fact a third time.
    const form = written['Site/ContactForm'];
    const mutant = clone(form);
    mutant.graph.nodes.push({
      id: 'planted',
      type: 'Text',
      label: 'Contact heading',
      parameters: { as: 'h2', text: 'Get in touch' }
    });

    expect(headingsOf(mutant).length).toBe(headingsOf(form).length + 1);
  });

  // ── SBR-004: the public site wears the theme ──────────────────────────────

  /**
   * AC3. The scan, its exemption list, and the census that stops "no raw values"
   * from meaning "nothing was scanned".
   */
  it('SBR-004 AC3: every style value is a token, or a named exemption', () => {
    const found = rawStyleValues(siteEntries());
    // Strip the component prefix: an exemption is about the node, and the same
    // node is never in two component sets.
    const bare = found.map((row) => row.split(' :: ')[1]).sort();
    const named = RAW_DIMENSION_EXEMPTIONS.map((e) => exemptionKey(e.label, e.port)).sort();
    expect(bare).toEqual(named);

    // AC3 of SBR-012 early: an exemption without a reason is a relaxation with
    // extra steps.
    for (const e of RAW_DIMENSION_EXEMPTIONS) {
      expect(`${e.label}/${e.port} reason length ${e.why.length > 60}`).toBe(
        `${e.label}/${e.port} reason length true`
      );
    }

    // The census half. The scanner must have SEEN the ports it clears — a
    // regex that matched nothing would produce the same empty list as a site
    // authored entirely in tokens.
    const tokenValues = siteEntries().flatMap(([key, w]) =>
      w.graph.nodes.flatMap((n) =>
        Object.entries(n.parameters ?? {})
          .filter(([, v]) => typeof v === 'string' && v.startsWith('var(--'))
          .map(([port]) => `${key}/${n.label}/${port}`)
      )
    );
    expect(`token-valued ports across the five components: ${tokenValues.length >= 60}`).toBe(
      'token-valued ports across the five components: true'
    );
  });

  it('MUTANT: a planted hex on a colour port reddens the token scan', () => {
    const mutant = clone(written['Pages/Site']);
    const title = mutant.graph.nodes.find((n) => n.parameters?.as === 'h1')!;
    title.parameters!.color = '#1e4d8c';
    expect(rawStyleValues([['Pages/Site', mutant]])).toContain('Pages/Site :: Page title | color (raw colour)');
  });

  it('MUTANT: a planted hex inside a SCRIPT reddens the token scan', () => {
    // 🔴 The arm that exists because `RawColorLiteral` cannot see this. It reads
    // colour-TYPED ports only, and a script body is a string on a `*` port.
    const mutant = clone(written['Site/NavLink']);
    const state = mutant.graph.nodes.find(
      (n) => n.type === 'JavaScriptFunction' && scriptOf(n).includes('Outputs.color')
    )!;
    state.parameters!.functionScript = scriptOf(state).replace("'var(--primary)'", "'#1e4d8c'");
    expect(rawStyleValues([['Site/NavLink', mutant]]).join('\n')).toContain('(raw colour)');
  });

  it('MUTANT: a planted bare number on a spacing port reddens the token scan', () => {
    const mutant = clone(written['Pages/Site']);
    const shell = mutant.graph.nodes.find((n) => n.parameters?.maxWidth !== undefined)!;
    shell.parameters!.rowGap = 32;
    expect(rawStyleValues([['Pages/Site', mutant]])).toContain('Pages/Site :: Page shell | rowGap');
  });

  /**
   * The reading measure, and the reason SBR-003 carried its last probe here:
   * this is the first task that puts a measure on a real box.
   *
   * The *source* half is asserted here — the port carries the token rather than
   * a px literal. Whether the browser then constrains the box is a question only
   * a drive can answer, and it is AC5's last row.
   */
  it('SBR-004: the reading measure is the minted token, not a pixel literal', () => {
    const w = written['Pages/Site'];
    const shell = w.graph.nodes.find((n) => n.parameters?.maxWidth !== undefined)!;
    expect(shell.parameters?.maxWidth).toBe('var(--site-measure)');
    // And the ground beneath it consumes the background token — before SBR-004
    // nothing did, so a Theme record could change `--background` and no element
    // ever read it (`TokenResolver.generateCss` stamps `:root` and a body floor).
    // ⚠️ That floor was font-only when this was written; P78 D19 added
    // `color: var(--foreground)` to it 2026-08-29. It still stamps no
    // background, so this assertion stands: `--background` needs a node to read it.
    const ground = w.graph.nodes.find((n) => n.parameters?.backgroundColor === 'var(--background)');
    expect(`a node consumes --background: ${ground !== undefined}`).toBe('a node consumes --background: true');
  });

  /**
   * AC2 — the current page is visibly distinct, and the distinction is derived
   * rather than authored.
   */
  it('SBR-004 AC2: the nav link takes its colour and weight from a slug comparison', () => {
    assertNavLinkStateIsDerived(written['Site/NavLink']);
  });

  it('SBR-004 AC2: the current slug has exactly one writer, and it is the resolver', () => {
    // 🔴 An app-wide variable with two writers is a race nobody can read. The
    // writer must be the node that already decides what "the page being read"
    // means — the URL alone cannot, because an empty URL slug is the home page
    // and only `SiteSettings.homeSlug` names that record.
    const writers = siteEntries().flatMap(([key, w]) =>
      w.graph.nodes
        .filter((n) => scriptOf(n).includes(`Noodl.Variables[${JSON.stringify(SITE_CURRENT_SLUG_VAR)}] =`))
        .map((n) => `${key}/${n.label}`)
    );
    expect(writers).toEqual(['Pages/Site/The slug to show']);
  });

  it('MUTANT: a nav link that authors its own colour reddens AC2', () => {
    // The version an author writes when the nav "obviously" just needs a colour:
    // a parameter on the link, and the decider's wire removed because it was
    // fighting it. Both halves, because either alone leaves the other's
    // assertion standing.
    const mutant = clone(written['Site/NavLink']);
    const link = mutant.graph.nodes.find((n) => n.type === 'Text')!;
    const state = mutant.graph.nodes.find(
      (n) => n.type === 'JavaScriptFunction' && scriptOf(n).includes('Outputs.color')
    )!;
    mutant.wires = mutant.wires.filter((c) => !(c.fromId === state.id && c.toProperty === 'color'));
    link.parameters!.color = 'var(--foreground)';
    expect(() => assertNavLinkStateIsDerived(mutant)).toThrow();
  });

  it('MUTANT: a current state that changes colour and not weight reddens AC2', () => {
    // 🔴 The half a sighted author never notices is missing. Colour alone is
    // the distinction, and the spec must refuse it.
    const mutant = clone(written['Site/NavLink']);
    const state = mutant.graph.nodes.find(
      (n) => n.type === 'JavaScriptFunction' && scriptOf(n).includes('Outputs.color')
    )!;
    state.parameters!.functionScript = scriptOf(state).replace(
      "Outputs.weight = isCurrent ? 'var(--font-semibold)' : 'var(--font-normal)';",
      "Outputs.weight = 'var(--font-normal)';"
    );
    expect(() => assertNavLinkStateIsDerived(mutant)).toThrow();
  });

  /**
   * AC1's third piece of shape — before SBR-004 the page simply stopped.
   */
  it('SBR-004: the page has a footer that names the site and links home', () => {
    assertFooter(written['Pages/Site']);
  });

  it('MUTANT: a footer home link with a hard-coded slug reddens', () => {
    const mutant = clone(written['Pages/Site']);
    const nav = mutant.graph.nodes.find((n) => n.type === 'RouterNavigate' && n.label === 'To the home page')!;
    mutant.wires = mutant.wires.filter((c) => !(c.toId === nav.id && c.toProperty === 'pm-slug'));
    nav.parameters!['pm-slug'] = 'home';
    expect(() => assertFooter(mutant)).toThrow();
  });

  it('MUTANT: a footer name with no standing value reddens (SB-018 (3))', () => {
    const mutant = clone(written['Pages/Site']);
    const footerName = mutant.graph.nodes.find((n) => n.label === 'Footer site name')!;
    delete footerName.parameters!.text;
    expect(() => assertFooter(mutant)).toThrow();
  });

  /**
   * 🔴 The drive's find, as a standing check.
   *
   * `visible: false` is `visibility: hidden` — the port's own description says it
   * "keeps the space it occupies in the layout"
   * (`node-shared-port-definitions.ts:215-228`). Measured in the preview at
   * 360px: the hidden contact wrapper held **365px** of empty page above the
   * only thing on it, and a `richText` section reserved a 320px image band it
   * never draws. `mounted` removes the element instead
   * (`react-component-node.ts:1835-1857`).
   *
   * Nothing on the public site wants its space held, so nothing on it may use
   * `visible` — asserted over the union of parameters and wires, because a
   * surface can acquire either one without the other.
   */
  it('SBR-004: nothing conditionally shown holds its space — mounted, never visible', () => {
    const offenders = siteEntries().flatMap(([key, w]) => [
      ...w.graph.nodes
        .filter((n) => n.parameters?.visible !== undefined)
        .map((n) => `${key}/${n.label} parameter`),
      ...w.wires
        .filter((c) => c.toProperty === 'visible')
        .map((c) => `${key}/${w.graph.nodes.find((n) => n.id === c.toId)?.label} wire`)
    ]);
    expect(`surfaces still using visible: ${offenders.join(', ')}`).toBe('surfaces still using visible: ');

    // The census half — `mounted` must actually be in use, or "no `visible`"
    // would be satisfied by a template that hides nothing at all.
    const mountedWires = siteEntries().flatMap(([key, w]) =>
      w.wires.filter((c) => c.toProperty === 'mounted').map((c) => `${key}/${c.toId}`)
    );
    const mountedParams = siteEntries().flatMap(([key, w]) =>
      w.graph.nodes.filter((n) => n.parameters?.mounted === false).map((n) => `${key}/${n.label}`)
    );
    // 🔴 SBR-005 took this from six surfaces to sixteen, so it is NAMED rather
    // than counted. A count that only has to agree with itself passes when a
    // wrapper loses its `mounted` and a different node gains one — which on a
    // five-way dispatch is two kinds on screen at once, the exact defect AC4 is
    // about. Every entry is a surface authored hidden AND wired to a decider.
    expect(mountedParams.sort()).toEqual(
      [
        // The dispatch itself: exactly one of these five is mounted per row.
        'Site/SectionView/Hero, when this section is one',
        'Site/SectionView/Gallery, when this section is one',
        'Site/SectionView/Call to action, when this section is one',
        'Site/SectionView/Passage, when this section is one',
        'Site/SectionView/Contact, when this section is one',
        // Inside a kind: a field the record left empty draws nothing at all.
        'Site/HeroSection/Hero sub-heading',
        'Site/GallerySection/Gallery heading',
        'Site/CtaSection/Call to action body',
        'Site/CtaSection/Call to action button',
        'Site/RichTextSection/Rich text heading',
        'Site/ContactSection/Contact heading',
        'Site/ContactSection/Contact intro',
        // The three that predate SBR-005. `/Pages/Site`'s own contact wrapper is
        // NOT here any more: D37 — it drew a second form on the identical
        // predicate the section dispatches on.
        'Site/ContactForm/The one confirmation',
        'Site/ContactForm/The one refusal',
        'Pages/Site/The empty-screen card'
      ].sort()
    );
    expect(`${mountedParams.length} authored, ${mountedWires.length} wired`).toBe('15 authored, 15 wired');
  });

  it('MUTANT: a conditional surface back on `visible` reddens', () => {
    const mutant = clone(written['Pages/Site']);
    const wrap = mutant.graph.nodes.find((n) => n.parameters?.mounted === false && (n.children ?? []).length > 0)!;
    delete wrap.parameters!.mounted;
    wrap.parameters!.visible = false;
    for (const c of mutant.wires) if (c.toId === wrap.id && c.toProperty === 'mounted') c.toProperty = 'visible';
    const offenders = mutant.graph.nodes.filter((n) => n.parameters?.visible !== undefined);
    expect(() => expect(`still using visible: ${offenders.length}`).toBe('still using visible: 0')).toThrow();
  });

  /**
   * AC4's authorable half. The measured half — that a 375px viewport neither
   * scrolls sideways nor overlaps — is the drive's, because only a browser can
   * answer it.
   */
  it('SBR-004 AC4: the nav wraps rather than overflowing, and carries no gutter', () => {
    const bar = written['Site/Nav'].graph.nodes.find((n) => n.parameters?.as === 'nav')!;
    expect(bar.parameters?.flexWrap).toBe('wrap');
    // 🔴 And no `columnGap`. A wrapped row around a Repeater WITH a gutter is
    // `uncollapsible-multi-column` arm B (`responsiveArrangement.ts:238-256`);
    // the gutter is the discriminator there, and the door refuses the create
    // call over it. The spacing lives on the link instead.
    expect(bar.parameters?.columnGap).toBeUndefined();
    const link = written['Site/NavLink'].graph.nodes.find((n) => n.type === 'Text')!;
    expect(link.parameters?.marginRight).toBe('var(--space-6)');
    // The vertical step is what separates the ROWS once the bar has wrapped.
    expect(link.parameters?.marginTop).toBe('var(--space-2)');
  });

  // ── SBR-004 AC1 and AC2: the two the DRIVE found and 49 greens did not ──────

  /**
   * The five written components in the shape the NDA-017 migration reads.
   *
   * 🔴 `eachNode` recurses through `children`, and the saved v2 graph's `children`
   * are id **strings**, not nodes. The field is dropped rather than reinterpreted:
   * the migration only ever needs ids, types, parameters and the connection list —
   * it decides per node, never per subtree — so a flat root list is the whole graph
   * as far as it is concerned.
   */
  const migrationProject = (source: Record<string, Written> = written): MigrationProjectLike => ({
    components: SB006_COMPONENTS.map((c) => ({
      name: c.legacyName,
      graph: {
        roots: source[c.key].graph.nodes.map(({ children, ...node }) => node),
        connections: source[c.key].wires
      }
    }))
  });

  const LINK_STATE = 'Is this the page being read';

  /**
   * 🔴 **The check that would have caught AC2, and it is not about a parameter —
   * it runs the real migration over the real artefact.**
   *
   * SBR-004 §8.1 drove this: on every real page load all three nav links rendered
   * `rgb(0,0,0)`/400, while poking the variable with the links mounted produced
   * `rgb(30,77,140)`/600 and `rgb(86,83,76)`/400. So the graph was right and the
   * body never ran. The cause was `runOnChange-in-slug`/`-in-current` sitting at
   * `false` in the saved project — which **nothing in this file authored**.
   *
   * `applyPatches` runs the NDA-017 migration on every project load
   * (`applypatches.js:71`) and writes `false` on the value inputs of any node in
   * the fifteen families whose control signal is wired. This node wires `run`. The
   * migration is for graphs authored before NDA-017 §2 and cannot tell this one
   * from those, because the project format has nowhere to record that it ran.
   *
   * So the spec imports {@link planRunOnValueChangeMigration} itself rather than
   * restating its rule: a spec that re-implemented the rule would agree with a
   * migration that had changed underneath it, which is the whole failure being
   * fixed here.
   */
  it('SBR-004 AC2: the real NDA-017 migration cannot silence the nav link', () => {
    const plan = planRunOnValueChangeMigration(migrationProject());

    // 🔴 THE KNOWN-FIRING SIGNAL BESIDE THE ABSENCE. "No write names the link
    // state" passes for free on a plan that writes nothing at all — and a plan
    // that writes nothing is exactly what a broken import, an empty `written` or
    // a renamed family would produce. The migration genuinely fires on this
    // template, in bulk, and these two numbers are what say so.
    expect(plan.writes.length).toBeGreaterThan(0);
    expect(plan.signalDrivenNodes).toBeGreaterThan(0);

    // …and the link state is not among them.
    const silenced = plan.writes.filter((w) => w.component === '/Site/NavLink').map((w) => w.parameter);
    expect(silenced).toEqual([]);

    // The reason it is not: an already-present key is never touched, whatever its
    // value (the migration's idempotence clause). ABSENT is not good enough —
    // absent is precisely what the migration converts — so this asserts the
    // literal `true` rather than `not false`.
    const state = byLabel(written['Site/NavLink'], 'JavaScriptFunction', LINK_STATE);
    expect(state.parameters?.['runOnChange-in-slug']).toBe(true);
    expect(state.parameters?.['runOnChange-in-current']).toBe(true);

    // Both, not one. `run` fires from the Variable's `changed`, which on a real
    // load has already passed by the time a repeated link exists — so the two
    // value inputs are the only triggers there are, and either arriving first
    // must be able to run the body.
    expect(written['Site/NavLink'].wires).toContainEqual(
      expect.objectContaining({ toId: state.id, toProperty: 'run' })
    );
  });

  it('MUTANT: dropping the explicit checkboxes lets the migration silence AC2', () => {
    const mutant: Record<string, Written> = { ...written, 'Site/NavLink': clone(written['Site/NavLink']) };
    const state = byLabel(mutant['Site/NavLink'], 'JavaScriptFunction', LINK_STATE);
    delete state.parameters!['runOnChange-in-slug'];
    delete state.parameters!['runOnChange-in-current'];

    const plan = planRunOnValueChangeMigration(migrationProject(mutant));
    expect(plan.writes.filter((w) => w.component === '/Site/NavLink').map((w) => w.parameter).sort()).toEqual([
      'runOnChange-in-current',
      'runOnChange-in-slug'
    ]);
  });

  const RESOLVE_SLUG = 'The slug to show';

  /**
   * 🔴 **The same migration, the same asymmetry, and this one costs the front
   * door.** SBR-004 §9.2 drove `http://localhost:8574/` on a claimed site with
   * three published pages: `Noodl.Variables` held 0 keys, `siteCurrentSlug` was
   * `undefined`, the `h1` was empty and the whole body was the nav and the
   * footer. `/home` and `/about` rendered correctly.
   *
   * The reason only the empty slug breaks is the node's own guard: a non-empty
   * URL slug does not need `homeSlug`, and the root does. With `in-homeSlug`
   * silenced, `run` (`Page.didMount`) fires once, the guard returns because the
   * `SiteSettings` fetch has not answered yet, and nothing re-runs the body.
   *
   * Same discipline as the AC2 check above: the real migration over the real
   * artefact, with a known-firing signal beside the absence, and the literal
   * `true` rather than "not `false`" — absent is exactly what the migration
   * converts.
   */
  it('SBR-004 §9.2: the migration cannot silence the slug the root URL needs', () => {
    const plan = planRunOnValueChangeMigration(migrationProject());

    // The known-firing signal. "No write names this node" passes for free on a
    // plan that writes nothing at all.
    expect(plan.writes.length).toBeGreaterThan(0);
    expect(plan.signalDrivenNodes).toBeGreaterThan(0);

    const resolve = byLabel(written['Pages/Site'], 'JavaScriptFunction', RESOLVE_SLUG);
    const silenced = plan.writes
      .filter((w) => w.component === '/Pages/Site' && w.nodeId === resolve.id)
      .map((w) => w.parameter);
    expect(silenced).toEqual([]);

    expect(resolve.parameters?.['runOnChange-in-slug']).toBe(true);
    expect(resolve.parameters?.['runOnChange-in-homeSlug']).toBe(true);

    // The three producers this node does not control the order of, and the one
    // that makes the pair necessary: `run` is the page's mount, so it cannot wait
    // for a fetch.
    expect(written['Pages/Site'].wires).toContainEqual(
      expect.objectContaining({ toId: resolve.id, toProperty: 'run', fromProperty: 'didMount' })
    );
    expect(written['Pages/Site'].wires).toContainEqual(
      expect.objectContaining({ toId: resolve.id, toProperty: 'in-homeSlug' })
    );
    expect(written['Pages/Site'].wires).toContainEqual(
      expect.objectContaining({ toId: resolve.id, toProperty: 'in-slug' })
    );

    // 🔴 And the guard the whole finding turns on is still the first line — if it
    // ever stops returning early, a run before `homeSlug` queries for the empty
    // slug and 404s the home page, which is the defect this guard was authored
    // against and the reason the fix had to be a re-run rather than a dropped
    // guard.
    expect(scriptOf(resolve).split('\n')[0]).toBe('if (Inputs.homeSlug === undefined) return;');
  });

  it('MUTANT: dropping the slug resolver checkboxes lets the migration silence the root URL', () => {
    const mutant: Record<string, Written> = { ...written, 'Pages/Site': clone(written['Pages/Site']) };
    const resolve = byLabel(mutant['Pages/Site'], 'JavaScriptFunction', RESOLVE_SLUG);
    delete resolve.parameters!['runOnChange-in-slug'];
    delete resolve.parameters!['runOnChange-in-homeSlug'];

    const plan = planRunOnValueChangeMigration(migrationProject(mutant));
    expect(
      plan.writes
        .filter((w) => w.component === '/Pages/Site' && w.nodeId === resolve.id)
        .map((w) => w.parameter)
        .sort()
    ).toEqual(['runOnChange-in-homeSlug', 'runOnChange-in-slug']);
  });

  // ── AC1: nothing on this page may take space it was not given ───────────────

  /**
   * `addDimensions`' per-type default size mode, from the three call sites this
   * template places. Stated here rather than inferred because it is the whole
   * mechanism: the default is what applies when the author writes nothing, and
   * writing nothing is what AC1 failed on.
   */
  const DEFAULT_SIZE_MODE: Record<string, string> = {
    // `group.ts:492` takes `addDimensions`' own default.
    Group: 'explicit',
    // `text.ts:149-152`.
    Text: 'contentHeight',
    // `image.ts:175-178`.
    Image: 'contentSize'
  };

  /** Whether `Layout.size` assigns this axis at all (`layout.ts:60-71`). */
  const assignsWidth = (mode: string) => mode === 'explicit' || mode === 'contentHeight';
  const assignsHeight = (mode: string) => mode === 'explicit' || mode === 'contentWidth';

  /**
   * 🔴 **The check that would have caught AC1**, and the reason it walks the tree
   * instead of naming nodes: **a component's visual root is laid out by whatever
   * placed the instance**, so the nav link's `Text` is a child of `Site/Nav`'s
   * `flexWrap: wrap` ROW even though nothing in `Site/NavLink` says so. A
   * per-component check cannot see that, and it is where half of AC1 lived.
   *
   * The rule being enforced is `Layout.size`'s (`layout.ts:83-98`): a percentage
   * size **along the parent's direction** becomes `flexGrow`. Every node's size on
   * that axis defaults to `100` with `defaultUnit: '%'`
   * (`node-shared-port-definitions.ts:812-846`), so a node that neither sets an
   * explicit size nor opts out via `sizeMode` **grows** — which is why three
   * unstyled bands took 219/218/219 of a 768px page and three links took a line
   * each.
   *
   * Anything that legitimately grows is named in {@link FILL_THE_PARENT_EXEMPTIONS}
   * with the sentence that makes it legitimate.
   */
  /**
   * The walk itself, as one function, because the mutant below has to run **this**
   * and not a restatement of it. A sabotage that reddens a second implementation
   * proves only that the second implementation exists.
   *
   * Returns every node it graded and every node that grows, so the green arm can
   * assert the absence AND the population — an empty walk reports "nothing grows"
   * exactly as loudly as a correct one.
   */
  function findGrowingNodes(source: Record<string, Written>): { graded: string[]; growing: string[] } {
    const exempt = new Set(FILL_THE_PARENT_EXEMPTIONS.map((e) => `${e.component} | ${e.label}`));
    const componentOf = new Map(SB006_COMPONENTS.map((c) => [c.legacyName, c.key] as const));
    const graded: string[] = [];
    const growing: string[] = [];

    /** Walk `key`'s nodes `ids`, laid out by a parent stacking `parentLayout`. */
    const walk = (key: string, ids: string[], parentLayout: string, seen: Set<string>): void => {
      const nodes = new Map(source[key].graph.nodes.map((n) => [n.id, n]));
      for (const id of ids) {
        const node = nodes.get(id);
        if (!node) continue;

        // A component instance: descend with the layout of the place it sits in.
        const target = componentOf.get(node.type);
        if (target) {
          if (!seen.has(target)) {
            walk(target, source[target].graph.visualRoots ?? [], parentLayout, new Set([...seen, target]));
          }
          continue;
        }

        // `For Each` is not visual: its template's roots render where IT sits, so
        // the layout passes straight through it. This is the hop that carries
        // `Site/Nav`'s ROW down onto the nav link's `Text` — the half of AC1 no
        // per-component check could ever see.
        if (node.type === 'For Each') {
          const template = componentOf.get(String(node.parameters?.template ?? ''));
          if (template && !seen.has(template)) {
            walk(template, source[template].graph.visualRoots ?? [], parentLayout, new Set([...seen, template]));
          }
          continue;
        }

        const defaultMode = DEFAULT_SIZE_MODE[node.type];
        if (defaultMode !== undefined) {
          const mode = String(node.parameters?.sizeMode ?? defaultMode);
          const alongAxis = parentLayout === 'row' ? 'width' : 'height';
          const assigned = parentLayout === 'row' ? assignsWidth(mode) : assignsHeight(mode);
          // An authored value on that axis is the author saying a size out loud;
          // only the DEFAULTED 100% is the trap. A raw one is AC3's problem.
          const authored = node.parameters?.[alongAxis] !== undefined;
          const name = `${key} | ${node.label ?? node.type}`;
          graded.push(name);
          if (assigned && !authored && !exempt.has(name)) {
            growing.push(`${name} — ${alongAxis} defaults to 100% along its parent's ${parentLayout}, so Layout.size makes it flexGrow`);
          }
        }

        const layout = node.type === 'Group' ? String(node.parameters?.flexDirection ?? 'column') : parentLayout;
        walk(key, node.children ?? [], layout, seen);
      }
    };

    walk('Pages/Site', source['Pages/Site'].graph.visualRoots ?? [], 'column', new Set(['Pages/Site']));
    return { graded, growing };
  }

  it('SBR-004 AC1: nothing on the public site grows into space it was not given', () => {
    const { graded, growing } = findGrowingNodes(written);
    expect(growing).toEqual([]);
    // 🔴 The census half, and it is what makes the green above mean "checked".
    // Every node the walk reached, in the order it reached them — so a hop that
    // silently stops (the `For Each` one especially) reds here rather than
    // reporting a clean page.
    //
    // ⚠️ The four `net.noodl.controls.*` in the contact form are deliberately OUT
    // of the population: they are prefab components whose `defaultSizeMode` is
    // theirs and not `addDimensions`', so grading them here would be guessing at
    // a default this spec has not read. They are the panel's shape, not the
    // public site's, and SBR-006 owns them.
    expect(graded).toEqual([
      'Pages/Site | Page ground',
      'Pages/Site | Page shell',
      'Site/Nav | Navigation',
      'Site/NavLink | Nav link',
      // 🔴 **REL-011c's `<main>`, and it is in this census because it is a real
      // box.** The landmark had to be a node here rather than a parameter —
      // `Page shell` above also holds the nav band and the colophon, and a
      // `main` around those announces the site's navigation as the page's
      // content (`SITE_NODES`). It is `contentHeight` for hazard 1, which is
      // why it is graded and NOT in `growing`: a `Group` authored without a
      // `sizeMode` is `explicit` at `height: 100%`, and `Page ground`'s
      // `minHeight: 100vh` is exactly the slack that would be shared into it.
      'Pages/Site | The page',
      'Pages/Site | Header',
      'Pages/Site | Site name',
      'Pages/Site | Page title',
      'Site/SectionView | One section',
      // 🔴 SBR-005's dispatch, in walk order: each wrapper, then the kind it
      // holds. Naming them here is what makes AC1 a claim about the five kinds
      // rather than about whatever the walk happened to reach.
      'Site/SectionView | Hero, when this section is one',
      'Site/HeroSection | Hero band',
      'Site/HeroSection | Hero heading',
      'Site/HeroSection | Hero sub-heading',
      'Site/SectionView | Gallery, when this section is one',
      'Site/GallerySection | Gallery band',
      'Site/GallerySection | Gallery heading',
      'Site/GallerySection | Gallery grid',
      'Site/GalleryTile | Gallery tile',
      'Site/SectionView | Call to action, when this section is one',
      'Site/CtaSection | Call to action band',
      'Site/CtaSection | Call to action heading',
      'Site/CtaSection | Call to action body',
      'Site/SectionView | Passage, when this section is one',
      'Site/RichTextSection | Rich text band',
      'Site/RichTextSection | Rich text heading',
      'Site/RichTextSection | Rich text body',
      'Site/SectionView | Contact, when this section is one',
      'Site/ContactSection | Contact band',
      'Site/ContactSection | Contact heading',
      'Site/ContactSection | Contact intro',
      // 🔴 **`Site/ContactForm` appears ONCE, and the fact that it appeared TWICE
      // is D37.** The paragraph that used to stand here explained the second pass
      // as expected behaviour — a page-level form beside a section-level one —
      // and it was wrong: both were mounted from `rows.some(r => r.kind ===
      // 'contact')`, the same predicate, so every contact section drew two forms.
      // The browser is what said so (7 `<section>` elements on a five-section
      // page). **An expected-value update is a claim; a session updating a census
      // it did not cause is the moment to ask what changed.**
      'Site/ContactForm | Contact form',
      // 🔴 **`Site/ContactForm | Contact heading` is GONE, and its absence is
      // REL-011c residual 2.** The card opened with a fixed `h2` reading "Get in
      // touch" one line below `Site/ContactSection | Contact heading` — the one
      // the author writes, and the one a person naturally fills in with those
      // same three words. `/contact-only` drew them stacked
      // (`phase-81/verdicts/sbr-005/2026-09-03/site-builder-living/kind-contact-*`).
      // ⚠️ The two entries below it are the confirmation and the refusal, which
      // are NOT headings and must stay: this is the removal of a second heading,
      // not of the card's copy.
      'Site/ContactForm | The one confirmation',
      'Site/ContactForm | The one refusal',
      'Pages/Site | The empty-screen card',
      'Pages/Site | Not found',
      'Pages/Site | Footer',
      'Pages/Site | Footer site name',
      'Pages/Site | Back to home'
    ]);
  });

  it('MUTANT: a band back on the platform default reddens AC1', () => {
    // Exactly the state the drive measured: `Footer` with nothing said about its
    // size, on a page whose 768px was being split 219/218/219.
    const mutant: Record<string, Written> = { ...written, 'Pages/Site': clone(written['Pages/Site']) };
    delete byLabel(mutant['Pages/Site'], 'Group', 'Footer').parameters!.sizeMode;

    const { growing } = findGrowingNodes(mutant);
    expect(growing).toEqual(["Pages/Site | Footer — height defaults to 100% along its parent's column, so Layout.size makes it flexGrow"]);
  });

  it('MUTANT: a nav link back on the platform default reddens AC1 — across the component boundary', () => {
    // The second half, and the one a per-component check cannot reach: `Text`
    // defaults to `contentHeight`, which still assigns WIDTH, and the link's
    // parent is `Site/Nav`'s wrapping ROW two components away.
    const mutant: Record<string, Written> = { ...written, 'Site/NavLink': clone(written['Site/NavLink']) };
    delete byLabel(mutant['Site/NavLink'], 'Text', 'Nav link').parameters!.sizeMode;

    const { growing } = findGrowingNodes(mutant);
    expect(growing).toEqual(["Site/NavLink | Nav link — width defaults to 100% along its parent's row, so Layout.size makes it flexGrow"]);
  });

  it('SBR-004 AC1: the nav link is content-sized, and capped so AC4 still holds', () => {
    const link = byLabel(written['Site/NavLink'], 'Text', 'Nav link');
    // `contentSize` assigns neither axis, which is the `width: auto` that turned
    // §8.2's 219px three-line stack into a 68px one-row bar.
    expect(link.parameters?.sizeMode).toBe('contentSize');
    // 🔴 And NO `maxWidth` beside it. The guard was authored, driven, and removed:
    // on a `Text` the parameter never reaches the DOM (computed `maxWidth: none`
    // on the claimed site, while the same port family renders on the `Group`s in
    // the same page load). Pinned as an ABSENCE so nobody re-adds it from the
    // armchair — the reasoning that produces it is sound, and the platform does
    // not honour it. SBR-004 §9.3.
    expect(link.parameters?.maxWidth).toBeUndefined();
    // The bar it sits in is still the wrapping row AC4 asserts.
    const bar = byLabel(written['Site/Nav'], 'Group', 'Navigation');
    expect(bar.parameters?.flexDirection).toBe('row');
    expect(bar.parameters?.flexWrap).toBe('wrap');
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
      pageInputs: count('PageInputs'),
      timers: count('Timer')
    }).toEqual({
      // The page by slug, its sections, the two singletons, and the nav's.
      queries: 5,
      // `submitContactForm`, and nothing else — a visitor calls one endpoint.
      functions: 1,
      // Sections, nav links, and — SBR-005 — a gallery's pictures.
      repeaters: 3,
      // NavLink 1, SectionView 1, ContactForm 1, Nav 0, Site 7 — Site gained
      // `diagnoseNotFound` with SB-015 F27, and NavLink gained `linkState` with
      // SBR-004 (the current-page state, AC2).
      //
      // 🔴 **SBR-005 added five components and the code-node count went DOWN by
      // nothing and up by nothing — +1 and −1.** Four of the five kinds are pure
      // layout: everything conditional is decided once in `SectionView`'s dispatch
      // and arrives as a port, so the only script the kinds needed is
      // `Site/CtaSection`'s `route`, where "a slug or the open web" is a genuine
      // branch. Against it, `/Pages/Site` lost `readSections` with the duplicate
      // contact form (D37).
      code: 10,
      pages: 1,
      // Three: the nav link, SBR-004's footer link home, and SBR-005's call to
      // action. The site still never navigates away from ITSELF — all three
      // target the one catch-all component and differ only in the slug they
      // carry, which is what makes a CTA's page target expressible at all.
      navigations: 3,
      pageInputs: 1,
      // SBR-002's answer deadline, and only that — a second Timer would be a
      // second writer racing the first onto the same watchdog port.
      timers: 1
    });
  });
});
