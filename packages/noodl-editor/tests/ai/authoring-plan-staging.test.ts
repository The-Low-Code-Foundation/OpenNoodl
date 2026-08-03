/**
 * AIX-011 — the plan transaction: everything staged first, one undo group,
 * byte-for-byte reversal on REAL FILES.
 *
 * Criterion 4 is the load-bearing spec here and it is deliberately not a
 * mock-level assertion: the project is the real corpus in a real
 * `ProjectModel`, saved to disk through the product's own save path
 * (`project.toDirectory`) before the plan is applied and again after ONE
 * undo, and the two files are compared as raw bytes.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import { buildComponentV2Files } from '../../src/editor/src/io/ProjectExporter';
import { buildCandidate } from '../../src/editor/src/models/AiAssistant/authoring/candidate';
import {
  applyAuthoredPlan,
  type AppliedPlanOperation,
  type PlanDocWriter
} from '../../src/editor/src/models/AiAssistant/authoring/planStaging';
import { StagingError } from '../../src/editor/src/models/AiAssistant/authoring/staging';
import type { AuthoringRequest, ComponentFiles } from '../../src/editor/src/models/AiAssistant/authoring/types';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';
import { getCloudServices, setCloudServices } from '../../src/editor/src/models/projectmodel.editor';
import { expectRejection } from './helpers';
import { UndoActionGroup, UndoQueue } from '../../src/editor/src/models/undo-queue-model';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

function loadProject(): ProjectModel {
  const project = ProjectModel.fromJSON(JSON.parse(JSON.stringify(gitRepoUtf8)));
  // AIB-007: the fake provisioner binds whichever project the spec loaded. The
  // real one takes it as an option; a module-level handle keeps the fake from
  // needing a factory the other specs would have to know about.
  currentProject = project;
  return project;
}

/** Save through the product's own path; resolves to the project.json bytes. */
function saveProjectFiles(project: ProjectModel, label: string): Promise<Buffer> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `aix011-${label}-`));
  return new Promise((resolve, reject) => {
    project.toDirectory(dir, (result: { result: string; message?: string }) => {
      if (result.result !== 'success') {
        reject(new Error(result.message ?? 'save failed'));
        return;
      }
      resolve(fs.readFileSync(path.join(dir, 'project.json')));
    });
  });
}

function createFiles(componentPath: string): ComponentFiles {
  const request: AuthoringRequest = { description: 'plan-authored', componentPath };
  const result = buildCandidate(request, {
    nodes: [
      { id: `${componentPath.split('/').pop()!.toLowerCase()}-root`, type: 'Group', label: 'Root' },
      {
        id: `${componentPath.split('/').pop()!.toLowerCase()}-text`,
        type: 'Text',
        parent: `${componentPath.split('/').pop()!.toLowerCase()}-root`,
        parameters: { text: componentPath }
      }
    ],
    visualRoots: [`${componentPath.split('/').pop()!.toLowerCase()}-root`]
  });
  expect(result.errors).toEqual([]);
  return result.files!;
}

function updateFiles(project: ProjectModel, legacyName: string, referencing?: string): ComponentFiles {
  const existing = project.getComponentWithName(legacyName)!;
  expect(existing).toBeDefined();
  const base = buildComponentV2Files(existing.toJSON(), '2026-01-01T00:00:00.000Z') as ComponentFiles;
  const request: AuthoringRequest = { description: 'plan-revised', componentPath: legacyName };
  const result = buildCandidate(
    request,
    {
      nodes: [
        { id: 'upd-root', type: 'Group', label: 'Revised root' },
        ...(referencing ? [{ id: 'upd-ref', type: referencing, parent: 'upd-root' }] : []),
        { id: 'upd-text', type: 'Text', parent: 'upd-root', parameters: { text: 'revised' } }
      ],
      visualRoots: ['upd-root']
    },
    undefined,
    base
  );
  expect(result.errors).toEqual([]);
  return result.files!;
}

/** The 3-component plan the criteria talk about: one create, two updates. */
function threeComponentPlan(project: ProjectModel): AppliedPlanOperation[] {
  return [
    {
      kind: 'create',
      operation: { id: 'op-1', kind: 'create', target: 'Pages/Checkout', intent: 'new page' },
      files: createFiles('Pages/Checkout')
    },
    {
      kind: 'update',
      operation: { id: 'op-2', kind: 'update', target: 'Pages/Article', intent: 'link checkout' },
      files: updateFiles(project, '/Pages/Article', '/Pages/Checkout')
    },
    {
      kind: 'update',
      operation: { id: 'op-3', kind: 'update', target: 'Pages/Profile', intent: 'link checkout' },
      files: updateFiles(project, '/Pages/Profile')
    }
  ];
}

const BASELINE = '# Architecture\n\nThe app is a reading list.\n';
const PROPOSED = '# Architecture\n\nThe app is a reading list.\n\n## Checkout\n\nCheckout is its own page.\n';

function docOperation(): AppliedPlanOperation {
  return {
    kind: 'doc',
    operation: { id: 'op-4', kind: 'doc', target: 'docs/ARCHITECTURE.md', intent: 'record the checkout flow' },
    proposed: PROPOSED,
    baseline: BASELINE,
    summary: 'Recorded why checkout is a page'
  };
}

/**
 * A stand-in for AIX-009's write path with the two behaviours the transaction
 * depends on: it refuses in preflight when the file drifted from the baseline
 * the proposal was authored against, and it records its inverse into the
 * CALLER's undo group rather than pushing one of its own.
 */
interface FakeDocs {
  /** The "file on disk". */
  file: string | null;
  /** Set to make `apply` throw, standing in for an I/O failure. */
  failOnApply?: string;
  writer: PlanDocWriter;
}

function fakeDocWriter(): FakeDocs {
  const state: FakeDocs = {
    file: BASELINE,
    writer: {
      preflight: (op) => {
        if (state.file !== op.baseline) {
          throw new Error(`${op.operation.target} changed on disk since it was read.`);
        }
      },
      apply: (op, undoGroup) => {
        if (state.failOnApply) throw new Error(state.failOnApply);
        const { proposed, baseline } = op;
        state.file = proposed;
        // `push`, not the constructor pair: the write has already happened, so
        // there is nothing to `do` — this only records the inverse.
        undoGroup.push({
          do: () => {
            state.file = proposed;
          },
          undo: () => {
            state.file = baseline;
          }
        });
      }
    }
  };
  return state;
}

/** AIB-007 — the provision operation the specs below apply. */
function provisionOperation(): AppliedPlanOperation {
  return {
    kind: 'provision',
    operation: {
      id: 'op-0',
      kind: 'provision',
      target: 'App backend',
      intent: 'Give this project a built-in backend that runs on this computer.',
      provision: {
        name: 'App backend',
        collections: [{ name: 'Message', columns: [{ name: 'body', type: 'String' }] }],
        needsAuth: true
      }
    },
    provision: {
      name: 'App backend',
      collections: [{ name: 'Message', columns: [{ name: 'body', type: 'String' }] }],
      needsAuth: true
    }
  };
}

/**
 * A stand-in for the editor's `editorBackendProvisioner`, with the two
 * behaviours the transaction depends on and the one it must NOT have.
 *
 * `created` and `deleted` are tracked separately on purpose: the whole point of
 * AIB-007's undo boundary is that an undo sets `deleted` to *nothing*, and a
 * spec that only checked the project would pass either way.
 */
function fakeProvisioner(options: { refuse?: string } = {}) {
  const tracker = {
    created: false,
    deleted: false,
    provisioner: {
      preflight() {
        if (options.refuse) throw new Error(options.refuse);
      },
      apply(op: Extract<AppliedPlanOperation, { kind: 'provision' }>, undoGroup: UndoActionGroup) {
        tracker.created = true;
        // ⚠️ The RAW metadata, exactly as `editorBackendProvisioner` does — see
        // the note there. Snapshotting through `getCloudServices` loses any
        // field that projection does not read, and the corpus fixture has one
        // (`workspaceId`). This fake mirrors the real one so that the
        // byte-for-byte assertion below is testing the same property.
        const before = currentProject!.getMetaData('cloudservices');
        setCloudServices(currentProject!, {
          id: 'backend-fake',
          endpoint: 'http://localhost:9999',
          appId: 'backend-fake',
          type: 'nodegx'
        });
        const after = currentProject!.getMetaData('cloudservices');
        const restore = (value: unknown) => {
          currentProject!.setMetaData('cloudservices', value);
          currentProject!.notifyListeners('cloudServicesChanged');
        };
        // ONLY the binding. Deleting the backend is deliberately not an inverse
        // — see `PlanBackendProvisioner`.
        undoGroup.push({ do: () => restore(after), undo: () => restore(before) });
        return Promise.resolve({
          backendId: 'backend-fake',
          name: op.provision.name,
          endpoint: 'http://localhost:9999',
          collections: op.provision.collections.map((c) => c.name),
          warnings: []
        });
      }
    }
  };
  return tracker;
}

/** The project the fake provisioner binds. Set by `loadProject` below. */
let currentProject: ProjectModel | undefined;

describe('AIX-011 plan staging (the transaction)', () => {
  beforeEach(() => {
    UndoQueue.instance.clear();
    currentProject = undefined;
  });

  it('criterion 4: apply a 3-component plan, undo ONCE, and the saved project files are byte-identical', async () => {
    const project = loadProject();
    const before = await saveProjectFiles(project, 'before');

    const operations = threeComponentPlan(project);
    const result = await applyAuthoredPlan(project, operations);
    expect(result.components.size).toBe(3);

    // The plan landed…
    expect(project.getComponentWithName('/Pages/Checkout')).toBeDefined();
    expect(project.getComponentWithName('/Pages/Article')!.graph.findNodeWithId('upd-ref')).toBeDefined();
    expect(project.getComponentWithName('/Pages/Profile')!.graph.findNodeWithId('upd-text')).toBeDefined();
    const afterApply = JSON.stringify(project.toJSON());

    // …as ONE undo step.
    expect(UndoQueue.instance.getHistory().length).toBe(1);
    UndoQueue.instance.undo();

    expect(project.getComponentWithName('/Pages/Checkout')).toBeUndefined();
    const afterUndo = await saveProjectFiles(project, 'after-undo');
    expect(afterUndo.equals(before)).toBe(true);

    // Redo reapplies the whole plan.
    UndoQueue.instance.redo();
    expect(JSON.stringify(project.toJSON())).toBe(afterApply);
  });

  it('preflight refuses the WHOLE plan before any mutation — never a partial application', async () => {
    const project = loadProject();
    const operations = threeComponentPlan(project);
    // Sabotage one operation: its target vanishes between authoring and apply.
    project.removeComponent(project.getComponentWithName('/Pages/Profile')!);
    const before = JSON.stringify(project.toJSON());

    const error = await expectRejection(() => applyAuthoredPlan(project, operations));
    expect(error instanceof StagingError).toBe(true);

    // Nothing applied — not even the operations that could have succeeded.
    expect(JSON.stringify(project.toJSON())).toBe(before);
    expect(project.getComponentWithName('/Pages/Checkout')).toBeUndefined();
    expect(UndoQueue.instance.getHistory().length).toBe(0);
  });

  it('a doc operation with no writer at all refuses loudly, before any mutation', async () => {
    const project = loadProject();
    const before = JSON.stringify(project.toJSON());
    const operations: AppliedPlanOperation[] = [...threeComponentPlan(project), docOperation()];
    const error = await expectRejection(() => applyAuthoredPlan(project, operations));
    expect(error.message).toContain('no docs folder');
    expect(JSON.stringify(project.toJSON())).toBe(before);
    expect(UndoQueue.instance.getHistory().length).toBe(0);
  });

  it('criterion 7: the doc write rides the SAME undo group as the components', async () => {
    const project = loadProject();
    const before = JSON.stringify(project.toJSON());
    const docs = fakeDocWriter();
    const operations: AppliedPlanOperation[] = [...threeComponentPlan(project), docOperation()];

    const result = await applyAuthoredPlan(project, operations, { docWriter: docs.writer });
    expect(docs.file).toBe(PROPOSED);
    expect(result.docs).toEqual(['docs/ARCHITECTURE.md']);
    expect(UndoQueue.instance.getHistory().length).toBe(1);

    // One undo reverts components AND the doc write together.
    UndoQueue.instance.undo();
    expect(docs.file).toBe(BASELINE);
    expect(JSON.stringify(project.toJSON())).toBe(before);

    UndoQueue.instance.redo();
    expect(docs.file).toBe(PROPOSED);
    expect(project.getComponentWithName('/Pages/Checkout')).toBeDefined();
  });

  it('a doc whose file changed under the review refuses in preflight — the components stay unapplied', async () => {
    const project = loadProject();
    const before = JSON.stringify(project.toJSON());
    const docs = fakeDocWriter();
    // The user edited docs/ARCHITECTURE.md in another editor while reviewing.
    docs.file = 'Someone else got here first.\n';

    const operations: AppliedPlanOperation[] = [...threeComponentPlan(project), docOperation()];
    const error = await expectRejection(() => applyAuthoredPlan(project, operations, { docWriter: docs.writer }));
    expect(error.message).toContain('changed on disk');

    expect(docs.file).toBe('Someone else got here first.\n');
    expect(JSON.stringify(project.toJSON())).toBe(before);
    expect(UndoQueue.instance.getHistory().length).toBe(0);
  });

  it('a doc write that fails mid-apply rolls the whole plan back rather than leaving half of it', async () => {
    const project = loadProject();
    const before = JSON.stringify(project.toJSON());
    const docs = fakeDocWriter();
    docs.failOnApply = 'the disk is full';

    const operations: AppliedPlanOperation[] = [...threeComponentPlan(project), docOperation()];
    const error = await expectRejection(() => applyAuthoredPlan(project, operations, { docWriter: docs.writer }));
    expect(error.message).toContain('rolled back');

    expect(JSON.stringify(project.toJSON())).toBe(before);
    expect(project.getComponentWithName('/Pages/Checkout')).toBeUndefined();
    expect(UndoQueue.instance.getHistory().length).toBe(0);
  });

  it('a documentation-only plan is a real plan: no components, one doc, one undo step', async () => {
    const project = loadProject();
    const docs = fakeDocWriter();
    const result = await applyAuthoredPlan(project, [docOperation()], { docWriter: docs.writer });

    expect(result.components.size).toBe(0);
    expect(result.docs).toEqual(['docs/ARCHITECTURE.md']);
    expect(docs.file).toBe(PROPOSED);
    expect(UndoQueue.instance.getHistory().length).toBe(1);
    UndoQueue.instance.undo();
    expect(docs.file).toBe(BASELINE);
  });

  it('an empty accepted set refuses instead of pretending to apply', async () => {
    const project = loadProject();
    const error = await expectRejection(() => applyAuthoredPlan(project, []));
    expect(error instanceof StagingError).toBe(true);
  });

  // ── AIB-007 — the provision, and the undo boundary it introduces ───────────

  it('criterion 4 with a backend: one undo restores the project byte-for-byte, and the backend survives', async () => {
    const project = loadProject();
    // ⚠️ The corpus fixture is a Noodl Cloud project and already HAS an
    // endpoint. That is what makes it the right fixture for this: the assertion
    // is that undo restores what was there, not that it clears the field, and
    // the two only look the same on a project that had nothing.
    const originalEndpoint = getCloudServices(project).endpoint;
    expect(originalEndpoint).toBeDefined();
    const before = await saveProjectFiles(project, 'before-provision');
    const provisioner = fakeProvisioner();

    const operations: AppliedPlanOperation[] = [provisionOperation(), ...threeComponentPlan(project)];
    const result = await applyAuthoredPlan(project, operations, { provisioner: provisioner.provisioner });

    // The binding landed on the project…
    expect(getCloudServices(project).endpoint).toBe('http://localhost:9999');
    expect(result.backend?.collections).toEqual(['Message']);
    // …and the machine-level resource exists.
    expect(provisioner.created).toBe(true);
    expect(UndoQueue.instance.getHistory().length).toBe(1);

    UndoQueue.instance.undo();

    // The PROJECT is restored exactly — the binding is in the group.
    const afterUndo = await saveProjectFiles(project, 'after-undo-provision');
    expect(afterUndo.equals(before)).toBe(true);
    expect(getCloudServices(project).endpoint).toBe(originalEndpoint);
    // ⚠️ The backend is NOT deleted, and that is the design rather than a gap:
    // an undo that destroyed a database would be phase 38's own headline defect
    // pointed the other way. `describeSideEffects` is what makes it honest, and
    // the panel shows it before Apply.
    expect(provisioner.deleted).toBe(false);

    UndoQueue.instance.redo();
    expect(getCloudServices(project).endpoint).toBe('http://localhost:9999');
  });

  it('a plan carrying a provision with no provisioner refuses loudly, before any mutation', async () => {
    const project = loadProject();
    const before = JSON.stringify(project.toJSON());
    const operations: AppliedPlanOperation[] = [provisionOperation(), ...threeComponentPlan(project)];

    const error = await expectRejection(() => applyAuthoredPlan(project, operations));
    expect(error.message).toContain('no way to create a backend');
    expect(JSON.stringify(project.toJSON())).toBe(before);
    expect(UndoQueue.instance.getHistory().length).toBe(0);
  });

  it('a provision that refuses in preflight leaves the components unapplied', async () => {
    const project = loadProject();
    const before = JSON.stringify(project.toJSON());
    const provisioner = fakeProvisioner({ refuse: 'this project already points at somewhere else' });
    const operations: AppliedPlanOperation[] = [provisionOperation(), ...threeComponentPlan(project)];

    const error = await expectRejection(() =>
      applyAuthoredPlan(project, operations, { provisioner: provisioner.provisioner })
    );
    expect(error.message).toContain('already points at');
    expect(provisioner.created).toBe(false);
    expect(JSON.stringify(project.toJSON())).toBe(before);
    expect(project.getComponentWithName('/Pages/Checkout')).toBeUndefined();
  });

  it('two provisions in one plan are refused rather than applied in whatever order they arrived', async () => {
    const project = loadProject();
    const provisioner = fakeProvisioner();
    const second = { ...provisionOperation() };
    second.operation = { ...second.operation, id: 'op-9' };
    const error = await expectRejection(() =>
      applyAuthoredPlan(project, [provisionOperation(), second], { provisioner: provisioner.provisioner })
    );
    expect(error.message).toContain('two backends');
    expect(provisioner.created).toBe(false);
  });

  it('a component that fails after the provision rolls the project back, and says the backend stayed', async () => {
    const project = loadProject();
    const originalEndpoint = getCloudServices(project).endpoint;
    const provisioner = fakeProvisioner();
    const operations = [provisionOperation(), ...threeComponentPlan(project)];
    // Sabotage the create AFTER preflight has passed, so the failure happens
    // inside the mutation phase — the one path where a provision has already run.
    // `AppliedPlanComponentOperation` carries `kind: 'create' | 'update'`, so
    // `Extract` cannot narrow it — the cast is on the field we actually touch.
    const create = operations[1] as { files: { nodes: unknown } };
    const originalNodes = create.files.nodes;
    create.files.nodes = {
      get nodes(): never {
        throw new Error('sabotage');
      }
    };

    const error = await expectRejection(() =>
      applyAuthoredPlan(project, operations, { provisioner: provisioner.provisioner })
    );
    create.files.nodes = originalNodes;

    expect(error instanceof StagingError).toBe(true);
    // The project is clean: the binding's inverse ran with everything else.
    expect(getCloudServices(project).endpoint).toBe(originalEndpoint);
    expect(project.getComponentWithName('/Pages/Checkout')).toBeUndefined();
    // The backend is still on the machine. Nothing here pretends otherwise.
    expect(provisioner.created).toBe(true);
    expect(provisioner.deleted).toBe(false);
  });
});
