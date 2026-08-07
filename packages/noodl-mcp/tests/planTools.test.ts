/**
 * AIX-011 — plan tools: the staged all-or-nothing guarantee for MCP callers.
 *
 * The property under test is criterion 8: create_plan + stage_plan_operation
 * touch NOTHING on disk (asserted by hashing the whole project directory),
 * apply_plan writes the complete set at once, skips are the explicit partial
 * apply and must be dependency-closed, and doc operations stage their body in
 * memory like everything else and are written by the same one apply call
 * (criterion 7).
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { call, connect, copyFixture, TestSession } from './helpers';

interface CreatePlanResponse {
  planId: string;
  operations: Array<{ id: string; kind: string; target: string; intent: string }>;
}

interface ErrorPayload {
  error?: { code?: string; message?: string; details?: Record<string, unknown> };
}

/** A stable digest of every file under the project directory. */
function projectDigest(dir: string): string {
  const hash = crypto.createHash('sha256');
  const walk = (p: string) => {
    for (const entry of fs.readdirSync(p, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(p, entry.name);
      if (entry.isDirectory()) walk(abs);
      else {
        hash.update(path.relative(dir, abs));
        hash.update(fs.readFileSync(abs));
      }
    }
  };
  walk(dir);
  return hash.digest('hex');
}

const CHECKOUT_NODES = [
  { id: 'co_page', type: 'Page', parameters: { title: 'Checkout' } },
  { id: 'co_text', type: 'Text', parent: 'co_page', parameters: { text: 'Checkout' } }
];

/**
 * Home revised to instantiate the PLANNED Checkout page. The revision drops
 * the button/navigate pair, so the baseline's connection must go too —
 * `connections: []` — or the gate rightly rejects the dangling wire.
 */
const HOME_NODES_WITH_CHECKOUT = [
  { id: 'page', type: 'Page', parameters: { title: 'Home' } },
  { id: 'layout', type: 'Group', parent: 'page' },
  { id: 'title', type: 'Text', parent: 'layout', parameters: { text: 'Welcome home' } },
  { id: 'card', type: '/Card', parent: 'layout' },
  { id: 'checkout', type: '/Pages/Checkout', parent: 'layout' }
];

describe('noodl-mcp plan tools (AIX-011)', () => {
  let dir: string;
  let session: TestSession;

  beforeEach(async () => {
    dir = copyFixture();
    session = await connect(dir);
  });

  afterEach(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  async function createPlan(): Promise<CreatePlanResponse> {
    const res = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'Wire a Checkout page into the app',
      operations: [
        { kind: 'update', target: 'Pages/Home', intent: 'Show the new Checkout page from Home.' },
        { kind: 'create', target: 'Pages/Checkout', intent: 'The new checkout page.' }
      ]
    });
    expect(res.isError).toBe(false);
    return res.data;
  }

  it('orders creates before updates and rejects unexecutable plans at plan time', async () => {
    const plan = await createPlan();
    expect(plan.operations.map((op) => op.kind)).toEqual(['create', 'update']);

    const bad = await call<ErrorPayload>(session, 'create_plan', {
      request: 'nope',
      operations: [
        { kind: 'create', target: 'Pages/Home', intent: 'Recreate an existing page.' },
        { kind: 'update', target: 'Pages/Nowhere', intent: 'Update a page that does not exist.' }
      ]
    });
    expect(bad.isError).toBe(true);
    const errors = bad.data.error?.details?.errors as string[];
    expect(errors.some((e) => e.includes('already exists'))).toBe(true);
    expect(errors.some((e) => e.includes('no such component'))).toBe(true);
  });

  it('stages in memory against the plan overlay and writes NOTHING until apply', async () => {
    const before = projectDigest(dir);
    const plan = await createPlan();
    const createOp = plan.operations.find((op) => op.kind === 'create')!;
    const updateOp = plan.operations.find((op) => op.kind === 'update')!;

    const stagedCreate = await call<{ staged: string }>(session, 'stage_plan_operation', {
      plan_id: plan.planId,
      operation_id: createOp.id,
      nodes: CHECKOUT_NODES,
      visual_roots: ['co_page']
    });
    expect(stagedCreate.isError).toBe(false);

    // The update instantiates the component the sibling create provides —
    // valid against the overlay although nothing exists on disk.
    const stagedUpdate = await call<{ staged: string }>(session, 'stage_plan_operation', {
      plan_id: plan.planId,
      operation_id: updateOp.id,
      nodes: HOME_NODES_WITH_CHECKOUT,
      connections: [],
      visual_roots: ['page']
    });
    expect(stagedUpdate.isError).toBe(false);

    // The staging guarantee, byte for byte: the project directory is untouched.
    expect(projectDigest(dir)).toBe(before);

    // Apply writes the complete set.
    const applied = await call<{ applied: Array<{ target: string }> }>(session, 'apply_plan', {
      plan_id: plan.planId
    });
    expect(applied.isError).toBe(false);
    expect(applied.data.applied.map((a) => a.target).sort()).toEqual(['Pages/Checkout', 'Pages/Home']);
    expect(fs.existsSync(path.join(dir, 'components', 'Pages', 'Checkout', 'nodes.json'))).toBe(true);
    const home = JSON.parse(fs.readFileSync(path.join(dir, 'components', 'Pages', 'Home', 'nodes.json'), 'utf8'));
    expect(home.nodes.some((n: { type: string }) => n.type === '/Pages/Checkout')).toBe(true);

    // The plan is consumed.
    const again = await call<ErrorPayload>(session, 'apply_plan', { plan_id: plan.planId });
    expect(again.isError).toBe(true);
  });

  it('rejects an invalid staged candidate with diagnostics and stages nothing', async () => {
    const plan = await createPlan();
    const createOp = plan.operations.find((op) => op.kind === 'create')!;
    const res = await call<ErrorPayload>(session, 'stage_plan_operation', {
      plan_id: plan.planId,
      operation_id: createOp.id,
      nodes: [{ id: 'x', type: 'Grup' }]
    });
    expect(res.isError).toBe(true);
    const readable = res.data.error?.details?.readable as string[];
    expect(readable.join('\n')).toContain('Grup');

    const apply = await call<ErrorPayload>(session, 'apply_plan', { plan_id: plan.planId });
    expect(apply.isError).toBe(true);
    expect(apply.data.error?.details?.unstaged as string[]).toContain(createOp.id);
  });

  it('refuses to apply when nothing is staged, and refuses a dependency-breaking skip', async () => {
    const before = projectDigest(dir);
    const plan = await createPlan();
    const createOp = plan.operations.find((op) => op.kind === 'create')!;
    const updateOp = plan.operations.find((op) => op.kind === 'update')!;

    await call(session, 'stage_plan_operation', {
      plan_id: plan.planId,
      operation_id: createOp.id,
      nodes: CHECKOUT_NODES,
      visual_roots: ['co_page']
    });
    await call(session, 'stage_plan_operation', {
      plan_id: plan.planId,
      operation_id: updateOp.id,
      nodes: HOME_NODES_WITH_CHECKOUT,
      connections: [],
      visual_roots: ['page']
    });

    // Skipping the create while keeping the update that instantiates it is
    // exactly the invalid partial apply — refused, with the closure named.
    const broken = await call<ErrorPayload>(session, 'apply_plan', {
      plan_id: plan.planId,
      skip: [createOp.id]
    });
    expect(broken.isError).toBe(true);
    expect(broken.data.error?.details?.mustAlsoSkip as string[]).toContain(updateOp.id);
    expect(projectDigest(dir)).toBe(before);

    // Skipping both is a legal (explicit, empty) choice — and applies nothing.
    const empty = await call<ErrorPayload>(session, 'apply_plan', {
      plan_id: plan.planId,
      skip: [createOp.id, updateOp.id]
    });
    expect(empty.isError).toBe(true);
    expect(projectDigest(dir)).toBe(before);
  });

  /** A plan with one component operation and one doc operation. */
  async function createDocPlan(): Promise<CreatePlanResponse> {
    const res = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'Checkout + docs',
      operations: [
        { kind: 'create', target: 'Pages/Checkout', intent: 'The new checkout page.' },
        { kind: 'doc', target: 'docs/ARCHITECTURE.md', intent: 'Record the checkout flow.' }
      ]
    });
    expect(res.isError).toBe(false);
    return res.data;
  }

  const ARCHITECTURE = '# Architecture\n\nCheckout is a page so the back button behaves.\n';

  it('doc operations stage their body in memory and are written by the same apply (criterion 7)', async () => {
    const before = projectDigest(dir);
    const plan = await createDocPlan();
    const createOp = plan.operations.find((op) => op.kind === 'create')!;
    const docOp = plan.operations.find((op) => op.kind === 'doc')!;
    // Docs go last: the agent writes them knowing what the components became.
    expect(plan.operations.map((op) => op.kind)).toEqual(['create', 'doc']);

    // A doc op carries a file, not a graph.
    const wrongShape = await call<ErrorPayload>(session, 'stage_plan_operation', {
      plan_id: plan.planId,
      operation_id: docOp.id,
      nodes: CHECKOUT_NODES
    });
    expect(wrongShape.isError).toBe(true);
    expect(wrongShape.data.error?.message).toContain('"content"');

    await call(session, 'stage_plan_operation', {
      plan_id: plan.planId,
      operation_id: createOp.id,
      nodes: CHECKOUT_NODES,
      visual_roots: ['co_page']
    });
    const stagedDoc = await call<{ staged: string; bytes: number }>(session, 'stage_plan_operation', {
      plan_id: plan.planId,
      operation_id: docOp.id,
      content: ARCHITECTURE
    });
    expect(stagedDoc.isError).toBe(false);
    expect(stagedDoc.data.bytes).toBe(Buffer.byteLength(ARCHITECTURE, 'utf8'));

    // Still nothing on disk — the doc is staged exactly like a component.
    expect(projectDigest(dir)).toBe(before);
    expect(fs.existsSync(path.join(dir, 'docs', 'ARCHITECTURE.md'))).toBe(false);

    const applied = await call<{ applied: Array<{ target: string }>; docs: Array<{ path: string }> }>(
      session,
      'apply_plan',
      { plan_id: plan.planId }
    );
    expect(applied.isError).toBe(false);
    expect(applied.data.applied.map((a) => a.target)).toEqual(['Pages/Checkout']);
    expect(applied.data.docs.map((d) => d.path)).toEqual(['docs/ARCHITECTURE.md']);
    expect(fs.readFileSync(path.join(dir, 'docs', 'ARCHITECTURE.md'), 'utf8')).toBe(ARCHITECTURE);
  });

  it('an unstaged doc operation blocks the apply — it cannot be forgotten into a no-op', async () => {
    const before = projectDigest(dir);
    const plan = await createDocPlan();
    const createOp = plan.operations.find((op) => op.kind === 'create')!;
    const docOp = plan.operations.find((op) => op.kind === 'doc')!;

    await call(session, 'stage_plan_operation', {
      plan_id: plan.planId,
      operation_id: createOp.id,
      nodes: CHECKOUT_NODES,
      visual_roots: ['co_page']
    });

    const refused = await call<ErrorPayload>(session, 'apply_plan', { plan_id: plan.planId });
    expect(refused.isError).toBe(true);
    expect(refused.data.error?.details?.unstaged as string[]).toContain(docOp.id);
    expect(projectDigest(dir)).toBe(before);

    // Skipping it is still the explicit partial apply.
    const applied = await call<{ applied: Array<{ target: string }>; skipped: string[] }>(session, 'apply_plan', {
      plan_id: plan.planId,
      skip: [docOp.id]
    });
    expect(applied.isError).toBe(false);
    expect(applied.data.skipped).toEqual([docOp.id]);
    expect(fs.existsSync(path.join(dir, 'docs', 'ARCHITECTURE.md'))).toBe(false);
  });

  it('a doc target outside docs/ is refused at PLAN time, before anything is staged', async () => {
    const res = await call<ErrorPayload>(session, 'create_plan', {
      request: 'sneaky',
      operations: [{ kind: 'doc', target: '../../.ssh/config', intent: 'nope' }]
    });
    expect(res.isError).toBe(true);
    const errors = res.data.error?.details?.errors as string[];
    expect(errors.join('\n')).toMatch(/absolute path|outside docs/);
  });

  it('a documentation-only plan applies on its own', async () => {
    const res = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'Just write it down',
      operations: [{ kind: 'doc', target: 'docs/BRIEF.md', intent: 'What this app is for.' }]
    });
    expect(res.isError).toBe(false);
    const plan = res.data;
    await call(session, 'stage_plan_operation', {
      plan_id: plan.planId,
      operation_id: plan.operations[0].id,
      content: '# Brief\n\nA reading list for book clubs.\n'
    });
    const applied = await call<{ applied: unknown[]; docs: Array<{ path: string }> }>(session, 'apply_plan', {
      plan_id: plan.planId
    });
    expect(applied.isError).toBe(false);
    expect(applied.data.applied).toEqual([]);
    expect(applied.data.docs.map((d) => d.path)).toEqual(['docs/BRIEF.md']);
    expect(fs.readFileSync(path.join(dir, 'docs', 'BRIEF.md'), 'utf8')).toContain('book clubs');
  });

  it('discard leaves the project byte-identical', async () => {
    const before = projectDigest(dir);
    const plan = await createPlan();
    const createOp = plan.operations.find((op) => op.kind === 'create')!;
    await call(session, 'stage_plan_operation', {
      plan_id: plan.planId,
      operation_id: createOp.id,
      nodes: CHECKOUT_NODES,
      visual_roots: ['co_page']
    });
    const res = await call<{ discarded: string }>(session, 'discard_plan', { plan_id: plan.planId });
    expect(res.isError).toBe(false);
    expect(projectDigest(dir)).toBe(before);
  });
});
