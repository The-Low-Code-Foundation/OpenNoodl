/**
 * SB-016 — the deploy interlock for endpoints no rule names.
 *
 * SB-015's drive measured the consequence: on a backend with the shipped
 * defaults and `devOpen: false`, **a stranger signs up and publishes the
 * owner's draft**, and the call runs as system. The cause is an asymmetry
 * between two gates in one file — an undeclared *collection* falls back to
 * `defaults.permissions` and fails shut, an undeclared *function* falls back to
 * the graph's own `Allow Unauthenticated` port and has no defaults tier to fall
 * back to at all.
 *
 * Richard ruled disposition 2: **the deploy interlock refuses.** This file is
 * that interlock, and it is organised around the two things the ruling left
 * open.
 *
 * ## 1. The predicate, which §4 said to measure before choosing
 *
 * §4 offered a narrow candidate — *refuse only where the port resolves to
 * `authenticated`* — on the strength of a claim that on this template it
 * "refuses exactly the two that are wrong". 🔴 **It does not, and this file is
 * where that claim dies.** `claimSite` is unticked, so it resolves to
 * `authenticated` from the port, and `authenticated` is exactly what SB-004 §4
 * wants for it. The narrow predicate refuses three of four.
 *
 * That is not a detail. It means **no deploy-time predicate discriminates
 * right from wrong here**, because what separates `claimSite` from
 * `publishPage` is an intention that exists in neither the port nor the config.
 * The measurement is below as a table over the real bundle, both candidates
 * scored against SB-004 §4's policy, so the next reader can check the reasoning
 * rather than inherit the conclusion.
 *
 * ## 2. The message, which is the actual feature
 *
 * SB-015 F24: an author was told *"That page could not be found"* about a page
 * they had just published. A refusal that said only *some function is
 * unresolved* would reproduce that one layer up, at the moment somebody is
 * shipping. So the message is graded like code: every endpoint named, the
 * `functions` block pasteable, the pasted block **valid**, **behaviour-
 * preserving**, and **sufficient** — asserted by starting the service again
 * with it.
 *
 * ## What the instrument is
 *
 * The real template's cloud half, authored through the real MCP door, bundled
 * the way a deploy bundles it, and started through `BackendService.start()` on a
 * non-loopback host. Nothing here is a hand-typed endpoint list: the numbers in
 * §1's table are read off the artefact SB-007 ships.
 */
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../../noodl-mcp/src/server';
import { SB004_COMPONENTS } from '../../noodl-mcp/tests/sb004Components';
import {
  defaultSecurityConfig,
  effectiveFunctionRule,
  proposedFunctionsBlock,
  RuleValue,
  SecurityConfig,
  unresolvedFunctionRules,
  validateSecurityConfig
} from '../src/security/model';
import { SecurityStartupError } from '../src/security/state';
import { BackendService } from '../src/service';
import { ExecutionHistory } from '../src/execution/ExecutionStore';
import { scanDeployedFunctions } from '../src/workflow/functionDeclarations';
import { WorkflowRunner } from '../src/workflow/WorkflowRunner';

import { bundleAuthoredComponents, WorkflowBundle } from './helpers/authored-bundle';
import { SITE_SECURITY } from './helpers/site-drive';

jest.setTimeout(300000);

/** Arm C of SB-015's drive: the state the `devOpen` refusal's own instruction produces. */
const ARM_C: SecurityConfig = { ...defaultSecurityConfig(), devOpen: false };

/**
 * SB-004 §4's intended `call` rule per endpoint, lifted from the shared harness
 * rather than retyped — the two predicates below are scored against it, and a
 * second copy of the answer key is the copy that drifts.
 */
const INTENDED: Record<string, RuleValue> = Object.fromEntries(
  Object.entries(SITE_SECURITY.functions as Record<string, { call: string }>).map(([name, r]) => [
    name,
    r.call as RuleValue
  ])
);

let projectDir = '';
let bundle: WorkflowBundle;
let dataDir = '';

/** A port nothing is listening on, released before it is used. */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = (probe.address() as net.AddressInfo).port;
      probe.close(() => resolve(port));
    });
  });
}

/** Can this process bind that port? True = the service left no listener behind. */
async function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '0.0.0.0', () => probe.close(() => resolve(true)));
  });
}

/** The template's cloud half, through the real door. `src`, not the stale dist. */
async function authorCloudHalf(): Promise<string> {
  const fixture = path.join(__dirname, '..', '..', 'noodl-mcp', 'tests', 'fixtures', 'demo-app');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb016-authored-'));
  fs.cpSync(fixture, dir, { recursive: true });

  const { server } = createServer({ projectDir: dir, allowWrites: true });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'sb016-run', version: '0.0.0' });
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
  return dir;
}

/** A data dir holding the deployed bundle, and the given policy — or none at all. */
function makeDataDir(security: Record<string, unknown> | null, label: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `sb016-${label}-`));
  fs.mkdirSync(path.join(dir, 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'workflows', 'site.workflow.json'), JSON.stringify(bundle));
  if (security !== null) fs.writeFileSync(path.join(dir, 'security.json'), JSON.stringify(security, null, 2));
  return dir;
}

/**
 * Start a service and report what happened, never throwing.
 *
 * 🔴 Every arm here is *expected* to fail in some configuration, so a helper
 * that threw would report the measurement as a broken harness. The port is
 * chosen rather than `0` so the "did it listen?" question can be asked after
 * the refusal — see the spec that asks it.
 */
async function tryStart(
  security: Record<string, unknown> | null,
  host: string,
  label: string
): Promise<{ started: boolean; code: string | null; message: string; port: number; stop: () => Promise<void> }> {
  const dir = makeDataDir(security, label);
  const port = await freePort();
  const svc = new BackendService({ dataDir: dir, port, host, backendId: `sb016-${label}`, backendName: label });
  try {
    await svc.start();
    return { started: true, code: null, message: '', port, stop: () => svc.stop() };
  } catch (e) {
    const err = e as SecurityStartupError;
    return {
      started: false,
      code: err instanceof SecurityStartupError ? err.code : null,
      message: err.message || String(e),
      port,
      stop: async () => {
        /* nothing started */
      }
    };
  }
}

describe('SB-016 — the gate with no defaults tier', () => {
  beforeAll(async () => {
    projectDir = await authorCloudHalf();
    bundle = bundleAuthoredComponents(
      projectDir,
      SB004_COMPONENTS.map((c) => c.key)
    );
    dataDir = makeDataDir(ARM_C, 'scan');
  });

  afterAll(() => {
    for (const dir of [projectDir, dataDir]) {
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // ==========================================================================
  // 1. The scan, and that it agrees with the thing it gates
  // ==========================================================================

  describe('the endpoint scan', () => {
    it('finds the template’s four endpoints off the deployed bundle, by name', () => {
      const found = scanDeployedFunctions(path.join(dataDir, 'workflows'));
      expect(found.map((f) => f.name).sort()).toEqual([
        'claimSite',
        'duplicatePage',
        'publishPage',
        'submitContactForm'
      ]);
    });

    it('reads each one’s Allow Unauthenticated port off the graph', () => {
      const found = scanDeployedFunctions(path.join(dataDir, 'workflows'));
      const byName = Object.fromEntries(found.map((f) => [f.name, f.allowNoAuth]));
      // 🔴 The values SB-016 §3's table states. Read here rather than asserted
      // from the task file — §3 is a claim about an artefact, and this is it.
      expect(byName).toEqual({
        submitContactForm: true,
        claimSite: false,
        publishPage: false,
        duplicatePage: false
      });
    });

    it('excludes helpers, and the bundle really contains some (known-firing)', () => {
      // Without this arm, "no helpers in the list" is satisfied by a bundle that
      // has none — which is a different claim entirely. SB-003's rule is that a
      // `/#__cloud__/` component with no Request node is not an endpoint, and
      // three of this template's seven cloud components are exactly that.
      const helpers = SB004_COMPONENTS.filter((c) => c.path.startsWith('#__cloud__/site/')).map((c) =>
        c.path.replace('#__cloud__/', '')
      );
      expect(helpers).toEqual(['site/SetSectionAccess', 'site/CopySectionToPage', 'site/ContactRecipient']);

      const found = scanDeployedFunctions(path.join(dataDir, 'workflows')).map((f) => f.name);
      for (const helper of helpers) expect(found).not.toContain(helper);
      expect(found).toHaveLength(4);
      // …and they are in the bundle, so the exclusion is a filter and not an absence.
      const bundled = bundle.components.map((c) => c.name);
      for (const helper of helpers) expect(bundled).toContain(`/#__cloud__/${helper}`);
    });

    it('agrees with the WorkflowRunner it gates — same names, same workflow, same port', async () => {
      // 🔴 The anti-drift check. The interlock reads bundles off disk at startup
      // step 1.5; the runner reads them into memory at step 5. Two answers to
      // "what is an endpoint" is how a gate starts refusing a deploy over a name
      // nothing serves. They share a predicate; this asserts the sharing works
      // rather than trusting that it must.
      const runner = new WorkflowRunner({
        workflowsPath: path.join(dataDir, 'workflows'),
        executions: new ExecutionHistory(dataDir),
        backendId: 'sb016-agree',
        backendName: 'SB-016 agreement'
      });
      await runner.initialize();
      await runner.loadWorkflows();

      const scanned = scanDeployedFunctions(path.join(dataDir, 'workflows'));
      const fromRunner = runner.getAvailableFunctions();
      expect(fromRunner.map((f) => `${f.workflow}:${f.name}`).sort()).toEqual(
        scanned.map((f) => `${f.workflow}:${f.name}`).sort()
      );
      for (const fn of scanned) {
        expect(runner.functionAllowsNoAuth(fn.name)).toBe(fn.allowNoAuth);
      }
    });

    it('answers [] for a data directory with no workflows at all', () => {
      const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'sb016-empty-'));
      try {
        expect(scanDeployedFunctions(path.join(empty, 'workflows'))).toEqual([]);
      } finally {
        fs.rmSync(empty, { recursive: true, force: true });
      }
    });
  });

  // ==========================================================================
  // 2. The predicate §4 left open — measured, and §4's stated reason is wrong
  // ==========================================================================

  describe('choosing the predicate', () => {
    /** What each candidate would refuse, over the real bundle under arm C. */
    function score() {
      const deployed = scanDeployedFunctions(path.join(dataDir, 'workflows'));
      const broad = unresolvedFunctionRules(ARM_C, deployed);
      const narrow = broad.filter((f) => f.rule === 'authenticated');
      const wrong = deployed
        .filter((f) => effectiveFunctionRule(ARM_C, f.name, f.allowNoAuth).rule !== INTENDED[f.name])
        .map((f) => f.name)
        .sort();
      return { broad: broad.map((f) => f.name).sort(), narrow: narrow.map((f) => f.name).sort(), wrong };
    }

    it('two of the four endpoints land on the wrong rule, and they are the privileged pair', () => {
      expect(score().wrong).toEqual(['duplicatePage', 'publishPage']);
    });

    it('🔴 the narrow candidate does NOT refuse exactly those two — it refuses three', () => {
      // SB-016 §4: "of this template's four endpoints, that predicate refuses
      // exactly the two that are wrong." Measured, it refuses claimSite too,
      // whose port-derived `authenticated` is precisely what SB-004 §4 wants.
      const { narrow, wrong } = score();
      expect(narrow).toEqual(['claimSite', 'duplicatePage', 'publishPage']);
      expect(narrow).not.toEqual(wrong);
      expect(INTENDED.claimSite).toBe('authenticated');
    });

    it('🔴 and neither candidate discriminates — the broad one refuses all four', () => {
      // Which is the finding, not a defect in either candidate: what separates
      // claimSite from publishPage is an intention that exists in neither the
      // graph port nor the config, so no startup-time predicate can read it.
      const { broad, wrong } = score();
      expect(broad).toEqual(['claimSite', 'duplicatePage', 'publishPage', 'submitContactForm']);
      expect(broad).not.toEqual(wrong);
    });

    it('the narrow candidate would have exempted the only endpoint a stranger can reach', () => {
      // The reason the broad predicate ships. The endpoints `narrow` waves
      // through are exactly the ones resolving to `public` — reachable with no
      // account at all — which is the surface an interlock exists to make
      // somebody re-affirm, not the surface it should be silent about.
      const { broad, narrow } = score();
      const exempted = broad.filter((n) => !narrow.includes(n));
      expect(exempted).toEqual(['submitContactForm']);
      const deployed = scanDeployedFunctions(path.join(dataDir, 'workflows'));
      for (const name of exempted) {
        const fn = deployed.find((d) => d.name === name)!;
        expect(effectiveFunctionRule(ARM_C, fn.name, fn.allowNoAuth).rule).toBe('public');
      }
    });

    it('a fully-declared config leaves nothing unresolved (the shipped predicate’s zero)', () => {
      const deployed = scanDeployedFunctions(path.join(dataDir, 'workflows'));
      expect(unresolvedFunctionRules(SITE_SECURITY as unknown as SecurityConfig, deployed)).toEqual([]);
    });

    it('a partially-declared config names only the endpoints still undeclared', () => {
      const deployed = scanDeployedFunctions(path.join(dataDir, 'workflows'));
      const partial: SecurityConfig = { ...ARM_C, functions: { publishPage: { call: 'role:admin' } } };
      expect(unresolvedFunctionRules(partial, deployed).map((f) => f.name)).toEqual([
        'claimSite',
        'duplicatePage',
        'submitContactForm'
      ]);
    });

    it('🔴 converts SB-016 §5’s one derived row into a measured one', () => {
      // §5 recorded `duplicatePage` as derived rather than driven: one endpoint
      // was called by a stranger and the other was stated from the source. Its
      // port is now read off the same artefact by the same scan as publishPage's,
      // so the two rows have the same provenance.
      const deployed = scanDeployedFunctions(path.join(dataDir, 'workflows'));
      const dup = deployed.find((f) => f.name === 'duplicatePage')!;
      const pub = deployed.find((f) => f.name === 'publishPage')!;
      expect(dup.allowNoAuth).toBe(pub.allowNoAuth);
      expect(effectiveFunctionRule(ARM_C, dup.name, dup.allowNoAuth)).toEqual(
        expect.objectContaining({ rule: 'authenticated', source: 'graph' })
      );
    });
  });

  // ==========================================================================
  // 3. The interlock, through the real startup path
  // ==========================================================================

  describe('the interlock', () => {
    it('refuses a non-loopback bind when endpoints resolve only from the graph port', async () => {
      const run = await tryStart(ARM_C, '0.0.0.0', 'refused');
      expect(run.started).toBe(false);
      expect(run.code).toBe('UNDECLARED_FUNCTION_ON_PUBLIC_BIND');
    });

    it('🔴 refuses BEFORE anything listens — an interlock that fires after the port is open is not one', async () => {
      // The HTTP server comes up at startup step 3 and the WorkflowRunner at
      // step 5. Reading the bundles off disk at step 1.5 is the whole reason
      // this does not use the runner, and this is the reading that says so.
      const run = await tryStart(ARM_C, '0.0.0.0', 'noport');
      expect(run.started).toBe(false);
      expect(await portIsFree(run.port)).toBe(true);
    });

    it('starts on the same bind once every endpoint is declared', async () => {
      const run = await tryStart(SITE_SECURITY, '0.0.0.0', 'declared');
      try {
        expect(run.code).toBeNull();
        expect(run.started).toBe(true);
      } finally {
        await run.stop();
      }
    });

    it('does NOT refuse on loopback — it is the bind that matters, not the config', async () => {
      // The known-firing control for every "it started" reading above: the same
      // undeclared config that refuses at 0.0.0.0 starts at 127.0.0.1, so the
      // difference is the interlock and not something else about arm C.
      const run = await tryStart(ARM_C, '127.0.0.1', 'loopback');
      try {
        expect(run.started).toBe(true);
      } finally {
        await run.stop();
      }
    });

    it('leaves the dev-open interlock in front of it — that one still answers first', async () => {
      // Order matters for the message: a deployer with devOpen on AND nothing
      // declared has two problems, and being told about the functions while
      // dev-open is still disabling every gate would be advice for a state they
      // are not in.
      const run = await tryStart(defaultSecurityConfig(), '0.0.0.0', 'devopen');
      expect(run.started).toBe(false);
      expect(run.code).toBe('DEV_OPEN_ON_PUBLIC_BIND');
    });

    it('does not refuse a non-loopback backend that serves no functions at all', async () => {
      // A data dir with no `workflows/` is most backends, and the scan answers
      // `[]` for it — which must read as "nothing to declare", not as a refusal.
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb016-nofns-'));
      fs.writeFileSync(path.join(dir, 'security.json'), JSON.stringify(ARM_C, null, 2));
      const port = await freePort();
      const svc = new BackendService({ dataDir: dir, port, host: '0.0.0.0', backendId: 'sb016-nofns', backendName: 'x' });
      try {
        await expect(svc.start()).resolves.toBeDefined();
      } finally {
        await svc.stop();
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  // ==========================================================================
  // 4. The message, graded like code — because it IS the feature
  // ==========================================================================

  describe('the refusal message', () => {
    let message = '';

    beforeAll(async () => {
      message = (await tryStart(ARM_C, '0.0.0.0', 'message')).message;
      expect(message).not.toBe('');
    });

    it('names every unresolved endpoint, not "some function"', () => {
      for (const name of ['publishPage', 'duplicatePage', 'submitContactForm', 'claimSite']) {
        expect(message).toContain(name);
      }
      expect(message).toContain('4 cloud functions');
    });

    it('says what each endpoint currently resolves to and where that came from', () => {
      expect(message).toContain('"Allow Unauthenticated" is unticked');
      expect(message).toContain('"Allow Unauthenticated" is TICKED');
      expect(message).toContain('"authenticated"');
      expect(message).toContain('"public"');
    });

    it('flags the endpoint anyone on the internet can call', () => {
      const contactLine = message.split('\n').find((l) => l.includes('submitContactForm'))!;
      expect(contactLine).toContain('callable by anyone on the internet');
      // …and does not say it about the ones that need an account.
      const publishLine = message.split('\n').find((l) => l.includes('publishPage'))!;
      expect(publishLine).not.toContain('callable by anyone');
    });

    it('names the file to edit, by path', () => {
      expect(message).toContain('security.json');
      expect(message).toMatch(/sb016-message-[^\s]*security\.json/);
    });

    it('explains the asymmetry that caused this — no defaults tier, and it runs as system', () => {
      expect(message).toContain('does NOT fall back to "defaults"');
      expect(message).toContain('runs as system');
      expect(message).toContain('cannot say "role:admin"');
    });

    it('says what to do next, and that "authenticated" is not a privilege boundary', () => {
      expect(message).toContain('role:admin');
      expect(message).toContain('any account that can sign up');
      expect(message).toContain('bind to 127.0.0.1');
    });

    it('carries a functions block that is parseable JSON', () => {
      const block = extractBlock(message);
      expect(Object.keys(block.functions).sort()).toEqual([
        'claimSite',
        'duplicatePage',
        'publishPage',
        'submitContactForm'
      ]);
    });

    it('🔴 the pasted block preserves what is enforced right now — it records, it does not change', () => {
      // The property that makes this refusal safe to satisfy under pressure. If
      // pasting it silently tightened publishPage, a deployer would ship a
      // behaviour change they did not choose while trying to satisfy a gate.
      const block = extractBlock(message);
      const pasted: SecurityConfig = { ...ARM_C, functions: block.functions };
      for (const fn of scanDeployedFunctions(path.join(dataDir, 'workflows'))) {
        const before = effectiveFunctionRule(ARM_C, fn.name, fn.allowNoAuth);
        const after = effectiveFunctionRule(pasted, fn.name, fn.allowNoAuth);
        expect(after.rule).toBe(before.rule);
        expect(after.source).toBe('configured');
      }
    });

    it('the pasted block is a VALID security config, not merely valid JSON', () => {
      const block = extractBlock(message);
      expect(validateSecurityConfig({ ...ARM_C, functions: block.functions })).toEqual([]);
    });

    it('🔴 and it is SUFFICIENT — the same service starts with it pasted in', async () => {
      // The reading that separates a helpful message from a plausible one. Every
      // assertion above is about text; this one is about whether following the
      // text gets you out.
      const block = extractBlock(message);
      const run = await tryStart({ ...ARM_C, functions: block.functions }, '0.0.0.0', 'pasted');
      try {
        expect(run.code).toBeNull();
        expect(run.started).toBe(true);
      } finally {
        await run.stop();
      }
    });

    it('🔴 merges rather than replaces — a partially-declared config keeps its declarations', async () => {
      // A deployer with three endpoints declared and one not, who pastes a
      // one-key block over the top, has just undeclared the other three. The
      // block therefore carries every entry, including the ones already correct.
      const partial = { ...ARM_C, functions: { publishPage: { call: 'role:admin' as RuleValue } } };
      const run = await tryStart(partial, '0.0.0.0', 'partial');
      expect(run.started).toBe(false);
      const block = extractBlock(run.message);
      expect(block.functions.publishPage).toEqual({ call: 'role:admin' });
      expect(Object.keys(block.functions).sort()).toEqual([
        'claimSite',
        'duplicatePage',
        'publishPage',
        'submitContactForm'
      ]);
      // …and the message names only what is still missing.
      expect(run.message).toContain('3 cloud functions');
    });

    it('preserves sibling fields on an entry that has a rule but no call', () => {
      // `{ timeoutMs: 5000 }` with no `call` is unresolved — the rule still comes
      // from the port — and the block must not throw the timeout away fixing it.
      const withTimeout: SecurityConfig = { ...ARM_C, functions: { claimSite: { timeoutMs: 5000 } } };
      const deployed = scanDeployedFunctions(path.join(dataDir, 'workflows'));
      const unresolved = unresolvedFunctionRules(withTimeout, deployed);
      expect(unresolved.map((f) => f.name)).toContain('claimSite');
      const block = JSON.parse(proposedFunctionsBlock(withTimeout, unresolved)) as {
        functions: Record<string, Record<string, unknown>>;
      };
      expect(block.functions.claimSite).toEqual({ timeoutMs: 5000, call: 'authenticated' });
    });
  });
});

/** The `{ "functions": … }` object out of a refusal message. */
function extractBlock(message: string): { functions: Record<string, Record<string, unknown>> } {
  const start = message.indexOf('{\n  "functions"');
  expect(start).toBeGreaterThan(-1);
  // The block is the last brace-balanced object starting there; scan for its end.
  let depth = 0;
  for (let i = start; i < message.length; i++) {
    if (message[i] === '{') depth++;
    else if (message[i] === '}') {
      depth--;
      if (depth === 0) return JSON.parse(message.slice(start, i + 1));
    }
  }
  throw new Error(`no balanced functions block in:\n${message}`);
}
