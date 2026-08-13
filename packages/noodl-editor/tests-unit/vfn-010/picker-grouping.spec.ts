/**
 * VFN-010 §1 / criterion 1 — the picker says which shelf a block is on.
 *
 * > *"for backpack blocks (which should be marked in the block picker in a way you can tell which
 * > are backpack and which are project scoped)"*
 *
 * 🔴 The consequence being made visible: a block on the backpack **works for its author and is
 * missing for a collaborator** who opens the project. The picker is the moment that is choosable,
 * and before this the flyout listed every definition in one undivided run.
 *
 * ⚠️ Every "the headings are there" assertion below has a control that watches them **not** be
 * there, produced by the same extractor over the same function with the shelf lookup withheld —
 * which is exactly the pre-fix behaviour. A suite of presences over an extractor that always
 * returns something is indistinguishable from an instrument that measured nothing.
 */

import { myBlocksFlyout } from '../../src/editor/src/views/BlocklyEditor/MyBlocksBlocks';
import { SHELF_LABEL } from '../../src/editor/src/views/BlocklyEditor/myblocks/libraryIntent';
import { shelfGroups } from '../../src/editor/src/views/BlocklyEditor/myblocks/shelfGrouping';
import { InMemoryShelf, MyBlocksStore, type MyBlocksScope } from '../../src/editor/src/views/BlocklyEditor/myblocks/store';
import type { MyBlockDefinition } from '../../src/editor/src/views/BlocklyEditor/myblocks/format';
import { arithmetic, getInput, number, workspace } from '../lgc-007/fixtures';

function store(): MyBlocksStore {
  return new MyBlocksStore({ project: new InMemoryShelf('project'), user: new InMemoryShelf('user') });
}

/** A real definition, through the real `save`, so `shape` and `params` are the inferred ones. */
function save(s: MyBlocksStore, name: string, scope: MyBlocksScope, id?: string): MyBlockDefinition {
  return s.save({
    id,
    name,
    scope,
    body: workspace(arithmetic('MULTIPLY', getInput('price'), number(0.9)))
  });
}

/** Every `kind: 'label'` in a flyout, in order. The headings and the VFN-008 sentences together. */
function labelsIn(items: unknown[]): string[] {
  return items
    .filter((item) => (item as { kind?: string })?.kind === 'label')
    .map((item) => String((item as { text?: unknown }).text));
}

/** Only the labels that are a shelf heading — the thing this task added. */
function headingsIn(items: unknown[]): string[] {
  const headings = Object.values(SHELF_LABEL);
  return labelsIn(items).filter((label) => headings.indexOf(label) !== -1);
}

/** Every block's definition id, in flyout order. */
function blockIdsIn(items: unknown[]): string[] {
  return items
    .filter((item) => (item as { kind?: string })?.kind === 'block')
    .map((item) => String(((item as { extraState?: { defId?: unknown } }).extraState ?? {}).defId));
}

describe('VFN-010 §1 — the flyout groups by shelf', () => {
  it('puts each definition under its own shelf heading, project first', () => {
    const s = store();
    const project = save(s, 'Discount', 'project');
    const backpack = save(s, 'Slugify', 'user');

    const items = myBlocksFlyout(s)();
    const labels = labelsIn(items);

    expect(headingsIn(items)).toEqual([SHELF_LABEL.project, SHELF_LABEL.user]);

    // Order, not just presence: the heading has to come *before* the block it describes, or it
    // labels the wrong run. Compared by index in the flat item list, which is what Blockly renders.
    const projectHeading = labels.indexOf(SHELF_LABEL.project);
    const backpackHeading = labels.indexOf(SHELF_LABEL.user);
    expect(projectHeading).toBeLessThan(backpackHeading);
    expect(blockIdsIn(items)).toEqual([project.id, backpack.id]);
  });

  it('🔴 NEGATIVE CONTROL — the same extractor sees NO headings when the shelf is not known', () => {
    // This is the pre-fix flyout, exactly: a source that can `list()` and cannot say which shelf.
    // Without this, "found two headings" above is indistinguishable from an extractor that matches
    // any label, and the VFN-008 shape sentences are labels too.
    const s = store();
    save(s, 'Discount', 'project');
    save(s, 'Slugify', 'user');

    const blind = { list: () => s.list() };
    const items = myBlocksFlyout(blind)();

    expect(headingsIn(items)).toEqual([]);
    // …and the flyout is otherwise unchanged, so the fallback is a fallback and not a breakage.
    expect(blockIdsIn(items)).toHaveLength(2);
    expect(labelsIn(items).length).toBeGreaterThan(0);
  });

  it('does not print a heading over an empty shelf', () => {
    const s = store();
    save(s, 'Discount', 'project');

    // A heading with nothing under it reads as a bug in the picker, and a builder with an empty
    // backpack is the common case.
    expect(headingsIn(myBlocksFlyout(s)())).toEqual([SHELF_LABEL.project]);
  });

  it('still teaches the gesture when both shelves are empty', () => {
    const s = store();
    const items = myBlocksFlyout(s)();

    expect(headingsIn(items)).toEqual([]);
    expect(labelsIn(items)[0]).toContain('Save as a block');
  });

  it('🔴 a definition on BOTH shelves appears once, under the shelf that resolves', () => {
    // `store.ts`: *"Project wins on an id collision."* `list()` returns only the resolving copy, and
    // a grouping that showed the id under both headings would tell the builder something false
    // about which body their call blocks expand.
    const s = store();
    const shared = save(s, 'Discount', 'user');
    save(s, 'Discount (project copy)', 'project', shared.id);

    const items = myBlocksFlyout(s)();
    expect(blockIdsIn(items)).toEqual([shared.id]);
    expect(headingsIn(items)).toEqual([SHELF_LABEL.project]);
  });
});

describe('VFN-010 §1 — `shelfGroups`, the decision underneath', () => {
  const lookup = {
    scopeOf(id: string): MyBlocksScope | undefined {
      if (id === 'p1' || id === 'p2') return 'project';
      if (id === 'u1') return 'user';
      return undefined;
    }
  };

  it('partitions in resolution order and preserves the order within a shelf', () => {
    const groups = shelfGroups([{ id: 'u1' }, { id: 'p1' }, { id: 'p2' }], lookup);

    expect(groups.map((group) => group.scope)).toEqual(['project', 'user']);
    expect(groups[0].definitions.map((d) => d.id)).toEqual(['p1', 'p2']);
    expect(groups[1].definitions.map((d) => d.id)).toEqual(['u1']);
  });

  it('keeps a definition whose shelf cannot be answered, unlabelled and last', () => {
    // Dropping it would make a block vanish from the picker for a reason nobody could see.
    const groups = shelfGroups([{ id: 'p1' }, { id: 'ghost' }], lookup);

    expect(groups).toHaveLength(2);
    expect(groups[1].scope).toBeUndefined();
    expect(groups[1].definitions.map((d) => d.id)).toEqual(['ghost']);
  });

  it('survives a lookup that throws, rather than taking the whole picker with it', () => {
    const exploding = {
      scopeOf(id: string): MyBlocksScope | undefined {
        if (id === 'boom') throw new Error('shelf unavailable');
        return 'project';
      }
    };

    const groups = shelfGroups([{ id: 'p1' }, { id: 'boom' }], exploding);
    expect(groups.map((group) => group.definitions.map((d) => d.id))).toEqual([['p1'], ['boom']]);
  });

  it('returns nothing at all for an empty shelf, so the caller can show its own empty state', () => {
    expect(shelfGroups([], lookup)).toEqual([]);
    expect(shelfGroups([], undefined)).toEqual([]);
  });
});
