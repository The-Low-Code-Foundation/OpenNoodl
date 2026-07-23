/**
 * ComponentSaver tests — STRUCT-006 (SUB-001)
 */
import {
  ComponentSaver,
  hashComponent,
  normalizeComponentForV2
} from '../../../src/editor/src/services/ProjectStructure/ComponentSaver';
import type { RegistryV2File } from '../../../src/editor/src/schemas';
import { MemFs } from './memfs';
import { makeProject, makeNode, seedV2Project } from './fixtures';

const DIR = '/proj';

describe('hashComponent', () => {
  it('is stable across key ordering and the modified timestamp', () => {
    const a = { name: '/C', id: 'c', graph: { roots: [makeNode('n1')], connections: [] } };
    const b = { id: 'c', graph: { connections: [], roots: [makeNode('n1')] }, name: '/C' };
    expect(hashComponent(a)).toBe(hashComponent(b));
  });

  it('changes when node content changes', () => {
    const a = { name: '/C', id: 'c', graph: { roots: [makeNode('n1', 'Group')], connections: [] } };
    const b = { name: '/C', id: 'c', graph: { roots: [makeNode('n1', 'Text')], connections: [] } };
    expect(hashComponent(a)).not.toBe(hashComponent(b));
  });

  it('ignores child node x/y (normalized away)', () => {
    const withPos = {
      name: '/C',
      id: 'c',
      graph: { roots: [makeNode('r', 'Group', { children: [makeNode('c1', 'Text', { x: 5, y: 9 })] })], connections: [] }
    };
    const withoutPos = {
      name: '/C',
      id: 'c',
      graph: { roots: [makeNode('r', 'Group', { children: [makeNode('c1', 'Text', { x: 0, y: 0 })] })], connections: [] }
    };
    expect(hashComponent(withPos)).toBe(hashComponent(withoutPos));
  });
});

describe('normalizeComponentForV2', () => {
  it('strips child x/y but not root x/y, without mutating the input', () => {
    const input = {
      name: '/C',
      id: 'c',
      graph: { roots: [makeNode('r', 'Group', { x: 3, y: 4, children: [makeNode('c1', 'Text', { x: 5, y: 6 })] })], connections: [] }
    };
    const out = normalizeComponentForV2(input);
    expect(out.graph.roots[0].x).toBe(3);
    expect(out.graph.roots[0].children[0].x).toBeUndefined();
    // input untouched
    expect(input.graph.roots[0].children[0].x).toBe(5);
  });
});

describe('ComponentSaver.getChangedComponents', () => {
  it('reports nothing changed right after seeding from the project', () => {
    const saver = new ComponentSaver(new MemFs());
    const project = makeProject();
    saver.seedFromProject(project);
    const cs = saver.getChangedComponents(project);
    expect(cs.changed.length).toBe(0);
    expect(cs.removed.length).toBe(0);
  });

  it('detects exactly the edited component', () => {
    const saver = new ComponentSaver(new MemFs());
    const project = makeProject();
    saver.seedFromProject(project);

    project.components[1].graph.roots.push(makeNode('extra', 'Text'));
    const cs = saver.getChangedComponents(project);
    expect(cs.changed.map((c) => c.path)).toEqual(['Pages/Home']);
  });

  it('detects added and removed components', () => {
    const saver = new ComponentSaver(new MemFs());
    const project = makeProject();
    saver.seedFromProject(project);

    project.components.push({ name: '/New', id: 'new', graph: { roots: [], connections: [] } });
    project.components.splice(2, 1); // remove /Header
    const cs = saver.getChangedComponents(project);
    expect(cs.changed.map((c) => c.path)).toEqual(['New']);
    expect(cs.removed).toEqual(['Header']);
  });

  it('noteExternalWrite suppresses a save-back for an externally-applied change', () => {
    const saver = new ComponentSaver(new MemFs());
    const project = makeProject();
    saver.seedFromProject(project);

    // A peer changed Header; our in-memory model is updated to match.
    project.components[2].graph.roots.push(makeNode('peer', 'Text'));
    saver.noteExternalWrite('Header', project.components[2]);

    const cs = saver.getChangedComponents(project);
    expect(cs.changed.length).toBe(0); // no echo
  });
});

describe('ComponentSaver.saveComponent', () => {
  it('writes exactly the three component files and nothing else', async () => {
    const fs = new MemFs();
    const saver = new ComponentSaver(fs);
    const comp = makeProject().components[1]; // Pages/Home

    await saver.saveComponent(DIR, 'Pages/Home', comp);
    const written = fs.pathsUnder(`${DIR}/components/Pages/Home`);
    expect(written).toEqual([
      `${DIR}/components/Pages/Home/component.json`,
      `${DIR}/components/Pages/Home/connections.json`,
      `${DIR}/components/Pages/Home/nodes.json`
    ]);
    // No leftover temp files.
    expect(fs.paths().some((p) => p.endsWith('.tmp'))).toBe(false);
  });

  it('leaves the previous files intact when a write is interrupted', async () => {
    const fs = new MemFs();
    seedV2Project(fs, DIR, makeProject());
    const before = fs.files.get(`${DIR}/components/Header/nodes.json`);

    const saver = new ComponentSaver(fs);
    const edited = { name: '/Header', id: 'comp__Header', graph: { roots: [makeNode('new', 'Text')], connections: [] } };

    // Fail the rename of nodes.json — staging is done first, so no file is committed.
    fs.failOn = { op: 'rename', path: `${DIR}/components/Header/nodes.json` };
    let threw = false;
    try {
      await saver.saveComponent(DIR, 'Header', edited);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);

    // Original nodes.json unchanged and still valid JSON.
    expect(fs.files.get(`${DIR}/components/Header/nodes.json`)).toBe(before);
    expect(() => JSON.parse(fs.files.get(`${DIR}/components/Header/component.json`)!)).not.toThrow();
    // No temp files left behind.
    expect(fs.paths().some((p) => p.endsWith('.tmp'))).toBe(false);
  });
});

describe('ComponentSaver.updateRegistry', () => {
  it('updates changed entries, drops removed, and recomputes stats', async () => {
    const fs = new MemFs();
    seedV2Project(fs, DIR, makeProject());
    const saver = new ComponentSaver(fs);

    const changeSet = {
      changed: [
        {
          path: 'Pages/Home',
          component: {
            name: '/Pages/Home',
            id: 'x',
            graph: { roots: [makeNode('a'), makeNode('b')], connections: [{ fromId: 'a', fromProperty: 'p', toId: 'b', toProperty: 'q' }] }
          }
        }
      ],
      removed: ['Header']
    };
    await saver.updateRegistry(DIR, changeSet);

    const registry = JSON.parse(fs.files.get(`${DIR}/components/_registry.json`)!) as RegistryV2File;
    expect(registry.components['Pages/Home'].nodeCount).toBe(2);
    expect(registry.components['Pages/Home'].connectionCount).toBe(1);
    expect(registry.components['Header']).toBeUndefined();
    expect(registry.stats!.totalComponents).toBe(2); // rootcomponent + Pages/Home
  });
});
