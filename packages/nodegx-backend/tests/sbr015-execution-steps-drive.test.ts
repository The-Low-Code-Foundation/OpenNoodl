/**
 * SBR-015 AC4 — *"`execution_steps` either records cloud-function nodes, or the task says why
 * it cannot."*
 *
 * ## Why this file exists when `def004-publish-page-steps.test.ts` already runs publishPage
 *
 * That spec is phase 80's and it answers phase 80's question — *does the recorder write rows for
 * a real graph* — while deliberately declining SBR-015's: **"whether `publishPage` does the right
 * thing is SBR-006's and DEF-014's question and they own it."** So it takes whichever arm the run
 * happens to take and asserts the *shape* of the record either way.
 *
 * SBR-015's question is narrower, and it is the one in AC4's own second sentence:
 *
 * > *"a log table that exists and is always empty is worse than no table: SBR-006 reached for it
 * > first, exactly as intended, and **it could not separate 'never called' from 'called and
 * > failed'**."*
 *
 * That is a claim about **two runs**, and no single-arm reading can settle it. A table with rows
 * in it *still* cannot separate those two things unless a run that fails differs, in the table,
 * from a run that succeeds — by naming the node that failed, and by the nodes downstream of it
 * being **absent** rather than quietly marked done.
 *
 * So this is a control pair, one variable:
 *
 * | arm | the one variable | what the table must show |
 * |---|---|---|
 * | **A — success** | `withFlag` declares its `out-built` signal port | every action node, none failed |
 * | **M — failure** | that one port declaration is **removed** | `withFlag` recorded as FAILED, by name and with a reason, and everything downstream of it ABSENT |
 *
 * 🔴 **Arm A is what makes arm M's absences readable.** An absence on its own is equally good
 * evidence for *"the recorder does not cover that node"* and for *"that node never ran"* — two
 * readings with opposite fixes. Arm A is the known-firing signal that excludes the first: it
 * records those very node ids, in this very table, from the identical seed.
 *
 * ## 🔴 Why the mutant is this particular one, and not a hostile input
 *
 * Three natural failures were tried first and **none of them fails**, which is a measurement in
 * itself and is written down in SBR-015 §4c:
 *
 *  - a `pageId` naming no record → **HTTP 200 `published: true`**, every node `success`, and
 *    nothing written (**D34**);
 *  - a Section whose ACL forbids writes → succeeds; a cloud function is not ACL-bound;
 *  - a non-admin caller → **403 at the function gate**, so the graph never runs and there is no
 *    record at all.
 *
 * The mutant is instead the **documented deployed failure mode of these very nodes**, and it is
 * the one `sb004Components.ts` names where it wires the failure edges this task added: *"a
 * `JavaScriptFunction` fires `failure` when its script THROWS, and the documented deployed
 * failure mode of these nodes is `Outputs.built is not a function` when a custom signal port was
 * not declared… That is precisely the error these edges would have named."* This file is that
 * sentence, measured.
 *
 * ⚠️ **What this instrument CANNOT see**, stated rather than left for a later reader to find. A
 * step is written by `beginOutcome` (an action invocation) or by `raiseRuntimeError` (`node.ts`,
 * DEF-004). A node that is neither — a pure value node, a branch that never fired — will never
 * appear here however well it works. So *"node X has no row"* is evidence about **action** nodes
 * only, which is why both arms are read against the same population.
 *
 * 🔴 **This does not contradict AC4's own warning.** The person still reads the Response —
 * `This page could not be published.` — and not the log. The table is what the *operator* reads
 * afterwards, and that is the half AC4 is about.
 */
import * as fs from 'fs';
import * as path from 'path';

import { ExecutionHistory } from '../src/execution/ExecutionStore';
import { PROJECT_POLICY_FILE } from '../src/security/projectPolicy';
import { BackendService } from '../src/service';

import { SB004_COMPONENTS } from '../../noodl-mcp/tests/sb004Components';
import { bundleAuthoredComponents, WorkflowBundle } from './helpers/authored-bundle';
import { httpClient } from './helpers/http';
import { authorSiteTemplate, DRAFT_ACL, makeSiteDataDir, SITE_SECURITY } from './helpers/site-drive';

jest.setTimeout(900000);

const SETUP_TOKEN = 'sbr015-steps-token-4d91ac';

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

interface Arm {
  http: number;
  body: unknown;
  runId: string;
  runStatus: string;
  steps: StepRow[];
  /** The stored Page row as it stands *after* the call — see the ordering note on arm M. */
  stored: Row | null;
}

const EMPTY: Arm = { http: 0, body: null, runId: '', runStatus: '', steps: [], stored: null };

interface BundleShape {
  components: Array<{
    name?: string;
    nodes?: Array<{ id: string; ports?: Array<{ name: string }> }>;
  }>;
}

let bundle: WorkflowBundle;
let projectDir = '';
const dataDirs: string[] = [];
const services: BackendService[] = [];
const bundleNodeIds = new Set<string>();

let armA: Arm = EMPTY;
let armM: Arm = EMPTY;
/** 🔴 The mutant's own receipt: how many port declarations it actually removed. */
let mutantRemoved = -1;
/** D34's reading, taken on the way past and reported rather than owned here. */
let goneArm: Arm = EMPTY;
let goneWrote: number | null = null;
let goneDirectPut = -1;

const describeArm = (label: string, arm: Arm) =>
  `\n[SBR-015 AC4] ${label}: http=${arm.http} record=${arm.runStatus} run=${arm.runId} steps=${arm.steps.length}\n  ` +
  arm.steps
    .map((s) => `${s.nodeId}:${s.nodeType}:${s.status}${s.errorMessage ? ' — ' + s.errorMessage : ''}`)
    .join('\n  ');

/**
 * One deployed site-builder backend, seeded with one page and two sections, and one publish.
 *
 * ⚠️ **`readRun` is keyed on the previous run id, and that is not fussiness.** The first draft
 * read *"the most recent publishPage record"* unconditionally, and a non-admin arm — refused at
 * the function gate with a **403**, so the graph never ran and no record was written — read back
 * the *previous* arm's row and would have been reported as that arm's own. A reader that cannot
 * tell "no record" from "someone else's record" is the same defect this task is about.
 */
async function publishOnce(
  label: string,
  mutate?: (b: BundleShape) => number
): Promise<Arm> {
  const deployed = JSON.parse(JSON.stringify(bundle)) as BundleShape;
  if (mutate) mutantRemoved = mutate(deployed);

  const dataDir = makeSiteDataDir(deployed, { SITE_SETUP_TOKEN: SETUP_TOKEN }, null, `sbr015-${label}`);
  dataDirs.push(dataDir);
  const service = new BackendService({
    dataDir,
    port: 0,
    backendId: `sbr015-${label}`,
    backendName: `SBR-015 ${label}`,
    projectDir
  });
  services.push(service);
  const started = await service.start();
  const c = httpClient(() => started.listen.url);

  const author = await c.post<{ objectId: string; sessionToken: string }>('/users', {
    username: `sbr015-${label}`,
    password: 'pw'
  });
  const asAuthor = { 'x-parse-session-token': author.json?.sessionToken ?? '' };
  await c.post('/functions/claimSite', { setupToken: SETUP_TOKEN }, asAuthor);

  const page = await c.post<Row>(
    '/classes/Page',
    { ACL: DRAFT_ACL, title: 'Welcome', slug: 'home', published: false, showInNav: true, navOrder: 1 },
    asAuthor
  );
  const pageId = page.json?.objectId ?? '';
  for (const order of [0, 1]) {
    await c.post<Row>(
      '/classes/Section',
      { ACL: DRAFT_ACL, kind: 'richText', order, data: { body: `BODY ${order}` }, pageId },
      asAuthor
    );
  }

  const history = new ExecutionHistory();
  history.open(dataDir);
  const readRun = (previous: string): Omit<Arm, 'http' | 'body'> => {
    const runs = history.list({ workflowId: 'publishPage', limit: 10 });
    if (!runs[0] || runs[0].id === previous) return { runId: '', runStatus: '', steps: [] };
    return {
      runId: runs[0].id,
      runStatus: runs[0].status,
      steps: (history.get(runs[0].id)?.steps || []) as unknown as StepRow[]
    };
  };

  const res = await c.post('/functions/publishPage', { pageId, publish: true }, asAuthor);
  const readBack = await c.get<Row>(`/classes/Page/${pageId}`, asAuthor);
  const arm: Arm = { http: res.status, body: res.json, ...readRun(''), stored: readBack.json ?? null };

  // D34's reading, taken here because the backend is already up: the same call on a `pageId`
  // that names nothing. Reported, not asserted — see §4c; the row is owned in the register.
  if (!mutate) {
    const gone = await c.post(
      '/functions/publishPage',
      { pageId: 'sbr015-no-such-page-0000', publish: true },
      asAuthor
    );
    goneArm = { http: gone.status, body: gone.json, ...readRun(arm.runId), stored: null };
    const after = await c.get<{ results: Row[] }>('/classes/Page', asAuthor);
    goneWrote = after.json?.results?.length ?? null;

    // 🔴 One variable further in, because a row nobody can attribute gets rediscovered at full
    // price: is the write swallowed by the NODE or by the backend's own update route? The node
    // calls `cloudstore.save({collection, objectId, data, acl})`
    // (`setdbmodelpropertiesnode.ts:135-150`), which is this route.
    const directPut = await c.request('PUT', '/classes/Page/sbr015-no-such-page-0000', {
      body: { published: true },
      headers: asAuthor
    });
    goneDirectPut = directPut.status;
  }

  return arm;
}

/**
 * Remove `withFlag`'s `out-built` signal port declaration, and report how many it removed.
 *
 * 🔴 **The count is the mutant's receipt.** A mutation that silently matched nothing leaves the
 * arm identical to the control, and the pair then reads as *"the failure was not recorded"* when
 * in fact no failure was ever caused — an instrument answering a question nobody asked.
 */
function dropBuiltPort(b: BundleShape): number {
  let removed = 0;
  for (const component of b.components || []) {
    for (const node of component.nodes || []) {
      if (node.id !== 'withFlag' || !node.ports) continue;
      const before = node.ports.length;
      node.ports = node.ports.filter((p) => p.name !== 'out-built');
      removed += before - node.ports.length;
    }
  }
  return removed;
}

describe('SBR-015 AC4 — a failed publish and a successful one, told apart in the log', () => {
  beforeAll(async () => {
    projectDir = await authorSiteTemplate('sbr015-steps');
    fs.writeFileSync(path.join(projectDir, PROJECT_POLICY_FILE), JSON.stringify(SITE_SECURITY, null, 2));
    bundle = bundleAuthoredComponents(
      projectDir,
      SB004_COMPONENTS.map((c) => c.key)
    );
    for (const component of (bundle as unknown as BundleShape).components) {
      for (const node of component.nodes || []) bundleNodeIds.add(node.id);
    }

    armA = await publishOnce('control');
    armM = await publishOnce('mutant', dropBuiltPort);

    /* eslint-disable no-console */
    console.log(describeArm('ARM A — control', armA));
    console.log(describeArm(`ARM M — mutant (out-built removed from ${mutantRemoved} node)`, armM));
    console.log(`\n[SBR-015 AC4] arm A body=${JSON.stringify(armA.body)}`);
    console.log(`[SBR-015 AC4] arm M body=${JSON.stringify(armM.body)}`);
    console.log(
      `\n[SBR-015 §4d] the stored page after each call —` +
        `\n  arm A: published=${JSON.stringify(armA.stored?.published)} ACL=${JSON.stringify(armA.stored?.ACL)}` +
        `\n  arm M: published=${JSON.stringify(armM.stored?.published)} ACL=${JSON.stringify(armM.stored?.ACL)}`
    );
    console.log(
      `\n[SBR-015 D34] publish on a pageId naming nothing: http=${goneArm.http} ` +
        `body=${JSON.stringify(goneArm.body)} steps=${goneArm.steps.length} ` +
        `failures=${goneArm.steps.filter((s) => s.status !== 'success').length} pagesInDb=${goneWrote}\n` +
        `[SBR-015 D34] and the route the node calls, direct: PUT /classes/Page/<no-such-id> -> ${goneDirectPut}`
    );
    /* eslint-enable no-console */
  });

  afterAll(async () => {
    for (const service of services) await service.stop();
    for (const dir of dataDirs) fs.rmSync(dir, { recursive: true, force: true });
    if (projectDir) fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('the mutant edited exactly the one port declaration it names', () => {
    expect(mutantRemoved).toBe(1);
  });

  it('the two arms are two runs, each recorded — not one record read twice', () => {
    expect(armA.runId).not.toEqual('');
    expect(armM.runId).not.toEqual('');
    expect(armA.runId).not.toEqual(armM.runId);
  });

  it('ARM A records the nodes it ran, and every one is a node in the DEPLOYED bundle', () => {
    expect(armA.steps.length).toBeGreaterThan(1);
    expect(armA.steps.map((s) => s.nodeId).filter((id) => !bundleNodeIds.has(id))).toEqual([]);
  });

  it('ARM A has NO failure row — the control is clean, so a failure row is the variable', () => {
    expect(armA.steps.filter((s) => s.status !== 'success')).toEqual([]);
    expect(armA.http).toBe(200);
  });

  it('🔴 ARM M — the person is told, and told quickly: the 30,004 ms this task was opened for', () => {
    expect(armM.http).not.toBe(504);
    expect(armM.http).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(armM.body)).toContain('This page could not be published.');
  });

  it('🔴 ARM M — "called and failed": the log NAMES the node and says why', () => {
    const failed = armM.steps.filter((s) => s.status !== 'success');
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.map((s) => s.nodeId)).toContain('withFlag');
    for (const step of failed) {
      expect(bundleNodeIds.has(step.nodeId)).toBe(true);
      expect(String(step.nodeType).length).toBeGreaterThan(0);
      expect(step.errorMessage).toBeTruthy();
    }
  });

  it('🔴 ARM M — "never called": what is downstream of the failure is ABSENT, not marked done', () => {
    // ⚠️ Read against arm A, never against the authored graph. The population that CAN appear is
    // the set arm A recorded — asserting absence against the node list would be asserting it
    // about nodes this table never covers at all (see the header).
    const recordedInA = new Set(armA.steps.map((s) => s.nodeId));
    const recordedInM = new Set(armM.steps.map((s) => s.nodeId));
    for (const downstream of ['tasks', 'page-8', 'res']) {
      expect(recordedInA.has(downstream)).toBe(true); // known-firing, in this very table
      expect(recordedInM.has(downstream)).toBe(false); // and demonstrably not reached
    }
  });


  /**
   * 🔴 Settles a row in **phase 80's** `UNOWNED-ROWS-TO-MEASURE.md` §1 — *"publishPage issues its
   * refusal after making the page public"* — which that file says is phase 77's to place. It asks
   * for exactly this: force any later failure inside the function and read the page's stored
   * `published` and ACL afterwards.
   *
   * ⚠️ **The failure point here is `withFlag`, not the sections query the recorded reading used.**
   * Both sit upstream of the only edge that can write — `tasks.done → page.store` — so what this
   * measures is the ordering claim itself and not one node's timing. The two are the same
   * question only because the write has one trigger; if a second edge into `store` is ever added,
   * this assertion stops covering the row and the row comes back.
   */
  it('🔴 a REFUSED publish leaves the page a draft — the flag is not written ahead of the refusal', () => {
    expect(armM.stored).not.toBeNull();
    expect(armM.stored?.published).not.toBe(true);
    const acl = (armM.stored?.ACL ?? {}) as Record<string, { read?: boolean }>;
    expect(acl['*']?.read).not.toBe(true);
  });

  it('…and the control did publish, so the assertion above is not reading an inert row', () => {
    expect(armA.stored?.published).toBe(true);
    expect(((armA.stored?.ACL ?? {}) as Record<string, { read?: boolean }>)['*']?.read).toBe(true);
  });

  it('⚠️ the same table separates them — the two arms are not the same row set', () => {
    expect(armM.steps.length).toBeLessThan(armA.steps.length);
    expect(armM.steps.map((s) => `${s.nodeId}:${s.status}`)).not.toEqual(
      armA.steps.map((s) => `${s.nodeId}:${s.status}`)
    );
  });
});
