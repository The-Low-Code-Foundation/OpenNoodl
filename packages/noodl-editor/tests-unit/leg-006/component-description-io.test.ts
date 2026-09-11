/**
 * LEG-006 — the file halves of the description round trip, in a runner that
 * does not need Electron.
 *
 * The full acceptance is the four-step sequence *through the live model*
 * (`tests/io/component-description-roundtrip.test.ts`), because
 * `ComponentModel` sits between the importer and the exporter and drops
 * anything it does not hold. That spec needs the Jasmine/Electron renderer:
 * `componentmodel.ts` pulls in `NodeLibrary`, `ProjectModel` and the undo queue.
 *
 * This file is the part that is reachable from plain Node — the exporter, the
 * importer, and `ComponentSaver`'s change detection — and it is here because a
 * spec that can only run in a serial Electron window is a spec that runs rarely.
 * The F46 property in particular belongs somewhere it runs on every push: an
 * unconditional field on `componentFile` would make **every** component in
 * **every** project look changed on **every** autosave, and that is the kind of
 * regression that should not wait for a renderer.
 *
 * @see dev-docs/tasks/phase-50-legibility/LEG-006-THE-DESCRIPTION-THAT-IS-DELETED.md
 */

import {
  ProjectExporter,
  buildComponentV2Files,
  legacyNameToPath
} from '../../src/editor/src/io/ProjectExporter';
import type { LegacyComponent, LegacyProject } from '../../src/editor/src/io/ProjectExporter';
import { ProjectImporter, reconstructLegacyComponent } from '../../src/editor/src/io/ProjectImporter';
import type { ImportInput } from '../../src/editor/src/io/ProjectImporter';
import { ComponentSaver, hashComponent } from '../../src/editor/src/services/ProjectStructure/ComponentSaver';
import type { ProjectStructureFilesystem } from '../../src/editor/src/services/ProjectStructure/types';
import type {
  ComponentV2File,
  ConnectionsV2File,
  NodesV2File,
  ProjectV2File,
  RegistryV2File
} from '../../src/editor/src/schemas';

const LEGACY_NAME = '/Components/BenchProbe';
const COMPONENT_PATH = 'Components/BenchProbe';

/** 218 characters — the length BEN-005 watched a save destroy (register B23). */
const DESCRIPTION =
  'A bench probe component with one text input and one visible label, built so a live drive can set a value ' +
  'from outside and read what the canvas shows. It exists to prove the bench mounts a component and reports ' +
  'its ports.';
const CREATED = '2026-08-09T10:15:00.000Z';
const MODIFIED_BY = 'noodl-mcp';

function componentFile(overrides: Partial<ComponentV2File> = {}): ComponentV2File {
  return {
    $schema: 'https://opennoodl.dev/schemas/component-v2.json',
    id: 'c_bench_probe',
    name: 'BenchProbe',
    path: LEGACY_NAME,
    type: 'visual',
    created: CREATED,
    modified: '2026-08-09T10:15:00.000Z',
    modifiedBy: MODIFIED_BY,
    description: DESCRIPTION,
    ...overrides
  };
}

function nodesFile(): NodesV2File {
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

function connectionsFile(): ConnectionsV2File {
  return {
    $schema: 'https://opennoodl.dev/schemas/connections-v2.json',
    componentId: 'c_bench_probe',
    version: 1,
    connections: []
  };
}

function importInput(file: ComponentV2File): ImportInput {
  return {
    project: {
      $schema: 'https://opennoodl.dev/schemas/project-v2.json',
      name: 'LEG-006 probe project',
      id: 'leg006-project',
      version: '4',
      nodegxVersion: '1.1.0',
      structure: { componentsDir: 'components', assetsDir: 'assets' }
    } as ProjectV2File,
    registry: {
      $schema: 'https://opennoodl.dev/schemas/registry-v2.json',
      version: 1,
      components: {
        [COMPONENT_PATH]: { path: COMPONENT_PATH, type: 'visual', nodeCount: 2, connectionCount: 0 }
      }
    } as RegistryV2File,
    components: {
      [COMPONENT_PATH]: { component: file, nodes: nodesFile(), connections: connectionsFile() }
    }
  };
}

/** Export a legacy project and hand back the one component file it produced. */
function exportComponentFile(project: LegacyProject): ComponentV2File {
  const result = new ProjectExporter().export(project);
  const file = result.files.find(
    (f) => f.relativePath === `components/${legacyNameToPath(LEGACY_NAME)}/component.json`
  );
  if (!file) throw new Error('exporter produced no component.json');
  return file.content as ComponentV2File;
}

function refusingFilesystem(): ProjectStructureFilesystem {
  const refuse = () => {
    throw new Error('change detection must not touch the filesystem');
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

describe('LEG-006 — the exporter writes the description', () => {
  it('carries description, created and modifiedBy onto component.json', () => {
    const file = exportComponentFile({
      name: 'p',
      components: [
        {
          name: LEGACY_NAME,
          id: 'c_bench_probe',
          description: DESCRIPTION,
          created: CREATED,
          modifiedBy: MODIFIED_BY,
          graph: { roots: [], connections: [] }
        }
      ]
    });

    expect(file.description).toBe(DESCRIPTION);
    expect(file.created).toBe(CREATED);
    expect(file.modifiedBy).toBe(MODIFIED_BY);
  });

  it('omits the keys entirely when the component has none — no empty string, no diff', () => {
    const file = exportComponentFile({
      name: 'p',
      components: [{ name: LEGACY_NAME, id: 'c_bench_probe', graph: { roots: [], connections: [] } }]
    });

    expect('description' in file).toBe(false);
    expect('created' in file).toBe(false);
    expect('modifiedBy' in file).toBe(false);
  });

  it('treats an empty-string description as absent', () => {
    const file = exportComponentFile({
      name: 'p',
      components: [
        { name: LEGACY_NAME, id: 'c_bench_probe', description: '', created: '', graph: { roots: [], connections: [] } }
      ]
    });

    expect('description' in file).toBe(false);
    expect('created' in file).toBe(false);
  });

  it('puts created into the registry entry', () => {
    const result = new ProjectExporter().export({
      name: 'p',
      components: [
        {
          name: LEGACY_NAME,
          id: 'c_bench_probe',
          created: CREATED,
          graph: { roots: [], connections: [] }
        }
      ]
    });
    const registry = result.files.find((f) => f.relativePath === 'components/_registry.json')!
      .content as RegistryV2File;

    expect(registry.components[COMPONENT_PATH].created).toBe(CREATED);
  });
});

describe('LEG-006 — the importer reads it back', () => {
  it('reconstructLegacyComponent carries all three', () => {
    const component = reconstructLegacyComponent(COMPONENT_PATH, componentFile(), nodesFile(), connectionsFile());

    expect(component.description).toBe(DESCRIPTION);
    expect(component.created).toBe(CREATED);
    expect(component.modifiedBy).toBe(MODIFIED_BY);
  });

  it('adds no key when the file has none', () => {
    const bare = componentFile();
    delete bare.description;
    delete bare.created;
    delete bare.modifiedBy;

    const component = reconstructLegacyComponent(COMPONENT_PATH, bare, nodesFile(), connectionsFile());

    expect('description' in component).toBe(false);
    expect('created' in component).toBe(false);
    expect('modifiedBy' in component).toBe(false);
  });

  it('is a fixed point across import → export → import (the file halves only)', () => {
    // ⚠️ This is NOT the acceptance. It exercises both file seams but skips the
    // in-memory model, and the model is where the field was actually being
    // dropped in the pre-LEG-006 chain. See the Jasmine spec for the real one.
    const first = new ProjectImporter().import(importInput(componentFile()));
    const exported = exportComponentFile(first.project);
    const second = new ProjectImporter().import(importInput(exported));
    const component = second.project.components[0];

    expect(component.description).toBe(DESCRIPTION);
    expect(component.created).toBe(CREATED);
    expect(component.modifiedBy).toBe(MODIFIED_BY);
  });
});

describe('LEG-006 — no spurious diff (F46)', () => {
  const undescribed: LegacyComponent = {
    name: LEGACY_NAME,
    id: 'c_bench_probe',
    graph: {
      roots: [{ id: 'probe_root', type: 'Group', children: [] }],
      connections: []
    }
  };
  const described: LegacyComponent = { ...undescribed, description: DESCRIPTION, created: CREATED };

  it('an undescribed component hashes the same before and after the LEG-006 carry', () => {
    // The carry is conditional, so a component with none of the three fields
    // must build byte-identical files. Hashing it twice proves determinism;
    // the key assertions above prove the keys are absent, which together is
    // what "no diff" means to `getChangedComponents`.
    expect(hashComponent(undescribed)).toBe(hashComponent({ ...undescribed }));

    const built = buildComponentV2Files(undescribed, '2026-01-01T00:00:00.000Z');
    expect(Object.keys(built.component).sort()).toEqual(['$schema', 'id', 'modified', 'name', 'path', 'type']);
  });

  it('a save that changed nothing reports nothing changed — undescribed', () => {
    const project: LegacyProject = { name: 'p', components: [undescribed] };
    const saver = new ComponentSaver(refusingFilesystem());

    saver.seedFromProject(project);
    const changeSet = saver.getChangedComponents({ name: 'p', components: [{ ...undescribed }] });

    expect(changeSet.changed.length).toBe(0);
    expect(changeSet.removed.length).toBe(0);
  });

  it('a save that changed nothing reports nothing changed — described', () => {
    // The other polarity: the carry must not be a per-save mutation either, or
    // an MCP-authored project would rewrite every component on every autosave.
    const project: LegacyProject = { name: 'p', components: [described] };
    const saver = new ComponentSaver(refusingFilesystem());

    saver.seedFromProject(project);
    const changeSet = saver.getChangedComponents({ name: 'p', components: [{ ...described }] });

    expect(changeSet.changed.length).toBe(0);
  });

  it('changing the description IS a change — the hash must see it', () => {
    // The control. Without this, all three assertions above are satisfied by a
    // change detector that notices nothing at all.
    const saver = new ComponentSaver(refusingFilesystem());
    saver.seedFromProject({ name: 'p', components: [described] });

    const edited: LegacyComponent = { ...described, description: DESCRIPTION + ' Edited.' };
    const changeSet = saver.getChangedComponents({ name: 'p', components: [edited] });

    expect(changeSet.changed.length).toBe(1);
    expect(changeSet.changed[0].path).toBe(COMPONENT_PATH);
  });

  it('adding a description to a component that had none is a change', () => {
    const saver = new ComponentSaver(refusingFilesystem());
    saver.seedFromProject({ name: 'p', components: [undescribed] });

    const changeSet = saver.getChangedComponents({
      name: 'p',
      components: [{ ...undescribed, description: 'Now it has one.' }]
    });

    expect(changeSet.changed.length).toBe(1);
  });
});
