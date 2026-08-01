/**
 * No two creatable node types read the same in the picker — BCN-010 step 4.
 *
 * ## Why this test exists at all
 *
 * Phase 30 found eleven duplicated picker labels by grouping all 156 registered
 * types, ten of them a deprecated node shadowing its replacement and one — "Delete
 * Record" — with two *creatable* entries. Its generalisable lesson, quoted because
 * this file is the whole of the response to it:
 *
 * > **a criterion that says "no two nodes should read the same" is a property of
 * > the *registry***, and checking it by reading the nodes one spec named will
 * > find only the instances that spec knew about. The check costs one `reduce`
 * > over `nodetypes`.
 *
 * ## Where the registry comes from here
 *
 * `packages/noodl-types/src/node-catalog.json`, which is a serialisation of the
 * live register — `scripts/node-catalog/extractor-entry.js` loads the real
 * runtime and viewer registries and captures every `registerNode` call — and
 * which `npm run catalog:check` asserts is byte-identical to a fresh extraction
 * on every CI run. So the chain from the register to this assertion is closed,
 * without this suite having to esbuild-bundle the viewer to find out.
 *
 * The catalog's `displayName` is `metadata.displayNodeName || typeName`
 * (`build-catalog.js:180`), which is exactly what `BasicNodeType.displayName()`
 * returns to the picker — and `nodedefinition.ts:264` normalises the `displayName`
 * spelling into `displayNodeName` first, so a node using either key is covered.
 *
 * ## Why the exceptions are enumerated and not ruled out
 *
 * The spec is explicit: *"Deprecated-shadowing-modern pairs are the known
 * exception and are enumerated explicitly rather than excluded by a rule that
 * could hide a real collision."* A rule like "ignore anything deprecated" passes
 * forever, including on the day someone deprecates the wrong half of a pair. The
 * lists below are asserted **exactly** — a collision that appears fails, and a
 * collision that disappears without its entry being removed also fails, which is
 * what turns the pending deletions into something the next commit cannot forget.
 */

const catalog = require('../../noodl-types/src/node-catalog.json');

/**
 * ⚠️ Creatable collisions that exist right now, each waiting on the same event.
 *
 * BCN-004 step 7 deletes `noodl.byob.QueryData`, `CreateRecord`, `UpdateRecord`
 * and `DeleteRecord`. It is blocked on Directus system collections — the BYOB
 * query node has an `apiPathMode` port reaching `directus_users`, and
 * `RestDataAdapter` has zero references to it, so deleting the family today
 * removes a working capability and creates exactly the silent gap BCN-010 exists
 * to prevent.
 *
 * "Delete Record" pre-dates this task. "Create Record" and "Update Record" are
 * BCN-010 step 3's relabel, done ahead of its own stated precondition so that
 * the rename does not have to be remembered inside somebody else's commit.
 *
 * **When the four types are deleted, empty this array.** This test will say so.
 */
const PENDING_TYPE_DELETION = [];

/**
 * A deprecated type shadowing the modern one that replaced it.
 *
 * Out of scope for BCN-010 — phase 30's NDA-011 criterion 3 owns them — but
 * enumerated so that the *check* covers the whole registry, which is the part
 * that was missing.
 */
const DEPRECATED_SHADOWS = [
  { label: 'Array', deprecated: 'Collection', modern: 'Collection2' },
  { label: 'Button', deprecated: 'Button', modern: 'net.noodl.controls.button' },
  { label: 'Checkbox', deprecated: 'Checkbox', modern: 'net.noodl.controls.checkbox' },
  { label: 'Cloud Function', deprecated: 'Cloud Function', modern: 'CloudFunction2' },
  { label: 'Component Object', deprecated: 'Component State', modern: 'net.noodl.ComponentObject' },
  { label: 'Object', deprecated: 'Model', modern: 'Model2' },
  { label: 'Parent Component Object', deprecated: 'Parent Component State', modern: 'net.noodl.ParentComponentObject' },
  { label: 'Radio Button', deprecated: 'Radio Button', modern: 'net.noodl.controls.radiobutton' },
  { label: 'Text Input', deprecated: 'Text Input', modern: 'net.noodl.controls.textinput' },
  { label: 'Variable', deprecated: 'Variable', modern: 'Variable2' }
];

/** One `reduce` over the registry. */
function labelIndex() {
  return catalog.nodes.reduce((index, node) => {
    (index[node.displayName] = index[node.displayName] || []).push(node);
    return index;
  }, {});
}

/** Is this a type a user can put on a canvas? */
function isCreatable(node) {
  return node.inNodePicker === true && node.isDeprecated !== true;
}

describe('the picker label is unique per creatable node type', () => {
  const index = labelIndex();

  it('has no creatable collision that is not enumerated as pending a type deletion', () => {
    const found = Object.entries(index)
      .filter(([, nodes]) => nodes.filter(isCreatable).length > 1)
      .map(([label, nodes]) => ({
        label,
        types: nodes
          .filter(isCreatable)
          .map((node) => node.typeName)
          .sort()
      }))
      .sort((a, b) => (a.label < b.label ? -1 : 1));

    // Exact equality in both directions. A NEW collision fails here; a
    // collision that has been RESOLVED without its entry being removed also
    // fails here, with the list printed, which is the instruction to whoever
    // lands the four `noodl.byob.*` deletions.
    expect(found).toEqual(PENDING_TYPE_DELETION);
  });

  it('has no deprecated-shadows-modern pair that is not enumerated', () => {
    const found = Object.entries(index)
      .filter(([, nodes]) => {
        if (nodes.length < 2) return false;
        return nodes.some((node) => node.isDeprecated === true) && nodes.some((node) => isCreatable(node));
      })
      .map(([label, nodes]) => ({
        label,
        deprecated: nodes.find((node) => node.isDeprecated === true).typeName,
        modern: nodes.find((node) => isCreatable(node)).typeName
      }))
      .sort((a, b) => (a.label < b.label ? -1 : 1));

    expect(found).toEqual(DEPRECATED_SHADOWS);
  });

  it('every enumerated exception names types that still exist', () => {
    // The failure this catches is an exception list outliving what it excuses —
    // the exact mechanism by which "enumerate the known cases" degrades into
    // "exclude by a rule", one stale entry at a time.
    const known = new Set(catalog.nodes.map((node) => node.typeName));
    const missing = [];

    for (const entry of PENDING_TYPE_DELETION) {
      for (const typeName of entry.types) if (!known.has(typeName)) missing.push(typeName);
    }
    for (const entry of DEPRECATED_SHADOWS) {
      for (const typeName of [entry.deprecated, entry.modern]) if (!known.has(typeName)) missing.push(typeName);
    }

    expect(missing).toEqual([]);
  });

  it('the relabel landed: the type names did NOT move', () => {
    // The trap the spec names third — "renaming a type name is not the same as
    // renaming a label, and the two are easy to conflate in a file that does
    // both." A saved project holds these strings.
    const byType = new Map(catalog.nodes.map((node) => [node.typeName, node]));
    expect(byType.get('NewDbModelProperties').displayName).toBe('Create Record');
    expect(byType.get('SetDbModelProperties').displayName).toBe('Update Record');
    expect(byType.get('DbCollection2').displayName).toBe('Query Records');
    expect(byType.get('DeleteDbModelProperties').displayName).toBe('Delete Record');
  });
});
