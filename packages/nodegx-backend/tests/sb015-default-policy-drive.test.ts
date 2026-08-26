/**
 * SB-015 — the policy a project actually gets, driven.
 *
 * SB-008 drove this template against **the policy SB-004 §4 specifies** and
 * measured a real publication boundary. SB-015's claim is that nothing carries
 * that policy anywhere: it is `security.json` in a *backend's* data directory,
 * SB-007 ships a *project* directory, and neither `provisionBackend` mentions
 * security at all. So the nineteen graphs meet `defaultSecurityConfig()`.
 *
 * That was **derived from source and cited, not driven** (SB-015 §4). This file
 * drives it, and it is the same instrument SB-008 used with one file different —
 * which is the only way the two readings can be compared at all. Everything
 * either side of that file (the authoring, the binding, the seed, the browser)
 * comes from `helpers/site-drive.ts`, shared rather than copied.
 *
 * ## The three configurations, and why all three are here
 *
 * **A — as provisioned.** No `security.json` at all, which is what
 * `provisionBackend` leaves behind; the backend mints its own defaults. This is
 * the state a person who picks Site Builder is in on the machine they build on.
 *
 * **C — the fix the refusal names.** `devOpen: false` and nothing else changed,
 * which is what the startup error tells a deployer to do, read literally.
 *
 * **D — SB-004 §4's policy.** The control. Without it, every reading in A and C
 * is consistent with "the harness is broken", and the two failures SB-015 §2
 * predicts are *opposite*, so neither can act as the other's control.
 *
 * 🔴 **A and C are not two degrees of the same failure.** A leaks everything and
 * C shows nothing, and §2's sharpest sentence is that **each looks like the
 * other's fix** — a deployer who hits C and reaches back for A has turned the
 * boundary off. Both arms are driven through a browser with no credential
 * because that is the only reader whose answer is the product.
 *
 * ## What is deliberately not varied
 *
 * The project is authored once and every arm points at it, so the graphs, the
 * router, the authoring order and the deployed bundle are identical across the
 * three. The seed script is one function called three times. The only thing that
 * differs is the file.
 */
import * as fs from 'fs';
import * as path from 'path';

import { SB004_COMPONENTS } from '../../noodl-mcp/tests/sb004Components';
import { NOT_FOUND_TEXT } from '../../noodl-mcp/tests/sb006Components';
import { defaultSecurityConfig } from '../src/security/model';
import { BackendService } from '../src/service';

import { bundleAuthoredComponents, WorkflowBundle } from './helpers/authored-bundle';
import { httpClient } from './helpers/http';
import {
  authorSiteTemplate,
  bindProjectToBackend,
  DRAFT_ACL,
  makeSiteDataDir,
  readVisit,
  SITE_SECURITY,
  Visit,
  withRenderedPage
} from './helpers/site-drive';

jest.setTimeout(900000);

const SETUP_TOKEN = 'sb015-setup-token-4d91c7';
const CONTACT_TO = 'owner@example.invalid';
const SECRETS = { SITE_SETUP_TOKEN: SETUP_TOKEN, CONTACT_RECIPIENT_EMAIL: CONTACT_TO };

interface Row {
  objectId: string;
  [field: string]: unknown;
}

/**
 * One arm's whole reading, gathered before any spec runs.
 *
 * Every seed step records its status rather than asserting it. 🔴 Under arm C
 * some of them are **expected** to fail, and a seed that threw would report
 * itself as a broken harness rather than as the measurement it is.
 */
interface ArmReport {
  label: string;
  /** `!devOpenActive` — the precondition each arm's reading is only meaningful under. */
  enforced: boolean;
  /** The security config the backend was actually running, read back off disk. */
  configOnDisk: Record<string, unknown>;
  /** Status codes from the seed, in order, keyed by what was attempted. */
  seed: Record<string, number>;
  /** What an anonymous browser saw at `/` and at `/secret`. */
  visits: Record<string, Visit>;
  /** What an anonymous HTTP caller got from the data plane. */
  anonPageFind: { status: number; rows: number };
  /** 🆕 The function half: a stranger signs up and calls the admin endpoint. */
  stranger: { signup: number; publish: number; draftPublishedAfter: unknown };
}

const reports: Record<string, ArmReport> = {};
let projectDir = '';
let bundle: WorkflowBundle;

/**
 * Author, deploy, seed, drive — once per configuration.
 *
 * `security: null` writes no `security.json`, which is the provisioned state and
 * not a typed copy of the defaults (see `makeSiteDataDir`).
 */
async function runArm(label: string, security: Record<string, unknown> | null): Promise<ArmReport> {
  const dataDir = makeSiteDataDir(bundle, SECRETS, security, `sb015-${label}`);
  const svc = new BackendService({
    dataDir,
    port: 0,
    backendId: `sb015-${label}`,
    backendName: `SB-015 ${label}`
  });
  const started = await svc.start();
  const c = httpClient(() => started.listen.url);
  const seed: Record<string, number> = {};

  try {
    // The config the backend is running, read off disk rather than assumed —
    // under arm A the file did not exist until `start()` wrote it.
    const configOnDisk = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'security.json'), 'utf-8')
    ) as Record<string, unknown>;

    // ── The seed: exactly what a first user does, in the order they do it ────
    const owner = await c.post<{ objectId: string; sessionToken: string }>('/users', {
      username: `sb015-owner-${label}`,
      password: 'pw'
    });
    seed.signup = owner.status;
    const asOwner = { 'x-parse-session-token': owner.json?.sessionToken ?? '' };

    const claimed = await c.post<{ result?: { claimed?: boolean } }>(
      '/functions/claimSite',
      { setupToken: SETUP_TOKEN },
      asOwner
    );
    seed.claimSite = claimed.status;

    const settings = await c.get<{ results: Row[] }>('/classes/SiteSettings', asOwner);
    seed.readSettings = settings.status;
    const settingsId = settings.json?.results?.[0]?.objectId;
    if (settingsId) {
      const put = await c.put<Row>(
        `/classes/SiteSettings/${settingsId}`,
        { siteName: 'Kestrel Joinery', homeSlug: 'home' },
        asOwner
      );
      seed.updateSettings = put.status;
    }

    const makePage = async (title: string, slug: string, body: string, navOrder: number) => {
      const page = await c.post<Row>(
        '/classes/Page',
        { ACL: DRAFT_ACL, title, slug, published: false, showInNav: true, navOrder, seoDescription: `${title} — description` },
        asOwner
      );
      seed[`create ${slug}`] = page.status;
      const section = await c.post<Row>(
        '/classes/Section',
        { ACL: DRAFT_ACL, kind: 'richText', order: 0, data: { body }, pageId: page.json?.objectId },
        asOwner
      );
      seed[`create ${slug} section`] = section.status;
      return page.json?.objectId;
    };

    const homeId = await makePage('Welcome', 'home', 'HOME-BODY-MARKER', 1);
    const secretId = await makePage('The unreleased page', 'secret', 'SECRET-BODY-MARKER', 2);

    // Published through the template's own endpoint, never by typing an ACL.
    const published = await c.post(`/functions/publishPage`, { pageId: homeId, publish: true }, asOwner);
    seed.publishPage = published.status;

    // ── The anonymous data plane, with no browser in the way ────────────────
    const anonFind = await c.get<{ results: Row[] }>('/classes/Page');
    const anonPageFind = { status: anonFind.status, rows: anonFind.json?.results?.length ?? -1 };

    // ── 🆕 The function half, which SB-015 §2 does not name ─────────────────
    //
    // §2 reads the deployed failure as "nothing is visible", which is a claim
    // about collections. Functions resolve differently: with no `functions`
    // entry the rule comes from **the graph's own `Allow Unauthenticated` port**
    // (`effectiveFunctionRule`, model.ts:592-596), not from `defaults`. So this
    // asks the question that separates the two — can somebody who is merely
    // signed up drive the admin endpoint?
    const stranger = await c.post<{ objectId: string; sessionToken: string }>('/users', {
      username: `sb015-stranger-${label}`,
      password: 'pw'
    });
    const asStranger = { 'x-parse-session-token': stranger.json?.sessionToken ?? '' };
    const strangerPublish = await c.post(
      '/functions/publishPage',
      { pageId: secretId, publish: true },
      asStranger
    );
    // 🔴 The consequence, not the response. s10's finding was an endpoint that
    // answered the correct refusal having already granted the caller admin, so
    // the status code is recorded and the *record* is what is read.
    const draftAfter = await c.get<Row>(`/classes/Page/${secretId}`, asOwner);
    const stranger_ = {
      signup: stranger.status,
      publish: strangerPublish.status,
      draftPublishedAfter: draftAfter.json?.published
    };

    // ── And now the browser, with no credential of any kind ─────────────────
    bindProjectToBackend(projectDir, `sb015-${label}`, started.listen.port);
    const visits: Record<string, Visit> = {};
    await withRenderedPage({ projectDir, backendPort: started.listen.port }, async (page) => {
      visits.root = await readVisit(page, '/');
      visits.secret = await readVisit(page, '/secret');
    });

    for (const [key, v] of Object.entries(visits)) {
      // eslint-disable-next-line no-console
      console.log(
        `\n[SB-015 ${label}] ${key} (${v.url})\n  title=${JSON.stringify(v.title)}\n` +
          `  h1=${JSON.stringify(v.headings)}\n  nav=${JSON.stringify(v.nav)}\n` +
          `  text=${JSON.stringify(v.text)}\n  errors=${JSON.stringify(v.errors)}`
      );
    }
    // eslint-disable-next-line no-console
    console.log(
      `\n[SB-015 ${label}] enforced=${started.security.enforced}` +
        ` seed=${JSON.stringify(seed)} anonPageFind=${JSON.stringify(anonPageFind)}` +
        ` stranger=${JSON.stringify(stranger_)}`
    );

    return {
      label,
      enforced: started.security.enforced,
      configOnDisk,
      seed,
      visits,
      anonPageFind,
      stranger: stranger_
    };
  } finally {
    await svc.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

describe('SB-015 — a template cannot carry its own permissions, driven', () => {
  beforeAll(async () => {
    projectDir = await authorSiteTemplate('sb015');
    bundle = bundleAuthoredComponents(
      projectDir,
      SB004_COMPONENTS.map((c) => c.key)
    );

    // 🔴 D first. It is the control, and running it first means a failure in it
    // stops the suite before two arms report readings taken with a broken
    // instrument.
    reports.specified = await runArm('specified', SITE_SECURITY);
    reports.provisioned = await runArm('provisioned', null);
    reports.devOpenOff = await runArm('devOpenOff', { ...defaultSecurityConfig(), devOpen: false });
  });

  afterAll(() => {
    if (projectDir) fs.rmSync(projectDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // 0. The conditions the readings are only meaningful under
  // ==========================================================================

  describe('what each arm was actually running', () => {
    it('🔴 arm A ran the DEFAULTS, minted by the backend and not typed here', () => {
      // The reading that makes arm A about provisioning rather than about a
      // constant in this file: no `security.json` was written, `start()` created
      // one, and what it created is `defaultSecurityConfig()` byte for byte.
      expect(reports.provisioned.configOnDisk).toEqual(defaultSecurityConfig());
    });

    it('🔴 the three arms differ in enforcement exactly as the source says', () => {
      // `devOpenActive` is `devOpen && loopback`. All three bind loopback, so
      // this column is `devOpen` alone — the one field under test.
      expect({
        specified: reports.specified.enforced,
        provisioned: reports.provisioned.enforced,
        devOpenOff: reports.devOpenOff.enforced
      }).toEqual({ specified: true, provisioned: false, devOpenOff: true });
    });

    it('drove both URLs in every arm and rendered something on every one', () => {
      // The floor under every absence claim below: a blank page contains no
      // draft either.
      for (const [label, r] of Object.entries(reports)) {
        expect(`${label}:${Object.keys(r.visits).sort().join(',')}`).toBe(`${label}:root,secret`);
        for (const [key, v] of Object.entries(r.visits)) {
          expect(`${label}.${key}:${v.text.length > 0}`).toBe(`${label}.${key}:true`);
        }
      }
    });

    it('🔴 the control renders the site SB-008 measured — published in, draft out', () => {
      // Arm D re-measured here rather than cited from SB-008, because the two
      // failures below are opposite and neither can control the other. If this
      // spec is red, nothing else in this file means anything.
      const r = reports.specified;
      expect(r.visits.root.headings).toEqual(['Welcome']);
      expect(r.visits.root.text).toContain('HOME-BODY-MARKER');
      expect(r.visits.secret.text).toContain(NOT_FOUND_TEXT);
      expect(r.visits.secret.html).not.toContain('SECRET-BODY-MARKER');
    });
  });

  // ==========================================================================
  // 1. SB-015 §2, first half — locally, nothing is enforced
  // ==========================================================================

  describe('🔴 arm A — the backend a project is provisioned with', () => {
    it('🔴 serves the UNPUBLISHED page, in full, to a visitor with no credential', () => {
      // The product of this template is what a stranger cannot see, and on the
      // machine it is built on a stranger sees all of it. Same project, same
      // seed, same browser as the control above — one file different.
      const v = reports.provisioned.visits.secret;
      expect(v.headings).toEqual(['The unreleased page']);
      expect(v.text).toContain('SECRET-BODY-MARKER');
      expect(v.text).not.toContain(NOT_FOUND_TEXT);
    });

    it('🔴 draws the draft into the site NAVIGATION as well', () => {
      // Not a second reading of the same thing: the nav query is a separate
      // fetch with its own filter, and it names the draft on EVERY page of the
      // site rather than only on the draft's own URL.
      expect(reports.provisioned.visits.root.nav).toContain('The unreleased page');
      // …and the control, so this is a statement about the ACL and not about
      // `showInNav`, which is `true` on the draft in both arms.
      expect(reports.specified.visits.root.nav).not.toContain('The unreleased page');
    });

    it('answers an anonymous /classes/Page with every row, drafts included', () => {
      // The same leak one layer below the browser: `devOpenActive` returns
      // before the CLP gate (`HttpServer.ts:1743`) and before the row-level ACL
      // (`state.ts:287`), so neither boundary is in the request path at all.
      expect(reports.provisioned.anonPageFind.status).toBe(200);
      expect(reports.provisioned.anonPageFind.rows).toBe(2);
      // The control: the same call, same seed, with the policy in place — the
      // published page only.
      expect(reports.specified.anonPageFind).toEqual({ status: 200, rows: 1 });
    });
  });

  // ==========================================================================
  // 2. SB-015 §2, second half — deployed, and the fix the message names
  // ==========================================================================

  describe('🔴 arm B — the same backend, asked to bind beyond localhost', () => {
    it('refuses to start, and names devOpen as the thing to change', async () => {
      // No browser and no listen: the interlock throws inside `start()` before
      // anything binds (`service.ts:209-212` runs before the HTTP server), so
      // this measurement opens no socket beyond loopback.
      const dataDir = makeSiteDataDir(bundle, SECRETS, null, 'sb015-deploy');
      const svc = new BackendService({
        dataDir,
        port: 0,
        host: '0.0.0.0',
        backendId: 'sb015-deploy',
        backendName: 'SB-015 deploy'
      });
      let message = '';
      let code = '';
      try {
        await svc.start();
        await svc.stop();
      } catch (e) {
        message = (e as Error).message;
        code = (e as { code?: string }).code ?? '';
      } finally {
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
      expect(code).toBe('DEV_OPEN_ON_PUBLIC_BIND');
      // 🔴 The sentence SB-015 §2 turns on: the refusal names `devOpen: false`
      // as the fix and adds "(then configure collection permissions)" in
      // parentheses — and arm C below is what happens when a reader does the
      // first half.
      expect(message).toContain('"devOpen": false');
      expect(message).toContain('configure collection permissions');
    });
  });

  describe('🔴 arm C — devOpen off, which is the first half of that instruction', () => {
    it('🔴 serves the PUBLISHED page to nobody: the public site is empty', () => {
      // The opposite failure, on the same instrument. The control at the top of
      // this file renders this exact page from this exact seed; here `Page.find`
      // falls through `collections: {}` to the `authenticated` default and an
      // anonymous visitor is not authenticated.
      const v = reports.devOpenOff.visits.root;
      expect(v.text).not.toContain('HOME-BODY-MARKER');
      expect(v.headings).not.toEqual(['Welcome']);
    });

    it('refuses an anonymous /classes/Page outright', () => {
      expect(reports.devOpenOff.anonPageFind.status).toBe(403);
    });

    it('🔴 and the draft is equally invisible — so the two states are the SAME', () => {
      // This is what makes arm C dangerous rather than merely broken: a person
      // looking at it sees the draft correctly hidden and the published page
      // hidden too, which reads as "permissions are too tight" — and the config
      // that loosens them is arm A, where nothing is enforced at all.
      const v = reports.devOpenOff.visits.secret;
      expect(v.html).not.toContain('SECRET-BODY-MARKER');
      expect(v.text).not.toContain('HOME-BODY-MARKER');
    });

    it('🔴 renders a REFUSAL as the not-found panel — the same screen a draft draws', () => {
      // The reading SB-015 §2 does not have, and the sharpest one here.
      //
      // §2 says the two failures look like each other's fix. They also both
      // look like something that is not permissions at all: a 403 on
      // `Page.find` reaches the site as an empty result, and an empty result is
      // what an unpublished slug produces. So arm C's PUBLISHED home page is
      // pixel-for-pixel arm D's DRAFT — same title, same headings, same text.
      //
      // A person in this state is being told "that page could not be found"
      // about a page they just published, on every URL of their own site. The
      // screen points at publishing; the cause is a permission file they have
      // never seen and were never given.
      const refused = reports.devOpenOff.visits.root;
      const genuineDraft = reports.specified.visits.secret;

      // The panel itself is the same one, down to the dead `Page` title port
      // (F16) leaving the static component name in the tab.
      expect({ title: refused.title, headings: refused.headings }).toEqual({
        title: genuineDraft.title,
        headings: genuineDraft.headings
      });
      expect(refused.text).toContain(NOT_FOUND_TEXT);
      expect(genuineDraft.text).toContain(NOT_FOUND_TEXT);

      // 🔴 …and the one thing that IS different is not a cue about permissions.
      // The genuine draft still draws the site's chrome, because the settings
      // row and the nav query are answered; arm C loses those too, so the site
      // reads as *empty* rather than as *refused*. Asserted rather than
      // narrated, because "the pages look the same" would be false and the
      // interesting claim is which part differs.
      expect(genuineDraft.text).toContain('Kestrel Joinery');
      expect(refused.text).not.toContain('Kestrel Joinery');
      expect(refused.text.trim()).toBe(NOT_FOUND_TEXT);
    });

    it('🔴 leaves its only trace in the console, which nothing structural reads', () => {
      // Same shape as SB-008 F18: the site fails, the DOM is a legitimate
      // not-found page, and the one signal that a permission check refused
      // anything is a console line. `nav` is empty here and non-empty in both
      // other arms, which is the only DOM-visible difference — and an author
      // reads that as "no pages published yet".
      const v = reports.devOpenOff.visits.root;
      expect(v.errors.join('\n')).toContain('query-records/query-failed');
      expect(v.nav).toEqual([]);
      expect(reports.specified.visits.root.errors).toEqual([]);
    });
  });

  // ==========================================================================
  // 3. 🆕 The half §2 does not name: functions do not fall back the same way
  // ==========================================================================

  describe('🔴 the function gate under the defaults', () => {
    it('🔴 lets a stranger who merely signed up drive the ADMIN endpoint', () => {
      // `effectiveFunctionRule` (model.ts:592-596): a config entry wins,
      // otherwise **the graph's `Allow Unauthenticated` port decides** — ticked
      // is `public`, unticked is `authenticated`. `publishPage`'s Request node
      // has it unticked (`sb004Components.ts:226`), so with `functions: {}` the
      // rule is `authenticated`, not `role:admin` — and `signup` is `public` by
      // default, so becoming authenticated costs one request.
      //
      // 🔴 So the deployed failure is NOT one-directional. §2 reads it as
      // "nothing is visible"; the collection half is, and the function half is
      // the other way round.
      expect(reports.devOpenOff.stranger.signup).toBe(201);
      expect(reports.devOpenOff.stranger.publish).toBe(200);
    });

    it('🔴 and the consequence: the stranger PUBLISHED the owner\'s draft', () => {
      // The response is not the reading. s10's finding was an endpoint that
      // answered the correct refusal having already granted the caller admin,
      // so what is asserted here is the record the owner reads back.
      expect(reports.devOpenOff.stranger.draftPublishedAfter).toBe(true);
      // The control, and it is the whole argument for SB-004 §4's `functions`
      // block: with the policy in place the same call from the same stranger is
      // refused and the draft is still a draft.
      expect(reports.specified.stranger.publish).toBe(403);
      expect(reports.specified.stranger.draftPublishedAfter).toBe(false);
    });
  });
});
