/**
 * DEF-004 AC3 — the row that said *"3 executions, 0 steps"* now names the node.
 *
 * Phase 77's SBR-006 drive called the site-builder's `publishPage` three times and found three
 * execution records with no steps under any of them. DEF-004 §1's explanation was that the
 * template contains no `Log` nodes and a `Log` line was the only thing that reached the recorder.
 * That explanation was **driven and held** (`def004-execution-steps.test.ts` §"what was measured").
 *
 * This is the other half of the same measurement: **the real graph**, not a synthetic one.
 * `publishPage` is authored here by the same MCP door that writes it into a real project, run on
 * a real `BackendService` against real records, and the execution record is read out of
 * `executions.sqlite`.
 *
 * ⚠️ **The browser half of the SB-015 drive is deliberately absent.** What is under test is what
 * the backend wrote down about a run, and rendering the site afterwards would add a headless
 * Chrome to the cost of a spec that never looks at a pixel.
 *
 * 🔴 **This spec asserts the steps NAME NODES, not that the publish succeeded.** Whether
 * `publishPage` does the right thing is SBR-006's and DEF-014's question and they own it; if it
 * fails here, the record saying *which node* failed is precisely the property being added. So the
 * assertion is on the shape of the record either way — and the run's actual disposition is
 * printed, because a spec that hides which arm it took is a spec that stops meaning anything.
 */
import * as fs from 'fs';
import * as path from 'path';

import { ExecutionHistory } from '../src/execution/ExecutionStore';
import { BackendService } from '../src/service';
import { PROJECT_POLICY_FILE } from '../src/security/projectPolicy';

import { bundleAuthoredComponents, WorkflowBundle } from './helpers/authored-bundle';
import { httpClient } from './helpers/http';
import { authorSiteTemplate, DRAFT_ACL, makeSiteDataDir, SITE_SECURITY } from './helpers/site-drive';
import { SB004_COMPONENTS } from '../../noodl-mcp/tests/sb004Components';

jest.setTimeout(900000);

const SETUP_TOKEN = 'def004-publish-token-91b3fe';

interface Row {
  objectId: string;
  [field: string]: unknown;
}

interface StepRow {
  nodeId: string;
  nodeType: string;
  status: string;
  errorMessage?: string;
}

let bundle: WorkflowBundle;
let projectDir = '';
let dataDir = '';
let service: BackendService | null = null;
let publishStatus = 0;
let steps: StepRow[] = [];
let runStatus = '';

describe('DEF-004 AC3 — the site-builder’s own publishPage, recorded', () => {
  beforeAll(async () => {
    projectDir = await authorSiteTemplate('def004-publish');
    fs.writeFileSync(path.join(projectDir, PROJECT_POLICY_FILE), JSON.stringify(SITE_SECURITY, null, 2));
    bundle = bundleAuthoredComponents(
      projectDir,
      SB004_COMPONENTS.map((c) => c.key)
    );

    dataDir = makeSiteDataDir(bundle, { SITE_SETUP_TOKEN: SETUP_TOKEN }, null, 'def004-publish');
    service = new BackendService({
      dataDir,
      port: 0,
      backendId: 'def004-publish',
      backendName: 'DEF-004 publish',
      projectDir
    });
    const started = await service.start();
    const c = httpClient(() => started.listen.url);

    // The author, claiming their own site — the seed SB-015 established, minus the browser.
    const author = await c.post<{ objectId: string; sessionToken: string }>('/users', {
      username: 'def004-author',
      password: 'pw'
    });
    const asAuthor = { 'x-parse-session-token': author.json?.sessionToken ?? '' };
    await c.post('/functions/claimSite', { setupToken: SETUP_TOKEN }, asAuthor);

    const page = await c.post<Row>(
      '/classes/Page',
      { ACL: DRAFT_ACL, title: 'Welcome', slug: 'home', published: false, showInNav: true, navOrder: 1 },
      asAuthor
    );
    await c.post<Row>(
      '/classes/Section',
      { ACL: DRAFT_ACL, kind: 'richText', order: 0, data: { body: 'BODY' }, pageId: page.json?.objectId },
      asAuthor
    );

    const published = await c.post('/functions/publishPage', { pageId: page.json?.objectId, publish: true }, asAuthor);
    publishStatus = published.status;

    const history = new ExecutionHistory();
    history.open(dataDir);
    const runs = history.list({ workflowId: 'publishPage', limit: 10 });
    runStatus = runs[0] ? runs[0].status : '';
    steps = runs[0] ? (((history.get(runs[0].id)?.steps || []) as unknown as StepRow[])) : [];

    // eslint-disable-next-line no-console
    console.log(
      `\n[DEF-004 AC3] publishPage http=${publishStatus} record=${runStatus} steps=${steps.length}\n  ` +
        steps.map((s) => `${s.nodeId}:${s.nodeType}:${s.status}${s.errorMessage ? ' — ' + s.errorMessage : ''}`).join('\n  ')
    );
  });

  afterAll(async () => {
    if (service) await service.stop();
    if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
    if (projectDir) fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('🔴 the run that recorded ZERO steps now records the nodes it ran', () => {
    expect(steps.length).toBeGreaterThan(0);
  });

  it('every step names a node id and a registered type, which is what makes it a place on a canvas', () => {
    for (const step of steps) {
      expect(typeof step.nodeId).toBe('string');
      expect(step.nodeId.length).toBeGreaterThan(0);
      expect(typeof step.nodeType).toBe('string');
      expect(step.nodeType.length).toBeGreaterThan(0);
    }
  });

  it('the steps are the graph’s OWN nodes — the ids are DERIVED from the DEPLOYED bundle', () => {
    // 🔴 **Derived from the bundle, and it took two wrong instruments to get here.** The first
    // version listed the ids in `site-builder.content.json`; the second read them off
    // `SB004_COMPONENTS`. Both went red on ids the run really did produce, for two different
    // reasons: the MCP door **rewrites node ids on write** (`sections` → `sections-3`,
    // `page` → `page-8`), and `Run Tasks` instantiates its **worker** inside this run, so the
    // worker's nodes are legitimately in this record. The only honest source is the artefact the
    // backend actually loaded.
    const inBundle = new Set<string>();
    for (const component of bundle.components as Array<{ nodes?: Array<{ id: string }> }>) {
      for (const node of component.nodes || []) inBundle.add(node.id);
    }
    const unknownIds = steps.map((s) => s.nodeId).filter((id) => !inBundle.has(id));
    expect(unknownIds).toEqual([]);
    // …and it recorded more than one of them, so "every id is in the bundle" is not vacuously
    // true over a list of one.
    expect(new Set(steps.map((s) => s.nodeId)).size).toBeGreaterThan(1);
  });

  it('⚠️ records the Run Tasks WORKER’s own step, not only the endpoint’s', () => {
    // The worker is a separate component the endpoint never names a node of. A record that
    // stopped at the endpoint's boundary would leave the part that does the writing invisible,
    // which is most of what "my published page came back wrong" actually means.
    const worker = SB004_COMPONENTS.find((c) => c.legacyName === '/#__cloud__/site/SetSectionAccess');
    const workerIds = new Set((worker?.nodes as Array<{ id: string }>).map((n) => n.id));
    expect(steps.some((s) => workerIds.has(s.nodeId))).toBe(true);
  });

  it('⚠️ if anything failed, the record says WHICH node and why — the person’s sentence', () => {
    const failed = steps.filter((s) => s.status === 'error');
    // Not `toHaveLength(0)`: whether this run succeeds is SBR-006's and DEF-014's question. What
    // this task owes is that a failure is *attributable*, so the assertion is on the failures
    // that exist rather than on there being none.
    for (const step of failed) {
      expect(step.errorMessage).toBeTruthy();
      expect(step.nodeId.length).toBeGreaterThan(0);
    }
    expect(publishStatus).toBeGreaterThan(0);
  });
});
