/**
 * AAQ-011 F12 (editor half) — does the editor's AI write path have the node-id
 * collision defect `noodl-mcp` just closed?
 *
 * The register row was filed as a QUESTION, not a defect: `candidate.ts` mints
 * an id only when the model omits one (`n.id ?? newId()`), but the editor has
 * four `rekeyAllIds()` callers and if the AI apply path reached one of them
 * there would be no bug at all. This spec is the measurement that settles it,
 * and it drives the REAL apply path — `acceptAuthoredComponent` and
 * `applyAuthoredPlan` — against a real `ProjectModel`, then reads what landed.
 *
 * The three collisions below are the three ways it can actually happen, in
 * order of how likely a live session is to produce them:
 *
 *  1. **Two operations of one plan.** The model writes `page`/`layout`/`title`
 *     into every page it authors, because those are the words. This is F12's
 *     finding verbatim, one client over.
 *  2. **Two sessions, one project.** The same, spread across two accepts.
 *  3. **Against a component that was already there.** The corpus's own ids.
 *
 * ⚠️ The consequence is not hypothetical and not merely a validator complaint:
 * `ProjectModel.findNodeWithId` (`projectmodel.ts:428`) is a project-wide,
 * FIRST-MATCH lookup, and it is what the viewer connection, the debug
 * inspector and the provenance panel resolve a node id through. A collision
 * means the runtime highlights, and the trace labels, the wrong node.
 */

import { buildCandidate, newId } from '../../src/editor/src/models/AiAssistant/authoring/candidate';
import { applyAuthoredPlan } from '../../src/editor/src/models/AiAssistant/authoring/planStaging';
import type { AppliedPlanComponentOperation } from '../../src/editor/src/models/AiAssistant/authoring/planStaging';
import type { PlanOperation } from '../../src/editor/src/models/AiAssistant/authoring/plan';
import { acceptAuthoredComponent } from '../../src/editor/src/models/AiAssistant/authoring/staging';
import type { AuthoringRequest, ComponentFiles } from '../../src/editor/src/models/AiAssistant/authoring/types';
import { validateCandidateComponent } from '../../src/editor/src/models/AiAssistant/authoring/validate';
import { fromProjectModel } from '../../src/editor/src/models/AiAssistant/explain/graph';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';
import { UndoQueue } from '../../src/editor/src/models/undo-queue-model';
import {
  buildComponentRefs,
  DiagnosticCode,
  normalizeV2Component,
  validateProject
} from '../../src/editor/src/validation';
import type { NormComponent } from '../../src/editor/src/validation';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

function loadProject(): ProjectModel {
  return ProjectModel.fromJSON(JSON.parse(JSON.stringify(gitRepoUtf8)));
}

/** The words a model actually writes. Identical in every page it authors. */
function pageFiles(componentPath: string, ids = ['page', 'layout', 'title']): ComponentFiles {
  const [pageId, layoutId, titleId] = ids;
  const request: AuthoringRequest = { description: `The ${componentPath} page.`, componentPath };
  const result = buildCandidate(request, {
    nodes: [
      { id: pageId, type: 'Page', parameters: { title: componentPath, urlPath: `/${titleId}-${pageId}` } },
      { id: layoutId, type: 'Group', parent: pageId },
      { id: titleId, type: 'Text', parent: layoutId, parameters: { text: componentPath } }
    ],
    visualRoots: [pageId]
  });
  expect(result.errors).toEqual([]);
  return result.files!;
}

function componentOp(id: string, kind: 'create' | 'update', target: string): PlanOperation {
  return { id, kind, target, intent: `Build ${target}.` };
}

/** Every (component, nodeId) pair the live project holds. */
function nodeIdsByComponent(project: ProjectModel): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const component of project.getComponents()) {
    const ids: string[] = [];
    component.graph.forEachNode((node: { id: string }) => {
      ids.push(node.id);
    });
    out.set(component.name, ids);
  }
  return out;
}

/** Node ids carried by more than one component of the live project. */
function crossComponentCollisions(project: ProjectModel): Map<string, string[]> {
  const carriers = new Map<string, string[]>();
  for (const [name, ids] of nodeIdsByComponent(project)) {
    for (const id of new Set(ids)) {
      const list = carriers.get(id) ?? [];
      list.push(name);
      carriers.set(id, list);
    }
  }
  return new Map([...carriers].filter(([, names]) => names.length > 1));
}

describe('AAQ-011 F12 (editor) — node ids the AI write path allocates', () => {
  beforeEach(() => {
    UndoQueue.instance.clear();
  });

  it('the apply path does NOT rekey: ids reach the project exactly as authored', () => {
    const project = loadProject();
    const component = acceptAuthoredComponent(project, pageFiles('Pages/Alpha'));

    // This is the whole question the register row asked. `rekeyAllIds()` mints
    // guids; these are the caller's words, verbatim.
    expect(nodeIdsByComponent(project).get('/Pages/Alpha')).toEqual(['page', 'layout', 'title']);
    expect(component.graph.findNodeWithId('page')).toBeDefined();
  });

  it('two accepts writing the same words collide in the live project', () => {
    const project = loadProject();
    expect(crossComponentCollisions(project).size).toBe(0);

    acceptAuthoredComponent(project, pageFiles('Pages/Alpha'));
    acceptAuthoredComponent(project, pageFiles('Pages/Beta'));

    const collisions = crossComponentCollisions(project);
    expect([...collisions.keys()].sort()).toEqual(['layout', 'page', 'title']);
    expect(collisions.get('page')!.sort()).toEqual(['/Pages/Alpha', '/Pages/Beta']);
  });

  it('one plan applying two pages collides inside a single transaction', async () => {
    const project = loadProject();
    const operations: AppliedPlanComponentOperation[] = [
      { kind: 'create', operation: componentOp('op-1', 'create', 'Pages/Alpha'), files: pageFiles('Pages/Alpha') },
      { kind: 'create', operation: componentOp('op-2', 'create', 'Pages/Beta'), files: pageFiles('Pages/Beta') }
    ];

    await applyAuthoredPlan(project, operations);

    expect([...crossComponentCollisions(project).keys()].sort()).toEqual(['layout', 'page', 'title']);
  });

  it('a candidate can collide with a component that was already in the project', () => {
    const project = loadProject();
    // /App's Router, straight out of the corpus.
    const existing = 'e9a5a4b0-557c-167c-a398-5cef585d856d';
    expect(project.getComponentWithName('/App')!.graph.findNodeWithId(existing)).toBeDefined();

    acceptAuthoredComponent(project, pageFiles('Pages/Alpha', ['page', existing, 'title']));

    expect(crossComponentCollisions(project).get(existing)!.sort()).toEqual(['/App', '/Pages/Alpha']);
  });

  it('the consequence: project-wide id resolution returns the WRONG node', () => {
    const project = loadProject();
    acceptAuthoredComponent(project, pageFiles('Pages/Alpha'));
    const alpha = project.findNodeWithId('title');
    acceptAuthoredComponent(project, pageFiles('Pages/Beta'));

    // `ProjectModel.findNodeWithId` is first-match across every component —
    // ViewerConnection, the debug inspector and the provenance panel all
    // resolve a runtime node id through it. Beta's `title` is unreachable.
    expect(project.findNodeWithId('title')).toBe(alpha);
    expect(project.getComponentWithName('/Pages/Beta')!.graph.findNodeWithId('title')).not.toBe(alpha);
  });

  it('the write gate does not see it — the same component-scoped hole as F12', () => {
    const project = loadProject();
    acceptAuthoredComponent(project, pageFiles('Pages/Alpha'));

    const graph = fromProjectModel(project);
    const files = pageFiles('Pages/Beta');
    const gate = validateCandidateComponent(graph, '/Pages/Beta', files);

    // Clean write…
    expect(gate.ok).toBe(true);
    expect(gate.summary.errors).toBe(0);
    expect(gate.diagnostics.filter((d) => d.code === DiagnosticCode.DuplicateNodeId).length).toBe(0);

    // …and a project-wide check of the very same project says otherwise.
    const components: NormComponent[] = [
      ...graph.components
        .filter((c) => c.name !== '/Pages/Beta')
        .map((c) => ({
          name: c.name,
          nodes: c.nodes.map((n) => ({
            id: n.id,
            type: n.type,
            label: n.label,
            parent: n.parent,
            children: [...n.children],
            instancePorts: [...n.instancePorts]
          })),
          connections: c.connections.map((x) => ({ ...x }))
        })),
      normalizeV2Component('/Pages/Beta', files.nodes, files.connections)
    ];
    const wide = validateProject(
      { components, componentRefs: buildComponentRefs(components.map((c) => c.name)) },
      { strict: true }
    );
    expect(wide.diagnostics.filter((d) => d.code === DiagnosticCode.DuplicateNodeId).length).toBeGreaterThan(0);
  });

  it('newId() is only reached when the model omits an id', () => {
    const request: AuthoringRequest = { description: 'x', componentPath: 'Pages/Idless' };
    const result = buildCandidate(request, { nodes: [{ type: 'Group' }] });
    expect(result.errors).toEqual([]);
    expect(result.files!.nodes.nodes[0].id).toBeDefined();
    expect(typeof newId()).toBe('string');
  });
});
