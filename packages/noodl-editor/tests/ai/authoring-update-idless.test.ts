/**
 * AIX-011 live-pass residual — the id backfill, on REAL FILES.
 *
 * `buildCandidate` now supplies a `component.id` when the base has none,
 * because without one every candidate failed the schema check on a field
 * `submit_component` cannot express and the session could never converge. That
 * fix writes something into `project.json` that was not there before, so it is
 * a write-path change and deserves the treatment criterion 4 gets: a real
 * `ProjectModel`, saved through the product's own `project.toDirectory`, and
 * compared as raw bytes.
 *
 * `/App` is the right subject twice over. It is the one component of the
 * corpus's 44 whose entry has no `id`, and it is also the component holding the
 * project's root node — so an update to it exercises the root-restoration
 * branch of `updateAuthoredComponentInGroup`, which is exactly where a change
 * of component identity would bite if anything resolved the root that way.
 *
 * What the project actually keys on, checked here rather than assumed:
 * `rootNodeId` (a NODE id), and component references by NAME. `component.id`
 * has exactly one consumer, `ProjectExporter`'s v2 files.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import { buildComponentV2Files } from '../../src/editor/src/io/ProjectExporter';
import { buildCandidate } from '../../src/editor/src/models/AiAssistant/authoring/candidate';
import { applyAuthoredPlan, type AppliedPlanOperation } from '../../src/editor/src/models/AiAssistant/authoring/planStaging';
import { updateAuthoredComponent } from '../../src/editor/src/models/AiAssistant/authoring/staging';
import type { ComponentFiles } from '../../src/editor/src/models/AiAssistant/authoring/types';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';
import { UndoQueue } from '../../src/editor/src/models/undo-queue-model';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

const APP = '/App';

function loadProject(): ProjectModel {
  return ProjectModel.fromJSON(JSON.parse(JSON.stringify(gitRepoUtf8)));
}

/** Save through the product's own path; resolves to the project.json bytes. */
function saveProjectFiles(project: ProjectModel, label: string): Promise<Buffer> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `aix011-idless-${label}-`));
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

interface SavedComponent {
  name: string;
  id?: string;
  graph: { roots?: unknown[] };
}
interface SavedProject {
  components: SavedComponent[];
  rootNodeId?: string;
}

function parse(bytes: Buffer): SavedProject {
  return JSON.parse(bytes.toString('utf8')) as SavedProject;
}

function nodeIds(component: SavedComponent): string[] {
  const out: string[] = [];
  const walk = (nodes: unknown[] | undefined): void => {
    for (const node of nodes ?? []) {
      const n = node as { id: string; children?: unknown[] };
      out.push(n.id);
      walk(n.children);
    }
  };
  walk(component.graph.roots);
  return out;
}

function findNode(component: SavedComponent, type: string): { type: string; parameters?: Record<string, unknown> } | undefined {
  let found: { type: string; parameters?: Record<string, unknown> } | undefined;
  const walk = (nodes: unknown[] | undefined): void => {
    for (const node of nodes ?? []) {
      const n = node as { type: string; parameters?: Record<string, unknown>; children?: unknown[] };
      if (n.type === type) found = found ?? n;
      walk(n.children);
    }
  };
  walk(component.graph.roots);
  return found;
}

/**
 * The revision a live run produced: the Router's start page moved, everything
 * else resubmitted verbatim. Built from the base the same way the session
 * builds it, so the candidate carries the same identity question.
 */
function appRevision(project: ProjectModel): ComponentFiles {
  const existing = project.getComponentWithName(APP)!;
  expect(existing).toBeDefined();
  const base = buildComponentV2Files(existing.toJSON(), '2026-01-01T00:00:00.000Z') as ComponentFiles;
  expect(base.component.id).toBeUndefined();

  const result = buildCandidate(
    { description: 'open on Profile', componentPath: 'App' },
    {
      nodes: base.nodes.nodes.map((node) => {
        const submitted: Record<string, unknown> = {
          id: node.id,
          type: node.type,
          ...(node.parent !== undefined ? { parent: node.parent } : {}),
          ...(node.parameters ? { parameters: JSON.parse(JSON.stringify(node.parameters)) } : {}),
          ...(node.ports ? { ports: node.ports } : {})
        };
        if (node.type === 'Router') {
          const parameters = submitted.parameters as { pages: { routes: string[]; startPage: string } };
          parameters.pages = { ...parameters.pages, startPage: '/Pages/Profile' };
        }
        return submitted;
      }),
      connections: base.connections.connections.map((c) => ({
        fromId: c.fromId,
        fromProperty: c.fromProperty,
        toId: c.toId,
        toProperty: c.toProperty
      })),
      ...(base.nodes.visualRoots ? { visualRoots: base.nodes.visualRoots } : {})
    } as never,
    '2026-01-01T00:00:00.000Z',
    base
  );
  expect(result.errors).toEqual([]);
  return result.files!;
}

describe('AIX-011 — updating a component that has no id, on disk', () => {
  beforeEach(() => {
    UndoQueue.instance.clear();
  });

  it('the corpus premise: /App has no id and holds the project root', () => {
    const project = loadProject();
    const app = project.getComponentWithName(APP)!;
    expect(app).toBeDefined();
    expect(app.id).toBeUndefined();
    // The root is a NODE id, and it is one of /App's nodes — so this update is
    // the root-restoration path, not a bystander.
    expect(project.getRootNode()).toBeDefined();
    expect(project.getComponents().filter((c) => c.id === undefined).length).toBe(1);
  });

  it('saves the backfilled id, keeps the root and the routes, and undo restores the bytes', async () => {
    const project = loadProject();
    const before = await saveProjectFiles(project, 'before');
    const beforeJson = parse(before);
    const beforeApp = beforeJson.components.find((c) => c.name === APP)!;
    expect(beforeApp.id).toBeUndefined();
    const rootNodeId = beforeJson.rootNodeId;
    expect(rootNodeId).toBeDefined();

    updateAuthoredComponent(project, appRevision(project));

    const after = parse(await saveProjectFiles(project, 'after'));
    const afterApp = after.components.find((c) => c.name === APP)!;
    expect(afterApp).toBeDefined();

    // 1. The id is there, and it is a real one.
    expect(typeof afterApp.id).toBe('string');
    expect((afterApp.id as string).length > 0).toBe(true);

    // 2. It collides with nothing. Every component now has a distinct id.
    const ids = after.components.map((c) => c.id);
    expect(ids.filter((id) => id === undefined).length).toBe(0);
    expect(new Set(ids).size).toBe(after.components.length);

    // 3. The project root is untouched — it never keyed off the component id.
    expect(after.rootNodeId).toBe(rootNodeId);
    expect(nodeIds(afterApp).indexOf(rootNodeId!) !== -1).toBe(true);
    expect(project.getRootNode()!.id).toBe(rootNodeId);

    // 4. The routing survives the revision: the start page moved, the route
    //    list the agent had to preserve did not.
    const router = findNode(afterApp, 'Router')!;
    expect(router).toBeDefined();
    const pages = router.parameters!.pages as { routes: string[]; startPage: string };
    expect(pages.startPage).toBe('/Pages/Profile');
    expect(pages.routes).toEqual(['/Pages/Article', '/Pages/Profile']);

    // 5. One undo step, and the saved file is byte-identical to before —
    //    including the ABSENCE of the id, which is the half that could have
    //    leaked. Criterion 4's comparison, on the id-less case.
    expect(UndoQueue.instance.getHistory().length).toBe(1);
    UndoQueue.instance.undo();
    const afterUndo = await saveProjectFiles(project, 'after-undo');
    expect(afterUndo.equals(before)).toBe(true);
  });

  it('the same holds through the plan transaction', async () => {
    const project = loadProject();
    const before = await saveProjectFiles(project, 'plan-before');

    const operations: AppliedPlanOperation[] = [
      {
        kind: 'update',
        operation: { id: 'op-1', kind: 'update', target: 'App', intent: 'open on Profile' },
        files: appRevision(project)
      }
    ];
    await applyAuthoredPlan(project, operations);

    const after = parse(await saveProjectFiles(project, 'plan-after'));
    expect(typeof after.components.find((c) => c.name === APP)!.id).toBe('string');
    expect(after.rootNodeId).toBe(parse(before).rootNodeId);

    expect(UndoQueue.instance.getHistory().length).toBe(1);
    UndoQueue.instance.undo();
    expect((await saveProjectFiles(project, 'plan-after-undo')).equals(before)).toBe(true);
  });
});
