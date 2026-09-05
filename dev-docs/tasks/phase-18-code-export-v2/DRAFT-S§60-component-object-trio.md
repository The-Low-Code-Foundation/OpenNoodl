## §60 Tier 2.8 row 10 — the component-object trio: `Set Component Object Properties`, `Parent Component Object`, `Set Parent Component Object Properties` — own record = local state, the parent pair = context (session 86, 2026-09-05)

Type ids `net.noodl.SetComponentObjectProperties`, `net.noodl.ParentComponentObject`, `net.noodl.SetParentComponentObjectProperties`
(display names *Set Component Object Properties*, *Parent Component Object*, *Set Parent Component Object Properties*). All three are
picker nodes (`inNodePicker`, not deprecated; the Set is browser+cloud, the parent pair browser-only). Floor **105 → 108**.
This is the slice EXP-002-COMPONENT-OBJECT-TARGET §4 named three times as "not translated in this slice" (gate 3 the Set, gate 4 the
parent family, gate 7 signal-on-write) and §7 drew the upgrade path for: *the record materializes as component state; aliases become
state reads; mirror wires become sync effects*. Richard's ruling (§50, the Tier 2.8 table): *own store = local state; the parent pair = context*.

### §60.0 Design — what the nodes are on disk, and what that decides (written before a line of code)

**The record.** `componentobject.ts`: one `Model` per component *instance* (`componentState<instanceId>`), create-on-read, booting empty;
every node of the family in that instance shares it. `Component Object`'s `value-X` inputs are continuous mirrors (`scheduleStore` at
frame end); its `value-X` outputs are `model.get(X)`; `changed`/`changed-X` fire off the model's `change` event, which `Model.set`
raises **only when the value differs** (`model.ts:347`, `oldValue !== value`).

**`Set Component Object Properties`** (`base.ts` + `setcomponentobjectproperties.ts`): on `Do` (`store`), `scheduleStore` →
`Model.get('componentState' + own instance id)` — *cannot miss*, which is why the node has **no Failure and no Error port by design**
(`canFailToResolve` is opt-in and the self variant does not opt in) — then for each key in the node's **own `properties` list** that is
present in `inputValues`, `model.set(key, value, { resolve: true })`; then `done`, then `completed`. 🔴 **Verified in `base.ts`, and it is
NOT the modelcrudbase rule the brief predicted:** `_pushInputValues` there abstains on an `undefined` value; here `keysToSet` is
`Object.keys(inputValues)` filtered by the list — a key **never delivered** is absent (abstains by absence), a key delivered as `undefined`
**is written as `undefined`**. The `type-<p>` inputs are registered with an empty setter — inert on the write path, no Array/Object eval
(unlike §47's node). An authored literal on a `prop-<p>` port is delivered at creation like any parameter, so it is in `inputValues` and
is written — a literal entry in the patch (§47 only reads wires; recorded as a residual there).

**`Parent Component Object`** (`parentcomponentobject.ts`) walks the *visual* parent chain (`componentwalk.ts`: first root's visual
parent, else `parentNodeScope`) for the **nearest ancestor that owns a `net.noodl.ComponentObject` (or deprecated `Component State`)
node** — or, with `Parent Component` set, the ancestor *named* so (`target-not-found` / `target-has-no-object` distinct misses). It
binds to that record: `value-X` outputs read it (`undefined` while unbound), `value-X` inputs **write** it (`scheduleStore` — a write
through the reader node), `changed`/`changed-X`/`fetched`/`done` are its signals, `fetch` republishes; a miss is raised **once, after
the deferred first resolution** (`reportMiss`: `parent-component-object/no-ancestor`, `Failure` pulses, `Error` carries the sentence).
**`Set Parent Component Object Properties`** walks the same way on `Do`, writes the same way as the self variant, and on a miss writes
nothing, sets `Error`, raises `set-parent-component-object-properties/no-ancestor` and pulses `Failure` (`canFailToResolve: true`).

**What that decides — the shape.**

1. **A `Component Object` node has a mode, decided once per node.** *Alias* (EXP-002 §3 unchanged — the record compiles away) when no
   `Set Component Object Properties` sits in its component AND no descendant (instances + For Each templates, transitively —
   `parentFamilyReachesThisRecord`, the existing gate-4 walk) hosts a parent-family node. *Record* otherwise. This answers (a): a read
   is an alias **or** a state read, by the node's mode, never both; the two cannot print together because the mode is a property of
   the node, not of the wire.
2. **In record mode the record is a per-instance hook**, `const <local> = useComponentObject<<Local>Record>()` from
   `src/lib/componentObject.ts` — `useState` for the render snapshot (`<local>.value`) plus a `useRef` for the live read
   (`<local>.get()`), and `set(patch)` which writes **every own key of the patch** (undefined included — `base.ts`'s rule) and bumps state
   only when a key changed (`Model.set`'s rule). Not `@nodegx/core`'s `store()` — that is module-level and keyed by name (§47's named
   Object, one per app); this record is one per component *instance*, which is what `useState` is. Reads: render prints
   `<local>.value.X`, a handler prints `<local>.get().X` — live, as `model.get` is, so a Done chain reading a key the same handler just
   wrote sees the new value with no snapshot rewrite (the Variable's `.get()` precedent, §59.4 finding 5). Every `value-X` **mirror
   wire** becomes a mirror effect `useEffect(() => { <local>.set({ X: <src> }); }, [deps])` (§7's "sync effects"); a key's TS type is
   `string` when every own writer (Set entries + mirrors) is string-typed, else `unknown` (§47's vacuous-`every` correction: no writer ⇒
   `unknown`). The component's root JSX is wrapped in `<ParentComponentObjectContext.Provider value={<local>}>` — the transcription of
   "this component owns a Component Object", which is exactly the predicate `findAncestorWithComponentObject` tests. Shadowing is
   therefore right by construction: an intermediate component with its own Component Object is in record mode (the descendant reach
   forces it) and provides, so the nearest provider is the nearest owner.
3. **The parent pair read the nearest provider through `useParentComponentObject<<Local>ParentRecord>(readers)`** — one hook per
   component (every parent-family node in a component resolves the same nearest ancestor), `undefined` at the root. Keys typed
   `unknown` (a descendant cannot know its host) and coerced at the sink as an untyped Variable is (`String(x ?? '')`). The hook
   raises `parent-component-object/no-ancestor` once per reader site at mount when there is no provider — the loud point of
   `nodeScopeDidInitialize`, guarded against StrictMode's double mount — and every read answers `undefined`, which is (d)'s runtime
   answer transcribed. (d) two different parents: context, naturally. (e) a For Each template row: the row renders inside the host's
   JSX, so the provider reaches it — fixtured (`PanelRow`).
4. **`Set … Properties` is a handler action** `component-object-set`: own → `<local>.set({ title: titleText, note: 'renamed' })` with
   the Done chain, then the Completed chain, as following statements (one arm, always taken — `object-set`'s treatment); parent →
   the block form: `if (<pl> === undefined) { raise no-ancestor; <Failure chain> } else { <pl>.set({ … }); <Done chain> }`.
5. **Named `Parent Component` — REFUSED BY NAME** in this slice, on both parent nodes: the context carries the nearest owner only;
   resolving a *name* needs either a chain of providers or a static ancestor map, and the corpus has one Parent Component Object
   (Puppy test) with no name set. (b) **signal-on-write — REFUSED BY NAME**, with the sentence saying which: a `changed`/`changed-X`
   consumer on any of the three record nodes is a write-notification effect this slice does not emit; the record's readers re-render
   on every write instead. (c) **Fetch stays refused** on both readers. **Error on the parent pair — REFUSED BY NAME**: the only
   message it can carry is the miss sentence, which the raise already reports on the channel. **Failure on the parent Set —
   translated** (the `else` arm's twin); **Failure on the parent reader — refused by name** (a mount-time pulse chain; the raise is
   transcribed, the branch is not).

**Refused by name, every sentence predicted** (graded in the spec by mutation):

- Own Set: `its component has no Component Object node — the record it writes is read by nothing statically translatable (a Function's Component.Object is deferred)` · `its Properties list is empty, so Do writes nothing` · `nothing is wired into any of its properties, so Do writes nothing` · `two wires feed its "X" — last-writer-wins is not statically ordered` · `its "X" has no statically known source` (or the feeder's) · `its "X" is fed a logic truth value — only truthiness sinks take one in this slice` · `its Component Object node is refused — <the host's own sentence>` · `its Done output drives no translatable action` · `its Do is never fired by a translatable source` (the sweep) · a `prop-X` wire the list does not name: dropped with `"X" is not in the node's Properties list, so the runtime never writes it — dropped`.
- Parent Set adds: `its Parent Component names "<X>" — this slice resolves the nearest ancestor record only; a named ancestor is not translated` · `its Parent Component is wired — which ancestor it writes is not statically knowable` · `its Error output is consumed — the miss message is raised on the error channel (set-parent-component-object-properties/no-ancestor) rather than exposed as a row in this slice` · `its Completed output is consumed — it fires after every outcome, and this slice emits the outcome arms rather than a join beneath them` · `its Failure output drives no translatable action`.
- Parent reader: the two Parent Component sentences (reads) · `its Fetch is wired — a batch republish with Fetched/Done ordering is signal work this slice does not translate` · `Parent object is unticked under Run On Value Change — its outputs freeze between Fetch pulses` · `its <port> signal is consumed — signal-on-write is not translated in this slice; the record's readers re-render on every write instead` (changed, changed-X, fetched, done, completed) · `its Failure signal is consumed — a missing ancestor is raised on the error channel once at mount (parent-component-object/no-ancestor) and not branched on in this slice` · `its Error output is consumed — …` · `its "X" property input is wired — a write through the Parent Component Object node itself is not translated in this slice; a Set Parent Component Object Properties is` · `property "X" is a dotted path the record would resolve through nested models` · `its <port> output is consumed as a value — a pulse carries nothing to read` · `its <port> output is not a port this node has` · `component emits no file to host the parent record` · unread: `its properties feed nothing statically translatable`.
- `Component Object` in record mode keeps gates 1, 2, 5, 6, 7 with their sentences; gates 3 and 4 are gone. Its `changed`
  sentence is re-worded to the one above (the old one said "belongs to the component-state slice" — this is that slice, and it says no).

**Not translated, recorded:** the runtime resolves the parent one update pass late (`nodeScopeDidInitialize`'s deferral) and mirrors
land end-of-frame; the mirror effect lands after the first paint — the same one-tick lag, on the other side. A `Set` writes N keys
with N `change` notifications; one patch, one render. The deprecated `Component State` node is not a provider here (it is not a picker
node and not in the ledger's population).

**Decided on the way (against §60.0 as first written):** in record mode an out-of-vocabulary read is the **wire's**
refusal, never the node's — the record is real state (a Variable read into a margin drops the wire, the Variable
stays), where alias mode's node-level defer is right because the alias *is* the wire. And the mirror-source check
moved from the verdict loop into the gate: pass 4d binds reads of the record before the verdict runs, so a late
refusal would have left bound reads pointing at a hook that never prints.

### §60.1 What is emitted

- **`src/lib/componentObject.ts`** (`src/emit/componentObjectLib.ts`, new): `useComponentObject<T>()` — a lazy `useState`
  per mount (the instance), a `useRef` beside it, `get()` live, `set(patch)` writing every own key of the patch (undefined
  included — `base.ts`) and bumping state only when a key changed (`Model.set`'s `oldValue !== value`), the handle memoised
  on the value so a Provider's consumers re-render exactly when the record does; `ParentComponentObjectContext`
  (`createContext<ComponentObject<Record<string, unknown>> | undefined>`); `useParentComponentObject<T>(readers)` — the
  context, and a once-guarded mount effect raising `parent-component-object/no-ancestor` per reader site when it is
  `undefined`; the two miss messages exported verbatim. Imports `./errors`, so it earns `errors.ts` (`emitApp.ts`).
- **The host** (record mode): `type <Local>Record = { title?: string; count?: unknown; note?: string }` at module level;
  `const panelState = useComponentObject<PanelStateRecord>()` after the state rows; one mirror effect per wired `value-*`
  input beside the sync effects — `useEffect(() => { panelState.set({ note: noteValue }); }, [noteValue])`; render reads
  `panelState.value.title ?? ''` (a string key folds bare) / `String(panelState.value.count ?? '')` (any other type, once);
  handler reads `panelState.get().title`; the Set `panelState.set({ title: title, note: 'renamed' })` with Done then
  Completed as following statements; the root JSX wrapped in `<ParentComponentObjectContext.Provider value={panelState}>`.
- **A descendant**: `type PanelParentRecord = { title?: unknown; note?: unknown; count?: unknown }`;
  `const parentObject = useParentComponentObject<PanelParentRecord>([{ nodeId, nodeType, componentName }])` (the reader sites
  that collapsed; none for a component with only a parent Set); reads `String(parentObject?.value.title ?? '')`; the parent
  Set in the block form — `if (parentObject === undefined) { raiseAppError({ code: 'set-parent-component-object-properties/no-ancestor', message: 'No ancestor component has a Component Object node — nothing was written', … }); <Failure chain> } else { parentObject.set({ count: 1 }); <Done chain> }`.
- **plan.ts**: `SET_COMPONENT_OBJECT_TYPE` / `PARENT_COMPONENT_OBJECT_TYPE` / `SET_PARENT_COMPONENT_OBJECT_TYPE`,
  `NO_ANCESTOR_WRITE_MESSAGE`; `ValueExpr` gains `component-object-out { nodeId, local, key, parent, tsType }`;
  `HandlerAction` gains `component-object-set { nodeId, local, parent, entries, then, completedThen, failThen }`;
  `ComponentObjectRecordPlan` / `ParentComponentObjectPlan` on `ComponentPlan.componentObject` / `.parentObject`;
  `componentObjectModeOf`, `componentObjectKeysOf`, `uniformTypeOf`, `componentObjectRecordOf` (registered BEFORE its
  writers are typed, so a self-mirror cannot recurse), `parentObjectPlanOf`, `parentReaderGate`,
  `parentComponentObjectReadExpr`, `compileComponentObjectSet` (the sink port-kind check before the chains, §59.4's rule);
  the gate's record-mode block (mirror sources checked there, memo pre-set against re-entry); the record-mode arm of the
  Component Object verdict; the Parent Component Object verdict; the never-fired sweep for the two Sets; the reader prune;
  `resolveExpr`'s three new branches; the five expression switches; `actionsValidIn` / `snapAction` / `scanActions` /
  `walkActions` / `fillMaterialize`; `TRIGGER_PORTS`; the `outputRead` control-mint clause (tenth family); pass 4d admits
  the parent read.
- **component.ts**: `usedParentObject`; `printsRecord` (the plan registered a record AND its node collapsed) /
  `printsParent`; the lib import; `useEffect` for the mirrors; the type aliases before the props interface; the two hook
  lines after the state rows; the mirror effects beside the sync effects (their sources through `hookExprSources` — the
  first emit closed over the store object); the Provider around the return; `component-object-out` in
  `collectExprUse` / `hookExprSources` / `maybeUndefined` / `exprCode` / `effectDeps` / the fold whitelist (string keys
  only) / `bindingExpr`'s coercion table; `component-object-set` in `collectActionUse` / `deepActions` / `inAction` /
  `expandActions` (own form) / `actionCode` (both forms) / `errorCodeOf` / `actionIsStatement` / `actionTakesNoTerminator`
  / `blockBody` / `actionExprsOf` / `raisesAppErrors`; `recordKeyAccess` / `recordKeyDeclaration` (a hyphenated key
  brackets). **emitApp.ts**: the file, and `errors.ts` earned by it. **Ledger**: three rows `translated`; floor **105 →
  108**; eight pins moved (`animation-pair`, `browser-utilities`, `filter-records`, `on-app-error`, `object-store`,
  `run-tasks`, `script`, `streaming-trio`).
- **Refused by name**: every sentence of §60.0's list, unchanged in wording except two the build corrected — a Done /
  Completed / Failure wired into a value port is `its <Port> output is consumed as a value — a pulse carries nothing to
  read` (decided from the port kind before `doneChainOf` speaks), and a parent reader's signal wired anywhere is the
  whole-node gate's sentence first.

### §60.2 The fixture — `tests/fixtures/panel-desk`

`App`: the router. `Pages/Home`: a text input `titleInput` → `setTitle.prop-title`; a Rename button → `setTitle.store`
(`properties: title,note`, `prop-note` authored `"renamed"`); `setTitle.done → setStatus` (`status ← "Renamed."`);
`panelState` (`properties: title,count,note`) → three Texts; `noteVar` (Variable `note`) → `panelState.value-note` (the
mirror); a `Panel` instance; `rows` (For Each over a two-row Static Data, template `PanelRow`). `Components/Panel`:
`parentState` (`title,note`) → two Texts; a Bump button → `bump` (`Set Parent Component Object Properties`, `count`
authored `1`), `done → setBumped` (`"Bumped."`), `failure → setBumpFailed` (`"No parent panel."`); a Text on the status.
`Components/PanelRow`: `name` input → Text; `rowParent` (`title`) → Text.

**The reverted arm** (`probe-reverted.log`, HEAD 2a2dd4fa): `panelState` deferred with gate 3's sentence, `setTitle` /
`parentState` / `bump` / `rowParent` as `logic node (…)`, the three Set Variables silenced behind them, **14 refusals**,
no pathway — every node predicted; the Set Variables' sentence was *"nothing is wired into value"* rather than the
cascade's, because the first fixture authored the values as parameters and a `Set Variable` takes a wire (fixed with
three `String` nodes, roster-desk's shape). **Built**: 19 files, 0 refusals, the shell note; the real `tsc` clean.

### §60.3 Gates

```
packages/nodegx-export: tsc --noEmit 0 (after every stitch) · component-object-trio.test.ts 60/60
  §A the fixture whole + the real ts.Program + the handler read (11) · §B the lib under a fake React (8) · §C the own Set's
  refusals (10) · §D the parent Set's (7) · §E the parent reader's (11) · §F record mode vs alias mode (7) · §G the findings,
  the ledger, the lib's surface (6)
component-object.test.ts: two pins flipped to positive rows (gate 3 ⇒ record mode with a hook, a Provider, the mirror as an
  effect, the Set named "nothing fires its Do"; gate 4 ⇒ record mode with a Provider) — 22/22
neighbours re-run in band, green: unreported-deferrals, in-code-markers, logic, cascade, typecheck-emitted + the eight pin
  specs — 14 files, 655/655
export-ledger:check OK — 176 types, 115 translated · picker --check 108/127 (85.0%), floor 108, exit 0 (was 105)
arms 18/18 KILLED (mut.py, mut-summary.txt), every arm compiled, sources restored md5-identical after each: M1 set() skips
  undefined — 1 · M2 re-render on no change — 2 · M3 get() reads the snapshot — 1 · M4 the once-guard on the mount raise — 1 ·
  M5 the gate admits an untranslatable mirror — 1 · M6 record mode ignores the descendant reach — 1 · M7 a named Parent
  Component silently the nearest — 1 · M8 an authored prop literal skipped — 12 · M9 a handler read prints .value — 1 · M10 no
  Provider — 2 · M11 the mirror effect loses its dependency — 1 · M12 the string key off the fold whitelist — 2 · M13 the
  port-kind check removed — 3 · M14 the miss arm no longer raises — 2 · M15 the Sets off the control-mint clause — 10 ·
  M16 the lib no longer earns errors.ts — SURVIVED on the first run (the Panel's own raise earned it) ⇒ G6 written (readers
  alone still ship errors.ts, typechecked) ⇒ KILLED — 1 · M17 the reader's value-* input gate removed — 1 · M18 every key
  typed unknown — 5
whole package jest ONCE, alone at load 5.4: 72 files (72 on disk = 71 + this spec), 2521/2521, exit 0; no file under src/ changed after it
  (an earlier run was stopped and re-run once: the Provider wrap indented blank lines — nine whitespace-only lines — fixed before the run that counts)
NOT run (the orchestrator's, after merging): editor tsc, editor test:ci, any drive.
```

### §60.4 What building it found

1. 🔴 **The mirror effect closed over the STORE OBJECT — the hooks-walker trap's twelfth instance, and the brief's own
   warning.** The first emit printed `panelState.set({ note: note })` with deps `[note]` and no import of `note`: my
   mirror sources never passed through `hookExprSources`, so the `useValue(note)` hook line was never earned. One line at
   the sync-effects' walker site; pinned (A7, G1); an arm (M11 is the deps, the store-object shape is G1's `not.toContain`).
2. 🔴 **A non-string key folded twice** — `{String(panelState.value.count ?? '') ?? ''}`: my `bindingExpr` coercion and the
   text-sink fold whitelist both fired. The whitelist now admits a `component-object-out` only when its `tsType` is
   `string`; pinned (A7, G2); an arm (M12).
3. 🔴 **`base.ts` does NOT abstain on `undefined`** — the brief said "as the modelcrudbase family does — VERIFY": `keysToSet`
   is `Object.keys(inputValues)` filtered by the list, no undefined filter; a key never delivered is absent, a key delivered
   as `undefined` is written. The lib writes every own key of the patch (B3); an unfed key is absent from the patch (C3).
4. 🔴 **An authored `prop-<key>` literal is delivered and written.** §47's compile reads wires only and silently skips an
   authored literal on a `Set Object Properties` property; `base.ts` (and `modelcrudbase`) receive parameters into
   `inputValues` at creation. This slice writes the literal (`note: 'renamed'`, G3, M8 — 12 rows red without it); §47's
   node is registered below.
5. 🔴 **The chain compiler asks first — §59.4's finding 2, met again.** A Completed wired into a Text said *"drives no
   translatable action"*; the port-kind check now runs before `doneChainOf`, for all three chain ports (C7, C9, D5; M13).
6. ⚠️ **A click-attached sink's disposition is `into: <trigger id>`**, not the file — the attach pass's norm; my A4 first
   asserted the file for the Sets (the reads register the record node into the file, the Sets collapse into their button).
7. ⚠️ **A `Set Variable` takes a wire, never an authored value** — the first fixture authored `"Renamed."` as a parameter and
   every Set Variable refused with *"nothing is wired into value"*. Three `String` nodes, roster-desk's shape.
8. ⚠️ **A `Variable2`'s authored initial value (`value: "First note"`) is not seeded** — the emitted store boots
   `value<string | undefined>(undefined)` and nothing writes it; the mirror effect therefore writes `undefined` on mount.
   Pre-existing, not this row's (registered below); the fixture keeps the Variable because it is the shape that pins
   finding 1.
9. ⚠️ **The parent reader's whole-node gate speaks before a value-read of its signal does** — `fetched → Text.text` is
   *"its fetched signal is consumed — …"*, not *"consumed as a value"*; honest, and pinned as such (E10).
10. ⚠️ **M16 survived on the first run**: the Panel's own miss-arm raise earned `errors.ts`, so the lib's own import of it
    was unobserved. G6 (readers alone, typechecked) is the row; killed on the second run.

### §60.5 Residuals (owner NONE unless named)

- **A named `Parent Component`** on either parent node is refused by name. The translation is a chain of providers (each
  owner's Provider value carrying its name and the outer handle) so the hook can walk by name, plus a static check that the
  named component owns a Component Object; the corpus has no named target. Owner NONE.
- **Signal-on-write** (`changed`, `changed-<p>`, `fetched`, `done`, `completed` on the three record nodes) is refused by
  name; the honest translation is a per-key change effect on the record with a previous-value ref (StrictMode-safe). Owner NONE.
- **`Failure` / `Error` on the parent reader** — the mount-time raise is transcribed (the lib), the pulse chain and the row
  are refused by name. `Error` on the parent Set likewise (its only message is the miss sentence, raised). Owner NONE.
- **A key written only from a descendant is typed `unknown` on the host** (`count` in the fixture) — the host cannot see the
  child's literal; a project-wide pass over parent Sets could type it. Owner NONE.
- **`Set Object Properties` (§47) skips an authored `prop-<key>` literal** where the runtime writes it — one clause in
  `compileSetObjectProperties`, mirroring this row's. Owner **EXP-011**.
- **A `Variable2`'s authored initial value is not seeded** into the emitted store (finding 8). Owner **EXP-011** (a store
  module boot value; not this row's node).
- **The deprecated `Component State` node** is a resolvable ancestor in the runtime (`COMPONENT_OBJECT_TYPES`) and is not a
  provider here; it is not a picker node. Owner NONE.
- **A host whose Component Object is refused** (gates 1/2/5/6/7) leaves its descendants' parent reads answering `undefined`
  with a mount raise — the host's refusal is reported, the descendants are not told. Owner NONE.
- Not driven in a browser this session (the brief forbids drives from a slice agent); the orchestrator's drive is owed:
  Rename → the three Texts, the Panel and both rows follow; Bump → count `1` on the page; the mirror on mount.
