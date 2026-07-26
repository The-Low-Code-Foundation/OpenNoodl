/**
 * LIB-005 — the import flow's selection model.
 *
 * Pins the two properties the interaction design rests on:
 *
 *  1. **A selection that does not stand alone is unrepresentable.** The state
 *     holds only the requested roots; everything else is derived from LIB-004's
 *     plan, so there is no combination of clicks that puts a component in and
 *     its dependency out.
 *  2. **Dropping a heuristic link recomputes the closure**, rather than
 *     filtering a finished plan — an item that something else still needs stays
 *     in, and an item nothing needs leaves cleanly.
 */

import * as fs from 'fs';
import * as path from 'path';

import { buildInventory, catalogPortType } from '../../src/editor/src/utils/import-engine/inventory';
import { plan, TargetProject } from '../../src/editor/src/utils/import-engine/plan';
import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';
import {
  collectLinks,
  deriveInventory,
  linkKey,
  sourceKey
} from '../../src/editor/src/views/ImportFlow/model/dependencyLinks';
import { buildItems, buildTree, itemKeysUnder, matchesQuery, splitPath } from '../../src/editor/src/views/ImportFlow/model/items';
import {
  EMPTY_SELECTION,
  folderState,
  planIndex,
  rowState,
  suggestName,
  toggleDroppedLink,
  toggleRequested,
  toImportSelection,
  toPlanOptions
} from '../../src/editor/src/views/ImportFlow/model/selection';
import { summarizePlan, summarizeResult, describeCounts, plural } from '../../src/editor/src/views/ImportFlow/model/summary';

function load(name: string) {
  const dir = path.join(process.cwd(), 'tests/testfs', name);
  return JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8'));
}

function inventoryOf(project: unknown, resources: string[] = []) {
  return buildInventory({
    sourceDir: '/src',
    project: project as never,
    resources,
    modules: [],
    portType: catalogPortType(loadDefaultCatalog())
  });
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

const EMPTY_TARGET = targetFrom({ components: [] });

describe('LIB-005 import flow — items and folder tree', () => {
  it('splits names into folder and label, normalizing the leading slash', () => {
    expect(splitPath('/Forms/Button')).toEqual({ folder: '/Forms', label: 'Button' });
    expect(splitPath('Main')).toEqual({ folder: '', label: 'Main' });
    expect(splitPath('icons/arrow.svg')).toEqual({ folder: '/icons', label: 'arrow.svg' });
  });

  it('flattens every inventory category into one keyed item list', () => {
    const source = load('import_proj1');
    const items = buildItems(inventoryOf(source, ['icons/arrow.svg']), source);

    const categories = new Set(items.map((i) => i.category));
    expect(categories.has('component')).toBe(true);
    expect(items.filter((i) => i.category === 'resource').map((i) => i.name)).toContain('icons/arrow.svg');

    // Keys are unique and category-qualified.
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
    expect(items.find((i) => i.category === 'component')!.key.startsWith('component:')).toBe(true);
  });

  it('gives components a node count — the honest stand-in for a thumbnail', () => {
    const source = load('import_proj1');
    const items = buildItems(inventoryOf(source), source);
    const main = items.find((i) => i.name === '/Main')!;
    expect(typeof main.nodeCount).toBe('number');
    expect(main.nodeCount).toBeGreaterThan(0);
  });

  it('builds a folder tree with folders before items and every descendant reachable', () => {
    const items = buildItems(
      inventoryOf({
        components: [{ name: '/Zed' }, { name: '/Forms/Button' }, { name: '/Forms/Nested/Deep' }],
        metadata: {}
      }),
      undefined
    );
    const tree = buildTree(items.filter((i) => i.category === 'component'));

    expect(tree[0].type).toBe('folder');
    expect(tree[0].type === 'folder' && tree[0].label).toBe('Forms');
    expect(tree[1].type).toBe('item');

    const allKeys = tree.flatMap(itemKeysUnder).sort();
    expect(allKeys).toEqual(items.map((i) => i.key).sort());
  });

  it('matches a search query on the full path, so a folder name filters its contents', () => {
    const items = buildItems(
      inventoryOf({ components: [{ name: '/Forms/Button' }, { name: '/Other' }], metadata: {} }),
      undefined
    );
    const button = items.find((i) => i.name === '/Forms/Button')!;
    expect(matchesQuery(button, 'forms')).toBe(true);
    expect(matchesQuery(button, 'BUTT')).toBe(true);
    expect(matchesQuery(button, 'nope')).toBe(false);
    expect(matchesQuery(button, '  ')).toBe(true);
  });
});

describe('LIB-005 import flow — closure is derived, never stored', () => {
  it('a dependency pulled in by a requested component reads as `required`, not `available`', () => {
    const source = load('import_proj1');
    const inventory = inventoryOf(source);
    const items = buildItems(inventory, source);

    const state = toggleRequested(EMPTY_SELECTION, ['component:/Main'], true);
    const p = plan(inventory, source, toImportSelection(items, state.requested), EMPTY_TARGET);
    const index = planIndex(p);

    expect(rowState('component:/Main', state, index)).toBe('requested');
    expect(rowState('component:/comp1', state, index)).toBe('required');
    expect(index.get('component:/comp1')!.requiredBy).toEqual(['/Main']);
  });

  it('deselecting the requirer is the only way a required item leaves the plan', () => {
    const source = load('import_proj1');
    const inventory = inventoryOf(source);
    const items = buildItems(inventory, source);

    const withMain = toggleRequested(EMPTY_SELECTION, ['component:/Main'], true);
    const withoutMain = toggleRequested(withMain, ['component:/Main'], false);

    const index = planIndex(plan(inventory, source, toImportSelection(items, withoutMain.requested), EMPTY_TARGET));
    expect(rowState('component:/comp1', withoutMain, index)).toBe('available');
  });

  it('a required item stays required while any requirer needs it', () => {
    const project = {
      components: [
        { name: '/A', graph: { roots: [{ id: '1', type: '/Shared' }] } },
        { name: '/B', graph: { roots: [{ id: '2', type: '/Shared' }] } },
        { name: '/Shared', graph: { roots: [] } }
      ],
      metadata: {}
    };
    const inventory = inventoryOf(project);
    const items = buildItems(inventory, project as never);

    const both = toggleRequested(EMPTY_SELECTION, ['component:/A', 'component:/B'], true);
    let index = planIndex(plan(inventory, project as never, toImportSelection(items, both.requested), EMPTY_TARGET));
    expect(index.get('component:/Shared')!.requiredBy.sort()).toEqual(['/A', '/B']);

    const onlyA = toggleRequested(both, ['component:/B'], false);
    index = planIndex(plan(inventory, project as never, toImportSelection(items, onlyA.requested), EMPTY_TARGET));
    expect(rowState('component:/Shared', onlyA, index)).toBe('required');
  });

  it('folder rows aggregate to all / some / none', () => {
    const project = {
      components: [{ name: '/F/A', graph: { roots: [] } }, { name: '/F/B', graph: { roots: [] } }],
      metadata: {}
    };
    const inventory = inventoryOf(project);
    const items = buildItems(inventory, project as never);
    const keys = items.map((i) => i.key);

    const none = planIndex(plan(inventory, project as never, toImportSelection(items, new Set()), EMPTY_TARGET));
    expect(folderState(keys, none)).toBe('none');

    const one = toggleRequested(EMPTY_SELECTION, ['component:/F/A'], true);
    const someIndex = planIndex(plan(inventory, project as never, toImportSelection(items, one.requested), EMPTY_TARGET));
    expect(folderState(keys, someIndex)).toBe('some');

    const all = toggleRequested(one, ['component:/F/B'], true);
    const allIndex = planIndex(plan(inventory, project as never, toImportSelection(items, all.requested), EMPTY_TARGET));
    expect(folderState(keys, allIndex)).toBe('all');
  });
});

describe('LIB-005 import flow — heuristic links are droppable, facts are not', () => {
  // A Text node whose `text` parameter happens to equal a resource path: the
  // semantic pass has no opinion (text is not a file port), so the only edge is
  // the legacy string-matching heuristic.
  const project = {
    components: [
      {
        name: '/Guessy',
        graph: { roots: [{ id: '1', type: 'Text', parameters: { text: 'icons/arrow.svg' } }] }
      }
    ],
    metadata: {}
  };

  it('marks a link backed only by string matching as inferred', () => {
    const inventory = inventoryOf(project, ['icons/arrow.svg']);
    const links = collectLinks(inventory.edges);
    const guess = links.find((l) => l.to.name === 'icons/arrow.svg')!;

    expect(guess.isInferred).toBe(true);
    expect(guess.via.join(' ')).toContain('== resource');
    expect(sourceKey(guess.from)).toBe('component:/Guessy');
  });

  it('dropping the link removes the file from the closure', () => {
    const inventory = inventoryOf(project, ['icons/arrow.svg']);
    const items = buildItems(inventory, project as never);
    const links = collectLinks(inventory.edges);
    const guess = links.find((l) => l.to.name === 'icons/arrow.svg')!;

    const selected = toggleRequested(EMPTY_SELECTION, ['component:/Guessy'], true);
    const before = plan(inventory, project as never, toImportSelection(items, selected.requested), EMPTY_TARGET);
    expect(before.resources.map((r) => r.name)).toContain('icons/arrow.svg');

    const dropped = toggleDroppedLink(selected, guess.key);
    const after = plan(
      deriveInventory(inventory, dropped.droppedLinks),
      project as never,
      toImportSelection(items, dropped.requested),
      EMPTY_TARGET
    );
    expect(after.resources.map((r) => r.name)).not.toContain('icons/arrow.svg');
  });

  it('deriving with nothing dropped reproduces the inventory exactly', () => {
    const inventory = inventoryOf(load('import_proj1'), ['icons/arrow.svg']);
    const derived = deriveInventory(inventory, new Set());
    expect(derived).toBe(inventory);

    // And rebuilding from edges with an irrelevant key dropped still matches.
    const rebuilt = deriveInventory(inventory, new Set(['nothing→nothing']));
    expect(rebuilt.components.map((c) => c.dependencies)).toEqual(inventory.components.map((c) => c.dependencies));
    expect(rebuilt.components.map((c) => c.fileDependencies)).toEqual(inventory.components.map((c) => c.fileDependencies));
    expect(rebuilt.components.map((c) => c.styleDependencies)).toEqual(
      inventory.components.map((c) => c.styleDependencies)
    );
  });

  it('a component reference is semantic and therefore not droppable', () => {
    const inventory = inventoryOf(load('import_proj1'));
    const links = collectLinks(inventory.edges);
    const componentLinks = links.filter((l) => l.kind === 'component');
    expect(componentLinks.length).toBeGreaterThan(0);
    expect(componentLinks.every((l) => l.isInferred === false)).toBe(true);
  });

  it('linkKey is stable and distinguishes source from target', () => {
    const inventory = inventoryOf(project, ['icons/arrow.svg']);
    const [edge] = inventory.edges;
    expect(linkKey(edge)).toBe(`${sourceKey(edge.from)}→file:icons/arrow.svg`);
  });
});

describe('LIB-005 import flow — a text style brings its font', () => {
  // The legacy popup marked a text style's `fileDependencies` when the style was
  // selected; LIB-004's closure did not, so a text style could arrive with no
  // font behind it. `plan()` now pulls it, and the edge is recorded so the UI
  // can say why the font is coming along.
  const project = {
    components: [],
    metadata: { styles: { text: { Heading: { fontFamily: 'fonts/Inter.ttf', fontSize: 24 } } } }
  };

  it('records a style → file edge with its provenance', () => {
    const inventory = inventoryOf(project, ['fonts/Inter.ttf']);
    const link = collectLinks(inventory.edges).find((l) => l.to.name === 'fonts/Inter.ttf')!;
    expect(link).toBeDefined();
    expect(sourceKey(link.from)).toBe('style:Heading');
    expect(link.isInferred).toBe(true);
  });

  it('pulls the font into the closure when the style is selected', () => {
    const inventory = inventoryOf(project, ['fonts/Inter.ttf']);
    const items = buildItems(inventory, project as never);
    const state = toggleRequested(EMPTY_SELECTION, ['textStyle:Heading'], true);

    const p = plan(inventory, project as never, toImportSelection(items, state.requested), EMPTY_TARGET);
    const font = p.resources.find((r) => r.name === 'fonts/Inter.ttf')!;
    expect(font).toBeDefined();
    expect(font.reason).toBe('dependency');
    expect(font.requiredBy).toEqual(['Heading']);
  });

  it('dropping the guess leaves the font behind', () => {
    const inventory = inventoryOf(project, ['fonts/Inter.ttf']);
    const items = buildItems(inventory, project as never);
    const link = collectLinks(inventory.edges).find((l) => l.to.name === 'fonts/Inter.ttf')!;

    const state = toggleDroppedLink(toggleRequested(EMPTY_SELECTION, ['textStyle:Heading'], true), link.key);
    const p = plan(
      deriveInventory(inventory, state.droppedLinks),
      project as never,
      toImportSelection(items, state.requested),
      EMPTY_TARGET
    );
    expect(p.resources.map((r) => r.name)).not.toContain('fonts/Inter.ttf');
    expect(p.styles.text.map((t) => t.name)).toContain('Heading');
  });
});

describe('LIB-005 import flow — collision resolutions', () => {
  it('translates resolutions into engine plan options', () => {
    const source = load('import_proj1');
    const items = buildItems(inventoryOf(source, ['icons/arrow.svg']), source);
    const options = toPlanOptions(items, {
      'component:/Main': { kind: 'rename', newName: '/Main imported' },
      'component:/comp1': { kind: 'skip' },
      'resource:icons/arrow.svg': { kind: 'skip' }
    });

    expect(options.renames).toEqual({ '/Main': '/Main imported' });
    expect(options.skip!.components).toEqual(['/comp1']);
    expect(options.skip!.resources).toEqual(['icons/arrow.svg']);
  });

  it('refuses to rename anything but a component — the engine only re-points component refs', () => {
    const items = buildItems(inventoryOf({ components: [], metadata: { styles: { colors: { Primary: {} } } } }), undefined);
    const options = toPlanOptions(items, { 'colorStyle:Primary': { kind: 'rename', newName: 'Primary 2' } });
    expect(options.renames).toEqual({});
  });

  it('ignores a blank rename rather than planning an empty name', () => {
    const source = load('import_proj1');
    const items = buildItems(inventoryOf(source), source);
    expect(toPlanOptions(items, { 'component:/Main': { kind: 'rename', newName: '   ' } }).renames).toEqual({});
  });

  it('suggests a free name, skipping ones already taken here or in the target', () => {
    expect(suggestName('/Button', new Set())).toBe('/Button 2');
    expect(suggestName('/Button', new Set(['/Button 2']))).toBe('/Button 3');
    expect(suggestName('/Forms/Button', new Set(['/Forms/Button 2']))).toBe('/Forms/Button 3');
    // An already-numbered name grows from its base rather than stacking suffixes.
    expect(suggestName('/Button 2', new Set(['/Button 2']))).toBe('/Button 3');
  });
});

describe('LIB-005 import flow — plan summary', () => {
  it('counts what lands, what is overwritten and what is kept', () => {
    const source = load('import_proj1');
    const inventory = inventoryOf(source);
    const items = buildItems(inventory, source);
    const state = toggleRequested(EMPTY_SELECTION, ['component:/Main'], true);

    const p = plan(inventory, source, toImportSelection(items, state.requested), targetFrom(load('import_proj2')), {
      skip: { components: ['/comp1'] }
    });
    const summary = summarizePlan(p, planIndex(p));

    const components = summary.counts.find((c) => c.category === 'component')!;
    expect(components.kept).toBe(1); // /comp1 skipped
    expect(components.overwritten).toBe(1); // /Main collides
    expect(summary.folders).toContain('/');
    expect(summary.collisions.some((c) => c.name === '/Main')).toBe(true);
  });

  it('describes counts in plain english', () => {
    expect(plural(1, 'component')).toBe('1 component');
    expect(plural(2, 'component')).toBe('2 components');
    expect(plural(2, 'class')).toBe('2 classes');
    expect(
      describeCounts([
        { category: 'component', added: 4, overwritten: 0, renamed: 0, kept: 0, landing: 4 },
        { category: 'resource', added: 2, overwritten: 0, renamed: 0, kept: 0, landing: 2 },
        { category: 'colorStyle', added: 1, overwritten: 0, renamed: 0, kept: 0, landing: 1 }
      ])
    ).toBe('4 components, 2 files and 1 color style');
    expect(describeCounts([])).toBe('Nothing');
  });
});

describe('LIB-005 import flow — the undo note tells the truth', () => {
  // Styles merge through `mergeMetadata`, outside the import's undo group
  // (apply.ts `mergeStyles`, legacy parity), and disk writes were never undoable.
  // The note used to say styles came back, which they do not — verified live and
  // pinned end-to-end in tests/project/projectimportapply.js.
  const emptyPlan = { renames: {}, components: [], resources: [], modules: [], variants: [], styles: { colors: [], text: [] } } as TSFixme;
  const result = (over: TSFixme) =>
    ({
      result: 'success',
      componentsImported: [],
      variantsImported: [],
      stylesImported: { colors: [], text: [] },
      filesCopied: [],
      modulesCopied: [],
      warnings: [],
      ...over
    }) as TSFixme;

  it('names styles as staying behind when styles were imported', () => {
    const s = summarizeResult(result({ componentsImported: ['/A'], stylesImported: { colors: ['Brand'], text: [] } }), emptyPlan);
    expect(s.undoNote).toBe('Undo removes the imported components and variants in one step. Styles stay.');
  });

  it('names both when styles and files landed', () => {
    const s = summarizeResult(
      result({ componentsImported: ['/A'], stylesImported: { colors: ['Brand'], text: [] }, filesCopied: ['a.png'] }),
      emptyPlan
    );
    expect(s.undoNote).toBe('Undo removes the imported components and variants in one step. Styles and files on disk stay.');
  });

  it('promises a clean undo only when nothing outlives it', () => {
    const s = summarizeResult(result({ componentsImported: ['/A'], variantsImported: ['Group/V'] }), emptyPlan);
    expect(s.undoNote).toBe('Undo removes everything this import added, in one step.');
  });
});
