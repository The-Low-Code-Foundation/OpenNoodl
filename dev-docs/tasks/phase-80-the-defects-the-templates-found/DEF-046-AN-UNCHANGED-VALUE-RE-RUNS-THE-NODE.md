# DEF-046 — A value that has not changed re-runs the node

**Status: 🟢 BUILT AND GATED 2026-09-03 (s44).** Promoted out of
[TASKS.md § *Findings this phase raised that nobody owns*](TASKS.md#findings-this-phase-raised-that-nobody-owns).
Raised by phase 77 s28 as [D26](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md#d26)
and registered here because phase 77 was closing.

**Richard's scope ruling, 2026-09-03:** *value setters only.* The event-driven call sites are
deliberately untouched — §3.

---

## 1. The defect, and the contract it contradicts

`set` stored the value and called the scheduler with **no comparison to what was already there**.
Measured in a cloud-function trace: a code node received `title: 'Pricing'` twice, identically,
ran twice, and **wrote a database row on each run** — three quarters of a defect where one
*Duplicate* press created four pages.

🔴 **And it contradicted the runtime's own contract.** `run-on-value-change.ts` — Richard's
2026-08-01 decision — justifies keeping `Run` on the grounds that an async re-fetch *"that returns
an identical value fires no change"*. That sentence is only true if an identical value is not a
change. It was one.

---

## 2. 🔴 THE ROW'S SIZING WAS WRONG, AND THAT IS WORTH MORE THAN THE FIX

The register described *"an equality guard for primitives only. **Four lines per family — and
twelve families share the idiom**"*. Re-derived at HEAD:

| the row said | measured |
|---|---|
| 12 families | **15 files** call `shouldRunOnValueChange` |
| ~4 lines each | **39 call sites** |
| one idiom | **at least three**, and they do not take the same fix |

The three shapes, because a session that treats them as one will break the data nodes:

1. **A value setter** — stores what it was handed, then schedules. This is the defect, and the
   fix is a read-before-write plus a comparison.
2. **An event handler** — `cloudStoreEvents`, `onModelChangedCallback`, `collectionChangedCallback`.
   🔴 **There is no previous value.** The subscription is announcing that rows changed
   *underneath* the node; the checkbox there means *"may this trigger run me"*, and a comparison
   has nothing to compare. **Nine sites.**
3. **A state guard** — `collectionnode2._copySourceItems` reads the checkbox to decide what to do
   with state it already holds. Not a setter at all.

⚠️ **One checkbox may govern several setters.** `querySettings` gates six of them on Query
Records; `filterSettings` gates three on Filter Records. *"Did the value change"* and *"is this
input ticked"* are asked at different granularities, which is why the comparison belongs at the
call site and the checkbox lookup stays where it was.

---

## 3. What was built

**One deciding function**, so the two halves of the question cannot drift apart:

- `valueDidChange(previous, next)` in `run-on-value-change.ts` — 🔴 **primitives only**. An array
  or object **mutated in place** is the same reference, so a comparison that did not exclude
  non-primitives would make every collection node go quiet on a real change: a silent data-loss
  bug wearing an optimisation's clothes. `undefined` on either side counts as changed, so a first
  arrival is always a change however a family stores "not set yet". `null` is comparable; `NaN` →
  `NaN` is not a change.
- `Node.prototype.shouldRunOnValueChanged(inputName, previous, next)` — ticked **and** changed.
  Declared in `noodl-types` and in the published node-kit surface, so a kit author gets it too.

**17 value setters converted**, all read-before-write:

| file | sites |
|---|---|
| `expression.ts` | the discovered-input arrival |
| `simplejavascript.ts` | `setScriptInputValue` — **where the reported harm was measured** |
| `condition.ts` | `condition` |
| `data/dbcollectionnode2.ts` | collection name, search, query parameter, backend id, storage settings |
| `data/collectionnode2.ts` | collection id |
| `data/modelnode2.ts`, `data/dbmodelnode2.ts` | model id — ⚠️ compared **after** the object→id dereference |
| `variables/variablebase.ts` | value |
| `data/filtercollectionnode.ts` | enabled, filter settings |
| `data/filterdbmodelsnode.ts` | enabled, filter parameter, filter settings |

**Deliberately NOT converted, and each for a reason:**

- **The nine event handlers** — §2 shape 2.
- **`visualFilter` / `visualSorting`** — always objects or arrays, so the comparison can only ever
  answer *"changed"*. Converting them would be diff with no behaviour in it.
- **`text-input.ts` `startValue`** — ✅ it **already** guards: `if (this._internal.text === text) return;`.
- **`parentcomponentobject.ts`** — ✅ already guards: `if (this._internal.modelId !== id)`.
- **`variablenode2.ts` `name`** — its `else` branch does real work (stores the name and flags the
  output dirty), so a comparison would not skip a run, it would **change which branch runs**. That
  is a behaviour question, not this fix. Owner: **`NONE`**.

---

## 4. Gates

| gate | reading |
| --- | --- |
| `def046-unchanged-value-reruns.test.ts` **before** | **exit 1 — 3 failed, 4 passed**: the three unchanged-value claims, with every control green |
| the same file **after** | **exit 0 — 7 passed** |
| full `noodl-runtime` suite | **146 suites / 2566 passed**, 5 failed — 🔴 all five are `LocalSQLAdapter`/`QueryBuilder`/`SchemaManager`, failing with *"No SQLite engine available — these tests require node:sqlite"*. Environment, not this change (see DEF-045 §3.1) |
| `tsc -p packages/noodl-runtime` · `tsc -p packages/noodl-viewer-react` | **exit 0** · **exit 0** |
| `nodegx-node-kit-types` | 77 passed, **5 failed — identical before and after**: a pre-existing mirror drift on `placeholder`, added to `noodl-types` on 2026-08-24 (`06520033`) and never mirrored |

**The instrument is the scheduler, not an output.** The harm is a *side effect* — a database write
— and by definition the output is identical either way, so counting emissions would have measured
output de-duplication somewhere downstream and reported it as this fix.

🔴 **Every claim is paired with its control**, because a guard that stops re-running on an
unchanged value and also stops re-running on a changed one is silence, not a fix. The
mutated-array row is the one that earns the primitives-only rule: it pushes onto an array, hands
back **the same reference**, and asserts the node still runs and the result moves 2 → 3.

### 4.1 🔴 A stub caught what a prototype method owes

`nda-012-data-record-family.test.ts` builds a stand-in for `Node.prototype` and went red with
*"`this.shouldRunOnValueChanged` is not a function"* — the new method existed on the real
prototype and on nothing else. The stub now carries it, **using the real `valueDidChange` rather
than a flat `true`**: answering `true` unconditionally would have made those rows pass against a
node that re-binds on an unchanged id, which is the defect this row is about.

⚠️ **That is the shape to check for anywhere else a NodeInstance is impersonated** — the deployed
bundles under `nodegx-backend/deploy/artifact/` carry their own copies of this runtime and are
rebuilt, not edited.
