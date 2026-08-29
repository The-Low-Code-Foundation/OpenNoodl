/**
 * The Site Builder drive harness — the instrument SB-008 and SB-015 share.
 *
 * SB-008 measured the template against **the policy SB-004 §4 specifies**.
 * SB-015 measures the same template against **the policy a person actually
 * gets**, which is a different file and nothing else. Two suites comparing two
 * configurations only mean something if everything either side of the
 * configuration is identical, so the authoring, the binding, the data directory
 * and the way a page is read all live here rather than in either suite.
 *
 * ⚠️ Extracted from `sb008-public-site-drive.test.ts`, which is where all of it
 * was written and graded. A test file cannot be imported from another test file
 * without running its `describe`s, so the alternative to this module was a
 * second copy — and a second copy of a control is the copy that goes stale.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../../../noodl-mcp/src/server';
import { SB004_COMPONENTS } from '../../../noodl-mcp/tests/sb004Components';
import { SB005_COMPONENTS, createPass as createPass005 } from '../../../noodl-mcp/tests/sb005Components';
import { SB006_COMPONENTS, createPass as createPass006 } from '../../../noodl-mcp/tests/sb006Components';

/**
 * SB-004 §4's policy — **imported from the artefact the template ships**, not
 * retyped here.
 *
 * 🔴 This used to be a typed constant, and it was a second copy of a policy that
 * nothing shipped: SB-008 could measure a real publication boundary produced by
 * a file that no project would ever receive. SB-015's fix made the policy a
 * shipped artefact (`site-builder.security.json`, written into a new project as
 * `nodegx.security.json`), so the honest thing is for the drive to read the same
 * file. What SB-008 measures is now what a person gets.
 *
 * For SB-015's own suite it is still the *control*: the arm that renders the
 * site correctly is the arm with this policy, and the finding was that nothing
 * carried it.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const SITE_SECURITY = require('../../../noodl-editor/src/editor/src/models/template/templates/site-builder.security.json') as {
  version: number;
  devOpen: boolean;
  defaults: { permissions: Record<string, string>; creatorOwns: boolean };
  collections: Record<string, { permissions: Record<string, string> }>;
  functions: Record<string, { call: string }>;
  files: Record<string, string>;
  signup: string;
};

/** SB-004 §3's draft state, as a record on the wire carries it. */
export const DRAFT_ACL = { 'role:admin': { read: true, write: true } };
/** …and the state a row that anyone may read is in. */
export const PUBLIC_ACL = { 'role:admin': { read: true, write: true }, '*': { read: true, write: false } };

// ── Authoring ────────────────────────────────────────────────────────────────

interface ToolResult {
  isError?: boolean;
  content?: Array<{ type: string; text: string }>;
}

/**
 * The whole template, through the real MCP server, into one project directory.
 *
 * `createServer` from `src` and not the built dist: the dist on this machine is
 * days old and the bound servers run it (SB-004 §6 F4), so authoring through it
 * would exercise code that is not the code under test.
 *
 * 🔴 The order is load-bearing. SB-006 F17: the door makes the first page it
 * writes the router's start page. SB-006 F14: the public site is a catch-all at
 * `{slug}` and the Router breaks a page-pattern tie by the order its `pages`
 * list names. So the site is authored **first** and the panel second.
 */
export async function authorSiteTemplate(label: string): Promise<string> {
  const fixture = path.join(__dirname, '..', '..', '..', 'noodl-mcp', 'tests', 'fixtures', 'demo-app');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${label}-project-`));
  fs.cpSync(fixture, dir, { recursive: true });

  const { server } = createServer({ projectDir: dir, allowWrites: true });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: label, version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const write = async (name: string, args: Record<string, unknown>, what: string) => {
    const res = (await client.callTool({ name, arguments: args })) as ToolResult;
    // A rejection here is evidence, not a mystery — print what the door said.
    if (res.isError) throw new Error(`${name} ${what} refused:\n${res.content?.[0]?.text}`);
  };

  for (const c of SB006_COMPONENTS) {
    const payload = createPass006(c);
    await write('create_component', { path: c.path, nodes: payload.nodes, connections: payload.connections }, c.path);
  }
  for (const c of SB006_COMPONENTS) {
    if (!c.deferred?.length) continue;
    await write('update_component', { path: c.path, set: { nodes: c.nodes, connections: c.connections } }, c.path);
  }

  // Then the panel, which shares the site's router (SB-012's two passes again).
  for (const c of SB005_COMPONENTS) {
    const payload = createPass005(c);
    await write('create_component', { path: c.path, nodes: payload.nodes, connections: payload.connections }, c.path);
  }
  for (const c of SB005_COMPONENTS) {
    if (!c.deferred?.length) continue;
    await write('update_component', { path: c.path, set: { nodes: c.nodes, connections: c.connections } }, c.path);
  }

  // And the cloud half, which the browser reaches over HTTP rather than in-page.
  for (const c of SB004_COMPONENTS) {
    await write('create_component', { path: c.path, nodes: c.nodes, connections: c.connections }, c.path);
  }

  await client.close();
  await server.close();
  return dir;
}

/**
 * Point the project's records nodes at the backend this run started.
 *
 * `render-from-disk.js:292` rewrites `metadata.cloudservices.endpoint` to a
 * same-origin `/__backend` path it proxies — **but only when the key is already
 * there**, and the MCP fixture has no `metadata` block at all. Without this the
 * whole site renders with every query silently unbound, which is a blank page
 * for a reason that has nothing to do with permissions.
 */
export function bindProjectToBackend(
  projectDir: string,
  backendId: string,
  backendPort: number
): { appId: string; endpoint: string } {
  const file = path.join(projectDir, 'nodegx.project.json');
  const project = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
  const metadata = (project.metadata as Record<string, unknown>) ?? {};
  const cloudservices = { appId: backendId, endpoint: `http://127.0.0.1:${backendPort}` };
  metadata.cloudservices = cloudservices;
  project.metadata = metadata;
  fs.writeFileSync(file, JSON.stringify(project, null, 2));
  return cloudservices;
}

/**
 * A data directory holding the deployed bundle, ready to `start()`.
 *
 * ⚠️ `security` is written **before** start(): `SecurityState` reads it in its
 * constructor, and a config applied afterwards would leave the boot running
 * dev-open.
 *
 * 🔴 `security: null` writes **no file at all**, which is not the same as
 * writing `defaultSecurityConfig()` and is the entire point of SB-015 arm A: it
 * is the state `provisionBackend` leaves a backend in, and the backend mints its
 * own defaults from it. A typed copy of the defaults would be a claim about what
 * the defaults are; an absent file is the thing itself.
 */
export function makeSiteDataDir(
  bundle: unknown,
  secrets: Record<string, string>,
  security: Record<string, unknown> | null = SITE_SECURITY,
  label = 'site'
): string {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), `${label}-data-`));
  fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'workflows', 'site.workflow.json'), JSON.stringify(bundle));
  if (security !== null) {
    fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(security));
  }
  fs.writeFileSync(path.join(dataDir, 'secrets.json'), JSON.stringify({ functions: secrets }));
  return dataDir;
}

// ── The browser ──────────────────────────────────────────────────────────────

/**
 * `scripts/devtools/render-report.js` — the eyes. It serves the project through
 * `render-from-disk.js` (which reconstructs the exporter's `routerIndex`, proxies
 * `/__backend` to a real backend and serves `index.html` for extension-less
 * paths so a `urlPath` route is reachable at all) and drives a headless Chrome
 * over CDP.
 *
 * `require`d rather than imported because it is repo-layout-dependent plain JS
 * with no build step, which is deliberate on its side.
 */
export interface RenderedPage {
  evaluate(expression: string): Promise<unknown>;
  navigate(urlPath: string): Promise<void>;
  setViewport(vp: { width: number; height: number; mobile?: boolean }): Promise<void>;
  consoleErrors: string[];
  serverLog(): string;
  servePort: number;
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const { withRenderedPage } = require('../../../../scripts/devtools/render-report') as {
  withRenderedPage<T>(
    options: { projectDir: string; backendPort?: number },
    fn: (page: RenderedPage) => Promise<T>
  ): Promise<T>;
};

/** What one visit to one URL yields — read once, asserted many times. */
export interface Visit {
  url: string;
  /** `document.body.innerText`, which is what a reader sees and nothing else. */
  text: string;
  /** The whole document, which is where a hidden leak would be. */
  html: string;
  /** The document title, which is the SEO half F16 is about. */
  title: string;
  /** `<h1>` contents, in order. The page's own heading is the records-driven one. */
  headings: string[];
  /** The `nav` band's link text, in DOM order. */
  nav: string[];
  /** `<meta name="description">`, the port half of F16. */
  description: string | null;
  /** What the page logged as an error **during this visit** — not cumulatively. */
  errors: string[];
}

/**
 * Everything one visit yields, in a single `Runtime.evaluate`.
 *
 * One expression rather than five: each round trip is a chance for the page to
 * change under the reader, and a report assembled from five moments is a report
 * about no moment at all.
 */
export const READ_PAGE = `(function () {
  return JSON.stringify({
    text: document.body ? document.body.innerText : '',
    /**
     * 🔴 The whole document, not just what a reader sees. An absence claim read
     * off \`innerText\` alone would pass on a draft that IS on the page and merely
     * hidden — \`visible: false\` renders as \`display: none\`, and \`innerText\`
     * skips it.
     */
    html: document.documentElement.outerHTML,
    title: document.title,
    headings: Array.prototype.map.call(document.querySelectorAll('h1'), function (h) { return h.innerText; }),
    nav: Array.prototype.map.call(document.querySelectorAll('nav *'), function (n) {
      return n.innerText;
    }).filter(function (t) { return t && t.trim(); }),
    description: (function () {
      var m = document.querySelector('meta[name="description"]');
      return m ? m.getAttribute('content') : null;
    })()
  });
})()`;

/**
 * Visit one URL and read the whole document once it has stopped changing.
 *
 * The site's chain is four sequential round trips — the settings row, then the
 * slug, then the page, then its sections — so a single settle is not enough on a
 * cold connection.
 *
 * ⚠️ The settle loop breaks on a **non-empty** text that stopped changing, so a
 * page that legitimately renders nothing costs the full twenty iterations rather
 * than returning early. That is deliberate: exiting early on an empty body would
 * make "the page never rendered" and "the page rendered nothing" the same
 * reading, and under SB-015 arm C they are the two candidate answers.
 *
 * `consoleErrors` is per-visit rather than cumulative: it is one array for the
 * whole browser session, so a later page would inherit an earlier page's failure
 * and "this page logged nothing" would be unfalsifiable after the first one.
 */
export async function readVisit(page: RenderedPage, url: string): Promise<Visit> {
  const before = page.consoleErrors.length;
  await page.navigate(url);
  let last = '';
  let raw = '';
  for (let i = 0; i < 20; i++) {
    raw = String(await page.evaluate(READ_PAGE));
    const parsed = JSON.parse(raw) as Omit<Visit, 'url' | 'errors'>;
    if (parsed.text === last && parsed.text.length > 0) break;
    last = parsed.text;
    await new Promise((r) => setTimeout(r, 500));
  }
  const parsed = JSON.parse(raw) as Omit<Visit, 'url' | 'errors'>;
  return { url, ...parsed, errors: page.consoleErrors.slice(before) };
}

/**
 * Read the page **where it already is**, without navigating.
 *
 * 🔴 **Why this exists.** `readVisit` navigates, and a confirmation that a click
 * produced is state on the *current* page — reloading the URL destroys it. A
 * spec that clicked "Post it" and then called `readVisit('/post')` was asserting
 * that a freshly-loaded page shows "Posted", which is true only of a page whose
 * gate fires on load. That is exactly the D14 defect, so the spec passed *because
 * of* the bug and went red the moment it was fixed. Reading in place is the
 * difference between grading the click and grading the boot.
 *
 * ⚠️ `until` is a **bounded** wait for an asynchronous write to land, not a
 * retry until the wanted answer appears: if the string never shows up the reader
 * returns the real document and the caller's assertion fails against it, naming
 * what was actually on the page. Without it the only alternative is a fixed
 * sleep, which is the same wait with a worse failure mode.
 */
export async function readHere(
  page: RenderedPage,
  opts: { until?: string; timeoutMs?: number } = {}
): Promise<Visit> {
  const before = page.consoleErrors.length;
  const deadline = Date.now() + (opts.timeoutMs ?? 15000);
  let raw = String(await page.evaluate(READ_PAGE));
  while (opts.until !== undefined && Date.now() < deadline) {
    if ((JSON.parse(raw) as { text: string }).text.includes(opts.until)) break;
    await new Promise((r) => setTimeout(r, 250));
    raw = String(await page.evaluate(READ_PAGE));
  }
  const parsed = JSON.parse(raw) as Omit<Visit, 'url' | 'errors'>;
  const url = String(await page.evaluate('window.location.pathname'));
  return { url, ...parsed, errors: page.consoleErrors.slice(before) };
}
