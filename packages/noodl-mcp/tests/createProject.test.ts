/**
 * AIX-012 — `create_project` on the MCP server.
 *
 * The interesting properties are the ones a description cannot enforce: the
 * created project is a real v2 project that `ProjectStore` will open, it names
 * a concrete `rootNodeId` (the blank-app trap the schema itself warns about),
 * it authors NO components beyond the empty skeleton however many pages were
 * agreed, the docs are byte-identical to the ones the editor writes from the
 * same scope, and it refuses to create a project over existing files.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { planFromScope, scopeDocuments, emptyScope, mergeScope } from '../../noodl-editor/src/editor/src/models/AiAssistant/scoping/scope';
import type { ProjectScope } from '../../noodl-editor/src/editor/src/models/AiAssistant/scoping/scope';
import { ProjectStore } from '../src/project/ProjectStore';
import { SKELETON_COMPONENTS } from '../src/tools/createProject';
import { call, connect, copyFixture, type TestSession } from './helpers';
import type { ToolErrorPayload } from '../src/tools/responses';

interface CreateProjectPayload {
  ok: boolean;
  projectDir: string;
  files: string[];
  docs: string[];
  rootNodeId: string;
  plan: { request: string; operations: Array<{ id: string; kind: string; target: string; intent: string }> };
  note: string;
}

const SCOPE_ARGS = {
  name: 'Reading List',
  request: 'a reading list app where I track books and mark them finished',
  summary: 'A private reading list: add books and mark them finished.',
  audience: 'One person tracking their own reading.',
  objects: [{ name: 'Book', purpose: 'One book someone means to read.', fields: ['title (text)', 'finished (yes/no)'] }],
  pages: [
    { name: 'Library', purpose: 'The list of every book, and where a book is marked finished.' },
    { name: 'Add a book', purpose: 'The only place a Book record is created.' }
  ],
  outOfScope: ['Sharing lists with other people'],
  backend: 'The local NodeGX backend, one Book collection.',
  conventions: ['Every list page shows an explicit empty state.'],
  rejected: [{ option: 'A separate Shelves page', reason: 'One list is enough for a first version.' }],
  openQuestions: ['Whether a finished book stays in the main list.'],
  agreed: true
};

function scopeFromArgs(): ProjectScope {
  const { name, request, ...rest } = SCOPE_ARGS;
  return mergeScope(emptyScope(request), rest as Partial<ProjectScope>);
}

describe('AIX-012 create_project', () => {
  let session: TestSession;
  let tmpRoot: string;

  beforeEach(async () => {
    // The server still needs a project of its own to be pointed at — creation
    // necessarily targets a *different* directory.
    session = await connect(copyFixture(), true);
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aix012-create-'));
  });

  afterEach(async () => {
    await session.close();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    fs.rmSync(session.projectDir, { recursive: true, force: true });
  });

  it('creates a project ProjectStore can open, with a concrete rootNodeId', async () => {
    const directory = path.join(tmpRoot, 'reading-list');
    const res = await call<CreateProjectPayload>(session, 'create_project', { ...SCOPE_ARGS, directory });

    expect(res.isError).toBe(false);
    expect(res.data.ok).toBe(true);

    // The blank-app trap: project-v2.schema.json says a tool authoring a
    // project from scratch must set this, and that without it the export
    // produces nothing.
    const project = JSON.parse(fs.readFileSync(path.join(directory, 'nodegx.project.json'), 'utf8'));
    expect(typeof project.rootNodeId).toBe('string');
    expect(project.rootNodeId).toBe(res.data.rootNodeId);

    // …and it points at a node that actually exists, in the root component.
    const appNodes = JSON.parse(fs.readFileSync(path.join(directory, 'components/App/nodes.json'), 'utf8'));
    expect(appNodes.nodes.some((n: { id: string }) => n.id === project.rootNodeId)).toBe(true);

    // The constructor is the gate: it throws for anything that is not v2.
    const store = new ProjectStore(directory);
    expect(store.listComponents().map((c) => c.path).sort()).toEqual(['App', 'Pages/Home']);
  });

  it('authors NO components for the agreed pages — it returns a plan instead', async () => {
    const directory = path.join(tmpRoot, 'no-build');
    const res = await call<CreateProjectPayload>(session, 'create_project', { ...SCOPE_ARGS, directory });

    // Two pages agreed, two operations planned, zero components authored.
    expect(res.data.plan.operations.length).toBe(2);
    expect(res.data.plan.operations.map((op) => op.target)).toEqual(['Pages/Library', 'Pages/Add a book']);
    expect(res.data.plan.operations.every((op) => op.kind === 'create')).toBe(true);

    const registry = JSON.parse(fs.readFileSync(path.join(directory, 'components/_registry.json'), 'utf8'));
    expect(Object.keys(registry.components).sort()).toEqual(['App', 'Pages/Home']);
    expect(fs.existsSync(path.join(directory, 'components/Pages/Library'))).toBe(false);
    expect(res.data.note.includes('NOT been run')).toBe(true);
  });

  it('writes exactly the documents the editor writes, from the same scope', async () => {
    const directory = path.join(tmpRoot, 'docs-parity');
    const res = await call<CreateProjectPayload>(session, 'create_project', { ...SCOPE_ARGS, directory });

    expect(res.data.docs).toEqual([
      'docs/BRIEF.md',
      'docs/ARCHITECTURE.md',
      'docs/CONVENTIONS.md',
      'docs/decisions/000-initial-scope.md'
    ]);

    // Byte parity with the editor's renderers on everything except the
    // timestamp the record stamps itself with — same module, same input.
    const scope = scopeFromArgs();
    const plan = planFromScope(scope, { existingComponents: SKELETON_COMPONENTS });
    const expected = scopeDocuments({ scope, transcript: [], plan, abandoned: false });

    for (const doc of expected.slice(0, 3)) {
      const onDisk = fs.readFileSync(path.join(directory, ...doc.path.split('/')), 'utf8');
      expect(onDisk).toBe(doc.content);
    }

    const record = fs.readFileSync(path.join(directory, 'docs/decisions/000-initial-scope.md'), 'utf8');
    expect(record.includes('A separate Shelves page')).toBe(true);
    expect(record.includes('## Proposed build plan')).toBe(true);
  });

  it('carries the transcript into the record when one is supplied', async () => {
    const directory = path.join(tmpRoot, 'with-transcript');
    await call<CreateProjectPayload>(session, 'create_project', {
      ...SCOPE_ARGS,
      directory,
      transcript: [
        { role: 'user', text: 'a reading list app' },
        { role: 'assistant', text: 'Just for you, or shared?' }
      ]
    });

    const record = fs.readFileSync(path.join(directory, 'docs/decisions/000-initial-scope.md'), 'utf8');
    expect(record.includes('> Just for you, or shared?')).toBe(true);
  });

  it('creates a project with docs but no plan when no pages were agreed', async () => {
    const directory = path.join(tmpRoot, 'no-pages');
    const res = await call<CreateProjectPayload>(session, 'create_project', {
      directory,
      name: 'Vague',
      request: 'something to do with books',
      summary: 'Not settled yet.'
    });

    expect(res.isError).toBe(false);
    expect(res.data.plan.operations).toEqual([]);
    // Criterion 2's shape out here: partial agreement still produces something
    // durable, and the gaps are marked rather than filled in.
    const brief = fs.readFileSync(path.join(directory, 'docs/BRIEF.md'), 'utf8');
    expect(brief.includes('> TODO:')).toBe(true);
  });

  it('refuses to create a project over a folder that already has files in it', async () => {
    const directory = path.join(tmpRoot, 'occupied');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'README.md'), 'mine', 'utf8');

    const res = await call<ToolErrorPayload>(session, 'create_project', { ...SCOPE_ARGS, directory });

    expect(res.isError).toBe(true);
    expect(res.data.error.code).toBe('already-exists');
    // Nothing was written beside the user's file.
    expect(fs.readdirSync(directory)).toEqual(['README.md']);
  });

  it('refuses a scope with no request rather than inventing one', async () => {
    const res = await call<ToolErrorPayload>(session, 'create_project', {
      directory: path.join(tmpRoot, 'no-request'),
      name: 'Nameless',
      request: '   '
    });

    expect(res.isError).toBe(true);
    expect(res.data.error.code).toBe('invalid-argument');
  });
});
