/**
 * SB-015 §6.4 — the first five minutes, driven.
 *
 * ## The question this owes an answer to
 *
 * SB-015 ruled that a project's policy applies **verbatim, `devOpen` included**,
 * so Site Builder is enforced from its first local start. §6.4 stated the cost of
 * that ruling rather than measuring it: with the boundary on, an author is an
 * anonymous visitor to their own machine until they hold `admin`, and the only
 * thing on this template that grants `admin` is `claimSite` — which needs a
 * `SITE_SETUP_TOKEN` in the backend's `secrets.json` that **provisioning does not
 * write**. §6.4's prediction was *a site that renders, a nav, and an admin panel
 * whose every write is refused*.
 *
 * 🔴 **A prediction in a task file is a hypothesis, and this phase has now had
 * four of them turn out to be measurements of the wrong property** (SB-013's row
 * count, SB-016 §4/F25, s11's F24, s13's F26 call-site count). So this drives it
 * rather than reasoning about it.
 *
 * ## Why two arms and not one
 *
 * "The author could not do anything" has a dozen causes that are not the missing
 * secret — an unstarted service, a policy that did not apply, a broken seed, a
 * harness that lost its session token. Every one of them looks identical from the
 * outside, and three of them would make this file a false alarm.
 *
 * So the two arms differ in **exactly one value**: whether `secrets.json` carries
 * `SITE_SETUP_TOKEN`. Same project, same bundle, same policy, same seed, same
 * browser, same order. Arm **`no-token`** is what a person is provisioned into.
 * Arm **`with-token`** is the same machine one secret later, and it is the
 * known-firing control: if the author cannot claim the site *there* either, this
 * file is measuring its own harness and says so.
 *
 * ## What is deliberately NOT varied
 *
 * The policy arrives the way a person's does — `nodegx.security.json` at the
 * project root, installed by `applyProjectPolicy` at startup from the
 * `--project-dir` the spawner passes. Not written into the data directory by this
 * file. That distinction is the whole of SB-015: a policy typed into a test
 * helper is what SB-008 measured for four sessions before anyone noticed no
 * project would ever receive it.
 */
import * as fs from 'fs';
import * as path from 'path';

import { BackendService } from '../src/service';
import { BACKEND_POLICY_FILE, PROJECT_POLICY_FILE } from '../src/security/projectPolicy';

import { bundleAuthoredComponents, WorkflowBundle } from './helpers/authored-bundle';
import { adminHeaders, httpClient } from './helpers/http';
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
import { SB004_COMPONENTS } from '../../noodl-mcp/tests/sb004Components';
import { NOT_AVAILABLE_TEXT, NOT_FOUND_TEXT, NOT_SET_UP_TEXT } from '../../noodl-mcp/tests/sb006Components';

jest.setTimeout(900000);

const SETUP_TOKEN = 'sb015-first-run-token-7c2ae1';

interface Row {
  objectId: string;
  [field: string]: unknown;
}

/**
 * One arm's whole reading, gathered before any spec runs.
 *
 * Every step records its status rather than asserting it: under `no-token` most
 * of them are *expected* to fail, and a seed that threw would report itself as a
 * broken harness rather than as the measurement it is.
 */
interface FirstRunReport {
  label: string;
  /** `!devOpenActive` — the precondition every reading below is meaningful under. */
  enforced: boolean;
  /** The policy the backend ran, read back off its own data dir after start. */
  configOnDisk: Record<string, unknown>;
  /** True when the data dir had no policy of its own before `start()`. */
  arrivedFromTheProject: boolean;
  /** Status codes, in the order a first-time author produces them. */
  seed: Record<string, number>;
  /** Whether `claimSite` reports the site as claimed. */
  claimed: unknown;
  /** The roles the author actually holds afterwards — the only honest answer. */
  authorRoles: string[];
  /** What the author's own browser shows at the site root. */
  rootVisit: Visit;
}

let projectDir = '';
let bundle: WorkflowBundle;

/**
 * Author signs up, claims, configures, writes a page, publishes it, then looks
 * at their own site — the order a person actually does it in.
 */
async function runFirstLocalRun(label: string, secrets: Record<string, string>): Promise<FirstRunReport> {
  // No `security.json`: this is the provisioned state, and the policy has to
  // arrive from the project or not at all.
  const dataDir = makeSiteDataDir(bundle, secrets, null, `sb015-first-${label}`);
  const hadPolicyBefore = fs.existsSync(path.join(dataDir, BACKEND_POLICY_FILE));

  const svc = new BackendService({
    dataDir,
    port: 0,
    backendId: `sb015-first-${label}`,
    backendName: `SB-015 first run ${label}`,
    // The flag s13 taught the editor's spawner to pass. This is the whole
    // mechanism under test — without it the backend mints `defaultSecurityConfig()`.
    projectDir
  });
  const started = await svc.start();
  const c = httpClient(() => started.listen.url);
  const seed: Record<string, number> = {};

  try {
    const configOnDisk = JSON.parse(
      fs.readFileSync(path.join(dataDir, BACKEND_POLICY_FILE), 'utf-8')
    ) as Record<string, unknown>;

    // ── The author, who is a stranger to their own machine until they claim ──
    const author = await c.post<{ objectId: string; sessionToken: string }>('/users', {
      username: `sb015-author-${label}`,
      password: 'pw'
    });
    seed.signup = author.status;
    const asAuthor = { 'x-parse-session-token': author.json?.sessionToken ?? '' };

    const claim = await c.post<{ result?: { claimed?: boolean } }>(
      '/functions/claimSite',
      { setupToken: SETUP_TOKEN },
      asAuthor
    );
    seed.claimSite = claim.status;

    // 🔴 The ROLE, not the response. s10's finding on this very endpoint was a
    // correct refusal issued after the caller had already been made an admin, so
    // the status code is recorded and the role membership is what is read —
    // through the admin plane, which is the only reader that cannot be fooled by
    // the endpoint's own answer. Same instrument SB-004 §7 uses.
    const rolesRes = await c.get<{ roles: Array<{ name: string; users: string[] }> }>(
      '/admin/roles',
      adminHeaders(dataDir)
    );
    seed.readRoles = rolesRes.status;
    const authorId = author.json?.objectId ?? '';
    const authorRoles = (rolesRes.json?.roles ?? [])
      .filter((r) => (r.users ?? []).includes(authorId))
      .map((r) => r.name);

    const settings = await c.get<{ results: Row[] }>('/classes/SiteSettings', asAuthor);
    seed.readSettings = settings.status;
    const settingsId = settings.json?.results?.[0]?.objectId;
    if (settingsId) {
      const put = await c.put<Row>(
        `/classes/SiteSettings/${settingsId}`,
        { siteName: 'Kestrel Joinery', homeSlug: 'home' },
        asAuthor
      );
      seed.updateSettings = put.status;
    }

    const page = await c.post<Row>(
      '/classes/Page',
      {
        ACL: DRAFT_ACL,
        title: 'Welcome',
        slug: 'home',
        published: false,
        showInNav: true,
        navOrder: 1,
        seoDescription: 'Welcome — description'
      },
      asAuthor
    );
    seed.createPage = page.status;

    const section = await c.post<Row>(
      '/classes/Section',
      { ACL: DRAFT_ACL, kind: 'richText', order: 0, data: { body: 'HOME-BODY-MARKER' }, pageId: page.json?.objectId },
      asAuthor
    );
    seed.createSection = section.status;

    const published = await c.post('/functions/publishPage', { pageId: page.json?.objectId, publish: true }, asAuthor);
    seed.publishPage = published.status;

    // ── And then they look at the site, which is the actual deliverable ──────
    bindProjectToBackend(projectDir, `sb015-first-${label}`, started.listen.port);
    let rootVisit!: Visit;
    await withRenderedPage({ projectDir, backendPort: started.listen.port }, async (pageView) => {
      rootVisit = await readVisit(pageView, '/');
    });

    // eslint-disable-next-line no-console
    console.log(
      `\n[SB-015 first-run ${label}] enforced=${started.security.enforced}` +
        ` policyFromProject=${!hadPolicyBefore}` +
        ` roles=${JSON.stringify(authorRoles)}` +
        ` claimed=${JSON.stringify(claim.json?.result?.claimed)}` +
        `\n  seed=${JSON.stringify(seed)}` +
        `\n  root: title=${JSON.stringify(rootVisit.title)} h1=${JSON.stringify(rootVisit.headings)}` +
        ` nav=${JSON.stringify(rootVisit.nav)} text=${JSON.stringify(rootVisit.text)}`
    );

    return {
      label,
      enforced: started.security.enforced,
      configOnDisk,
      arrivedFromTheProject: !hadPolicyBefore,
      seed,
      claimed: claim.json?.result?.claimed,
      authorRoles,
      rootVisit
    };
  } finally {
    await svc.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

const reports: Record<string, FirstRunReport> = {};

describe('SB-015 §6.4 — the first local run of a project made from the template', () => {
  beforeAll(async () => {
    projectDir = await authorSiteTemplate('sb015-first-run');
    // The policy arrives the way `EmbeddedTemplateProvider.install` puts it
    // there — at the project root, under the name the backend looks for. Both
    // the filename and the contents come from the shipped artefacts rather than
    // being spelled again here.
    fs.writeFileSync(path.join(projectDir, PROJECT_POLICY_FILE), JSON.stringify(SITE_SECURITY, null, 2));
    bundle = bundleAuthoredComponents(
      projectDir,
      SB004_COMPONENTS.map((c) => c.key)
    );

    reports['no-token'] = await runFirstLocalRun('no-token', {});
    reports['with-token'] = await runFirstLocalRun('with-token', { SITE_SETUP_TOKEN: SETUP_TOKEN });
  });

  describe('the arms are comparable at all', () => {
    it('🔴 both ran the PROJECT’s policy, installed at startup from --project-dir', () => {
      for (const r of Object.values(reports)) {
        expect(r.arrivedFromTheProject).toBe(true);
        expect(r.configOnDisk).toEqual(SITE_SECURITY);
      }
    });

    it('🔴 both were ENFORCING — devOpen false, locally, from the first start', () => {
      // The ruling §6.4 states the cost of. Without this, every refusal below is
      // consistent with a backend that simply never came up.
      for (const r of Object.values(reports)) expect(r.enforced).toBe(true);
    });

    it('both let the author sign up, so the difference is not the account', () => {
      // 201 — a signup creates. Recorded as the literal the API returns rather
      // than as `< 400`, so a change in the contract is visible here.
      for (const r of Object.values(reports)) expect(r.seed.signup).toBe(201);
    });
  });

  describe('🔴 arm no-token — what a person is actually provisioned into', () => {
    it('cannot claim the site: the secret the endpoint needs was never written', () => {
      expect(reports['no-token'].seed.claimSite).not.toBe(200);
    });

    it('🔴 and holds NO role afterwards — read off the user, not off the response', () => {
      expect(reports['no-token'].authorRoles).not.toContain('admin');
    });

    it('🔴 so every authoring write is refused — the author cannot make a page', () => {
      const seed = reports['no-token'].seed;
      expect(seed.createPage).not.toBe(200);
      expect(seed.createSection).not.toBe(200);
      expect(seed.publishPage).not.toBe(200);
    });

    it('🔴 never mints the singletons, so there is nothing to configure either', () => {
      // `claimSite` is what creates `SiteSettings` (SB-013) and `Theme`
      // (SB-014). Refused, neither exists — so `updateSettings` is not even
      // ATTEMPTED, which is why its key is absent rather than 403. The author
      // has an admin panel pointed at rows that were never created.
      expect(reports['no-token'].seed).not.toHaveProperty('updateSettings');
      expect(reports['with-token'].seed.updateSettings).toBe(200);
    });

    it('✅ F27 FIXED — the screen now NAMES the state instead of saying "not found"', () => {
      // ⚠️ THIS SPEC USED TO ASSERT THE DEFECT, and it was right to. §6.4
      // predicted "a site that renders, a nav, and an admin panel whose every
      // write is refused". What a person actually got was the not-found panel
      // on their own home page — one sentence shared with a genuine draft
      // (SB-008) and a policy-refused read (F24), three causes wanting three
      // different fixes, and the one a person reaches for first is turning the
      // publication boundary off.
      //
      // SB-015 §6.4a fixed the screen. What is asserted now is that this state
      // identifies itself, and that it does NOT borrow either of the other two
      // sentences.
      const v = reports['no-token'].rootVisit;
      expect(v.text).toContain(NOT_SET_UP_TEXT);
      expect(v.text).not.toContain(NOT_FOUND_TEXT);
      expect(v.text).not.toContain(NOT_AVAILABLE_TEXT);
      expect(v.title).toBe('Site');

      /**
       * 🔴 **This assertion was inverted by DEF-014 on 2026-08-29, and the
       * inversion is the point.** It used to read:
       *
       *   > This arm's Page query FAILS — it does not come back empty —
       *   > because `claimSite` is what creates the collections, so before it
       *   > runs there is nothing to query:
       *   >   [noodl] DbCollection2 (/Pages/Site): Failed to fetch.
       *   >   [query-records/query-failed]
       *
       * That was true and it was the defect DEF-014 names: a filter on a
       * column no row has written was `no such column` at the database and 500
       * on the wire, not an empty result. Fixed at the cause
       * (`QueryBuilder.columnRef`), this arm's query now comes back **empty**,
       * and the browser console carries **nothing at all**.
       *
       * What the spec was actually protecting survives, and is asserted
       * directly instead of through a console line: the screen names this
       * state, and it does so WITHOUT needing a query to fail — which is the
       * stronger version of SB-015 §6.4a's fix, because the sentence a person
       * reads no longer depends on an error the product should not be raising.
       */
      expect(v.errors.join('\n')).not.toContain('query-records/query-failed');
      expect(v.errors).toEqual([]);

      // …and the control renders a real page through the same instrument, so
      // this is a reading about the state and not about the browser.
      expect(reports['with-token'].rootVisit.text).not.toContain(NOT_SET_UP_TEXT);
      expect(reports['with-token'].rootVisit.text).not.toContain(NOT_FOUND_TEXT);
    });

    it('🔴 and the site they look at is EMPTY — not "renders with a nav"', () => {
      // §6.4 predicted a site that renders with a nav and an admin panel whose
      // writes are refused. It is worse than that: with `claimSite` refused there
      // is no `SiteSettings` row, no `Theme`, no page and no nav — because the
      // singletons those come from are minted BY `claimSite` (SB-013/SB-014).
      // The refusal is not at the edge of the experience, it is at the start.
      const v = reports['no-token'].rootVisit;
      expect(v.text).not.toContain('HOME-BODY-MARKER');
      expect(v.nav).toEqual([]);
    });
  });

  describe('🔴 arm with-token — the same machine, one secret later (known-firing control)', () => {
    it('claims the site', () => {
      expect(reports['with-token'].seed.claimSite).toBe(200);
      expect(reports['with-token'].claimed).toBe(true);
    });

    it('🔴 puts the author in admin — which is what makes the other arm about the SECRET', () => {
      expect(reports['with-token'].authorRoles).toContain('admin');
    });

    it('and then every write the other arm was refused succeeds', () => {
      const seed = reports['with-token'].seed;
      expect(seed.createPage).toBe(201);
      expect(seed.createSection).toBe(201);
      expect(seed.publishPage).toBe(200);
      // …and the settings row exists to be updated at all, which is the half
      // the other arm never reaches: `claimSite` is what mints it.
      expect(seed.updateSettings).toBe(200);
    });

    it('🔴 and the site renders the page they just published', () => {
      expect(reports['with-token'].rootVisit.text).toContain('HOME-BODY-MARKER');
    });
  });

  describe('the difference is one secret and nothing else', () => {
    it('🔴 both arms ran byte-identical policies', () => {
      // The sharpest form of "nothing else varied": if these differ, every
      // contrast above is about the policy rather than about the secret.
      expect(reports['no-token'].configOnDisk).toEqual(reports['with-token'].configOnDisk);
    });
  });
});
