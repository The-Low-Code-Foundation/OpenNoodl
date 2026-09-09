/**
 * HLS-013 — `deploy_cloud_functions` driven against a REAL backend, with no
 * editor anywhere.
 *
 * ## The claim
 *
 * Before this, an agent could provision a backend over MCP and had **no way to
 * put a function on it**: the only deploy was `CloudFunctionDeployer`, reachable
 * from a property-editor action, a trail button, an autosave and a backend
 * start — all of them inside a running editor. So any app with a backend could
 * not be shipped without a person opening a window.
 *
 * ## What this measures, and what it deliberately does not
 *
 * 🔴 **A function that DEPLOYED and a function that ANSWERS are two different
 * claims.** The task says so explicitly, and it is the trap this file exists to
 * avoid: `deploy returned true` is satisfied by a bundle that loads and a
 * function that 500s on every call. So AC1 ends at an **HTTP call to the
 * deployed function**, and the assertion is on its body.
 *
 * Skips (loudly, via `describe.skip`) if the backend bundle or the cloud-bundle
 * child has not been built — the same convention as `provision.test.ts`.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { resolveCloudBundleEntry } from '../src/cloud/deploy';
import { stopOwnedBackends } from '../src/backend/provision';
import { call, connect, reveal, TestSession } from './helpers';

const BACKEND_CLI = path.join(__dirname, '..', '..', 'nodegx-backend', 'dist', 'cli.js');

/**
 * A project with real cloud functions. The MCP fixture has none, and a deploy of
 * nothing would pass every assertion below by being vacuous — the
 * `all([]) === true` failure this repo has met before.
 */
const CLOUD_PROJECT = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'NodeGX test projects',
  'd40-wizard-drive'
);

const ready = fs.existsSync(BACKEND_CLI) && Boolean(resolveCloudBundleEntry().entry) && fs.existsSync(CLOUD_PROJECT);
const describeOrSkip = ready ? describe : describe.skip;

interface DeployResponse {
  ok: boolean;
  bundleName: string;
  hash: string;
  changed: boolean;
  functions: { name: string; status: string; reason?: string }[];
  error?: string;
  endpoint: string;
  backendId: string;
}

/** Every file under a directory, keyed by relative path, with its bytes hashed. */
function snapshotTree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out[path.relative(dir, full)] = createHash('sha256').update(fs.readFileSync(full)).digest('hex');
    }
  };
  walk(dir);
  return out;
}

/** One authenticated admin read, straight to the backend this test started. */
async function adminGet(backendId: string, endpoint: string, route: string): Promise<unknown> {
  const secrets = path.join(process.env.NODEGX_BACKENDS_DIR as string, backendId, 'secrets.json');
  const token = JSON.parse(fs.readFileSync(secrets, 'utf-8')).adminToken;
  const res = await fetch(`${endpoint}${route}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${route} answered HTTP ${res.status}`);
  return res.json();
}

function copyCloudProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hls013-project-'));
  // 🔴 A COPY. Deploying reads the project, and the read path loads it into a
  // `ProjectModel` — which schedules an autosave that would rewrite every
  // component file. `prepareProjectForCloudExport` blocks that, and this copy is
  // the belt to its braces: a regression there must not edit a real project.
  fs.cpSync(CLOUD_PROJECT, dir, { recursive: true });
  return dir;
}

describe('HLS-013 — the bundler child exists and is wired', () => {
  it('resolves the cloud-bundle entry in the monorepo', () => {
    const { entry, probed } = resolveCloudBundleEntry();
    expect(probed.length).toBeGreaterThan(0);
    if (fs.existsSync(path.join(__dirname, '..', 'dist', 'cloud-bundle.cjs'))) {
      expect(entry).toBeTruthy();
    }
  });
});

describeOrSkip('HLS-013 AC1 — provision, deploy and call, with no editor', () => {
  jest.setTimeout(180000);

  let session: TestSession;
  let projectDir: string;
  let root: string;
  const previousRoot = process.env.NODEGX_BACKENDS_DIR;

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'hls013-backends-'));
    // Confines every backend this file makes to a temp directory: it can never
    // touch the developer's own backends.
    process.env.NODEGX_BACKENDS_DIR = root;
    projectDir = copyCloudProject();
    session = await connect(projectDir, true);
    await reveal(session, 'backend');
  });

  afterEach(async () => {
    await stopOwnedBackends(root);
    await session.close();
    if (previousRoot === undefined) delete process.env.NODEGX_BACKENDS_DIR;
    else process.env.NODEGX_BACKENDS_DIR = previousRoot;
  });

  it('deploys every cloud function the project holds, and one of them answers over HTTP', async () => {
    // 🔴 `force` because this project is a COPY of one that was already bound to
    // a backend from an earlier drive, and `provision_backend` refuses to
    // repoint a bound project without it — correctly. Discovered by the refusal,
    // which is the tool doing its job.
    const provisioned = await call<{ provisioned: boolean; endpoint?: string }>(session, 'provision_backend', {
      name: 'App backend',
      force: true
    });
    expect(provisioned.data.provisioned).toBe(true);

    const deployed = await call<DeployResponse>(session, 'deploy_cloud_functions', {});

    // The project genuinely has functions — otherwise every assertion below is
    // vacuously true about an empty list.
    expect(deployed.data.functions.length).toBeGreaterThan(0);
    expect(deployed.data.ok).toBe(true);
    expect(deployed.data.changed).toBe(true);
    expect(deployed.data.functions.every((f) => f.status === 'deployed')).toBe(true);

    // 🔴 The backend agrees it is serving them — read from the BACKEND, not from
    // the deploy's own report of itself. A deploy that reported success about a
    // push that never landed would satisfy every assertion above.
    //
    // ⚠️ Read over HTTP rather than through an MCP tool on purpose: there is no
    // tool for this. `list_backend_workflows` is `/admin/workflow-defs` — the
    // WF-001 definitions, a different subsystem — and using it here would have
    // been an assertion about the wrong population that passed anyway.
    const status = await adminGet(deployed.data.backendId, deployed.data.endpoint, '/admin/workflows');
    expect((status as { functions: unknown[] }).functions.length).toBeGreaterThan(0);

    // ─── AC1's real end: CALL one, and read what comes back ─────────────────
    //
    // 🔴 **`res.ok` is not the criterion, and neither is `!== 404`.** The task's
    // own trap says a function that deployed and a function that answers are two
    // claims, and the weak forms of this assertion pass on both. What separates
    // them is a body only the function's own graph could have produced.
    //
    // `submitContactForm` answers an empty POST with a **validation error naming
    // the three parameters its Request node declares**. That is the graph
    // running: the router found it, the runtime loaded it, and the parameter
    // list the exporter shipped arrived intact. A missing function 404s and a
    // refused one 403s — neither can name `name`, `email` and `message`.
    //
    // ⚠️ Measured, not assumed. The first spelling of this test called
    // `site/SetSectionOrder`, which is a HELPER, not an endpoint: it answered
    // 403 and the assertion `not.toBe(404)` passed — green, and about nothing.
    // The four `site/*` components are deliberately not served (DEF-015 roles),
    // which is why the endpoint list below is 5 and the bundle is 9.
    const endpoint = deployed.data.endpoint;

    const answered = await fetch(`${endpoint}/functions/submitContactForm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    });
    const body = (await answered.json()) as {
      code?: string;
      fields?: { name: string; code: string }[];
    };

    expect(answered.status).toBe(400);
    expect(body.code).toBe('function/bad-request');
    // The parameter names come from the author's Request node, through the
    // exporter, into the runtime. Asserted as a SET rather than as substrings of
    // a message: the prose is the runtime's to reword, the declared interface is
    // not.
    expect((body.fields ?? []).map((f) => f.name).sort()).toEqual(['email', 'message', 'name']);
    expect((body.fields ?? []).every((f) => f.code === 'missing')).toBe(true);

    // The endpoints the backend serves are the endpoint-role components, not all
    // nine — asserted so that a change in either number has to be explained.
    const servingNames = (status as { functions: { name: string }[] }).functions.map((f) => f.name).sort();
    expect(servingNames).toEqual(
      ['claimSite', 'duplicatePage', 'publishPage', 'reorderSection', 'submitContactForm'].sort()
    );

    // 🔴 The fingerprint the deployer computed is the one the backend reports.
    // This is the whole of AC3's mechanism, measured on the artefact: if these
    // ever disagree, every "unchanged" this tool reports is a guess.
    const bundles = (status as { bundles: { name: string; deployFingerprint: string | null }[] }).bundles;
    expect(bundles).toHaveLength(1);
    expect(bundles[0].name).toBe(deployed.data.bundleName);
    expect(bundles[0].deployFingerprint).toBe(deployed.data.hash);
  });

  it('AC3 — the second deploy says so rather than reporting a fresh success', async () => {
    await call(session, 'provision_backend', { name: 'App backend', force: true });

    const first = await call<DeployResponse>(session, 'deploy_cloud_functions', {});
    expect(first.data.changed).toBe(true);
    expect(first.data.functions.every((f) => f.status === 'deployed')).toBe(true);

    const second = await call<DeployResponse>(session, 'deploy_cloud_functions', {});

    // The fingerprint is the same, nothing was pushed, and every function says
    // `unchanged` rather than `deployed` a second time.
    expect(second.data.hash).toBe(first.data.hash);
    expect(second.data.changed).toBe(false);
    expect(second.data.functions.every((f) => f.status === 'unchanged')).toBe(true);
    expect(second.data.functions.length).toBe(first.data.functions.length);

    // ⚠️ And `ok` is still true: "already deployed" is a success, not a failure.
    expect(second.data.ok).toBe(true);

    // 🔴 The known-firing control. Without it, "changed: false" is equally
    // satisfied by a deploy that never worked at all — an idempotency claim that
    // is really a broken-push claim. `force` must still push.
    const forced = await call<DeployResponse>(session, 'deploy_cloud_functions', { force: true });
    expect(forced.data.changed).toBe(true);
    expect(forced.data.functions.every((f) => f.status === 'deployed')).toBe(true);
  });

  it('🔴 deploying does not modify the project on disk', async () => {
    // Reading a project in order to deploy it loads it into a `ProjectModel`,
    // and a model change schedules an autosave whose `doWriteProjectToDisk`
    // calls `project.toDirectory(...)`. `prepareProjectForCloudExport` sets
    // `_isReadOnly` to stop that — and this is the assertion that says it did,
    // because the failure is silent: the deploy succeeds either way and the
    // author's files are simply different afterwards.
    await call(session, 'provision_backend', { name: 'App backend', force: true });

    const before = snapshotTree(projectDir);
    const deployed = await call<DeployResponse>(session, 'deploy_cloud_functions', {});
    // A control: the deploy really did run and really did build the graph.
    expect(deployed.data.functions.length).toBeGreaterThan(0);

    const after = snapshotTree(projectDir);
    expect(after).toEqual(before);
  });
});
