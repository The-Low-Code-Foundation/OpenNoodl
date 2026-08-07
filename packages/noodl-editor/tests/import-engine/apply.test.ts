/**
 * LIB-004 — Import Engine v2: apply core (model changes).
 *
 * `applyModelChanges` is the pure heart of the apply stage. It pins the id
 * semantics that the legacy engine had but nothing tested — and which the
 * Electron characterization suite (`tests/project/projectimport.js`) also
 * asserts end-to-end through the strangler adapter:
 *
 *   - a NON-colliding component keeps its freshly re-keyed id;
 *   - an OVERWRITE reuses the target component's existing id (so references keep
 *     resolving) and evicts the old component first;
 *   - `skip` imports nothing;
 *   - `rename` grafts under the new name and re-points references to renamed
 *     siblings within the imported set.
 *
 * Fakes stand in for ProjectModel/ComponentModel so this runs without Electron.
 */

import { applyModelChanges, ImportSource, ImportTarget, PreparedComponent } from '../../src/editor/src/utils/import-engine/applyModel';
import type { ImportPlan, ItemPolicy, PlannedComponent, PlannedItem } from '../../src/editor/src/utils/import-engine/types';

// ─── Fakes ───────────────────────────────────────────────────────────────────

interface FakeComponent {
  name: string;
  id: string;
  reroutes: [string, string][];
}

class FakeSource implements ImportSource<FakeComponent> {
  private freshCounter = 0;
  constructor(
    private readonly components: Record<string, boolean>,
    private readonly styles: { colors: Record<string, unknown>; text: Record<string, unknown> } = { colors: {}, text: {} },
    private readonly variants: Record<string, boolean> = {}
  ) {}

  takeComponent(name: string): PreparedComponent<FakeComponent> | undefined {
    if (!this.components[name]) return undefined;
    // Simulate "delete id + rekey" → a brand new id.
    const model: FakeComponent = { name, id: `FRESH-${++this.freshCounter}`, reroutes: [] };
    return {
      model,
      setId: (id) => (model.id = id),
      setName: (newName) => (model.name = newName),
      rerouteComponentRefs: (oldName, newName) => model.reroutes.push([oldName, newName])
    };
  }
  styleDef(kind: 'colors' | 'text', name: string): unknown {
    return this.styles[kind][name];
  }
  takeVariant(typename: string, name: string) {
    return this.variants[`${typename}/${name}`] ? { typename, name } : undefined;
  }
}

class FakeTarget implements ImportTarget<FakeComponent> {
  public readonly added: FakeComponent[] = [];
  public readonly removed: string[] = [];
  public mergedStyles: { colors: Record<string, unknown>; text: Record<string, unknown> } | undefined;
  public readonly addedVariants: unknown[] = [];
  constructor(
    // Value `undefined` means "this component exists but carries no id" — the
    // real shape of every project's root component. Keep it distinguishable
    // from an absent key, or the id-less-overwrite case cannot be expressed.
    private readonly existing: Record<string, string | undefined> = {},
    private readonly existingVariants: Record<string, boolean> = {}
  ) {}

  hasComponent(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.existing, name);
  }
  existingComponentId(name: string): string | undefined {
    return this.existing[name];
  }
  removeComponentByName(name: string): void {
    this.removed.push(name);
  }
  addComponent(model: FakeComponent): void {
    this.added.push(model);
  }
  mergeStyles(styles: { colors: Record<string, unknown>; text: Record<string, unknown> }): void {
    this.mergedStyles = styles;
  }
  hasVariant(typename: string, name: string): boolean {
    return !!this.existingVariants[`${typename}/${name}`];
  }
  removeVariant(): void {
    /* recorded via addedVariants ordering only; not asserted here */
  }
  addVariant(variant: unknown): void {
    this.addedVariants.push(variant);
  }
}

// ─── Plan builders ─────────────────────────────────────────────────────────

function componentPlan(entries: { name: string; policy: ItemPolicy }[]): ImportPlan {
  const components: PlannedComponent[] = entries.map((e) => ({
    name: e.name,
    reason: 'requested',
    requiredBy: [],
    collides: false,
    policy: e.policy
  }));
  return {
    sourceDir: '/src',
    components,
    resources: [],
    modules: [],
    variants: [],
    styles: { colors: [], text: [] },
    renames: {},
    hasCollisions: false
  };
}

const ADD: ItemPolicy = { action: 'add' };

// ─── Specs ───────────────────────────────────────────────────────────────────

describe('LIB-004 import engine — applyModelChanges', () => {
  it('keeps the fresh id for a non-colliding add', () => {
    const source = new FakeSource({ '/New': true });
    const target = new FakeTarget(/* nothing existing */);

    const result = applyModelChanges(componentPlan([{ name: '/New', policy: ADD }]), source, target);

    expect(target.added.length).toBe(1);
    expect(target.added[0].id).toBe('FRESH-1');
    expect(target.removed).toEqual([]);
    expect(result.componentsImported).toEqual(['/New']);
  });

  it('reuses the target id and evicts the old component on overwrite', () => {
    const source = new FakeSource({ '/Main': true });
    const target = new FakeTarget({ '/Main': 'TARGET-MAIN-ID' });

    const result = applyModelChanges(componentPlan([{ name: '/Main', policy: ADD }]), source, target);

    expect(target.removed).toEqual(['/Main']); // old component evicted first
    expect(target.added.length).toBe(1);
    expect(target.added[0].id).toBe('TARGET-MAIN-ID'); // NOT the fresh id
    expect(result.componentsImported).toEqual(['/Main']);
  });

  // Regression, found by live QA 2026-08-02 — not reachable from the old fake,
  // which keyed `existing` by id and so could not represent this state at all.
  // Every real project has exactly one component with no id: its root (`/App`).
  // Overwriting it appended a SECOND `/App` instead of replacing the first,
  // because removal was gated on `existingComponentId !== undefined`.
  it('evicts an existing component that carries NO id, instead of duplicating it', () => {
    const source = new FakeSource({ '/App': true });
    const target = new FakeTarget({ '/App': undefined }); // exists, no id — a project root

    const result = applyModelChanges(componentPlan([{ name: '/App', policy: ADD }]), source, target);

    expect(target.removed).toEqual(['/App']); // the defect: this was []
    expect(target.added.length).toBe(1); // the consequence: this was 1 alongside a surviving original
    expect(target.added[0].id).toBeDefined(); // keeps its fresh re-keyed id, nothing to reuse
    expect(result.componentsImported).toEqual(['/App']);
  });

  it('imports nothing for a skip policy', () => {
    const source = new FakeSource({ '/Skip': true });
    const target = new FakeTarget();

    const result = applyModelChanges(componentPlan([{ name: '/Skip', policy: { action: 'skip' } }]), source, target);

    expect(target.added).toEqual([]);
    expect(result.componentsImported).toEqual([]);
  });

  it('renames the component and re-points references to renamed siblings', () => {
    const source = new FakeSource({ '/A': true, '/B': true });
    const target = new FakeTarget();

    const plan = componentPlan([
      { name: '/A', policy: { action: 'rename', newName: '/A2' } },
      { name: '/B', policy: ADD } // B references /A, must be re-pointed to /A2
    ]);
    const result = applyModelChanges(plan, source, target);

    const a = target.added.find((c) => c.name === '/A2');
    const b = target.added.find((c) => c.name === '/B');
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    // A does not reroute itself; B reroutes /A → /A2.
    expect(a!.reroutes).toEqual([]);
    expect(b!.reroutes).toEqual([['/A', '/A2']]);
    expect(result.componentsImported.sort()).toEqual(['/A2', '/B']);
  });

  it('merges only selected style definitions and reports them', () => {
    const source = new FakeSource(
      {},
      { colors: { Primary: { value: '#f00' }, Unused: { value: '#0f0' } }, text: { Body: { size: 14 } } }
    );
    const target = new FakeTarget();

    const plan: ImportPlan = {
      sourceDir: '/src',
      components: [],
      resources: [],
      modules: [],
      variants: [],
      styles: {
        colors: [{ name: 'Primary', reason: 'requested', requiredBy: [], collides: false, policy: ADD } as PlannedItem],
        text: [{ name: 'Body', reason: 'requested', requiredBy: [], collides: false, policy: ADD } as PlannedItem]
      },
      renames: {},
      hasCollisions: false
    };

    const result = applyModelChanges(plan, source, target);

    expect(target.mergedStyles).toEqual({ colors: { Primary: { value: '#f00' } }, text: { Body: { size: 14 } } });
    expect(result.stylesImported).toEqual({ colors: ['Primary'], text: ['Body'] });
  });

  it('warns (does not throw) when a planned component is missing from the source', () => {
    const source = new FakeSource({});
    const target = new FakeTarget();

    const result = applyModelChanges(componentPlan([{ name: '/Ghost', policy: ADD }]), source, target);

    expect(target.added).toEqual([]);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('/Ghost');
  });
});
