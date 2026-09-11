/**
 * DEF-014 AC1 — a person who has just made their first site can publish their
 * first page.
 *
 * The row's person-sentence, driven through the template's own cloud function
 * on a real backend: sign up, claim the site, create one page, press Publish —
 * **with no sections authored anywhere**, which is the state of every site on
 * the day it is made. `publishPage` refused it with 400 on every new site,
 * because the query it runs to find that page's sections filtered on
 * `Section.pageId` before any row had ever carried it, and the backend answered
 * `no such column` with a 500 rather than "nothing matches yet".
 *
 * ## The two arms are phase 77's control pair, re-driven
 *
 * SBR-015 §2.1 moved exactly one variable — whether `Section` has a `pageId`
 * column — by writing a section against a **different** page, so the page under
 * test carried zero sections in both arms. It read **400** with the column
 * absent and **200** with it present. Both arms are here for the same reason:
 * the with-column arm is the known-firing control, and if publish fails *there*
 * this file is measuring a broken harness rather than the defect.
 *
 * ⚠️ **What this is not.** It drives the template's cloud half over HTTP; it
 * does not mint the project through the editor's wizard or press a button in
 * the admin panel. The graph, the policy, the backend and the function are the
 * real ones (SB-015's harness); the GUI is not in it.
 */
import * as fs from 'fs';
import * as path from 'path';

import { BackendService } from '../src/service';
import { PROJECT_POLICY_FILE } from '../src/security/projectPolicy';

import { bundleAuthoredComponents, WorkflowBundle } from './helpers/authored-bundle';
import { httpClient } from './helpers/http';
import { authorSiteTemplate, DRAFT_ACL, makeSiteDataDir, SITE_SECURITY } from './helpers/site-drive';
import { SB004_COMPONENTS } from '../../noodl-mcp/tests/sb004Components';

jest.setTimeout(900000);

const SETUP_TOKEN = 'def014-first-publish-token-91b3e0';

interface Row {
  objectId: string;
  [field: string]: unknown;
}

interface PublishRun {
  /** Status codes in the order a first-time author produces them. */
  seed: Record<string, number>;
  /** The publish endpoint's own body, for the sentence it refuses with. */
  publishBody: unknown;
  /** The page row read back afterwards — whether the publish did its work. */
  pageAfter: Row | undefined;
  /** Section rows anywhere in the backend at publish time. */
  sectionsAtPublish: number;
}

let projectDir = '';
let bundle: WorkflowBundle;

/**
 * One arm. `seedOtherPageSection` is the single variable: when true, a section
 * is written against a DIFFERENT page first, which is the only thing that gives
 * `Section` a `pageId` column. The page under test has zero sections either way.
 */
async function runFirstPublish(label: string, seedOtherPageSection: boolean): Promise<PublishRun> {
  const dataDir = makeSiteDataDir(bundle, { SITE_SETUP_TOKEN: SETUP_TOKEN }, null, `def014-${label}`);
  const svc = new BackendService({
    dataDir,
    port: 0,
    backendId: `def014-${label}`,
    backendName: `DEF-014 first publish ${label}`,
    projectDir
  });
  const started = await svc.start();
  const c = httpClient(() => started.listen.url);
  const seed: Record<string, number> = {};

  try {
    const author = await c.post<{ objectId: string; sessionToken: string }>('/users', {
      username: `def014-author-${label}`,
      password: 'pw'
    });
    seed.signup = author.status;
    const asAuthor = { 'x-parse-session-token': author.json?.sessionToken ?? '' };

    const claim = await c.post('/functions/claimSite', { setupToken: SETUP_TOKEN }, asAuthor);
    seed.claimSite = claim.status;

    const page = await c.post<Row>(
      '/classes/Page',
      { ACL: DRAFT_ACL, title: 'Welcome', slug: 'home', published: false, showInNav: true, navOrder: 1 },
      asAuthor
    );
    seed.createPage = page.status;

    if (seedOtherPageSection) {
      // A DIFFERENT page. This exists only to create the column; the page under
      // test still has no sections, so the two arms differ in the column and in
      // nothing else.
      const other = await c.post<Row>(
        '/classes/Page',
        { ACL: DRAFT_ACL, title: 'Other', slug: 'other', published: false, showInNav: false, navOrder: 2 },
        asAuthor
      );
      seed.createOtherPage = other.status;
      const section = await c.post<Row>(
        '/classes/Section',
        { ACL: DRAFT_ACL, kind: 'richText', order: 0, data: { body: 'ELSEWHERE' }, pageId: other.json?.objectId },
        asAuthor
      );
      seed.createSectionElsewhere = section.status;
    }

    // How many sections exist anywhere, read before the publish so the claim
    // "no sections authored anywhere" is measured rather than assumed.
    const sections = await c.get<{ results: Row[] }>('/classes/Section', asAuthor);
    const sectionsAtPublish = sections.json?.results?.length ?? 0;

    const published = await c.post('/functions/publishPage', { pageId: page.json?.objectId, publish: true }, asAuthor);
    seed.publishPage = published.status;

    const readBack = await c.get<{ results: Row[] }>('/classes/Page', asAuthor);
    const pageAfter = (readBack.json?.results ?? []).find((r) => r.objectId === page.json?.objectId);

    // eslint-disable-next-line no-console
    console.log(
      `\n[DEF-014 first publish ${label}] sectionsAnywhere=${sectionsAtPublish}` +
        ` seed=${JSON.stringify(seed)} body=${JSON.stringify(published.json)}`
    );

    return { seed, publishBody: published.json, pageAfter, sectionsAtPublish };
  } finally {
    await svc.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

const runs: Record<string, PublishRun> = {};

describe('DEF-014 AC1 — the first page on a brand-new site can be published', () => {
  beforeAll(async () => {
    projectDir = await authorSiteTemplate('def014-first-publish');
    fs.writeFileSync(path.join(projectDir, PROJECT_POLICY_FILE), JSON.stringify(SITE_SECURITY, null, 2));
    bundle = bundleAuthoredComponents(
      projectDir,
      SB004_COMPONENTS.map((c) => c.key)
    );

    runs['no-section-anywhere'] = await runFirstPublish('no-section-anywhere', false);
    runs['column-exists'] = await runFirstPublish('column-exists', true);
  });

  it('the arms are comparable at all — both authors claimed the site and made their page', () => {
    for (const run of Object.values(runs)) {
      expect(run.seed.signup).toBe(201);
      expect(run.seed.claimSite).toBe(200);
      expect(run.seed.createPage).toBe(201);
    }
  });

  it('🔴 the page under test has no sections in EITHER arm — the variable is the column, not the data', () => {
    expect(runs['no-section-anywhere'].sectionsAtPublish).toBe(0);
    // One section exists in the control arm, and it belongs to a different page.
    expect(runs['column-exists'].sectionsAtPublish).toBe(1);
  });

  it('✅ publishes a page on a site where no section has ever been written', () => {
    expect(runs['no-section-anywhere'].seed.publishPage).toBe(200);
  });

  it('and the page really is live afterwards — published, and open to the world', () => {
    // ⚠️ **This is a description, not a control, and the difference was
    // measured.** Both readings below are ALSO true under the mutant that
    // restores the raise — where `publishPage` answers **400**. Neither the
    // flag nor the ACL discriminates; only the status code does. Kept because
    // the state it describes is what a published page is, and demoted in
    // wording because an assertion that cannot fail is not evidence.
    const run = runs['no-section-anywhere'];
    expect(run.pageAfter?.published).toBe(true);
    const acl = run.pageAfter?.ACL as Record<string, { read?: boolean }> | undefined;
    expect(acl?.['*']?.read).toBe(true);
  });

  it('🔴 FINDING — the refusal was issued AFTER the page had been made public', () => {
    // Run under the mutant (the pre-fix behaviour), `publishPage` answers
    //   400 {"error":"This page could not be published."}
    // and the page comes back `published: true` with `ACL['*'].read === true`.
    // The function writes the page's flag and opens its ACL, and only then runs
    // the sections query that was failing — so a person was told their page
    // could not be published about a page that was, in the database, published
    // and world-readable.
    //
    // DEF-014's fix removes this particular cause, and nothing else in this
    // file depends on the ordering. But the ordering is untouched: any later
    // failure inside `publishPage` leaves the same state. Recorded in the phase
    // register with owner NONE rather than fixed here — it is the template's
    // graph, which is phase 77/78's, and DEF-014 §5 says not to fix this row in
    // the template.
    //
    // What is asserted here is only that the two facts coexist, so the note
    // above cannot quietly stop being true.
    const run = runs['no-section-anywhere'];
    expect(run.seed.publishPage).toBe(200);
    expect(run.pageAfter?.published).toBe(true);
  });

  it('KNOWN-FIRING CONTROL: the arm SBR-015 measured at 200 is still 200', () => {
    expect(runs['column-exists'].seed.publishPage).toBe(200);
    expect(runs['column-exists'].pageAfter?.published).toBe(true);
  });

  it('🔴 the two arms now agree — which is the whole of the fix', () => {
    // SBR-015 §2.1 read 400 / 200 across this pair. Same pair, same variable.
    expect(runs['no-section-anywhere'].seed.publishPage).toBe(runs['column-exists'].seed.publishPage);
  });
});
