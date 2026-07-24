/**
 * SUB-007 step 7: parity between the deleted legacy `utils/projectmerger.js`
 * and the graph-engine merger in `versioning/ProjectMerge.ts`.
 *
 * Two halves:
 *
 *  1. The captured real merge fixtures, merged and compared against goldens
 *     recorded from the legacy merger before it was removed
 *     (`tests/testfs/merge-tests/legacy-golden/`). The comparison is
 *     semantic — same nodes, parents, parameters and connections per
 *     component, same project scalars — not byte equality, because the
 *     divergences below are intentional.
 *  2. The divergences, pinned. Where the new merger deliberately differs, the
 *     expected NEW behaviour is asserted here so a regression cannot pass as
 *     "one of the known differences". Each is justified in SUB-007-DESIGN.md.
 *
 * Regenerating the goldens is not a fix. They are the record of what the
 * merger this replaced actually produced on real project histories; a
 * difference appearing here means the new merger changed behaviour.
 */

import * as fs from 'fs';

import {
  MERGE_CONFLICTS_KEY,
  mergeProject as mergeProjectRaw,
  mergeProjectGraph,
  mergeV2ComponentFiles,
  isV2ComponentFile,
  readMergeConflicts
} from '../../src/editor/src/versioning';

const FIXTURES = process.cwd() + '/tests/testfs/merge-tests';

type Json = Record<string, any>;

/**
 * The merger returns `Record<string, unknown>`; these specs walk deep into the
 * result, so index it as loose JSON rather than casting at every access.
 */
function mergeProject(base: Json, ours: Json, theirs: Json): Json {
  return mergeProjectRaw(base, ours, theirs) as Json;
}

interface FixtureCase {
  name: string;
  /** Basename under tests/testfs/merge-tests/legacy-golden/. */
  golden: string;
  base: string;
  ours: string;
  theirs: string;
}

const FIXTURE_CASES: FixtureCase[] = [
  {
    name: 'root capture (2020-08-06)',
    golden: 'root-2020-08-06',
    base: 'base-merge-project-Thu--06-Aug-2020-15-29-38-GMT.json',
    ours: 'ours-merge-project-Thu--06-Aug-2020-15-29-38-GMT.json',
    theirs: 'remote-merge-project-Thu--06-Aug-2020-15-29-38-GMT.json'
  },
  {
    name: 'deleted-root-node',
    golden: 'deleted-root-node',
    base: 'deleted-root-node/base.json',
    ours: 'deleted-root-node/ours.json',
    theirs: 'deleted-root-node/theirs.json'
  },
  {
    name: 'move-nodes',
    golden: 'move-nodes',
    base: 'move-nodes/base-merge-project-Wed--03-Feb-2021-11-07-55-GMT.json',
    ours: 'move-nodes/ours-merge-project-Wed--03-Feb-2021-11-07-55-GMT.json',
    theirs: 'move-nodes/remote-merge-project-Wed--03-Feb-2021-11-07-55-GMT.json'
  },
  {
    name: 'remove-component',
    golden: 'remove-component',
    base: 'remove-component/project-base.json',
    ours: 'remove-component/project-ours.json',
    theirs: 'remove-component/project-theirs.json'
  },
  {
    name: 'remove-moved-nodes (08-12)',
    golden: 'remove-moved-nodes-08-12',
    base: 'remove-moved-nodes/base-merge-project-Wed--03-Feb-2021-08-12-22-GMT.json',
    ours: 'remove-moved-nodes/ours-merge-project-Wed--03-Feb-2021-08-12-22-GMT.json',
    theirs: 'remove-moved-nodes/remote-merge-project-Wed--03-Feb-2021-08-12-22-GMT.json'
  },
  {
    name: 'remove-moved-nodes (13-33)',
    golden: 'remove-moved-nodes-13-33',
    base: 'remove-moved-nodes/base-merge-project-Wed--03-Feb-2021-13-33-47-GMT.json',
    ours: 'remove-moved-nodes/ours-merge-project-Wed--03-Feb-2021-13-33-47-GMT.json',
    theirs: 'remove-moved-nodes/remote-merge-project-Wed--03-Feb-2021-13-33-47-GMT.json'
  }
];

function read(file: string): Json {
  return JSON.parse(fs.readFileSync(`${FIXTURES}/${file}`, 'utf8'));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/** Key-order-insensitive stringify, so field ordering is never a difference. */
function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const record = value as Json;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`;
}

function flattenNodes(component: Json): Map<string, Json> {
  const out = new Map<string, Json>();
  const walk = (nodes: Json[] | undefined, parent?: string) => {
    (nodes ?? []).forEach((node) => {
      out.set(node.id, { type: node.type, parameters: node.parameters ?? {}, parent });
      walk(node.children, node.id);
    });
  };
  walk(component?.graph?.roots);
  return out;
}

function componentsByKey(project: Json): Map<string, Json> {
  const map = new Map<string, Json>();
  for (const component of project.components ?? []) map.set(component.id ?? component.name, component);
  return map;
}

function connectionKeys(component: Json): Set<string> {
  return new Set(
    (component?.graph?.connections ?? []).map(
      (c: Json) => `${c.fromId}:${c.fromProperty}->${c.toId}:${c.toProperty}`
    )
  );
}

function withoutConflictChannel(metadata: unknown): unknown {
  if (!metadata || typeof metadata !== 'object') return metadata;
  const { [MERGE_CONFLICTS_KEY]: _dropped, ...rest } = metadata as Json;
  return rest;
}

/** Every material difference between two merge outputs, as readable strings. */
function semanticDifferences(legacy: Json, next: Json): string[] {
  const differences: string[] = [];
  const legacyComponents = componentsByKey(legacy);
  const nextComponents = componentsByKey(next);

  for (const key of new Set([...legacyComponents.keys(), ...nextComponents.keys()])) {
    const inLegacy = legacyComponents.get(key);
    const inNext = nextComponents.get(key);
    if (!inLegacy) {
      differences.push(`component only in new: ${inNext.name}`);
      continue;
    }
    if (!inNext) {
      differences.push(`component only in legacy: ${inLegacy.name}`);
      continue;
    }

    const legacyNodes = flattenNodes(inLegacy);
    const nextNodes = flattenNodes(inNext);
    for (const id of new Set([...legacyNodes.keys(), ...nextNodes.keys()])) {
      const a = legacyNodes.get(id);
      const b = nextNodes.get(id);
      if (!a) {
        differences.push(`${inLegacy.name}: node only in new: ${b.type} ${id}`);
        continue;
      }
      if (!b) {
        differences.push(`${inLegacy.name}: node only in legacy: ${a.type} ${id}`);
        continue;
      }
      if (a.type !== b.type) differences.push(`${inLegacy.name}/${id}: type ${a.type} vs ${b.type}`);
      if (a.parent !== b.parent) differences.push(`${inLegacy.name}/${id}: parent ${a.parent} vs ${b.parent}`);
      for (const name of new Set([...Object.keys(a.parameters), ...Object.keys(b.parameters)])) {
        if (stable(a.parameters[name]) !== stable(b.parameters[name])) {
          differences.push(`${inLegacy.name}/${id}: parameter '${name}' differs`);
        }
      }
    }

    const legacyConnections = connectionKeys(inLegacy);
    const nextConnections = connectionKeys(inNext);
    for (const key of legacyConnections) {
      if (!nextConnections.has(key)) differences.push(`${inLegacy.name}: connection only in legacy: ${key}`);
    }
    for (const key of nextConnections) {
      if (!legacyConnections.has(key)) differences.push(`${inLegacy.name}: connection only in new: ${key}`);
    }
  }

  for (const key of ['name', 'settings', 'rootNodeId', 'version', 'metadata']) {
    // `metadata.mergeConflicts` is the new structured conflict channel — an
    // addition the legacy merger has no equivalent for, not a merge difference.
    const legacyValue = key === 'metadata' ? withoutConflictChannel(legacy[key]) : legacy[key];
    const nextValue = key === 'metadata' ? withoutConflictChannel(next[key]) : next[key];
    if (stable(legacyValue) !== stable(nextValue)) differences.push(`project.${key} differs`);
  }

  return differences;
}

describe('SUB-007 parity: graph merger vs the legacy merger it replaced', () => {
  FIXTURE_CASES.forEach((testCase) => {
    it(`matches the recorded legacy merge — ${testCase.name}`, () => {
      const legacyResult = read(`legacy-golden/${testCase.golden}.json`);
      const nextResult = mergeProject(
        read(testCase.base),
        clone(read(testCase.ours)),
        read(testCase.theirs)
      );

      const differences = semanticDifferences(legacyResult, nextResult);
      expect(differences).toEqual([]);
    });
  });

  it('does not mutate its inputs (the legacy merger did)', () => {
    const base = read(FIXTURE_CASES[1].base);
    const ours = read(FIXTURE_CASES[1].ours);
    const theirs = read(FIXTURE_CASES[1].theirs);
    const before = stable(ours);

    mergeProject(base, ours, theirs);

    expect(stable(ours)).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// Pinned divergences — the new behaviour, asserted deliberately.
// ---------------------------------------------------------------------------

function componentProject(component: Json): Json {
  return { components: [component] };
}

function graphOf(project: Json, index = 0): Json {
  return project.components[index].graph;
}

describe('SUB-007 parity: deliberate divergences from the legacy merger', () => {
  it('raises a conflict instead of resurrecting a comment we deleted (design §4.2)', () => {
    const comment = (text: string) => [{ id: 'c1', text, x: 0, y: 0, width: 100, height: 100 }];
    const base = componentProject({ name: 'comp1', graph: { roots: [], comments: comment('hej') } });
    const ours = componentProject({ name: 'comp1', graph: { roots: [], comments: [] } });
    const theirs = componentProject({ name: 'comp1', graph: { roots: [], comments: comment('hopp') } });

    const state = mergeProjectGraph(base, ours, theirs);

    // Legacy silently restored their edited comment. The engine keeps the
    // merge ours-flavored and reports the loss as a conflict instead.
    expect(graphOf(mergeProject(base, ours, theirs)).comments).toEqual([]);
    expect(state.conflicts.filter((conflict) => conflict.kind === 'comment').length).toBe(1);
    expect(state.conflicts[0].deletedBy).toBe('ours');
  });

  it('lets a component deletion win over a cosmetic-only edit (soft-equal rule)', () => {
    // Ours "changed" comp3 only by gaining an empty connections array, which
    // carries no semantics. Legacy kept the component; the engine deletes it.
    const base = componentProject({ name: 'comp3', graph: { roots: [] } });
    const ours = componentProject({ name: 'comp3', graph: { roots: [], connections: [] } });
    const theirs = { components: [] as Json[] };

    const merged = mergeProject(base, ours, theirs);

    expect(merged.components.length).toBe(0);
  });

  it('conflicts on delete-vs-edit of a node rather than resurrecting it', () => {
    const base = componentProject({
      name: 'comp1',
      graph: { roots: [{ type: '0', id: 'A' }], connections: [] }
    });
    const ours = componentProject({ name: 'comp1', graph: { roots: [], connections: [] } });
    const theirs = componentProject({
      name: 'comp1',
      graph: { roots: [{ type: '1', id: 'A' }], connections: [] }
    });

    const state = mergeProjectGraph(base, ours, theirs);
    const merged = mergeProject(base, ours, theirs);

    expect(graphOf(merged).roots.length).toBe(0);
    expect(state.conflicts.some((conflict) => conflict.kind === 'delete-vs-edit')).toBe(true);
  });

  it('leaves untouched components byte-identical instead of re-serializing them', () => {
    // Legacy normalized every component it passed through (injecting `ports: []`
    // and `comments: []`). A merge should not rewrite what nobody edited.
    const untouched = { name: 'comp2', graph: { roots: [{ type: '0', id: 'Z' }] } };
    const base = { components: [clone(untouched)] };
    const ours = { components: [clone(untouched)] };
    const theirs = { components: [clone(untouched)] };

    const merged = mergeProject(base, ours, theirs);

    expect(stable(merged.components[0])).toEqual(stable(untouched));
  });

  it('does not inject empty ports/comments arrays into merged nodes', () => {
    const node = (parameters: Json) => ({ type: '0', id: 'A', parameters });
    const base = componentProject({ name: 'comp1', graph: { roots: [node({ p1: 'base' })], connections: [] } });
    const ours = componentProject({ name: 'comp1', graph: { roots: [node({ p1: 'ours' })], connections: [] } });
    const theirs = componentProject({ name: 'comp1', graph: { roots: [node({ p2: 'theirs' })], connections: [] } });

    const merged = mergeProject(base, ours, theirs);
    const root = graphOf(merged).roots[0];

    expect(root.parameters).toEqual({ p1: 'ours', p2: 'theirs' });
    expect(root.ports).toBeUndefined();
    expect(graphOf(merged).comments).toBeUndefined();
  });

  it('reports project-level setting conflicts instead of silently keeping ours', () => {
    const base = { components: [], settings: { title: 'base' } };
    const ours = { components: [], settings: { title: 'ours' } };
    const theirs = { components: [], settings: { title: 'theirs' } };

    const state = mergeProjectGraph(base, ours, theirs);
    const merged = mergeProject(base, ours, theirs);

    expect((merged.settings as Json).title).toBe('ours');
    const conflict = state.conflicts.find((entry) => entry.kind === 'project-setting');
    expect(conflict).toBeDefined();
    expect(conflict.name).toBe('settings.title');
    expect(conflict.theirs).toBe('theirs');
  });
});

// ---------------------------------------------------------------------------
// Legacy compatibility surface the warnings UI still depends on.
// ---------------------------------------------------------------------------

describe('SUB-007 parity: legacy conflict stamping', () => {
  const base = { components: [{ name: 'comp1', graph: { roots: [{ type: '0', id: 'A', parameters: { p1: 'base' } }] } }] };
  const ours = { components: [{ name: 'comp1', graph: { roots: [{ type: '0', id: 'A', parameters: { p1: 'ours' } }] } }] };
  const theirs = {
    components: [{ name: 'comp1', graph: { roots: [{ type: '0', id: 'A', parameters: { p1: 'theirs' } }] } }]
  };

  it('stamps node.conflicts in the shape the warnings UI reads', () => {
    const merged = mergeProject(base, ours, theirs);
    const root = graphOf(merged).roots[0];

    expect(root.conflicts).toEqual([{ type: 'parameter', name: 'p1', ours: 'ours', theirs: 'theirs' }]);
  });

  it('omits the stamp when the caller wants structured conflicts only', () => {
    const state = mergeProjectGraph(base, ours, theirs);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { serializeMergedProject } = require('../../src/editor/src/versioning');
    const merged = serializeMergedProject(state, { stampLegacyConflicts: false });

    expect(merged.components[0].graph.roots[0].conflicts).toBeUndefined();
    expect(state.conflicts.length).toBe(1);
  });

  it('drops the stamp for a conflict that has been resolved', () => {
    const state = mergeProjectGraph(base, ours, theirs);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { resolveProjectConflict, serializeMergedProject } = require('../../src/editor/src/versioning');

    resolveProjectConflict(state, state.conflicts[0].id, 'theirs');
    const merged = serializeMergedProject(state);

    expect(merged.components[0].graph.roots[0].conflicts).toBeUndefined();
    expect(merged.components[0].graph.roots[0].parameters.p1).toBe('theirs');
  });
});

describe('SUB-007: structured conflict channel', () => {
  const base = { components: [{ name: 'comp1', graph: { roots: [{ type: '0', id: 'A', parameters: { p1: 'base' } }] } }] };
  const ours = { components: [{ name: 'comp1', graph: { roots: [{ type: '0', id: 'A', parameters: { p1: 'ours' } }] } }] };
  const theirs = {
    components: [{ name: 'comp1', graph: { roots: [{ type: '0', id: 'A', parameters: { p1: 'theirs' } }] } }]
  };

  it('writes every conflict into the merged project so the driver can report them', () => {
    // The git merge driver runs in its own process; the merged file is the
    // only channel back to the editor.
    const merged = mergeProject(base, ours, theirs);
    const carried = readMergeConflicts(merged);

    expect(carried.length).toBe(1);
    expect(carried[0].kind).toBe('parameter');
    expect(carried[0].component).toBe('comp1');
    expect(carried[0].node.id).toBe('A');
    expect(carried[0].theirs).toBe('theirs');
  });

  it('carries structural conflicts the legacy node stamps cannot express', () => {
    const deleted = { components: [{ name: 'comp1', graph: { roots: [] } }] };
    const edited = {
      components: [{ name: 'comp1', graph: { roots: [{ type: '0', id: 'A', parameters: { p1: 'theirs' } }] } }]
    };

    const merged = mergeProject(base, deleted, edited);
    const carried = readMergeConflicts(merged);

    expect(carried.some((conflict) => conflict.kind === 'delete-vs-edit')).toBe(true);
    // ...and no legacy stamp exists for it, which is why the channel is needed.
    expect(merged.components[0].graph.roots.length).toBe(0);
  });

  it('leaves no conflict channel behind when the merge is clean', () => {
    const merged = mergeProject(base, ours, ours);

    expect(readMergeConflicts(merged)).toEqual([]);
    expect(merged.metadata?.[MERGE_CONFLICTS_KEY]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// v2 component files — what the git merge driver operates on (SUB-007 step 6).
// ---------------------------------------------------------------------------

describe('SUB-007: v2 component merge', () => {
  const componentFile = (extra: Json = {}): Json => ({ id: 'c1', path: '/Login', type: 'component', ...extra });
  const nodesFile = (nodes: Json[]): Json => ({ componentId: 'c1', version: 1, nodes });
  const connectionsFile = (connections: Json[]): Json => ({ componentId: 'c1', version: 1, connections });

  const wire = (from: string, to: string): Json => ({
    fromId: from,
    fromProperty: 'out',
    toId: to,
    toProperty: 'in'
  });

  it('recognises the three files a component is written to', () => {
    expect(isV2ComponentFile('components/Login/nodes.json')).toBe(true);
    expect(isV2ComponentFile('components/Login/connections.json')).toBe(true);
    expect(isV2ComponentFile('components/Login/component.json')).toBe(true);
    expect(isV2ComponentFile('project.json')).toBe(false);
    expect(isV2ComponentFile('components/_registry.json')).toBe(false);
  });

  it('merges disjoint edits across the three files without conflict', () => {
    const base = {
      component: componentFile(),
      nodes: nodesFile([{ id: 'A', type: 'Group', parameters: { p: 'base' } }]),
      connections: connectionsFile([])
    };
    const ours = {
      component: componentFile(),
      nodes: nodesFile([{ id: 'A', type: 'Group', parameters: { p: 'ours' } }]),
      connections: connectionsFile([])
    };
    const theirs = {
      component: componentFile(),
      nodes: nodesFile([
        { id: 'A', type: 'Group', parameters: { p: 'base' } },
        { id: 'B', type: 'Text', parameters: {} }
      ]),
      connections: connectionsFile([wire('A', 'B')])
    };

    const { files, conflicts } = mergeV2ComponentFiles(base, ours, theirs);

    expect(conflicts).toEqual([]);
    const ids = (files.nodes.nodes as Json[]).map((node) => node.id).sort();
    expect(ids).toEqual(['A', 'B']);
    const merged = (files.nodes.nodes as Json[]).find((node) => node.id === 'A');
    expect(merged.parameters.p).toBe('ours');
    expect((files.connections.connections as Json[]).length).toBe(1);
  });

  it('catches the cross-file case: a connection to a node the other side deleted', () => {
    // This is why the three files are merged together rather than one at a
    // time — connections.json alone cannot see that the node is gone.
    const base = {
      component: componentFile(),
      nodes: nodesFile([
        { id: 'A', type: 'Group', parameters: {} },
        { id: 'B', type: 'Text', parameters: {} }
      ]),
      connections: connectionsFile([])
    };
    const ours = {
      component: componentFile(),
      nodes: nodesFile([{ id: 'A', type: 'Group', parameters: {} }]),
      connections: connectionsFile([])
    };
    const theirs = {
      component: componentFile(),
      nodes: nodesFile([
        { id: 'A', type: 'Group', parameters: {} },
        { id: 'B', type: 'Text', parameters: {} }
      ]),
      connections: connectionsFile([wire('A', 'B')])
    };

    const { conflicts } = mergeV2ComponentFiles(base, ours, theirs);

    expect(conflicts.some((conflict) => conflict.kind === 'connection-to-deleted')).toBe(true);
  });

  it('carries conflicts in component metadata for the out-of-process driver', () => {
    const nodes = (value: string) => nodesFile([{ id: 'A', type: 'Group', parameters: { p: value } }]);
    const { files, conflicts } = mergeV2ComponentFiles(
      { component: componentFile(), nodes: nodes('base'), connections: connectionsFile([]) },
      { component: componentFile(), nodes: nodes('ours'), connections: connectionsFile([]) },
      { component: componentFile(), nodes: nodes('theirs'), connections: connectionsFile([]) }
    );

    expect(conflicts.length).toBe(1);
    expect(files.component.metadata[MERGE_CONFLICTS_KEY].length).toBe(1);
    expect(files.component.metadata[MERGE_CONFLICTS_KEY][0].kind).toBe('parameter');
  });

  it('still merges when only one file is available (git per-file driver)', () => {
    // The CLI driver is handed one file at a time; the engine degrades to
    // whatever context it has rather than refusing.
    const nodes = (value: string) => nodesFile([{ id: 'A', type: 'Group', parameters: { p: value } }]);
    const { files } = mergeV2ComponentFiles({ nodes: nodes('base') }, { nodes: nodes('ours') }, { nodes: nodes('base') });

    const merged = (files.nodes.nodes as Json[])[0];
    expect(merged.parameters.p).toBe('ours');
  });
});
