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
import { describePageRegistration } from '../../src/editor/src/models/AiAssistant/authoring/pageRegistration';
import { StagingError } from '../../src/editor/src/models/AiAssistant/authoring/staging';
import {
  mergeSchemaCollections,
  renderBackendSchema
} from '../../src/editor/src/models/AiAssistant/authoring/backendSchema';
import {
  findReusableBackend,
  planSchemaReconciliation
} from '../../src/editor/src/models/BackendServices/provisionBackend';
import {
  DEFAULT_PROVISIONED_BACKEND_NAME,
  backendNameForProject,
  emptyScope,
  provisionFromScope
} from '../../src/editor/src/models/AiAssistant/scoping';
import type { AuthoringRequest, ComponentFiles } from '../../src/editor/src/models/AiAssistant/authoring/types';
import { NodeGraphNode } from '../../src/editor/src/models/nodegraphmodel/NodeGraphNode';
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

/**
 * AAQ-001 — a created page is reachable.
 *
 * Richard applied a whole plan and got *"page router has no pages"*: a page
 * component is not a page until a Router lists it, and nothing in the AI stack
 * had ever heard of the Router. These specs assert the apply closes it, in the
 * same undo step as everything else, without ever touching a router the plan had
 * no business touching.
 *
 * The corpus fixture's App holds `Router { routes: [/Pages/Article,
 * /Pages/Profile], startPage: /Pages/Article }`, so it exercises the case that
 * matters most: a project whose home page is real work, which an apply must
 * never move.
 */
function routerPages(project: ProjectModel): { startPage?: string; routes: string[] } {
  const app = project.getComponentWithName('/App')!;
  let value: { startPage?: string; routes: string[] } | undefined;
  app.graph.forEachNode((node) => {
    if (node.typename === 'Router') value = node.parameters['pages'];
  });
  return value!;
}

describe('AAQ-001 — the apply registers the pages it created', () => {
  beforeEach(() => {
    UndoQueue.instance.clear();
    currentProject = undefined;
  });

  it('lists a created page in the router, and one undo takes both back', async () => {
    const project = loadProject();
    const before = await saveProjectFiles(project, 'aaq001-before');
    expect(routerPages(project).routes).toEqual(['/Pages/Article', '/Pages/Profile']);

    const result = await applyAuthoredPlan(project, threeComponentPlan(project));

    expect(routerPages(project).routes).toEqual(['/Pages/Article', '/Pages/Profile', '/Pages/Checkout']);
    expect(result.registration?.added).toEqual(['/Pages/Checkout']);
    // The fixture's start page is a page someone built. It is not up for grabs.
    expect(routerPages(project).startPage).toBe('/Pages/Article');
    expect(result.registration?.startPage).toBeUndefined();

    // Still ONE undo step for the whole plan, registration included — and the
    // saved bytes are the proof, not the model's own idea of its state.
    expect(UndoQueue.instance.getHistory().length).toBe(1);
    UndoQueue.instance.undo();
    expect(routerPages(project).routes).toEqual(['/Pages/Article', '/Pages/Profile']);
    expect((await saveProjectFiles(project, 'aaq001-undo')).equals(before)).toBe(true);
  });

  it('registers nothing when the page is already routed — an agent that wrote the router update loses nothing', async () => {
    const project = loadProject();
    // The plan updates two pages the router already lists, and creates nothing.
    const operations: AppliedPlanOperation[] = [
      {
        kind: 'update',
        operation: { id: 'op-1', kind: 'update', target: 'Pages/Article', intent: 'restyle' },
        files: updateFiles(project, '/Pages/Article')
      }
    ];
    const before = JSON.stringify(routerPages(project));

    const result = await applyAuthoredPlan(project, operations);

    expect(result.registration).toBeUndefined();
    expect(JSON.stringify(routerPages(project))).toBe(before);
  });

  it('does not touch the router for a component that is not a page', async () => {
    const project = loadProject();
    const operations: AppliedPlanOperation[] = [
      {
        kind: 'create',
        operation: { id: 'op-1', kind: 'create', target: 'Visual Components/Badge', intent: 'a badge' },
        files: createFiles('Visual Components/Badge')
      }
    ];
    const before = JSON.stringify(routerPages(project));

    const result = await applyAuthoredPlan(project, operations);

    expect(project.getComponentWithName('/Visual Components/Badge')).toBeDefined();
    expect(result.registration).toBeUndefined();
    expect(JSON.stringify(routerPages(project))).toBe(before);
  });

  it('moves the start page off an EMPTY placeholder home — the freshly created project case', async () => {
    const project = loadProject();
    // Make the fixture's start page what a new project's Home actually is: a
    // page component with nothing built in it. `/Pages/Article` keeps its name
    // and its registration; only its content goes.
    const article = project.getComponentWithName('/Pages/Article')!;
    for (const root of [...article.graph.roots]) article.graph.removeNode(root);

    const result = await applyAuthoredPlan(project, [
      {
        kind: 'create',
        operation: { id: 'op-1', kind: 'create', target: 'Pages/Checkout', intent: 'the real first page' },
        files: createFiles('Pages/Checkout')
      }
    ]);

    expect(routerPages(project).startPage).toBe('/Pages/Checkout');
    expect(result.registration?.startPage).toBe('/Pages/Checkout');
    // The placeholder is still routed — unregistering a component is a
    // destructive decision this apply does not make.
    expect(routerPages(project).routes).toContain('/Pages/Article');
  });

  /**
   * The spec above cleared the component's roots entirely, which is a state the
   * product never produces — and that is why this defect survived it. A freshly
   * created project's Home is `hello-world.template.ts`'s: a `Page` node with a
   * `Text` child reading "Hello World!". Against the original "root has no
   * children" test that is not a placeholder, so the start page never moved and
   * every app the wizard built opened on Hello World with its real pages
   * registered and unreachable-by-default behind it. Found by driving the
   * launcher, not by reading the code.
   */
  it("moves the start page off the template's ACTUAL home — one Page node with a Text in it", async () => {
    const project = loadProject();
    const article = project.getComponentWithName('/Pages/Article')!;
    for (const root of [...article.graph.roots]) article.graph.removeNode(root);
    const page = NodeGraphNode.fromJSON({
      id: 'tmpl-page',
      type: 'Page',
      x: 100,
      y: 100,
      parameters: { title: 'Home', urlPath: 'home' },
      children: [
        { id: 'tmpl-text', type: 'Text', x: 100, y: 100, parameters: { text: 'Hello World!' }, children: [] }
      ]
    });
    article.graph.addRoot(page);

    const result = await applyAuthoredPlan(project, [
      {
        kind: 'create',
        operation: { id: 'op-1', kind: 'create', target: 'Pages/Checkout', intent: 'the real first page' },
        files: createFiles('Pages/Checkout')
      }
    ]);

    expect(routerPages(project).startPage).toBe('/Pages/Checkout');
    expect(result.registration?.startPage).toBe('/Pages/Checkout');
  });

  it('still refuses to take home from a page with anything real in it', async () => {
    const project = loadProject();
    const article = project.getComponentWithName('/Pages/Article')!;
    for (const root of [...article.graph.roots]) article.graph.removeNode(root);
    // One Group instead of one Text: somebody has started laying this page out.
    article.graph.addRoot(
      NodeGraphNode.fromJSON({
        id: 'built-page',
        type: 'Page',
        x: 100,
        y: 100,
        parameters: {},
        children: [{ id: 'built-group', type: 'Group', x: 100, y: 100, parameters: {}, children: [] }]
      })
    );

    const result = await applyAuthoredPlan(project, [
      {
        kind: 'create',
        operation: { id: 'op-1', kind: 'create', target: 'Pages/Checkout', intent: 'another page' },
        files: createFiles('Pages/Checkout')
      }
    ]);

    expect(routerPages(project).startPage).toBe('/Pages/Article');
    expect(result.registration?.startPage).toBeUndefined();
  });

  it('AAQ-003: writes the scroll setting the plan agreed, and one undo takes it back with the rest', async () => {
    const project = loadProject();
    expect(project.getSettings().bodyScroll).toBeUndefined();

    const result = await applyAuthoredPlan(project, threeComponentPlan(project), {
      settings: { bodyScroll: true }
    });

    expect(result.settings).toEqual(['bodyScroll']);
    expect(project.getSettings().bodyScroll).toBe(true);

    expect(UndoQueue.instance.getHistory().length).toBe(1);
    UndoQueue.instance.undo();
    expect(project.getSettings().bodyScroll).toBeUndefined();
    UndoQueue.instance.redo();
    expect(project.getSettings().bodyScroll).toBe(true);
  });

  it('AAQ-003: never overrides a setting the project already has a value for', async () => {
    const project = loadProject();
    // Someone went to Project Settings and switched it off. That is a decision.
    project.setSetting('bodyScroll', false);

    const result = await applyAuthoredPlan(project, threeComponentPlan(project), {
      settings: { bodyScroll: true }
    });

    expect(result.settings).toBeUndefined();
    expect(project.getSettings().bodyScroll).toBe(false);
  });

  it('says what it did, in the sentence the panel shows', async () => {
    const project = loadProject();
    const result = await applyAuthoredPlan(project, threeComponentPlan(project));
    const sentence = describePageRegistration(result.registration!, { applied: true });

    expect(sentence).toContain('Checkout');
    expect(sentence).toContain('Main');
    expect(sentence.indexOf('will be')).toBe(-1);
  });
});

/**
 * AAQ-002/F4 — a backend belongs to one project.
 *
 * These are the two halves of the live defect Richard hit: reuse matched on a
 * name that was a *constant*, so every AI-created project on a machine bound to
 * the first backend ever provisioned there, and the collections of three
 * unrelated apps sat in one datastore.
 */
describe('AAQ-002/F4 — findReusableBackend', () => {
  const owned = { id: 'b1', name: 'Puppies backend', port: 8577, projectIds: ['project-a'] };
  const otherProjects = { id: 'b2', name: 'Puppies backend', port: 8578, projectIds: ['project-b'] };
  /** Every backend that predates the stamp, and every one made by hand. */
  const unowned = { id: 'b3', name: 'App backend', port: 8579, projectIds: [] };

  it('reuses the backend this project owns', () => {
    expect(findReusableBackend([otherProjects, owned], 'Puppies backend', 'project-a')).toBe(owned);
  });

  it('⚠️ never reuses a backend another project owns', () => {
    // The whole defect in one line: same name, different project.
    expect(findReusableBackend([otherProjects], 'Puppies backend', 'project-a')).toBeUndefined();
  });

  it('⚠️ never adopts an unowned backend, however well the name matches', () => {
    // A legacy "App backend" carrying three apps' collections is exactly what
    // must not be picked up again — an empty `projectIds` is owned by nobody.
    expect(findReusableBackend([unowned], 'App backend', 'project-a')).toBeUndefined();
  });

  it('gives a renamed backend a wide berth — the rule that was already here', () => {
    expect(findReusableBackend([owned], 'Adoption backend', 'project-a')).toBeUndefined();
  });

  it('does not reuse at all when there is no project id', () => {
    expect(findReusableBackend([owned, unowned], 'Puppies backend', undefined)).toBeUndefined();
  });

  it('matches the name case- and whitespace-insensitively, as it always did', () => {
    expect(findReusableBackend([owned], '  puppies BACKEND ', 'project-a')).toBe(owned);
  });
});

/**
 * AAQ-002/F5 — what a reused collection needs to match the plan.
 *
 * `createTable` returns `created: false` for a collection that exists and adds
 * nothing, so an auto-created collection keeps its zero columns — and a
 * collection with no columns yields no `prop-*` ports, forever. That is finding
 * #7's live cause, and this is the difference the provisioner then applies.
 */
describe('AAQ-002/F5 — planSchemaReconciliation', () => {
  it('adds the columns a collection that already exists is missing', () => {
    const plan = planSchemaReconciliation(
      [{ name: 'name', type: 'String' }],
      [
        { name: 'name', type: 'String' },
        { name: 'age', type: 'Number' },
        { name: 'bio', type: 'String' }
      ]
    );

    expect(plan.add.map((c) => c.name)).toEqual(['age', 'bio']);
    expect(plan.retype).toEqual([]);
  });

  it('treats the zero-column collection — the live case — as all-missing', () => {
    const plan = planSchemaReconciliation([], [{ name: 'age', type: 'Number' }]);

    expect(plan.add.map((c) => c.name)).toEqual(['age']);
  });

  it('retypes a column the plan disagrees with', () => {
    const plan = planSchemaReconciliation([{ name: 'age', type: 'String' }], [{ name: 'age', type: 'Number' }]);

    expect(plan.add).toEqual([]);
    expect(plan.retype).toEqual([{ name: 'age', from: 'String', to: 'Number' }]);
  });

  it('counts an untyped existing column as a mismatch, not a match', () => {
    // The shape an auto-created collection has. Leaving it is how the ports stay
    // wrong even once the column exists.
    const plan = planSchemaReconciliation([{ name: 'age' }], [{ name: 'age', type: 'Number' }]);

    expect(plan.retype).toEqual([{ name: 'age', from: 'untyped', to: 'Number' }]);
  });

  it('⚠️ matches names case-insensitively, and keeps the EXISTING spelling', () => {
    // SQLite identifiers are case-insensitive, so `ADD COLUMN age` against a
    // table holding `Age` fails with `duplicate column name` — which
    // `SchemaManager.addColumn` swallows. A case-sensitive comparison here would
    // emit an addition that silently does nothing and reports success.
    const plan = planSchemaReconciliation([{ name: 'Age', type: 'String' }], [{ name: 'age', type: 'Number' }]);

    expect(plan.add).toEqual([]);
    expect(plan.retype).toEqual([{ name: 'Age', from: 'String', to: 'Number' }]);
  });

  it('never touches the columns the backend owns', () => {
    const plan = planSchemaReconciliation(
      [],
      [
        { name: 'objectId', type: 'String' },
        { name: 'createdAt', type: 'Date' },
        { name: 'ACL', type: 'Object' },
        { name: 'age', type: 'Number' }
      ]
    );

    expect(plan.add.map((c) => c.name)).toEqual(['age']);
  });

  it('asks for nothing when the collection already matches', () => {
    const plan = planSchemaReconciliation(
      [
        { name: 'name', type: 'String' },
        { name: 'age', type: 'Number' }
      ],
      [
        { name: 'name', type: 'String' },
        { name: 'age', type: 'Number' }
      ]
    );

    expect(plan.add).toEqual([]);
    expect(plan.retype).toEqual([]);
  });

  it('leaves a column the plan does not mention alone', () => {
    // Additive in the other direction: reconcile means "make the plan's columns
    // right", never "delete what someone else added".
    const plan = planSchemaReconciliation(
      [
        { name: 'age', type: 'Number' },
        { name: 'nickname', type: 'String' }
      ],
      [{ name: 'age', type: 'Number' }]
    );

    expect(plan.add).toEqual([]);
    expect(plan.retype).toEqual([]);
  });
});

/**
 * AAQ-002/F4 — the other half: the name a provision gives its backend. The list
 * in Backend Services is machine-wide, so the name is the only thing telling a
 * human which app a backend belongs to, and it was the constant "App backend".
 */
describe('AAQ-002/F4 — backendNameForProject', () => {
  it('names the backend after the project', () => {
    expect(backendNameForProject('Puppy Adoption')).toBe('Puppy Adoption backend');
  });

  it('does not say backend twice', () => {
    expect(backendNameForProject('Chat Backend')).toBe('Chat Backend');
  });

  it('falls back rather than producing a bare " backend"', () => {
    expect(backendNameForProject('   ')).toBe(DEFAULT_PROVISIONED_BACKEND_NAME);
    expect(backendNameForProject(undefined)).toBe(DEFAULT_PROVISIONED_BACKEND_NAME);
  });

  it('is what the plan actually names the provision', () => {
    const scope = {
      ...emptyScope(),
      request: 'a puppy adoption site',
      objects: [{ name: 'Puppy', fields: ['age'] }],
      backend: { kind: 'nodegx' as const, description: 'built-in' }
    };

    const spec = provisionFromScope(scope, { backendName: backendNameForProject('Puppy Adoption') });

    expect(spec?.name).toBe('Puppy Adoption backend');
  });
});

/**
 * AAQ-002 slice 4 — the collections the agent is told about.
 *
 * The context builder carried no backend block at all, so an agent authoring a
 * Create Record node wrote `prop-<field>` parameters from the scope's prose.
 * These pin the two halves that made a naive fix wrong: the list has two sources
 * (a wizard-built project has no backend at authoring time), and the block has to
 * name `collectionName` — the parameter a careful reader with the source open
 * still got wrong during the live pass.
 */
describe('AAQ-002 slice 4 — mergeSchemaCollections', () => {
  it('takes the planned collections when the project has no backend yet', () => {
    // The live sequence for every wizard-built project: the provision is an
    // operation in the same plan and applies AFTER every authoring turn.
    const merged = mergeSchemaCollections(
      [{ name: 'Puppy', fields: [{ name: 'age', type: 'Number' }] }],
      []
    );

    expect(merged).toEqual([{ name: 'Puppy', fields: [{ name: 'age', type: 'Number' }] }]);
  });

  it('takes the cached collections when there is no provision', () => {
    const merged = mergeSchemaCollections([], [{ name: 'Puppy', fields: [{ name: 'age', type: 'Number' }] }]);

    expect(merged.map((c) => c.name)).toEqual(['Puppy']);
  });

  it('unions the fields of a collection that is in both', () => {
    const merged = mergeSchemaCollections(
      [{ name: 'Puppy', fields: [{ name: 'bio', type: 'String' }] }],
      [{ name: 'Puppy', fields: [{ name: 'age', type: 'Number' }] }]
    );

    expect(merged.length).toBe(1);
    expect(merged[0].fields.map((f) => f.name)).toEqual(['age', 'bio']);
  });

  it('lets the plan win on a field the two disagree about', () => {
    // The plan is the newer statement of intent, and the user approved it.
    const merged = mergeSchemaCollections(
      [{ name: 'Puppy', fields: [{ name: 'age', type: 'Number' }] }],
      [{ name: 'Puppy', fields: [{ name: 'age', type: 'String' }] }]
    );

    expect(merged[0].fields).toEqual([{ name: 'age', type: 'Number' }]);
  });

  it('⚠️ treats names case-insensitively, so no port is listed twice', () => {
    const merged = mergeSchemaCollections(
      [{ name: 'puppy', fields: [{ name: 'Age', type: 'Number' }] }],
      [{ name: 'Puppy', fields: [{ name: 'age', type: 'String' }] }]
    );

    expect(merged.length).toBe(1);
    expect(merged[0].fields.length).toBe(1);
  });

  it('drops a nameless collection rather than listing one the agent cannot use', () => {
    const merged = mergeSchemaCollections([{ name: '  ', fields: [] }], []);

    expect(merged).toEqual([]);
  });
});

describe('AAQ-002 slice 4 — renderBackendSchema', () => {
  it('is omitted entirely for a project with nothing', () => {
    // Absent means omitted: such a project sends a byte-identical opening turn
    // to before, which is what keeps AIX-007's cache prefix intact.
    expect(renderBackendSchema([])).toBeUndefined();
  });

  it('names the collections and their field types', () => {
    const text = renderBackendSchema([
      {
        name: 'Puppy',
        fields: [
          { name: 'name', type: 'String' },
          { name: 'age', type: 'Number' }
        ]
      }
    ])!;

    expect(text).toContain('Puppy');
    expect(text).toContain('name (String)');
    expect(text).toContain('age (Number)');
  });

  it('⚠️ names collectionName, and says collection is ignored', () => {
    // The live-pass defect: `resolveSchemaPortContext`'s own default is
    // `collection`, the Record family passes `collectionName`, and setting the
    // wrong one is completely inert with nothing to diagnose it.
    const text = renderBackendSchema([{ name: 'Puppy', fields: [] }])!;

    expect(text).toContain('collectionName');
    expect(text).toContain('ignored');
  });

  it('teaches the prop- prefix, which no catalog entry declares', () => {
    const text = renderBackendSchema([{ name: 'Puppy', fields: [{ name: 'name', type: 'String' }] }])!;

    expect(text).toContain('prop-');
  });

  it('says a collection has no fields rather than rendering an empty line', () => {
    const text = renderBackendSchema([{ name: 'Puppy', fields: [] }])!;

    expect(text).toContain('no fields declared yet');
  });

  it('tells the agent not to write the backend-owned fields', () => {
    const text = renderBackendSchema([{ name: 'Puppy', fields: [] }])!;

    expect(text).toContain('objectId');
    expect(text).toContain('never write them');
  });
});
