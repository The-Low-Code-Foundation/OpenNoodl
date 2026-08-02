# ERG-003 — execution notes

**Executed:** 2026-08-02, on branch `wt-erg-003` from `cline-dev` tip `2a1138a8`.
**Constraint that shaped the session:** the Electron single-instance lock was held by a concurrent
session in the primary checkout, so **criterion 7 (live QA) could not be attempted at all**. It is
recorded below as named debt with the exact ports to drive. Nothing in this document claims a live
observation.

---

## 1. The encoding re-measurement, in full

§1 said in bold: *do not trust this section's summary of `stringlist` without re-measuring the other
three types.* Here is the measurement.

### Method

`scripts` were throwaway; the durable versions are the tests. Two passes:

1. **Corpus pass.** Every `project.json` in the repo — **89 files, 5,411 node instances** — walked
   root-to-leaf. For each node, its `type` was looked up in
   `packages/noodl-types/src/node-catalog.json`, each parameter matched against the node's declared
   **input** ports, and the JS shape of every value stored at a list-shaped port recorded.
   Instance-declared (dynamic) ports were collected separately.
2. **Code pass**, for the two types the corpus had nothing to say about.

The corpus pass is now
[`storedValueCorpus.test.ts`](../../../packages/noodl-core-ui/tests/json-editor/storedValueCorpus.test.ts),
so it re-runs rather than being a one-off claim.

### Results

| Port type | Values found | Shape | Spec's claim |
|---|---|---|---|
| `stringlist` | **423** | 100% `string`. 302 with a comma, 121 without. **Zero arrays, zero objects.** | **Confirmed** |
| `proplist` | **55** | 100% `Array<{id, label}>`. 47 populated, 8 empty. | §2's guess **contradicted** |
| `array` | **0** | — | Unmeasurable from the corpus |
| `object` | **0** | — | Unmeasurable from the corpus |

Representative values, verbatim:

```
library/prefabs/filters :: /Filters :: net.noodl.ComponentObject.properties
    = "FilterItems,Filter,FilterValues"
library/prefabs/pagination :: /Pagination :: net.noodl.ComponentObject.properties
    = "Selected Page"
library/prefabs/send-grid :: /#__cloud__/SendGrid/Send Email :: JavaScriptFunction.scriptInputs
    = [{"id":"yg17","label":"From"},{"id":"0ozg","label":"To"},{"id":"cc02","label":"Subject"}, …]
```

**`array` / `object`, from the code path** (the corpus being silent is itself a finding — no repo
project sets one):

- `CodeEditorType.onLaunchClicked` → `save()` writes `_this.value`, the **raw editor text**. A
  string.
- `Node.prototype.setInputValue` (`packages/noodl-runtime/src/node.ts:360`) — when the input type is
  `array` or `object` **and** `typeof value === 'string'`, it `eval`s the literal (parenthesised for
  `object`).
- Because the branch is gated on `typeof value === 'string'`, a **real** array/object passes through
  untouched. Both shapes are legal at runtime.
- `DataTypes/Ports.ts` deliberately did **not** JSON-validate these ports; its comment says why —
  `{ Authorization: 'Bearer x' }` is a good object literal and JSON validation would flag the
  unquoted key.

### What the measurement changed

- **It confirmed §1's `stringlist` claim** and **falsified the premise of §1's recommendation** (see
  §2 below).
- **It contradicted §2's `proplist` suggestion** ("the natural shape is an object").
- **It corrected §0's port count** from 69 to 46 (see §5).

---

## 2. The storage decision: **Option B**, against the spec's recommendation

The spec recommends A and instructs "go with A unless your measurement contradicts its premise". It
does.

**A's premise, quoted:** *"with read-time tolerance for the old comma string (the normalise function
already does exactly that, so the tolerance is free)."*

That is true of `StringListType.normalizeList`, which is **editor** code. The parameter is not
consumed in the editor. It is consumed by node setters, and:

> **29 files** under `packages/noodl-runtime/src/nodes/**` and
> `packages/noodl-viewer-react/src/nodes/**` each independently call `.split(',')` on a `stringlist`
> parameter.

`states.ts`, `page-inputs.ts`, `navigate.ts`, `navigate-back.ts`, `navigate-to-path.ts`,
`closepopup.ts`, `showpopup.ts`, `componentobject.ts`, `parentcomponentobject.ts`,
`componentutils/base.ts`, `eventsender.ts`, `eventreceiver.ts`, `cloudfunction.ts`, `modelnode2.ts`,
`modelcrudbase.ts`, `filterdbmodelsnode.ts`, `filtercollectionnode.ts`, `httpnode.ts`,
`byob-utils.ts`, `sse.ts`, `websocket.ts`, `action-dispatcher.ts`, `statehistorynode.ts`,
`globalstoresubscribenode.ts`, plus five in `nodes-deprecated/`.

`['a','b'].split` is a `TypeError`. There is no single seam to fix it at: `setInputValue` hands the
raw parameter to each node's own setter, so the tolerance would have to be written 29 times.

**Every one of those files is inside the territory fence this session was given** — the brief says
to stop and report rather than edit them. So Option A was not merely expensive here; it was out of
bounds. **That is reported, not worked around.**

### But the fence is not the argument

It would be dishonest to hide behind it, so here is the decision on merit, using the compatibility
policy's own test — *strike the words "existing projects" and see if it stands*:

> The 29 consumers would break for a project authored in NodeGX **tomorrow**. This is not a legacy
> concern; no abandoned project is being protected. The policy waives protecting other people's old
> files. It does not waive the runtime working.

It stands. Option B is not a legacy-driven compromise.

**Should A be done later?** Yes, it is the better end state, and it is now a well-defined piece of
work: one PR touching 29 node files plus the codec, with `storedValueCorpus.test.ts` as the gate.
Recommended as its own task rather than smuggled into a UI task.

### What Option B had to buy

Option B is only honest if the format's failure mode is made visible. It is:

- An entry containing a **comma** is now **refused**, with a message beside the field, and nothing is
  stored. Previously `performAdd('a,b')` pushed one entry, `join(',')` wrote `"a,b"`, and the next
  read produced **two**. Silently. Nothing in the codebase had ever checked.
- Duplicates and empty entries are refused the same way (the old code checked these, but only in the
  add popup; the JSON path had no check at all).

---

## 3. Every deviation from the spec, with reasoning

### D1 — `stringlist` storage: Option **B**, not the recommended A
Covered above. The measurement falsified A's premise, and the change is outside the fence.

### D2 — `proplist` stays an array; §2's "natural shape is an object" is wrong
§2 says: *"it is a list of named properties, so the natural shape is an object, not an array — check
what `Function` and `Script` actually consume before choosing."* Checked
(`simplejavascript.ts:655`, `javascript.ts:768`, `dbmodelcrudbase.ts:754`,
`navigation-stack.tsx:1143`):

- each entry's **`label`** becomes a port name (`intype-<label>`, and the value port itself);
- each entry's **`id`** becomes `parentItemId` on that entry's **child ports** — the per-input
  **Type** dropdown on every Function and Script node;
- **order** is authored by drag-reorder and is preserved on disk.

An object keyed by label carries neither stable identity across a rename nor ordering. `proplist`
stays `Array<{id, label}>`. The ids are kept **visible** in the JSON view rather than hidden,
precisely so that reordering rows in code mode does not re-mint them and orphan every child port.

### D3 — `proplist` keeps its own visual builder rather than being replaced by `JSONEditor`
The objective says "one editor … rather than building a fourth list UI". `PropListInput` is not a
fourth list UI being built; it is the existing one, and it **hosts child property rows inside each
entry**. Replacing it with a flat JSON tree would delete the Type dropdown from every Function node
— a regression. So the shared `JSONEditor` sits **beside** it (a `{ }` button) rather than instead
of it. `stringlist` is the same shape of decision, for symmetry rather than necessity.

### D4 — `array`/`object` keep **string** storage
The runtime accepts a real array/object, so migrating was possible and would be cleaner. Not done:
the corpus holds **zero** such values, so there is nothing to measure the change against, and
criterion 7 was unavailable. Changing a port's on-disk type with neither a corpus nor a live check
is the DV-ii trap the spec itself invokes. The editor now writes **canonical JSON** into that
string, and **tolerates** the JS literal on read.

### D5 — §3's bug fixed by *removing the call*, not by changing the popup
`PopupLayer.StringInputPopup` is at
`packages/noodl-editor/src/editor/src/views/PopupLayer/StringInputPopup.tsx`, **outside this
session's territory**, and is shared with four other call sites (canvas comments, component ports ×2,
component templates) that legitimately want a textarea. So the popup is untouched; both list rows now
add entries with the **same inline field they already used for renaming**. Criterion 4 is met by no
list input reaching that popup at all.

### D6 — an unrelated data-loss bug fixed in `treeConverter`
Found while checking criterion 3. `treeNodeToValue` tested object keys for **truthiness**
(`if (child.key)`), so the empty-string key was dropped: `{"": 1}` opened in Easy mode came back
`{}`. Harmless when the editor served only the Settings panel's Variables section; not harmless now
that stored port values pass through it. Changed to `!== undefined` and covered by a test.

### D7 — `EncodeResult` carries redundant-looking optional members
`{ ok: true; value: T; error?: undefined } | { ok: false; value?: undefined; error: string }`. This
repo compiles with `strictNullChecks` **off**, under which TypeScript does not narrow a union by a
boolean-literal discriminant — `if (!r.ok) return r.error` fails to compile without them. Documented
in the type so nobody "tidies" it away.

---

## 4. ⚠️ Could not verify

### C1 — **Criterion 7: live QA. NOT MET. Not attempted.**

The Electron editor takes a single-instance lock and a concurrent session held it for this session's
whole duration. Running it would have hijacked their live session, and `lerna exec` resolves package
roots to the primary checkout, so any packaged run would have tested their code rather than this
branch.

**The four ports a later session must drive** — one per type, each chosen because it exercises
something the static checks cannot:

| # | Node | Port | Type | What to check, specifically |
|---|---|---|---|---|
| 1 | **Page Inputs** | `pathParams` (or `queryParams`) | `stringlist` | This is the port §3 was reported on. Confirm the add field is a **one-line input**, not the 8-row `// Add your comment here...` textarea. Then type `a,b` as one entry and confirm it is **refused with a visible message** and **not stored**. Then `{ }` → the JSON editor shows `["…"]`, Easy and Advanced both work, Save writes back a comma string. |
| 2 | **Function** (`JavaScriptFunction`) | `scriptInputs` | `proplist` | The riskiest of the four. Add two inputs, confirm each still shows its **Type dropdown** (the child port). Open `{ }`, **reorder** the entries in JSON, Save — confirm the Type dropdowns are still attached to the right entries and no port was orphaned. This is what the id-stability code exists for and it is untested live. |
| 3 | **Global Store** | `initialState` | `object` | Was a Monaco popout, is now `JSONEditor`. Confirm the visual builder appears and can add a key. Then set a **JavaScript literal** with an unquoted key via Advanced (`{ Authorization: 'Bearer x' }` is the documented-legal case), close, reopen — confirm the amber "stored as a JavaScript literal" hint appears and the value is **not** blanked. |
| 4 | **Repeater** | `items` (or **Array** → `items`) | `array` | Confirm the row shows a **summary** ("3 items") and Edit opens the shared editor. Then **connect a wire** to the port and confirm the row switches to the **binding chip** naming the source (criterion 5) rather than offering the stale local value. |

Also unverified live, and worth one pass each while in there:

- The popout **sizing and placement** — `JSONEditor` defaults to a 400px-tall block and is now
  rendered into a `showPopout` at a fixed 520px width. Never seen on screen.
- The `fa fa-code` icon on the `{ }` buttons — chosen to match the surrounding Font Awesome usage,
  but the repo has a **known Material-icons-as-text bug** (phase 24) and this glyph has not been
  eyeballed.
- Whether `notifyListeners('panelResized')` still sizes correctly now that the rows can grow an
  inline error line.

### C2 — The editor's own jasmine suite was not run
`npm run test:ci` launches Electron, so it was unavailable for the same reason. The editor
**typechecks clean** (`tsc -p packages/noodl-editor --noEmit`, 0 errors) and no new lint errors were
introduced (ratchet: 836 errors vs a 3,916 baseline, unchanged by this work). No jasmine spec covers
the property-editor rows, so there was nothing in that suite to gain here — but that is an inference,
not an observation.

### C3 — Whether `JSONEditor`'s Easy mode is genuinely pleasant on a long list
`Page Inputs` lists are short; a `Cloud Function` `params` list can be long. The tree renders every
entry with a type badge and 20px-per-level indent. Legibility at 20+ entries is unknown.

### C4 — Undo/redo through the new commit path
`setParameter` is called the same way the previous rows called it, and `Ports` re-renders on
`modelParameterUndo`/`Redo` (the new `resetToDefault` overrides re-read the model, which the old
`StringListType` did **not** do — so this should be *better*). Not exercised.

---

## 5. §0's port count was wrong, and the correction is now a test

§0 tabulates 69 ports. Criterion 2 says to derive them from the catalog rather than the table —
doing so gives **46**.

| Port type | Inputs | Outputs | Sum | §0 said |
|---|---|---|---|---|
| `array` | 10 | 16 | 26 | 26 |
| `stringlist` | 25 | 0 | 25 | 25 |
| `object` | 4 | 7 | 11 | 11 |
| `proplist` | 7 | 0 | 7 | 7 |
| **Total** | **46** | **23** | **69** | **69** |

The figures are exact — they simply count inputs **and outputs**. `Ports._getPorts` only ever reads
`getPorts('input')`, so the 23 outputs have no property row and cannot be given an editor. The
spec file has been corrected in place.

`listPortCoverage.test.ts` now derives all of this from the catalog through `listPortTypeFor` — the
same function `DataTypes/Ports.ts` routes on — so the covered set and the claimed set cannot drift.

---

## 6. What was built

| File | Role |
|---|---|
| `noodl-core-ui/…/json-editor/utils/listValueCodec.ts` | **New.** The only code that knows how each of the four types is stored. Decode → JSON for the editor; encode → storage, refusing what the format cannot hold. |
| `noodl-core-ui/…/json-editor/utils/treeConverter.ts` | Empty-key data-loss fix (D6). |
| `noodl-core-ui/…/json-editor/index.ts` | Exports the codec. |
| `propertyeditor/components/ListValueEditor.tsx` + `.module.scss` | **New.** Hosts `JSONEditor` as a property-panel popout. **An edit that cannot be encoded writes nothing** — the rule that keeps Easy mode's empty-tree-over-unparseable-value from eating data. |
| `propertyeditor/components/ListInputRow.tsx` + `.module.scss` | **New.** The `array`/`object` row: summary, Edit, and the binding chip when connected. |
| `propertyeditor/DataTypes/ListValueType.ts` | **New.** Replaces `CodeEditorType` for `array`/`object`. |
| `propertyeditor/DataTypes/Ports.ts` | Routes both types to `ListValueType` via `listPortTypeFor`. |
| `propertyeditor/DataTypes/StringList/StringListType.ts` | Rewritten onto the codec; no longer splits or joins. |
| `propertyeditor/DataTypes/PropListType.ts` | Rewritten onto the codec; ids now stable by construction. |
| `propertyeditor/components/StringListInput.tsx`, `PropListInput.tsx` | Inline add (D5), `{ }` button, binding chip. |

**Tests** — 4 suites, 62 cases, in `noodl-core-ui/tests/json-editor/`. All were confirmed to fail for
the right reason before passing:

- removing the comma guard fails the comma case;
- removing the JS-literal read fails both recovery cases;
- reverting the empty-key fix fails the empty-key case;
- dropping a type from `LIST_PORT_TYPES` fails four coverage cases;
- changing the `stringlist` separator to `'; '` fails the corpus test, naming the file, component,
  node and value.

**Not touched:** `packages/noodl-types/src/node-catalog.json` (`catalog:check` confirms it is
up to date), any node source, `PopupLayer/StringInputPopup.tsx`, any ERG-001 file.
