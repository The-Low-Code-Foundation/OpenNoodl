/**
 * WFA-007 — the MCP half of "AI proposes, the canvas is where you accept",
 * driven against a REAL running nodegx-backend.
 *
 * Three properties, and each one is a claim the task makes:
 *
 *  1. **The served registry is the contract.** A step kind the target backend
 *     does not serve is refused HERE, naming `list_backend_step_kinds` — not
 *     discovered from a 400 halfway through a save, and not filtered by a
 *     bundled copy of the vocabulary inside this package.
 *  2. **A proposal writes nothing.** `propose: true` leaves the backend exactly
 *     as it was, and the assertion is made against the live `/admin/workflow-defs`
 *     rather than against the tool's own answer.
 *  3. **A proposal that could not be saved is never staged.** The user is never
 *     offered a choice they cannot take; the agent gets the backend's own
 *     errors instead.
 *
 * Plus the id-keeping property §5 asks for: an update that says nothing about a
 * step's canvas position keeps the one it had.
 *
 * The backend is the built `dist/cli.js` spawned as a child process, discovered
 * the way the tools discover it. Skips loudly if that bundle is not built.
 */
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { PROPOSALS_DIR, listProposals } from '../src/backend/workflowProposals';

import { connect, TestSession, call, reveal } from './helpers';

const BACKEND_DIR = path.join(__dirname, '..', '..', 'nodegx-backend');
const BACKEND_CLI = path.join(BACKEND_DIR, 'dist', 'cli.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'demo-app');

const haveBundle = fs.existsSync(BACKEND_CLI);
const describeOrSkip = haveBundle ? describe : describe.skip;

jest.setTimeout(40000);

const BACKEND_ID = 'mcp_proposal_backend';

interface Started {
  proc: ChildProcess;
  port: number;
  backendsDir: string;
  dataDir: string;
}

async function startBackend(): Promise<Started> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-wfa007-data-'));
  const proc = spawn(process.execPath, [BACKEND_CLI, 'serve', '--data-dir', dataDir, '--port', '0'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const port = await new Promise<number>((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error(`backend did not become ready:\n${buf}`)), 20000);
    proc.stdout!.on('data', (chunk) => {
      buf += chunk.toString();
      const m = buf.match(/NODEGX_BACKEND_READY (\{.*\})/);
      if (m) {
        clearTimeout(timer);
        resolve(JSON.parse(m[1]).port);
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`backend exited early (${code}):\n${buf}`));
    });
  });

  const backendsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-wfa007-backends-'));
  fs.mkdirSync(path.join(backendsDir, BACKEND_ID));
  fs.writeFileSync(
    path.join(backendsDir, BACKEND_ID, 'config.json'),
    JSON.stringify({ id: BACKEND_ID, name: 'Proposal Test Backend', port })
  );
  fs.copyFileSync(path.join(dataDir, 'secrets.json'), path.join(backendsDir, BACKEND_ID, 'secrets.json'));

  return { proc, port, backendsDir, dataDir };
}

interface WorkflowStepShape {
  id: string;
  kind: string;
  ui?: { x: number; y: number };
}
interface WorkflowShape {
  id: string;
  name?: string;
  steps: WorkflowStepShape[];
}

describeOrSkip('WFA-007 — proposing a workflow instead of writing one (live backend)', () => {
  let backend: Started;
  let session: TestSession;
  let projectDir: string;
  const prevBackendsDir = process.env.NODEGX_BACKENDS_DIR;

  beforeAll(async () => {
    backend = await startBackend();
    process.env.NODEGX_BACKENDS_DIR = backend.backendsDir;
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-wfa007-proj-'));
    fs.cpSync(FIXTURE, projectDir, { recursive: true });
    session = await connect(projectDir, true);
    await reveal(session, 'backend'); // AWP-006 — workflow tools ship with the backend group
  });

  afterAll(async () => {
    if (session) await session.close();
    if (backend) {
      backend.proc.kill('SIGTERM');
      fs.rmSync(backend.backendsDir, { recursive: true, force: true });
      fs.rmSync(backend.dataDir, { recursive: true, force: true });
    }
    fs.rmSync(projectDir, { recursive: true, force: true });
    if (prevBackendsDir === undefined) delete process.env.NODEGX_BACKENDS_DIR;
    else process.env.NODEGX_BACKENDS_DIR = prevBackendsDir;
  });

  /** The workflow ids the backend actually holds, read from the live route. */
  async function backendWorkflowIds(): Promise<string[]> {
    const { data } = await call<{ workflows: WorkflowShape[] }>(session, 'list_backend_workflows', {
      backendId: BACKEND_ID
    });
    return (data.workflows || []).map((w) => w.id).sort();
  }

  const twoSteps = [
    { id: 'start', kind: 'wait', params: { duration: 1 }, next: ['finish'] },
    { id: 'finish', kind: 'stop' }
  ];

  // ==========================================================================
  // §4 — the tool enforces the served registry
  // ==========================================================================

  it('refuses a step kind this backend does not serve, naming the tool that answers', async () => {
    const before = await backendWorkflowIds();

    const res = await call<{ error?: { code: string; message: string; details?: { served?: string[] } } }>(
      session,
      'create_backend_workflow',
      {
        backendId: BACKEND_ID,
        id: 'wf_unknown_kind',
        entry: 'a',
        steps: [{ id: 'a', kind: 'send-carrier-pigeon' }]
      }
    );

    expect(res.isError).toBe(true);
    expect(res.data.error!.code).toBe('invalid-argument');
    expect(res.data.error!.message).toContain('list_backend_step_kinds');
    expect(res.data.error!.message).toContain('send-carrier-pigeon');
    // It says what IS served, so the next attempt is informed by the error alone.
    expect(res.data.error!.details!.served).toContain('branch');

    // Refused BEFORE anything was written.
    expect(await backendWorkflowIds()).toEqual(before);
  });

  it('refuses an unknown kind in propose mode too, and stages nothing', async () => {
    const res = await call(session, 'create_backend_workflow', {
      backendId: BACKEND_ID,
      id: 'wf_unknown_proposed',
      entry: 'a',
      steps: [{ id: 'a', kind: 'not-a-kind' }],
      propose: true
    });
    expect(res.isError).toBe(true);
    expect(listProposals(BACKEND_ID).some((p) => p.workflowId === 'wf_unknown_proposed')).toBe(false);
  });

  // ==========================================================================
  // §1 / §2 — a proposal writes nothing, and reaches the review queue
  // ==========================================================================

  it('propose: true stages a reviewable proposal and writes NOTHING to the backend', async () => {
    const before = await backendWorkflowIds();

    const res = await call<{
      proposed: boolean;
      proposalId: string;
      mode: string;
      workflowId: string;
      backendId: string;
    }>(session, 'create_backend_workflow', {
      backendId: BACKEND_ID,
      id: 'wf_proposed',
      name: 'Proposed pipeline',
      entry: 'start',
      steps: twoSteps,
      propose: true,
      note: 'Waits a beat, then stops.'
    });

    expect(res.isError).toBe(false);
    expect(res.data.proposed).toBe(true);
    expect(res.data.mode).toBe('create');
    expect(res.data.workflowId).toBe('wf_proposed');

    // The backend is untouched — asserted against the backend, not the answer.
    expect(await backendWorkflowIds()).toEqual(before);

    // And the proposal is where the editor looks for it.
    const staged = listProposals(BACKEND_ID).find((p) => p.proposalId === res.data.proposalId);
    expect(staged).toBeTruthy();
    expect(staged!.backendId).toBe(BACKEND_ID);
    expect(staged!.mode).toBe('create');
    expect(staged!.note).toBe('Waits a beat, then stops.');
    expect((staged!.workflow as unknown as WorkflowShape).steps.map((s) => s.id)).toEqual(['start', 'finish']);
    expect(fs.existsSync(path.join(backend.backendsDir, BACKEND_ID, PROPOSALS_DIR))).toBe(true);
  });

  it('tells the agent where it went, rather than implying it was applied', async () => {
    const { data } = await call<{ note: string }>(session, 'create_backend_workflow', {
      backendId: BACKEND_ID,
      id: 'wf_proposed_note',
      entry: 'start',
      steps: twoSteps,
      propose: true
    });
    expect(data.note).toMatch(/Nothing was written to the backend/);
    expect(data.note).toMatch(/Workflows panel/);
  });

  // ==========================================================================
  // §3 — a candidate that could not be saved is never offered as a choice
  // ==========================================================================

  it('refuses to stage a proposal the backend would reject, with the backend reasons', async () => {
    const res = await call<{ error?: { code: string; message: string; details?: { errors?: string[] } } }>(
      session,
      'create_backend_workflow',
      {
        backendId: BACKEND_ID,
        id: 'wf_cyclic_proposal',
        entry: 'a',
        // A cycle: valid kinds, valid per-step shapes, a definition the engine
        // refuses as a whole. (`stop` cannot take `next` at all, so it would
        // have failed for a shallower reason — this has to be a graph fault.)
        steps: [
          { id: 'a', kind: 'wait', params: { duration: 1 }, next: ['b'] },
          { id: 'b', kind: 'wait', params: { duration: 1 }, next: ['a'] }
        ],
        propose: true
      }
    );

    expect(res.isError).toBe(true);
    expect(res.data.error!.code).toBe('validation-failed');
    expect(res.data.error!.message).toMatch(/cycle/i);
    // The reason it refuses is stated as a product decision, not as an accident.
    expect(res.data.error!.message).toMatch(/a user cannot accept/i);
    expect(listProposals(BACKEND_ID).some((p) => p.workflowId === 'wf_cyclic_proposal')).toBe(false);
  });

  it('refuses to stage a proposal with no id, because a diff needs something to diff against', async () => {
    const res = await call<{ error?: { code: string; message: string } }>(session, 'create_backend_workflow', {
      backendId: BACKEND_ID,
      entry: 'start',
      steps: twoSteps,
      propose: true
    });
    expect(res.isError).toBe(true);
    expect(res.data.error!.message).toMatch(/needs an id/i);
  });

  // ==========================================================================
  // The direct path is not closed
  // ==========================================================================

  it('writes straight to the backend when propose is absent — the historical behaviour', async () => {
    const res = await call<{ workflow: WorkflowShape }>(session, 'create_backend_workflow', {
      backendId: BACKEND_ID,
      id: 'wf_direct',
      name: 'Direct',
      entry: 'start',
      steps: twoSteps
    });
    expect(res.isError).toBe(false);
    expect(res.data.workflow.id).toBe('wf_direct');
    expect(await backendWorkflowIds()).toContain('wf_direct');
  });

  // ==========================================================================
  // §5 — an update keeps what an agent cannot know
  // ==========================================================================

  it('carries a step canvas position over by id, so an update does not re-lay-out a workflow', async () => {
    // Arrange positions the way the editor would, straight over the admin API.
    const adminToken = JSON.parse(
      fs.readFileSync(path.join(backend.dataDir, 'secrets.json'), 'utf-8')
    ).adminToken as string;
    const arranged = await fetch(`http://127.0.0.1:${backend.port}/admin/workflow-defs/wf_direct`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        id: 'wf_direct',
        name: 'Direct',
        entry: 'start',
        steps: [
          { id: 'start', kind: 'wait', params: { duration: 1 }, next: ['finish'], ui: { x: 111, y: 222 } },
          { id: 'finish', kind: 'stop', ui: { x: 333, y: 444 } }
        ]
      })
    });
    expect(arranged.status).toBe(200);

    // An agent updates it, saying nothing at all about layout — as every
    // authoring example does.
    const res = await call<{ workflow: WorkflowShape }>(session, 'update_backend_workflow', {
      backendId: BACKEND_ID,
      id: 'wf_direct',
      name: 'Direct, edited',
      entry: 'start',
      steps: [
        { id: 'start', kind: 'wait', params: { duration: 5 }, next: ['finish'] },
        { id: 'finish', kind: 'stop' }
      ]
    });
    expect(res.isError).toBe(false);

    const byId = new Map(res.data.workflow.steps.map((s) => [s.id, s]));
    expect(byId.get('start')!.ui).toEqual({ x: 111, y: 222 });
    expect(byId.get('finish')!.ui).toEqual({ x: 333, y: 444 });
    expect(res.data.workflow.name).toBe('Direct, edited');
  });

  it('a proposed update carries positions over too, and is diffed against what exists', async () => {
    const res = await call<{ mode: string; proposalId: string }>(session, 'update_backend_workflow', {
      backendId: BACKEND_ID,
      id: 'wf_direct',
      name: 'Direct, proposed edit',
      entry: 'start',
      steps: [
        { id: 'start', kind: 'wait', params: { duration: 9 }, next: ['finish'] },
        { id: 'finish', kind: 'stop' }
      ],
      propose: true
    });
    expect(res.isError).toBe(false);
    // It knows the workflow exists, so the reviewer gets a diff, not a creation.
    expect(res.data.mode).toBe('update');

    const staged = listProposals(BACKEND_ID).find((p) => p.proposalId === res.data.proposalId)!;
    const steps = (staged.workflow as unknown as WorkflowShape).steps;
    expect(steps.find((s) => s.id === 'start')!.ui).toEqual({ x: 111, y: 222 });

    // And the live definition still says what it said before the proposal.
    const { data } = await call<{ workflow: WorkflowShape }>(session, 'get_backend_workflow', {
      backendId: BACKEND_ID,
      id: 'wf_direct'
    });
    expect(data.workflow.name).toBe('Direct, edited');
  });
});
