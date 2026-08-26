/**
 * SB-008 — the drive. The public site, in a browser, against a real backend
 * with row-level enforcement on.
 *
 * 🔴 **This is the only thing in the phase that can say the browser half works.**
 * SB-005 and SB-006 both closed 🟡 — structurally complete, mutation-graded,
 * behaviourally unmeasured — and both left one acceptance criterion explicitly
 * unmet and named this file: *an anonymous visitor loads a published page
 * through this site and gets a 404-equivalent for an unpublished one*. Five
 * sessions in this phase produced a green authoring run; three of them shipped
 * something broken. A graph is a claim; this is the evidence.
 *
 * ## The three conditions that make it a measurement rather than a demo
 *
 * 🔴 **1. `devOpen: false`.** `devOpenActive` disables row-level ACL entirely
 * (`state.ts:286-287`), and the publication boundary of this template is
 * *nothing but* row-level ACL — `Page.find` is `public` by design (SB-004 §4),
 * so with dev-open on a loopback backend serves every draft to anybody and the
 * drive still looks green. `started.security.enforced` is asserted before
 * anything else, exactly as SB-004 §7 does.
 *
 * 🔴 **2. The visitor is anonymous through the whole browser.** No session
 * token is ever handed to the page. Every seeded row is written over HTTP by an
 * admin *outside* the browser, and every claim about who can see what is read
 * off the DOM a browser with no credential produced.
 *
 * 🔴 **3. The components are the ones the doors wrote.** `sb006Components.ts`
 * and `sb005Components.ts` are authored here through the real MCP server and
 * served **from disk**, not re-typed. `sb004Components.ts` is authored beside
 * them and deployed to the backend through the same bridge SB-004 §7 used. A
 * twin agrees with the artefact until the first edit that reaches one of them.
 *
 * ## The order the components are written in is load-bearing
 *
 * SB-006 F17: the door makes the first page it writes the router's start page.
 * SB-006 F14: the public site is a catch-all at `{slug}` and the Router breaks
 * a page-pattern tie by the order its `pages` list happens to name. So the site
 * is authored **first** and the panel second — the same order
 * `sb006PublicSite.test.ts` uses, and for the same two reasons.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../../noodl-mcp/src/server';
import { SB004_COMPONENTS } from '../../noodl-mcp/tests/sb004Components';
import { SB005_COMPONENTS, createPass as createPass005 } from '../../noodl-mcp/tests/sb005Components';
import {
  NOT_FOUND_TEXT,
  SB006_COMPONENTS,
  createPass as createPass006
} from '../../noodl-mcp/tests/sb006Components';
import { BackendService } from '../src/service';

import { bundleAuthoredComponents, WorkflowBundle } from './helpers/authored-bundle';
import { adminHeaders, httpClient } from './helpers/http';

jest.setTimeout(600000);

const SETUP_TOKEN = 'sb008-setup-token-71c3ad';
const CONTACT_TO = 'owner@example.invalid';

/** SB-004 §4, verbatim — the same policy file the template ships. */
const SITE_SECURITY = {
  version: 1,
  devOpen: false,
  defaults: {
    permissions: {
      find: 'authenticated',
      get: 'authenticated',
      create: 'authenticated',
      update: 'authenticated',
      delete: 'authenticated'
    },
    creatorOwns: false
  },
  collections: {
    Page: { permissions: { find: 'public', get: 'public', create: 'role:admin', update: 'role:admin', delete: 'role:admin' } },
    Section: { permissions: { find: 'public', get: 'public', create: 'role:admin', update: 'role:admin', delete: 'role:admin' } },
    Theme: { permissions: { find: 'public', get: 'public', create: 'role:admin', update: 'role:admin', delete: 'role:admin' } },
    SiteSettings: { permissions: { find: 'public', get: 'public', create: 'role:admin', update: 'role:admin', delete: 'role:admin' } },
    ContactMessage: {
      permissions: { find: 'role:admin', get: 'role:admin', create: 'nobody', update: 'role:admin', delete: 'nobody' }
    }
  },
  functions: {
    publishPage: { call: 'role:admin' },
    duplicatePage: { call: 'role:admin' },
    submitContactForm: { call: 'public' },
    claimSite: { call: 'authenticated' }
  },
  files: { upload: 'authenticated', read: 'public', delete: 'nobody' },
  signup: 'public'
};

/** SB-004 §3's draft state, as a record on the wire carries it. */
const DRAFT_ACL = { 'role:admin': { read: true, write: true } };
/** …and the state a row that anyone may read is in. Seeded rows that are not pages. */
const PUBLIC_ACL = { 'role:admin': { read: true, write: true }, '*': { read: true, write: false } };

// ── The browser harness, which is plain CommonJS on purpose ──────────────────

/**
 * `scripts/devtools/render-report.js` — the eyes. It serves the project through
 * `render-from-disk.js` (which reconstructs the exporter's `routerIndex`, proxies
 * `/__backend` to a real backend and serves `index.html` for extension-less
 * paths so a `urlPath` route is reachable at all) and drives a headless Chrome
 * over CDP.
 *
 * `require`d rather than imported because it is repo-layout-dependent plain JS
 * with no build step, which is deliberate on its side; this package's jest
 * transform covers `.ts` and `.html`/`.css` only, so it loads as the CJS it is.
 */
interface RenderedPage {
  evaluate(expression: string): Promise<unknown>;
  navigate(urlPath: string): Promise<void>;
  setViewport(vp: { width: number; height: number; mobile?: boolean }): Promise<void>;
  consoleErrors: string[];
  serverLog(): string;
  servePort: number;
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { withRenderedPage } = require('../../../scripts/devtools/render-report') as {
  withRenderedPage<T>(
    options: { projectDir: string; backendPort?: number },
    fn: (page: RenderedPage) => Promise<T>
  ): Promise<T>;
};

/** What one visit to one URL yields — read once, asserted many times. */
interface Visit {
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
 */
async function authorTemplate(): Promise<string> {
  const fixture = path.join(__dirname, '..', '..', 'noodl-mcp', 'tests', 'fixtures', 'demo-app');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb008-project-'));
  fs.cpSync(fixture, dir, { recursive: true });

  const { server } = createServer({ projectDir: dir, allowWrites: true });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'sb008-drive', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const write = async (name: string, args: Record<string, unknown>, label: string) => {
    const res = (await client.callTool({ name, arguments: args })) as ToolResult;
    // A rejection here is evidence, not a mystery — print what the door said.
    if (res.isError) throw new Error(`${name} ${label} refused:\n${res.content?.[0]?.text}`);
  };

  // 🔴 The site FIRST — F17 (start page) and F14 (the catch-all's tie).
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
function bindProjectToBackend(
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

/** A data directory with the template's policy in it, ready to `start()`. */
function makeDataDir(
  bundle: WorkflowBundle,
  secrets: Record<string, string>,
  security: Record<string, unknown> = SITE_SECURITY
): string {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb008-data-'));
  fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'workflows', 'site.workflow.json'), JSON.stringify(bundle));
  // ⚠️ Before start(): `SecurityState` reads it in its constructor, and a config
  // applied afterwards would leave the boot running dev-open.
  fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(security));
  fs.writeFileSync(path.join(dataDir, 'secrets.json'), JSON.stringify({ functions: secrets }));
  return dataDir;
}

interface Session {
  id: string;
  token: string;
}
interface Row {
  objectId: string;
  [field: string]: unknown;
}

/**
 * One claim, on a backend of its own, counted — the instrument F21 is measured
 * with.
 *
 * `mutate` runs over the deployed bundle before the backend boots, so an arm can
 * vary **one wire** of the shipped graph and nothing else. That is what makes
 * the pair a measurement rather than two anecdotes: both arms author the same
 * components, deploy the same way, and differ in the single edge under test.
 */
async function claimOnce(
  bundle: WorkflowBundle,
  label: string,
  mutate?: (b: WorkflowBundle) => void
): Promise<{ settings: number; roleUsers: number }> {
  const copy = JSON.parse(JSON.stringify(bundle)) as WorkflowBundle;
  if (mutate) mutate(copy);

  const dir = makeDataDir(copy, { SITE_SETUP_TOKEN: SETUP_TOKEN, CONTACT_RECIPIENT_EMAIL: CONTACT_TO });
  const svc = new BackendService({ dataDir: dir, port: 0, backendId: `sb008-${label}`, backendName: label });
  const started = await svc.start();
  const c = httpClient(() => started.listen.url);
  try {
    expect(started.security.enforced).toBe(true);
    const user = await c.post<{ objectId: string; sessionToken: string }>('/users', {
      username: `claimer-${label}`,
      password: 'pw'
    });
    const headers = { 'x-parse-session-token': user.json.sessionToken };
    const claimed = await c.post<{ result?: { claimed?: boolean } }>(
      '/functions/claimSite',
      { setupToken: SETUP_TOKEN },
      headers
    );
    expect(`${label} claimed:${claimed.json.result?.claimed}`).toBe(`${label} claimed:true`);

    const rows = await c.get<{ results: Row[] }>('/classes/SiteSettings', headers);
    const roles = await c.get<{ roles: Array<{ name: string; users: string[] }> }>(
      '/admin/roles',
      adminHeaders(dir)
    );
    return {
      settings: rows.json.results.length,
      roleUsers: roles.json.roles.find((r) => r.name === 'admin')?.users.length ?? 0
    };
  } finally {
    await svc.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Visit one URL and read the whole document once it has stopped changing.
 *
 * The site's chain is four sequential round trips — the settings row, then the
 * slug, then the page, then its sections — so a single settle is not enough on a
 * cold connection.
 *
 * `consoleErrors` is per-visit rather than cumulative: it is one array for the
 * whole browser session, so a later page would inherit an earlier page's failure
 * and "this page logged nothing" would be unfalsifiable after the first one.
 */
async function readVisit(page: RenderedPage, url: string): Promise<Visit> {
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

/** Drop one wire from one deployed component, by its ports. */
function dropWire(bundle: WorkflowBundle, component: string, sourcePort: string, targetPort: string): void {
  const c = bundle.components.find((x) => x.name === component);
  if (!c) throw new Error(`no such component in the bundle: ${component}`);
  const before = c.connections.length;
  c.connections = c.connections.filter((w) => !(w.sourcePort === sourcePort && w.targetPort === targetPort));
  // A mutant that removed nothing is an arm that varied nothing.
  expect(`${sourcePort}->${targetPort} removed:${before - c.connections.length}`).toBe(
    `${sourcePort}->${targetPort} removed:1`
  );
}

// ── The measured page, as one expression evaluated in the browser ────────────

/**
 * Everything one visit yields, in a single `Runtime.evaluate`.
 *
 * One expression rather than five: each round trip is a chance for the page to
 * change under the reader, and a report assembled from five moments is a report
 * about no moment at all.
 */
const READ_PAGE = `(function () {
  return JSON.stringify({
    text: document.body ? document.body.innerText : '',
    /**
     * 🔴 The whole document, not just what a reader sees. An absence claim read
     * off \`innerText\` alone would pass on a draft that IS on the page and merely
     * hidden — \`visible: false\` renders as \`display: none\`, and \`innerText\`
     * skips it. This is the string the leak assertions are made against.
     */
    html: document.documentElement.outerHTML,
    title: document.title,
    headings: Array.prototype.map.call(document.querySelectorAll('h1'), function (h) { return h.innerText; }),
    /** The nav band's links, in DOM order — SB-004 §2's derived navigation. */
    nav: Array.prototype.map.call(document.querySelectorAll('nav *'), function (n) {
      return n.innerText;
    }).filter(function (t) { return t && t.trim(); }),
    description: (function () {
      var m = document.querySelector('meta[name="description"]');
      return m ? m.getAttribute('content') : null;
    })()
  });
})()`;

describe('SB-008 — the public site in a browser, against an enforcing backend', () => {
  let projectDir: string;
  let bundle: WorkflowBundle;
  let dataDir: string;
  let service: BackendService;
  let base = '';
  let backendPort = 0;
  /** The dev-open twin, which exists only to prove the instrument sees a leak. */
  let openService: BackendService | undefined;
  let openDataDir = '';
  /** What the project pointed at when the enforcing drive ran — snapshotted, not re-read. */
  let boundAtDriveTime: { appId: string; endpoint: string } | undefined;

  const client = httpClient(() => base);
  const asUser = (s: Session) => ({ 'x-parse-session-token': s.token });
  let owner: Session;

  /** Every URL this drive visits, read once in `beforeAll` and asserted below. */
  const visits: Record<string, Visit> = {};
  const ids: Record<string, string> = {};
  /** F20 — how many `Theme` rows a freshly claimed site has. */
  let themeRowsAfterClaim = -1;
  /** F21 — how many `SiteSettings` rows one claim leaves behind. */
  let settingsRowsAfterClaim = -1;

  async function signup(username: string): Promise<Session> {
    const res = await client.post<{ objectId: string; sessionToken: string }>('/users', {
      username,
      password: `pw-${username}`
    });
    expect(res.status).toBe(201);
    return { id: res.json.objectId, token: res.json.sessionToken };
  }

  const createAsAdmin = (className: string, body: Record<string, unknown>) =>
    client.post<Row>(`/classes/${className}`, body, asUser(owner));

  beforeAll(async () => {
    projectDir = await authorTemplate();
    bundle = bundleAuthoredComponents(projectDir, SB004_COMPONENTS.map((c) => c.key));

    dataDir = makeDataDir(bundle, { SITE_SETUP_TOKEN: SETUP_TOKEN, CONTACT_RECIPIENT_EMAIL: CONTACT_TO });
    service = new BackendService({ dataDir, port: 0, backendId: 'sb008', backendName: 'SB-008 site' });
    const started = await service.start();
    base = started.listen.url;
    backendPort = started.listen.port;

    // 🔴 Condition 1. Without this every reading below would be taken with
    // row-level ACL switched off, which is the one configuration in which this
    // template leaks every draft and still looks correct.
    expect(started.security.enforced).toBe(true);

    boundAtDriveTime = bindProjectToBackend(projectDir, 'sb008', backendPort);

    // The owner becomes `role:admin` through the template's own door.
    owner = await signup('sb008-owner');
    const claimed = await client.post<{ result?: { claimed?: boolean } }>(
      '/functions/claimSite',
      { setupToken: SETUP_TOKEN },
      asUser(owner)
    );
    expect(claimed.status).toBe(200);
    expect(claimed.json.result?.claimed).toBe(true);

    // ── The site's content, written the way the panel writes it ──────────────
    //
    // 🔴 `claimSite` already wrote the `SiteSettings` singleton (`My site` /
    // `home`, world-readable), so the panel's setup page UPDATES it rather than
    // creating one — and so does this. Creating a second row was the first thing
    // this drive got wrong, and it is invisible in the result: the site rendered,
    // reading `rows[0]`, which was the claim's row and not the seeded one.
    const existing = await client.get<{ results: Row[] }>('/classes/SiteSettings', asUser(owner));
    settingsRowsAfterClaim = existing.json.results.length;
    // Printed because it is F21's evidence: the two rows are byte-identical apart
    // from the id, milliseconds apart, from one call.
    // eslint-disable-next-line no-console
    console.log(
      `\n[SB-008] SiteSettings after ONE claim: ${settingsRowsAfterClaim} row(s)\n` +
        existing.json.results.map((r) => `  ${r.objectId} ${r.createdAt} ${JSON.stringify(r.siteName)}`).join('\n')
    );
    ids.settings = existing.json.results[0].objectId;
    const settings = await client.put<Row>(
      `/classes/SiteSettings/${ids.settings}`,
      { siteName: 'Kestrel Joinery', homeSlug: 'home' },
      asUser(owner)
    );
    expect(settings.status).toBe(200);

    // 🔴 F20, measured here rather than asserted from the graph alone: a freshly
    // claimed site has NO `Theme` row, and nothing in the template ever creates
    // one — the theme editor saves by `theme.firstItemId`, which is undefined on
    // an empty collection. Recorded as a spec below; seeded here so the theme
    // half of the site can be driven at all.
    themeRowsAfterClaim = (await client.get<{ results: Row[] }>('/classes/Theme', asUser(owner))).json.results
      .length;
    const theme = await createAsAdmin('Theme', {
      ACL: PUBLIC_ACL,
      tokens: { colorPrimary: '#1f6feb', colorBackground: '#fffdf7', colorText: '#12202e', fontFamily: 'Georgia, serif' }
    });
    expect(theme.status).toBe(201);

    /** A page and one richText section, both born drafts (SB-004 §3). */
    const makePage = async (title: string, slug: string, body: string, navOrder: number) => {
      const page = await createAsAdmin('Page', {
        ACL: DRAFT_ACL,
        title,
        slug,
        published: false,
        showInNav: true,
        navOrder,
        seoDescription: `${title} — description`
      });
      expect(`${slug}:${page.status}`).toBe(`${slug}:201`);
      const section = await createAsAdmin('Section', {
        ACL: DRAFT_ACL,
        kind: 'richText',
        order: 0,
        data: { body },
        pageId: page.json.objectId
      });
      expect(`${slug} section:${section.status}`).toBe(`${slug} section:201`);
      return page.json.objectId;
    };

    ids.home = await makePage('Welcome', 'home', 'HOME-BODY-MARKER', 1);
    ids.about = await makePage('About the workshop', 'about', 'ABOUT-BODY-MARKER', 2);
    ids.secret = await makePage('The unreleased page', 'secret', 'SECRET-BODY-MARKER', 3);

    // 🔴 Published through the template's own endpoint, not by typing an ACL.
    // SB-004 §7 measured that `publishPage` writes the right one; what this
    // drive needs is a page in the state the PRODUCT puts it in.
    for (const slug of ['home', 'about']) {
      const res = await client.post(`/functions/publishPage`, { pageId: ids[slug], publish: true }, asUser(owner));
      expect(`publish ${slug}:${res.status}`).toBe(`publish ${slug}:200`);
    }

    // ── And now the browser, with no credential of any kind ──────────────────
    await withRenderedPage({ projectDir, backendPort }, async (page) => {
      visits.root = await readVisit(page, '/');
      visits.about = await readVisit(page, '/about');
      visits.secret = await readVisit(page, '/secret');
      visits.nothing = await readVisit(page, '/no-such-page-at-all');

      // eslint-disable-next-line no-console
      console.log('\n[SB-008] server log:\n' + page.serverLog().slice(-2000));
      for (const [key, v] of Object.entries(visits)) {
        // eslint-disable-next-line no-console
        console.log(
          `\n[SB-008] ${key} (${v.url})\n  title=${JSON.stringify(v.title)}\n  h1=${JSON.stringify(v.headings)}\n` +
            `  nav=${JSON.stringify(v.nav)}\n  description=${JSON.stringify(v.description)}\n` +
            `  text=${JSON.stringify(v.text)}\n  errors=${JSON.stringify(v.errors)}`
        );
      }
    });

    // ── The positive control: the SAME site, with enforcement OFF ────────────
    //
    // 🔴 Everything above is an absence claim, and an absence claim is worth
    // nothing without a signal that is known to fire. "The draft did not appear"
    // has a dozen causes that have nothing to do with permissions — an unbound
    // query, a failed fetch, a page that never rendered — and each of them looks
    // identical from the DOM.
    //
    // So the boundary is *removed* and the same drive re-run. `devOpen: true` is
    // SB-004 F2's trap: `devOpenActive` disables row-level ACL entirely
    // (`state.ts:286-287`) and this template's `Page.find` is `public`, so with
    // it on there is nothing left to refuse. If the draft appears here, the
    // instrument can see a leak; if it did not, the whole suite above would be a
    // reading taken with the lens cap on.
    openDataDir = makeDataDir(bundle, { SITE_SETUP_TOKEN: SETUP_TOKEN, CONTACT_RECIPIENT_EMAIL: CONTACT_TO }, {
      ...SITE_SECURITY,
      devOpen: true
    });
    openService = new BackendService({
      dataDir: openDataDir,
      port: 0,
      backendId: 'sb008-open',
      backendName: 'SB-008 dev-open control'
    });
    const openStarted = await openService.start();
    // The arm's own precondition, read rather than assumed — this is the one
    // configuration difference between the two runs.
    expect(openStarted.security.enforced).toBe(false);

    const open = httpClient(() => openStarted.listen.url);
    const openUser = await open.post<{ objectId: string; sessionToken: string }>('/users', {
      username: 'sb008-open-owner',
      password: 'pw'
    });
    const openOwner = { 'x-parse-session-token': openUser.json.sessionToken };
    await open.post('/functions/claimSite', { setupToken: SETUP_TOKEN }, openOwner);
    const openSettings = (await open.get<{ results: Row[] }>('/classes/SiteSettings', openOwner)).json.results[0];
    await open.put(`/classes/SiteSettings/${openSettings.objectId}`, { siteName: 'Control', homeSlug: 'home' }, openOwner);
    // One page, drafted exactly as above and never published.
    const openDraft = await open.post<Row>(
      '/classes/Page',
      {
        ACL: DRAFT_ACL,
        title: 'The unreleased page',
        slug: 'secret',
        published: false,
        showInNav: true,
        navOrder: 1
      },
      openOwner
    );
    await open.post(
      '/classes/Section',
      { ACL: DRAFT_ACL, kind: 'richText', order: 0, data: { body: 'SECRET-BODY-MARKER' }, pageId: openDraft.json.objectId },
      openOwner
    );

    bindProjectToBackend(projectDir, 'sb008-open', openStarted.listen.port);
    await withRenderedPage({ projectDir, backendPort: openStarted.listen.port }, async (page) => {
      visits.leakControl = await readVisit(page, '/secret');
      // eslint-disable-next-line no-console
      console.log(
        `\n[SB-008] leakControl (/secret, devOpen:true)\n  h1=${JSON.stringify(visits.leakControl.headings)}\n` +
          `  text=${JSON.stringify(visits.leakControl.text)}`
      );
    });
  });

  afterAll(async () => {
    await service?.stop();
    await openService?.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
    if (openDataDir) fs.rmSync(openDataDir, { recursive: true, force: true });
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // 0. The conditions the readings below are only meaningful under
  // ==========================================================================

  describe('what was deployed, and under what enforcement', () => {
    it('deployed the four cloud components the door wrote', () => {
      expect(bundle.components.map((c) => c.name).sort()).toEqual(SB004_COMPONENTS.map((c) => c.legacyName).sort());
    });

    it('bound the browser project to THIS backend', () => {
      // The reading that stops a green run from being a run against nothing:
      // with no `cloudservices` key `render-from-disk.js` has nothing to rewrite,
      // every query goes unbound, and a blank page looks like a permissions
      // result. `appId` is the backend's id, and the endpoint is rewritten to a
      // same-origin `/__backend` the server proxies.
      //
      // ⚠️ Snapshotted at bind time, not read here: the dev-open control rebinds
      // the same file at the end of `beforeAll`, so reading it now would report
      // the control's backend and quietly certify the wrong run.
      expect(boundAtDriveTime?.appId).toBe('sb008');
      expect(boundAtDriveTime?.endpoint).toBe(`http://127.0.0.1:${backendPort}`);
    });

    it('drove five URLs and rendered something on every one of them', () => {
      // 🔴 The floor under every absence claim below. A blank page contains no
      // draft either, so "the draft did not leak" is worth nothing until the
      // instrument is known to draw.
      expect(Object.keys(visits).sort()).toEqual(['about', 'leakControl', 'nothing', 'root', 'secret']);
      for (const [key, v] of Object.entries(visits)) {
        expect(`${key}:${v.text.length > 0}`).toBe(`${key}:true`);
      }
    });
  });

  // ==========================================================================
  // 1. THE CLAIM — SB-005 acceptance 6 and SB-006 acceptance 9, from the browser
  // ==========================================================================

  describe('🔴 the publication boundary, through the shipped site', () => {
    it('renders a PUBLISHED page to an anonymous visitor, records and all', () => {
      const v = visits.about;
      // The known-firing signal the two absence claims below stand on: this
      // instrument does render a page's title, its heading and its section body
      // when it is allowed to.
      expect(v.headings).toEqual(['About the workshop']);
      expect(v.text).toContain('ABOUT-BODY-MARKER');
      expect(v.text).toContain('Kestrel Joinery');
      expect(v.text).not.toContain(NOT_FOUND_TEXT);
    });

    it('🔴 the OTHER control: with enforcement off, the same draft DOES render', () => {
      // The known-firing arm. Same project, same components, same seed, one
      // configuration line different — and the draft the enforcing run refused
      // is on the page. So "the draft did not appear" above is a statement about
      // the ACL and not about the harness.
      const v = visits.leakControl;
      expect(v.headings).toEqual(['The unreleased page']);
      expect(v.text).toContain('SECRET-BODY-MARKER');
      expect(v.text).not.toContain(NOT_FOUND_TEXT);
    });

    it('🔴 404s an UNPUBLISHED page — and leaks no part of it into the document', () => {
      const v = visits.secret;
      expect(v.text).toContain(NOT_FOUND_TEXT);
      // Against the whole document, not the visible text: a draft that rendered
      // behind `display: none` would pass an `innerText` check.
      expect(v.html).not.toContain('SECRET-BODY-MARKER');
      expect(v.html).not.toContain('The unreleased page');
      expect(v.headings).toEqual(['']);
      expect(v.title).not.toContain('unreleased');
    });

    it('answers a slug that is not a record the SAME way it answers a draft', () => {
      // The visitor must not be able to tell "this page exists but is not for
      // you" from "there is no such page" — the same rule SB-004 §7 applied to
      // `claimSite`'s refusal, one layer up.
      expect(visits.nothing.text).toContain(NOT_FOUND_TEXT);
      expect(visits.nothing.headings).toEqual(visits.secret.headings);
      expect(visits.nothing.title).toEqual(visits.secret.title);
    });

    it('🔴 the control: the draft is THERE, and an admin can read it', async () => {
      // Without this the 404 above is consistent with "the row was never
      // written" — the reading would fit, and would exclude nothing. The admin
      // sees the row; the anonymous caller gets nothing back.
      const asOwner = await client.get<Row>(`/classes/Page/${ids.secret}`, asUser(owner));
      expect(asOwner.status).toBe(200);
      expect(asOwner.json.title).toBe('The unreleased page');

      const anonymous = await client.get<Row>(`/classes/Page/${ids.secret}`);
      expect(anonymous.status).toBe(404);

      // And the published one, by the same two callers — so the difference is
      // the publication state and not the caller.
      expect((await client.get<Row>(`/classes/Page/${ids.about}`)).status).toBe(200);
    });
  });

  // ==========================================================================
  // 2. The pages that ARE reachable, and how the visitor gets to them
  // ==========================================================================

  describe('the derived navigation and the routing', () => {
    it('🔴 draws a link per PUBLISHED page, in navOrder, and none for the draft', () => {
      // SB-004 §2's "navigation is derived, never stored". Before SB-008 F18 this
      // list was EMPTY on every page: the nav query filters `showInNav` — a
      // boolean literal — and the SQLite adapter could not bind one, so the query
      // 500'd and the site rendered with no navigation at all.
      //
      // No `published` rule is on that query on purpose (SB-006 §3): the ACL has
      // already removed the drafts, and a second copy of a permission boundary is
      // the copy that goes stale. So the draft's absence here is the ACL working.
      expect(visits.about.nav).toEqual(['Welcome', 'About the workshop']);
      expect(visits.about.nav.join('|')).not.toContain('unreleased');
    });

    it('opens the root URL on the home page the settings row names', () => {
      // SB-006 F17 as a property rather than as an authoring order: the page the
      // root URL resolves to is the one the app opens on. `homeSlug` is what
      // makes an empty slug mean something.
      expect(visits.root.headings).toEqual(['Welcome']);
      expect(visits.root.text).toContain('HOME-BODY-MARKER');
    });

    it('reaches a content slug through the catch-all rather than a route', () => {
      // `/about` is a record, not a component — the whole product. It resolved
      // through `{slug}` and nothing tied for it (SB-006 F14, over both panels).
      expect(visits.about.url).toBe('/about');
      expect(visits.about.headings).toEqual(['About the workshop']);
    });
  });

  // ==========================================================================
  // 3. F16 in a browser — the half that works and the half that does not
  // ==========================================================================

  describe('the SEO surface, which is what this template is sold on', () => {
    it('🔴 titles the tab from the RECORD, through Noodl.SEO.setTitle', () => {
      // SB-006 F16: the `Page` node's `title` port is dead after export — the
      // Router titles the document from the exported `routerIndex`, which carries
      // the authored parameter `'Site'`. Every page of a records-driven site
      // would share it. This is the only reading that can tell the working fix
      // from the one that looks right.
      expect(visits.about.title).toBe('About the workshop');
      expect(visits.root.title).toBe('Welcome');
      expect(visits.about.title).not.toBe('Site');

      // …and the not-found page keeps the static one, because no record named it.
      expect(visits.secret.title).toBe('Site');
    });

    it('sets the description from the `Page` node port, which IS live', () => {
      expect(visits.about.description).toBe('About the workshop — description');
      expect(visits.root.description).toBe('Welcome — description');
    });
  });

  // ==========================================================================
  // 4. What the page said while it was up
  // ==========================================================================

  describe('the console', () => {
    it('🔴 logs no failed query on any of the four URLs', () => {
      // This is the check that found F18. A query that fails is not a blank
      // region — it is a blank region plus a line in a console nobody reads, and
      // every structural spec in this phase was green over it.
      const failures = Object.entries(visits).flatMap(([key, v]) =>
        v.errors.filter((e) => /query-failed|Failed to fetch/.test(e)).map((e) => `${key}: ${e}`)
      );
      expect(failures).toEqual([]);
    });
  });

  // ==========================================================================
  // 5. F20 — the row nothing creates
  // ==========================================================================

  describe('🔴 F21 — one claim writes the SiteSettings singleton TWICE', () => {
    it('measured: a single `claimSite` leaves two identical rows', () => {
      // Read on the drive's own backend, after exactly one claim. Both rows
      // carry `My site` / `home` and the same world-read ACL, milliseconds
      // apart. SB-004 §7 graded `claimSite` with five mutants and could not see
      // this: it asserted the role, the ACL and the refusal paths, and never
      // counted the rows.
      expect(settingsRowsAfterClaim).toBe(2);
    });

    it('🔴 and the consequence is not cosmetic: the site reads rows[0]', () => {
      // `readSettings` on the public site and `readSettings` in the panel both
      // take `rows[0]`. Nothing orders that list, so the panel's setup page can
      // edit whichever row the backend returns first for IT while the site reads
      // whichever comes first for the site — the same field, two rows, and a
      // "Save" that appears to do nothing.
      expect(visits.about.text).toContain('Kestrel Joinery');
      // The row this drive edited is the one both readers agreed on, which is
      // luck rather than a guarantee; what the assertion pins is that the drive
      // knows which row it edited.
      expect(ids.settings).toBeTruthy();
    });

    /**
     * Which wire materialises the second row — one edge varied, nothing else.
     *
     * `claimSite` wires BOTH `grant.done` and `grant.unchanged` into
     * `mark.store`, and the comment on those two lines says why: *"already being
     * in the role is the post-condition already holding … a re-run must not go
     * red"*. The outcome contract fires exactly one of them per invocation
     * (`node.ts:866-905`, a second report is a `outcome/duplicate` error), so two
     * rows means **two invocations** — and the wire that makes a re-run safe is
     * the wire that makes a re-run duplicate.
     */
    it('🔴 removing the `unchanged → store` wire leaves ONE row', async () => {
      const shipped = await claimOnce(bundle, 'shipped');
      const variant = await claimOnce(bundle, 'variant', (b) =>
        dropWire(b, '/#__cloud__/claimSite', 'unchanged', 'store')
      );

      // The arm that reproduces the drive's own reading, on its own backend —
      // so the pair is a comparison and not a comparison with a memory.
      expect(`shipped:${shipped.settings}`).toBe('shipped:2');
      expect(`variant:${variant.settings}`).toBe('variant:1');

      // 🔴 The control that says the second invocation is real rather than the
      // node being called twice by the transport: the role has exactly one
      // member in both arms, which is what `Add User To Role` reporting
      // `unchanged` on a second pass looks like. A second HTTP request would
      // have been refused outright (`claimSite` is fail-closed on an already
      // claimed site), so the second pass is inside one call.
      expect(`shipped roles:${shipped.roleUsers}`).toBe('shipped roles:1');
      expect(`variant roles:${variant.roleUsers}`).toBe('variant roles:1');
    });

    /**
     * …and WHERE the second invocation comes from, which is the half that
     * decides which fix is right.
     *
     * The gate runs on `settings.fetched`. That query is the *unfiltered*
     * singleton shape SB-004 s4 arrived at: both `runOnChange-*` boxes left ON,
     * because with them off there is no filter parameter left to trigger it. So
     * it fetches at graph-build time **and** again on the explicit
     * `secret.done → storageFetch` — two `fetched` pulses, two gate runs, two
     * grants, two stores.
     *
     * This arm varies that one wire instead: with the explicit fetch removed the
     * load-time one still answers, the site is still claimed, and there is one
     * row. Which says the two pulses are the cause and the `unchanged` wire is
     * only what turns the second one into a record.
     */
    it('🔴 removing the explicit `storageFetch` ALSO leaves one row — two fetches, not one', async () => {
      const oneFetch = await claimOnce(bundle, 'onefetch', (b) =>
        dropWire(b, '/#__cloud__/claimSite', 'done', 'storageFetch')
      );
      expect(`onefetch:${oneFetch.settings}`).toBe('onefetch:1');
      expect(`onefetch roles:${oneFetch.roleUsers}`).toBe('onefetch roles:1');
    });
  });

  describe('🧭 F20 — a claimed site has no Theme row, and nothing makes one', () => {
    it('measured: `claimSite` seeds SiteSettings and not Theme', () => {
      // Measured on a real claim, before this drive seeded one itself. The theme
      // editor saves through `SetDbModelProperties` with `idSource: 'explicit'`
      // fed from `theme.firstItemId`, which is undefined on an empty collection —
      // so on a freshly claimed site the theme editor's Save writes nowhere and
      // the site keeps the shipped palette forever.
      expect(themeRowsAfterClaim).toBe(0);
    });

    it('census: no node in the template creates a Theme record', () => {
      // The census rather than a spot check, so "no creator" cannot mean "I
      // looked in one file". `NewDbModelProperties` is the only creating node
      // type any of the three sets uses.
      const creators: string[] = [];
      for (const [label, set] of [
        ['sb004', SB004_COMPONENTS],
        ['sb005', SB005_COMPONENTS],
        ['sb006', SB006_COMPONENTS]
      ] as Array<[string, Array<{ path: string; nodes: unknown[] }>]>) {
        for (const c of set) {
          for (const node of c.nodes as Array<{ type: string; parameters?: Record<string, unknown> }>) {
            if (node.type !== 'NewDbModelProperties') continue;
            creators.push(`${label}/${c.path}:${String(node.parameters?.collectionName)}`);
          }
        }
      }
      // The control: creators DO exist, so an empty Theme list is an absence and
      // not a broken census.
      expect(creators.length).toBeGreaterThan(0);
      expect(creators.filter((c) => c.endsWith(':Theme'))).toEqual([]);
      expect(creators.filter((c) => c.endsWith(':SiteSettings')).length).toBe(1);
    });
  });
});
