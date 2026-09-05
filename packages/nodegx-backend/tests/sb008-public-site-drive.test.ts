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

import { SB004_COMPONENTS } from '../../noodl-mcp/tests/sb004Components';
import { SB005_COMPONENTS } from '../../noodl-mcp/tests/sb005Components';
// ⚠️ The two panel sets are imported for the SB-014 census below, which reads the
// component sets directly rather than the authored project — the authoring
// itself now happens inside `authorSiteTemplate`.
import { NOT_FOUND_TEXT, SB006_COMPONENTS } from '../../noodl-mcp/tests/sb006Components';
import { Landmarks, readLandmarks } from '../../noodl-mcp/tests/documentOutline';
import { clampFault, MeasureClamp, MEASURE_TOKEN, NO_CLAMP, readMeasureClamp } from '../../noodl-mcp/tests/measureClamp';
import { BackendService } from '../src/service';

import { bundleAuthoredComponents, WorkflowBundle } from './helpers/authored-bundle';
import { adminHeaders, httpClient } from './helpers/http';
/**
 * ⚠️ The authoring, the binding, the data directory and the way a page is read
 * were all written here and were moved to `helpers/site-drive.ts` when SB-015
 * needed the same instrument one configuration apart. Two suites comparing two
 * policies only mean something if everything either side of the policy is
 * identical, and a second copy of a control is the copy that goes stale.
 */
import {
  applyTemplateDesignTokens,
  authorSiteTemplate,
  bindProjectToBackend,
  DRAFT_ACL,
  makeSiteDataDir,
  PUBLIC_ACL,
  readVisit,
  RenderedPage,
  SITE_SECURITY,
  Visit,
  withRenderedPage
} from './helpers/site-drive';

jest.setTimeout(600000);

const SETUP_TOKEN = 'sb008-setup-token-71c3ad';
const CONTACT_TO = 'owner@example.invalid';

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

  const dir = makeSiteDataDir(
    copy,
    { SITE_SETUP_TOKEN: SETUP_TOKEN, CONTACT_RECIPIENT_EMAIL: CONTACT_TO },
    SITE_SECURITY,
    'sb008'
  );
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
  /**
   * 🔴 **§6 — the document outline as the BROWSER builds it.** `sb007Template`
   * §12 gates the `as` parameters on disk, and **a parameter is an intention**:
   * nothing in that gate says the runtime turns `as: 'main'` on a `Group` into
   * a `<main>` element, or that the node tree and the element tree agree. Both
   * were assumed by the change that added `siteMain`. Recorded on the four page
   * loads this drive already takes, so it costs one `evaluate` per visit.
   *
   * ⚠️ The reading itself moved to `documentOutline.ts` when SBR-010 grew the
   * same section: two inline copies of a containment probe that disagree by a
   * word is a failure this repo has already paid for. The numbers §6 asserts
   * are unchanged.
   */
  const landmarks: Record<string, Landmarks> = {};
  /**
   * 🔴 **§7 — SBR-003's owed rendered probe, and its control.**
   *
   * `head` is the shipped graph; `unknownToken` is the same graph with the one
   * `var(--site-measure)` in it replaced by a token that does not exist. Both
   * are seeded with `NO_CLAMP` so an arm that never ran cannot pass as an arm
   * that read an absent clamp — which is precisely what the control arm's
   * *expected* answer looks like.
   */
  const clamps: Record<string, MeasureClamp> = { head: NO_CLAMP, unknownToken: NO_CLAMP };
  /** How many strings the control arm's edit actually replaced. Exactly one is the claim. */
  let measureControlEdits = -1;
  let measureControlDir = '';
  let measureHeadDir = '';
  /** The viewport both §7 arms are read at — wide enough that a 44rem clamp must bind. */
  const CLAMP_VIEWPORT = { width: 1280, height: 900 };
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
    projectDir = await authorSiteTemplate('sb008');
    bundle = bundleAuthoredComponents(projectDir, SB004_COMPONENTS.map((c) => c.key));

    dataDir = makeSiteDataDir(
      bundle,
      { SITE_SETUP_TOKEN: SETUP_TOKEN, CONTACT_RECIPIENT_EMAIL: CONTACT_TO },
      SITE_SECURITY,
      'sb008'
    );
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

    // 🔴 F20 — **fixed in s10 (SB-014)**, and this is the reading that says so:
    // `claimSite` now mints the `Theme` singleton beside the `SiteSettings` one.
    // Before it, a freshly claimed site had no `Theme` row at all and the theme
    // editor's Save — which targets `theme.firstItemId` — wrote nowhere and said
    // nothing. So this drive UPDATES the seeded row exactly as it updates the
    // seeded settings row above, which is also what the panel does.
    const themes = await client.get<{ results: Row[] }>('/classes/Theme', asUser(owner));
    themeRowsAfterClaim = themes.json.results.length;
    ids.theme = themes.json.results[0]?.objectId;
    const theme = await client.put<Row>(
      `/classes/Theme/${ids.theme}`,
      {
        // SBR-003: the panel writes all twelve contract keys, filled or empty —
        // this update mirrors a Save with four fields filled.
        tokens: {
          colorPrimary: '#1f6feb',
          colorOnPrimary: '',
          colorBackground: '#fffdf7',
          colorSurface: '',
          colorText: '#12202e',
          colorTextSoft: '',
          colorBorder: '',
          colorAccentSoft: '',
          radius: '',
          fontDisplay: 'Georgia, serif',
          fontUi: '',
          measure: ''
        }
      },
      asUser(owner)
    );
    expect(theme.status).toBe(200);

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
      for (const [label, url] of [
        ['root', '/'],
        ['about', '/about'],
        ['secret', '/secret'],
        ['nothing', '/no-such-page-at-all']
      ] as const) {
        visits[label] = await readVisit(page, url);
        // §6, on the page `readVisit` has just settled — before the next
        // navigation throws this document away.
        landmarks[label] = await readLandmarks(page);
      }

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

    // ── §7, on a pair of its own ─────────────────────────────────────────
    //
    // 🔴 **The first attempt read this off the suite's shared project and both
    // arms came back identical — `max-width: none`, `--site-measure` empty.**
    // That was not the product: `authorSiteTemplate` starts from the `demo-app`
    // fixture and does not perform the editor's install step, and
    // `render-from-disk.js:338` takes CUSTOM tokens from
    // `metadata.designTokens` alone. The template's OVERRIDES all still resolve
    // from the shipped defaults, so the page looks themed and only the one
    // MINTED token is missing — a fixture fact wearing the shape of a product
    // defect, and a probe that would have reported "the port drops `var()`".
    //
    // So both arms get the install a real project receives, and §7's readings
    // are taken on copies rather than on `projectDir`: `customTokens` carries
    // the whole Studio palette, so installing it into the shared project would
    // have moved every colour every other test in this file reads.
    //
    // ⚠️ The copies are taken AFTER `bindProjectToBackend`, so both are already
    // bound to the enforcing backend — same data, same permissions, same
    // viewport. They differ by one string in one component's `nodes.json`.
    const measureArm = (label: string, mutate?: (nodes: string) => string): string => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), `sb008-measure-${label}-`));
      fs.cpSync(projectDir, dir, { recursive: true });
      applyTemplateDesignTokens(dir);
      if (mutate) {
        const shellFile = path.join(dir, 'components', 'Pages', 'Site', 'nodes.json');
        fs.writeFileSync(shellFile, mutate(fs.readFileSync(shellFile, 'utf-8')));
      }
      return dir;
    };

    measureHeadDir = measureArm('head');
    measureControlDir = measureArm('control', (nodes) => {
      // Counted, not assumed. A replacement that hit two parameters would be a
      // two-variable control, and one that hit none would render the shipped
      // graph twice and read green for the worst possible reason.
      measureControlEdits = nodes.split(`var(${MEASURE_TOKEN})`).length - 1;
      return nodes.split(`var(${MEASURE_TOKEN})`).join('var(--sbr003-no-such-token)');
    });

    for (const [key, dir] of [
      ['head', measureHeadDir],
      ['unknownToken', measureControlDir]
    ] as const) {
      await withRenderedPage({ projectDir: dir, backendPort }, async (page) => {
        // 🔴 An explicit viewport, and a wide one. The clamp is `44rem` = 704px
        // at a 16px root; a reading taken in a window narrower than that would
        // show a shell at the viewport width in BOTH arms — the control and the
        // claim would agree and the probe would certify nothing while reading
        // green.
        await page.setViewport(CLAMP_VIEWPORT);
        await page.navigate('/');
        clamps[key] = await readMeasureClamp(page);
      });
    }

    // eslint-disable-next-line no-console
    console.log(
      `\n[SB-008] §7 measure clamp (${measureControlEdits} string replaced for the control)\n` +
        `  head        = ${JSON.stringify(clamps.head)}\n` +
        `  unknownToken= ${JSON.stringify(clamps.unknownToken)}`
    );

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
    openDataDir = makeSiteDataDir(
      bundle,
      { SITE_SETUP_TOKEN: SETUP_TOKEN, CONTACT_RECIPIENT_EMAIL: CONTACT_TO },
      { ...SITE_SECURITY, devOpen: true },
      'sb008'
    );
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
    if (measureControlDir) fs.rmSync(measureControlDir, { recursive: true, force: true });
    if (measureHeadDir) fs.rmSync(measureHeadDir, { recursive: true, force: true });
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

  describe('✅ F21 — one claim, one SiteSettings row (SB-013, fixed s10)', () => {
    it('measured: a single `claimSite` leaves exactly one row', () => {
      // Read on the drive's own backend, after exactly one claim. It read **2**
      // when this suite was written — two rows carrying `My site` / `home` and
      // the same world-read ACL, milliseconds apart — because the gate ran twice
      // and the whole gate → grant → mark chain ran with it. SB-004 §7 graded
      // `claimSite` with five mutants and could not see it: they asserted the
      // role, the ACL and every refusal path, and never counted.
      //
      // 🔴 The fix is NOT the one SB-013 recommended, and the difference is why
      // this reading is kept rather than deleted. Dropping a wire made the count
      // 1 while leaving the gate able to decide before any query had answered;
      // the arms in `sb004-publication-invariant.test.ts` measure what that
      // costs, which is an outsider holding the admin role.
      expect(settingsRowsAfterClaim).toBe(1);
    });

    it('🔴 and the consequence it removes: both readers take rows[0]', () => {
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
     * The arms that name the mechanism now live where the graph does —
     * `sb004-publication-invariant.test.ts`, describe **"SB-013 — the second
     * claim, and the two barriers that refuse it"** — because the fix is not a
     * wire this drive can vary. This suite keeps the reading; that one keeps the
     * comparison.
     *
     * ⚠️ What was here and is deliberately not: two arms asserting
     * `shipped:2`. They were true of the graph SB-008 deployed and are false of
     * the graph it deploys now, and an arm kept past its subject is a fixture
     * that passes for the wrong reason.
     */
    it('the singleton stays one after the whole drive has run', async () => {
      // Not a re-reading of `settingsRowsAfterClaim`: this is the count AFTER
      // every seed, publish, unpublish and duplicate this drive performed, which
      // is the only place a second writer would show up.
      const rows = await client.get<{ results: Row[] }>('/classes/SiteSettings', asUser(owner));
      expect(`SiteSettings rows:${rows.json.results.length}`).toBe('SiteSettings rows:1');
      expect(rows.json.results[0].objectId).toBe(ids.settings);
    });
  });

  describe('✅ F20 — the Theme row, now minted by the claim (SB-014, fixed s10)', () => {
    it('measured: `claimSite` seeds BOTH singletons', () => {
      // Measured on a real claim, before this drive wrote anything of its own.
      // It read **0** when this suite was written, and the theme editor saves
      // through `SetDbModelProperties` with `idSource: 'explicit'` fed from
      // `theme.firstItemId` — `undefined` on an empty collection — so Save wrote
      // nowhere and said nothing, on a screen that exists to write.
      expect(themeRowsAfterClaim).toBe(1);
      // 🔴 The half that makes the row useful rather than merely present: the
      // editor's target is `firstItemId`, so this drive edited the seeded row by
      // its id and got a 200 rather than creating a second one.
      expect(ids.theme).toBeTruthy();
    });

    it('🔴 and the seeded row is readable by the anonymous visitor who needs it', async () => {
      // `applyTheme` runs in the page, with no session — the same visitor every
      // other assertion in this file is made about. A row born with no rules
      // reads as public TODAY (`model.ts:701-718`) and would stop the moment a
      // default arrived, so the rule is carried rather than relied on.
      const row = await client.get<{ results: Row[] }>('/classes/Theme', asUser(owner));
      expect(row.json.results[0].ACL).toEqual(PUBLIC_ACL);
      const anonymous = await client.get<{ results: Row[] }>('/classes/Theme');
      expect(anonymous.json.results.map((r) => r.objectId)).toEqual([ids.theme]);
    });

    it('census: exactly one node in the template creates each singleton', () => {
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
      // The control: creators DO exist, so a count of one is a reading and not a
      // broken census.
      expect(creators.length).toBeGreaterThan(0);
      // 🔴 One each, and both in `claimSite`. SB-014's general shape was **a
      // class with a reader, an editor and no creator**, which is invisible to
      // every check this phase has — the doors validate one component, the
      // structural specs assert what each graph reads and writes, and a
      // cross-file contract check compares the two ends of a pipe nothing fills.
      // This census is the check that would have asked.
      expect(creators.filter((c) => c.endsWith(':Theme'))).toEqual(['sb004/#__cloud__/claimSite:Theme']);
      expect(creators.filter((c) => c.endsWith(':SiteSettings'))).toEqual([
        'sb004/#__cloud__/claimSite:SiteSettings'
      ]);
    });
  });

  // ==========================================================================
  // 6. The document outline — REL-011c §12, taken in the browser
  // ==========================================================================

  /**
   * 🔴 **`sb007Template.test.ts` §12 reads the `as` parameters out of the
   * shipped JSON; this reads the elements out of the document.** The two are
   * different claims, and the gap between them is where the fix could have been
   * wrong in a way no suite in this repo could see: `as: 'main'` might not reach
   * the DOM at all, and a node's children might not end up its element's
   * descendants. `/Pages/Site` is the page that needed a NEW NODE for its
   * landmark — its `shell` also holds the nav band and the colophon — so it is
   * the one where the node/element correspondence is actually load-bearing.
   *
   * ⚠️ **What this does NOT cover, stated rather than implied.** All four loads
   * are the public catch-all. The six admin screens carry the landmark as a
   * parameter on a column they already had, and no drive in this repo grades
   * their rendered outline; what carries across from here is the *mechanism* —
   * `as: 'main'` on a `Group` renders a `<main>`, and a child node renders
   * inside it. Per-page authoring is §12's job. Owner for the admin half:
   * `NONE`.
   */
  describe('🔴 §6 the outline the browser actually builds', () => {
    const loaded = () => Object.keys(landmarks).sort();

    it('control: there are page loads to grade, and every one recorded its landmarks', () => {
      // `every` over an empty list is vacuously true — the way this section
      // would go quietly green if the capture stopped happening.
      expect(loaded()).toEqual(['about', 'nothing', 'root', 'secret']);
      expect(loaded().filter((k) => typeof landmarks[k]?.mains !== 'number')).toEqual([]);
    });

    it('every rendered page has exactly one <main> and exactly one <h1>', () => {
      const wrong = loaded()
        .filter((k) => landmarks[k].mains !== 1 || landmarks[k].h1s !== 1)
        .map((k) => `${k}: ${landmarks[k].mains} main, ${landmarks[k].h1s} h1`);
      expect(wrong).toEqual([]);
    });

    it('🔴 and the <h1> is INSIDE the <main> — which is what the new node bought', () => {
      // Before REL-011c this read 0 on every load, because there was no `<main>`
      // on any page of this template to be inside of.
      const wrong = loaded()
        .filter((k) => landmarks[k].h1sInMain !== 1)
        .map((k) => `${k}: ${landmarks[k].h1sInMain} h1 inside main`);
      expect(wrong).toEqual([]);
    });

    it('🔴 CONTROL — the band’s <nav> is in the document and NOT in the <main>', () => {
      // 🔴 **Without this the check above proves nothing about containment.** A
      // probe that answered "inside" for everything in the document would pass
      // it on every page ever written. The nav band is the thing deliberately
      // left outside `siteMain`, and it is in the same document, which is what
      // separates "inside the main" from "anywhere at all".
      const withNav = loaded().filter((k) => landmarks[k].navsInDoc > 0);
      expect(withNav).toEqual(loaded());
      expect(withNav.filter((k) => landmarks[k].navsInMain !== 0).map((k) => `${k}: nav inside main`)).toEqual([]);
    });
  });

  // ==========================================================================
  // §7 SBR-003 — a `var(--token)` in a DIMENSION port, in a real browser
  // ==========================================================================

  /**
   * 🔴 **The one thing SBR-003 refused to close on a legend.** Its §2 says the
   * `{value,unit}` ports accept `var(--token)` *per `WIRE_FORMAT_LEGEND`* and
   * then says: verify it with a rendered probe, "not by quoting the legend".
   * At s4 nothing consumed the token, so the probe had nowhere to stand and was
   * carried into SBR-004. `/Pages/Site`'s `shell` consumes it now.
   *
   * 🔴 **What the two arms hold constant is the point.** `--site-measure` is
   * DEFINED on `:root` in both arms — the control does not delete the token, it
   * changes what the port REFERENCES. So the difference between a length and no
   * clamp cannot be "the token was missing"; it can only be "the port carried
   * the reference into CSS". Deleting the definition would have produced the
   * same two numbers for a reason that says nothing about ports.
   *
   * ⚠️ **REL-011c seam 5 moved the box this is read on, and the numbers moved
   * with it.** The measure used to sit on the page shell; it now sits on the
   * page `<header>` (and on the colophon, the not-found card, the nav band and
   * three of the five section wrappers), because a clamp on the shell was an
   * ancestor of every section and made a full-bleed hero impossible. The CLAIM
   * is unchanged — a `var(--token)` in a dimension port resolves in a browser —
   * and every number below is re-derived rather than re-fitted.
   */
  describe('🔴 §7 the reading measure, as a browser resolves it', () => {
    it('control: both arms ran, and the control edit landed on every site that states the measure', () => {
      // `clampFault` names "the arm never ran" separately from every other way
      // a reading can be wrong, because the control arm's expected answer is an
      // ABSENT clamp and an arm that never happened reads absent too.
      expect([clampFault(clamps.head), clampFault(clamps.unknownToken)]).toEqual([null, null]);
      // 🔴 **THREE, and it was one until REL-011c seam 5 — this assertion is the
      // gate noticing its own scope changed rather than passing quietly.**
      // `/Pages/Site` used to state the measure on exactly one node, the shell.
      // Seam 5 moved it off the shell and onto the three boxes on this page that
      // should keep a reading width: the page `<header>`, the colophon and the
      // not-found card. (The nav band and the section wrappers state it too, in
      // their own components, which this file does not rewrite.)
      //
      // ⚠️ **Three replacements is still a ONE-variable control.** What varies is
      // what the ports REFERENCE, and it varies the same way at every site; the
      // token's own definition is untouched, which the `:root` control below
      // asserts in both arms. A control that changed one of three would be the
      // broken one — the header would lose its clamp while the colophon kept it,
      // and the reading would be of a page in a state the product never has.
      //
      // The three are named by label on the authoring side, in
      // `sb006PublicSite.test.ts`'s "the reading measure is the minted token":
      // if that census and this count ever disagree, one of them is stale.
      expect(`replacements: ${measureControlEdits}`).toBe('replacements: 3');
    });

    it('control: the element measured is the page HEADER, inside the main, holding the h1', () => {
      // Identification, not geometry — and all four fields, because seam 5 gave
      // this probe a new target and "we are reading the right box" is the part
      // that silently stopped being true when the old one lost its clamp.
      //
      // 🔴 `nav:0` is the assertion that separates this header from the shell.
      // The nav band is a SIBLING of `<main>` (§6 asserts no nav inside main),
      // so a reading that still found the nav would mean the walk had drifted
      // back up to the box that no longer carries the measure.
      const c = clamps.head;
      expect(`isMain:${c.shellIsMain} inMain:${c.shellInsideMain} nav:${c.shellHasNav} h1:${c.shellHasH1}`).toBe(
        'isMain:false inMain:true nav:0 h1:1'
      );
      expect(`mains:${c.mains} headers:${c.headers}`).toBe('mains:1 headers:1');
    });

    it('control: `--site-measure` is defined on :root in BOTH arms', () => {
      // What makes this a probe of the PORT rather than of the token.
      expect(`head:${clamps.head.tokenValue} control:${clamps.unknownToken.tokenValue}`).toBe(
        'head:44rem control:44rem'
      );
      expect(`root font-size: ${clamps.head.rootFontSize}`).toBe('root font-size: 16');
    });

    it('🔴 the dimension port carried the token into CSS — computed max-width is a LENGTH', () => {
      // The claim, and the field that carries it. An unresolvable `var()` is
      // invalid at computed-value time and `max-width` falls back to `none`;
      // 44rem at a 16px root is 704px.
      expect(clamps.head.shellMaxWidth).toBe('704px');
    });

    it('🔴 and the clamp BINDS — the header is 704px inside a 1280px main', () => {
      // A `max-width` that never binds is decorative, and a decorative clamp
      // reads identically to a working one on the width alone. The parent is the
      // width the header would take if nothing stopped it.
      //
      // 🔴 **`main:1280` is itself a seam 5 reading.** Before it, the page ground
      // carried `paddingLeft`/`paddingRight: var(--space-6)` and nothing inside
      // could reach the window; the parent measured 1232. That padding moved down
      // onto the measured boxes — this header states its own — so `<main>` now
      // spans the viewport exactly, which is what lets the hero band bleed.
      const c = clamps.head;
      expect(`header:${Math.round(c.shellWidth)} main:${Math.round(c.frameWidth)} vp:${c.viewportWidth}`).toBe(
        'header:704 main:1280 vp:1280'
      );
    });

    it('🔴 CONTROL — an unknown token does NOT constrain the box', () => {
      // SBR-003 §2's control, in its own words. Same graph, same backend, same
      // viewport, one token name apart.
      //
      // 🔴 **Kept as the EQUATION, not as a literal, and seam 5 is why that
      // mattered.** When this was written the parent carried 48px of padding and
      // the reading was 1232, against a prediction of 1280. Seam 5 moved that
      // padding off the page ground and onto the measured boxes, so the parent
      // is now 1280 and its padding 0 — BOTH numbers moved, and the equation is
      // green on the new pair without a character being edited to fit. A spec
      // written as `expect(1232)` would have had to be re-fitted here, and a
      // re-fitted control is one nobody can tell from a broken one.
      const c = clamps.unknownToken;
      expect(c.shellMaxWidth).toBe('none');
      expect(
        `box:${Math.round(c.shellWidth)} = parent:${Math.round(c.frameWidth)} − padding:${Math.round(c.framePaddingX)}`
      ).toBe(`box:${Math.round(c.frameWidth - c.framePaddingX)} = parent:1280 − padding:0`);
    });

    it('🔴 the pair, stated as one number: the token is worth 576px of clamp', () => {
      // The cross-arm reading. Written as a difference so a future change that
      // moves BOTH arms together — a different default viewport, a themed root
      // font-size — fails here rather than passing two absolute assertions that
      // happen to have been edited to match.
      //
      // 576 = 1280 − 704, and both ends are reconciled above: 1280 is the parent
      // less its (now zero) padding, 704 is `44rem` at a 16px root. Neither is a
      // number read off a run and pasted in.
      //
      // ⚠️ **This was 528 before REL-011c seam 5** (1232 − 704) and the 48px of
      // difference is exactly the page ground's old horizontal padding, which
      // seam 5 moved down onto the measured boxes. The clamped end did not move
      // at all, which is the check that the token still resolves to the same
      // length and only the box around it changed.
      const delta = Math.round(clamps.unknownToken.shellWidth - clamps.head.shellWidth);
      expect(`unclamped − clamped = ${delta}px`).toBe('unclamped − clamped = 576px');
    });
  });
});
