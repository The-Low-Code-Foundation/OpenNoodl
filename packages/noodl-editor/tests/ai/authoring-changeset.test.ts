/**
 * AIX-003 — the change-set adapter: a staged AI proposal expressed through
 * SUB-007's diff engine, with stable change ids and acceptance requirements.
 * The project is the real corpus in a real `ProjectModel`; proposals are built
 * with the same `buildCandidate` the authoring loop uses, and the
 * existing-component cases diff against a component accepted through the real
 * staging path — so the specs cover the exact conversion chain review will see.
 */

import { buildCandidate } from '../../src/editor/src/models/AiAssistant/authoring/candidate';
import {
  buildChangeSet,
  excludedWith,
  requiredWith,
  type AuthoringChangeSet
} from '../../src/editor/src/models/AiAssistant/authoring/ChangeSet';
import { acceptAuthoredComponent } from '../../src/editor/src/models/AiAssistant/authoring/staging';
import type { AuthoringRequest, ComponentFiles, SubmitPayload } from '../../src/editor/src/models/AiAssistant/authoring/types';
import type { GraphChange } from '../../src/editor/src/versioning';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';
import { UndoQueue } from '../../src/editor/src/models/undo-queue-model';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

const REQUEST: AuthoringRequest = {
  description: 'A page under review.',
  componentPath: 'Pages/Reviewed'
};

/**
 * The baseline proposal: a group containing a text, fed by a component input.
 * Explicit ids and positions so re-proposals share identity with the accepted
 * component and the diff has nothing cosmetic to say.
 */
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
  // Deep-clone: the corpus object is shared through the require cache.
  return ProjectModel.fromJSON(JSON.parse(JSON.stringify(gitRepoUtf8)));
}

/** Project with the baseline proposal already accepted as /Pages/Reviewed. */
function projectWithBaseline(): ProjectModel {
  const project = loadProject();
  acceptAuthoredComponent(project, filesFor(basePayload()));
  return project;
}

function idOf(changeSet: AuthoringChangeSet, predicate: (change: GraphChange) => boolean): string {
  const matches = changeSet.changes.filter((entry) => predicate(entry.change));
  expect(matches.length).toBe(1);
  return matches[0].id;
}

function kindsOf(changeSet: AuthoringChangeSet): string[] {
  return changeSet.changes.map((entry) => entry.change.kind).sort();
}

describe('AIX-003 change-set adapter', () => {
  beforeEach(() => {
    UndoQueue.instance.clear();
  });

  it('expresses a new-component proposal as additions, with structural requirements', () => {
    const changeSet = buildChangeSet(loadProject(), filesFor(basePayload()));

    expect(changeSet.isNewComponent).toBe(true);
    expect(changeSet.componentName).toBe('/Pages/Reviewed');
    expect(changeSet.base.nodes.size).toBe(0);
    expect(kindsOf(changeSet)).toEqual([
      'component-metadata-changed', // componentType: page
      'connection-added',
      'node-added',
      'node-added',
      'node-added'
    ]);

    // Ids are stable and unique.
    expect(new Set(changeSet.changes.map((entry) => entry.id)).size).toBe(changeSet.changes.length);

    const addGroup = idOf(changeSet, (c) => c.kind === 'node-added' && c.node.id === 'g');
    const addText = idOf(changeSet, (c) => c.kind === 'node-added' && c.node.id === 't');
    const addInputs = idOf(changeSet, (c) => c.kind === 'node-added' && c.node.id === 'in');
    const addConnection = idOf(changeSet, (c) => c.kind === 'connection-added');

    const byId = new Map(changeSet.changes.map((entry) => [entry.id, entry]));
    // A child needs its (new) parent; roots need nothing.
    expect(byId.get(addText)!.requires).toEqual([addGroup]);
    expect(byId.get(addGroup)!.requires).toEqual([]);
    // A connection needs both of its (new) endpoints.
    expect(byId.get(addConnection)!.requires.sort()).toEqual([addText, addInputs].sort());
  });

  it('re-proposing the accepted component unchanged yields no changes at all', () => {
    const project = projectWithBaseline();
    const changeSet = buildChangeSet(project, filesFor(basePayload()));

    expect(changeSet.isNewComponent).toBe(false);
    expect(changeSet.changes).toEqual([]);
  });

  it('diffs a modification proposal against the live component', () => {
    const project = projectWithBaseline();

    const payload = basePayload();
    payload.nodes.find((n) => n.id === 't')!.parameters = { text: 'Goodbye' };
    payload.nodes.push({ id: 'img', type: 'Image', parent: 'g', x: 20, y: 120 });
    // The input now feeds the image instead of the text: a source-fixed rewire.
    payload.connections = [{ fromId: 'in', fromProperty: 'Trigger', toId: 'img', toProperty: 'source' }];

    const changeSet = buildChangeSet(project, filesFor(payload));
    expect(changeSet.isNewComponent).toBe(false);
    expect(kindsOf(changeSet)).toEqual(['connection-rewired', 'node-added', 'node-parameters-changed']);

    const addImage = idOf(changeSet, (c) => c.kind === 'node-added');
    const rewired = idOf(changeSet, (c) => c.kind === 'connection-rewired');
    const byId = new Map(changeSet.changes.map((entry) => [entry.id, entry]));

    // The image sits under a parent that already exists — no requirement.
    expect(byId.get(addImage)!.requires).toEqual([]);
    // The new routing plugs into the new node.
    expect(byId.get(rewired)!.requires).toEqual([addImage]);

    const paramsChange = changeSet.changes.find((entry) => entry.change.kind === 'node-parameters-changed')!.change;
    if (paramsChange.kind !== 'node-parameters-changed') throw new Error('wrong kind');
    expect(paramsChange.node.id).toBe('t');
    expect(paramsChange.params).toEqual([{ name: 'text', base: 'Hello', target: 'Goodbye' }]);
  });

  it('removing a node requires removing what touched it, transitively up the tree', () => {
    const project = projectWithBaseline();

    // Remove the group and everything in it; keep the input node, unwired.
    const payload = basePayload();
    payload.nodes = payload.nodes.filter((n) => n.id === 'in');
    payload.connections = [];

    const changeSet = buildChangeSet(project, filesFor(payload));
    expect(kindsOf(changeSet)).toEqual(['connection-removed', 'node-removed', 'node-removed']);

    const removeGroup = idOf(changeSet, (c) => c.kind === 'node-removed' && c.node.id === 'g');
    const removeText = idOf(changeSet, (c) => c.kind === 'node-removed' && c.node.id === 't');
    const removeConnection = idOf(changeSet, (c) => c.kind === 'connection-removed');
    const byId = new Map(changeSet.changes.map((entry) => [entry.id, entry]));

    // The text loses its connection first; the group needs its child disposed.
    expect(byId.get(removeText)!.requires).toEqual([removeConnection]);
    expect(byId.get(removeGroup)!.requires).toEqual([removeText]);

    // Accepting the group removal drags in the whole chain.
    expect(requiredWith(changeSet, [removeGroup])).toEqual(new Set([removeGroup, removeText, removeConnection]));
    // Rejecting the connection removal rejects both node removals.
    expect(excludedWith(changeSet, [removeConnection])).toEqual(new Set([removeConnection, removeText, removeGroup]));
  });

  it('closures over additions: rejecting a parent rejects its subtree and wiring', () => {
    const changeSet = buildChangeSet(loadProject(), filesFor(basePayload()));

    const addGroup = idOf(changeSet, (c) => c.kind === 'node-added' && c.node.id === 'g');
    const addText = idOf(changeSet, (c) => c.kind === 'node-added' && c.node.id === 't');
    const addInputs = idOf(changeSet, (c) => c.kind === 'node-added' && c.node.id === 'in');
    const addConnection = idOf(changeSet, (c) => c.kind === 'connection-added');

    // Accepting the connection pulls in its endpoints, and the text's parent.
    expect(requiredWith(changeSet, [addConnection])).toEqual(new Set([addConnection, addText, addInputs, addGroup]));
    // Rejecting the group cascades to the text and the connection, not the input.
    expect(excludedWith(changeSet, [addGroup])).toEqual(new Set([addGroup, addText, addConnection]));
    expect(excludedWith(changeSet, [addInputs])).toEqual(new Set([addInputs, addConnection]));
  });
});
