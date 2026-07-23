/**
 * SUB-007's critical property: no merge case may silently lose a change.
 * Every semantic base→side change must appear in the merged output or in a
 * conflict. Exercised over seeded generated three-way scenarios plus the
 * real captured merge fixtures under tests/testfs/merge-tests.
 */

import * as fs from 'fs';

import { fromLegacyComponent, mergeGraphs, resolveAll } from '../../src/editor/src/versioning';
import { baseComponent, checkInvariants, checkNoLoss, cloneComponent, mutate, Rng, toSnapshot } from './helpers';

describe('GraphMerge no-silent-loss property', () => {
  it('holds across seeded generated three-way merges', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 150; seed++) {
      const rng = new Rng(seed * 2654435761);
      const base = baseComponent();
      const oursComponent = cloneComponent(base);
      const theirsComponent = cloneComponent(base);
      mutate(oursComponent, rng, 1 + rng.int(6), 'o');
      mutate(theirsComponent, rng, 1 + rng.int(6), 't');

      const baseSnapshot = toSnapshot(base);
      const ours = toSnapshot(oursComponent);
      const theirs = toSnapshot(theirsComponent);

      const { result, lost } = checkNoLoss(baseSnapshot, ours, theirs);
      for (const entry of lost) {
        failures.push(`seed ${seed}: lost ${entry.side} change ${entry.atom.key}=${entry.atom.value}`);
      }
      for (const problem of checkInvariants(result.merged)) {
        failures.push(`seed ${seed}: invariant: ${problem}`);
      }
    }
    expect(failures.slice(0, 25)).toEqual([]);
  });

  it('keeps the merged graph structurally valid after resolveAll on either side', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 60; seed++) {
      for (const side of ['ours', 'theirs'] as const) {
        const rng = new Rng(seed * 97 + (side === 'ours' ? 0 : 1));
        const base = baseComponent();
        const oursComponent = cloneComponent(base);
        const theirsComponent = cloneComponent(base);
        mutate(oursComponent, rng, 1 + rng.int(6), 'o');
        mutate(theirsComponent, rng, 1 + rng.int(6), 't');

        const result = mergeGraphs(toSnapshot(base), toSnapshot(oursComponent), toSnapshot(theirsComponent));
        resolveAll(result, side);
        for (const problem of checkInvariants(result.merged)) {
          failures.push(`seed ${seed} resolve ${side}: ${problem}`);
        }
      }
    }
    expect(failures.slice(0, 25)).toEqual([]);
  });

  it('merging identical sides is the identity and conflict-free', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = new Rng(seed);
      const base = baseComponent();
      const edited = cloneComponent(base);
      mutate(edited, rng, 3, 'o');
      const editedSnapshot = toSnapshot(edited);
      const { result, lost } = checkNoLoss(toSnapshot(base), editedSnapshot, toSnapshot(cloneComponent(edited)));
      expect(result.conflicts).toEqual([]);
      expect(lost).toEqual([]);
    }
  });

  it('holds on the real captured merge fixtures (repository history)', () => {
    const fixtures: [string, string, string, string][] = [
      [
        'move-nodes',
        'tests/testfs/merge-tests/move-nodes/base-merge-project-Wed--03-Feb-2021-11-07-55-GMT.json',
        'tests/testfs/merge-tests/move-nodes/ours-merge-project-Wed--03-Feb-2021-11-07-55-GMT.json',
        'tests/testfs/merge-tests/move-nodes/remote-merge-project-Wed--03-Feb-2021-11-07-55-GMT.json'
      ],
      [
        'remove-moved-nodes',
        'tests/testfs/merge-tests/remove-moved-nodes/base-merge-project-Wed--03-Feb-2021-08-12-22-GMT.json',
        'tests/testfs/merge-tests/remove-moved-nodes/ours-merge-project-Wed--03-Feb-2021-08-12-22-GMT.json',
        'tests/testfs/merge-tests/remove-moved-nodes/remote-merge-project-Wed--03-Feb-2021-08-12-22-GMT.json'
      ],
      [
        'deleted-root-node',
        'tests/testfs/merge-tests/deleted-root-node/base.json',
        'tests/testfs/merge-tests/deleted-root-node/ours.json',
        'tests/testfs/merge-tests/deleted-root-node/theirs.json'
      ]
    ];
    const failures: string[] = [];
    for (const [label, basePath, oursPath, theirsPath] of fixtures) {
      const read = (p: string) => JSON.parse(fs.readFileSync(process.cwd() + '/' + p, 'utf8'));
      const baseProject = read(basePath);
      const oursProject = read(oursPath);
      const theirsProject = read(theirsPath);
      const byName = (project: { components: { name: string }[] }) =>
        new Map(project.components.map((c) => [c.name, c]));
      const oursMap = byName(oursProject);
      const theirsMap = byName(theirsProject);
      for (const component of baseProject.components) {
        const oursComponent = oursMap.get(component.name);
        const theirsComponent = theirsMap.get(component.name);
        if (!oursComponent || !theirsComponent) continue;
        const { result, lost } = checkNoLoss(
          fromLegacyComponent(component),
          fromLegacyComponent(oursComponent),
          fromLegacyComponent(theirsComponent)
        );
        for (const entry of lost) {
          failures.push(`${label}/${component.name}: lost ${entry.side} ${entry.atom.key}`);
        }
        for (const problem of checkInvariants(result.merged)) {
          failures.push(`${label}/${component.name}: invariant: ${problem}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('matches legacy outcomes on the moved-nodes fixture (remote position wins)', () => {
    const read = (p: string) => JSON.parse(fs.readFileSync(process.cwd() + '/' + p, 'utf8'));
    const base = read('tests/testfs/merge-tests/move-nodes/base-merge-project-Wed--03-Feb-2021-11-07-55-GMT.json');
    const ours = read('tests/testfs/merge-tests/move-nodes/ours-merge-project-Wed--03-Feb-2021-11-07-55-GMT.json');
    const theirs = read('tests/testfs/merge-tests/move-nodes/remote-merge-project-Wed--03-Feb-2021-11-07-55-GMT.json');
    const movedNode = theirs.components[0].graph.roots[1];
    const result = mergeGraphs(
      fromLegacyComponent(base.components[0]),
      fromLegacyComponent(ours.components[0]),
      fromLegacyComponent(theirs.components[0])
    );
    const merged = result.merged.nodes.get(movedNode.id);
    expect(merged.x).toBe(movedNode.x);
    expect(merged.y).toBe(movedNode.y);
  });

  it('matches legacy outcomes on the remove-moved-nodes fixture (deletion wins over move)', () => {
    const read = (p: string) => JSON.parse(fs.readFileSync(process.cwd() + '/' + p, 'utf8'));
    const base = read('tests/testfs/merge-tests/remove-moved-nodes/base-merge-project-Wed--03-Feb-2021-08-12-22-GMT.json');
    const ours = read('tests/testfs/merge-tests/remove-moved-nodes/ours-merge-project-Wed--03-Feb-2021-08-12-22-GMT.json');
    const theirs = read(
      'tests/testfs/merge-tests/remove-moved-nodes/remote-merge-project-Wed--03-Feb-2021-08-12-22-GMT.json'
    );
    const result = mergeGraphs(
      fromLegacyComponent(base.components[0]),
      fromLegacyComponent(ours.components[0]),
      fromLegacyComponent(theirs.components[0])
    );
    // Legacy expectation: a single Group root remains.
    const roots = [...result.merged.nodes.values()].filter((n) => n.parent === undefined);
    expect(roots.length).toBe(1);
    expect(roots[0].type).toBe('Group');
    expect(result.conflicts).toEqual([]);
  });
});
