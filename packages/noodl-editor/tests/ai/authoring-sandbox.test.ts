/**
 * AIX-008 — the sandbox preview's editor half: what data the graph expects,
 * and the export a preview window is fed.
 *
 * The invariant these exist to defend is the one AIX-002 built the whole
 * staging contract around: building a preview must not touch the project.
 * Everything else here is about never showing an empty screen — a class with
 * no described fields still gets records, and a component with nothing visual
 * says so instead of rendering white.
 */

import { buildCandidate } from '../../src/editor/src/models/AiAssistant/authoring/candidate';
import { buildSandboxDataset, discoverDataShape } from '../../src/editor/src/models/AiAssistant/authoring/sandboxData';
import {
  buildSandboxExport,
  candidateComponent,
  componentClosure
} from '../../src/editor/src/models/AiAssistant/authoring/sandboxExport';
import type { AuthoringRequest, ComponentFiles, SubmitPayload } from '../../src/editor/src/models/AiAssistant/authoring/types';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';
import type { SandboxDataset } from '@noodl/runtime/src/sandbox/types';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

const REQUEST: AuthoringRequest = {
  description: 'A book list.',
  componentPath: 'Pages/Books'
};

function loadProject(): ProjectModel {
  return ProjectModel.fromJSON(JSON.parse(JSON.stringify(gitRepoUtf8)));
}

function files(payload: SubmitPayload): ComponentFiles {
  const result = buildCandidate(REQUEST, payload);
  expect(result.errors).toEqual([]);
  return result.files!;
}

/** A page that queries a collection and shows two of its fields. */
function bookListPayload(): SubmitPayload {
  return {
    nodes: [
      { id: 'group', type: 'Group' },
      { id: 'query', type: 'DbCollection2', parameters: { collectionName: 'Books' } },
      { id: 'record', type: 'DbModel2', parameters: { collectionName: 'Books' } },
      { id: 'text', type: 'Text', parent: 'group' }
    ],
    connections: [
      { fromId: 'record', fromProperty: 'prop-title', toId: 'text', toProperty: 'text' },
      { fromId: 'record', fromProperty: 'prop-coverImageUrl', toId: 'text', toProperty: 'visible' }
    ],
    visualRoots: ['group']
  };
}

describe('AIX-008 sandbox data discovery', () => {
  it('finds the classes a graph queries and the fields it reads', () => {
    const { component } = candidateComponent(files(bookListPayload()));
    const shape = discoverDataShape([component]);

    expect([...shape.byClass.keys()]).toContain('Books');
    expect([...(shape.byClass.get('Books') ?? [])].sort()).toEqual(['coverImageUrl', 'title']);
  });

  it('never leaves a queried class without records', () => {
    const dataset = buildSandboxDataset({ components: [candidateComponent(files(bookListPayload())).component] });

    expect(dataset.classes.Books.records.length).toBe(5);
    expect(typeof dataset.classes.Books.records[0].title).toBe('string');
    expect(String(dataset.classes.Books.records[0].coverImageUrl)).toContain('data:image/svg+xml');
  });

  it('prefers the agent’s sample records and fills the fields it left out', () => {
    const dataset = buildSandboxDataset({
      components: [candidateComponent(files(bookListPayload())).component],
      sampleData: { Books: [{ title: 'The Left Hand of Darkness' }] }
    });

    expect(dataset.classes.Books.records.length).toBe(1);
    expect(dataset.classes.Books.records[0].title).toBe('The Left Hand of Darkness');
    expect(String(dataset.classes.Books.records[0].coverImageUrl)).toContain('data:image/svg+xml');
  });

  it('always signs the preview in as someone', () => {
    const dataset = buildSandboxDataset({ components: [] });
    expect(String(dataset.user.email)).toContain('@example.com');
    expect(dataset.summary).toBeTruthy();
  });

  it('follows component instances when collecting what to sample', () => {
    const project = loadProject();
    const existing = project.getComponents()[0];
    const { component } = candidateComponent(
      files({
        nodes: [
          { id: 'group', type: 'Group' },
          { id: 'child', type: existing.name, parent: 'group' }
        ],
        visualRoots: ['group']
      })
    );

    expect(componentClosure(project, component).map((c) => c.name)).toContain(existing.name);
  });
});

describe('AIX-008 sandbox export', () => {
  it('renders the candidate as root without adding it to the project', () => {
    const project = loadProject();
    const before = JSON.stringify(project.toJSON());

    const result = buildSandboxExport({ project, files: files(bookListPayload()) });

    expect(result.json).toBeTruthy();
    expect(result.json!.rootComponent).toBe('/Pages/Books');
    expect(result.json!.components.some((c) => c.name === '/Pages/Books')).toBe(true);

    // The one invariant AIX-002 is built on: nothing crossed into the project.
    expect(project.getComponentWithName('/Pages/Books')).toBeFalsy();
    expect(JSON.stringify(project.toJSON())).toBe(before);
  });

  it('ships the dataset in the metadata the runtime reads', () => {
    const result = buildSandboxExport({ project: loadProject(), files: files(bookListPayload()) });
    expect((result.json!.metadata!.sandbox as SandboxDataset).classes.Books.records.length).toBe(5);
    expect(result.summary).toContain('Books');
  });

  it('ships no dataset when the preview is pointed at the real backend', () => {
    const result = buildSandboxExport({
      project: loadProject(),
      files: files(bookListPayload()),
      useSampleData: false
    });
    expect(result.json!.metadata!.sandbox).toBeUndefined();
    expect(result.summary).toContain('Real backend');
  });

  it('replaces the live component when the candidate revises one', () => {
    const project = loadProject();
    const existing = project.getComponents()[0];
    const result = buildSandboxExport({
      project,
      files: files({ nodes: [{ id: 'group', type: 'Group' }], visualRoots: ['group'] })
    });

    const named = result.json!.components.filter((c) => c.name === existing.name);
    expect(named.length).toBe(1);
  });

  it('says so rather than rendering white when there is nothing visual', () => {
    const result = buildSandboxExport({
      project: loadProject(),
      files: files({
        nodes: [{ id: 'in', type: 'Component Inputs', ports: [{ name: 'Trigger', plug: 'output', type: '*' }] }]
      })
    });

    expect(result.json).toBeUndefined();
    expect(result.unrenderable).toContain('nothing to render');
  });
});
