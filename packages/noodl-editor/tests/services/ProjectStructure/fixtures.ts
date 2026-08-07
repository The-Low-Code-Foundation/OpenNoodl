/**
 * Shared fixtures for ProjectStructure tests: builds a legacy project and writes
 * its exported v2 files onto a MemFs, so load/save can be round-tripped.
 */
import {
  ProjectExporter,
  LegacyProject,
  LegacyComponent,
  LegacyNode
} from '../../../src/editor/src/io/ProjectExporter';
import { MemFs } from './memfs';

export const makeNode = (id: string, type = 'Group', overrides: Partial<LegacyNode> = {}): LegacyNode => ({
  id,
  type,
  x: 0,
  y: 0,
  parameters: {},
  children: [],
  ...overrides
});

export const makeComponent = (name: string, overrides: Partial<LegacyComponent> = {}): LegacyComponent => ({
  name,
  id: 'comp_' + name.replace(/[^a-z0-9]/gi, '_'),
  graph: { roots: [], connections: [] },
  ...overrides
});

export function makeProject(overrides: Partial<LegacyProject> = {}): LegacyProject {
  return {
    name: 'Test Project',
    id: 'proj_test',
    version: '4',
    components: [
      makeComponent('/%rootcomponent', {
        graph: { roots: [makeNode('root1', 'Group')], connections: [] }
      }),
      makeComponent('/Pages/Home', {
        graph: {
          roots: [makeNode('home1', 'Group', { children: [makeNode('home2', 'Text')] })],
          connections: [{ fromId: 'home1', fromProperty: 'a', toId: 'home2', toProperty: 'b' }]
        }
      }),
      makeComponent('/Header', {
        graph: { roots: [makeNode('hdr1', 'Group')], connections: [] }
      })
    ],
    variants: [],
    ...overrides
  };
}

/** Exports a legacy project to v2 and writes every file onto the MemFs at `dir`. */
export function seedV2Project(fs: MemFs, dir: string, project: LegacyProject): void {
  const result = new ProjectExporter().export(project);
  for (const file of result.files) {
    fs.files.set(fs.join(dir, file.relativePath), JSON.stringify(file.content, null, 2));
  }
}
