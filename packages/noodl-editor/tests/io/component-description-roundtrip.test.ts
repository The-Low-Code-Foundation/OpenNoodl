/**
 * LEG-006 — the description an agent writes, and the save that used to delete it.
 *
 * ⚠️ **Round-trip is the acceptance, not the write.** The obvious spec — author a
 * description, run the exporter, read the file, see the description — passes with
 * the importer half missing, and passes with the *model* half missing, because
 * both of those only fail on the SECOND save. The sequence that catches it is the
 * one BEN-005 actually performed on 2026-08-09 (register B23):
 *
 *   1. author  — an agent writes `component.json` with `description`, `created`
 *                and `modifiedBy` (this is verbatim what `assembleCreateFiles`
 *                in `noodl-mcp` produces);
 *   2. save    — the editor loads it and writes it back;
 *   3. reload  — the editor loads what it just wrote;
 *   4. save    — and writes it back again.
 *
 * After step 4 the three fields must still be there. Before LEG-006 they were
 * gone after step 2, and nothing reported it: the save succeeded, the validator
 * was clean, the graph was intact, and the only evidence was a field missing
 * from a file nobody opens.
 *
 * **The chain is four seams, not the two the spec named.** `ProjectExporter`
 * and `ProjectImporter` are the file seams, but between them the project lives
 * in `ProjectModel`/`ComponentModel`, and `ComponentModel.fromJSON`/`toJSON`
 * carried `name`, `id`, `graph` and `metadata` only. An exporter fix without the
 * model fix writes a field the model never held, i.e. nothing. So this spec
 * drives the model, not just the two io modules — `ProjectModel.fromJSON(…)`
 * → `.toJSON()` is exactly what `projectmodel.ts:662` hands to
 * `ProjectStructureService.saveProject`.
 *
 * The second half of the file is the F46 property: a component *without* a
 * description gains no key and produces no diff on a save that changed nothing.
 * That is asserted through `ComponentSaver`'s own change detection, which is the
 * thing that actually decides whether a file gets rewritten.
 */

import { ProjectExporter, legacyNameToPath } from '../../src/editor/src/io/ProjectExporter';
import type { LegacyProject } from '../../src/editor/src/io/ProjectExporter';
import { ProjectImporter, reconstructLegacyComponent } from '../../src/editor/src/io/ProjectImporter';
import type { ImportInput } from '../../src/editor/src/io/ProjectImporter';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';
import { ComponentSaver } from '../../src/editor/src/services/ProjectStructure/ComponentSaver';
import type {
  ComponentV2File,
  ConnectionsV2File,
  NodesV2File,
  ProjectV2File,
  RegistryV2File
} from '../../src/editor/src/schemas';
import type { ProjectStructureFilesystem } from '../../src/editor/src/services/ProjectStructure/types';
import { contentAt, fileAt } from './v2-files';

/**
 * `seedFromProject` and `getChangedComponents` are pure — they hash the built v2
 * files and touch nothing else. A filesystem that throws makes that explicit: if
 * change detection ever starts reading disk, this spec says so loudly instead of
 * silently measuring something else.
 */
function noopFilesystem(): ProjectStructureFilesystem {
  const refuse = () => {
    throw new Error('LEG-006 change-detection spec: the saver must not touch the filesystem here');
  };
  return {
    join: (...parts: string[]) => parts.join('/'),
    dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
    exists: () => true,
    readJson: refuse,
    writeFile: refuse,
    renameFile: refuse,
    removeFile: refuse,
    makeDirectory: refuse,
    removeDirRecursive: refuse
  } as ProjectStructureFilesystem;
}

// ─── The authored input ──────────────────────────────────────────────────────

const COMPONENT_PATH = 'Components/BenchProbe';
const LEGACY_NAME = '/Components/BenchProbe';

/** 218 characters — the length BEN-005 measured being destroyed. */
const AUTHORED_DESCRIPTION =
  'A bench probe component with one text input and one visible label, built so a live drive can set a value ' +
  'from outside and read what the canvas shows. It exists to prove the bench mounts a component and reports ' +
  'its ports.';
const AUTHORED_CREATED = '2026-08-09T10:15:00.000Z';
const AUTHORED_MODIFIED_BY = 'noodl-mcp';

/**
 * `component.json` exactly as `noodl-mcp`'s `assembleCreateFiles` writes it —
 * the same key set, including the two provenance fields the same save dropped.
 */
function authoredComponentFile(withDescription: boolean): ComponentV2File {
  return {
    $schema: 'https://opennoodl.dev/schemas/component-v2.json',
    id: 'c_bench_probe',
    name: 'BenchProbe',
    path: LEGACY_NAME,
    type: 'visual',
    created: AUTHORED_CREATED,
    modified: '2026-08-09T10:15:00.000Z',
    modifiedBy: AUTHORED_MODIFIED_BY,
    ...(withDescription ? { description: AUTHORED_DESCRIPTION } : {})
  };
}

function authoredNodesFile(): NodesV2File {
  return {
    $schema: 'https://opennoodl.dev/schemas/nodes-v2.json',
    componentId: 'c_bench_probe',
    version: 1,
    nodes: [
      { id: 'probe_root', type: 'Group', label: 'Probe root', children: ['probe_text'] },
      { id: 'probe_text', type: 'Text', label: 'Probe label', parent: 'probe_root', parameters: { text: 'hi' } }
    ],
    visualRoots: ['probe_root']
  };
}

function authoredConnectionsFile(): ConnectionsV2File {
  return {
    $schema: 'https://opennoodl.dev/schemas/connections-v2.json',
    componentId: 'c_bench_probe',
    version: 1,
    connections: []
  };
}

function authoredProjectFile(): ProjectV2File {
  return {
    $schema: 'https://opennoodl.dev/schemas/project-v2.json',
    name: 'LEG-006 probe project',
    id: 'leg006-project',
    version: '4',
    nodegxVersion: '1.1.0',
    structure: { componentsDir: 'components', assetsDir: 'assets' }
  } as ProjectV2File;
}

function authoredRegistry(): RegistryV2File {
  return {
    $schema: 'https://opennoodl.dev/schemas/registry-v2.json',
    version: 1,
    components: {
      [COMPONENT_PATH]: { path: COMPONENT_PATH, type: 'visual', nodeCount: 2, connectionCount: 0 }
    }
  } as RegistryV2File;
}

function importInput(componentFile: ComponentV2File): ImportInput {
  return {
    project: authoredProjectFile(),
    registry: authoredRegistry(),
    components: {
      [COMPONENT_PATH]: {
        component: componentFile,
        nodes: authoredNodesFile(),
        connections: authoredConnectionsFile()
      }
    }
  };
}

// ─── The two production halves, as functions ─────────────────────────────────

/**
 * "The editor loads this project": v2 files → legacy JSON → the live model.
 * `ProjectStructureService.loadProject` runs the importer and hands the result
 * to `ProjectModel.fromJSON`, which is what this reproduces.
 */
function editorLoad(input: ImportInput): ProjectModel {
  const { project } = new ProjectImporter().import(input);
  return ProjectModel.fromJSON(JSON.parse(JSON.stringify(project)));
}

/**
 * "The editor saves this project": the live model → legacy JSON → v2 files.
 * `projectmodel.ts:662` calls `saveProject(dir, this.toJSON())`, and the saver
 * builds each component's files with `buildComponentV2Files` — which is what
 * `ProjectExporter.export` delegates to, so exporting here exercises the same
 * builder the per-component saver uses.
 */
function editorSave(model: ProjectModel): { componentFile: ComponentV2File; input: ImportInput } {
  const legacy = model.toJSON() as unknown as LegacyProject;
  const result = new ProjectExporter().export(legacy);
  const componentPath = legacyNameToPath(LEGACY_NAME);
  const componentFile = fileAt<ComponentV2File>(result, `components/${componentPath}/component.json`);

  return {
    componentFile,
    input: {
      project: fileAt<ProjectV2File>(result, 'nodegx.project.json'),
      registry: fileAt<RegistryV2File>(result, 'components/_registry.json'),
      components: {
        [componentPath]: {
          component: componentFile,
          nodes: fileAt<NodesV2File>(result, `components/${componentPath}/nodes.json`),
          connections: fileAt<ConnectionsV2File>(result, `components/${componentPath}/connections.json`)
        }
      }
    }
  };
}

// ─── Specs ───────────────────────────────────────────────────────────────────

describe('LEG-006 — a component description survives the editor', () => {
  it('survives author → save → reload → save (the BEN-005 sequence)', () => {
    // 1. author
    const authored = importInput(authoredComponentFile(true));

    // 2. save
    const firstSave = editorSave(editorLoad(authored));

    expect(firstSave.componentFile.description).toBe(AUTHORED_DESCRIPTION);
    // In the same assertion, per the spec: these two were dropped by the same
    // save, and a fix that carries one and not the others leaves a register row
    // outliving its fix.
    expect(firstSave.componentFile.created).toBe(AUTHORED_CREATED);
    expect(firstSave.componentFile.modifiedBy).toBe(AUTHORED_MODIFIED_BY);

    // 3. reload + 4. save. This is the step that fails when the importer or the
    // model half is missing while the exporter half is present.
    const secondSave = editorSave(editorLoad(firstSave.input));

    expect(secondSave.componentFile.description).toBe(AUTHORED_DESCRIPTION);
    expect(secondSave.componentFile.created).toBe(AUTHORED_CREATED);
    expect(secondSave.componentFile.modifiedBy).toBe(AUTHORED_MODIFIED_BY);

    // And a third, because "survives one extra round trip" and "is a fixed
    // point" are different claims and only the second is the one that matters.
    const thirdSave = editorSave(editorLoad(secondSave.input));
    expect(thirdSave.componentFile.description).toBe(AUTHORED_DESCRIPTION);
    expect(thirdSave.componentFile.created).toBe(AUTHORED_CREATED);
    expect(thirdSave.componentFile.modifiedBy).toBe(AUTHORED_MODIFIED_BY);
  });

  it('holds the description on the in-memory model between load and save', () => {
    // The seam the spec did not name. If this is red and the round trip above is
    // green, the round trip is being satisfied by something other than the model
    // and the picker will still show nothing.
    const model = editorLoad(importInput(authoredComponentFile(true)));
    const component = model.getComponentWithName(LEGACY_NAME);

    expect(component).toBeTruthy();
    expect(component.description).toBe(AUTHORED_DESCRIPTION);
    expect(component.created).toBe(AUTHORED_CREATED);
    expect(component.modifiedBy).toBe(AUTHORED_MODIFIED_BY);
  });

  it('carries the description through the pure reconstruct helper', () => {
    // `ComponentLoader` (the surgical single-component reload used by file-watch
    // and live collab) goes through this function and not through
    // `ProjectImporter.import`, so it needs its own assertion.
    const component = reconstructLegacyComponent(
      COMPONENT_PATH,
      authoredComponentFile(true),
      authoredNodesFile(),
      authoredConnectionsFile()
    );

    expect(component.description).toBe(AUTHORED_DESCRIPTION);
    expect(component.created).toBe(AUTHORED_CREATED);
    expect(component.modifiedBy).toBe(AUTHORED_MODIFIED_BY);
  });

  it('puts the created timestamp in the registry entry', () => {
    const { componentFile: _f, input } = editorSave(editorLoad(importInput(authoredComponentFile(true))));
    const entry = input.registry.components[COMPONENT_PATH];

    expect(entry).toBeTruthy();
    expect(entry.created).toBe(AUTHORED_CREATED);
  });
});

describe('LEG-006 — a component without a description gains nothing (F46)', () => {
  it('writes no description key, and no created/modifiedBy it was not given', () => {
    const { componentFile } = editorSave(editorLoad(importInput(authoredComponentFile(false))));

    // Absent, not empty. An empty string is a value, and a value is a diff.
    expect('description' in componentFile).toBe(false);
    expect(componentFile.description).toBeUndefined();
  });

  it('really writes no key even when the source never had created or modifiedBy', () => {
    const bare = authoredComponentFile(false);
    delete bare.created;
    delete bare.modifiedBy;

    const { componentFile } = editorSave(editorLoad(importInput(bare)));

    expect('description' in componentFile).toBe(false);
    expect('created' in componentFile).toBe(false);
    expect('modifiedBy' in componentFile).toBe(false);
  });

  it('produces no diff on a save that changed nothing else', () => {
    // The property as the saver actually decides it: `getChangedComponents`
    // compares a content hash of the built v2 files, and a component that
    // hashes equal is never rewritten. Anything the LEG-006 carry added
    // unconditionally would show up here as a phantom change on every autosave
    // of every project in the corpus.
    const model = editorLoad(importInput(authoredComponentFile(false)));
    const legacy = model.toJSON() as unknown as LegacyProject;

    const saver = new ComponentSaver(noopFilesystem());

    saver.seedFromProject(legacy);
    const changeSet = saver.getChangedComponents(model.toJSON() as unknown as LegacyProject);

    expect(changeSet.changed.length).toBe(0);
    expect(changeSet.removed.length).toBe(0);
  });

  it('a described component is likewise stable — the carry is not a per-save mutation', () => {
    const model = editorLoad(importInput(authoredComponentFile(true)));

    const saver = new ComponentSaver(noopFilesystem());

    saver.seedFromProject(model.toJSON() as unknown as LegacyProject);
    const changeSet = saver.getChangedComponents(model.toJSON() as unknown as LegacyProject);

    expect(changeSet.changed.length).toBe(0);
  });
});

describe('LEG-006 — the exporter/importer pair on their own', () => {
  it('exports the description onto component.json', () => {
    const project: LegacyProject = {
      name: 'LEG-006 direct',
      components: [
        {
          name: LEGACY_NAME,
          id: 'c_bench_probe',
          description: AUTHORED_DESCRIPTION,
          created: AUTHORED_CREATED,
          modifiedBy: AUTHORED_MODIFIED_BY,
          graph: { roots: [], connections: [] }
        }
      ]
    };

    const result = new ProjectExporter().export(project);
    const file = contentAt<ComponentV2File>(result, `components/${legacyNameToPath(LEGACY_NAME)}/component.json`);

    expect(file).toBeTruthy();
    expect(file.description).toBe(AUTHORED_DESCRIPTION);
    expect(file.created).toBe(AUTHORED_CREATED);
    expect(file.modifiedBy).toBe(AUTHORED_MODIFIED_BY);
  });

  it('does not turn an empty-string description into a written key', () => {
    const project: LegacyProject = {
      name: 'LEG-006 empty',
      components: [
        { name: LEGACY_NAME, id: 'c_bench_probe', description: '', graph: { roots: [], connections: [] } }
      ]
    };

    const result = new ProjectExporter().export(project);
    const file = contentAt<ComponentV2File>(result, `components/${legacyNameToPath(LEGACY_NAME)}/component.json`);

    expect('description' in file).toBe(false);
  });
});
