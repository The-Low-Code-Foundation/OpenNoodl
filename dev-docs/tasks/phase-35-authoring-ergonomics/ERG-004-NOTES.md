# ERG-004 — build notes

Built 2026-08-02, in the spec's order: `Object Changed`, then `Array Changed` (§2 and §3
together, see the deviation below). Every claim here is measured; where measurement and the
spec disagree, the spec has been corrected in place and the correction is listed in §3.

---

## §0 — the payloads, re-measured

Pinned by `packages/noodl-runtime/test/corpus/erg-004-s0-event-payloads.test.ts`, so these stay
checkable rather than being a snapshot of one afternoon.

| §0 claim | Verdict |
|---|---|
| `Model.notify('change', { name, value, old })` at `model.ts:308`, `:318`, `:346` | **Holds**, all three lines, exact payload |
| A new key is the same event with `old === undefined` | **Holds** |
| `Collection.notify('add'\|'remove', { item, index })` at `collection.ts:206`, `:212`, `:600`, `:624`, `:637` | **Holds**, all five lines, exact payload |
| `Collection.notify('change')` at `:180`, `:192` is bare | **Holds** — it carries no payload |
| …and that is **the whole-array-replacement path**, so a wholesale `set` "can report *that* the array changed and nothing about how" | **WRONG.** See below |

One further measurement the spec did not make, and which changes nothing but is worth having:
`Model.set` does not notify at all when the value is unchanged (`model.ts:344`). Identity
guarding is the runtime's job on this path, not the node's.

### The one premise that did not survive

`notifyChange` is **not** a replacement path. It is the *coalesced companion* to every
structural event:

- `announceAdd` calls it (`collection.ts:207`) and so does `announceRemove` (`:213`), so every
  `add` and every `remove` is followed by one `change`.
- `withBatch` holds it back so that one logical operation emits one `change` however many items
  it moved — that is all `:180` is: the flush at the end of a batch.
- `Collection.set` runs its **whole diff inside `withBatch`** (`:512`). So replacing a
  collection's contents emits a full per-item `add`/`remove` stream *and then* one summary
  `change`.

So the detail §0 believed was unavailable on the replacement path is already being broadcast,
item by item, on the events beside it. `erg-004-s0-event-payloads.test.ts` row S0-C pins this;
`erg-004-array-changed.test.ts` row AC-4 pins the same fact as observed through the node.

There is exactly one mutation class that emits `change` **alone**, with no `add`/`remove`:
a reorder or in-place overwrite — `sort`, `reverse`, `fill`, `copyWithin` (`:277`) — and
growing an array by writing `length`, which leaves holes rather than items (`:387`).

## §0 decision — `Collection.notify('change')` was NOT enriched

**Decision: leave both call sites exactly as they are.** Three reasons, in order of weight.

1. **There is nothing to enrich it with.** Line `:180` is a batch flush covering *N*
   heterogeneous events — some adds, some removes, at different indices. No `{ item, index }`
   describes it. The only honest payload would be an array of the events already emitted
   individually, which is a strictly worse copy of what the listener has already received.
2. **The information the spec wanted is already there.** A node that listens to `add`/`remove`
   knows exactly which items arrived and left in a wholesale `set`. `Array Changed` does, and
   AC-4 proves it. Enriching `change` would add a second, redundant channel for the same facts.
3. **Fourteen production consumers treat it as a payload-free ping.** `collectionnode2`,
   `filtercollectionnode`, `mapcollectionnode`, `foreach`, `dbcollectionnode2`,
   `filterdbmodelsnode`, `options` and the deprecated twins all take `change` to mean "re-read
   the collection" and ignore its argument. Adding a payload would be additive and harmless
   today, but it would create a shape that looks authoritative and is not — a summary that
   necessarily lies for any batch of more than one event.

The instruction to check the autosave allowlist before enriching was followed and is moot,
since nothing was changed. For the record: the allowlist is sensitive to *which events fire*,
and this decision fires exactly the events that fired before.

**What the node reports instead.** `Array Changed` consumes `add` and `remove` for its signals
and derives `Array Replaced` from the *input port's* identity, not from `change`. `change` is
used for one narrow purpose — repairing `Count` after a reorder or a `length` write, which move
an array with no structural event — and sends no signal and re-sends `Count` only when it
actually differs. The consequence is stated on the ports and in the enrichment: **a pure
reorder is not reported as a change**, because nothing was added or removed.

---

## §1 — the defect the "drive it twice" rule caught, which was not in this node

This is the most useful thing the build found, and it is a general runtime hazard that is not
written down anywhere else.

`Node.prototype.sendValue` returns early when the value is `undefined` (`node.ts:706`), so a
port whose first emit is `undefined` queues **nothing** on the receiver. The receiver drains its
input queues with:

```js
const inputNames = Object.keys(this._inputValuesQueue);   // node.ts:566
```

— **insertion order of the queue keys**, and each key is created lazily on that port's first
delivery. So a value port that was `undefined` the first time has its key created *after* the
signal port that did fire, and from then on is drained **after that signal, permanently**.

That is `NV-ii` — a signal arriving before the value it describes — reached by a cause phase 30
did not record: the node's own ordering was already correct (values written, all outputs
flagged, signal last) and was defeated underneath by queue-key creation order.

It cost `Previous Value` on the second and every subsequent `Object Replaced`. A row that drove
the node once could not see it: on the first pass "there was no previous value" and "the value
did not arrive" are the same observation. Row **OC-3b** exists to pin it.

**The fix is also the contract-correct spelling.** A value port emits `null`, never `undefined`
(`emptyToNull` in both node files). Per `EMPTY-VALUE-CONTRACT.md`, `undefined` on a port means
"no opinion", and "there was no previous value" is a statement, not an abstention. No
information is lost: `Key Added` and `Key Changed` already distinguish "the key did not exist"
from "it held null".

**This is worth generalising and is left as a finding, not a fix:** any node in the library that
pairs a signal with a value port that can be `undefined` on its first emit has this bug latent.
Auditing for it is not in ERG-004's scope.

### Two crash-shaped traps guarded on the way in

- **`Model.instanceOf(null)` throws.** It reads `(value as { target? }).target` after the
  `instanceof` check fails (`model.ts:260`). Both nodes test for nullish first.
- **Arrays carry `on`/`off`.** `collection.ts:643` installs them on `Array.prototype`, so a
  duck-type test for `typeof x.on === 'function'` says yes to every array — and an array's
  `change` payload is `undefined`, so a Model-shaped listener would read `.name` off nothing.
  `Object Changed` declines arrays outright.

### Also measured, because the obvious spelling does nothing

`push` on a **bare** array is silent. The nine mutator wrappers live on the collection Proxy
(`collection.ts:356-428`), and a raw array never goes through it, so `push` is the native
method. `add` is an `Array.prototype` patch (`:590`) and notifies on any array; `arr.items.push(x)`
notifies too, because `items` returns the Proxy. Row AC-7 pins all three, and the enrichment
warns authors about it.

---

## §2 — deviations from the spec, and why

1. **§2 and §3 landed in one commit, not two.** The spec asks for `Array Changed` minus
   `Item Changed` first. The per-item lifecycle is the whole difficulty of the node and it
   reaches into the same `set` handler, the same unbind method and the same delete listener;
   splitting it would have meant writing the binding path twice and landing an intermediate
   state whose lifecycle rows did not yet exist. `Object Changed` still landed first and alone,
   which is what the build order was for — proving the shape on pure consumption.

2. **`Array Changed` has a `Key` output the spec's port table does not list.** The spec lists
   `Index` / `Item` / `Count`. Richard's ask was "one of the objects in the array has changed
   its form (new key, new key value)" — *which* key is the substance of that, and it is the one
   fact not recoverable from `Item` downstream. One static port, documented, no dynamism.

3. **Namespaced type names** (`net.noodl.ObjectChanged`, `net.noodl.ArrayChanged`) with
   `displayName`, rather than the bare names the rest of the `Logic` category uses
   (`Condition`, `And`, `Switch`, `Value Changed`). Every node added to this repo recently is
   namespaced — `net.noodl.SSE`, `net.noodl.TextAccumulator`, `net.noodl.controls.options` —
   and a bare name is a collision surface. Deviation is from local convention, not from the spec.

4. **`Object Replaced` / `Array Replaced` clear `Key` and `Index` rather than leaving them.**
   A replacement implicates no single key or index, and a stale key beside a fresh signal is
   the same defect class the node exists to avoid, one port over. Rows OC-3 and AC-3 pin it.

5. **The corpus lives in `packages/noodl-runtime/test/corpus/` although the nodes live in
   `packages/noodl-viewer-react/`.** `helpers/node-harness.ts` is native there;
   `noodl-viewer-react`'s tsconfig compiles at `module: es6` and excludes `tests`. The corpus
   already crosses this boundary in the other direction, and the node modules import nothing
   but `@noodl/types`, so they compile cleanly in the runtime's program. Both node files *are*
   typechecked by that run, via ts-jest.

6. **`Collection.notify('change')` unchanged** — §0 above.

---

## §3 — corrections written back into the spec

`ERG-004-CHANGE-DETECTION.md` §0 has been corrected: the "⚠️ And the gap in the plumbing"
section claimed `:180`/`:192` was the whole-array-replacement path carrying nothing about how a
`set` changed the array. It now states what was measured, names the test that pins it, and
records the decision not to enrich. The five payload claims that held are marked as verified
with the date, so a later reader can tell measurement from inheritance.

---

## §4 — could not verify

Named explicitly, because an unchecked claim is not a result.

1. ~~**Success criterion 7 — live QA. NOT DONE, and it is the headline gap.**~~ **DONE
   2026-08-02 — see §7.** Every item on the list below was driven in the running editor. Two
   defects came out of it: the library-wide output-description loss (§7.3, fixed) and
   `Object Changed` having no producer (§7.4, referred). The list is kept as written because
   §7.1 answers it row by row.

   The editor takes a
   single-instance lock and another session held it for this whole build; the spec also notes
   these nodes need a real frame clock that `renderToStaticMarkup` cannot provide. Nothing in
   this task has been seen running in the editor or a browser.

   What a later session must actually drive — this is the list, not a gesture at one:

   - Both nodes appear in the node picker under **Logic**, with the display names
     `Object Changed` and `Array Changed`, and their ports carry the descriptions written here.
   - Wire an **Object** node → `Object Changed`, and a Text node to `Key`, `Value` and
     `Previous Value`. Edit a property in the editor **twice**. The values shown must be the
     ones the signal is about, both times — that is the class OC-3b caught in jest, and it is
     the one a frame clock could still reintroduce, because a real graph batches within a frame
     where the corpus settles between events.
   - Set a key that does not exist and confirm **Key Added** fires and **Key Changed** does not;
     then edit it and confirm the reverse.
   - Wire an **Array** node → `Array Changed` with `Count` on screen. Add and remove items and
     confirm Index and Item track. Then **sort** the array and confirm no signal fires and Count
     stays correct.
   - Edit an object *inside* the array and confirm **Item Changed** fires with the right `Key`
     and `Index`.
   - Delete an `Array Changed` node while its array is still live, then mutate the array, and
     confirm nothing throws and nothing re-renders. That is the leak `Dropdown` actually had,
     and jest checks it by counting listeners — a real run checks it by not misbehaving.
   - The editor's Problems panel must be clean for a graph using both nodes.

   ⚠️ Three Visual fixes were already owed live verification for exactly this reason. This is a
   **fourth** debt, recorded rather than disguised.

2. **`npm run typecheck:viewer` could not be run.** It resolves `@noodl/runtime` through the
   symlinked `node_modules` to the *primary checkout's* sources and needs `build:types` run
   there first, which is a write to another session's tree. The two new node files were
   typechecked directly (`tsc --noEmit` with the viewer's target/module settings) and by
   ts-jest under the runtime's program; both clean. The full viewer program was not.

3. **`npm run test:packages`, `test:ci`, `test:platform` were not run** — they go through
   `lerna exec`, which resolves package roots to the primary checkout. The runtime package's
   suite was run directly with `npx jest` instead; the viewer package's was not run at all, and
   nothing in this task changes a file that its suites cover except `register-nodes.js`
   (two appended lines).

4. **`catalog:examples` is red, and was red at the base commit `2a1138a8`.** Three
   `nonexistent-port` errors — `Number.stored`, `CollectionNew.created`, `String.stored` — from
   examples left behind by ERG-001's port renames. Verified as pre-existing rather than assumed:
   the structural catalog diff against the base is *purely additive* (209 insertions, 0
   deletions, and the only new typeNames are the two added here), and `Number`'s outputs at the
   base commit are `changed/completed/done/savedValue/unchanged` with no `stored`.
   `docs/node-catalog/examples/` is outside this task's territory.

5. **Neither new node has a worked example**, so `catalog:merge:check` emits the same "no
   examples listed" warning it already emits for three existing nodes. Adding one means adding
   a file under `docs/node-catalog/examples/`, which is outside this task's territory. Debt.

6. **The generalised `undefined`-first-emit audit from §1 was not done.** The hazard is fixed in
   these two nodes and documented; how many other nodes pair a signal with a possibly-undefined
   value port is unmeasured.

---

## §5 — test results

Run with a custom reporter, because the default one crashes in `@jest/reporters/getResultHeader`
with `Cannot find module 'terminal-link'` and aborts mid-run looking exactly like a failure.

| Run | Suites | Tests | Failures |
|---|---|---|---|
| `packages/noodl-runtime`, whole package, **with** ERG-004 | 111 passed / 112 | 2089 passed, 13 pending | **0** |
| same, **excluding** the three ERG-004 files (baseline) | 108 passed / 109 | 2044 passed, 13 pending | **0** |
| Delta | +3 suites | +45 tests | — |

**Noise: none added.** The bar was "0 failures *and* no new noise". Stderr for the full run
contains exactly one warning — `ExperimentalWarning: SQLite is an experimental feature` — and
the baseline run excluding the ERG-004 files produces the identical warning, so it is
pre-existing. No "worker process has failed to exit gracefully", which is the specific shape
phase 30's Data batch grew.

`npx eslint` on all five new/changed source files: clean.
`tsc -p packages/noodl-runtime --noEmit`: clean.

## §6 — success criteria

| # | Criterion | Status |
|---|---|---|
| 1 | `Object Changed` reports key-added / key-changed / replaced with key and both values, each pinned by a row driven **twice** | **Met.** OC-1, OC-2, OC-3, and OC-3b for the ordering class the double drive exposed |
| 2 | `Array Changed` reports add and remove with index and item | **Met.** AC-1, AC-2 |
| 3 | The `Collection.notify('change')` decision recorded | **Met.** Not enriched; §0 above, with reasoning and the measurement that overturned the premise |
| 4 | `Item Changed` fires for an in-place edit; listener count returns to baseline after 100 add/remove cycles and after deletion | **Met.** AC-5, and AC-6 with a row for each of the four unsubscribe cases plus two 100-cycle checks in both orders |
| 5 | `Value Changed` unchanged, description still says what it does not do | **Met.** `git diff` against the base for `valuechanged.ts` and `value-changed.json` is empty |
| 6 | All ports documented; catalog regenerated; all three catalog gates pass | **Partially met.** Ports documented, catalog regenerated, 153/153 enriched. `catalog:check` and `catalog:merge:check` green. `catalog:examples` **red, pre-existing at the base commit** and outside this territory — see §4.4 |
| 7 | Live QA | **Not done — blocked.** Editor lock held by another session. Debt named in §4.1 with the specific list to drive |

> **Superseded 2026-08-02 by §7 below.** Criterion 7 is now **met** — every row of §4.1 was
> driven in the running editor. Criterion 6 is now **met** as well, but only after live QA
> found that the ports were documented everywhere *except* the one place an author could
> read them. `catalog:examples` is now green (50/50) too. The table in §7.6 is the current
> one.

---

## §7 — live QA, done 2026-08-02

Driven in the running editor (`npm run dev:debug`), against a purpose-built project at
`~/vscode_projects/NodeGX test projects/erg004-qa`, with a real viewer and a real frame
clock. Every row of §4.1 was driven; **each behavioural class was driven twice**, because
the corpus settles between events where a real graph batches within a frame, and that
window is where NV-ii lives.

The project is generated by a script rather than clicked together, so it is reproducible:
`gen_erg004_project.py`, reproduced in §7.5. Readouts are labelled on screen (`OC key: …`)
after reading them positionally produced one wrong conclusion — see §7.4.

### §7.1 — what was driven, and what happened

Signals are counted by a `Counter` per signal port, so "which signal fired" is a number on
screen rather than an inference from the values beside it.

| Row | Expected | Observed |
|---|---|---|
| First Object arrives | `Object Replaced` once, `Key` empty, `Value` = the object | ✅ `objReplaced 1`, `OC key:` empty, `OC value: [object Object]`, `OC prev:` empty |
| Add key `name` | `Key Added`, **not** `Key Changed`; prev empty | ✅ `keyAdded 1 / keyChanged 0`; `key: name, value: alpha, prev:` empty |
| Add key `colour` (**2nd drive**) | `keyAdded 2 / keyChanged 0` | ✅ `key: colour, value: red, prev:` empty |
| Change `name` → beta | `Key Changed`, **not** `Key Added`; prev = alpha | ✅ `keyAdded 2 / keyChanged 1`; `key: name, value: beta, prev: alpha` |
| Change `name` → gamma (**2nd drive**) | `keyChanged 2`; prev = beta | ✅ `key: name, value: gamma, prev: beta` — **the values are the ones the signal is about, both times** |
| Array item added | `Item Added`, Index and Count track | ✅ `itemAdded 1`, `count 1`, `index 0` |
| Second item added (**2nd drive**) | `itemAdded 2`, `count 2`, `index 1` | ✅ |
| Edit an object *inside* the array | `Item Changed` with the right Index and Key | ✅ `itemChanged 1`, `index 0`, `key t` |
| Edit a second item (**2nd drive**) | `itemChanged 2`, `index 1` | ✅ |
| Remove an item | `Item Removed`, Index and Count track | ✅ `itemRemoved 1`, `count 1`, `index 0` |
| **Sort** the array | **no signal at all**, Count stays correct | ✅ no counter moved; `count` unchanged. §0's documented limitation, confirmed live |
| Delete an `Array Changed` node while its array is live, then mutate | nothing throws, nothing re-renders | ✅ see §7.2 |
| Problems panel for a graph using both nodes | clean | ✅ see §7.3 |
| Both nodes in the picker under **Logic**, ports documented | present and documented | 🔴 present; **the descriptions were not.** See §7.3 |

`Previous Value` was correct on the **second and later** `Object Replaced` and `Key Changed`,
which is the exact class OC-3b caught in jest. A real frame clock does not reintroduce it.

### §7.2 — the deletion / leak check

`Array Changed` was deleted through the editor's own path (`NodeGraphEditor.delete()`, what
the context menu's Delete calls) while its array held two watched members. Then, with the
node gone: two `add`s, two in-place member edits, one `remove` and one `sort`.

- **No exception.** `window.onerror` collected nothing; `.logs/dev.log` has no
  `[renderer:exception]` line for the window.
- **Every counter frozen** at its pre-deletion value — `itemAdded 2`, `itemChanged 1`,
  `itemRemoved 0`. The node stopped listening to the array *and* to each member. That is the
  leak `Dropdown` actually had, checked the way a real run checks it: by not misbehaving.

### §7.3 — 🔴 the defect live QA found, which no gate could

Both nodes are in the picker under **Logic** with the right display names. Their ports are
all present with the right display names, types and groups. **Not one output port carried
its description.**

Measured against the running editor's `NodeLibrary` — the object the picker, the validator's
`CatalogIndex` and the authoring loop all read:

| | before | after |
|---|---|---|
| input ports with a `description` | **1656 / 1809** | 1656 / 1809 |
| output ports with a `description` | **0 / 1144** | **1031 / 1144** |

Zero. Every `description` written on an output port anywhere in the library — including all
of phase 30's documentation pass — was being deleted on the way to the editor.

**Cause.** `generateNodeLibrary` formats input ports with `formatPort`, which copies
`description`. Static output ports went through `exportOutput`
(`nodelibraryexport.ts:499-518`), a hand-copied near-duplicate that copied `group`,
`displayName`, `editorName` and `index` and **not** `description`. Fixed by deleting the
duplicate and delegating to `formatPort`.

⚠️ **Why every gate stayed green over it, which is the part worth keeping.** The text was in
the node definitions. It was in the committed catalog (1045/1144 outputs documented),
because `scripts/node-catalog/extractor-entry.js` builds its ports from its own capture of
the definitions and borrows only `typecasts` and the picker index from this file. So
`catalog:check`, `catalog:merge:check` and the whole 153/153 enrichment sweep were all
green — over a library the editor could not see. **The defect lived in the one hop no
fixture covered: runtime → editor.** A green catalog is not evidence that an author can read
anything.

Pinned by `packages/noodl-runtime/test/nodelibraryexport.port-descriptions.test.ts`, which
covers that hop directly. Confirmed to actually catch it: with the pre-fix body restored,
**4 of its 6 rows fail**, and the two that pass are exactly the input-side control and the
"fields that were never dropped" guard.

**Two honest limits on this fix.**

1. **1031, not 1144.** 113 output ports still carry no description because none was written;
   and the committed catalog reports 1045, so **14 ports are documented in the catalog and
   not in the editor export**. That gap is unexplained and is named here rather than rounded
   off. It is not a regression — before the fix the number was 0.
2. **No editor UI renders a port description today.** Grepped: neither the property editor,
   the node picker preview, nor the canvas port hover reads `port.description` — for inputs
   either. So this fix does not by itself put text in front of an author; it removes a data
   loss that would otherwise silently defeat any surface that starts to. **Surfacing port
   documentation in the editor is unowned work** and is the natural follow-up.

With the deliberately mis-wired pair of §7.4 removed, the Problems panel is **empty** for a
graph using both nodes.

### §7.4 — 🔴 `Object Changed` has no producer in the node library

The blocker the previous session hit, run to ground. It is not an authoring mistake.

**Nothing in the library outputs a live Object.** Swept the catalog: seven ports declare type
`object` as an output (`DbCollection2.changedRecord`, `On App Error.errorObject`,
`net.noodl.GlobalStore.state`, `net.noodl.HTTP.responseHeaders`,
`net.noodl.PatternExtractor.namedGroups`, `net.noodl.StateSnapshot.snapshot`,
`DbCollection2.realtimeError`) and **not one of them is a Noodl `Model`**, which is what
`isWatchableObject` needs. The entire Data category identifies objects by **string id** —
`Model2.modelId` in, `Model2.id` out; `SetModelProperties.modelId`; `Collection2.collectionId`.
`Object Changed` is the only node in the library that wants the object itself.

So an author does the obvious thing and wires `Object.Id → Object Changed.Object`. The
editor permits it: `string → object` is a declared typecast. What then happens, measured:

1. `node.ts:360-390` sees a string on an `object`-typed port and **`eval`s it as a JS
   literal** — `eval('(qa-obj)')`.
2. `qa-obj` parses as the subtraction `qa - obj`, so it throws `ReferenceError: qa is not
   defined`.
3. The catch substitutes **`{}`** and raises an `invalid-object` warning.
4. `{}` has no `on`/`off`, so the node watches nothing, for the life of the app.

Same story for `Array Changed` fed `Array.Id` (`invalid-array`, substitutes `[]`).

**It is not silent** — the warning fires and reaches the topbar chip, which is better than
this session expected going in. But the message an author gets is
*"Invalid object — ReferenceError: qa is not defined"*, which describes a JavaScript
evaluation they did not ask for, names an identifier they never wrote, and says nothing
about ids or about what to wire instead.

Today the **only** way to feed either node is a `Script` node returning
`Noodl.Object.get(id)` / `Noodl.Array.get(id)` — which is what the QA project does, and which
puts a JavaScript node in the middle of a feature whose entire point was ergonomics.

### ✅ DECIDED by Richard, 2026-08-02 — **add an object-valued output to the `Object` node**

Richard chose the second option below, **over** this session's recommendation of resolving an id
string on the input. The work is unowned and not started.

What that means concretely:

- The `Object` node (`Model2`) gains an output that emits the **live `Model`**, not its id, so
  `Object → Object Changed` is a genuine `object → object` wire with no cast and no `eval`.
- `Array Changed` needs the matching treatment on `Collection2` (a live `Collection` output),
  or it stays reachable only through a `Script` node — the two nodes have the same defect and
  should not be fixed apart.
- ⚠️ **The blast radius Richard accepted is real and should be handled, not discovered.** The Data
  category currently has exactly one way to name an object — by id — and this adds a second. Both
  will be in the picker, both will be wireable into the same places, and the typecast table will
  still accept the *wrong* one (`string → object`) silently. So the change is not finished when the
  port exists: the id-string path into `Object Changed.Object` needs to either resolve or say
  something better than *"ReferenceError: qa is not defined"*, or authors will keep reaching for
  the id and keep getting `{}`.
- The catalog, the enrichment prose and both nodes' `description` fields need to say which of the
  two to use and when.

The options as they were put, for the record:

- **Resolve an id string on the input** — `(this.nodeScope.modelScope || Model).get(id)` for
  `Object Changed` and the `Collection` equivalent for `Array Changed`, exactly the line
  `Model2.setModelID` already uses (`modelnode2.ts:361`). Consistent with the whole Data
  category, makes the obvious wiring the correct one, and keeps the live-object path working.
  ⚠️ It has to run **before** `node.ts`'s string→object `eval`, which currently gets there
  first — so the port cannot stay declared as plain `object`.
- Add an object-valued output to the `Object` node. Bigger blast radius; every consumer of
  the Data category's id convention would then have two ways to say the same thing.
- Leave it and improve the warning text only. Cheapest; leaves the node reachable only
  through JavaScript.

### §7.5 — the QA project, and four traps in authoring one by hand

`~/vscode_projects/NodeGX test projects/erg004-qa` — one component, a labelled readout per
value port, a `Counter` per signal port, and both nodes wired **twice over**: once from live
values (a `Script` node) and once from the id strings (§7.4). Regenerate it with the
script in this session's scratchpad; it is registered in
`~/Library/Application Support/NodeGX/recently_opened_project.json`.

Four things cost time, all of them reusable:

1. ⚠️ **A hand-authored `Script` node needs its `dynamicports` written into `project.json`.**
   The runtime registers a Script node's outputs from `this.model.outputPorts` — what the
   *exported graph* carries — not from the ports its own parser derives from the code. With
   `"dynamicports": []` the node parses fine, runs `setup` fine, and throws
   *"Node Javascript2 doesn't have a port named obj"* the moment `setup` touches an output.
   The editor computes them and writes them back on save; authoring by hand means writing
   them yourself.
2. ⚠️ **The editor autosaves over a hand-authored `project.json`.** After the §7.2 deletion
   test the file on disk had lost the deleted node, and the next run measured a dead half of
   the graph and briefly looked like a regression in the fix. Regenerate before every run.
3. ⚠️ **Read readouts by label, never by DOM position.** Nine unlabelled `Text` nodes
   produced a confident and wrong reading (`[object Object]` attributed to the wrong node)
   that cost a detour. Each readout is now a row of `label + value`.
4. `Group`'s layout parameter takes flex values (`row`, `column`) — `"Horizontal"` raises
   `group/layout-not-a-flex-direction`. The warning is good; the guess was mine.

### §7.6 — success criteria, restated after live QA

| # | Criterion | Status |
|---|---|---|
| 1 | `Object Changed` reports key-added / key-changed / replaced with key and both values, each pinned by a row driven **twice** | **Met.** OC-1, OC-2, OC-3, OC-3b in jest; and all four classes driven twice live (§7.1) |
| 2 | `Array Changed` reports add and remove with index and item | **Met.** AC-1, AC-2; confirmed live |
| 3 | The `Collection.notify('change')` decision recorded | **Met.** §0. The reorder consequence is now also confirmed live — a sort fires nothing and Count stays right |
| 4 | `Item Changed` fires for an in-place edit; listener count returns to baseline after 100 add/remove cycles and after deletion | **Met.** AC-5/AC-6 in jest; live deletion check in §7.2 |
| 5 | `Value Changed` unchanged, description still says what it does not do | **Met.** Unchanged |
| 6 | All ports documented; catalog regenerated; all three catalog gates pass | **Met.** All three gates green, including `catalog:examples` **50/50**. ⚠️ Met only after §7.3 — the ports were documented everywhere except the editor |
| 7 | Live QA | **Met.** §7.1–§7.4. Every row of §4.1 driven; two defects found, one fixed and one referred |

### §7.7 — what §7 leaves open

1. **The §7.4 decision.** `Object Changed` is not wireable without a `Script` node. Needs
   Richard.
2. ~~**Port descriptions are not rendered anywhere in the editor**, for inputs or outputs.~~
   ✅ **Closed for the property panel 2026-08-02.** See §7.9. The canvas port hover and the node
   picker preview are still unowned, and signal ports still have no surface at all.
3. ~~**The 14-port gap** between the catalog's 1045 documented outputs and the editor's 1031.~~
   ✅ **Closed 2026-08-02. It was never a defect — but chasing it found a red gate.** See §7.8.
4. **§4.6 is still open** — the generalised audit of nodes pairing a signal with a
   possibly-`undefined` value port. Untouched by this session.

### §7.8 — the 14-port gap explained, and the red gate it was hiding (2026-08-02)

§7.7 item 3 named an unexplained gap: the committed catalog documents **1045 of 1144** output ports,
the editor export carries **1031**. Both read the same node definitions, so the difference had to be
in how each side *collects* them.

**Measured** by running `generateNodeLibrary` over the real registries in the same process the
catalog extractor uses (`scripts/node-catalog/lib/bundle` + a throwaway entry modelled on
`extractor-entry.js`), then diffing port-by-port against `node-catalog.json`:

| | documented / total output ports | node types |
|---|---|---|
| editor export (`generateNodeLibrary`) | **1031 / 1130** | 149 |
| committed catalog | **1045 / 1144** | 153 |

**The gap is exactly four node types.** `noodl.cloud.aggregate`, `noodl.cloud.request`,
`noodl.cloud.response` and `noodl.cloud.sendemail` are `availableIn: ['cloud']` — they carry 14
output ports between them, all 14 documented in the catalog. The catalog extracts from the browser
**and** cloud registries; `generateNodeLibrary(browserRuntime…)` is the browser register only, and
the editor gets cloud nodes through a **separate** channel. Among the 149 types both cover there are
**zero** per-port discrepancies in either direction.

⚠️ **So the two numbers compared different populations — but the gap was still real where it
mattered.** The editor does not run `generateNodeLibrary(browserRuntime…)` alone; it **merges the
cloud channel in**, so its live `NodeLibrary` covers all **153** types. Measured against the running
editor *after* the regeneration below: **1045 / 1144 output ports documented, and all four cloud
types at 3/3, 4/4, 4/4, 3/3** — exactly matching the catalog. Before the regeneration the editor
carried those four types with **zero** descriptions. The 14-port shortfall was therefore a genuine
14-description hole in what an author's editor could see, and closing it is what actually closed
§7.7 item 3.

#### 🔴 What the separate channel turned out to be carrying

That channel is `packages/noodl-editor/src/editor/src/models/nodelibrary/cloud-node-library.json`, a
**committed** artefact built by `npm run cloud-library:generate` — which calls the same
`generateNodeLibrary`. The committed copy carried **0 of 387** output-port descriptions: it was last
regenerated at `dc140543`, before §7.3's fix, so it had the old bug's output baked into it.

⚠️ **`npm run cloud-library:check` was already failing on the tree**, and had been since `62fdc4ec`.
§7.3's fix changed the generator's output without regenerating the artefact, and the closeout gate
run recorded in `NEXT-SESSION-PROMPT-CLOSEOUT-3.md` listed `catalog:check`, `catalog:merge:check` and
`catalog:examples` — **not** `cloud-library:check`, which is the one that would have caught it.

Regenerated. Outputs went **0/387 → 384/387**; the diff is 384 added `description` lines and nothing
else (the other 768 changed lines are the trailing commas on the `displayName` lines above them).
`cloud-library:check` and `catalog:check` are both green again.

**The lesson is the same one §7.3 drew, one layer further out.** §7.3 said a green catalog is not
evidence an author can read anything, because the catalog generator never crosses the runtime →
editor hop. This is the sequel: the fix *did* cross that hop for the live library, and left a
**committed snapshot** of the pre-fix output sitting in the editor's source tree. A fix to a
generator is not finished until every artefact that generator owns has been regenerated — and the
way to find them is to run the gate that checks each one, not the ones you remember.

### §7.9 — the descriptions now reach an author (2026-08-02)

§7.7 item 2: the fix in §7.3 restored ~1656 input and ~1045 output descriptions into `NodeLibrary`
that **no surface in the editor read**. This closes that for the property panel, which is where an
author configures a port.

**Where.** `Ports.renderParams`, the same seam BCN-010 chose for capability gates, plus a new
`utils/portDescription.ts`. Rendered as a native `title` on the row.

**Why one seam and not a prop.** `portDecoration.ts` already records the argument — twenty-nine row
classes, each a place the wiring can be forgotten — and this task found the evidence that the
per-class route genuinely does not hold: **`tooltip` is already copied onto the view in eleven
`fromPort` implementations and rendered by two of them.** A field threaded per class is a field most
classes drop. One edit at `renderParams` covers every row type, including ones not written yet.

**Why `title`.** It is the idiom one line away in the same component (`ResetDot` carries
`title="Reset to default"`), it needs no layout, and it cannot push a row's height around — which
matters, because C3 in ERG-003 has just measured what row height costs this panel. **It is a floor,
not a ceiling**: an info glyph, a help popover, or the text in the node picker preview would all be
better and are all still unowned.

**Measured in the running editor** (relaunched, not hot-reloaded — see the trap below), by comparing
what is on screen against the node's own model rather than against itself, so "0 documented" cannot
pass for "all covered":

| Node | input ports | documented | on screen | not shown |
|---|---|---|---|---|
| `Repeater` | 5 | 5 | **3** | `refresh` (signal), `templateScript` (conditional, hidden) |
| `Global Store` | 4 | 4 | **4** | — |
| `Function` | 76 | 4 | **3** | `run` (signal) |
| `Array` | 5 | 5 | **4** | `fetch` (signal) |

**Every miss is a port with no property row by design** — a `signal`, which is connection-only, or a
conditional port hidden by the current mode. Coverage is 100% of the rows that exist.

⚠️ **So the honest remainder is signals.** A signal port's description now exists, is correct, and
still has nowhere to appear, because the only surface it could use is the canvas port hover, which
renders nothing. That is the next piece of this work and it is unowned.

Pinned by `packages/noodl-editor/tests-unit/property-editor/portDescription.test.ts` — eight cases,
and seven of them are about when it must **not** write a tooltip. An empty `title=""` renders as a
blank grey box, and clobbering a row's own title replaces a specific message with a general one.
`description` has already arrived wrong twice this phase (§7.3, §7.8), so `null`, a number and
whitespace are not hypothetical inputs.

⚠️ **The trap, again, and it cost a restart.** HMR reported the edited modules and then
*"Nothing hot updated"* — the property editor already mounted in the renderer kept the old
`renderParams`, and a live probe read **0 tooltips** against a change that was correct. That is
indistinguishable from a broken change. **Relaunch the stack before measuring a change to a
long-lived panel**; `tsc` clean and jest green said nothing about it either way.
