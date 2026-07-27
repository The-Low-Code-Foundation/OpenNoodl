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
import { expectRejection } from './helpers';
import { UndoQueue } from '../../src/editor/src/models/undo-queue-model';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

function loadProject(): ProjectModel {
  return ProjectModel.fromJSON(JSON.parse(JSON.stringify(gitRepoUtf8)));
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

describe('AIX-011 plan staging (the transaction)', () => {
  beforeEach(() => {
    UndoQueue.instance.clear();
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
});
