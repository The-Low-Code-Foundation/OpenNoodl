# NDA-012 — worker B notes (Array/Variable family, 10 nodes + 1 C1 backfill)

**Date:** 2026-08-01 · **Branch:** `wt-nda012b` · **Commit:** `93adf3f0`
**Territory:** `packages/noodl-viewer-react/src/nodes/std-library/data/**` (minus `cloudfunction*.ts`
and the deprecated types) · new test file
`packages/noodl-viewer-react/tests/corpus/nda-012-array-family.test.ts`.

Everything below is measured. Where something could not be measured it says so, in §3.

---

## 1. Stale premises

### 1.1 ⚠️ `instanceof Collection` answers differently in jest and in the product — and one of this package's existing corpus premises rests on it

The largest finding of the session, and it is about the instrument rather than a node.

`collection.ts:671` is `class CollectionImpl extends Array {}`. **`noodl-viewer-react`'s jest
compiles sibling-package sources with its own `tsconfig.json`, which is `target: es5`**, and an ES5
`__extends Array` does not produce instances that satisfy `instanceof`. The **shipped** viewer does
not: `webpack.common.js` places `@noodl/runtime/webpack-ts-rule` before its own `tsx?` rule, and
that rule compiles the runtime in the runtime's own program at the root `target: ES2019`.

Discriminated directly rather than reasoned about — the same three lines, two targets:

| target | `raw instanceof C` | `proxy instanceof C` |
|---|---|---|
| `es5` | `false` | `false` |
| `ES2019` | `true` | `true` |

Consequences, in order of how much they cost:

1. **`Collection2.setSourceCollection`'s subscription cannot be created through the graph in this
   package.** Measured: a real collection arriving on `Items` fails the guard, no `change` listener
   is attached, and a later change to the source is never copied. That reads *exactly* like an A1
   reactivity defect and is not one. It cost me a wrong diagnosis before the discrimination check.
2. **`collection-failure.ts:99` and `collectionnode2.ts:104` — `if (value instanceof Collection)
   value = value.getId()` — are dead branches under this package's jest.** So the "an Array node's
   `Id` port accepts a collection object as well as a string" behaviour has never been exercised by
   a test, in either sibling. `nda-004-array-mutators.test.ts` drives `setCollectionIdInput`
   directly and never with a collection, so nothing is currently *wrong* — but a row added there
   later would silently take the string branch.
3. It extends the banked pre-ES2015 trap rather than restating it. That one was `for…of` over a
   `Map` silently iterating zero times; this one is `instanceof` silently answering `false`. Same
   package, same cause, no diagnostic in either case, and both read as "the node ignored it".

**The general rule this produces:** in `noodl-viewer-react`'s corpus, *any* `instanceof` against a
class that extends a built-in is untrustworthy. Rows that need one belong in `noodl-runtime`'s half
of the corpus, alongside the parameter-edit rows the §2 batch already moved there for the sibling
`Map` reason.

### 1.2 The brief's `shortDesc` framing, and FINDINGS DA-iv's, both understate the result

The brief says "measure who reads it before spending time on it". Measured, and the answer is
stronger than DA-iv's:

- **`shortDesc` is not in the node catalog for any core node.** `scripts/node-catalog/lib/build-catalog.js`
  mentions `shortDesc` on exactly one line — `:253`, a hard-coded string for the Component Children
  placeholder. `node-catalog.json` contains exactly one `shortDesc` (`:4847`), that one.
- **`ContextBuilder.ts:228` reads a `CatalogNode`, not the runtime node.** `const node =
  this.catalog.getNode(typeName)`, so `enriched?.summary ?? node.shortDesc` falls back to a field
  the catalog never populates from node source. Confirmed by loading
  `node-catalog-enriched.json`: all eleven of my nodes report `shortDesc = undefined`.
- The only path out of a node's own `shortDesc` is `nodelibraryexport.ts:394-395`, into the
  editor's node-library JSON. Grepping the editor for readers of that field returns
  `ContextBuilder.ts:228` and nothing else.

So DA-iv's "the fallback never fires *because* this node's enrichment summary is present" attributes
it to the wrong cause. **The fallback cannot fire for any core node at all**, summary or not. All
eleven of my nodes happen to have an enrichment summary too, which is a second, independent reason
— but removing every summary tomorrow would not make `shortDesc` visible anywhere.

I fixed the four rotted sentences anyway (four lines, and a wrong sentence is worse than a right one
whatever reads it) and put the "should the field exist" question to Richard in §6.

### 1.3 "Array Filter and Filter Records are structurally identical" predicts the shape, not the verdict

NDA-004 §2 found the two structurally identical, and the worksheet gives `Filter Records` ✅ on D1
because "`fp-` and the filter parameter names go through `QueryUtils.collectFilterParameters`, not a
bare split". That is true and it answers a *different question* from the one D1 asks here.

`Array Filter`'s D1 exposure is not the parameter names. It is `filterFilter`, a comma-separated
list of **record property names** matched by bare string against each record's raw `data`
(`getFilter`, `filtercollectionnode.ts:288-308`), with `applyFilter` treating "property absent" as
an immediate non-match for every operator except `$neq`. A typo is therefore indistinguishable from
an empty result. **Measured: two records with a `title`, filtered on `titel`, yields `Count = 0`,
`Filtered` fires, nothing is raised.**

`Filter Records` has the same property-name exposure through the same `filterFilter` mechanism.
Its ✅ is not wrong about `QueryUtils`; it is simply not an answer to the property-name question.
Recorded here rather than edited into `audit/data.md`, which I do not own — **the orchestrator may
want to revisit `Filter Records`' D1 cell.**

### 1.4 Minor: three worksheet pre-fill counts were already stale

`Filter Collection` C1 pre-fill says `0/10` against a header of "4 inputs / 6 outputs" — consistent,
but `Array Filter`'s `Refresh` input was added by NDA-013, so an older reading of the same row would
disagree. Not a defect, just a reminder that the pre-fills are a snapshot. My C1 numbers in §4 are
measured from source after my changes.

---

## 2. Deviations, with reasoning

1. **I fixed four defects rather than only filing them.** NDA-012's "out of scope" section says the
   task produces verdicts; the brief overrides it with "fix what needs no decision". All four fixes
   are additive or refusals of an operation that provably went nowhere, and each carries a
   discrimination check. The three cases where a fix *would* have changed behaviour an author could
   rely on are pinned by rows instead (§5).
2. **I added `Failure`/`Error` outputs to three nodes** (`Array Map`, `Static Array`, `Variable`).
   That is a port-surface change, not just a description. Justification: B1 is one of the twelve
   checks, the Failure Contract makes it mandatory for a node that can fail, and NDA-004 §2 set the
   precedent across the sibling nodes in the same directory. Outputs are additive — no existing
   graph can break.
3. **`Variable`'s failure fires on a value arrival, not a `Do`.** This is the shape FINDINGS warns
   about (the Object node's trap). I took it anyway because the refusal sits *after*
   `scheduleAfterInputsHaveUpdated`, so a `Name` and a `Value` arriving in the same frame are both
   applied before it runs — the false positive needs `Name` to arrive in a strictly later frame than
   `Value`, which no ordinary graph does. `Set Variable` has carried the identical guard since
   NDA-004 §2 without incident.
4. **`Array Map`'s compile failure is reported from `scheduleMap`, not from the `mapScript` setter.**
   Raising in the setter would announce on the boot path for a node whose `Items` are never
   connected. A script that cannot compile only matters when something asks it to run. Array
   Filter draws the same line for `filter-failed`.
5. **`Array Map`'s "no items" failure is gated on `requested`; its two script failures are not.**
   Ported verbatim from Array Filter, including the reasoning: "a script that will not run is wrong
   whenever it is asked to, and unlike *no array yet* it is never a state the graph passes through
   on its way to working."
6. **I did not regenerate the catalog, run `catalog:merge:check`, or touch `audit/data.md`,
   `FINDINGS.md`, `NODE-REGISTER.md`** — per the brief. C1 coverage in §4 is measured by loading the
   node definitions under jest and counting `description` on each declared port, which is the same
   denominator the worksheet pre-fills use (verified against `Remove Object From Array`'s `0/6`:
   3 inputs + 3 outputs).
7. **I did not add enrichment files.** All eleven nodes already have one with a correct summary; a
   second copy of the same sentence is a divergence waiting to happen.
8. **I did not touch the live rig.** Every node in my territory is client-side state — no backend
   call anywhere in the ten — so a Parse/Directus/PocketBase fixture would have measured nothing.
   The `nda012b_*` namespace is unused.

---

## 3. Could not verify

1. **The `Collection2` source-subscription leak, through the graph.** §1.1: the subscription cannot
   be created under this package's jest. The corpus row installs the listener exactly as
   `setSourceCollection`'s guard body does and asserts `_onNodeDeleted` removes it, which pins the
   teardown — the half that was defective. **What is unverified is that the shipped build attaches
   it in the first place**, which is read from source (`collectionnode2.ts:217`) plus the ES2019
   `instanceof` measurement, not observed end to end.
2. **Nothing was checked in the running editor.** I held no editor (single-editor rule, and the
   measurements were all headless). Specifically unverified: that the new `Failure`/`Error` ports
   render and connect on the canvas, and that the new raise codes surface as editor warnings through
   the bus adapter. The adapter path is exercised by existing NDA-004 rows for sibling nodes.
3. **`noodl.deploy.js` was not rebuilt.** It is gitignored and nothing rebuilds it, so these runtime
   changes do not reach a deployed app until someone does. Flagged for the orchestrator.
4. **SSR/cloud (H1's "declared SSR compat is honest").** All ten declare `safe`. I checked that none
   of them touches `window`, `document` or a DOM API — none does; they are pure registry state — but
   I did not run any of them under the SSR runtime.
5. **`Static Array`'s CSV branch with a malformed CSV.** There is no such thing: `CSVToArray` cannot
   fail, it just produces odd rows. So B1 for `Static Array` is about JSON only, and that is what
   the fix covers. Recorded so a later pass does not look for a CSV failure port.
6. **Dynamic ports.** `Set Variable`'s `value` and `Array Filter`'s whole `filter…` set come from
   `setup`, which `graph-harness` never calls. Their descriptions cannot be written in the node
   definition at all — they are constructed in `updatePorts`/`_updatePorts` as plain objects. **C1
   for those ports is structurally unreachable by the method NDA-005 prescribes**; noted in §7.
7. **Whether any real project relies on the three pinned behaviours** in §5. No project corpus was
   searched.

---

## 4. Worksheet rows

Format matches `audit/data.md`. Pre-filled columns are copied from the generated file; C1 pre-fills
are the *pre-change* numbers, and each C1 verdict states the post-change measurement.

---

### Array  `Collection2`

3 inputs / 6 outputs · 1 signal in / 2 signal out · docs 11% · SSR `safe` · browser

Source: `packages/noodl-viewer-react/src/nodes/std-library/data/collectionnode2.ts` ·
Docs: [link](https://docs.noodl.net/nodes/data/array/array-node)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ✅ | Binds `change` on the bound collection in `setCollection` and re-flags `firstItemId`/`count`; a mutation from a Function node that goes through `Collection` notifies. A raw `push` on the underlying array does not — that is the family-wide A1 shape NDA-013 answered with `Fetch`/`Refresh`, and this node has `Fetch`. |
| A2 |  | ✅ | `Fetch` calls `setCollectionID(this._internal.collectionId)` → `Collection.get(id)`, a fresh registry lookup, not a cached reference. |
| A3 |  | ✅ | `collectionChangedScheduled` coalesces within a frame; the first change is not swallowed because the flag is cleared inside the scheduled callback. |
| G1 |  | ✅ | `items` is the contract's worked example and already carried the only `description` in my territory: `undefined` abstains, `null` clears via `Collection#set`'s falsy path. |
| B1 | ⚠️ **none** | 🔵 | No failure surface, and adding one is the decision filed below. The node's only failure mode is an unresolvable `Id`, which today produces a throwaway rather than a refusal. |
| B2 |  | n/a | Nothing is reported anywhere, so there is nothing that is editor-only. |
| B3 | ✅ | ✅ | `Fetch` → `Fetched`. |
| C1 | ⚠️ **11%** (1/9) | ✅ **9/9** | Eight sentences added. `Changed`'s names its own suppression (`isInputConnected('fetch')`), per rule 7. |
| D1 |  | ✅ | No bare-string contract; `collectionId` is an `identifierOf: 'CollectionName'` port. |
| E1 | ⚠️ 2 object/array port(s): items, items | 🔵 | The two `array` ports are the node's purpose and connect to Repeater/Array/Filter. PORT-TYPE-CONTRACT direction C — recorded, not "fixed". |
| F1 |  | ✅ | `Id` names the target explicitly and the `Id` output makes the resolution visible. |
| H1 | declares `safe` | ⚠️ **AR-4, fixed** | `_onNodeDeleted` unbound the node's own collection and **not** the one arriving at `Items`. `setSourceCollection` binds `change` there and only unbinds on the *next* arrival, so a node deleted while bound left its callback — and the whole instance it closes over — reachable from a collection that outlives it. A named collection is held strongly for the life of the page. Fixed with a duck-typed `off` (deliberately not a second `instanceof`; see §1.1). 1 row. |

**Verdict:** ⚠️ 1 defect (AR-4, fixed) · 🔵 **filed:** clearing the `Id` field re-binds the node to a
*fresh anonymous throwaway collection on every set*, and emits a new random guid on the `Id` output
each time — measured, two clears gave two different ids. Same shape `collection-failure.ts` exists to
prevent for the three mutators, never adopted by the node that owns the id. Unbinding is the right
answer and this node has no failure surface to say so on, so the repair and the B1 decision are one
decision. Pinned by a row.

---

### Array Filter  `Filter Collection`

4 inputs / 6 outputs · 2 signal in / 2 signal out · docs 0% · SSR `safe` · browser

Source: `packages/noodl-viewer-react/src/nodes/std-library/data/filtercollectionnode.ts` ·
Docs: [link](https://docs.noodl.net/nodes/data/array/array-filter)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ✅ | Binds `change` on the incoming collection in `bindCollection` and re-filters; `unbindCurrentCollection` runs first, so a rebind cannot double-subscribe. |
| A2 |  | ✅ | `Refresh` (NDA-013) and `Filter` both re-read `this._internal.collection.items` fresh; no private copy exists to go stale. |
| A3 |  | ✅ | `collectionChangedScheduled` coalesces within a frame, which is the intended one-run-per-frame. |
| G1 |  | ✅ | Every value-arrival path is gated on `isInputConnected('filter') === false`, so an explicitly-driven node stays passive; a `null` on `items` falls through to the "no collection" branch rather than being coerced. |
| B1 | ✅ has one | ✅ | `Failure` + `Error` (NDA-004 §2), `no-items` gated on an author having asked and `filter-failed` ungated. |
| B2 |  | ✅ | On the runtime bus via `reportFailure`, not the editor connection. |
| B3 | ✅ | ✅ | `Filter`/`Refresh` → `Filtered` \| `Failure`. |
| C1 | ⚠️ **0%** (0/10) | ✅ **10/10** | All ten static ports. The dynamic `filter…` set is out of reach — §3.6. |
| D1 |  | ⚠️ **AR-8, filed** | `filterFilter` is a comma-separated list of **record property names**, matched by bare string against each record's raw `data` with no validation, and `applyFilter` treats "property absent" as an immediate non-match for every operator except `$neq`. **Measured: two records with `title`, filtered on `titel` → `Count = 0`, `Filtered` fires, nothing raised.** A typo is indistinguishable from an empty result. Filed, not fixed: records are legitimately heterogeneous, so "this property does not exist" is not a fact the node can establish from the data. See §1.3 — `Filter Records`' ✅ on D1 answers a different question and may want revisiting. |
| E1 | ⚠️ 2 object/array port(s): items, items | 🔵 | As `Collection2` — direction C, the node's whole purpose. |
| F1 |  | n/a | Targets nothing implicitly; `Items` is an explicit wire. |
| H1 | declares `safe` | ✅ | `_onNodeDeleted` chains to `Node.prototype` and unbinds. Unlike its `Filter Records` twin there is no `Model.get` save-handler, so DA-v has no analogue here. |

**Verdict:** ⚠️ 1 defect (AR-8, filed) · **checked and clean:** its `setup` registers
`nodeAdded.Filter Collection` and re-runs `updatePorts` on `parameterUpdated` *and* on
`metadataChanged.dbCollections`; `GraphModel.addComponent` emits `nodeAdded` for nodes already in the
component, so existing nodes are covered — same conclusion as the twin, recorded so it is not
re-raised.

---

### Array Map  `Map Collection`

3 inputs / 3 outputs · 1 signal in / 1 signal out · docs 0% · SSR `safe` · browser

Source: `packages/noodl-viewer-react/src/nodes/std-library/data/mapcollectionnode.ts` ·
Docs: [link](https://docs.noodl.net/nodes/data/array/array-map)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ✅ | `bindCollection` subscribes to `change`; NDA-013 added `Refresh` for the raw-mutation case the event cannot see. |
| A2 |  | ✅ | `scheduleMap` reads `this._internal.collection` fresh on every run. |
| A3 |  | ✅ | `collectionChangedScheduled` coalesces within a frame. |
| G1 |  | ✅ | `items` arriving as `null` reaches `bindCollection`'s `collection && …` guard and then the `collection === undefined` branch; nothing is coerced. |
| B1 | ⚠️ **none** | ⚠️ **AR-2, fixed** | **Measured before the fix: a `Script` that will not compile produced no signal, no raised error, no editor warning — the node was completely silent.** `mapFunc` was left `undefined` and the unguarded call threw a `TypeError` out of the scheduled callback into `nodecontext.ts`'s blanket catch, which only `console.error`s; the compile diagnosis itself went to `console.log`. A script that *does* compile and then throws behaved identically. `Items` silently kept the previous run's output either way. Fixed: `Failure`/`Error` outputs, `array-map/script-failed`, `array-map/map-failed` and `array-map/no-items`, on Array Filter's `reportFailure` with its dedup. 6 rows. |
| B2 |  | ⚠️ **AR-2, fixed** | Same defect, second clause: `console.log`/`console.error` is not a channel — no code, no provenance, nothing a graph can branch on. Now on the runtime bus. |
| B3 | ✅ | ⚠️ **AR-2, fixed** | `Refresh` → `Changed`, but a `Refresh` with nothing on `Items` returned silently, emitting neither. Now `Refresh` → `Changed` \| `Failure` in every case. |
| C1 | ⚠️ **0%** (0/6) | ✅ **8/8** | Six existing ports plus the two new ones. |
| D1 |  | 🔵 | `map({…})` entries are property names matched by bare string against the source record, like Array Filter's. Lower exposure — the script is `allowEditOnly`, so it cannot arrive on a wire — and a missing property maps to `undefined` rather than dropping the row. Recorded, not raised. |
| E1 | ⚠️ 2 object/array port(s): items, items | 🔵 | Direction C, as the two siblings. |
| F1 |  | n/a | Nothing implicit. |
| H1 | declares `safe` | ✅ | `_onNodeDeleted` chains and unbinds. `new Function` is compiled per node instance and holds no external reference. |

**Verdict:** ⚠️ 1 defect (AR-2, fixed, spanning B1/B2/B3) · **note for the script-host register:**
this is a `new Function` host (`mapcollectionnode.ts:89`). Whether it is a sixth member of the
five-member script-host class recorded in the CustomCode pass, or outside it because the script is
`allowEditOnly` and takes a fixed one-argument shape, is the CustomCode owner's call — flagged, not
claimed.

---

### Clear Array  `CollectionClear`

2 inputs / 3 outputs · 1 signal in / 2 signal out · docs 0% · SSR `safe` · browser

Source: `packages/noodl-viewer-react/src/nodes/std-library/data/collectionnode-clear.ts`, over
`collection-failure.ts` · Docs: [link](https://docs.noodl.net/nodes/data/array/clear-array)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ✅ | `collection.set([])` notifies `remove` and `change` per item batch (`collection.ts`). |
| A2 |  | ✅ | `Do` re-reads the bound collection; nothing cached. |
| A3 |  | ✅ | One `scheduleAfterInputsHaveUpdated` per `Do`. |
| G1 |  | ✅ | NDA-004 §2 settled `Array Id`: both empty values unbind, reasoning in `collection-failure.ts`. |
| B1 | ✅ has one | ✅ | `Failure`/`Error` via the shared mixin. Unlike its two siblings it has no `Object Id`, so `_failNoCollection` is its only failure — and there is no `Model.get` lookup, so DA-vi has no analogue. |
| B2 |  | ✅ | On the bus via `raise`. |
| B3 | ✅ | ✅ | `Do` → `Done` \| `Failure`. |
| C1 | ⚠️ **0%** (0/5) | ✅ **5/5** | Three own ports plus the shared pair. |
| D1 |  | ✅ | No bare-string contract. |
| E1 | ✅ no dead-end types | ✅ | — |
| F1 |  | ✅ | `Array Id` names the target; `resolveCollectionId` refuses to mint a throwaway. |
| H1 | declares `safe` | ✅ | Holds only a collection reference and registers no listener. |

**Verdict:** ✅ clean · **one cosmetic non-defect recorded so it is not re-raised:**
`_clearCollectionFailure()` runs *after* the guard here and *before* it in its two siblings. The
outcome is identical — the editor keys by `code`, so a re-raise overwrites — but the asymmetry
invites a "fix" that is not one.

---

### Create New Array  `CollectionNew`

2 inputs / 2 outputs · 1 signal in / 1 signal out · docs 0% · SSR `safe` · browser

Source: `packages/noodl-viewer-react/src/nodes/std-library/data/collectionnode-new.ts` ·
Docs: [link](https://docs.noodl.net/nodes/data/array/create-new-array)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | 🔵 | Deliberately a snapshot: `Do` copies `Items` once and no listener is bound to the source, so a later change to the source is not mirrored. That is the node's purpose (a *new* array), not a reactivity defect — recorded so it reads as a decision. |
| A2 |  | ✅ | `Do` is the only trigger and re-reads `sourceCollection`. |
| A3 |  | ✅ | `hasScheduledNew` coalesces, and is cleared inside the callback so a second `Do` in a later frame is not swallowed. |
| G1 |  | ✅ | `undefined` on `items` abstains (`!== undefined` guard); `null` reaches `Collection#set`'s falsy path and produces an empty array. |
| B1 | ⚠️ **none** | 🔵 | **Correct, and already argued.** `collection-failure.ts`'s header states it: this node builds its own collection with `Collection.get()` and cannot fail to find one, and "a `Failure` output on a node that cannot fail is worse than no output at all". The mixin is opt-in for exactly this node. FAILURE-CONTRACT "what counts as a failure", final clause. |
| B2 |  | n/a | Nothing to report. |
| B3 | ✅ | ✅ | `Do` → `Done`, with `Id` flagged before the signal. |
| C1 | ⚠️ **0%** (0/4) | ✅ **4/4** | `Id`'s sentence states the empty behaviour (rule 6) — it is blank until `Do` has fired. |
| D1 |  | ✅ | No string contract at all. |
| E1 | ⚠️ 1 object/array port(s): items | 🔵 | Direction C. |
| F1 |  | n/a | Creates rather than targets. |
| H1 | declares `safe` | ✅ | Registers no listener; the created collection is anonymous and weakly held, so a deleted node releases it. |

**Verdict:** ✅ clean. The `shortDesc` was one of the four wrong ones (§1.2) and is replaced.

---

### Insert Object Into Array  `CollectionInsert`

3 inputs / 3 outputs · 1 signal in / 2 signal out · docs 0% · SSR `safe` · browser

Source: `packages/noodl-viewer-react/src/nodes/std-library/data/collectionnode-insert.ts`, over
`collection-failure.ts` · Docs: [link](https://docs.noodl.net/nodes/data/array/insert-into-array)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ✅ | `Array.prototype.add` notifies `add` and `change` (`collection.ts:590-604`) — **when it does not early-return**; see B1. |
| A2 |  | ✅ | `Do` re-reads the bound collection each time. |
| A3 |  | ✅ | One `scheduleAfterInputsHaveUpdated` per `Do`. |
| G1 |  | ✅ | NDA-004 §2's `Array Id` decision; `Object Id` is `allowConnectionsOnly` and `undefined` is refused rather than minted. |
| B1 | ✅ has one | 🔵 **AR-1, filed** | **Measured: inserting the same Object Id twice leaves the array at size 1 and signals `Done` both times.** `Array.prototype.add` early-returns on `contains`. Not fixed — see §6 for the decision and the argument that distinguishes it from its `Remove` sibling. Pinned by a row. |
| B2 |  | ✅ | The failures it *does* detect are on the bus (NDA-004 §2). |
| B3 | ✅ | ✅ | `Do` → `Done` \| `Failure`. |
| C1 | ⚠️ **0%** (0/6) | ✅ **6/6** | `Done`'s sentence names the pinned ambiguity outright, so an author reading only the port knows. |
| D1 |  | ✅ | No bare-string contract. `Object Id` is a `Model` id, and minting on read is the intended behaviour here (unlike `Remove`). |
| E1 | ✅ no dead-end types | ✅ | — |
| F1 |  | ✅ | `Array Id` names the target; `resolveCollectionId` refuses to mint a throwaway. |
| H1 | declares `safe` | ✅ | Holds only a collection reference. |

**Verdict:** 🔵 1 pinned decision (AR-1) · no repaired defect. The `shortDesc` was one of the four
wrong ones and is replaced.

---

### Remove Object From Array  `CollectionRemove` — **C1 backfill only**

Audited 2026-08-01 in the Record-family pass (DA-vi); every other cell stands. This row updates C1.

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| C1 | ⚠️ **0%** (0/6) | ✅ **6/6** | Owed cell closed. Three own ports plus the shared `Failure`/`Error` pair documented once in `collection-failure.ts`, which also closes the same cell for `Insert` and `Clear`. `Object Id`'s sentence states the DA-vi refusal (rule 6), so the fix is visible to an author who never reads the register. |

**Verdict (unchanged):** ⚠️ 1 defect (DA-vi, fixed) · 🔵 pinned: removing a record that exists but
sits in a *different* array is still `Done`.

---

### Repeater Item  `For Each Actions`

1 input / 3 outputs · 1 signal in / 2 signal out · docs 0% · SSR `safe` · browser

Source: `packages/noodl-viewer-react/src/nodes/std-library/data/foreachactions.ts` ·
Docs: [link](https://docs.noodl.net/nodes/ui-controls/repeater-item)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | n/a | Holds no state and mutates nothing; `Item Id` is computed on read. |
| A2 |  | n/a | Nothing cached to re-read. |
| A3 |  | ✅ | `Added` and `Try Remove` are driven one-for-one by the Repeater; nothing coalesces. |
| G1 |  | ✅ | `Item Id` returns `undefined` when there is no item — abstention, not `''` or `0`. |
| B1 | ⚠️ **none** | ✅ | Its one failure mode — being placed outside a Repeater or Run Tasks template — **is** reported, through `resolveForEachItem`'s `miss` (NDA-015), with per-node dedup, on the runtime bus. Not a `Failure` *port*, because the node has no action to fail: nothing triggers it. The pre-fill's ⚠️ is a false positive of the structural sweep. |
| B2 |  | ✅ | `miss` raises on the bus, not `sendWarning`. |
| B3 | ✅ | 🔵 | `Remove Completed` has no terminating output, and correctly so: it is the *reply* half of a handshake the node itself opened with `Try Remove`. The sequencing lives in the Repeater. Recorded rather than ✅ so the asymmetry is deliberate. |
| C1 | ⚠️ **0%** (0/4) | ✅ **4/4** | `Try Remove`'s sentence says it *blocks* — the one fact an author cannot infer — and names its partner port (rule 7). |
| D1 |  | ✅ | No string contract; the binding is by scope-chain object reference. |
| E1 | ✅ no dead-end types | ✅ | `Item Id` is `string`. |
| F1 |  | 🔵 | The Repeater is resolved implicitly through the scope chain and **cannot** be named — there is no "Repeater" input, unlike `Add Record Relation`'s `Repeater Component`. BINDING-CONTRACT §(a) is unmet. Mitigated rather than met: `resolveForEachItem`'s `miss` makes a *failed* resolution visible, so the invisible case is a successful one that resolved to the wrong Repeater in a nested template. Recorded; a `Repeater` input would be additive and is worth a slice. |
| H1 | declares `safe` | ✅ | `_onNodeDeleted` chains to `Node.prototype` **and** calls `forgetForEachItem`, so `resolvedTargets` (which holds instances strongly) does not grow as a Repeater churns its template. |

**Verdict:** ✅ clean · 🔵 **recorded:** F1 is unmet by BINDING-CONTRACT §(a) — the Repeater cannot
be named — and the docs URL is under `nodes/ui-controls/` while the node's category is `Data`.
Cosmetic, but it is the only node in my ten whose documentation lives outside its category.

---

### Set Variable  `Set Variable`

3 inputs / 3 outputs (+1 dynamic) · 1 signal in / 2 signal out · docs 0% · SSR `safe` · browser

Source: `packages/noodl-viewer-react/src/nodes/std-library/data/setvariablenode.ts` ·
Docs: [link](https://docs.noodl.net/nodes/data/variable/set-variable)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ✅ | `Model.set(..., { forceChange: true })` on the shared record notifies every Variable node bound to the name, including for an unchanged value. |
| A2 |  | n/a | Writes; holds nothing to re-read. |
| A3 |  | ✅ | `hasScheduledStore` coalesces within a frame and is cleared inside the callback. |
| G1 |  | ✅ | An empty or absent `Name` is refused rather than coerced (NDA-004 §2). |
| B1 | ✅ has one | ✅ | `Failure` + `Error` on `set-variable/no-name`. |
| B2 |  | ✅ | `raiseRuntimeError`, not the editor connection. |
| B3 | ✅ | ✅ | `Do` → `Done` \| `Failure`. |
| C1 | ⚠️ **0%** (0/6) | ✅ **6/6** static | The dynamic `Value` port is built in `setup`'s `_updatePorts` as a plain object and cannot carry a `description` by NDA-005's method — §3.6. |
| D1 |  | ⚠️ **AR-7, filed** | `Set as` offers eight conversions and performs **four**. `emptyString`, `boolean`, `object` and `array` are implemented; `string`, `number` and `date` only set the dynamic `Value` port's declared *type*, which the editor's parameter widget honours and **no wire does**. **Measured: `Set as: Number` with `'17'` on a wire stores the string `'17'` and fires `Done`.** `Set as: Date` has no implementation whatsoever. Filed — what `Date` should even produce is a decision. Pinned by a row. |
| E1 | ✅ no dead-end types | ✅ | The dynamic `Value` port takes its type from `Set as`, so it is as connectable as the author asked for. |
| F1 |  | ✅ | `Name` is explicit; there is no implicit target. |
| H1 | declares `safe` | ✅ | Registers no listener — only `Variable` does — so there is nothing to unwind. |

**Verdict:** ⚠️ 1 defect (AR-7, filed).

---

### Static Array  `Static Data`

3 inputs / 2 outputs · 0 signal in / 0 signal out · docs 0% · SSR `safe` · browser

Source: `packages/noodl-viewer-react/src/nodes/std-library/data/staticdata.ts` ·
Docs: [link](https://docs.noodl.net/nodes/data/array/static-array)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ✅ | Both authoring inputs schedule a re-parse and flag `items`/`count`. |
| A2 |  | 🔵 | No `Refresh`, and none is wanted: both sources are `allowEditOnly` parameters, so there is no external state that could change without the setter running. Recorded rather than ⚠️ — the family-wide NDA-013 `Refresh` does not apply here. |
| A3 |  | ✅ | `hasScheduledParseData` coalesces; cleared at the top of `parseData`, so a later edit is not swallowed. |
| G1 |  | ✅ | An absent `csv` yields an empty array rather than a row of `"undefined"` (`CSVToArray` on `undefined` produces a single header row, and the loop starts at 1). |
| B1 | n/a — no action input | ⚠️ **AR-3, fixed** | The pre-fill's `n/a` is wrong: **a node with no signal input can still fail**, and this one did. Malformed JSON was reported *only* through `editorConnection.sendWarning`, behind `if (this.context.editorConnection)` — the exact construction FAILURE-CONTRACT opens by naming. Measured before the fix: the runtime error channel was empty and the node had no `Failure` output at all. Fixed: `Failure`/`Error` outputs and `static-array/json-parse-failed` on the bus, ungated for Array Filter's `filter-failed` reason. 4 rows. |
| B2 |  | ⚠️ **AR-3, fixed** | The second clause of the same defect: a deployed app, cloud function, SSR render and export got nothing at all. |
| B3 | n/a | n/a | No signal inputs. |
| C1 | ⚠️ **0%** (0/5) | ✅ **7/7** | Five existing ports plus the two new ones. `CSV`'s sentence carries the fact the source docstring already knew and no author could see — every cell is a string, so use JSON if numbers must stay numbers. |
| D1 |  | ✅ | CSV column names come from the author's own header row; there is no external contract to mis-match. |
| E1 | ⚠️ 1 object/array port(s): items | 🔵 | Direction C. |
| F1 |  | n/a | Nothing implicit. |
| H1 | declares `safe` | ✅ | Registers no listener; the parsed collection is anonymous and released with the node. |

**Verdict:** ⚠️ 1 defect (AR-3, fixed) · **a second, smaller thing fixed with it and worth naming
separately:** `parseData` installed a *fresh empty* collection before attempting the parse, so a
failed parse left the node internally inconsistent — `Count` read 0 from the new empty collection
while `Items` was never re-flagged and downstream still held the previous one. Building the
collection only on success is what lets `Items`' new description honestly say "unchanged while the
JSON cannot be parsed".

---

### Variable  `Variable2`

3 inputs / 4 outputs · 1 signal in / 2 signal out · docs 0% · SSR `safe` · browser

Source: `packages/noodl-viewer-react/src/nodes/std-library/data/variablenode2.ts` ·
Docs: [link](https://docs.noodl.net/nodes/data/variable/variable-node)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ✅ | Subscribes to `change` on the shared `--ndl--global-variables` record in `initialize`, so a write from anywhere — `Set Variable`, another `Variable`, a Function node reaching the same `Model` — notifies. |
| A2 |  | ✅ | `Fetch` calls `setVariableName` and re-flags `value`, which re-reads the record. |
| A3 |  | ✅ | No coalescing, and none needed: `Model.set` raises one `change` per write. |
| G1 |  | ✅ | `value`'s getter returns `undefined` when there is no name; `Model.get` returns `undefined` for an unset key rather than `''` or `0`. |
| B1 | ⚠️ **none** | ⚠️ **AR-5, fixed** | **The twin of the defect NDA-004 §2 fixed in `Set Variable`, one file across, left alone.** With no `Name`, `scheduleStore` called `Model.set(undefined, value)`, which writes a key literally named `undefined` on the shared record — **measured: `Object.keys(variablesModel.data) === ['undefined']`**. Worse, the node's *own* change listener then matched (`args.name === internal.name`, both `undefined`) and fired **`Changed`**, flagging `Value` dirty for a write that `value`'s own getter refuses to read back. A false success with a self-congratulating signal attached. Fixed: refuse `undefined`/`null`/`''`, `Failure`/`Error` outputs, `variable/no-name` on the bus. 6 rows. |
| B2 |  | ⚠️ **AR-5, fixed** | Nothing was reported anywhere before, in any runtime. |
| B3 | ✅ | ✅ | `Fetch` → `Fetched`; the `value` input is a value arrival, not a signal, so B3 does not reach it. |
| C1 | ⚠️ **0%** (0/7) | ✅ **9/9** | Seven existing ports plus the two new ones. |
| D1 |  | ✅ | `Name` is an `identifierOf: 'VariableName'` port, not a bare string. |
| E1 | ✅ no dead-end types | ✅ | `Value` is `*` both ways. |
| F1 |  | ✅ | `Name` is the target and it is explicit; the shared record behind it is an implementation detail. |
| H1 | declares `safe` | ✅ | `_onNodeDeleted` chains to `Node.prototype` and removes the listener from a record that lives for the whole session — the leak `Collection2` had, correctly handled here. |

**Verdict:** ⚠️ 1 defect (AR-5, fixed) · **the lesson is about the previous pass, not the node.**
NDA-004 §2 fixed `Set Variable`'s `Model.set(undefined, …)`, wrote the paragraph explaining it, and
did not open the file next to it that does the same thing on a value arrival instead of a `Do`. A
sweep scoped by *trigger kind* — "which nodes have a `Do` that can go nowhere" — cannot find the
same defect on a node that has no `Do`.

---

## 5. Pinned, not fixed

Four rows in `nda-012-array-family.test.ts` pin behaviour deliberately left alone, so each is a
decision rather than an accident:

| Row | Behaviour |
|---|---|
| AR-1 | `Insert Object Into Array` reports `Done` for a duplicate insert that changed nothing |
| AR-7 | `Set Variable`'s `Set as: Number` does not convert a string arriving on a wire |
| AR-6 | `Array` with a cleared `Id` binds a *different* throwaway array on every set |
| AR-8 | `Array Filter` on a misspelt property quietly matches nothing and reports `Filtered` |

---

## 6. To Richard — two decisions

### 6.1 Should `Insert Object Into Array` still report `Done` for a duplicate?

**The facts.** `Array.prototype.add` early-returns when the array already contains the item
(`collection.ts:590-604`). Measured: two `Do` pulses with the same `Object Id` leave the array at
size 1 and signal `Done` both times.

**What distinguishes it from `Remove`, which was fixed last session (DA-vi).** DA-vi's case is one
that **cannot** succeed: `Model.get` mints on read, so an id nothing has loaded produces a
brand-new object that is *by construction* not in the array. The removal is a guaranteed no-op for
every value of the array, and the author's intent — "take this out" — is unachievable. This case is
merely **redundant**: the object *is* in the array, which is exactly the state the author asked for.
The post-condition holds. The operation was unnecessary, not impossible.

**The case for leaving it.** Minting a record by id and inserting it is a documented way to build an
array incrementally, and re-inserting on every pass of a loop is a natural way to write "make sure
this is in here". An idempotent insert is a defensible contract, and it is the same reading that
kept "removing a record that sits in a *different* array" pinned rather than changed.

**The case for changing it.** `Done` currently means two different things — "I added it" and "it was
already there" — and no port distinguishes them. An author building "add to cart, then animate the
new row" gets the animation for a row that did not appear. A third signal (`Unchanged`) would say so
without breaking anyone; a `Failure` would break the idempotent reading.

**My recommendation: leave `Done` as it is, and do not add a `Failure`.** If the ambiguity proves
costly, add an `Unchanged` signal output — additive, and it keeps idempotence intact. In the
meantime the `Done` port's new description names the ambiguity outright, so an author reading only
the port is not misled. **Your call.**

### 6.2 Should `shortDesc` exist at all?

**The facts** (§1.2). Fifty sites declare it across the three runtime packages. It is **not** in the
node catalog for any core node — `build-catalog.js` writes it on exactly one hard-coded line, for the
Component Children placeholder. Its only reader is `ContextBuilder.ts:228`,
`enriched?.summary ?? node.shortDesc`, and that `node` is a `CatalogNode` — so the fallback reads a
field the catalog never fills. **Measured: all eleven nodes in my territory report
`shortDesc = undefined` in `node-catalog-enriched.json`.** Every one also has a correct enrichment
summary, so there are two independent reasons the field reaches nobody.

**Three options.**

- **Delete it.** Fifty declarations, one type definition, one export line in `nodelibraryexport.ts`.
  Cheap, and it stops inviting authors to write documentation nobody sees. This is NDA-005 §0's
  `description`-was-inert finding a second time, and that one was resolved by *wiring the field up*
  — which argues the opposite way.
- **Wire it up** as the catalog's summary fallback where no enrichment file exists. 35% of nodes
  have no docs page; some of them may have a usable `shortDesc`. But the enrichment corpus is now
  151 files and growing, and the ones I read are better than the `shortDesc`s they would replace.
- **Leave it.** Costs nothing at runtime, and the field keeps rotting quietly. Four of my nodes
  carried the *same* noun sentence on four different verbs; `Delete Record` described creating.

**My recommendation: delete it**, in a single sweep, once the enrichment corpus is confirmed to
cover every node that has a `shortDesc` worth keeping. It is the only option that stops the rot
rather than promising to. If you would rather not spend the sweep, **leave it and mark it deprecated
in `node-definition.d.ts`** so the next author writing one is told it goes nowhere. I have repaired
the four wrong sentences in my territory either way. **Your call.**

---

## 7. Gate numbers

| Gate | Before | After |
|---|---|---|
| `(cd packages/noodl-viewer-react && npx jest)` | **35 suites / 382 tests, all pass** | **36 suites / 403 tests, all pass** |
| `(cd packages/noodl-viewer-react && npx tsc --noEmit --skipLibCheck -p tsconfig.json)` | clean (exit 0) | clean (exit 0) |
| C1 across my 11 nodes (static ports) | 4 / 74 documented | **74 / 74** |

`--skipLibCheck` is required for the pre-existing dangling `packages/…` import in
`noodl-runtime/dist-types/src/api/cloudstore.d.ts`; it was needed before my changes too.

### Discrimination checks

Seven mutations, each applied to a *copy-then-restore* of the source file, with the mutated file
re-read to confirm the edit landed before believing the result:

| Mutation | Landed | Rows reddened |
|---|---|---|
| `Variable`: drop the no-name guard | ✔ | 5 — every `no-name` row, including the `Changed` one |
| `Array Map`: drop the `mapFunc` guard | ✔ | 2 — the compile row and the dedup control |
| `Array Map`: drop the try/catch around the mapping | ✔ | 1 — the throwing-script row |
| `Array Map`: drop the `requested` gate | ✔ | 2 — the boot-path row and the working-script control |
| `Static Array`: report only to the editor again | ✔ | 2 — the runtime-channel row and the graph-observable row |
| `Static Array`: install the empty collection before parsing | ✔ | 1 — the Items/Count agreement row |
| `Array`: drop the source-collection unbind | ✔ | 1 — the teardown row |

⚠️ **The first run of the `Variable` mutation reddened only 4 of 5, and the miss was the row that
matters most** — "does not report `Changed` for a write that went nowhere" stayed green with the fix
reverted. Cause: all five rows sent the *same* string, and `Model.set` suppresses the change event
for an unchanged value, so by the fourth row there was no change to observe and the row passed for
the wrong reason. Fixed by giving every row a distinct value; the header of that `describe` block
now says why. **A corpus row asserting that something does *not* happen is exactly the row a shared
mutable fixture will make green for free.**

---

## 8. Defect tally

**Distinct defects: 8, across 7 of the 10 nodes** (`Array` carries two). No shared helper carries a
defect, so the counts are not inflated by usage — `collection-failure.ts` is shared by three nodes and is clean; its only
change here is the two port descriptions, which close C1 for all three at once.

| # | Defect | Node | Class | Disposition |
|---|---|---|---|---|
| AR-1 | `Done` for a duplicate insert | Insert Object Into Array | failure (B1) | 🔵 **filed** — §6.1 |
| AR-2 | Silent on both script failures, no `Failure`, no raise, `Refresh` emits nothing | Array Map | failure (B1/B2/B3) | ✅ **fixed** |
| AR-3 | JSON parse error editor-only; outputs inconsistent behind it | Static Array | failure (B1/B2) | ✅ **fixed** |
| AR-4 | Source-collection subscription outlives the node | Array | lifecycle (H1) | ✅ **fixed** |
| AR-5 | Writes a key named `undefined`, then signals `Changed` | Variable | failure (B1/B2) | ✅ **fixed** |
| AR-6 | Cleared `Id` binds a fresh throwaway, emits a random guid | Array | binding | ⚠️ **filed** |
| AR-7 | `Set as` performs four of its eight conversions | Set Variable | string contract (D1) | ⚠️ **filed** |
| AR-8 | Misspelt filter property matches nothing, silently | Array Filter | string contract (D1) | ⚠️ **filed** |

**Fixed 4 · filed 4.** Three nodes are clean: `Clear Array`, `Create New Array`, and `Repeater Item`
— whose ⚠️ B1 pre-fill was a false positive of the structural sweep, because its one failure mode is
already reported through `resolveForEachItem`'s `miss`.

**Per-node usage count, stated separately as NDA-012 asks.** `collection-failure.ts` is applied by
three nodes and `resolveForEachItem` by six; neither is defective here, so no defect above is a
usage count wearing a defect's clothes. The only figure that *is* a usage count is C1: 74 ports
documented across 11 nodes, of which 2 sentences (the shared `Failure`/`Error` pair) close the cell
for 3 nodes at once.

**Find rate: 8 defects across 10 nodes = 0.80/node.** For comparison, Navigation ran 1.88/node and
the Record family 4 in 6 (0.67/node). The rate has not collapsed, but three of my eight are
`filed`-for-a-decision rather than repairs, and two of those three (AR-7, AR-8) are the same
"unvalidated bare string" shape. **The Data category's find rate is holding; the *repair* rate is
falling.**

### Cross-cutting observations for the phase

- **`Model.get`-as-a-lookup did not recur here.** Four sites were named in DA-vi as a concentration
  in this category; my ten nodes contain none beyond `Insert`'s (where minting is the intent) and
  `Remove`'s (already fixed). The shape is a Record-family concentration, not a Data-wide one.
- **A new shape, twice in one batch: a declared conversion that is not performed.** `Set as: Date`
  and `Set as: Number` (AR-7) are ports whose *type* is honoured by the editor's parameter widget
  and by nothing at runtime. Worth a grep across the library for `enum` inputs whose branches are
  not all implemented — `Set Variable` is unlikely to be the only one.
- **A latent trap for anyone writing corpus data.** `ComponentModel.nodes` is an Array indexed by
  node id, and `collection.ts` patches `Array.prototype` with **non-writable** `set`, `add`,
  `remove`, `on`, `off`, `contains` and `notify`. A node whose id is one of those names crashes
  graph import with `TypeError: Cannot assign to read only property 'set'`. Unreachable in a real
  project (ids are guids) and it cost me a confusing failure; the test file now has a comment where
  it bit.
- **`noodl.deploy.js` is untouched.** These are runtime changes and that artifact is gitignored with
  nothing rebuilding it, so a deployed app will not see them until someone runs the viewer build.
