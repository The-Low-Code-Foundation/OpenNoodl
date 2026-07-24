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
