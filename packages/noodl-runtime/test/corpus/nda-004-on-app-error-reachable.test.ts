/**
 * NDA-004 §1 — the catch-all half of the Failure Contract has to be reachable by an author.
 *
 * `FAILURE-CONTRACT.md` makes an error observable two ways, and Richard confirmed **both**: per-node
 * `Failure` outputs for the errors an author expects and wants to branch on, and one global
 * `On App Error` node for the rest. The node shipped, works, and was measured working — criterion 2's
 * deployed-browser and SSG legs both delivered a structured event to one.
 *
 * It was not, however, in the editor's add-node picker. `nodelibraryexport.ts`'s `coreNodes` is a
 * **curated** index, not a projection of the register, so registering a node type does not offer it;
 * the two are maintained separately and this one was only ever done on the register side. Every
 * measurement that found the node working found it in a fixture whose `project.json` was written by
 * a script, so nothing in the phase had yet gone through the path an author has.
 *
 * That makes it the same shape as the trap banked under criterion 2 — *"a criterion can be met
 * through a surface the author has to opt into"* — one level further down. There the opt-in surface
 * was an `On App Error` node the fixture happened to contain; here that surface could not be opted
 * into at all, because the only way to get one was to hand-write the graph JSON.
 *
 * The catalog is what makes the gap visible: `inNodePicker` is derived from `coreNodes`
 * (`build-catalog.js:186`), and On App Error was one of four non-deprecated types reading `false`.
 * The other three are legitimate — `Page` is created through the Router flow, and the two
 * `net.noodl.user.*` nodes through the sign-in flow.
 */

/* eslint-env jest */

import generateNodeLibrary = require('../../src/nodelibraryexport');

/** Every type name the add-node picker offers, flattened out of the curated index. */
function pickerItems(): string[] {
  // `coreNodes` is a static list built inside the function, so an empty register is enough to read
  // it — and keeps the row pinning the index rather than whatever happens to be registered.
  const library = generateNodeLibrary({ _constructors: {} }) as {
    nodeIndex: { coreNodes: Array<{ subCategories: Array<{ items: string[] }> }> };
  };

  const items: string[] = [];
  library.nodeIndex.coreNodes.forEach((category) => {
    category.subCategories.forEach((sub) => {
      sub.items.forEach((item) => items.push(item));
    });
  });
  return items;
}

describe('NDA-004 §1 — On App Error is offered by the node picker', () => {
  it('offers On App Error, so the contract\'s catch-all can be added to a graph', () => {
    expect(pickerItems()).toContain('On App Error');
  });

  /**
   * The control. `toContain` on a list this long passes for almost anything, so on its own the row
   * above cannot tell "the index offers this node" from "the index offers everything" — and the
   * defect it exists to catch is precisely a node being registered but not indexed. A type that is
   * registered and deliberately *absent* is what makes the assertion discriminating.
   *
   * `Cloud Function` is registered in every runtime and deprecated in favour of `CloudFunction2`;
   * offering it again is a regression in its own right.
   */
  it('does not offer the deprecated Cloud Function, so the assertion above can fail', () => {
    expect(pickerItems()).not.toContain('Cloud Function');
  });

  /** No type is offered twice — two picker entries for one node read as two different nodes. */
  it('lists no type more than once', () => {
    const items = pickerItems();
    const duplicated = items.filter((item, i) => items.indexOf(item) !== i);
    expect(duplicated).toEqual([]);
  });
});
