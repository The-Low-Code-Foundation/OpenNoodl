/**
 * AIX-002 — staging: accept applies the staged candidate to the live project
 * undoably; reject is the absence of that call and leaves the project
 * byte-identical. The project here is the real corpus loaded into a real
 * `ProjectModel`; only the chat function is scripted.
 */

import { buildComponentV2Files } from '../../src/editor/src/io/ProjectExporter';
import { AuthoringSession } from '../../src/editor/src/models/AiAssistant/authoring/AuthoringSession';
import { buildCandidate } from '../../src/editor/src/models/AiAssistant/authoring/candidate';
import {
  acceptAuthoredComponent,
  StagingError,
  updateAuthoredComponent
} from '../../src/editor/src/models/AiAssistant/authoring/staging';
import type { AuthoringRequest, ComponentFiles } from '../../src/editor/src/models/AiAssistant/authoring/types';
import { fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';
import type { AiChatResponse } from '../../src/editor/src/models/AiAssistant/client/types';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';
import { UndoQueue } from '../../src/editor/src/models/undo-queue-model';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

const REQUEST: AuthoringRequest = {
  description: 'A page with a trigger input and a done output.',
  componentPath: 'Pages/Authored'
};

/** A candidate that validates cleanly — the same shape the session specs use. */
function stagedFiles(): ComponentFiles {
  const result = buildCandidate(REQUEST, {
    nodes: [
      { id: 'in', type: 'Component Inputs', ports: [{ name: 'Trigger', plug: 'output', type: '*' }] },
      { id: 'out', type: 'Component Outputs', ports: [{ name: 'Done', plug: 'input', type: '*' }] }
    ],
    connections: [{ fromId: 'in', fromProperty: 'Trigger', toId: 'out', toProperty: 'Done' }],
    description: 'Trigger in, done out.'
  });
  expect(result.errors).toEqual([]);
  return result.files!;
}

function loadProject(): ProjectModel {
  // Deep-clone: fromJSON may upgrade the json in place, and the corpus object
  // is shared with the other AI specs through the require cache.
  return ProjectModel.fromJSON(JSON.parse(JSON.stringify(gitRepoUtf8)));
}

describe('AIX-002 authoring staging', () => {
  beforeEach(() => {
    UndoQueue.instance.clear();
  });

  it('accept adds the staged component to the live project, intact', () => {
    const project = loadProject();
    const component = acceptAuthoredComponent(project, stagedFiles());

    expect(project.getComponentWithName('/Pages/Authored')).toBe(component);
    expect(component.name).toBe('/Pages/Authored');
    expect(project.findNodeWithId('in')).toBeDefined();
    expect(project.findNodeWithId('out')).toBeDefined();
    expect(component.graph.connections.length).toBe(1);
  });

  it('accept is undoable like any other edit — undo restores the project byte-identically', () => {
    const project = loadProject();
    const before = JSON.stringify(project.toJSON());

    acceptAuthoredComponent(project, stagedFiles());
    expect(project.getComponentWithName('/Pages/Authored')).toBeDefined();

    UndoQueue.instance.undo();
    expect(project.getComponentWithName('/Pages/Authored')).toBeUndefined();
    expect(JSON.stringify(project.toJSON())).toBe(before);

    UndoQueue.instance.redo();
    expect(project.getComponentWithName('/Pages/Authored')).toBeDefined();
  });

  it('accept refuses a name collision without touching the project', () => {
    const project = loadProject();
    acceptAuthoredComponent(project, stagedFiles());
    const after = JSON.stringify(project.toJSON());

    expect(() => acceptAuthoredComponent(project, stagedFiles())).toThrowError(StagingError);
    expect(JSON.stringify(project.toJSON())).toBe(after);
    expect(project.getComponents().filter((c) => c.name === '/Pages/Authored').length).toBe(1);
  });

  it('reject leaves no trace: a full authoring run without accept is byte-identical', async () => {
    const project = loadProject();
    const before = JSON.stringify(project.toJSON());

    const graph = fromSerialisedProject(JSON.parse(JSON.stringify(gitRepoUtf8)));
    const chat = async (): Promise<AiChatResponse> => ({
      text: '',
      toolCalls: [
        {
          id: 'call-1',
          name: 'submit_component',
          arguments: {
            nodes: [
              { id: 'in', type: 'Component Inputs', ports: [{ name: 'Trigger', plug: 'output', type: '*' }] },
              { id: 'out', type: 'Component Outputs', ports: [{ name: 'Done', plug: 'input', type: '*' }] }
            ],
            connections: [{ fromId: 'in', fromProperty: 'Trigger', toId: 'out', toProperty: 'Done' }]
          }
        }
      ],
      usage: { promptTokens: 10, completionTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.01 },
      model: 'test',
      stopReason: 'tool_calls'
    });

    const outcome = await AuthoringSession.create(graph, REQUEST, { chat }).run();
    expect(outcome.status).toBe('authored');
    expect(outcome.files).toBeDefined();

    // The user rejects: the staged files are simply dropped. Nothing to clean up.
    expect(JSON.stringify(project.toJSON())).toBe(before);
    expect(UndoQueue.instance.getHistory().length).toBe(0);
  });
});

describe('AIX-002 authoring staging — update mode', () => {
  beforeEach(() => {
    UndoQueue.instance.clear();
  });

  const UPDATE_REQUEST: AuthoringRequest = {
    description: 'Rework the article page.',
    componentPath: 'Pages/Article'
  };

  /** The exporter's serialization of the live component — the panel's base. */
  function baseFor(project: ProjectModel, legacyName: string): ComponentFiles {
    const existing = project.getComponentWithName(legacyName)!;
    expect(existing).toBeDefined();
    return buildComponentV2Files(existing.toJSON(), '2026-01-01T00:00:00.000Z') as ComponentFiles;
  }

  /** A small, valid replacement graph built against the base (update mode). */
  function updateFiles(project: ProjectModel, request: AuthoringRequest, legacyName: string): ComponentFiles {
    const result = buildCandidate(
      request,
      {
        nodes: [
          { id: 'new-root', type: 'Group', label: 'Reworked root' },
          { id: 'new-text', type: 'Text', parent: 'new-root', parameters: { text: 'Reworked' } }
        ],
        visualRoots: ['new-root']
      },
      undefined,
      baseFor(project, legacyName)
    );
    expect(result.errors).toEqual([]);
    return result.files!;
  }

  it('update replaces the component in place — same name, same identity, same position', () => {
    const project = loadProject();
    const before = project.getComponentWithName('/Pages/Article')!;
    const positionBefore = project.getComponents().indexOf(before);
    const countBefore = project.getComponents().length;

    const component = updateAuthoredComponent(project, updateFiles(project, UPDATE_REQUEST, '/Pages/Article'));

    expect(project.getComponentWithName('/Pages/Article')).toBe(component);
    expect(component).not.toBe(before);
    expect(project.getComponents().length).toBe(countBefore);
    expect(project.getComponents().indexOf(component)).toBe(positionBefore);
    expect(project.findNodeWithId('new-text')).toBeDefined();
  });

  it('one undo restores the previous component byte-identically; redo reapplies', () => {
    const project = loadProject();
    const before = JSON.stringify(project.toJSON());

    updateAuthoredComponent(project, updateFiles(project, UPDATE_REQUEST, '/Pages/Article'));
    const after = JSON.stringify(project.toJSON());
    expect(after).not.toBe(before);

    UndoQueue.instance.undo();
    expect(JSON.stringify(project.toJSON())).toBe(before);

    UndoQueue.instance.redo();
    expect(JSON.stringify(project.toJSON())).toBe(after);
  });

  it('updating the root component keeps the project root, through undo and redo', () => {
    const project = loadProject();
    const rootComponent = project.getRootComponent();
    expect(rootComponent).toBeDefined();
    const rootName = rootComponent.name;
    const before = JSON.stringify(project.toJSON());

    const request: AuthoringRequest = { description: 'Rework home.', componentPath: rootName };
    const component = updateAuthoredComponent(project, updateFiles(project, request, rootName));

    expect(project.getRootComponent()).toBe(component);
    expect(project.getRootNode()).toBeDefined();

    UndoQueue.instance.undo();
    expect(project.getRootComponent()).toBe(rootComponent);
    expect(JSON.stringify(project.toJSON())).toBe(before);

    UndoQueue.instance.redo();
    expect(project.getRootComponent()).toBe(project.getComponentWithName(rootName));
  });

  it('update refuses a component that no longer exists, without touching the project', () => {
    const project = loadProject();
    const files = updateFiles(project, UPDATE_REQUEST, '/Pages/Article');
    const removed = project.getComponentWithName('/Pages/Article')!;
    project.removeComponent(removed);
    const before = JSON.stringify(project.toJSON());

    expect(() => updateAuthoredComponent(project, files)).toThrowError(StagingError);
    expect(JSON.stringify(project.toJSON())).toBe(before);
  });
});
