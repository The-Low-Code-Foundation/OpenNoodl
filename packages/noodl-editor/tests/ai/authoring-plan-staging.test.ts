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
  type AppliedPlanOperation
} from '../../src/editor/src/models/AiAssistant/authoring/planStaging';
import { StagingError } from '../../src/editor/src/models/AiAssistant/authoring/staging';
import type { AuthoringRequest, ComponentFiles } from '../../src/editor/src/models/AiAssistant/authoring/types';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';
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

describe('AIX-011 plan staging (the transaction)', () => {
  beforeEach(() => {
    UndoQueue.instance.clear();
  });

  it('criterion 4: apply a 3-component plan, undo ONCE, and the saved project files are byte-identical', async () => {
    const project = loadProject();
    const before = await saveProjectFiles(project, 'before');

    const operations = threeComponentPlan(project);
    const result = applyAuthoredPlan(project, operations);
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

  it('preflight refuses the WHOLE plan before any mutation — never a partial application', () => {
    const project = loadProject();
    const operations = threeComponentPlan(project);
    // Sabotage one operation: its target vanishes between authoring and apply.
    project.removeComponent(project.getComponentWithName('/Pages/Profile')!);
    const before = JSON.stringify(project.toJSON());

    expect(() => applyAuthoredPlan(project, operations)).toThrowError(StagingError);

    // Nothing applied — not even the operations that could have succeeded.
    expect(JSON.stringify(project.toJSON())).toBe(before);
    expect(project.getComponentWithName('/Pages/Checkout')).toBeUndefined();
    expect(UndoQueue.instance.getHistory().length).toBe(0);
  });

  it('a doc operation without the AIX-009 writer refuses loudly, before any mutation', () => {
    const project = loadProject();
    const before = JSON.stringify(project.toJSON());
    const operations: AppliedPlanOperation[] = [
      ...threeComponentPlan(project),
      { kind: 'doc', operation: { id: 'op-4', kind: 'doc', target: 'docs/ARCHITECTURE.md', intent: 'record it' } }
    ];
    expect(() => applyAuthoredPlan(project, operations)).toThrowError(/AIX-009/);
    expect(JSON.stringify(project.toJSON())).toBe(before);
    expect(UndoQueue.instance.getHistory().length).toBe(0);
  });

  it('with an injected doc writer, the doc write rides the SAME undo group (criterion 7 shape)', () => {
    const project = loadProject();
    const before = JSON.stringify(project.toJSON());
    // A stand-in for AIX-009's reviewed write path: something stateful whose
    // do/undo is recorded into the caller's group.
    const docState = { written: false };
    const docWriter = {
      apply: (_op: unknown, undoGroup: { pushAndDo: (a: { do?: () => void; undo?: () => void }) => void }) => {
        undoGroup.pushAndDo({
          do: () => (docState.written = true),
          undo: () => (docState.written = false)
        });
      }
    };
    const operations: AppliedPlanOperation[] = [
      ...threeComponentPlan(project),
      { kind: 'doc', operation: { id: 'op-4', kind: 'doc', target: 'docs/ARCHITECTURE.md', intent: 'record it' } }
    ];

    applyAuthoredPlan(project, operations, { docWriter });
    expect(docState.written).toBe(true);
    expect(UndoQueue.instance.getHistory().length).toBe(1);

    // One undo reverts components AND the doc write together.
    UndoQueue.instance.undo();
    expect(docState.written).toBe(false);
    expect(JSON.stringify(project.toJSON())).toBe(before);

    UndoQueue.instance.redo();
    expect(docState.written).toBe(true);
    expect(project.getComponentWithName('/Pages/Checkout')).toBeDefined();
  });

  it('an empty accepted set refuses instead of pretending to apply', () => {
    const project = loadProject();
    expect(() => applyAuthoredPlan(project, [])).toThrowError(StagingError);
  });
});
