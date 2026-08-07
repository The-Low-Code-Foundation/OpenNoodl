/**
 * LIB-004 — Import Engine v2: planner.
 *
 * Pins the dry-run contract LIB-005 will consume:
 *  - dependency closure over the inventory graph (selecting a component pulls in
 *    the components/files/styles/variants it needs),
 *  - collision detection against an injected target,
 *  - a SUB-007 `ComponentDiff` for a colliding component that would be
 *    overwritten (naming the nodes that would change),
 *  - policies (add / overwrite / skip / rename).
 */

import * as fs from 'fs';
import * as path from 'path';

import { buildInventory, catalogPortType } from '../../src/editor/src/utils/import-engine/inventory';
import { plan, TargetProject } from '../../src/editor/src/utils/import-engine/plan';
import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';

function load(name: string) {
  const dir = path.join(process.cwd(), 'tests/testfs', name);
  return JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8'));
}

function inventoryOf(project: unknown) {
  return buildInventory({ sourceDir: '/src', project: project as never, resources: [], modules: [], portType: catalogPortType(loadDefaultCatalog()) });
}

function targetFrom(project: {
  components: { name: string }[];
  metadata?: { styles?: { colors?: Record<string, unknown>; text?: Record<string, unknown> } };
}): TargetProject {
  const byName = new Map(project.components.map((c) => [c.name, c] as const));
  return {
    getComponent: (n) => byName.get(n) as never,
    hasResource: () => false,
    hasModule: () => false,
    hasVariant: () => false,
    hasColorStyle: (n) => !!project.metadata?.styles?.colors?.[n],
    hasTextStyle: (n) => !!project.metadata?.styles?.text?.[n]
  };
}

describe('LIB-004 import engine — plan', () => {
  it('resolves the dependency closure of a selection', () => {
    const source = load('import_proj1');
    const inv = inventoryOf(source);
    const p = plan(inv, source, { components: [{ name: '/Main' }] }, targetFrom(load('import_proj2')));

    const names = p.components.map((c) => c.name).sort();
    expect(names).toEqual(['/Main', '/comp1']); // /comp1 pulled in as a dependency

    const comp1 = p.components.find((c) => c.name === '/comp1')!;
    expect(comp1.reason).toBe('dependency');
    expect(comp1.requiredBy).toEqual(['/Main']);

    // /Main's font dependency is pulled into the resource set.
    expect(p.resources.map((r) => r.name)).toContain('Fontfabric - Nexa-Bold.otf');
  });

  it('detects a collision and produces a SUB-007 diff naming the nodes that would change', () => {
    const source = load('import_proj1');
    const inv = inventoryOf(source);
    const p = plan(inv, source, { components: [{ name: '/Main' }] }, targetFrom(load('import_proj2')));

    const main = p.components.find((c) => c.name === '/Main')!;
    expect(main.collides).toBe(true);
    expect(main.policy.action).toBe('overwrite');
    expect(main.diff).toBeDefined();
    expect(main.diff!.changes.length).toBeGreaterThan(0);
    expect(p.hasCollisions).toBe(true);
  });

  it('non-colliding components get an add policy and no diff', () => {
    const source = load('import_proj1');
    const inv = inventoryOf(source);
    // Empty target ⇒ nothing collides.
    const empty = targetFrom({ components: [] });
    const p = plan(inv, source, { components: [{ name: '/comp1' }] }, empty);
    const comp1 = p.components.find((c) => c.name === '/comp1')!;
    expect(comp1.collides).toBe(false);
    expect(comp1.policy.action).toBe('add');
    expect(comp1.diff).toBeUndefined();
    expect(p.hasCollisions).toBe(false);
  });

  it('records a rename policy and does not treat the renamed name as colliding', () => {
    const source = load('import_proj1');
    const inv = inventoryOf(source);
    // Target has /comp1, so without a rename it would collide.
    const target = targetFrom({ components: [{ name: '/comp1' }] });
    const p = plan(inv, source, { components: [{ name: '/comp1' }] }, target, {
      renames: { '/comp1': '/comp1_imported' }
    });
    const comp1 = p.components.find((c) => c.name === '/comp1')!;
    expect(comp1.policy.action).toBe('rename');
    expect((comp1.policy as { newName: string }).newName).toBe('/comp1_imported');
    expect(comp1.collides).toBe(false); // new name is free
    expect(p.renames).toEqual({ '/comp1': '/comp1_imported' });
  });

  it('honors an explicit skip', () => {
    const source = load('import_proj1');
    const inv = inventoryOf(source);
    const p = plan(inv, source, { components: [{ name: '/Main' }] }, targetFrom(load('import_proj2')), {
      skip: { components: ['/comp1'] }
    });
    const comp1 = p.components.find((c) => c.name === '/comp1')!;
    expect(comp1.policy.action).toBe('skip');
  });
});
