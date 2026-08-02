/**
 * AIX-003 — materializing a partial acceptance: the accepted subset becomes
 * component files, rejection is closed over dependencies, the all-accepted
 * case reproduces the proposal, and every materialized result passes the
 * same validation gate as authoring. Same corpus and staging path as the
 * other AIX-003 specs.
 */

import { materializeSelection } from '../../src/editor/src/models/AiAssistant/authoring/applyChangeSet';
import { buildCandidate } from '../../src/editor/src/models/AiAssistant/authoring/candidate';
import { buildChangeSet, type AuthoringChangeSet } from '../../src/editor/src/models/AiAssistant/authoring/ChangeSet';
import { acceptAuthoredComponent } from '../../src/editor/src/models/AiAssistant/authoring/staging';
import type { AuthoringRequest, ComponentFiles, SubmitPayload } from '../../src/editor/src/models/AiAssistant/authoring/types';
import { validateCandidateComponent } from '../../src/editor/src/models/AiAssistant/authoring/validate';
import { fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';
import { UndoQueue } from '../../src/editor/src/models/undo-queue-model';
import { diffGraphs, fromV2Files, type V2ComponentFiles } from '../../src/editor/src/versioning';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

const REQUEST: AuthoringRequest = {
  description: 'A page under review.',
  componentPath: 'Pages/Reviewed'
};

function basePayload(): SubmitPayload {
  return {
    nodes: [
      { id: 'g', type: 'Group', x: 0, y: 0 },
      { id: 't', type: 'Text', parent: 'g', x: 20, y: 40, parameters: { text: 'Hello' } },
      { id: 'in', type: 'Component Inputs', x: -200, y: 40, ports: [{ name: 'Trigger', plug: 'output', type: '*' }] }
    ],
    connections: [{ fromId: 'in', fromProperty: 'Trigger', toId: 't', toProperty: 'text' }]
  };
}

function filesFor(payload: SubmitPayload): ComponentFiles {
  const result = buildCandidate(REQUEST, payload);
  expect(result.errors).toEqual([]);
  return result.files!;
}

function loadProject(): ProjectModel {
  return ProjectModel.fromJSON(JSON.parse(JSON.stringify(gitRepoUtf8)));
}

function idOf(changeSet: AuthoringChangeSet, predicate: (kind: string, anchor?: string) => boolean): string {
  const matches = changeSet.changes.filter((entry) => {
    const change = entry.change as { kind: string; node?: { id: string } };
    return predicate(change.kind, change.node?.id);
  });
  expect(matches.length).toBe(1);
  return matches[0].id;
}

/** Semantic equality through the diff engine itself: no changes ⇒ same graph. */
function expectSameGraph(a: ComponentFiles, b: ComponentFiles) {
  const diff = diffGraphs(fromV2Files(a as unknown as V2ComponentFiles), fromV2Files(b as unknown as V2ComponentFiles));
  expect(diff.changes).toEqual([]);
}

function expectGateClean(files: ComponentFiles) {
  const graph = fromSerialisedProject(JSON.parse(JSON.stringify(gitRepoUtf8)));
  const validation = validateCandidateComponent(graph, '/Pages/Reviewed', files);
  expect(validation.errors).toEqual([]);
}

describe('AIX-003 partial acceptance', () => {
  beforeEach(() => {
    UndoQueue.instance.clear();
  });

  it('accepting everything reproduces the proposal exactly', () => {
    const files = filesFor(basePayload());
    const changeSet = buildChangeSet(loadProject(), files);

    const { files: materialized, rejected } = materializeSelection(changeSet, files, []);

    expect(rejected.size).toBe(0);
    expect(materialized.component).toEqual(files.component);
    expectSameGraph(materialized, files);
    expectGateClean(materialized);
  });

  it('rejecting an added node drags its wiring out with it', () => {
    const files = filesFor(basePayload());
    const changeSet = buildChangeSet(loadProject(), files);
    const addText = idOf(changeSet, (kind, anchor) => kind === 'node-added' && anchor === 't');

    const { files: materialized, rejected } = materializeSelection(changeSet, files, [addText]);

    // The closure rejected the connection too — it plugs into the text.
    expect(rejected.size).toBe(2);
    const nodeIds = materialized.nodes.nodes.map((n) => n.id).sort();
    expect(nodeIds).toEqual(['g', 'in']);
    expect(materialized.connections.connections).toEqual([]);
    expectGateClean(materialized);
  });

  it('a partially accepted modification keeps the base value for rejected changes only', () => {
    const project = loadProject();
    acceptAuthoredComponent(project, filesFor(basePayload()));

    // Propose: change the text parameter AND remove the input (with its wire).
    const payload = basePayload();
    payload.nodes.find((n) => n.id === 't')!.parameters = { text: 'Goodbye' };
    payload.nodes = payload.nodes.filter((n) => n.id !== 'in');
    payload.connections = [];
    const files = filesFor(payload);
    const changeSet = buildChangeSet(project, files);

    const removeInput = idOf(changeSet, (kind, anchor) => kind === 'node-removed' && anchor === 'in');

    // Reject the removal; keep the parameter change.
    const { files: materialized, rejected } = materializeSelection(changeSet, files, [removeInput]);

    expect(rejected.has(removeInput)).toBe(true);
    const nodeIds = materialized.nodes.nodes.map((n) => n.id).sort();
    expect(nodeIds).toEqual(['g', 'in', 't']);
    const text = materialized.nodes.nodes.find((n) => n.id === 't')!;
    expect(text.parameters).toEqual({ text: 'Goodbye' });

    // Rejecting the node removal does NOT resurrect the connection removal —
    // dropping a wire is valid without dropping the node it fed.
    expect(materialized.connections.connections).toEqual([]);
    expectGateClean(materialized);
  });

  it('rejecting only the connection removal keeps the wire and the nodes it needs', () => {
    const project = loadProject();
    acceptAuthoredComponent(project, filesFor(basePayload()));

    const payload = basePayload();
    payload.nodes = payload.nodes.filter((n) => n.id !== 'in');
    payload.connections = [];
    const files = filesFor(payload);
    const changeSet = buildChangeSet(project, files);

    const removeConnection = idOf(changeSet, (kind) => kind === 'connection-removed');
    const removeInput = idOf(changeSet, (kind, anchor) => kind === 'node-removed' && anchor === 'in');

    // Rejecting the wire removal also rejects the node removal that requires it.
    const { files: materialized, rejected } = materializeSelection(changeSet, files, [removeConnection]);

    expect(rejected.has(removeInput)).toBe(true);
    const nodeIds = materialized.nodes.nodes.map((n) => n.id).sort();
    expect(nodeIds).toEqual(['g', 'in', 't']);
    expect(materialized.connections.connections.length).toBe(1);
    expectSameGraph(materialized, filesFor(basePayload()));
    expectGateClean(materialized);
  });
});

/**
 * AIX-003's live round trip (2026-08-02) put a real `claude-sonnet-5` proposal
 * through this chain and broke two of its properties. Both are shapes the
 * fixtures above cannot produce: they append nodes at the end of a parent and
 * they have no wire labels, because that is how one writes a fixture. A model
 * revising a real card inserts rows *between* the ones already there, and a
 * project that uses CAN-002 labels brings them to the diff.
 */
describe('AIX-003 partial acceptance — shapes a live proposal has', () => {
  beforeEach(() => {
    UndoQueue.instance.clear();
  });

  /** Two children under one group, so a revision has somewhere to insert. */
  function rowsPayload(): SubmitPayload {
    return {
      nodes: [
        { id: 'g', type: 'Group', x: 0, y: 0 },
        { id: 'first', type: 'Text', parent: 'g', x: 20, y: 0, parameters: { text: 'First' } },
        { id: 'last', type: 'Text', parent: 'g', x: 20, y: 60, parameters: { text: 'Last' } }
      ]
    };
  }

  function projectWithRows(): ProjectModel {
    const project = loadProject();
    acceptAuthoredComponent(project, filesFor(rowsPayload()));
    return project;
  }

  /** Sibling order as the canvas would lay it out, read back through the snapshot. */
  function childOrder(files: ComponentFiles): string[] {
    const snapshot = fromV2Files(files as unknown as V2ComponentFiles);
    return [...snapshot.nodes.values()]
      .filter((node) => node.parent === 'g')
      .sort((a, b) => a.childIndex - b.childIndex)
      .map((node) => node.id);
  }

  it('an inserted node lands where the proposal put it, not after the siblings it displaced', () => {
    const project = projectWithRows();
    const payload = rowsPayload();
    payload.nodes.splice(2, 0, { id: 'middle', type: 'Text', parent: 'g', x: 20, y: 30, parameters: { text: 'Middle' } });
    const files = filesFor(payload);
    expect(childOrder(files)).toEqual(['first', 'middle', 'last']);

    const changeSet = buildChangeSet(project, files);
    // The diff has no `node-reordered` to offer: on the proposal's own side
    // nothing moved, the insert simply pushed `last` along. Nothing but the
    // materializer can put the two numbering schemes back together.
    const { files: materialized } = materializeSelection(changeSet, files, []);

    expect(childOrder(materialized)).toEqual(['first', 'middle', 'last']);
    expectSameGraph(materialized, files);
    expectGateClean(materialized);
  });

  it('rejecting the insert leaves the base order exactly as it was', () => {
    const project = projectWithRows();
    const payload = rowsPayload();
    payload.nodes.splice(2, 0, { id: 'middle', type: 'Text', parent: 'g', x: 20, y: 30, parameters: { text: 'Middle' } });
    const files = filesFor(payload);
    const changeSet = buildChangeSet(project, files);
    const insert = idOf(changeSet, (kind, anchor) => kind === 'node-added' && anchor === 'middle');

    const { files: materialized } = materializeSelection(changeSet, files, [insert]);

    expect(childOrder(materialized)).toEqual(['first', 'last']);
    expectSameGraph(materialized, filesFor(rowsPayload()));
  });

  it('a rejected reorder keeps the base order while the rest of the proposal lands', () => {
    const project = projectWithRows();
    const payload = rowsPayload();
    payload.nodes = [payload.nodes[0], payload.nodes[2], payload.nodes[1]];
    payload.nodes.push({ id: 'extra', type: 'Text', parent: 'g', x: 20, y: 90, parameters: { text: 'Extra' } });
    const files = filesFor(payload);
    expect(childOrder(files)).toEqual(['last', 'first', 'extra']);

    const changeSet = buildChangeSet(project, files);
    const reorders = changeSet.changes.filter((entry) => entry.change.kind === 'node-reordered').map((e) => e.id);
    expect(reorders.length > 0).toBe(true);

    const { files: materialized } = materializeSelection(changeSet, files, reorders);

    // The swap is refused; the new row is still accepted, and lands last as the
    // proposal placed it relative to what stayed.
    expect(childOrder(materialized)).toEqual(['first', 'last', 'extra']);
    expectGateClean(materialized);
  });

  /**
   * A wire label (CAN-002) is diffed as semantic, and `buildCandidate` drops
   * every connection field but the four endpoints — so the reachable case is a
   * base that has a label and a proposal that does not. The labelled side is
   * built by hand here for that reason, not for convenience.
   */
  function wiredPayload(): SubmitPayload {
    const payload = rowsPayload();
    payload.nodes.push({
      id: 'in',
      type: 'Component Inputs',
      x: -200,
      y: 0,
      ports: [{ name: 'Title', plug: 'output', type: '*' }]
    });
    payload.connections = [{ fromId: 'in', fromProperty: 'Title', toId: 'first', toProperty: 'text' }];
    return payload;
  }

  function withWireLabel(files: ComponentFiles, label: string): ComponentFiles {
    const copy: ComponentFiles = JSON.parse(JSON.stringify(files));
    copy.connections.connections[0].label = label;
    return copy;
  }

  it('a relabelled wire is one reviewable change, and accepting it keeps the new label', () => {
    const project = loadProject();
    acceptAuthoredComponent(project, withWireLabel(filesFor(wiredPayload()), 'the title'));
    const proposed = withWireLabel(filesFor(wiredPayload()), 'the heading');

    const changeSet = buildChangeSet(project, proposed);

    expect(changeSet.changes.map((entry) => entry.change.kind)).toEqual(['connection-relabelled']);
    // A kind with no id is not reviewable: ids key the rail, the closure and
    // the rejection set, and two of them would collide on `undefined`.
    expect(typeof changeSet.changes[0].id).toBe('string');
    expect(changeSet.changes[0].id.startsWith('connection-relabelled:')).toBe(true);

    const { files: materialized } = materializeSelection(changeSet, proposed, []);

    expect(materialized.connections.connections[0].label).toBe('the heading');
    expectSameGraph(materialized, proposed);
    expectGateClean(materialized);
  });

  it('rejecting the relabel keeps the base label and nothing else changes', () => {
    const project = loadProject();
    const base = withWireLabel(filesFor(wiredPayload()), 'the title');
    acceptAuthoredComponent(project, base);
    const proposed = filesFor(wiredPayload());

    const changeSet = buildChangeSet(project, proposed);
    const relabel = changeSet.changes.find((entry) => entry.change.kind === 'connection-relabelled');
    expect(relabel === undefined).toBe(false);

    const { files: materialized } = materializeSelection(changeSet, proposed, [relabel!.id]);

    expect(materialized.connections.connections[0].label).toBe('the title');
    expectSameGraph(materialized, base);
  });
});
