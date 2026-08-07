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
 *
 * ── What this file asserts now ───────────────────────────────────────────────
 *
 * The reproduction landed FIRST, in `ef95e9b1`, asserting the collisions — so
 * the defect is on the record as measured rather than as claimed. This is the
 * same drive with the assertions turned round, plus the controls the fix needs:
 * that the rewrite carries wires, parents and the visual root with it (checked
 * off the LIVE component, through the editor's own loader, because a rewrite
 * that lost a wire would be worse than the defect); that an update keeps every
 * id it already had; that a pre-existing collision is neither fixed nor
 * worsened; and that the gate-scope hole F12 deliberately left open is still
 * open, asserted rather than assumed.
 */

import { buildCandidate, newId } from '../../src/editor/src/models/AiAssistant/authoring/candidate';
import { applyAuthoredPlan } from '../../src/editor/src/models/AiAssistant/authoring/planStaging';
import type { AppliedPlanComponentOperation } from '../../src/editor/src/models/AiAssistant/authoring/planStaging';
import type { PlanOperation } from '../../src/editor/src/models/AiAssistant/authoring/plan';
import { allocateCollisionFreeIds } from '../../src/editor/src/models/AiAssistant/authoring/nodeIds';
import type { NodeIdRemap } from '../../src/editor/src/models/AiAssistant/authoring/nodeIds';
import {
  acceptAuthoredComponent,
  updateAuthoredComponent
} from '../../src/editor/src/models/AiAssistant/authoring/staging';
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

/**
 * The words a model actually writes. Identical in every page it authors —
 * which is the whole finding.
 *
 * The `source → title` wire and the `page → layout → title` nesting are here on
 * purpose: a reallocation that renamed a node and left a wire or a `parent`
 * pointing at the old id would be a far worse defect than the one being fixed,
 * and every spec below reads them back off the LIVE component, through the
 * editor's own `reconstructLegacyComponent` loader.
 */
function pageFiles(componentPath: string, ids = ['page', 'layout', 'title', 'source']): ComponentFiles {
  const [pageId, layoutId, titleId, sourceId] = ids;
  const request: AuthoringRequest = { description: `The ${componentPath} page.`, componentPath };
  const result = buildCandidate(request, {
    nodes: [
      { id: pageId, type: 'Page', parameters: { title: componentPath, urlPath: `/${componentPath.toLowerCase()}` } },
      { id: layoutId, type: 'Group', parent: pageId },
      { id: titleId, type: 'Text', parent: layoutId, parameters: { text: componentPath } },
      { id: sourceId, type: 'String', parameters: { value: componentPath } }
    ],
    connections: [{ fromId: sourceId, fromProperty: 'value', toId: titleId, toProperty: 'text' }],
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

/** The live component's wires, as they actually landed. */
function wiresOf(project: ProjectModel, legacyName: string): string[] {
  const component = project.getComponentWithName(legacyName)!;
  return component.graph.connections.map(
    (c: { fromId: string; fromProperty: string; toId: string; toProperty: string }) =>
      `${c.fromId}.${c.fromProperty} -> ${c.toId}.${c.toProperty}`
  );
}

/** A node's parent id on the live component, or undefined for a root. */
function parentOf(project: ProjectModel, legacyName: string, nodeId: string): string | undefined {
  const node = project.getComponentWithName(legacyName)!.graph.findNodeWithId(nodeId);
  return node?.parent?.id;
}

describe('AAQ-011 F12 (editor) — node ids an AI write introduces', () => {
  beforeEach(() => {
    UndoQueue.instance.clear();
  });

  it('are kept verbatim when nothing collides — the apply path never rekeys', () => {
    const project = loadProject();
    const component = acceptAuthoredComponent(project, pageFiles('Pages/Alpha'));

    // The register row's actual question. The four `rekeyAllIds()` callers —
    // `duplicateComponent`, `ComponentTemplates`, `RouterAdapter` and the import
    // engine — mint guids; the AI path reaches none of them, and these are the
    // model's own words. That is *correct* behaviour and must not change: the
    // fix is targeted at collisions, not at ids.
    expect(nodeIdsByComponent(project).get('/Pages/Alpha')).toEqual(['page', 'layout', 'title', 'source']);
    expect(component.graph.findNodeWithId('page')).toBeDefined();
  });

  it('are reallocated, keeping the word, when another component already uses them', () => {
    const project = loadProject();
    expect(crossComponentCollisions(project).size).toBe(0);

    acceptAuthoredComponent(project, pageFiles('Pages/Alpha'));
    acceptAuthoredComponent(project, pageFiles('Pages/Beta'));

    // Before the fix this was `['layout', 'page', 'source', 'title']` — measured,
    // then committed as the reproduction, before a line of the fix existed.
    expect([...crossComponentCollisions(project).keys()]).toEqual([]);
    expect(nodeIdsByComponent(project).get('/Pages/Alpha')).toEqual(['page', 'layout', 'title', 'source']);
    // `title` → `title-2`, not a uuid: the word is what a human reads in a diff.
    expect(nodeIdsByComponent(project).get('/Pages/Beta')).toEqual(['page-2', 'layout-2', 'title-2', 'source-2']);
  });

  it('carry their wires, parents and visual root with them', () => {
    const project = loadProject();
    acceptAuthoredComponent(project, pageFiles('Pages/Alpha'));
    const component = acceptAuthoredComponent(project, pageFiles('Pages/Beta'));

    // Read back off the LIVE component, i.e. after `reconstructLegacyComponent`
    // and `ComponentModel.fromJSON`. A rewrite that lost a wire is the real risk
    // of this fix, and it is checked against the editor's own loader.
    expect(wiresOf(project, '/Pages/Beta')).toEqual(['source-2.value -> title-2.text']);
    expect(parentOf(project, '/Pages/Beta', 'title-2')).toBe('layout-2');
    expect(parentOf(project, '/Pages/Beta', 'layout-2')).toBe('page-2');
    // `graph.roots`, not `getVisualRootIds()`: the latter filters on
    // `root.type.allowAsChild`, which needs the node library loaded and answers
    // `[]` in this suite — a green assertion that proves nothing.
    expect(component.graph.roots.map((r: { id: string }) => r.id)).toEqual(['page-2', 'source-2']);
  });

  it('rewrite the declared visual roots, which nothing downstream re-derives', () => {
    // Asserted on the files rather than the model because `NodeGraphModel`
    // *derives* its visual roots (`getVisualRootIds()` filters `roots`) — the
    // stored `visualRoots[]` only exists in the v2 files, and it is the copy an
    // update's root restore reads (`updateAuthoredComponentInGroup`).
    const files = pageFiles('Pages/Beta');
    const result = allocateCollisionFreeIds(files, new Set(['page']));
    expect(result.files.nodes.visualRoots).toEqual(['page-2']);
    expect(files.nodes.visualRoots).toEqual(['page']);
  });

  it('are deconflicted per operation inside one plan transaction', async () => {
    const project = loadProject();
    const operations: AppliedPlanComponentOperation[] = [
      { kind: 'create', operation: componentOp('op-1', 'create', 'Pages/Alpha'), files: pageFiles('Pages/Alpha') },
      { kind: 'create', operation: componentOp('op-2', 'create', 'Pages/Beta'), files: pageFiles('Pages/Beta') }
    ];

    const result = await applyAuthoredPlan(project, operations);

    // No overlay bookkeeping: operations apply in sequence, so op-1's ids are in
    // the project by the time op-2 is staged and simply count as taken.
    expect([...crossComponentCollisions(project).keys()]).toEqual([]);
    expect(result.remappedNodeIds!.get('op-1')).toBeUndefined();
    expect(result.remappedNodeIds!.get('op-2')!.map((r) => `${r.from}->${r.to}`)).toEqual([
      'page->page-2',
      'layout->layout-2',
      'title->title-2',
      'source->source-2'
    ]);
    expect(wiresOf(project, '/Pages/Beta')).toEqual(['source-2.value -> title-2.text']);
  });

  it('are reallocated against components that were already in the project', () => {
    const project = loadProject();
    // /App's Router, straight out of the corpus.
    const existing = 'e9a5a4b0-557c-167c-a398-5cef585d856d';
    expect(project.getComponentWithName('/App')!.graph.findNodeWithId(existing)).toBeDefined();

    const remaps: NodeIdRemap[] = [];
    acceptAuthoredComponent(project, pageFiles('Pages/Alpha', ['page', existing, 'title', 'source']), {
      onNodeIdsRemapped: (r) => remaps.push(...r)
    });

    expect(crossComponentCollisions(project).size).toBe(0);
    expect(remaps.length).toBe(1);
    expect(remaps[0].from).toBe(existing);
    expect(parentOf(project, '/Pages/Alpha', 'title')).toBe(remaps[0].to);
    expect(project.getComponentWithName('/App')!.graph.findNodeWithId(existing)).toBeDefined();
  });

  it('leave project-wide id resolution unambiguous', () => {
    const project = loadProject();
    acceptAuthoredComponent(project, pageFiles('Pages/Alpha'));
    const alpha = project.findNodeWithId('title');
    acceptAuthoredComponent(project, pageFiles('Pages/Beta'));

    // `ProjectModel.findNodeWithId` (projectmodel.ts:428) is first-match across
    // every component, and it is what `ViewerConnection`, the debug inspector
    // and the provenance panel resolve a runtime node id through. Before the
    // fix, Beta's `title` was unreachable through it and Alpha's answered in its
    // place — the editor highlighting the wrong node, not a validator complaint.
    expect(project.findNodeWithId('title')).toBe(alpha);
    expect(project.findNodeWithId('title-2')).toBe(
      project.getComponentWithName('/Pages/Beta')!.graph.findNodeWithId('title-2')
    );
  });

  it('do not change what undo restores', () => {
    const project = loadProject();
    acceptAuthoredComponent(project, pageFiles('Pages/Alpha'));
    const before = JSON.stringify(project.toJSON());

    acceptAuthoredComponent(project, pageFiles('Pages/Beta'));
    const after = JSON.stringify(project.toJSON());
    expect(after).not.toBe(before);

    UndoQueue.instance.undo();
    expect(JSON.stringify(project.toJSON())).toBe(before);
    UndoQueue.instance.redo();
    expect(JSON.stringify(project.toJSON())).toBe(after);
  });

  it('an update keeps every id the component already had', () => {
    const project = loadProject();
    acceptAuthoredComponent(project, pageFiles('Pages/Alpha'));

    // Re-author /Pages/Alpha with its own ids. They collide with nothing but
    // themselves, and an update that renamed them would turn the review's
    // modifications into a wholesale remove-and-re-add.
    const revision = pageFiles('Pages/Alpha');
    revision.component.id = project.getComponentWithName('/Pages/Alpha')!.id;
    const remaps: NodeIdRemap[] = [];
    updateAuthoredComponent(project, revision, { onNodeIdsRemapped: (r) => remaps.push(...r) });

    expect(remaps).toEqual([]);
    expect(nodeIdsByComponent(project).get('/Pages/Alpha')).toEqual(['page', 'layout', 'title', 'source']);
  });

  it('a pre-existing collision is neither fixed nor made worse', () => {
    const project = loadProject();
    // Plant one by hand, the way a hand-merged project carries one.
    const shared = 'e9a5a4b0-557c-167c-a398-5cef585d856d';
    acceptAuthoredComponent(project, pageFiles('Pages/Alpha'));
    const alpha = project.getComponentWithName('/Pages/Alpha')!;
    alpha.graph.findNodeWithId('page').id = shared;

    const revision = pageFiles('Pages/Alpha', [shared, 'layout', 'title', 'source']);
    revision.component.id = alpha.id;
    updateAuthoredComponent(project, revision);

    // Still there — the gate's rule is "don't make it worse", not "tidy the
    // project" — and nothing else moved.
    expect(crossComponentCollisions(project).get(shared)!.sort()).toEqual(['/App', '/Pages/Alpha']);
    expect(nodeIdsByComponent(project).get('/Pages/Alpha')).toEqual([shared, 'layout', 'title', 'source']);
  });
});

describe('AAQ-011 F12 (editor) — the allocator itself, and the hole it does NOT close', () => {
  beforeEach(() => {
    UndoQueue.instance.clear();
  });

  it('is a no-op when nothing is taken — which is exactly the pre-fix behaviour', () => {
    const files = pageFiles('Pages/Alpha');
    const result = allocateCollisionFreeIds(files, new Set());
    // Returned by reference: the common case costs one set lookup per node.
    expect(result.files).toBe(files);
    expect(result.remapped).toEqual([]);
  });

  it('walks past an occupied replacement rather than reusing it', () => {
    const files = pageFiles('Pages/Alpha', ['title', 'a', 'b', 'c']);
    const result = allocateCollisionFreeIds(files, new Set(['title', 'title-2', 'title-3']));
    expect(result.remapped).toEqual([{ from: 'title', to: 'title-4' }]);
  });

  it('does not stack suffixes: title-2 colliding becomes title-3, not title-2-2', () => {
    const files = pageFiles('Pages/Alpha', ['title-2', 'a', 'b', 'c']);
    const result = allocateCollisionFreeIds(files, new Set(['title-2']));
    expect(result.remapped).toEqual([{ from: 'title-2', to: 'title-3' }]);
  });

  it('never mints an id the candidate itself is already using', () => {
    const files = pageFiles('Pages/Alpha', ['title', 'title-2', 'title-3', 'x']);
    const result = allocateCollisionFreeIds(files, new Set(['title']));
    expect(result.remapped).toEqual([{ from: 'title', to: 'title-4' }]);
  });

  it('⚠️ the write gate STILL cannot see a cross-component collision', () => {
    // NOT fixed, on purpose, and the row says so: making a project-scoped rule
    // reachable from a component-scoped gate is a design change, and the whole
    // point of allocating is that the gate has nothing left to report. This spec
    // exists so the hole is asserted rather than assumed — if the gate ever does
    // widen, this is the line that says so.
    const project = loadProject();
    const graph = fromProjectModel(project);
    const files = pageFiles('Pages/Beta', ['page', 'layout', 'title', 'source']);
    // Collide the candidate with an /App id by hand — the apply path would
    // reallocate, but the GATE runs before the apply and does not.
    const appRouter = 'e9a5a4b0-557c-167c-a398-5cef585d856d';
    files.nodes.nodes[3].id = appRouter;
    files.connections.connections[0].fromId = appRouter;

    const gate = validateCandidateComponent(graph, '/Pages/Beta', files);
    expect(gate.diagnostics.filter((d) => d.code === DiagnosticCode.DuplicateNodeId).length).toBe(0);

    // …while a project-wide check of the very same input reports it. That gap is
    // `SemanticValidator.validateComponent` filtering to one component while the
    // cross-component rule locates itself on the FIRST carrier.
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
