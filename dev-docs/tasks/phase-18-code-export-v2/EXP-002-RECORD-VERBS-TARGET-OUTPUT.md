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

1. ~~**`null` into a Visual Function wrapper's typed output**~~ — 16 diagnostics, **8 projects**
   (the clone family). The block program writes `Outputs["result"] = null`; the wrapper types the
   field from the port's catalog type as `number | undefined`. Largest remaining, and the only one
   §10d could not see. **Closed in session 24 — §12.**
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

## §12 The null a Visual Function writes into a typed output (session 24 — §11d(1), closed)

### 12a — What the runtime does, and why that decides between coercing and widening

The corpus's eight clone projects all emit the same `Header.tsx`:

```ts
function blocks(Inputs: Record<string, never>): { result?: number } {
  const Outputs: { result?: number } = {};
  …
  Outputs["result"] = null;   // TS2322 — an optional `number` cannot take null
```

Two candidate fixes, and §11d left the choice open pending the runtime, exactly the way §10a and
§10b were settled from §1. **Three readings of the sources settle it, and all three point the
same way:**

1. **The block editor's generator writes the null, and never consults the declared type.**
   `NoodlGenerators.ts`: `valueToCode(block, 'VALUE', Order.ASSIGNMENT) || 'null'`. A `set output`
   block with **nothing plugged into its value socket** generates the literal `null`. The
   `Define output result type number` block is a *different* block, and the generator does not
   read it.
2. **The runtime stores what was written, verbatim.** `logic-builder.ts:386` —
   `internal.outputValues[outputName] = context.Outputs[outputName]`, then
   `registerOutputIfNeeded` and `flagOutputDirty`. `typeOfPort` supplies the port's declared type
   to `registerOutput`, and the getter hands back the stored value untouched.
3. **Nothing coerces it on the way out, either.** The one cast on a connection is NDA-014
   (`node.ts:1026`), and it is `object`/`array` → `string` with an explicit `value !== null`
   guard. A `number`-typed output really does deliver `null` to whatever consumes it.

So **the declared output type is a claim about the port, not a check on the writes** — and the
faithful translation widens the field rather than coercing the assignment. Coercion would make
the exported app disagree with the graph about what the port sends; it is also mechanically out
of reach, because the body is re-hosted **verbatim** — the same ruling that shims `__p`/`__s`
rather than stripping them (EXP-003 §4), for the same reason: rewriting an assignment inside
generated code needs an AST.

### 12b — The mapping, and where the condition is read from

`WorkspaceCensus.emptyOutputWrites` — the subset of `outputWrites` whose `set output` block has
an empty value socket, i.e. **the generator's own condition, restated**. It is read off the
**workspace**, not mined out of `generatedCode`, for the reason `variables` is: the workspace is
the authored artefact and the code is its projection.

- A shadow in the socket **counts as plugged in**. `valueToCode` resolves the socket's *target*
  block, and for a shadow-only connection the target is the shadow, which generates code. A
  census reading only `.block` would call that empty and widen a port that never takes null.
- The plan widens `${declared} | null` for exactly those names, in the `kind === 'visual'` branch.
- **An already-`any` port is left alone.** `any` admits null, and `any | null` is `any` — the
  widening would be noise carrying no information.

Three surfaces take it, and the wrapper's own comment names the block so the reader can go and
plug it in:

```ts
// `result`: a `set output` block below has an empty value socket, which
// the block editor generates as a literal `null` — so the type admits one.
function blocks(Inputs: Record<string, never>): { result?: number | null } {
  const Outputs: { result?: number | null } = {};
```

…and §4f's materialized last-run state builds its type from the same output list, so
`useState<{ result?: number | null } | undefined>()` follows. That is the second surface, and it
has its own test: a narrow state row would put the error back one hop downstream.

⚠️ **This is an under-approximation, and deliberately so.** A *filled* socket can still evaluate
to null at runtime — `Outputs["title"] = Noodl.Variables["lastEntryTitle"]` is the corpus case,
in `tut003`. Those paths reach the field through the `Noodl.Variables` facade, which is `any` on
both sides by EXP-003 §4's own ruling, so they neither fail to typecheck nor need widening. The
list here is the set that is **null by construction**, which is the set that needs the type.

### 12c — What it bought, same instrument both sides

`scripts/build-corpus.ts` over all 40 projects; the before column is s23's after-run, byte for
byte, on the same harness copy.

| | before (s23) | after (s24) |
|---|---|---|
| projects that typecheck | 27 / 40 | **35 / 40** |
| total diagnostics | 51 | **35** |
| visual-function diagnostics (TS2322 on `Outputs[…]`) | **16** | **0** |

All eight clone projects now typecheck. **Nothing new surfaced** — §11c warned that clearing one
cause can reveal another it was hiding, and here it did not, because s23 had already cleared the
*syntax* errors that were suppressing the semantic pass. The remaining 35 diagnostics are
§11d(2)–(6) unchanged, over five projects.

Coverage is **byte-identical to sessions 21–23 — 3,766/4,441, 84.80%** — as it must be: this
retires no node, it makes an already-translated one compile. The ranking is unchanged from
`rank2-s23.txt`. **419 tests (8 new).**

### 12d — 🔴 The fixture said one thing and the artefact said another

`GUARD_WORKSPACE` in `visual-function.test.ts` is documented as "`tut003`'s program", and it used
the bare `setOutput('message')` helper — **an empty socket**, while `tut003`'s real workspace has
both of its sockets filled. The fixture and the artefact it claimed to be had disagreed since
session 19, and nothing noticed, because until this session the difference generated no code the
tests read.

The tell was that adding the widening turned that fixture's wrapper into `{ message?: string | null }`
and broke a test asserting the *tight* type. The wrong fix was to update the expectation; the
right one was to fill the sockets, because the fixture is the thing that was wrong. It now uses
`setOutputTo(name, valueBlock)`, `setOutput` carries a doc comment saying the two are **not
interchangeable**, and reverting either socket kills exactly one test.

**Build the negative control into the helper names.** `setOutput` vs `setOutputTo` is a
one-difference pair that a reader cannot use by accident; a single `setOutput` with an optional
second argument would have left the empty case as the default, which is how it got here.

### 12e — What is left after this

**5 projects, 35 diagnostics, five causes** — §11d's list with (1) struck out:

1. **A component reading a prop it never declared** — 18 diagnostics, 2 projects
   (`ecommerce-example`, `ecom-responsive-probe`, both `ProductCard.tsx`). Now the largest by
   both measures.
2. **Props passed to a component that declares none** (`IntrinsicAttributes`) — 7 diagnostics,
   `phase55-replay-haiku`. The parent's end of (1): the same missing `Component Inputs` node.
   Scope them together.
3. **`void` into `ReactNode`** — 2 diagnostics, travelling with (1).
4. **`number` into a `string` prop** — 4 diagnostics, 2 projects.
5. **`readonly unknown[]` into a `string` prop** — 1 diagnostic, 1 project.

Closing (1)+(2)+(3) would take the corpus to **38/40**; only the two `string`-prop causes would
remain.

## §13 The missing interface, diagnosed (session 24 — §12e(1)+(2)+(3), designed, not built)

§11d called the next item "a component reading a prop it never declared", which reads as though
the export invented the read. **It did not.** One pass over the corpus reframes all three items,
and the reframing changes what the fix is.

### 13a — Both ends are one authoring defect, and the export is right about the interface

The editor derives a component's interface in `ComponentModel.getPorts()` (`componentmodel.ts`),
and **it inverts the plug**: a `haveComponentPorts` node's *input* ports become component ports
plugged `output`, and its *output* ports become component ports plugged `input`. That inversion is
correct — on the `Component Inputs` node a port is an output (it feeds the graph); on an
*instance* of the component the same port is an input (the parent sets it).

Against that, the corpus:

| `Component Inputs` node ports | count |
|---|---|
| plugged `output` (correct) | **714** |
| plugged `input` | **22** — all of them one component, cloned into two projects |

`Component Outputs` ports are 342, all `input`, with no exceptions. So the 22 are anomalous by a
factor of thirty, and `ecommerce-example` / `ecom-responsive-probe` are one mis-authored
`ProductCard` counted twice. Under `getPorts()` those 11 ports surface as component **outputs**,
so the component advertises eleven outputs and **zero inputs**: in the running app nothing arrives
and the card renders blank. `plan.props` is empty because the interface *is* empty.

`phase55-replay-haiku` is the same defect from the other end — `ProductCard` and `CategoryCard`
have **no `Component Inputs` node at all**, and `FeaturedProducts` / `BrowseCategories` place them
with six and two parameters each.

⚠️ **The two ends never meet in one project.** `ProductCard` is never instantiated in either
ecommerce project, and `phase55-replay-haiku`'s cards are never read from inside. §11d(3) called
them "the same thing seen from two ends" — true of the *defect*, but not of any single artefact,
so a fix has to be written and tested twice.

### 13b — The ruling: refuse and name it, do not infer the interface

The tempting fix is to mint the props from the wires, so `ProductCard` renders. **That would make
the export disagree with the runtime**, which is the one thing this phase does not do: the port
does not exist, nothing is delivered, and the faithful emission is the *absence* of the binding
plus a note saying why — not a bare identifier that happens to compile if you squint.

So: **a read or a write of a component port the interface does not declare is dropped with a named
note**, at the two sites that mint it —

| end | site | today |
|---|---|---|
| child | `resolveExpr` (`Component Inputs` → `{kind:'prop'}`) and the binding loop | emits `{image}`, TS2304 |
| parent | `targetPropName`, three call sites in `emit/component.ts` | emits the attribute, TS2322 `IntrinsicAttributes` |

`targetPropName` is already the designated seam: session 23 left a comment there saying a port the
target does not declare "is §10d(2)/(3)'s question, not this one's". This is that question.

### 13c — 🔴 The census's population was not the emitter's, and it showed

The parent-end census counted every `node.parameters` entry on a component instance and found
**36** undeclared attributes. The emitter writes **30**. The six-attribute gap is
`phase55-replay-sonnet`'s `</Cards/Category Card> minWidth` and `width` — **layout parameters the
style path consumes, which never reach the JSX at all.** That project typechecks today, and a
refusal keyed on the census as first written would have dropped six attributes that are already
correct.

The tell was arithmetic: 30 emitted attributes over 7 JSX elements is exactly the 7 `TS2322`
diagnostics (TypeScript reports `IntrinsicAttributes` once per element, not once per attribute),
while 36 matches nothing. **A census of what the graph contains is not a census of what the
emitter writes**, and the gate has to be keyed on the second. Re-run `ifaces.ts` against the
emitted files, not the IR, before touching `targetPropName`.

## §14 The missing interface, closed (session 25 — §13 built, both ends)

§13's ruling, implemented at four sites and measured on the emitter's own population. The corpus
goes **35/40 → 38/40 projects typechecking**, and **35 → 4 diagnostics**. Coverage is byte-identical
to sessions 21–24 (**3,766/4,441, 84.80%**), as it must be: this retires no node, it removes
emissions that never had a runtime behind them. `rank2-s25.txt` is byte-identical to s22/s23/s24.

### 14a — The refusal, at both ends

**Child end** (`plan.ts`). One predicate beside the prop list — `declaresProp`, plus one reason
string spelled once — and two read sites use it:

| site | before | after |
|---|---|---|
| `resolveExpr`, the `Component Inputs` branch | `{kind:'prop', name}` for any port | `ctx.defer` names the port; the reading node defers with the reason |
| the binding pass (`fromNode.type === 'Component Inputs'`) | recorded the binding | `consumed` + a named note, so pass 6 does not re-report it vaguely |

The reason distinguishes the two authoring defects, because their fixes differ: *"declares no
component inputs at all"* (every port plugged backwards, or no node) versus *"is not one of this
component's declared inputs (`text`)"* — one port plugged the wrong way while its siblings are
right. The second wording lists what the component **does** declare, which is the shortest route
from the note to the editor.

**Parent end** (`emit/component.ts`). `targetPropName` now returns `string | null`, and its three
call sites (literal parameter, wire binding, popup slot) drop and name. The repeater's row
attributes went the same way: `templateProp` became `rowAttrs`, one place instead of four
`.map`s. The note is one helper, `undeclaredAttrNote`, so all four sites say the same sentence.

### 14b — What the corpus does with it

Nine emitted files change, in exactly the three projects §13 named, and **nothing in the other 37
moves** — measured by emitting all 40 projects before and after into two trees and diffing them,
not by re-reading the census.

- **`phase55-replay-haiku`** — **30** attributes dropped across 7 elements (3 × 2 on
  `CategoryCard`, 4 × 6 on `ProductCard`), matching the emitted-population figure §13c derived and
  not the graph's 36. `<CategoryCard categoryName="Ceramics" itemCount="126 pieces" />` becomes
  `<CategoryCard />`.
- **`ecommerce-example` / `ecom-responsive-probe`** — 12 wires each dropped, and the card falls
  back to **its authored parameters**: `{name}` becomes `Product name`, `{price}` becomes `0`.
  That is the faithful reading, and §14c is why.
- `.module.css` loses `.hiddenKeepSpace` in both, because the only conditional class was
  `!badge && …` — a refused read takes its dependents with it.

**Remaining: 4 diagnostics, 2 projects**, both type mismatches, both static-data rows into a
`string`-declared prop:

| project | line | mismatch |
|---|---|---|
| `leg001-comment-measure` | `CategoryBrowse.tsx:44`, `FeaturedProducts.tsx:110` | `number` → `string` (`count`, `reviewCount`) |
| `phase58-awp006-deepseek` | `Home.tsx:16` | `number` → `string` (`basketCount={3}`) |
| `leg001-comment-measure` | `SiteFooter.tsx:155` | `readonly unknown[]` → `string` (`links`) |

### 14c — Why the export may not mint the prop, checked against the runtime

`componentinputs.ts` registers each output as a **getter over the owner's
`_internal.inputValues`**, flushed only when the owner sets an input. A port the interface does
not publish is never set by any instance, so nothing is ever sent down the wire and **the sink
keeps its authored parameter** — which is precisely what the emitted card now renders. Minting
`ProductCard`'s eleven props from its wires would have made the card render *data*, and the
running app renders *placeholders*. The refusal is not a limitation being confessed; it is the
agreement being kept.

### 14d — 🔴 The hazard §13c warned about is structurally absent at the emit site

The six-attribute gap between the graph census (36) and the emitter (30) is
`phase55-replay-sonnet`'s `minWidth`/`width` on `</Cards/Category Card>`, and the mechanism is
one line: `instanceAttrs` only pushes `param.value.kind === 'literal'`, and those two parameters
parse as **`{kind:'dimension'}`**, which the style path consumes. So a refusal keyed at the emit
site *cannot* reach them, whatever the census says. Reading the mechanism is worth more than
re-keying the instrument: the instrument tells you the number is different, the mechanism tells
you the difference cannot bite.

The before/after emit-tree diff is the check that this reasoning is not just plausible: 9 files,
3 projects, 0 collateral.

### 14e — Two branches that turned out to be dead, and one gate that already existed

- The "target with no plan ⇒ keep the bare mapping" fallback, written first as the cautious
  reading of §13b, is **unreachable**: every site that mints an attribute has already gone through
  `requireInstance`, which drops the element whole when the target exports no component. Removed;
  the emit trees before and after removal are byte-identical, which is how it was confirmed rather
  than argued.
- 🔴 **The popup path already implemented this ruling.** `plan.ts`'s Show Popup translation builds
  `targetInputs` from ports plugged `output` and drops a param that names no input, with a note —
  POPUPS-TARGET got there first. So the popup call site's refusal is a second gate on a population
  the first already filtered. It stays as the `null` arm the type demands, not as a check anything
  reaches. **Read the sibling pipeline before writing a gate: this one had a working precedent
  three sites away, and the other three sites had gone without it for fifteen sessions.**

### 14f — Tests (9 new, 428 total)

`tests/missing-interface.test.ts`, on the `cheer` fixture, mutated two ways whose helper names
carry their own control: `plugComponentInputsBackwards` (the ecommerce defect — the node is
there, the plugs are inverted) and `deleteComponentInputsNode` (the haiku defect — no node, and
its wires go with it, as the editor's own delete does).

Both ends are pinned separately, because in the corpus they never meet; in the fixture they do,
which is what lets the parent-end and child-end refusals be shown composing on one component. Two
control tests assert the *un*mutated fixture still reaches all three surfaces and refuses nothing
— an absence beside a known-firing signal.

Mutation-checked, and the two halves are disjoint: forcing `declaresProp` true fails exactly the
2 child tests; restoring the parent-end fallback fails exactly the 4 parent tests. The controls
survive both, as controls must.

## §15 The type the port never claimed (session 26 — §11d(4)+(5), closed; **40/40**)

The corpus's last four diagnostics were all "X is not assignable to `string`", and every previous
session's list read them as a type *mismatch* — a number reaching a string port, to be settled by
asking whether the runtime coerces on delivery. That framing was wrong, and one measurement before
any code retired it: **none of the four ports declares `string`.** All four declare `*`.

The mismatch was the emitter's own claim being contradicted by the graph. There was nothing to
coerce, because nothing had ever been promised.

### 15a — What a port actually declares, measured before deciding

`probe26.ts` reads the declared `type` of every Component Inputs output port in the corpus:

| declared type | ports |
|---|---|
| **`*`** | **471** |
| `string` | 224 |
| `number` | 10 |
| `boolean` | 5 |
| `image URL` / `text` / `icon` | 4 |
| **total** | **714** |

`*` is **two thirds of every component prop in the corpus**, and `tsTypeOf` sent all of it through
a `default:` branch to `string`. The four failing sites are ordinary members of that majority —
`CategoryCard.count`, `ProductCard.reviewCount`, `FooterColumn.links`, `NavBar.basketCount`, each
authored `*`.

### 15b — Why `*` is "untyped", from the sources

Three readings, and they agree:

1. **The editor writes it when nobody chooses.** `componentinputs.ts` gives the node its PortEditor
   panel with `type: { name: '*' }` — the type a new component input is born with.
2. **`*` is normatively the wildcard.** `PORT-TYPE-CONTRACT.md` describes "an untyped Function
   output defaulted to `*` and **connected anywhere**", and rejects option B — *making `*` the
   honest default* — as a direction, which only makes sense because `*` already means untyped.
3. **A port type is free text.** `AiAssistant/authoring/plan.ts:181` documents the field as
   *"What kind of value it carries (\"string\", \"number\", \"an image URL\") — free text, names
   are what bind"*. There is **no closed vocabulary**, so there is no set of "the string-valued
   type names" to fall through to a default with. `image URL` is not a registered editor type; it
   is that description's own example, written into projects by AI authors following it.

And nothing coerces on delivery, which is what would have made the old mapping true anyway:
`componentinputs.ts` registers each output as a bare getter over `_internal.inputValues`, and the
single cast on a connection — `node.ts`'s `_setValueFromConnection` — is `object`/`array` →
`string`, guarded on the **source** port being declared `object`/`array`. A number arriving at a
component input arrives as a number.

**So the ruling is §12's, one level up:** the declared type is a claim about the port, not a check
on what reaches it — and a port that declares nothing must have nothing claimed for it.

### 15c — The change, and the one line that would have made it a disaster

```ts
case 'string':
  return 'string';   // ← 224 ports reached their type through the OLD default
…
default:
  return 'any';
```

`any` and not `unknown`, for the reason the `array` case beside it already gives and the reason
**both sibling mappers in this same file already default to `any`**: `jsOutputTsType`
(*"`any` is the honest type of an untyped runtime delivery — `unknown` would fail the emitted
app's tsc"*) and `valueTsTypeOf`, whose doc comment cites **§10 by name**. `tsTypeOf` was the odd
one of three. 🔴 **The ruling had already been written twice in this file; only one site had not
implemented it** — the same shape as §14e, one session later.

⚠️ The explicit `case 'string'` is the whole risk of the change. `string` reached its type through
the branch being replaced, so folding it in would have widened all 224 genuinely-typed ports along
with the 471 untyped ones. It has its own test, and that test is the row that goes red.

### 15d — What it bought, same instrument both sides

`scripts/build-corpus.ts` over all 40 projects, before-column taken this session from the working
tree at HEAD:

| | before (s25) | after (s26) |
|---|---|---|
| projects that typecheck | 38 / 40 | **40 / 40** |
| total diagnostics | 4 | **0** |

Exactly the two failing rows moved — `leg001-comment-measure`, `phase58-awp006-deepseek` — and
none of the other 38 regressed. Coverage is **byte-identical to sessions 21–25** (3,766/4,441,
**84.80%**) and `rank2-s26.txt` is byte-identical to s22–s25: this retires no node, it stops the
emitter contradicting the graph.

**The corpus now typechecks end to end** — the goal §10c's grader was built for, seventeen
sessions and five causes ago.

### 15e — The blast radius, measured on the emitter's population

`dumpall.ts` into two trees, `diff -ru`. **96 files change, and the diff is 471 lines against 471:**

- **468** are one prop declaration each, every one `string;` → `any;`.
- **3** are `__NOTES__.txt` lines that quote the type name inside an unchanged sentence
  (*"items are fed by a source not statically typed as a list (`string`)"* → `(any)`).
- **Zero JSX, zero logic, zero CSS.**

🔴 **That last line was a prediction that nearly went the other way, and it is worth the ink.**
`plan.ts`'s **format-collapse gate** reads exactly this type: a Text whose format is a single
placeholder collapses to the bare expression `{count}` only when `exprTsType(...) === 'string'`,
and otherwise emits `` {`${count}`} ``. Widening a prop to `any` therefore *can* change emitted
markup, not merely types. It changes none here — the corpus's format sites all carry surrounding
text (`` {`${breed ?? ''} · ${age ?? ''}`} ``), so `parts.length === 1` never coincides with a
wildcard prop.

**This is a bound from the corpus, not a guarantee from the mechanism.** A project with a Text
whose whole format is `{someWildcardProp}` would emit a template literal where it used to emit a
bare read — and that is the *more* faithful of the two, because the runtime's placeholder
substitution always produces a string, which is why the gate is conditioned on `string` in the
first place. The old mapping had been collapsing untyped props on a promise it could not keep;
for an array-valued one the two forms genuinely differ (React joins `['a','b']` to `ab`, the
template literal to `a,b`).

### 15f — Tests (8 new, 436 total)

`tests/port-types.test.ts`. Both primary cases are **real fixture artefacts, not mutations**:
`puppy-test-3`'s `BenchProbe` authors all seven ports `*`, and `cheer`'s `NoteRow` authors both
`string` — so the change and its negative control are each read off a graph somebody actually
built.

`retypePort` moves the declared type and **nothing else** — not a wire, not a caller's parameter,
not the name — and throws when it matches no port, so a mutation that hit nothing cannot leave a
vacuous assertion behind. The discriminating pair runs both directions on the same fixture:
declaring a wildcard `string` narrows exactly one row and leaves its siblings identical; declaring
a `string` port `*` widens it. A mapping that read the *feed* rather than the declaration — the
reading §10 refused — would not move under either.

Mutation-checked against HEAD's mapping: the **5** tests asserting the new behaviour go red, and
the **3** negative controls (`string`, `number`/`boolean`, `array`) stay green on both sides,
which is what makes them controls rather than a second opinion.

### 15g — What is left

The compilation work is done; everything remaining buys **coverage**.

1. **The reactive Condition** — 3 nodes / 3 projects. Gates the three remaining `User` nodes (the
   auth-gate idiom) and retires ~6 nodes. Now the top of the list.
2. **Relation verbs + `DbModel2`** (3 nodes, 1 project) — §4c is written for it already.
   `RemoveDbModelRelation` has **zero corpus instances**.
3. **EXP-003 Tier B** — ~350 nodes, one third-party kit copied into eight projects, behind four
   things that do not exist. `tb-survey.ts` dumps every body of it; read that before committing.

🔴 **And a standing caution now that the corpus is green:** `build-corpus.ts` can no longer tell
anyone anything by moving. A grader pinned at 40/40 reports "no regression" and "no progress" with
the same number, so the *next* slice's evidence has to come from `coverage-audit.ts` and the emit
trees, not from the row count. The instrument that closed five causes is now a floor, not a needle.

## §16 The reactive Condition (session 27 — §15g(1), closed; **coverage moves again**)

Built in **EXP-002-LOGIC-TARGET-OUTPUT.md §10–§12** — the design, the gates, the traps and the
tests all live there, because it is the Condition's slice and this node's other half was already
written up as §3 of that file.

The one-paragraph version: a Condition whose box is ticked and whose `Evaluate` nobody wires
re-tests on every arrival and fires one arm, which is a re-run keyed on a value — a `useEffect`
around the **same `branch` action** §3 already compiles. One `compileConditionBranch` behind two
gates; a node that does both (ticked *and* `Evaluate` wired) defers, because neither shape carries
it alone.

**Coverage 3,766/4,441 (84.80%) → 3,775/4,441 (85.00%)** — the first movement since session 21,
and the first slice in six sessions whose result is a coverage delta rather than a compile fix.
All nine are the predicted set: the `Condition`, the `net.noodl.user.User` it gated, and the one
`RouterNavigate` its arm drives, across the three auth-gate projects. `build-corpus.ts` holds at
**40/40** and the emit diff is bounded to those three projects (9 files, 66 lines). 446 tests.

🔴 **The handoff's count was low, and one measurement fixed it.** §15g said "3 nodes / 3
projects". `probe27.ts` found **15** Conditions in the corpus in three distinct shapes — nine
`has_reviews` comparators and one `hasName` already collapsing through the value pass, two
Evaluate-only handler chains, and only then the three reactive auth gates. The deferral *tally*
was right; reading it as the node population was not. **A rank row counts what deferred, never
what is there** — the population and the deferral list are different questions, and the slice's
real blast radius is the first one.

🔴 **And the probe lied first.** Its initial version printed `fromProperty` on both ends of an
incoming wire, so every `IN` row named the source port twice — `condition` never appeared, and the
`eval` wires read as `onClick`. It was caught by the rows looking wrong rather than by anything
structural. **A new instrument's first output is a claim about the instrument**; the shapes only
became readable after fixing it.

### §16a — What is left

⚠️ **Superseded by §17d.** Item (1) below was measured in session 28 and buys **no coverage** —
and with it the standing claim that everything remaining does. §17b is the map that replaced this
list; read it before picking anything here.

Unchanged from §15g except that (1) is closed. Everything remaining still buys coverage, and
`build-corpus.ts` is still a floor rather than a needle.

1. **Relation verbs + `DbModel2`** (3 nodes, 1 project) — §4c is already written for it.
   `RemoveDbModelRelation` has **zero corpus instances**, so it is target-output-only. Now the
   top of the list.
2. **EXP-003 Tier B** — ~350 nodes, one third-party kit copied into eight projects, behind four
   things that do not exist. `tb-survey.ts` dumps every body of it; read that before committing.
3. **The two `ProductCard` projects' missing interface** (§11d(2)/(3)) — ruled in §13b and built
   in §14: the export refuses and names it. That is the disposition, not a defect to fix.

The nine `has_reviews` Conditions are **already translated** (they collapse into the `isfalse →
Text.visible` binding), so the Condition node is now fully covered in the corpus — no shape of it
defers anywhere. `probe27.ts` is the instrument that says so.

## §17 The relation verbs (session 28 — §16a(1); **the slice that buys no coverage, and why that is the result**)

§16a put *"relation verbs + `DbModel2` (3 nodes, 1 project)"* at the top of the list under the
standing claim that **everything left buys coverage**. That claim is now false, and this section
is the measurement that retired it.

**Coverage 3,775/4,441 (85.00%) → 3,775/4,441 (85.00%).** `build-corpus.ts` holds at **40/40**,
the ledger is unchanged (175 types: 101 deferred / 58 translated / 1 stubbed / 15 backend-only —
no node type changed category, because none became translated). **468 tests (22 new).** What
landed is three `logic node (…)` catch-alls replaced by the verdict the *runtime* reaches, and
one hole closed.

### 17a — 🔴 The corpus's only Add Record Relation can never have worked

`Puppy test`'s `linkPuppy` authors exactly one parameter: `collectionName: "Inquiry"`. It names
**no `relationProperty`**. `dbmodelnode-addrelation.ts`'s `validateInputs` reaches that check
second, answers `'No relation property specified'`, hands the verdict to `setError` — and
`scheduleAddRelation` returns before `cloudstore.addRelation` is ever called. There is no default:
`_addRelationProperty` registers the input, `recordRelationPorts` declares the dropdown with no
`default`, and `_internal.relationProperty` is assigned only in `setRelationProperty`.

So the node **fails on every pulse, for the life of the graph**. Translating it into a working
`addRelation` call would have been a hole shaped exactly like the defect — which is gate 1's rule
(§5.1) reaching a second node type rather than a new rule of its own. §4c's target output stands
as written; what it lacks is not a design but a well-formed instance to build against.

The two nodes beside it fall out of that, and neither is a defect either:

- **`NewDbModelProperties createInquiry`** wires `Id` into the relation verb, which is **gate 11**.
  It was already deferring for that reason before this session.
- **`DbModel2 puppyModel`** reads its Id from a `PageInputs` on `Pages/Puppy Detail` — a component
  with **no `Page` node that the Router does not list**. There is no route, so there is no URL,
  so there is no path parameter to read. Inventing one would be fabrication.

`RemoveDbModelRelation` still has **zero corpus instances**. It is gated identically here anyway,
because a gate that exists only where it is exercised is the hole this phase keeps paying for.

### 17b — The wall census: what the remaining 15% is actually made of

`rank2.ts` answers *"which type defers most"*. That is not the question that decides whether
anything is left to build, so `walls.py` was written to ask the other one — **which wall would a
slice have to break** — over all 666 deferred nodes, with the total reconciled against the audit's
own count and the residual printed in full:

```
  197   29.6%  script tiers (EXP-003 Tier B + the component-record tier)
  136   20.4%  row identity (the s10 wall)
  117   17.6%  outside the render — logic nodes and the router shell
   82   12.3%  collateral — its feed or its sink already deferred
   69   10.4%  wire-fed rendered structure
   36    5.4%  trigger outside the handler vocabulary
    9    1.4%  unknown type / editor debris
    8    1.2%  no shape in the api stub / emit vocabulary
    7    1.1%  translated behind a typed api stub (not a wall at all)
    5    0.8%  named runtime refusal — the node always fails as authored
```

**The top three hold 450 of 666 — 67.6% — and none of them is a slice.** The corpus is close to
the ceiling reachable by node-at-a-time work: the next real movement costs a wall, not a node.

The second row is this session's other measurement. **All 72 `Model2` nodes are
`idSource: "foreach"`** — nine distinct instances cloned across eight projects, every one bound to
the enclosing repeater's row. The largest non-Tier-B row in the ranking is one wall, not a
backlog.

### 17c — 🔴 Traps this session paid for

**A ranking row is not a slice, and a slice is not coverage.** Session 27 filed *"a rank row counts
what deferred, never what is there"* and the answer was a population. This session met the next
one along: `probe28` confirmed the population exactly (1 `AddDbModelRelation`, 1 `DbModel2`,
0 `RemoveDbModelRelation`), and the slice **still** bought nothing — because the population was
never the constraint. The count, the wall and the yield are three different questions, and a
handoff that names only the first is guessing at the other two.

**A mutant that kills nothing is a claim about the mutant.** Two of ten this session:

- Removing the sweep's `if (dispositions[node.id] !== undefined) continue;` guard killed nothing.
  Chasing why found the real hole: a component with **no visual root** dispositions every node and
  **returns early**, long before the sweep runs — so a relation verb there fell to `logic node (…)`
  anyway. The sweep looked complete and was not, and no coverage number could ever have said so,
  because nothing in the corpus exhibits it. Closed, with four rows that redden when it re-opens.
  The guard itself remains unreachable today and is kept deliberately: the moment a later slice
  teaches pass 4c about `DbModel2`, dropping it would overwrite `collapsed` with `deferred`.
- Removing the `DbModel2` row-identity gate killed nothing — because the anchor text
  `if (literalParam(node, 'idSource') === 'foreach' || authoredOrWired('repeaterComponent')) {`
  occurs **twice**, and the mutation hit `compileRecordOp` at line 2713 instead. Re-aimed by line
  number, each site kills its own row and they are *different* rows. **Mutate by line, or by an
  anchor you have counted.**

**Two control rows failed on first write, and both were the control's fault.** *"Adding the
relation graph moves nothing"* — it moves exactly one thing, the Create, to gate 11, which is the
corpus's own third deferral. And the catch-all control used `Counter`, which has a reason of its
own and never reaches the catch-all at all; `net.noodl.WebSocket` does. **A control that never
reaches what it controls for proves nothing.**

**An instrument's residual is where its errors live.** `walls.py` put 51 of 666 nodes in
`UNCLASSIFIED` on its first run — not because the corpus was strange, but because `rank2`
truncates every reason at ~95 characters and the patterns had been written against full
sentences, matching on tails that are not there. Printing the residual in full, and refusing to
run at all unless the totals reconcile against the audit, is what made that visible in one pass.

### 17d — What is left

1. **EXP-003 Tier B** — ~350 nodes, one third-party kit copied into eight projects, behind four
   things that do not exist. `tb-survey.ts` dumps every body of it; read that before committing.
   It is the largest wall and the only one whose size is mostly one artefact.
2. **Row identity (the s10 wall)** — 136 nodes, and now measured rather than assumed. Every
   `Model2`, every `SetModelProperties` beside them, the repeater output relays, and the
   `For Each.items` feeds. One wall, one design question: what a row's identity *is* in the emit.
3. **The two `ProductCard` projects' missing interface** (§11d(2)/(3)) — ruled in §13b, built in
   §14: the export refuses and names it. Still the disposition, not a defect.

⚠️ **Do not open the next session by looking for a node type to translate.** §17b is the map now:
pick a wall, or accept that 85.00% is where node-at-a-time work ends.
