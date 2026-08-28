# EXP-002 — the record verbs: the target output (session 20)

**Decided on paper before code, like every slice since step 5. Read this before touching Create /
Update / Delete Record, the api stub module, control state minted for a form field, or any
`await` in an emitted handler.** This is the first slice whose action is *asynchronous*, and the
shape it settles — an awaited call, a `done` chain that runs after it, and a failure that lands in
component state — is the one the whole backend family (the User nodes, HTTP, the relation verbs)
will reuse.

Sources read first: `packages/noodl-runtime/src/nodes/std-library/data/dbmodelcrudbase.ts`
(`_addBaseInfo` — the outcome/`error` contract, `checkWarningsBeforeCloudOp`, `cloudStore`;
`_addModelId` — `idSource`, `modelId`, the `id` getter, `setModelID`'s empty-id rule;
`_addInputProperties` — `prop-*`; `_addAccessControl`), `newdbmodelpropertiesnode.ts`,
`setdbmodelpropertiesnode.ts`, `deletedbmodelpropertiesnode.ts`. Corpus: `rv-survey.ts` and
`rank2.ts`, session 20 scratchpad (`c21c8eab-…`), outputs `rv-out.txt` / `rank2-out.txt`.

## §0 Why this slice and not Tier B — the ranking instrument, rebuilt

The s19 handoff asked for two things before the next ranking was trusted: real projects added to
the corpus, and the ranking instrument given the columns §5 had been deriving by hand. `rank2.ts`
is that instrument. It prints, per deferred type and **per deferral reason**: raw nodes, distinct
projects, **distinct clone-deduped components**, **distinct programs**, and how many sit in a host
that actually emits a file. The first run corrected two readings immediately:

- `net.noodl.controls.button` reads as **35 nodes across 10 projects** — and is **7 distinct
  instances**, every one collateral of a host whose render tree already defers. Nothing to build.
- The entire top of the raw ranking is **one kit**. `the script reads the Noodl API` (80),
  `logic node (Model2)` (72), `net.noodl.ComponentObject` (56), `the script reads the Component
  scope` (56) and the four *"its `<port>` arrives over a wire, so the rendered structure is not
  static"* rows (72) are the **same eight projects** — all clones of the stock Filters kit, 9
  distinct components between them. Tier B's ~350-node blast radius is real, and it is one
  third-party kit copied eight times, gated behind Model2, a dynamic-template For Each, and a
  reactive-object/event vocabulary none of which exist.

Against that, the record verbs are 19 raw nodes / **12 distinct instances across five genuinely
different hand-built apps** (`Puppy test`, `puppy-test-3-fix008c`, `phase58-backend-deferred`,
`test1`, `tut003-log-a-thing-solution`), every one the *same* idiom, and every one sitting on
vocabulary that already exists. This is the slice; Tier B keeps its place in the queue as a
per-component rewrite once its four prerequisites land.

> ⚠️ The instrument answers "how much *work* is this and how *broadly* does it apply", not "how
> many nodes are there". Both numbers are honest; only one of them ranks slices.

## §1 What the runtime actually does (from the sources)

The three verbs are one node assembled three ways by `dbmodelcrudbase`'s mixins.

- **`store` ("Do") is the only trigger.** `valueChangedToTrue` → `storageInsert` /
  `scheduleSave` / `storageDelete`. Each mints an outcome token, runs
  `checkWarningsBeforeCloudOp`, then `scheduleOnce` — which **coalesces per update pass** (two
  `Do` pulses in one pass do one request) while `pendingOutcomes`/`takeOutcomes` keep *two*
  outcomes, because two invocations are two invocations.
- **`prop-*` inputs accumulate, they do not trigger.** `_setInputValue` writes
  `_internal.inputValues[name]`; nothing else. So the request body is *whatever has arrived by
  the time `Do` fires* — and a `prop-X` that never arrived is an **absent key**, not an empty one.
- **`collectionName` is load-bearing and can be absent.** `checkWarningsBeforeCloudOp` answers a
  missing `collectionId` with `setError('No class name specified')` and returns false — the
  backend is never called. A verb with no class named **always fails**.
- **`modelId` accepts a record or its id**; `setModelID` treats `undefined`/`null`/`''` as *clear
  the binding* (NDA-012 OB-ii), and every verb then answers `setError('Missing Record Id')`.
  `idSource: 'foreach'` instead binds to the enclosing repeater's row.
- **`error` is a value output that is never cleared.** Its description says so in as many words —
  *"kept after a later attempt succeeds"* — and `_internal.error` is assigned only in `setError`.
  `failure` is the signal beside it; `done` fires on success. The error value is flagged dirty
  **before** the pulse, so a graph wiring `Failure → show` can already read `Error`.
- **`id`** reads `model.getId()` when there is a model, else the `modelId` input. On Create,
  `setModel(m)` runs **before** `reportOutcomes(…, 'done')` — so a `done` chain reading `Id`
  already has the id the backend assigned. On Update/Delete it is just the `modelId` input.
- **Update is two nodes in one**: `storeType: 'cloud'` (default) writes through
  `cloudstore.save`; `'local'` only mutates the in-memory record. `storeProperties: 'all'` sends
  every field the record holds rather than only the wired ones.
- Create additionally takes `sourceObjectId` (seed the new record from an existing one) and the
  whole family takes `accessControl`/`acl-*` (an ACL sent with the write) and `backendId`.

## §2 The corpus (rv-survey.ts, clone-deduped)

Nine Create, five Update, five Delete raw; one Add Relation and one `DbModel2` beside them. After
clone-dedupe: **12 distinct verb instances** (6 Create, 3 Update, 3 Delete), plus the two neighbours.
**One idiom, five times:**

```
prop-<field>  ←  textinput.onTextChanged        (the form fields)
modelId       ←  textinput.onTextChanged | Component Inputs.itemId
store         ←  button.onClick                 (the submit)
done          →  Component Outputs.<signal> | DbCollection2.storageFetch | AddDbModelRelation.store
error         →  Text.text                      (the status line)
id            →  AddDbModelRelation.modelId
```

The authored-parameter census is what sets the gates, and it is unusually clean:

| parameter | authored, over the whole corpus |
|---|---|
| `collectionName` | 11 of 12 — **`puppy-test-3-fix008c`'s Delete has none** |
| `idSource` | `explicit` ×3, **`foreach` never** |
| `storeType`, `storeProperties`, `backendId`, `sourceObjectId` | **never** |
| `accessControl` + `acl-*` | `test1`'s Create only |
| a literal `prop-*` | `test1`'s `prop-note="test"` |

Two shapes outside the idiom: `phase58`'s Update takes **two wires into one `prop-count`** (an
increment and a decrement Expression, each with its own `store`), and `tut003`'s Create takes
`store` from a **Visual Function's block-declared `ok`**, which is a value wire, not a signal.

## §3 The enabling change: a form field is state (§4c's third clause, completed)

The dominant idiom cannot be translated by the record verbs alone, and the reason is worth
stating plainly because it is the whole of why this slice was blocked.

`onTextChanged` resolves to `{ kind: 'input-text' }`, which `exprValidIn` admits **only inside
that input's own DOM handler**. The form reads five inputs from the *button's* `onClick`. So
every `prop-*` wire was invalid in its context and the node deferred — not because the verb was
untranslatable, but because its arguments were unreachable.

CONTROLLED-STATE §4c already owns the fix and states it as *"the control's value output anywhere
in the component reads the local state"*. The implementation approximates "anywhere" as **a
rendered sink or a lifted Component Outputs value port** — the only two readers that existed when
it was written. This slice adds the third: **a handler action's argument**. Concretely, the
`outputRead` clause of the minting pass also counts a wire into a record verb's `prop-*` or
`modelId`, and then everything downstream is unchanged — `resolveExpr` already prefers
`state-get` over `input-text` when a control has state, the control's own `onChange` already
seeds the chain-local snapshot with the user-path event value, and the emitted field becomes the
controlled input §4c specifies.

This is the general shape, not a special case: every later handler-argument reader (the User
nodes' credentials, HTTP's body) earns control state by the same clause.

## §4 The target output, hand-written first

### 4a — Create, with the status line and a done chain

```tsx
export function AddStockForm(props: { onItemAdded?: () => void }) {
  const { onItemAdded } = props;
  // The form fields are local state because the submit chain reads them (§3).
  const [name, setName] = useState<string>('');
  const [count, setCount] = useState<string>('');
  const [supplier, setSupplier] = useState<string>('');
  // From "Create stock item" — the Error output, which the runtime keeps after a later
  // attempt succeeds, so nothing clears it.
  const [createStockItemError, setCreateStockItemError] = useState<string | undefined>(undefined);

  return (
    <div className={styles.addStockForm}>
      <input className={styles.name} value={name} onChange={(event) => setName(event.target.value)} />
      …
      <button
        className={styles.addItem}
        onClick={async () => {
          try {
            await createStockItem({ name: name, count: count, supplier: supplier });
            onItemAdded?.();
          } catch (error) {
            setCreateStockItemError(error instanceof Error ? error.message : String(error));
          }
        }}
      >
        Add item
      </button>
      <p className={styles.errorMessage}>{createStockItemError ?? ''}</p>
    </div>
  );
}
```

- **The handler becomes `async` and the call is `await`ed.** Everything after it in the compiled
  chain is the `done` chain, in wire order — which is exactly `reportOutcomes(…, 'done')`'s
  position in the runtime, after the store answers.
- **The `catch` is `setError`.** It writes the error state and runs the `failure` chain if one is
  wired. It does **not** clear the error on success (§1), and it does not rethrow: the runtime
  carries on.
- `error` reads as a maybe-undefined `state-get`, so it folds at its sinks through the existing
  session-12 machinery (`Text.text` → `?? ''`).
- **Coalescing is not modelled and does not need to be.** `scheduleOnce` collapses two `Do`
  pulses *in one update pass* into one request; two clicks are two passes. Nothing in the emit
  vocabulary can deliver two `Do`s in one pass, so the two systems agree at every reachable
  point — grade Q, the A1 argument one tier up.

### 4b — Update and Delete

```tsx
onClick={async () => {
  try {
    await updatePuppy(puppyId, { name: name, breed: breed, age: age, photo: photo, bio: bio });
  } catch (error) {
    setUpdatePuppyError(error instanceof Error ? error.message : String(error));
  }
}}
```

`modelId` is the first argument, resolved through the ordinary value vocabulary (a control state
read here, a `prop` in `phase58`'s row component). Delete takes the id alone.

### 4c — The `id` output — designed, deliberately not built

`NewDbModelProperties.id → AddDbModelRelation.modelId` is a read of a value that exists only
after the await. The chain-local rule generalises cleanly: the awaited call binds a `const`, and
reads of `id` inside that chain resolve to it.

```tsx
const created = await createInquiry({ visitorName, contactInfo, message });
await addInquiryRelation(created.id, puppyId);   // ← the relation verb, when it lands
```

**It is not in the built slice**, and the reason is the corpus: the *only* consumer of `id`
anywhere is `AddDbModelRelation`, which is itself out of scope — so the shape would add a second
scope dimension to `exprValidIn` (a value legal only inside one chain) with no reachable case to
test it against. A consumed `id` is gate 11 instead, and the relation slice inherits this section
already written.

### 4d — The api stub module: reads answer empty, **writes throw**

The verbs join the collection's existing stub module, and the module is now minted by a query
**or** a mutation:

```ts
export interface StockItem {
  id: string;
  name?: string;
  count?: number;
}

/**
 * TODO(export): "Create stock item" (NewDbModelProperties `create_i` on /Components/AddStockForm)
 * created a record in the `StockItem` collection in the project's NodeGX backend. Connect this to
 * your own data source; the export report lists every call site.
 */
export async function createStockItem(data: Partial<StockItem>): Promise<StockItem> {
  throw new Error('createStockItem is not connected to a backend yet');
}
```

`fetchStockItems` returns `[]` so the export builds and runs. A **write** stub must not do the
equivalent, and the asymmetry is deliberate: an empty list is a plausible state of a real
collection, while a fabricated successful write is a plausible state of nothing. Throwing puts
the unfinished export on the path the graph already draws — the status Text fills with the
reason, which is what the interpreted app does with no backend attached. The alternative silently
reports success for a record that was never stored.

Naming is a pure function of the class name, identical to the query stub's derivation, so a
project that both reads and writes one collection gets **one** module: `Puppy` → `src/api/puppies.ts`,
`interface Puppy`, `fetchPuppies`, `createPuppy` / `updatePuppy` / `deletePuppy`.

### 4e — `DbCollection2.storageFetch` as a done-chain action — designed, deliberately not built

`tut003`'s Create fires the collection's re-fetch on `done`. The query already emits `useState` +
a mount `useEffect`; the action would be the same call as a statement, not awaited (the runtime's
`storageFetch` is a pulse whose `fetched`/`done` fire later and, in the corpus, into nothing):

```tsx
await createLogEntries({ title: title });
fetchLogEntries().then(setLogEntries);
```

**Not built, for two reasons that agree.** The query plan is computed in a pass that runs *after*
handler compilation (it depends on the repeater-items wires), so a refetch action compiled during
the handler pass cannot know whether its target will become a query at all — and emitting a call
against a state var that never materialised would break the emitted app's own build. And the
demand is unreachable anyway: `tut003`'s Create defers on its trigger (gate 8) regardless, so
nothing in the corpus exercises it. The pass-ordering note is the real finding, and it belongs to
whichever session lands the Visual Function signal chains, because that is when this becomes
reachable.

## §5 The gates (any hit ⇒ the node defers, reason named)

Each is a fork in §1's contract that the emit vocabulary has no shape for, and each names the
slice that owns it:

1. **No `collectionName`** — *"no class is named, so the runtime answers Failure with 'No class
   name specified' and never calls the backend"*. Translating it as a working call would be a
   hole shaped exactly like the defect. (`puppy-test-3-fix008c`'s Delete.)
2. `idSource = 'foreach'`, or `repeaterComponent` authored — the record is the enclosing
   repeater's row: **row identity**, the s10 wall.
3. `storeType = 'local'` — an in-memory-only write, and the export has no in-memory record.
4. `storeProperties = 'all'` — sends every field the record holds; nothing in the export holds it.
5. `accessControl` / any `acl-*` parameter — the ACL is a backend concept with no stub shape.
6. `backendId` authored, or `sourceObjectId` wired.
7. **Two wires into one `prop-*` or into `modelId`** — last-writer-wins is not statically
   ordered (the CO §4 and control-state precedents, same wording). This is `phase58`'s Update.
8. `store` unwired, or wired from something the handler vocabulary does not compile — which is
   `tut003`'s Create today (`Logic Builder.ok` is a value wire; conditional signal chains for
   Visual Functions are LOGIC-BUILDER's named next increment).
9. `modelId` neither wired nor authored on Update/Delete — the runtime answers
   `setError('Missing Record Id')` every time; same rule as gate 1.
10. A `prop-*` or `modelId` source that resolves to nothing in the vocabulary — defer naming the
    feeder (collateral, the standing rule).
11. A consumed `id` outside the invoking chain; a consumed query `fetched`/`done` on a
    `storageFetch` target.

## §6 Recorded divergences (cosmetic or named, deliberate)

- **Absent keys become empty ones.** The runtime sends only the `prop-*` values that have
  *arrived*; a control's state boots `''` and is always sent. A create where the user typed
  nothing posts `{ name: '' }` where the interpreter posts `{}`. Recorded rather than papered
  over: suppressing boot values would be wrong the moment a user types and then clears a field.
  A plan note names every field this applies to.
- **Coalescing**: `scheduleOnce` merges two `Do`s in one update pass; unreachable from the emit
  vocabulary (§4a).
- **Outcome batching**: two invocations report twice in the runtime through the token batch; two
  awaited calls report twice here, by construction.
- The `error` value is component state rather than a node getter — invisible to
  `getInspectInfo` in the emitted app, which does not exist there anyway.
- `id` before the first successful Create reads `undefined` in the runtime (no model, no
  `modelId`); the export has no reader for it at all (gate 11), so the state is unreachable.

## §7 Fixture & test plan (the EXP-002 discipline — superseded by §9)

- Cheer grows, via MCP on the live project (prefixed wires!), snapshot re-copied (`diff -rq`): a
  small form — two text inputs, a submit button, a Create Record with `done` into a Component
  Outputs signal and `error` into a Text — plus an Update and a Delete over the same collection so
  one api module carries all four functions.
- Tests: goldens for §4a/4b/4c (byte-for-byte); the api-stub module with a query *and* mutations;
  the write-stub throw; every §5 gate producing its named reason; the §3 control-state mint
  (a text input that only feeds a `prop-*` becomes controlled); the async handler shape; the
  `error` fold at `Text.text`; the `id` binding emitted only when read.
- Audit re-run over the 40 projects, same instrument both sides; ledger flips
  `NewDbModelProperties`, `SetDbModelProperties`, `DeleteDbModelProperties` in the same commit;
  emitted app `tsc -b` + `vite build` clean.

## §8 Corpus impact, stated honestly

Seven of the twelve distinct verb instances pass every gate; five do not, and each names a slice
already in the queue (`phase58`'s Update on the two-writer rule, `tut003`'s Create on the Visual
Function signal chain, `puppy-test-3-fix008c`'s Delete on its missing class, `test1`'s Create on
its ACL, `Puppy test`'s Create Inquiry on its consumed `Id`). The collateral is larger than the
verbs: the form's text inputs stop being uncontrolled, the status `Text` gets a source, and
`phase58`'s `Component Outputs` signals get feeds. What actually flips is the audit re-run's to
report, not this document's to promise — §10's standing caution.

## §9 Implementation addendum (session 20 — what building the slice settled)

The slice landed as designed, minus §4c and §4e, both cut with reasons above. These are the
rulings where the paper met the compiler.

- **§7's fixture plan was not followed, and should not have been.** `tests/fixtures/puppy-test-3`
  already carries the idiom verbatim — five inputs into `prop-*`, a button into `Do`, three
  `Error` wires into one status `Text`, and a Delete the author never gave a class name. A shape
  the corpus actually has beats one written to be translatable; in particular no hand-authored
  fixture would have thought to include the missing class name, which is gate 1's only real case.
- 🔴 **A state row reached only by its *writer* was filtered out of existence.** Emit keeps
  `plan.stateVars` that something *references*, and `referencedStateNames` was built from
  expressions and a short list of implicit readers. A record verb's `Error` row is written by its
  catch and — when another verb won the shared status line — read by nothing, so the row vanished
  while `setUpdatePuppyError(…)` stayed in the handler. The emitted app did not compile. The
  general rule the sweep was missing: **a write is a reference.**
- **Three verbs share one status line, and the runtime shows whichever wrote last.** Binding
  overwrite would have dropped two wires in silence, so the first wire binds and the rest drop
  *with a note* — the CO §4 two-writer rule applied to the sink side.
- **The `Error` read requires the verb to have *attached*, not merely to have compiled.** A verb
  whose `Do` the slice could not translate still runs in the interpreter, so binding its `Error`
  to a state row nothing writes would render a blank where the interpreter shows a message. The
  attachment sweep fills `attachedRecordVerbs` and every binding pass runs after it.
- **The try/catch is a statement, so it prints at the handler's own column and takes no
  terminator** — unlike every other action, whose trailing `;` the existing goldens pin (a popup
  close's `if (onClose) { … };` is asserted byte-for-byte). `actionCode` grew an indent
  parameter defaulting to 0, so nothing else moved.
- **The api module is minted by a query *or* a mutation**, and both derive their names from one
  `collectionModuleNames(collectionName)` — otherwise a project that reads and writes one class
  gets two modules that disagree about the type name.

**Corpus outcome (same instrument both sides, worktree at HEAD vs the working tree):**
**3,737/4,441 → 3,749/4,441, 84.15% → 84.42%** — +12 nodes on an unchanged denominator, across
**five distinct projects** (`Puppy test`, `Puppy test 3`, `puppy-test-3-fix008c`, `tut001-drive`,
`phase58-backend-deferred`), no project regressed. Every remaining defer in those projects reads
as one of §5's gates in its own words. 369 tests (25 new); the emitted `puppy-test-3` app
`tsc -b` and `vite build` clean.

## §10 The two typing defects (session 22 — what a corpus-wide build found)

The slice shipped emitting an app that **did not compile**, in a project nobody built. Both
defects are the same shape — the emitted text was right and the emitted *types* were not — and
neither was reachable by a unit test, because every assertion about the text passed. §9's last
line is exactly why: *"the emitted `puppy-test-3` app builds"* is a claim about **one** project.

### 10a — The record interface is the schema **and** the graph

`createStockItem({ name, count, supplier })` against `Partial<StockItem>` where `StockItem` was
`{ id: string }` — TS2353, *'name' does not exist*. The interface is minted from the project's
collection **schema snapshot**, and the measurement that settles the design is this:

| `metadata.dbCollections` | projects |
|---|---|
| absent entirely | **32 of 39** |
| present, with columns | 7 |

So this is not an edge case, it is the default: for most of the corpus every collection types as
`{ id: string }`, and *any* Create or Update that writes a property emits a call that cannot
compile. The Static Data `allowedFields` precedent — drop the column with a note — is the wrong
transplant here, and §4d's own reasoning says so: dropping every property would emit
`createStockItem({})`, a call that reports storing a record while carrying nothing, which is the
one failure this slice exists to make visible.

**The ruling: the schema is the authority where it exists and silent where it does not, and a
`prop-` the graph writes is direct evidence of a column.** The two union — schema order first,
then graph-written columns in first-use order, the schema's declared type winning any conflict.
The type of a graph-written column is whatever its argument resolves to (`unknown` when that is
not statically known; every field is optional, so it stays assignable).

This was never really an open question. **§4d above already hand-writes `name?: string;
count?: number;` into `StockItem` — for this very project, whose snapshot carries no columns at
all.** The target output settled it; the implementation minted the interface from the schema
alone, and nobody compared the two.

### 10b — An absent record id refuses, it does not call

`deleteStockItem(id)` with `id: string | undefined` — TS2345. The id came from a component input
prop, and **every emitted component prop is optional** (`${prop.name}?: ${prop.tsType}`), so this
is structural: any verb whose `modelId` is wired from a component input has a possibly-absent id.

§1 already answers what should happen: `setModelID` reads `undefined`/`null`/`''` as *clear the
binding*, after which every verb answers `setError('Missing Record Id')` and **never reaches the
backend**. So the export refuses too. Gate 9 already defers an id that is *statically* absent;
this is its dynamic twin:

```tsx
try {
  if (!itemId) throw new Error('Missing Record Id');
  await deleteStockItem(itemId);
  onItemDeleted?.();
} catch (error) {
  setDeleteItemError(error instanceof Error ? error.message : String(error));
}
```

Thrown rather than branched, for three reasons that agree: it lands in the catch that is already
the graph's own error path (so the Error output fills exactly as the runtime's `setError` does),
it skips the done chain the way a refusal must, and it narrows the id for the call. `!id` — not
`id === undefined` — is deliberate: it is precisely the runtime's `undefined`/`null`/`''` triple,
**and** it avoids TS2367 when the id is a plain `string`, which it is whenever the graph wires a
form field instead of a prop. Emitted whenever the id is not a literal; a literal is always
non-empty, because gate 9 rejected the empty one.

### 10c — The grader that found them: `scripts/build-corpus.ts`

`tsc` over one emitted project is not `tsc` over the corpus, and that is exactly how these
survived. The script emits **every** project into a prepared harness and typechecks each, one row
per project, exiting with the failure count.

**Same instrument both sides — worktree at HEAD, then the working tree:**

| | projects that typecheck |
|---|---|
| before | 25 / 40 |
| after | **26 / 40** |

Exactly one row moved: `phase58-backend-deferred`, 2 errors → ok. Nothing regressed, and the
coverage report is **byte-identical** to session 21's — this slice buys correctness, not nodes.

🔴 **And the instrument lied first.** The initial run said 18 projects failed, 13 diagnostics of
them *"Cannot find module '@nodegx/core'"* — because the harness never had `@nodegx/core`
installed at all. Those failures were the grader's, not the product's. Linking the package in
moved the *baseline* from 21/40 to 25/40. **A new checker's first finding is a claim about the
checker.**

### 10d — What the corpus check found beyond this slice (open, not this session's work)

**14 projects still do not typecheck**, and the count overstates the work: 8 of them produce
byte-identical diagnostics (they are clones), so the failures reduce to roughly **five distinct
causes**. None is a record-verb defect, and none is a regression — all reproduce at HEAD.

1. 🔴 **A non-identifier component prop name is emitted verbatim as a TypeScript identifier** —
   ~10 projects, and **every syntax diagnostic in the run — 558 of 593** (TS1109/TS1005/TS1434
   and friends). A `Date Picker` with an input port named `Align X` emits `Align X?: string;` and
   destructures `{ Value, Align X, … }`. Port names are user text, and the rest of the emitter
   already knows it — `tsFieldKey`, `recordDataObject` and the static-data field emitter all guard
   the same way. The props path does not. **The single biggest correctness hole in the export.**
2. **An instance passes props to a component that declares none** — `Type '{ categoryName: string;
   … }' is not assignable to 'IntrinsicAttributes'` (`phase55-replay-haiku`). The child has no
   `Component Inputs` node, so it has no Props interface, but the parent sets parameters on the
   instance and emit writes them out.
3. **A component reads a prop it never declared** — `Cannot find name 'image'. Did you mean
   'Image'?` (`ecommerce-example`, `ecom-responsive-probe`). Case/identity mismatch between the
   declared port and the reader; the sibling of (2) from the child's side.
4. **`number` fed into a `string` prop** — TS2322, 3 projects (`phase58-awp006-deepseek`,
   `leg001-comment-measure`). A parameter's catalog type and the prop's emitted type disagree.
5. **`readonly unknown[]` fed into a `string` prop** — the same family, from a collection binding.

Ranked by projects unblocked, (1) is worth more than the other four together.

## §11 The prop-name mapping (session 23 — §10d(1), closed)

### 11a — What was wrong, and why quoting was not the fix

A component input port named `Align X` was emitted verbatim as a TypeScript identifier:
`Align X?: string;` in the Props interface, `{ Value, Align X, … }` in the destructuring. The
measurement, over the 40-project corpus:

| distinct non-identifier port name | sites |
|---|---|
| `Align X`, `Align Y`, `Margin Top/Right/Bottom/Left` | 17 each |
| `Show Label` | 9 |
| `Alternate text`, `Filter Values` | 8 each |

Nine distinct names, every one of them words separated by a space. No leading digits, no exotic
characters, and **no corpus collision** between a sanitised name and an existing port name. On
the caller's side one of them, `Alternate text`, is also a wire target, so it was emitted as a
JSX attribute — `<ProductPhoto Alternate text={…} />`. Generated callback props (`onWaved`,
`onClose`) were never affected: they are minted, not authored.

**The rest of the emitter guards by quoting — `tsFieldKey`, `recordDataObject`, the static-data
field emitter — and that is exactly why the props path could not just copy them.** A record field
is only ever a *property key*, and `{ "Align X": … }` is legal. A prop is a property key **and** a
binding identifier in the destructuring **and** a JSX attribute name at every call site, and the
last two cannot be quoted at all. So the props path maps rather than quotes.

**The ruling: the port name is the graph's vocabulary and the identifier is the emitted app's,
and the mapping is a pure function of the plan's own prop list.** That is what makes parent and
child agree without threading anything between them — the caller resolves an attribute name by
running `propIdentifiers` over the *child's* plan, exactly as the child does. It is §4d's own
parent/child rule (the s10 rule) applied to naming.

The mapping, in `emit/naming.ts`:

- A name that is already a bindable identifier is returned untouched. The emitted interface stays
  the author's vocabulary wherever it legally can be, so `Name`, `value` and `onClick` do not move.
- Otherwise the non-identifier runs are separators: the words join, each after the first
  capitalised. `Align X` → `AlignX`, `Alternate text` → `AlternateText`, `min-width` → `minWidth`.
- A leading digit or an empty result falls back to a `prop` prefix (`2 Column` → `prop2Column`,
  `!!!` → `prop`) rather than emitting something illegal.
- **A reserved word is renamed too** (`class` → `classProp`). It parses as an identifier and still
  cannot be bound, which is the same defect wearing a different hat; the sanitiser is the one
  place that knows. Zero corpus instances — this one is reasoned, not measured, and says so.
- Collisions resolve per component, in two passes, and the order is the point: a port that is
  **already** an identifier keeps its name, so a sanitised sibling yields to it (`Align X` beside
  `AlignX` gives `AlignX2`) rather than stealing it. The generated callback props reserve first.

The port name is not lost — where the identifier differs, a `/** Component input \`Align X\`. */`
doc comment carries it, because that is the name the author will search for.

Four surfaces take the mapping, and a test kills each one independently (mutation-checked: each
reverted in place fails exactly its own test, and no other):

| surface | site |
|---|---|
| the Props interface and the destructuring | the child's `plan.props` |
| every reader — expression, binding, effect dependency | the child's `plan.props` |
| an instance's parameters and wired attributes | `targetPropName`, off the target's plan |
| a repeater row's template inputs, and a popup slot's params | the template's / target's plan |

### 11b — What it bought, same instrument both sides

Worktree at HEAD, then the working tree, `scripts/build-corpus.ts` over all 40 projects:

| | before | after |
|---|---|---|
| projects that typecheck | 26 / 40 | **27 / 40** |
| total diagnostics | 593 | **51** |
| **syntax diagnostics (TS1xxx)** | **558** | **0** |

`Puppy test` (30 errors) now typechecks outright. The eight clone projects went from **66 errors
each to 2**. Nothing regressed, and the coverage report is byte-identical to sessions 21 and 22 —
**3,766/4,441, 84.80%** — as it must be: this retires no node, it makes the ones already
translated compile. The ranking is unchanged from `rank2-s22.txt`. **411 tests (14 new).**

### 11c — 🔴 A syntax error suppresses the semantic pass, so §10d's census was a bound

`tsc` reports parse errors and then does not run the checker. Eight of the fourteen failing
projects had syntax errors, so **for those projects the run reported no semantic diagnostics at
all** — and §10d read that silence as "these projects fail for reason (1)".

They do not. With the syntax errors gone, each of the eight reports **two errors that had never
appeared in any run**: `Outputs["result"] = null;` written into a Visual Function re-host
wrapper's `{ result?: number }` (`Header.tsx`, TS2322). That is a **sixth** distinct cause, in the
visual-function slice rather than the props path, and by project count it is now the largest one
left.

So "roughly five distinct causes" was never a count of what is wrong with the export; it was a
count of what the instrument could still see past the parse failures. **A diagnostic census taken
over a corpus that does not parse reports its bound, not its content** — and the honest reading of
"14 projects fail for five reasons" was always "14 projects fail for *at least* five reasons".

### 11d — What is left, re-derived from the after-run (not inherited)

**13 projects, 51 diagnostics, six distinct causes:**

1. **`null` into a Visual Function wrapper's typed output** — 16 diagnostics, **8 projects**
   (the clone family). The block program writes `Outputs["result"] = null`; the wrapper types the
   field from the port's catalog type as `number | undefined`. Largest remaining, and the only one
   §10d could not see.
2. **A component reading a prop it never declared** — 18 diagnostics, 2 projects
   (`ecommerce-example`, `ecom-responsive-probe`, both `ProductCard.tsx`): `Cannot find name
   'image' / 'badge' / 'rating' / …`. §10d(3), unchanged.
3. **Props passed to a component that declares none** (`IntrinsicAttributes`) — 7 diagnostics,
   1 project (`phase55-replay-haiku`). §10d(2), unchanged. The child's side of (2) and the
   parent's side of this are the same missing `Component Inputs` node seen from two ends.
4. **`number` into a `string` prop** — 4 diagnostics, 2 projects. §10d(4).
5. **`readonly unknown[]` into a `string` prop** — 1 diagnostic, 1 project. §10d(5).
6. **`void` into `ReactNode`** — 2 diagnostics, the two `ProductCard` projects. Travels with (2).

Ranked by projects unblocked, (1) and (2) are worth the rest together: (1) alone would take the
corpus from 27/40 to 35/40.
