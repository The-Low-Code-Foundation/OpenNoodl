# ERG-003 — One editor for every list input

| Field | Value |
|---|---|
| **Tier** | 2 |
| **Prerequisites** | none |
| **Recommended executor** | Sonnet. The component exists; this is a storage decision plus a swap |
| **Origin** | Richard, 2026-08-01 — the stringlist "New entry" popup renders the comment editor |

## Objective

Give every list-shaped port one editor with three ways in: **a visual builder, a JSON code editor, or
a wire** — reusing the component that already exists rather than building a fourth list UI.

## §0 — What exists (measured 2026-08-01)

### The component is already built, already shared, and already has the right shape

[`JSONEditor`](../../../packages/noodl-core-ui/src/components/json-editor/JSONEditor.tsx) —
~1,300 lines across the component and its helpers, in **`noodl-core-ui`**, so nothing needs
extracting from the settings panel:

| Piece | What it is |
|---|---|
| `modes/EasyMode/` | The visual tree builder — the no-code path |
| `modes/AdvancedMode/` | Text editor with live validation |
| `utils/jsonValidator.ts` | Validation, with an `expectedType` of `object` / `array` / `any` |
| `utils/treeConverter.ts` | Value ↔ tree, both directions |
| props | `value`, `onChange`, `onSave`, `defaultMode`, `mode` (forced), `expectedType`, `disabled`, `height` |

**Used in exactly one place:** the app-level Variables section of the Settings panel
(`VariablesSection.tsx:88`). Richard's recollection was right — it was built for global static lists
and never applied anywhere else.

### The target surface, and it is concentrated

| Port type | Ports | Nodes include |
|---|---|---|
| `array` | 26 | Array, Create New Array, Query Records, Array Filter, Repeater, Array Map |
| `stringlist` | 25 | Cloud Function, Component Object, Send Event, Close Popup, Create New Object, Page Inputs |
| `object` | 11 | Query Records, On App Error, Global Store, HTTP Request, Send Email |
| `proplist` | 7 | Function, Script, Create Record, Component Stack, Update Record |

69 ports, funnelled through a handful of property-editor type handlers — not 69 separate places.

> ⚠️ **Corrected 2026-08-02 (ERG-003 execution).** Those four figures are exact, but they count
> **inputs and outputs together**. The property panel only builds rows for `getPorts('input')`, so
> the *editable* surface is **46 input ports**; the other 23 are outputs and have no editor to be
> given one. Breakdown: `array` 10 in + 16 out, `stringlist` 25 + 0, `object` 4 + 7, `proplist`
> 7 + 0. The derivation is now a test —
> `packages/noodl-core-ui/tests/json-editor/listPortCoverage.test.ts` — routing through the same
> `listPortTypeFor` the property panel switches on.

## §1 — ⚠️ The real work is the storage format, not the UI

**`stringlist` is stored as a comma-separated string, not an array.**
[`StringListType.ts`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/StringList/StringListType.ts)
normalises by `value.split(',')`, with a legacy branch for arrays-of-objects carrying `label` fields.

So this task has a §0 decision before any UI moves:

- **Option A — migrate to a JSON array**, with read-time tolerance for the old comma string (the
  normalise function already does exactly that, so the tolerance is free). Under the standing
  [compatibility policy](../../reference/COMPATIBILITY-POLICY.md) this is allowed and is the honest
  option: one representation, not two.
- **Option B — keep the comma string** and translate at the editor boundary. Cheaper today, and it
  keeps a format whose failure mode is "a value containing a comma".

**Recommendation: A.** A comma-separated string cannot represent a value containing a comma, and the
policy exists precisely so a correctness fix does not have to be dual-pathed. But it is a decision,
it touches saved projects, and it should be made explicitly rather than discovered halfway through.

⚠️ **Re-derive the encodings before deciding.** SUB-013 established the parameter encodings *by
observation* and found a bare-pattern assumption that had broken three checks. Do not trust this
section's summary of `stringlist` without re-measuring the other three types.

---

## §1a — DECISION: **Option B**, taken 2026-08-02 from the measurement below

**`stringlist` keeps the comma-separated string.** Option A was recommended and was *not* taken,
because re-measuring falsified the premise it rested on. Full working in
[`ERG-003-NOTES.md`](./ERG-003-NOTES.md).

### The measurement

Every `project.json` in the repo — 89 files, 5,411 node instances — scanned for values actually
stored at catalog-declared list-shaped input ports.

| Port type | Stored values found | Shape observed | Verdict |
|---|---|---|---|
| `stringlist` | **423** | 100% a string. 302 contained a comma, 121 did not. **Zero arrays.** | §1's claim **confirmed** |
| `proplist` | **55** | 100% `Array<{id, label}>` (47 populated, 8 empty). | §2's guess **contradicted** |
| `array` | **0** | nothing stored anywhere in the repo | had to be derived from code |
| `object` | **0** | nothing stored anywhere in the repo | had to be derived from code |

`array`/`object`, from the code path instead: `CodeEditorType` stores the **raw editor text as a
string**, and `Node.prototype.setInputValue` (`node.ts:360`) `eval`s it. That branch only fires for
`typeof value === 'string'`, so a real array/object also works — both shapes are legal at runtime.

### Why Option A was rejected

A's premise, quoted from §1: *"the normalise function already does exactly that, so the tolerance is
free."* That is true of the **editor** and false of the **runtime**, which is where the value is
consumed.

**Twenty-nine files** under `packages/noodl-runtime/src/nodes/**` and
`packages/noodl-viewer-react/src/nodes/**` each independently `split(',')` a `stringlist` parameter
— `states.ts`, `page-inputs.ts`, `componentobject.ts`, `cloudfunction.ts`, `modelnode2.ts`,
`closepopup.ts`, `eventsender.ts` and 22 more. `['a','b'].split` is a `TypeError`. Migrating the
storage means editing all 29, and there is no single boundary to do it at: `setInputValue` hands the
raw parameter to each node's own setter.

**This is not the compatibility policy being invoked.** Apply the policy's own test — strike the
words "existing projects" from the justification and see whether it stands. It does: the 29
consumers would break for a project authored in NodeGX **tomorrow**, not for a legacy one. Nothing
here is being preserved for other people's old files. The policy waives protecting abandoned
projects; it does not waive the runtime working.

### What Option B has to buy to be honest

A comma-separated string cannot hold a value containing a comma, and until now nothing said so:
`performAdd('a,b')` pushed one entry, joined to `"a,b"`, and read back as **two**, silently. The
translation boundary now **refuses** a comma, a duplicate and an empty entry, with a message beside
the field, and stores nothing when it refuses. The format's one real failure is now visible instead
of silent.

### `proplist` — §2's guess was wrong

§2 suggests *"it is a list of named properties, so the natural shape is an object, not an array."*
Checked against what `Function` and `Script` consume (`simplejavascript.ts:655`,
`javascript.ts:768`): each entry's `label` becomes a port name **and** its `id` becomes the
`parentItemId` of that entry's child ports — the per-input **Type** dropdown. An object keyed by
label could carry neither stable identity across a rename nor the author's ordering, both of which
the drag-reorder and the child ports depend on. **`proplist` stays `Array<{id, label}>`**, and the
ids stay visible in the JSON view so a reorder there does not orphan every child port.

### `array` / `object` — string storage kept, deliberately

Storing a real parsed array/object would be cleaner and the runtime accepts it. It was **not** done:
zero repo projects hold such a value, so there is no corpus to measure the change against, and
criterion 7's live QA was unavailable to this session. Changing a port's on-disk type with neither a
test corpus nor a live check is exactly the trap DV-ii names. The editor now writes **canonical
JSON** into that string, and tolerates the JavaScript literal the runtime `eval`s
(`{ Authorization: 'Bearer x' }`) on read rather than calling a working value invalid.

## §2 — The three-way affordance

The end state Richard described:

1. **Visual list/object builder** — `EasyMode`, the default.
2. **JSON code editor** — `AdvancedMode`, one toggle away.
3. **Connect a wire** for dynamic values — **this already works** on any port, so it is not built
   here; it is *shown*, so an author knows it is an option.

`expectedType` already distinguishes "must be an array" from "must be an object", which maps onto the
port types directly. `proplist` is the one that needs thought: it is a list of *named properties*, so
the natural shape is an object, not an array — check what `Function` and `Script` actually consume
before choosing.

## §3 — The bug this closes on the way past

The stringlist **"New entry" popup renders the comment/code editor** — an 8-row textarea placeholdered
`// Add your comment here...` — for a field that takes one short identifier. Found live on
`Page Inputs`; it affects every `stringlist` port in the library. The textarea is shared with the
comment editor, which is why it was left as a decision rather than patched.

## Success criteria

1. The storage decision is recorded in this file with the measurement it was made from.
2. Every one of the 69 list-shaped ports uses one editor. Derived from the catalog, not from §0's
   table.
3. An author can switch between visual and code on any of them, and the visual mode can produce
   every value the code mode can.
4. The comment-editor textarea no longer appears for any list input.
5. A port with a connection shows that it is driven by a wire rather than offering a stale local
   value.
6. Existing projects' list values still load — including a `stringlist` written in the old format, if
   Option A is chosen.
7. ⚠️ Live QA in the running editor on at least one port of each of the four types. The panel is
   exactly the surface where a static check passes and the UI is wrong — DV-ii's rule.

### Status — 2026-08-02

| # | Status | Evidence |
|---|---|---|
| 1 | **Met** | §1a above; measurement in `ERG-003-NOTES.md` |
| 2 | **Met, and the criterion's own number corrected** | 46 input ports (not 69 — see §0's note); `listPortCoverage.test.ts` |
| 3 | **Met statically, unconfirmed live** | `treeConverter.test.ts` (round trip, incl. the empty-key gap fixed here). The *toggle* itself is `JSONEditor`'s and is unexercised without a renderer |
| 4 | **Met** | Neither list row calls `PopupLayer.StringInputPopup` any more; adding is inline |
| 5 | **Met statically, unconfirmed live** | `ListInputRow` / `StringListInput` render `BindingChip` when `isPortConnected` |
| 6 | **Met, measured** | `storedValueCorpus.test.ts` — all 478 stored values in the repo round-trip byte-identically |
| 7 | ❌ **NOT MET — explicit debt** | The Electron single-instance lock was held by another session. Four named ports to drive are listed in `ERG-003-NOTES.md` § "Could not verify" |
