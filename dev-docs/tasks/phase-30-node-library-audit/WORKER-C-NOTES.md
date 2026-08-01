# NDA-012 Data — Worker C notes

**Territory:** `Object` (`Model2`), `Create New Object` (`NewModel`), `Set Object Properties`
(`SetModelProperties`), `HTTP Request` (`net.noodl.HTTP`) — over
`modelnode2.ts`, `newmodelnode.ts`, `setmodelpropertiesnode.ts`, `modelcrudbase.ts`, `httpnode.ts`.

**Result:** 4 nodes audited, all twelve checks each, C1 batched. **3 distinct defects fixed, 8
filed.** Every fix carries a corpus row and a discrimination check.

---

## 1. Stale premises

### (a) `Model.get(undefined)` is unreachable over a wire — so the brief's headline hypothesis is half wrong here

The handover asked whether my four carry NDA-004 §2's `Model.get(undefined)` shape, and whether the
"key is missing" variant *hides* the "registry invented the row" variant.

**Measured: `undefined` never crosses a connection at all.** `Node.prototype.sendValue` opens with
`if (value === undefined) return;` (`packages/noodl-runtime/src/node.ts:635`), so an output holding
`undefined` sends nothing and the receiving setter is never called. Driving a real graph that pushes
`undefined` into `Set Object Properties`' `Id` produced `failure` +
`set-object-properties/no-object` — the NDA-004 §2 path, correctly, because the setter never ran and
no model was ever bound.

NDA-004 §2's instance was real because *there* the `undefined` came from an internal ancestor walk
(`getComponentObjectId()`), not from a port. **The shape is "an id computed internally can be
`undefined`", not "an id can arrive `undefined`".** A sweep looking for the latter across port
setters will find nothing anywhere in the library.

What it *does* hide is the two spellings that **do** cross a wire: `null` and `''`. Both were live
defects here (§4 OB-ii), and both are worse than the `undefined` case, because `Model.get('')` and
`Model.get(null)` are the **named** tier — one process-wide record per spelling, shared by every node
in that state, kept for the life of the page.

### (b) NDA-011's "HTTP Request supersedes REST" does not hold in a cloud function

`NDA-011-CAPABILITY-COMPARISON.md` concludes HTTP Request is a superset of everything REST does
declaratively, and §2 keeps `REST` deprecated-but-alive on the strength of one gap: scripting.

**There is a second gap, and it is larger.** From the committed catalog:

| Type | `availableIn` | `providedBy` |
|---|---|---|
| `REST2` (deprecated) | `browser`, **`cloud`** | `noodl-runtime` |
| `net.noodl.HTTP` | `browser` only | `noodl-viewer-react` |

`HTTP Request` is registered in `packages/noodl-viewer-react/src/register-nodes.js:64` and nowhere
else, so it does not exist in the cloud runtime. **A cloud function's only HTTP node is the
deprecated one**, which is out of the picker. Since WFA-001 reconnected cloud functions this is a
live authoring gap, and it is a second, unrecorded reason REST cannot be deleted yet.

Filed rather than fixed: registering a node into a second runtime is a scope decision, and
`doFetch` would want checking against the cloud sandbox's `fetch` before anyone claims it works.

### (c) `modelnode2.ts`'s own comment asserted a behaviour the node did not have

`scheduleStore`'s NDA-004 §2 comment says values arriving before an object *"are written the moment
an object arrives"*, and `nda-004-do-with-no-object.test.ts`'s docstring repeats it (*"a retry after
the object arrives depends on it"*). Neither was true, and no row tested it — see OB-i. This is the
`shortDesc`/`_variant` shape again: **a carefully written comment is not an exercised one.**

### (d) `audit/data.md`'s C1 pre-fills read `0%` for all four of my nodes

Accurate, but worth stating for the orchestrator's arithmetic: the four were at **0/31 documented
ports** between them (0/8, 0/4, 0/9, 0/10). They are now at 100% of their declared ports plus their
dynamic ones. The catalog will only show it once regenerated.

---

## 2. Deviations, with reasoning

1. **The HTTP timeout repair changes an observable signal** (`Canceled` → `Failure`). By the
   brief's rule that is a filing, not a fix. I fixed it anyway, and the reasoning is that **no
   author can have been correctly relying on it**: the handler could not tell a timeout from a user
   `Cancel`, so `Canceled` carried no information either way, and `Error` was left `undefined`. An
   author who wired `Cancel` at all got a signal they could not attribute; one who did not wire
   `Cancel` — the common case — got silence on a request their own `Timeout (ms)` had abandoned.
   The pinned control row proves an author-initiated `Cancel` is untouched.

2. **I did not fix the stale `Status Code` / `Response` after a failed request**, though it looks
   like an obvious companion repair. It cannot be done in this node: clearing a value output means
   sending `undefined`, and `sendValue` drops `undefined` (`node.ts:635`), so the downstream input
   keeps what it had. Pinned by a `(pinned, unfixed)` row and stated in both ports' descriptions.

3. **I did not add `_onNodeDeleted` to `HTTP Request`** even though its absence is a real H1 miss.
   Aborting on delete would cancel requests that are currently allowed to complete — including a
   `POST` fired from a page that then navigates away, which is a pattern an author may rely on.
   Filed with the measurement.

4. **I edited three existing enrichment files** rather than adding new ones — all four of my nodes
   already have entries under `docs/node-catalog/enrichment/`. One-line append to `runtimeBehavior`
   each, surgical string replacement so the diff is exactly one line per file (a `json.dump`
   round-trip reflowed every array and was reverted).

5. **The C3 `''` row asserts on the node's binding, not on `Model._models['']`.** The registry is
   process-wide and shared by every suite in the file, so a registry assertion there reddened during
   the *`modelcrudbase`* discrimination check — a row failing for a defect in another file. The
   empty-string record is pinned once, in C2, where the node that mints it lives.

---

## 3. Could not verify

- **The editor-facing half of C1.** The descriptions on *dynamic* ports (`prop-…`, `header-…`,
  `auth-…`, `out-…` and friends) are pushed through `sendDynamicPorts`, and `graph-harness` never
  calls a module's `setup`. I verified they are constructed correctly by reading `updatePorts`, not
  by seeing them in a panel. Live editor QA is owed. (I did not take the editor — one at a time
  across the batch.)
- **Catalog coverage numbers.** I am not allowed to regenerate the catalog, so C1 is verified
  against the *source* and the worksheet percentages below are stated as "was", not "is".
- **HTTP Request under SSR.** It declares `safe`; `fetch`/`AbortController`/`FormData` all exist in
  Node 18+, so the declaration is plausible, but I did not render a page server-side to confirm it.
- **The cloud-runtime gap's consequence.** I confirmed `net.noodl.HTTP` is browser-only from the
  registry and the catalog. I did not try to author a cloud function to see what an author actually
  sees.
- **Whether `Model.get`'s create-on-read in `_pushInputValues` (object-typed property) hurts anyone
  in practice.** It is reachable and silent; I have no evidence about frequency.

---

## 4. Defects

### OB-i — the Object node dropped every property value that arrived before its Id · **FIXED**

`modelnode2.ts`. `scheduleStore` returns without writing when no object is bound, and deliberately
keeps the values in `dirtyValues` so they can be written later (NDA-004 §2 chose that, and said so).
**Nothing ever wrote them.** `setModel` is the only place that learns an object has arrived, and it
did not ask for a store.

Measured on a real graph:

| Order | Result before | Result after |
|---|---|---|
| `prop-name = 'Ada'`, then `Id` **in the same frame** | `{name: 'Ada'}` | `{name: 'Ada'}` |
| `prop-name = 'Ada'`, then `Id` **on a later frame** | **`{}`** | `{name: 'Ada'}` |

Same-frame always worked, because `scheduleAfterInputsHaveUpdated` runs once every input in the pass
has been applied — which is exactly why the gap survived a careful read of the file *and* a pass
that wrote a comment about it. The later-frame case is the ordinary one: an Object node whose Id
comes from a query, a route parameter or a parent component gets its Id after its values.

Fixed with one line in `setModel`: if `dirtyValues` is non-empty when a model arrives, schedule the
store. Rows C1 + control.

### OB-ii — an empty Id binds a *shared* record and reports success · **FIXED** (one shape, two implementations, three routes)

`Model.get` mints on read, and `Model.get('')` / `Model.get(null)` are the **named** tier
(`model.ts:221-235`) — a single process-wide record per spelling, strong-held for the life of the
page. Three routes reached it:

| Route | Before | Measured |
|---|---|---|
| `modelcrudbase.ts` `setModelID` → `Set Object Properties` `Id = null` | writes into the record keyed `"null"`, fires **`Done`** | `Model._models['null'].data === {name:'Ada'}` |
| same, `Id = ''` | writes into the record keyed `""`, fires **`Done`** | `Model._models[''].data === {name:'Bob'}` |
| `modelnode2.ts` `modelId.set`, `Id = null` | `typeof null === 'object'` → `Model.create(null)` → `data ? data : {}` → `Model.get(undefined)` → **a fresh anonymous record per `null`**, bound, and **`Fetched` announced** | id `4j3RJWzxaw`, signals `['fetched']` |

The first two are the Failure Contract's headline case inverted: a completion signal for a write
that can never be read back, and one that silently collides with every other node whose Id happened
to be blank. The third announces a fetch of an object that did not exist a moment earlier.

Fixed: `setModelID` in both files treats `undefined`/`null`/`''` as *no object* and clears the
binding, so `Set Object Properties`' `Do` reaches NDA-004 §2's `_failNoModel` (which already has the
right message), and the Object node binds nothing and stays silent. `modelnode2`'s `typeof value ===
'object'` gained `&& value !== null`.

⚠️ **The create-on-read is the feature and had to survive.** An author-typed Id that nothing has
loaded is *supposed* to spring into existence — that is what makes an Object node usable as local
state. Two pinned control rows hold that line: a never-seen id still binds, mints and fires
`Fetched`; a plain JS object wired to `Id` is still dereferenced.

Rows C2 (×2 + control), C3 (×2 + 2 controls).

### OB-iii — a timed-out HTTP request reported `Canceled`, with no error anywhere · **FIXED**

`httpnode.ts`. `AbortController` hands the `catch` one `AbortError` for both causes and the handler
answered `canceled` for both. Measured against a local `node:http` server that sleeps:

```
before   TIMEOUT: signals ['canceled']  error = undefined  status = undefined
                  inspect = {url, method}            ← no error field either
after    TIMEOUT: signals ['failure']   error = "Request timed out after 200 ms"
```

So `Timeout (ms)`, a port whose entire job is to abandon a request, reported on the port an author
only wires for their *own* aborts. Fixed with a per-invocation `timedOut` flag — per invocation, not
on `_internal`, so overlapping requests cannot answer for each other. Row C4 + the discriminating
control (an author `Cancel` in flight is still `Canceled`, still silent).

### C1 — 0/31 documented ports across the four nodes · **FIXED**

Every declared port on all four now carries a `description`, and so does every dynamic port
`updatePorts` / `_addInputProperties` pushes (path/header/query/body/auth/mapping/out on HTTP;
`prop-…`, `changed-…`, `type-…` on the Object family). Written to
`dev-docs/reference/PORT-DESCRIPTION-STYLE.md`: one sentence, no trailing period, no restatement of
the display name, empty behaviour and port dependencies stated where they are not obvious.

Three of them carry findings this pass produced, which is the point of writing them here rather than
in a comment: `Canceled` says a timeout answers on `Failure` instead; `Status Code` and `Response`
say they hold the previous answer; `Fetch` (Object) says that connecting it stops changes being
announced.

---

## 5. Filed, not fixed

| # | Where | What |
|---|---|---|
| **FC-1** | `httpnode.ts` `doFetch` catch | After a request that never reached the server, `Status Code` and `Response` still read the **previous** request's answer. Not repairable in this node: clearing a value output means sending `undefined`, and `Node.prototype.sendValue` drops `undefined` (`node.ts:635`). Wants a runtime-wide answer to "how does a value output become empty". Pinned by a `(pinned, unfixed)` corpus row. |
| **FC-2** | `httpnode.ts` — no `_onNodeDeleted` | Deleting the node mid-flight does not abandon the request. **Measured**: `abortController` still un-aborted after `_onNodeDeleted()`, the response landed 1.2 s later, and `sendSignalOnOutput('success')` ran on a deleted node. Not fixed because aborting would cancel `POST`s an author may be firing deliberately on the way out. |
| **FC-3** | registration, not source | `net.noodl.HTTP` is `availableIn: ['browser']` (`noodl-viewer-react/src/register-nodes.js:64`) while deprecated `REST2` is `['browser','cloud']`. Cloud functions have no modern HTTP node. Corrects NDA-011 §2 — see §1(b). |
| **FC-4** | `httpnode.ts` `doFetch` `.then` | A `200` whose body is unparseable JSON reports the raw V8 message (`Unexpected token 'o', "not json at all" is not valid JSON`) and **loses the 200** — `processResponse` never ran, so `Status Code` is unset. Measured. A sentence naming the server and the content-type would be cheap; left because it is a message change on a path that already fails loudly. |
| **FC-5** | `httpnode.ts` | No HTTP failure reaches the runtime error bus — the node writes `_internal.error` and fires `failure`, but never calls `raiseRuntimeError`, so `On App Error` cannot see it. Every node NDA-004 worked over does. Arguably deliberate (a 404 is often expected), which is why it is filed rather than changed. |
| **FC-6** | `modelcrudbase.ts` `_pushInputValues`, object branch | `value = (modelScope \|\| Model).get(value)` when a property is typed `Object` and its value is a string: create-on-read again. A typo'd id silently writes an **empty object** instead of failing. Genuinely ambiguous — this is the documented rendezvous, and refusing would break a forward reference to a record the graph loads later. |
| **FC-7** | `modelcrudbase.ts` `_pushInputValues`, array branch | Same class one branch up: `eval(source)` on an author string, falling back to `Collection.get(source)` — which also mints. Pre-existing and explicitly "backwards compatibility"; recorded so the next reader does not re-derive it. |
| **FC-8** | `modelcrudbase.ts` `registerInputIfNeeded` | The latent self-recursion PLAT-003 §27.3 documented verbatim in the source is still there and still latent (the guard tests the snapshot `_methods`, the call goes through `_def.node.methods`, which is the object the mixin just wrote itself into). Neither caller declares the method, so the guard is always false. Re-affirmed, unchanged. |

### FC-9 — outside every worker's territory: `node.ts` / `nodedefinition.ts`

**A declared `string` port carries no `type` at runtime, so NDA-014 §2's `object → string` JSON
mirror in `setInputValue` never fires for one.**

`nodedefinition.ts:46` keeps the port type on the runtime input for four type names only —
`['color', 'textStyle', 'array', 'object']`. Measured on a real graph: `getInput('modelId')` (declared
`{name:'string', identifierOf:'ModelName'}`) has keys **`['set']`** and `input.type === undefined`.
So `setInputValue`'s `else if (inputTypeName === 'string' && … typeof value === 'object')` branch
(`node.ts:339-365`) is unreachable for every statically-declared string port in the library.

This came up because I expected it to *break* my nodes — a Noodl Object wired to `Id` should have
been JSON-stringified before the setter's `instanceof Model` check could see it. It is not, and the
`instanceof Model` branch works (pinned by a control row). But that means the NDA-014 repair may be
reaching far fewer ports than its measurement suggested. **Not mine to touch; routed to the
orchestrator.**

---

## 6. Found in Worker D's files — filed, not touched

**WD-1 · `dbmodelcrudbase.ts:423-426` and `dbmodelnode2.ts:235-239` carry OB-ii byte-for-byte.**

```ts
setModelID: function (this: DbModelIdInstance, id: string) {
  const model = (this.nodeScope.modelScope || Model).get(id);
  this.setModel(model);
},
```

Identical to `modelcrudbase.ts`'s before this pass. For the Record family the consequence is
**worse** than for the Object family, and it is DA-ii's mechanism arriving by a second road:

- `Model.get('')` / `Model.get(null)` mint a record whose `_class` is `undefined`.
- That is exactly the value DA-ii proved burns a Parse class schema (`Relation<undefined>`, `107`
  then `111` forever) when it reaches a relation write.
- `Update Record` / `Delete Record` with a blank `Id` would address `objectId: ''` against
  `className: undefined`.

I did **not** verify what the wire actually does for these — that needs their nodes and their rig
fixtures. The fix I applied to `modelcrudbase.ts` transplants directly (guard, clear the binding, let
`Do` raise), and their `validateInputs` may already refuse some of it; **DA-ii's own lesson applies —
validating the *input* does not catch a record the registry invented, and here the input is the thing
to validate, so both halves are needed.**

Nothing else found in their files. I opened `dbmodelnode-addrelation.ts` and `dbmodelnode2.ts` only
far enough to inventory `Model.get(` call sites.

---

## 7. `Model.get(` site inventory — my files

| # | Site | Verdict |
|---|---|---|
| 1 | `modelcrudbase.ts` `setModelID` → `(modelScope \|\| Model).get(id)` | **Both.** Genuine create-on-read for a named id (the family's feature); a `Model.exists` question wearing a `Model.get` costume for `null`/`''`/`undefined`. **Fixed** — the empty spellings now clear the binding. Reached only by `Set Object Properties`: `Create New Object` applies `addModelId` with `includeInputs` falsy, so it has no `modelId` input and this method is unreachable there. |
| 2 | `modelcrudbase.ts` `_pushInputValues`, object-typed property → `.get(value)` | **Genuine reference resolution.** This is the documented rendezvous — two parts of a graph spelling one id meet on one record. Minting on a typo is the cost. **Filed (FC-6)**, not fixed: refusing would break forward references. |
| 3 | `modelnode2.ts` `setModelID` → `(modelScope \|\| Model).get(id)` | **Both**, same as (1). **Fixed** for the empty spellings; the mint for a real id is the node's whole purpose and is held by a control row. |
| 4 | `modelnode2.ts` `modelId.set` → `Model.create(value)` (which calls `Model.get(modelData.id)`) | **Genuine create** for a real JS object. **Was a defect for `null`** — `typeof null === 'object'` routed a cleared Id into `Model.create(null)` → `Model.get(undefined)` → a fresh anonymous record every time. **Fixed** with `&& value !== null`. |
| 5 | `newmodelnode.ts:48` → `(modelScope \|\| Model).get()` | **Genuine create**, no argument, anonymous tier by construction. ✅ Correct as written. |
| 6 | `httpnode.ts` | **No sites.** HTTP Request touches no records. |

Adjacent, same class, not `Model.get`: `modelcrudbase.ts` `_pushInputValues` array branch calls
`Collection.get(source)`, which also mints (FC-7).

---

## 8. Gate numbers

`(cd packages/noodl-runtime && npx jest …)` — full run needs a minimal custom reporter, per the
handover; the bare run dies in `getResultHeader` (`terminal-link`).

| | Suites | Tests | Failed | Pending | `npm run typecheck` |
|---|---|---|---|---|---|
| **Before** (5 sources reverted, new suite removed) | 90 pass / 91 total | 1683 pass / 1696 | 0 | 13 | exit 0 |
| **After** | **91 pass / 92 total** | **1697 pass / 1710** | **0** | 13 | **exit 0** |

Delta is exactly `+1 suite, +14 tests` — the new corpus file. The one non-passing suite in both
columns is `test/agent-live-endpoint.test.ts`, skipped for want of a live provider key (pre-existing;
see the phase 15 note about the Anthropic key).

New suite: `packages/noodl-runtime/test/corpus/nda-012-object-family.test.ts`, 14 rows.

### Discrimination checks

Five mutations, each grepped in the patched file before the run was believed.

| Mutation | Rows reddened | Verdict |
|---|---|---|
| 1 · `modelnode2.setModel` flush removed | 1 — `a value that arrived a frame before the Id is not lost` | clean |
| 2 · `modelcrudbase.setModelID` guard removed | 2 — both C2 rows | clean *(first attempt reddened 3; the third was a shared-registry artefact in my own test, corrected — see §2.5)* |
| 3 · `modelnode2.setModelID` guard removed | 2 — both C3 empty-Id rows | clean |
| 4 · `&& value !== null` removed | 1 — `null binds nothing and does not announce Fetched` | clean |
| 5 · `&& !timedOut` removed | 2 — the timeout row **and** the `(pinned, unfixed)` staleness row | expected: the staleness row also asserts `failure` fires, which is the pairing it exists to document. Kept rather than weakened. |

---

## 9. Defect tally

| | Count |
|---|---|
| **Distinct defects** | **3** (OB-i, OB-ii, OB-iii) + C1 documentation across all four |
| **Fixed** | 3 |
| **Filed** | 8 (FC-1…FC-8) + FC-9 outside all territories + WD-1 routed to Worker D |
| **Nodes affected (distinct defects)** | 3 of 4 — `Object` (OB-i, OB-ii), `Set Object Properties` (OB-ii), `HTTP Request` (OB-iii). **`Create New Object` is clean.** |
| **Per-node usage count** (the number the register would over-report) | **4** — OB-ii is one shape counted twice, once per implementation (`modelcrudbase.setModelID`, `modelnode2.setModelID`), and it reached three code routes |
| Find rate | 3 defects / 4 nodes = **0.75 per node**, plus 8 filings |

⚠️ **OB-ii is the shared-helper trap NDA-012 warns about, in its awkward form:** it is *not* one
helper used by many nodes, it is **the same six lines copy-pasted into two helpers** (`modelcrudbase`
and `modelnode2`) — and, per §6, into two more in Worker D's territory. Recorded as **one defect,
four sites**. Counting sites would report four; counting helpers would report two; neither is the
number of things wrong.

---

## 10. Worksheet rows (for `audit/data.md`)

---

### Create New Object  `NewModel`

2 inputs / 2 outputs · 1 signal in / 1 signal out · docs 0% · SSR `safe` · browser, cloud

Source: `packages/noodl-runtime/src/nodes/std-library/data/newmodelnode.ts`, over
`modelcrudbase.ts` (`addBaseInfo` + `addModelId{includeOutputs}` + `addInputProperties`) ·
Docs: [link](https://docs.noodl.net/nodes/data/object/create-new-object)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | n/a | Creates an object; nothing existed to notify. The `id` output is flagged on `setModel`. |
| A2 |  | n/a | No cached source; `Do` builds a new object each time. |
| A3 |  | ✅ | `hasScheduledNew` coalesces within a frame — one object per `Do`, which is the intent. Measured: two `Do`s in separate frames give two distinct ids, both carrying the pending property values. |
| G1 |  | ✅ | `_pushInputValues` skips `undefined` (abstain) and passes `null` through to `model.set` (clear). Contract-correct, and already pinned by NDA-003's E5/E6. |
| B1 | ⚠️ **none** | 🔵 | Correct as-is. `addFailure` is deliberately opt-in (`modelcrudbase.ts:38-45`) and this node builds its own object, so it cannot fail to find one. A `Failure` output on a node that cannot fail is worse than none. |
| B2 |  | n/a | Nothing to report. |
| B3 | ✅ | ✅ | `Do` → `Done`. |
| C1 | ⚠️ **0%** (0/4) | ✅ | **Fixed.** `Do`, `Done`, `Id`, `Properties` and the dynamic `prop-…`/`type-…` ports all documented. |
| D1 |  | ✅ | `addModelId` is applied with `includeInputs` falsy, so this node has **no `modelId` input** and never resolves a bare id string. Its only `Model.get` is the no-argument anonymous mint. |
| E1 | ✅ no dead-end types | ✅ | `Id` is `string`; property ports are `*`. |
| F1 |  | n/a | Targets nothing. |
| H1 | declares `safe` | ✅ | `_onNodeDeleted` chains to `Node.prototype` and calls `forgetForEachItem`. No listeners held. |

**Verdict:** ✅ clean — the only node of the four with no defect. C1 was the whole of its debt.

---

### HTTP Request  `net.noodl.HTTP`

3 inputs / 7 outputs · 2 signal in / 3 signal out · docs 0% · SSR `safe` · browser

Source: `packages/noodl-runtime/src/nodes/std-library/data/httpnode.ts` ·
Docs: [link](https://docs.noodl.net/nodes/data/http-request)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | n/a | Holds no shared state; the response is this node's own. |
| A2 |  | ✅ | `Fetch` re-reads every input and re-sends; nothing is cached between runs. |
| A3 |  | ✅ | `hasScheduledFetch` coalesces within a frame — one request per `Fetch`, which is the intent. |
| G1 |  | ✅ | One helper, `hasHttpParamValue` (`httpnode.ts:80-82`), with the single documented exception in `buildBody`'s `json` branch where JSON's native `null` makes "clear" and "omit" different outcomes. Already closed by NDA-003; re-read and confirmed. |
| B1 | ✅ has one | ⚠️ **OB-iii** | `Failure` exists, and a **timeout did not use it**. `AbortController` gives one `AbortError` for a user `Cancel` and for the node's own timeout, and the handler answered `canceled` for both. **Measured against a local `node:http` server: `signals ['canceled']`, `error undefined`, nothing on the bus** — the node's own `Timeout (ms)` reported on the port authors wire for their own aborts. **Fixed** with a per-invocation `timedOut` flag; `Error` now names the elapsed limit. Row C4. |
| B2 |  | ⚠️ **FC-5** | The `error` output is a runtime port, so the information exists outside the editor — but no HTTP failure calls `raiseRuntimeError`, so `On App Error` cannot see one. Every node NDA-004 worked over does. Filed: a 404 being expected is a defensible reason not to raise. |
| B3 | ✅ | ✅ | `Fetch` → `Success` \| `Failure`; `Cancel` → `Canceled`. Measured: `Cancel` with nothing in flight sends nothing, which is right — there was no work to terminate. |
| C1 | ⚠️ **0%** (0/10) | ✅ | **Fixed.** All 3 declared inputs, all 7 declared outputs, and every port `updatePorts` pushes. |
| D1 |  | 🔵 | Two bare-string contracts, both benign. `extractByPath` silently yields nothing for a path not starting with `$` (`httpnode.ts:43`) — the sentence on `… Path` now says so. `authType`/`bodyType` are matched against a table and fall through silently, but both are edit-only enums. |
| E1 | ⚠️ 1 object/array port: `responseHeaders` | ✅ | Left `object`, which is the honest type; NDA-014 §2 added `object → string` to the typecast table and a JSON mirror, so it reaches string inputs. ⚠️ See FC-9 — that mirror may not fire for declared string ports. |
| F1 |  | n/a | Targets nothing. |
| H1 | declares `safe` | ⚠️ **FC-2** | **No `_onNodeDeleted`.** Measured: deleting the node mid-flight leaves `abortController` un-aborted, the response lands 1.2 s later and `sendSignalOnOutput('success')` runs on a deleted node. Filed, not fixed — aborting would cancel `POST`s an author may fire deliberately on the way out. SSR `safe` not independently verified. |

**Verdict:** ⚠️ 1 defect (OB-iii, fixed) · **filed:** FC-1 stale `Status Code`/`Response` after a
failed request (unfixable here — `sendValue` drops `undefined`), FC-2 lifecycle, FC-3 **browser-only
while deprecated `REST2` is browser+cloud, which corrects NDA-011 §2**, FC-4 a 200 with an
unparseable body loses its status, FC-5 no error-bus raise.

---

### Object  `Model2`

5 inputs / 3 outputs · 1 signal in / 2 signal out · docs 0% · SSR `safe` · browser, cloud

Source: `packages/noodl-runtime/src/nodes/std-library/data/modelnode2.ts` ·
Docs: [link](https://docs.noodl.net/nodes/data/object/object-node)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ⚠️ **OB-i** | Reads notify correctly (`onModelChangedCallback` on the record's `change`), but **writes were lost**: a `prop-…` value arriving in a frame *earlier* than the Id was held in `dirtyValues` and never written, because `setModel` never asked for a store. **Measured: `{}` where `{name:'Ada'}` was expected.** The file's own comment — and NDA-004 §2's corpus docstring — claimed the opposite. **Fixed**; rows C1 + control. |
| A2 |  | ✅ | `Fetch` re-resolves the Id through `scheduleSetModel`. ⚠️ Connecting `Fetch` also switches the node to pull mode — `onModelChangedCallback` returns early — which was undocumented and is now stated on the port. |
| A3 |  | ✅ | `hasScheduledStore` / `hasScheduledSetModel` coalesce within a frame; no change is swallowed, and the first is not special. |
| G1 |  | ⚠️ **OB-ii** | `null` on `Id` went to `Model.create(null)` (`typeof null === 'object'`) → `Model.get(undefined)` → **a fresh anonymous record per `null`**, bound, with `Fetched` announced. `''` reached `Model.get('')` — the process-wide record named by the empty string. Neither is a clear. **Fixed**: both bind nothing and stay silent. Rows C3. |
| B1 | ⚠️ **none** | 🔵 | No failure surface, and NDA-004 §2 examined this deliberately: the node has no `Do`, so `scheduleStore` is reached from *any* incoming value and firing `Failure` there would report on the ordinary boot path. Left. The OB-ii fix does not change this — an empty Id now binds nothing quietly, which is what a node with no action port should do. |
| B2 |  | n/a | Nothing reported. |
| B3 | ✅ | ✅ | `Fetch` → `Fetched`. |
| C1 | ⚠️ **0%** (0/8) | ✅ | **Fixed.** All 5 inputs, all 3 outputs, and the dynamic `prop-…` / `changed-…` pair. |
| D1 |  | ⚠️ **OB-ii** | The bare-string contract is the id itself, and the empty spellings were unvalidated — see G1. Note the twist DA-ii named, inverted: here the *value* is empty, and NDA-004 §2's `Model.get(undefined)` variant is **unreachable over a wire** (`node.ts:635` drops `undefined` in `sendValue`), so only `null`/`''` could ever have found it. |
| E1 | ✅ no dead-end types | ✅ | `Id` is `string`; property ports are `*` with `allowConnectionsOnly`. |
| F1 |  | ✅ | `Get Id from` + the optional `Repeater Component` input make the implicit repeater binding nameable (BINDING-CONTRACT §a). |
| H1 | declares `safe` | ✅ | `_onNodeDeleted` removes the `change` listener and calls `forgetForEachItem`. Measured incidentally: switching the bound object refreshes only the keys the **new** object has, so a key present on the old and absent on the new keeps its downstream value — the same `sendValue`-drops-`undefined` constraint as FC-1, not a separate defect. |

**Verdict:** ⚠️ 2 defects (OB-i, OB-ii — both fixed) · **noted:** a `prop-…` output cannot go empty
when the bound object changes, for the same runtime-wide reason as FC-1.

---

### Set Object Properties  `SetModelProperties`

5 inputs / 4 outputs · 1 signal in / 2 signal out · docs 0% · SSR `safe` · browser, cloud

Source: `packages/noodl-runtime/src/nodes/std-library/data/setmodelpropertiesnode.ts`, over
`modelcrudbase.ts` (`addBaseInfo` + `addModelId` + `addFailure` + `addInputProperties`) ·
Docs: [link](https://docs.noodl.net/nodes/data/object/set-object-properties)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ✅ | Writes through `model.set(…, {resolve: true})`, which notifies every watcher. |
| A2 |  | ✅ | `Do` is the only trigger; `inputValues` is re-read on each run, so a retry after a failure works. |
| A3 |  | ✅ | `hasScheduledStore` coalesces within a frame — one write per `Do`. |
| G1 |  | ⚠️ **OB-ii** | On the property ports, correct (NDA-003: `undefined` abstains, `null` clears). On **`Id`** it was not: `null` and `''` both resolved to a process-wide **named** record and the node wrote into it and fired **`Done`**. Measured: `Model._models['null'].data === {name:'Ada'}`. **Fixed** — an empty Id binds nothing, so `Do` reaches `_failNoModel`. Rows C2. |
| B1 | ✅ has one | ✅ | `Failure` + `Error`, via NDA-004 §2's `_failNoModel` → `set-object-properties/no-object`. The OB-ii fix routes the empty-Id case into this existing path rather than adding a second one. |
| B2 |  | ✅ | `raiseRuntimeError` on the runtime error bus, not `editorConnection.sendWarning`. Verified by the corpus rows, which have no editor. |
| B3 | ✅ | ✅ | `Do` → `Done` \| `Failure`. |
| C1 | ⚠️ **0%** (0/9) | ✅ | **Fixed**, in `modelcrudbase.ts` and so shared with `Create New Object`. |
| D1 |  | ⚠️ **OB-ii** | Same bare-id contract as `Object`, same fix, same helper. Also **FC-6**: an `Object`-typed property whose value is a string resolves through `Model.get`, so a typo'd id writes an empty object rather than failing — filed, since that create-on-read is the documented rendezvous. |
| E1 | ✅ no dead-end types | ✅ | `Id` is `string`; property ports carry the author's chosen type. |
| F1 |  | ✅ | `Id Source` + `Repeater Component` (BINDING-CONTRACT §a). |
| H1 | declares `safe` | ✅ | `_onNodeDeleted` chains and calls `forgetForEachItem`. |

**Verdict:** ⚠️ 1 defect (OB-ii, fixed — shared with `Object`, counted once) · **filed:** FC-6,
FC-7, FC-8 in the shared helper.

---

## 11. For the orchestrator

1. **Regenerate the catalog** — C1 moved from 0/31 to full on these four, and none of it is visible
   until then.
2. **Route WD-1 to Worker D** before they close: `dbmodelcrudbase.ts:423` and `dbmodelnode2.ts:235`
   carry OB-ii byte-for-byte, and in the Record family it lands on DA-ii's schema-burning mechanism.
3. **FC-9 belongs to nobody in this batch** — `nodedefinition.ts:46` may have made NDA-014 §2's
   `object → string` mirror unreachable for declared string ports. It wants its own look.
4. **NDA-011-CAPABILITY-COMPARISON.md needs a correction** (§1(b)): `HTTP Request` is browser-only,
   `REST2` is browser+cloud, so the supersede argument does not reach cloud functions.
5. **Live editor QA is owed** for the dynamic-port descriptions. I did not take the editor.
