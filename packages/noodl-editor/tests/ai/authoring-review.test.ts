/**
 * AIX-003 — the annotated review component: a change set rendered as the
 * merged before/after graph the diff canvas paints. Same corpus + real
 * staging path as the change-set specs; the loaded `ComponentModel` is
 * asserted on directly, since that is exactly what the canvas consumes.
 */

import { buildCandidate } from '../../src/editor/src/models/AiAssistant/authoring/candidate';
import { buildChangeSet } from '../../src/editor/src/models/AiAssistant/authoring/ChangeSet';
import { buildReviewComponent } from '../../src/editor/src/models/AiAssistant/authoring/reviewComponent';
import { acceptAuthoredComponent } from '../../src/editor/src/models/AiAssistant/authoring/staging';
import type { AuthoringRequest, ComponentFiles, SubmitPayload } from '../../src/editor/src/models/AiAssistant/authoring/types';
import { ComponentModel } from '../../src/editor/src/models/componentmodel';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';
import { UndoQueue } from '../../src/editor/src/models/undo-queue-model';

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

function projectWithBaseline(): ProjectModel {
  const project = loadProject();
  acceptAuthoredComponent(project, filesFor(basePayload()));
  return project;
}

function reviewModel(project: ProjectModel, payload: SubmitPayload): ComponentModel {
  const legacy = buildReviewComponent(buildChangeSet(project, filesFor(payload)));
  return ComponentModel.fromJSON(legacy as TSFixme);
}

function connectionsOf(component: ComponentModel): TSFixme[] {
  return component.graph.connections;
}

describe('AIX-003 review component', () => {
  beforeEach(() => {
    UndoQueue.instance.clear();
  });

  it('annotates every element of a new-component proposal as Created', () => {
    const component = reviewModel(loadProject(), basePayload());

    expect(component.name).toBe('/Pages/Reviewed');
    for (const id of ['g', 't', 'in']) {
      expect(component.graph.findNodeWithId(id).annotation).toBe('Created');
    }
    // The text stays a child of the group in the review graph.
    expect(component.graph.findNodeWithId('t').parent.id).toBe('g');
    expect(connectionsOf(component).length).toBe(1);
    expect(connectionsOf(component)[0].annotation).toBe('Created');
  });

  it('marks modifications Changed with the before state attached, and shows both routings of a rewire', () => {
    const project = projectWithBaseline();

    const payload = basePayload();
    payload.nodes.find((n) => n.id === 't')!.parameters = { text: 'Goodbye' };
    payload.nodes.push({ id: 'img', type: 'Image', parent: 'g', x: 20, y: 120 });
    payload.connections = [{ fromId: 'in', fromProperty: 'Trigger', toId: 'img', toProperty: 'source' }];

    const component = reviewModel(project, payload);

    const text = component.graph.findNodeWithId('t');
    expect(text.annotation).toBe('Changed');
    expect(text.diffData.parent.parameters.text).toBe('Hello');

    expect(component.graph.findNodeWithId('img').annotation).toBe('Created');
    // Untouched nodes carry no annotation.
    expect(component.graph.findNodeWithId('g').annotation).toBeUndefined();
    expect(component.graph.findNodeWithId('in').annotation).toBeUndefined();

    // Both the old and the new routing are on the canvas, marked.
    const connections = connectionsOf(component);
    expect(connections.length).toBe(2);
    const created = connections.find((c) => c.toId === 'img');
    const deleted = connections.find((c) => c.toId === 't');
    expect(created.annotation).toBe('Created');
    expect(deleted.annotation).toBe('Deleted');
  });

  it('re-inserts removed elements in place, annotated Deleted', () => {
    const project = projectWithBaseline();

    // Remove the group subtree and the connection; keep the input.
    const payload = basePayload();
    payload.nodes = payload.nodes.filter((n) => n.id === 'in');
    payload.connections = [];

    const component = reviewModel(project, payload);

    const group = component.graph.findNodeWithId('g');
    const text = component.graph.findNodeWithId('t');
    expect(group.annotation).toBe('Deleted');
    expect(text.annotation).toBe('Deleted');
    // The removed subtree keeps its shape: the text is still inside the group.
    expect(text.parent.id).toBe('g');
    expect(component.graph.findNodeWithId('in').annotation).toBeUndefined();

    const connections = connectionsOf(component);
    expect(connections.length).toBe(1);
    expect(connections[0].annotation).toBe('Deleted');
  });

  it('a removed child of a surviving parent stays under that parent', () => {
    const project = projectWithBaseline();

    // Remove just the text (and its connection); group and input survive.
    const payload = basePayload();
    payload.nodes = payload.nodes.filter((n) => n.id !== 't');
    payload.connections = [];

    const component = reviewModel(project, payload);

    const text = component.graph.findNodeWithId('t');
    expect(text.annotation).toBe('Deleted');
    expect(text.parent.id).toBe('g');
    expect(component.graph.findNodeWithId('g').annotation).toBeUndefined();
  });
});
