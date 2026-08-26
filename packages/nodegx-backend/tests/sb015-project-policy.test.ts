/**
 * SB-015 — the policy a project carries, built.
 *
 * SB-015's drive (`sb015-default-policy-drive.test.ts`) measured what a person
 * gets today: a template whose product is *what a stranger cannot see*,
 * provisioned onto `defaultSecurityConfig()`, failing in two opposite directions
 * at once. Richard ruled shape 1 — **the template ships a policy file and
 * provisioning applies it**. This is that mechanism.
 *
 * ## What each group here is for
 *
 * **1. The applier**, as a unit: five outcomes, each named rather than collapsed
 * into a boolean, because three of them are "nothing happened" for reasons a
 * caller must report differently. The one that matters is
 * `backend-already-configured` — a correct policy that is not the one being
 * enforced is SB-015's own bug, and the only defence is that here we say so.
 *
 * **2. Through the real service**, because the ordering claim is the whole
 * mechanism: `SecurityState` mints the defaults in its constructor, so a policy
 * applied a moment later would be a correct file on disk that the running
 * process is not enforcing. Nothing about that is visible from a unit test of
 * the applier; it is visible from `devOpenActive` on a started service.
 *
 * **3. The shipped policy against the shipped template**, checked as a census
 * rather than as a copy: every collection the graphs name must have a rule, and
 * every endpoint must have one. The collection list is read **off the generated
 * artefact**, so adding a class to the template with no rule for it reddens here
 * rather than in a browser six sessions later.
 *
 * **4. The two tasks meeting.** The same policy that SB-015 installs is what
 * satisfies SB-016's deploy interlock. One spec asserts both directions of that
 * over a real non-loopback start, and it is the phase-level claim in one
 * reading: a project made from this template deploys; the same project without
 * its policy does not.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../../noodl-mcp/src/server';
import { SB004_COMPONENTS } from '../../noodl-mcp/tests/sb004Components';
import { defaultSecurityConfig, SecurityConfig, validateSecurityConfig } from '../src/security/model';
import {
  applyProjectPolicy,
  BACKEND_POLICY_FILE,
  describeProjectPolicyOutcome,
  PROJECT_POLICY_FILE,
  ProjectPolicyError,
  projectPolicyPath,
  readProjectPolicy
} from '../src/security/projectPolicy';
import { SecurityStartupError } from '../src/security/state';
import { BackendService } from '../src/service';

import { bundleAuthoredComponents, WorkflowBundle } from './helpers/authored-bundle';
import { SITE_SECURITY } from './helpers/site-drive';

jest.setTimeout(300000);

/** The artefact the template ships, read off disk — not the harness's view of it. */
const SHIPPED_POLICY_PATH = path.join(
  __dirname,
  '..',
  '..',
  'noodl-editor',
  'src',
  'editor',
  'src',
  'models',
  'template',
  'templates',
  'site-builder.security.json'
);
const SHIPPED_CONTENT_PATH = path.join(path.dirname(SHIPPED_POLICY_PATH), 'site-builder.content.json');

const temps: string[] = [];
function tmp(label: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `sb015-${label}-`));
  temps.push(dir);
  return dir;
}

/** A project directory carrying (or not carrying) a policy file. */
function makeProject(policy: unknown | null, label = 'project'): string {
  const dir = tmp(label);
  fs.writeFileSync(path.join(dir, 'nodegx.project.json'), JSON.stringify({ name: label }));
  if (policy !== null) {
    fs.writeFileSync(
      path.join(dir, PROJECT_POLICY_FILE),
      typeof policy === 'string' ? policy : JSON.stringify(policy, null, 2)
    );
  }
  return dir;
}

afterAll(() => {
  for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true });
});

// ============================================================================
// 1. The applier
// ============================================================================

describe('SB-015 — applying a project policy', () => {
  it('does nothing when the spawner knows no project', () => {
    const dataDir = tmp('nodir-data');
    expect(applyProjectPolicy({ projectDir: null, dataDir })).toEqual({ status: 'no-project-dir' });
    expect(fs.existsSync(path.join(dataDir, BACKEND_POLICY_FILE))).toBe(false);
  });

  it('does nothing when the project ships no policy — the ordinary case, and silent', () => {
    const projectDir = makeProject(null, 'nopolicy');
    const dataDir = tmp('nopolicy-data');
    const outcome = applyProjectPolicy({ projectDir, dataDir });
    expect(outcome.status).toBe('no-policy-file');
    expect(fs.existsSync(path.join(dataDir, BACKEND_POLICY_FILE))).toBe(false);
    expect(describeProjectPolicyOutcome(outcome)).toBeNull();
  });

  it('installs a valid policy into a backend that has none', () => {
    const projectDir = makeProject(SITE_SECURITY, 'apply');
    const dataDir = tmp('apply-data');
    const outcome = applyProjectPolicy({ projectDir, dataDir });
    expect(outcome.status).toBe('applied');
    const written = JSON.parse(fs.readFileSync(path.join(dataDir, BACKEND_POLICY_FILE), 'utf-8'));
    expect(written).toEqual(SITE_SECURITY);
  });

  it('🔴 NEVER overwrites a backend policy that already exists, and says so', () => {
    // The rule the container entrypoint has followed since WF-003, for the same
    // reason: a `security.json` that is there is somebody's, and a mechanism that
    // silently replaced it would be a way for a shared project to relax a posture
    // its recipient set deliberately.
    const projectDir = makeProject(SITE_SECURITY, 'existing');
    const dataDir = tmp('existing-data');
    const mine: SecurityConfig = { ...defaultSecurityConfig(), devOpen: false, signup: 'nobody' };
    fs.writeFileSync(path.join(dataDir, BACKEND_POLICY_FILE), JSON.stringify(mine, null, 2));

    const outcome = applyProjectPolicy({ projectDir, dataDir });
    expect(outcome.status).toBe('backend-already-configured');
    expect(JSON.parse(fs.readFileSync(path.join(dataDir, BACKEND_POLICY_FILE), 'utf-8'))).toEqual(mine);
  });

  it('…and that outcome is never silent — it is SB-015’s own bug with the lights on', () => {
    const projectDir = makeProject(SITE_SECURITY, 'loud');
    const dataDir = tmp('loud-data');
    fs.writeFileSync(path.join(dataDir, BACKEND_POLICY_FILE), JSON.stringify(defaultSecurityConfig()));
    const notice = describeProjectPolicyOutcome(applyProjectPolicy({ projectDir, dataDir }))!;
    expect(notice).toContain(PROJECT_POLICY_FILE);
    expect(notice).toContain('never overwritten');
    expect(notice).toContain('The running policy is the');
  });

  it('refuses an unparseable policy rather than falling back to the defaults', () => {
    const projectDir = makeProject('{ not json', 'badjson');
    const dataDir = tmp('badjson-data');
    try {
      applyProjectPolicy({ projectDir, dataDir });
      throw new Error('expected a refusal');
    } catch (e) {
      expect(e).toBeInstanceOf(ProjectPolicyError);
      expect((e as ProjectPolicyError).code).toBe('PROJECT_POLICY_INVALID');
      expect((e as Error).message).toContain(projectPolicyPath(projectDir));
    }
    expect(fs.existsSync(path.join(dataDir, BACKEND_POLICY_FILE))).toBe(false);
  });

  it('refuses a well-formed JSON file that is not a valid policy, listing what is wrong', () => {
    // 🔴 Same validator as `security.json`, so there is one grammar. A typo'd
    // rule that silently no-ops is the accept-and-ignore shape this model bans.
    const projectDir = makeProject({ ...defaultSecurityConfig(), nonsense: true }, 'badshape');
    const dataDir = tmp('badshape-data');
    expect(() => applyProjectPolicy({ projectDir, dataDir })).toThrow(/unknown top-level key "nonsense"/);
  });

  it('reads back exactly what a valid policy says (known-firing control for the refusals)', () => {
    // Without this, "it threw" above is consistent with a reader that throws on
    // everything. This is the same code path on a good file.
    const projectDir = makeProject(SITE_SECURITY, 'good');
    expect(readProjectPolicy(projectDir)).toEqual(SITE_SECURITY);
    expect(readProjectPolicy(makeProject(null, 'none'))).toBeNull();
  });
});

// ============================================================================
// 2. Through the real service — the ordering claim
// ============================================================================

describe('SB-015 — a service started for a project', () => {
  async function start(projectDir: string | null, label: string) {
    const dataDir = tmp(`${label}-data`);
    const svc = new BackendService({
      dataDir,
      port: 0,
      backendId: `sb015-${label}`,
      backendName: label,
      ...(projectDir ? { projectDir } : {})
    });
    return { svc, dataDir, started: await svc.start() };
  }

  it('🔴 runs the project’s policy, not the defaults — enforcement is ON from the first start', async () => {
    // The reading that proves the ordering. `devOpenActive` is computed by the
    // SecurityState constructed two lines after the applier runs; if the policy
    // landed even one step later this would be `true` and the file on disk would
    // still look right.
    const projectDir = makeProject(SITE_SECURITY, 'enforced');
    const { svc, dataDir, started } = await start(projectDir, 'enforced');
    try {
      expect(started.security.enforced).toBe(true);
      expect(started.security.devOpen).toBe(false);
      // 🔴 …and `migratedThisStart` is FALSE: the backend did not mint anything,
      // it read the file the applier had already put there. A `true` here would
      // mean the defaults won the race and the policy landed afterwards.
      expect(started.security.migratedThisStart).toBe(false);
      expect(JSON.parse(fs.readFileSync(path.join(dataDir, BACKEND_POLICY_FILE), 'utf-8'))).toEqual(SITE_SECURITY);
    } finally {
      await svc.stop();
    }
  });

  it('mints the defaults when no project is supplied (the control this is measured against)', async () => {
    const { svc, dataDir, started } = await start(null, 'defaults');
    try {
      expect(started.security.enforced).toBe(false);
      expect(started.security.migratedThisStart).toBe(true);
      expect(JSON.parse(fs.readFileSync(path.join(dataDir, BACKEND_POLICY_FILE), 'utf-8'))).toEqual(
        defaultSecurityConfig()
      );
    } finally {
      await svc.stop();
    }
  });

  it('refuses to start on an invalid project policy rather than quietly running the defaults', async () => {
    const projectDir = makeProject({ ...defaultSecurityConfig(), collections: { Page: { permissions: { find: 'sudo' } } } }, 'badrule');
    const dataDir = tmp('badrule-data');
    const svc = new BackendService({ dataDir, port: 0, backendId: 'sb015-badrule', backendName: 'x', projectDir });
    await expect(svc.start()).rejects.toBeInstanceOf(ProjectPolicyError);
    // 🔴 And it left nothing behind — a half-applied policy would be worse than none.
    expect(fs.existsSync(path.join(dataDir, BACKEND_POLICY_FILE))).toBe(false);
  });

  it('is idempotent across restarts — the second start finds its own file and changes nothing', async () => {
    const projectDir = makeProject(SITE_SECURITY, 'restart');
    const dataDir = tmp('restart-data');
    for (const pass of [1, 2]) {
      const svc = new BackendService({
        dataDir,
        port: 0,
        backendId: 'sb015-restart',
        backendName: `pass ${pass}`,
        projectDir
      });
      const started = await svc.start();
      expect(started.security.enforced).toBe(true);
      expect(started.security.migratedThisStart).toBe(false);
      await svc.stop();
    }
    expect(JSON.parse(fs.readFileSync(path.join(dataDir, BACKEND_POLICY_FILE), 'utf-8'))).toEqual(SITE_SECURITY);
  });
});

// ============================================================================
// 3. The shipped policy, against the shipped template
// ============================================================================

describe('SB-015 — the policy Site Builder ships', () => {
  const shipped = JSON.parse(fs.readFileSync(SHIPPED_POLICY_PATH, 'utf-8')) as SecurityConfig;

  /** Every collection the generated template's graphs actually name. */
  function collectionsInTemplate(): string[] {
    const content = JSON.parse(fs.readFileSync(SHIPPED_CONTENT_PATH, 'utf-8')) as {
      components: { name: string; graph?: { roots?: Record<string, unknown>[] } }[];
    };
    const names = new Set<string>();
    const walk = (nodes: Record<string, unknown>[] | undefined) => {
      for (const node of nodes || []) {
        const params = (node.parameters as Record<string, unknown>) || {};
        for (const key of ['collectionName', 'collectionId', 'storageCollectionName']) {
          if (typeof params[key] === 'string') names.add(params[key] as string);
        }
        walk(node.children as Record<string, unknown>[] | undefined);
      }
    };
    for (const c of content.components) walk(c.graph?.roots);
    return [...names].sort();
  }

  it('is a valid security config by the backend’s own validator', () => {
    expect(validateSecurityConfig(shipped)).toEqual([]);
  });

  it('is the ONE copy — the drive harness reads this same file', () => {
    // 🔴 SITE_SECURITY used to be a typed constant in a test helper, which meant
    // SB-008 measured a publication boundary produced by a file no project could
    // ever receive. Assert the identity rather than assume the import.
    expect(SITE_SECURITY).toEqual(shipped);
  });

  it('🔴 covers every collection the template’s graphs name, read off the artefact', () => {
    // Not a hand-typed list: the class model is read out of the generated
    // content, so a `Section` added to the template with no rule here reddens.
    const inTemplate = collectionsInTemplate();
    expect(inTemplate.length).toBeGreaterThan(0);
    expect(Object.keys(shipped.collections).sort()).toEqual(inTemplate);
  });

  it('🔴 covers every endpoint the template declares — which is what satisfies SB-016', () => {
    const endpoints = SB004_COMPONENTS.filter((c) => !c.path.startsWith('#__cloud__/site/')).map((c) =>
      c.path.replace('#__cloud__/', '')
    );
    expect(endpoints.sort()).toEqual(Object.keys(shipped.functions).sort());
  });

  it('holds SB-004 §4’s boundary: public read, role:admin write, ContactMessage create nobody', () => {
    for (const name of ['Page', 'Section', 'Theme', 'SiteSettings']) {
      expect(shipped.collections[name].permissions).toEqual({
        find: 'public',
        get: 'public',
        create: 'role:admin',
        update: 'role:admin',
        delete: 'role:admin'
      });
    }
    expect(shipped.collections.ContactMessage.permissions!.create).toBe('nobody');
    expect(shipped.collections.ContactMessage.permissions!.find).toBe('role:admin');
  });

  it('🔴 gives the two privileged endpoints role:admin — the rule the graph port cannot express', () => {
    expect(shipped.functions.publishPage.call).toBe('role:admin');
    expect(shipped.functions.duplicatePage.call).toBe('role:admin');
    // …and does not over-tighten the two that are legitimately open.
    expect(shipped.functions.submitContactForm.call).toBe('public');
    expect(shipped.functions.claimSite.call).toBe('authenticated');
  });

  it('⚠️ sets devOpen false, so the boundary is on locally too — the cost is stated, not hidden', () => {
    // SB-015 §3's ⚠️: applying a policy does not by itself decide the local case.
    // This template's answer is "verbatim", and what it costs is that an author
    // is an anonymous visitor to their own machine until `claimSite` runs. See
    // SB-015 §6 and `projectPolicy.ts`'s header.
    expect(shipped.devOpen).toBe(false);
    expect(shipped.defaults.creatorOwns).toBe(false);
  });
});

// ============================================================================
// 4. SB-015 and SB-016 meeting: does a project made from this template deploy?
// ============================================================================

describe('SB-015 + SB-016 — the same project, with and without its policy', () => {
  let projectDir = '';
  let bundle: WorkflowBundle;

  beforeAll(async () => {
    const fixture = path.join(__dirname, '..', '..', 'noodl-mcp', 'tests', 'fixtures', 'demo-app');
    projectDir = tmp('deploy-project');
    fs.cpSync(fixture, projectDir, { recursive: true });

    const { server } = createServer({ projectDir, allowWrites: true });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'sb015-deploy', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    for (const component of SB004_COMPONENTS) {
      const res = (await client.callTool({
        name: 'create_component',
        arguments: { path: component.path, nodes: component.nodes, connections: component.connections }
      })) as { isError?: boolean; content: Array<{ type: string; text: string }> };
      if (res.isError) throw new Error(`create_component ${component.path} refused:\n${res.content?.[0]?.text}`);
    }
    await client.close();
    await server.close();

    bundle = bundleAuthoredComponents(
      projectDir,
      SB004_COMPONENTS.map((c) => c.key)
    );
  });

  /** A deployed data dir: the bundle, and whatever the project's policy turns out to be. */
  function deployDir(label: string): string {
    const dataDir = tmp(`${label}-deploy`);
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflows', 'site.workflow.json'), JSON.stringify(bundle));
    return dataDir;
  }

  it('🔴 WITHOUT its policy, a non-loopback deploy refuses — SB-016’s interlock, on a real project', async () => {
    // The project as it shipped before this session: no `nodegx.security.json`,
    // so the backend mints the defaults and every endpoint resolves from its
    // graph port. Two of those four resolutions are wrong and one of them is the
    // stranger-publishes-your-draft path SB-015's drive measured.
    fs.rmSync(path.join(projectDir, PROJECT_POLICY_FILE), { force: true });
    const dataDir = deployDir('nopolicy');
    // devOpen must be off, or the OLDER interlock answers first and this measures that.
    fs.writeFileSync(
      path.join(dataDir, BACKEND_POLICY_FILE),
      JSON.stringify({ ...defaultSecurityConfig(), devOpen: false }, null, 2)
    );
    const svc = new BackendService({
      dataDir,
      port: 0,
      host: '0.0.0.0',
      backendId: 'sb015-nopolicy',
      backendName: 'no policy',
      projectDir
    });
    await expect(svc.start()).rejects.toMatchObject({ code: 'UNDECLARED_FUNCTION_ON_PUBLIC_BIND' });
  });

  it('🔴 WITH its policy, the same project deploys — one file is the whole difference', async () => {
    // Same bundle, same host, same everything. The project now carries the file
    // the template ships, provisioning applies it, and SB-016's interlock is
    // satisfied because the policy declares all four endpoints.
    fs.copyFileSync(SHIPPED_POLICY_PATH, path.join(projectDir, PROJECT_POLICY_FILE));
    const dataDir = deployDir('withpolicy');
    const svc = new BackendService({
      dataDir,
      port: 0,
      host: '0.0.0.0',
      backendId: 'sb015-withpolicy',
      backendName: 'with policy',
      projectDir
    });
    try {
      const started = await svc.start();
      expect(started.security.enforced).toBe(true);
      const running = JSON.parse(fs.readFileSync(path.join(dataDir, BACKEND_POLICY_FILE), 'utf-8'));
      expect(running.functions.publishPage.call).toBe('role:admin');
    } finally {
      await svc.stop();
    }
  });

  it('…and the refusal it replaced is not merely absent — the defaults still refuse beside it', async () => {
    // 🔴 The pair above proves a difference only if the negative arm still fires
    // in this same run. An absence asserted alone is consistent with the
    // interlock having been switched off between the two specs.
    const dataDir = deployDir('control');
    fs.writeFileSync(
      path.join(dataDir, BACKEND_POLICY_FILE),
      JSON.stringify({ ...defaultSecurityConfig(), devOpen: false }, null, 2)
    );
    const svc = new BackendService({
      dataDir,
      port: 0,
      host: '0.0.0.0',
      backendId: 'sb015-control',
      backendName: 'control',
      projectDir: null
    });
    await expect(svc.start()).rejects.toBeInstanceOf(SecurityStartupError);
  });
});
