# CN-018 — The picker names the kit

| Field | Value |
|---|---|
| **Tier** | 2 |
| **Effort** | S |
| **Surface** | `runtime` / `editor` |
| **Rulings** | ✅ **D1** — provenance *display* is wanted; ✅ **P1** — it must not demote a kit node |
| **Depends on** | CN-003 (which is what made the kit's name correct in the first place) |
| **Status** | ✅ **Producer side landed 2026-08-16 (s12).** ⚠️ Not driven — needs a viewer build |

## Why this exists

Found by driving the editor in **CN-006 s11**, while measuring AC1's *"placeable under its kit's
name"*. Placeable ✅; **under its kit's name ❌**.

Every kit node in a project was filed under **"External libraries"** in a subcategory named `''`.
Two kits each shipping a `Stat Tile` drew **two identical cards** — same name, same category, same
`title` tooltip — separable only by a `data-test` attribute. An author with two kits installed could
not tell which node they were about to place.

🔴 **The name was never missing.** `NoodlRuntime.registerModule` stamps
`module.name || 'Unknown Module'` onto every definition it registers
([noodl-runtime.ts:517](../../../packages/noodl-runtime/noodl-runtime.ts#L517)), and since **CN-003**
that name is the kit's `manifest.json` name — adopted in `defineModule` from the
`window.__noodl_module_name` marker `@nodegx/module-inject` writes immediately before each kit's
script tag. The exporter read the field, used it as a boolean, and threw the value away.

⚠️ **This is the provenance CN-006b is built on**, which is why it is worth doing before that task
rather than inside it: CN-006b's property-panel row and its kits list both answer "which kit?", and
they should not each invent their own answer.

## What was wrong, exactly

[`nodelibraryexport.ts:917-932`](../../../packages/noodl-runtime/src/nodelibraryexport.ts#L917) —
one hard-coded group:

```ts
nodeTypes.forEach((type) => {
  const nodeMetadata = nodeRegister._constructors[type].metadata;
  if (nodeMetadata.module) moduleNodes.push(type);   // ← the name is right here, and discarded
});

if (moduleNodes.length) {
  obj.nodeIndex.moduleNodes = [{ name: '', items: moduleNodes }];
}
```

[`createnodeindex.ts:115-131`](../../../packages/noodl-editor/src/editor/src/utils/createnodeindex.ts#L115)
renders it faithfully, as nothing. The renderer was never the bug.

## What landed (s12)

Group by `metadata.module`, one subcategory per kit, sorted by name.

- **Sorted, not registration-ordered.** Module load order is an implementation detail no author can
  predict; alphabetical is the only ordering that stays put between sessions.
- **Plain code-unit comparison, not `localeCompare`** — the latter varies with the runtime's locale
  and this blob is snapshot-compared across machines.
- **`'Unknown Module'` is kept as a real group**, not filtered. A kit whose manifest names it nothing
  is genuinely unattributable, and merging it into a neighbour's section would attribute one author's
  node to another.

**Tests:** `packages/noodl-runtime/test/nodelibraryexport.kit-grouping.test.ts` — 6, mutation-proven
(reverting to the single `''` group fails 4 and leaves both controls green, which is correct: the
controls are about *absence* and the old code got absence right).

🔴 **The central case registers TWO kits deliberately.** Every kit fixture in the repo installs
exactly one, and with one kit an unnamed group is **indistinguishable** from a correctly-named one —
a one-kit assertion passes against the old code. That is why nothing caught this.

### The consequence, traced rather than assumed

`NodePicker.search.ts:421` reads `item.subCategoryName || item.categoryName`, so an empty name was
never an empty heading — it *fell back* to "External libraries", which is why the collapse looked
deliberate. With a real name:

- **Browsing:** each kit gets its own `<h3 class="GroupTitle">` heading with an item count and rule
  (`NodePickerResults.tsx:36-41`).
- **Searching:** groups are titled by category, and the kit name moves to the card's second line
  (`toItem`'s `meta`, `NodePicker.search.ts:302-308` → `NodePickerCard.tsx:70`) — so the two
  `Stat Tile` cards differ there too.
- **Preview pane:** the chip reads `External libraries · <Kit Name>` (`NodePickerPreview.tsx:57`).

No editor-side test was added: `NodePickerSearch.test.ts` already carries a category with **two
named** subcategories (`Basic Elements` / `UI Controls`) and asserts the group titles, so the
renderer's handling of this shape is already graded. The change is entirely on the producer side.

## Owed

🔴 **Not driven, and the reason is the recurring one.** The editor loads its viewer from
`packages/noodl-editor/src/external/viewer`, which is **gitignored build output**
(`.gitignore:197`); `src/frames/viewer-frame/index.bundle.js` is untracked too. So the source is
fixed and a *running* editor still shows the old grouping until a viewer build. **Do not report this
as visibly fixed without one.**

Two things want re-recording after that build, and they are the same build:

1. `packages/noodl-editor/tests-unit/cn-003/fixtures/kit-app.editor-nodelibrary.json` — CN-003's
   owed re-record. (It carries only `nodetypes`, no `nodeIndex`, so **this task does not change it**
   — but it is the same drive.)
2. `packages/noodl-mcp/tests/kitAgreement.test.ts:182-185` — its editor expectation is a dated
   `['Unknown Module', 'Unknown Module']` and its comment says so at length. Becomes
   `['Demo Kit', 'Demo Kit']`.

## Acceptance criteria

1. ✅ Two kits in one project produce two separately-named picker groups, each holding only its own
   kit's nodes. *(Graded, mutation-proven.)*
2. ✅ A kit's several nodes stay together under its one name. *(Graded — a per-node group would also
   satisfy AC1.)*
3. ✅ A project with no kits grows no "External libraries" section. *(Control.)*
4. ⚠️ **Driven in a running editor with two kits installed**, after a viewer build: the two
   `Stat Tile` cards are distinguishable **without reading `data-test`**. Open.
5. **The P1 check:** the kit heading must read as attribution, not as a warning label — same type
   scale, same weight, same colour as any other group heading. It is one, today, because it goes
   through the identical component.

## Traps

- 🔴 **One kit cannot see this defect.** Any fixture, drive or screenshot with a single kit installed
  is green under both the old and new code. Two is the minimum.
- 🔴 **`NodeLibraryImporter.mergeInByName` replaces a group wholesale by name**
  (`NodeLibraryImporter.ts:366-388`). Under the old `''` grouping a cloud-runtime module group
  **replaced every browser kit group at once**; named groups narrow that to same-named collisions.
  Not fixed here and not measured — a kit registering nodes in *both* runtimes is still last-wins.
  Wants its own look if CN-013 gets picked up.
- ⚠️ **`metadata.module` is a plain string, always** — `manifest.name`, else the `noodl_modules/<dir>`
  name, else `'Unknown Module'`. Not an object, never `manifest`. Anything treating it as structured
  is wrong.
