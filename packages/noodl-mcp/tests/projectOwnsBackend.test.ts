/**
 * DSG-007 / F2 — **the consequence**: a project and its backend survive the
 * round trip that used to strand them.
 *
 * DSG-007's acceptance names one check and calls it the whole task: *provision
 * a backend, restart the MCP server, provision again — the number of
 * directories under the backends root does not change.* That is the test below,
 * and it is deliberately run against a project with **no `id`**, because
 * `tests/fixtures/demo-app` ships one (`demo-app-0001`) and that is why the
 * existing provisioning suite never saw F2. A fixture that has already been
 * fixed cannot fail the way the machine does.
 *
 * ⚠️ The second block is not a bug being tolerated, it is the fix's **limit**,
 * pinned so nobody reports the phase closed on the strength of the first block.
 * `ProjectModel`'s constructor does not read `id` and its `toJSON` does not emit
 * one, so every editor save deletes the field this server writes. Until that is
 * fixed in `packages/noodl-editor`, a project that passes through the editor
 * between two provisions gets a second backend — and the point of DSG-007 §4.3
 * is that it now says so out loud instead of doing it in silence.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { censusBackends, explainReuse, stopOwnedBackends } from '../src/backend/provision';
import { readProjectId } from '../src/backend/projectIdentity';
import { call, connect, copyFixture, reveal, TestSession } from './helpers';

const BACKEND_CLI = path.join(__dirname, '..', '..', 'nodegx-backend', 'dist', 'cli.js');
const describeOrSkip = fs.existsSync(BACKEND_CLI) ? describe : describe.skip;

interface ProvisionResponse {
  provisioned: boolean;
  backendId?: string;
  endpoint?: string;
  reused?: boolean;
  adopted?: boolean;
  projectId?: string;
  projectIdentity?: string;
  reuseVerdict?: string;
  reuseNote?: string;
  warnings?: string[];
  reason?: string;
}

/** What every editor-saved project on the machine looks like: no `id`. */
function forgetProjectId(projectDir: string): void {
  const file = path.join(projectDir, 'nodegx.project.json');
  const project = JSON.parse(fs.readFileSync(file, 'utf-8'));
  delete project.id;
  fs.writeFileSync(file, JSON.stringify(project, null, 2), 'utf-8');
}

function backendDirs(root: string): string[] {
  return fs.readdirSync(root).filter((d) => fs.existsSync(path.join(root, d, 'config.json')));
}

function configOf(root: string, id: string): { projectIds: string[]; name: string } {
  return JSON.parse(fs.readFileSync(path.join(root, id, 'config.json'), 'utf-8'));
}

// ─── The rule's failure modes, without a process ─────────────────────────────

describe('DSG-007 §4.3 — a reuse that cannot happen says why', () => {
  const existing = [
    { id: 'b1', name: 'Shop backend', port: 8578, projectIds: ['proj-a'] },
    { id: 'b2', name: 'Orphan backend', port: 8579, projectIds: [] }
  ];

  it('says nothing when there is nothing to say', () => {
    expect(explainReuse(existing, 'Shop backend', 'proj-a')).toMatchObject({ verdict: 'reused', note: '' });
    expect(explainReuse(existing, 'Brand new', 'proj-a')).toMatchObject({ verdict: 'none-of-that-name', note: '' });
  });

  it('⭐ a project with no id is told a namesake exists and why it was not taken', () => {
    const result = explainReuse(existing, 'Shop backend', undefined);
    expect(result.verdict).toBe('project-has-no-id');
    expect(result.namesakes).toEqual(['b1']);
    expect(result.note).toContain('cannot prove it owns one');
    // The failure mode F2 filed was silence, so the sentence must reach a reader.
    expect(result.note).toContain('NEW backend was created');
  });

  it('quotes the identity reason it was given rather than guessing at one', () => {
    const result = explainReuse(existing, 'Shop backend', undefined, { reason: 'the project file is read-only' });
    expect(result.note).toContain('the project file is read-only');
  });

  it('⭐ an id minted on THIS call is not told the namesake correctly belongs to someone else', () => {
    // The distinction that matters on the real machine: `Shop backend` carries
    // `projectIds: ["ecommerce-example"]` and no project file claims that id any
    // more. A project that has only just acquired an identity has by definition
    // never owned anything, so "two projects with the same name, working as
    // intended" is the one reading that must NOT be offered here.
    const result = explainReuse(existing, 'Shop backend', 'proj-new', { minted: true });
    expect(result.verdict).toBe('identity-only-just-minted');
    expect(result.note).toContain('had no id until this call');
    expect(result.note).toContain('proj-new');
    expect(result.note).not.toContain('this is correct, not a failure');
  });

  it('⚠️ an unowned namesake is reported, NOT adopted — that is AAQ-002/F4', () => {
    const result = explainReuse(existing, 'Orphan backend', 'proj-a');
    expect(result.verdict).toBe('unowned-namesake');
    expect(result.note).toContain('NOT adopted');
    expect(result.note).toContain('projectIds');
  });

  it("⭐ two projects named the same do not share a backend, and the split is called correct", () => {
    // DSG-007's own last acceptance criterion, and the thing §2 misread as
    // stranding: the two `Stock Cupboard Backend`s are two different projects.
    const result = explainReuse(existing, 'Shop backend', 'proj-b');
    expect(result.verdict).toBe('owned-by-another-project');
    expect(result.note).toContain('this is correct, not a failure');
  });
});

describe('DSG-007 §4.4 — the census names what nobody can reuse', () => {
  it('flags a backend no project claims, and does not confuse it with a shared name', () => {
    const census = censusBackends([
      { id: 'b1', name: 'Stock Cupboard Backend', port: 8583, projectIds: ['proj-a'] },
      { id: 'b2', name: 'Stock Cupboard Backend', port: 8584, projectIds: ['proj-b'] },
      { id: 'b3', name: 'App backend', port: 8580, projectIds: [] }
    ]);
    expect(census.map((c) => c.verdict)).toEqual(['owned-namesake', 'owned-namesake', 'unowned']);
    // The two Stock Cupboards are the rule working. Only the third is a problem.
    expect(census[0].note).toContain('ownership rule working');
    expect(census[2].note).toContain('no provision can ever reuse it');
  });

  it('a backend with a missing projectIds field is unowned, not a crash', () => {
    expect(censusBackends([{ id: 'b1', name: 'Old', port: 8578 }])[0]).toMatchObject({
      verdict: 'unowned',
      projectIds: []
    });
  });
});

// ─── The whole task, in one check ────────────────────────────────────────────

describeOrSkip('DSG-007 — a project owns its backend across an MCP server restart', () => {
  jest.setTimeout(120000);

  let projectDir: string;
  let root: string;
  const previousRoot = process.env.NODEGX_BACKENDS_DIR;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsg007-backends-'));
    process.env.NODEGX_BACKENDS_DIR = root;
    projectDir = copyFixture();
    // ⭐ The fixture ships an id. The machine's projects do not.
    forgetProjectId(projectDir);
  });

  afterEach(async () => {
    await stopOwnedBackends(root);
    if (previousRoot === undefined) delete process.env.NODEGX_BACKENDS_DIR;
    else process.env.NODEGX_BACKENDS_DIR = previousRoot;
  });

  async function session(): Promise<TestSession> {
    const s = await connect(projectDir, true);
    await reveal(s, 'backend');
    return s;
  }

  it('⭐ provision, restart, provision again — ONE backend directory, not two', async () => {
    // ── First server. The project cannot prove it owns anything yet.
    const first = await session();
    let created: ProvisionResponse;
    try {
      const res = await call<ProvisionResponse>(first, 'provision_backend', { name: 'App backend' });
      expect(res.isError).toBe(false);
      created = res.data;
    } finally {
      await first.close();
    }

    expect(created.provisioned).toBe(true);
    // The identity was minted on the way in, and is what the backend was stamped
    // with — the two halves that were missing.
    expect(created.projectIdentity).toBe('minted');
    expect(created.projectId).toBeTruthy();
    expect(readProjectId(projectDir)).toBe(created.projectId);
    expect(configOf(root, created.backendId as string).projectIds).toEqual([created.projectId]);
    expect(backendDirs(root)).toHaveLength(1);

    // ── The restart. Nothing of this process's memory survives it; the only
    //    thing carrying the relationship forward is the pair of files.
    await stopOwnedBackends(root);

    const second = await session();
    let again: ProvisionResponse;
    try {
      const res = await call<ProvisionResponse>(second, 'provision_backend', {
        name: 'App backend',
        // The project is bound now, so the endpoint refusal fires first. Force
        // is what makes the interesting branch reachable at all — the assertion
        // is about what it does NOT do.
        force: true
      });
      expect(res.isError).toBe(false);
      again = res.data;
    } finally {
      await second.close();
    }

    // ⭐ The acceptance criterion, stated three ways.
    expect(again.reused).toBe(true);
    expect(again.backendId).toBe(created.backendId);
    expect(backendDirs(root)).toHaveLength(1);

    // The id was not re-minted: it was read back off the file it was written to.
    expect(again.projectIdentity).toBe('present');
    expect(again.projectId).toBe(created.projectId);
    expect(again.reuseVerdict).toBe('reused');
    expect(again.reuseNote).toBeUndefined();
  });

  it('a project that already has an id is never rewritten to acquire one', async () => {
    const file = path.join(projectDir, 'nodegx.project.json');
    const project = JSON.parse(fs.readFileSync(file, 'utf-8'));
    project.id = 'already-mine';
    fs.writeFileSync(file, JSON.stringify(project, null, 2), 'utf-8');

    const s = await session();
    try {
      const res = await call<ProvisionResponse>(s, 'provision_backend', { name: 'App backend' });
      expect(res.data.projectIdentity).toBe('present');
      expect(res.data.projectId).toBe('already-mine');
      expect(configOf(root, res.data.backendId as string).projectIds).toEqual(['already-mine']);
    } finally {
      await s.close();
    }
  });

  it('⚠️ an id lost between provisions is now LOUD rather than silent', async () => {
    const first = await session();
    let created: ProvisionResponse;
    try {
      created = (await call<ProvisionResponse>(first, 'provision_backend', { name: 'App backend' })).data;
    } finally {
      await first.close();
    }
    expect(backendDirs(root)).toHaveLength(1);

    await stopOwnedBackends(root);
    // ⚠️ This WAS what an editor save did — `ProjectModel` dropped `id` on load
    // and omitted it from `toJSON`, so every save deleted the field (DSG-007/F30,
    // fixed on this branch). It is kept because the MCP server cannot assume the
    // editor writing these files is a fixed one: an older installed binary, a
    // hand edit, or a restore from a pre-fix backup all reproduce it. What is
    // asserted is not the editor's behaviour but this server's — that losing the
    // identity produces a named, repairable result instead of silence.
    forgetProjectId(projectDir);

    const second = await session();
    let again: ProvisionResponse;
    try {
      again = (await call<ProvisionResponse>(second, 'provision_backend', { name: 'App backend', force: true })).data;
    } finally {
      await second.close();
    }

    // A second directory — the defect, still reachable from the editor side.
    expect(again.backendId).not.toBe(created.backendId);
    expect(backendDirs(root)).toHaveLength(2);
    // ⭐ …but it is no longer silent. The project acquired a *fresh* id, so the
    //   first backend is now owned by an id no project file claims — precisely
    //   the state `Shop backend` and `Puppy test 3 backend` are in on the real
    //   machine, and the note names the repair rather than reassuring anyone.
    expect(again.projectIdentity).toBe('minted');
    expect(again.projectId).not.toBe(created.projectId);
    expect(again.reuseVerdict).toBe('identity-only-just-minted');
    expect(again.reuseNote).toContain('stranded when');
    // A caller that only ever reads `warnings` still sees it.
    expect(again.warnings?.join(' ')).toContain('had no id until this call');
  });

  it('list_backend_processes names the directory nobody can reuse', async () => {
    const s = await session();
    try {
      await call<ProvisionResponse>(s, 'provision_backend', { name: 'App backend' });
      // A backend created by something that never stamped an owner — the three
      // `projectIds: []` rows in DSG-007 §2.
      fs.mkdirSync(path.join(root, 'backend_orphan'), { recursive: true });
      fs.writeFileSync(
        path.join(root, 'backend_orphan', 'config.json'),
        JSON.stringify({ id: 'backend_orphan', name: 'Old backend', port: 8999, projectIds: [] }, null, 2)
      );

      const listed = await call<{
        directories: { id: string; verdict: string }[];
        unownedNote?: string;
      }>(s, 'list_backend_processes', {});

      const orphan = listed.data.directories.find((d) => d.id === 'backend_orphan');
      expect(orphan?.verdict).toBe('unowned');
      expect(listed.data.unownedNote).toContain('Old backend @ 8999');
      // It reports; it deletes nothing. A backend directory is a database.
      expect(fs.existsSync(path.join(root, 'backend_orphan', 'config.json'))).toBe(true);
    } finally {
      await s.close();
    }
  });
});
