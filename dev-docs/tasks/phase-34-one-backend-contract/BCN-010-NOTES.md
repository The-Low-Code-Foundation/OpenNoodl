# BCN-010 — Notes

**Capability gating, the node-library reconciliation, and the one criterion that
justifies the phase.**

Read alongside [BCN-010-GATING-AND-CATALOG.md](./BCN-010-GATING-AND-CATALOG.md),
whose premises §1 corrects.

> **Criterion 3 is met, and it was driven in a real editor.** A project on
> Directus shows Access Control Rules dimmed with *"Directus controls access with
> roles and permissions, set up in your Directus admin — not per record from
> here"* underneath it; the same project on Parse shows the same row enabled. A
> `conditional` cell was settled against two real servers, opening on one and
> closing on the other. §7 has it step by step, including the leg that has since
> gone stale.

---

## 1. Stale premises

Six, and two of them change what the task is.

### 1.1 ⚠️ "BYOB node types — all five retired"

The spec's Current State table. **Only one is retired.** `SubscribeToChanges`
went with BCN-008; `noodl.byob.QueryData`, `CreateRecord`, `UpdateRecord` and
`DeleteRecord` are still registered in `register-nodes.js` and still in both
catalogs. BCN-004 step 7 was deliberately not done.

That matters because §2 of the spec — *"With the BYOB types gone, the padding
that avoided collisions can go"* — has a precondition that is false. See §3.

### 1.2 ⚠️ "`CloudStore._handle()` still answers `nodegx` unconditionally"

Carried in the register as the reason a capability gate would read a floor. **It
is half stale and the other half is worse than it sounds.** Full answer in §4,
because the handover asked for it explicitly.

### 1.3 ⚠️ `Request Magic Link` is not in the node picker

`net.noodl.user.RequestMagicLink` and `net.noodl.user.SignInWith` are registered,
not deprecated, and **`inNodePicker: false`** — they are absent from
`nodelibraryexport.ts`'s curated index, so BAK-004 shipped two nodes that cannot
be added from the picker at all. The spec's step 7 asks for a live pass showing
Request Magic Link disabled *in the editor*, which is possible on the canvas and
in the property panel but not in the picker.

Not fixed here: the index lives in `nodelibraryexport.ts`, which the orchestrator
is about to touch for the four deletions, and a one-line addition there is not
worth a conflict on that file. **Recorded as a finding for whoever lands them.**

### 1.4 ⚠️ The property panel has no `disabled` state to reuse

The spec's desired state says *"port disabled, **reason on it**"* as though the
affordance existed. It does not: `PropertyPanelInput`, `PropertyPanelRow` and
`PropertyPanelBaseInput` have no `isDisabled`, no tooltip and no sub-label, and
there are twenty-nine row classes. See §5 for what happened instead.

### 1.5 The two record nodes spell their label differently

`newdbmodelpropertiesnode.ts` uses `displayName`, `setdbmodelpropertiesnode.ts`
uses `displayNodeName`, in the same family. Harmless — `nodedefinition.ts:264`
normalises `displayNodeName: opts.displayNodeName || opts.displayName` — but it
is why a naive grep for one spelling finds half the family.

### 1.6 The handover's editor advice was right, twice over

`npm run dev:debug` from the worktree compiled the worktree's own sources; CDP
reported the worktree's `index.html` and all five `capability-gating/*` modules
were in the renderer's webpack registry. `--target=editor` attached to the
editor. Both confirmed again.

---

## 2. What shipped

| Piece | Where |
|---|---|
| `resolveGate` + `CapabilityGate` + the staleness rule | `nodegx-backend-contract/src/capabilities.ts` |
| `gateFor` / `filterGateFor` — the single reading | `nodegx-backend-contract/src/descriptors/index.ts` |
| `NODE_CAPABILITIES` — which node needs which capability | `nodegx-backend-contract/src/nodeCapabilities.ts` |
| `CapabilityProbeCache` — policy, no I/O | `nodegx-backend-contract/src/probes.ts` |
| Editor resolution, three surfaces, one seam | `noodl-editor/.../utils/capability-gating/` |
| Port decoration at the one choke point | `.../capability-gating/portDecoration.ts` + `DataTypes/Ports.ts` |
| Canvas marking through `WarningsModel` | `.../capability-gating/nodeWarning.ts` + `NodeGraphNode.evaluateHealth` |
| Picker marking | `.../capability-gating/pickerReason.ts` + `NodePickerCard.tsx` |
| The real probes (WS upgrade, aggregate shape) | `.../capability-gating/probeCache.ts` |
| Registry-wide duplicate-label test | `noodl-runtime/test/duplicate-labels.test.js` |
| Capability facts on the MCP surface | `noodl-mcp/src/catalog.ts` |

### The gate is one function, and that is the point

Before this the descriptor was consumed in exactly two places, with two different
readings of the four states: `getOperatorsForType` dropped `conditional`
operators, `dataBrowserAvailability` folded `unsupported` and `conditional`
together via `isUsable`. Neither was wrong. A third hand-written reading for
ports is precisely where they would have started to disagree, so `resolveGate` is
now the only one and the filter builder's seam (BCN-003b's, reused as instructed)
resolves through the same rule.

### The invariant, checked as a property of the table

`gating.test.ts` asserts over **every one of 6 × 27 capability cells and 6 × 31
filter cells**, in both readings of a `conditional` (unprobed and probed-negative),
that a gate which takes something away carries a non-empty reason. That is the
task's own "a disabled port with no reason is a build failure", expressed as
something a build can fail on rather than as a review instruction.

`portDecoration.ts` has the second lock: it **refuses to disable a port it cannot
explain**, leaving the control usable and logging loudly. The two failures are
different — a hole in the table versus a dead control on screen — and only the
first is caught by a test.

---

## 3. Deviations, with reasoning

### 3.1 The relabel was done ahead of its own precondition, and made three collisions visible

The spec's §2 assumes the BYOB types are gone. They are not (§1.1). Renaming
"Create New Record" → **Create Record** collides with `noodl.byob.CreateRecord`,
and "Set Record Properties" → **Update Record** collides with
`noodl.byob.UpdateRecord`. "Delete Record" was already colliding before this task
started.

Two options, and neither is clean:

- **Leave the padding until the deletion lands.** The rename then has to be
  remembered inside somebody else's commit, which is exactly the class of thing
  this phase keeps losing.
- **Rename now and make the collisions enforced.** Three pending collisions
  exist, all closed by the same four type deletions, all enumerated in
  `duplicate-labels.test.js` — which fails if a **fourth** appears *and* fails
  again when the types go and the list is not emptied.

Took the second. ⚠️ **Exit criterion 2 — "exactly one node that reads Delete
Record, and one that reads Create Record" — is therefore NOT met**, and cannot
be until the deletions land. The test is the instruction; see §10.

### 3.2 The capability bindings are a table, not a field on each node

The obvious design is `capability: 'auth.magicLink'` beside `displayName` in each
node definition. Rejected for three reasons, in increasing weight: thirty claims
across twenty-two files in three packages cannot be reviewed the way one table
can; half the ports are dynamic (`Subscribe To Changes` is pushed by
`dbcollectionnode2.ts`, not declared); and ⚠️ the nodes that most need gating are
the auth and file families, whose files belong to other workers in this batch.

The table let the whole feature land **without touching a single node
definition**, which is also why nothing in it changes the catalog.

### 3.3 Supabase `realtime.subscribe`: `conditional` → `unsupported`

BCN-008's own comment on the cell said *"BCN-010 is where one of them has to
give"*, about the disagreement between the cell (`conditional`) and
`realtimeSupportFor('supabase')` (`unsupported`).

It gives to `unsupported`. The split was defensible right up until a *port* read
the cell: `conditional` is a promise that a probe can settle the question, and the
editor now acts on the answer. Had `/realtime/v1/api/tenants/realtime/health` ever
answered on a real Supabase project, the cell would have **enabled Subscribe To
Changes on a node with no transport behind it** — a port that looks available,
accepts a wire, and reports `CAPABILITY_UNAVAILABLE` at runtime. That is the
silent gap the phase exists to prevent, manufactured by the gate itself.

Nothing was measured to make this change and nothing needed to be: the evidence is
`realtime/UnavailableTransport.ts` and the absence of a Phoenix decoder in the
repo — facts about our code, not about anyone's server. The reason string is
unchanged; it already said the true thing. Reverting it is one edit if a transport
is ever written, and the evidence line says so.

**This is a promotion of honesty, not of capability**, and it is the only cell
this task moved.

### 3.4 `resolveBackend.ts` split into a pure half

Not planned. Importing it from the editor failed the editor's test build with
**183 TypeScript errors, none in any file this task wrote** — webpack resolves a
`require` statically whatever scope it is in, so the module's lazy
`require('noodl-runtime')` dragged the entire standard library in, and
`stream-buffer.ts` uses `import =`/`export =` which the editor's ESM-targeting
loader refuses. The PLAT-003 slice 13 shape exactly.

The pure rules moved to `resolveBackend.pure.ts`; `resolveBackend.ts` re-exports
every one of them. **Its three importers did not move** — `cloudstore.js`,
`dbcollectionnode2.ts` and `userservice.ts` (the last being another worker's
file, which is why the re-export matters).

### 3.5 A `degraded` gate is annotated, never disabled

The operation works. Disabling it would take a working control away on the
strength of a footnote — the mirror of the bug this task fixes. `degraded` is
surfaced in the property panel and on the canvas hover, and deliberately **not**
in the picker: the picker's job is "does this exist", and a caveat there is noise
a builder cannot act on.

### 3.6 The canvas warning is `level: 'warning'`, and that turned out to be a defect

See §8.2 — it was painted red anyway, and the fix is in this branch.

---

## 4. `CloudStore._handle()` — what I did about it

**The gate does not read it, or `queryutils.backendType()`, at all.**

The register entry says it "still answers `nodegx` unconditionally, so the
capability gate reads a floor rather than the truth". Reading the code:

- **Half stale.** Since BCN-004 step 5, `_handle()` returns `this._target.handle`
  when the store has a resolved target (`cloudstore.js:128-145`). The
  unconditional `nodegx` is the **legacy singleton's** branch only, and its
  docblock explains why it must stay: `queryutils.backendType()` reads it to pick
  the filter builder's capability table, and guessing `parse` would narrow the
  operator list in every pre-WF-007 project.
- **Half true, and it is the half that matters.** The singleton is what every
  auth and file node still uses, because BCN-009 step 4 found `user.ts`,
  `setuserproperties.ts`, `cloudfilenode.ts` and `signfileurl.ts` have no
  `backendId` port. Those are exactly the nodes this task most needs to gate —
  Request Magic Link among them. **A gate reading the singleton would have
  answered `nodegx` for all of them, and `nodegx` supports everything**, so the
  gate would have been permanently open *and would have looked as though it
  worked*. Every node green, every test green, and the phase's central claim
  quietly false.

So resolution goes through `resolveBackend.pure.ts` — `defaultBackendId` and
`resolveBackendTarget`, the same pure rules the Record family and the runtime
already use — against the project's own metadata. That answers the truth for a
node with a `backendId` port *and* for a node without one, and **it does not
require the singleton to be fixed first**. The singleton stays exactly as it is;
nothing in this task depends on it.

⚠️ **Consequence: the editor is now stricter than the runtime in one measured
case.** `realtimeSupportFor('directus')` returns `supported` unconditionally,
while the descriptor says `conditional`. The editor gates on the descriptor and
shows Subscribe To Changes closed until a probe opens it; the runtime would try
regardless. The editor's direction is the safe one, but they disagree and the
runtime's copy is not this task's to move. **Unowned.**

---

## 5. The port gate is a wrapper, not two props

`Ports.renderParams` is the one place every row's element passes through,
whatever class produced it. Wrapping there is one edit and covers every port type
including ones not written yet.

The alternative — `isDisabled`/`caveat` on `PropertyPanelInput`, wired from each
`TypeView` — covers `BasicType` and leaves twenty-eight other classes, each a
place the wiring can be forgotten. **The first two ports this task needed to gate
are already in two different classes** (`realtime` is a boolean, `accessControl`
is a proplist), so "start with `BasicType`" would have shipped neither of them.

Two things that had to be got right and are easy to miss:

- **The re-render hash.** `renderGroups` returns early when the ports have not
  changed. A probe settling 200ms after the panel opens changes no port, so
  without a capability term in the hash the answer never reaches the screen. The
  signature is *computed* rather than read from the cache, so it also moves when
  the project's backend changes — which is the switch the live pass drives.
- **`textContent`, never `innerHTML`.** One of these sentences is user input by
  design: a `custom` backend's descriptor is filled in by the user in the Backend
  Services panel. Pinned by a test.

---

## 6. Mutation tests

Every check was broken deliberately and confirmed to fail. Seven on the gate and
four on the label test; all eleven discriminate.

### The gate (`gating.test.ts`, 30 tests)

| # | Mutation | Result |
|---|---|---|
| G1 | An `unsupported` gate loses its `reason` | **4 fail**, incl. both whole-table invariants |
| G2 | An unprobed `conditional` reads as `supported` | **3 fail** |
| G3 | A stale positive is believed forever | **1 fails** — the spec's own trap |
| G4 | `degraded` collapsed into `supported` | **2 fail** |
| P1 | Cache believes a positive forever, never re-probes | **1 fails** |
| P2 | `invalidate()` made a no-op | **1 fails** — the reconnect path |
| P3 | A throwing runner recorded as `unsupported` | **1 fails** |

P3 is the one worth keeping. "We could not ask" and "it said no" are different,
and conflating them puts a confident sentence under a port on the strength of a
DNS failure. Unprobed already renders as unsupported with the descriptor's hedged
wording, which is the honest rendering of not knowing.

### The duplicate-label test

| # | Mutation | Result |
|---|---|---|
| M1 | A **new** creatable collision (Log In relabelled "Query Records") | **1 fails** |
| M2 | A pending collision **resolved** but not de-enumerated (`noodl.byob.DeleteRecord` deleted) | **2 fail** |
| M3 | A **new** deprecated-shadows-modern pair | **1 fails** |
| M4 | The relabel reverted | **2 fail** |

M2 is the one the handover asked for — *"prove your enumerated deprecated
exceptions do not hide a real one"*. The enumerations are asserted by **exact
equality in both directions**, so a stale exception fails as loudly as a new
collision. That is what stops "enumerate the known cases" degrading into "exclude
by a rule", one stale entry at a time.

⚠️ **Two pins fired for real, not as mutations** — see §9.

---

## 7. The live pass

In a real editor, launched from this worktree, against the running rig. Project
fixture: four backends (`bcn010_directus/supabase/pocketbase/parse`) in converged
`backendServices` v2 metadata, four nodes placed programmatically.

### 7.1 Directus — a port disabled, with its reason, in the DOM

Selected Create Record; read the property panel:

```
gatedCount: 1
states: ["unsupported"]
dataTests: ["capability-gated-port-accessControl"]
disabledControls: 1
reasons: ["Rig Directus: Directus controls access with roles and permissions,
           set up in your Directus admin — not per record from here."]
```

Screenshot confirms it on screen: the "Access Control Rules" group with the
amber-ruled sentence under it and the control inert. **This is criterion 3.**

### 7.2 The canvas, same backend

| Node | Result |
|---|---|
| Request Magic Link | marked — *"Rig Directus: Directus has no magic-link login…"* |
| Aggregate Records | clean (Directus aggregates) |
| Create Record | marked — *"accessControl: Rig Directus: Directus controls access…"* |
| Query Records | clean |

### 7.3 The same project on four backends, no reload

| | Directus | Supabase | PocketBase | Parse |
|---|---|---|---|---|
| Request Magic Link | gated | **enabled** ⚠️ | gated | gated |
| Aggregate Records | **enabled** | gated | gated | gated |
| Create Record → Access Control | gated | gated | gated | **enabled** |

Every "gated" carried a backend-specific sentence. ⚠️ **The Supabase magic-link
cell has since moved** — see §9.1. The criterion does not rest on it: Aggregate
Records and Access Control Rules each show the enabled-here / refused-there
pairing, and both were driven live in the same session.

### 7.4 The conditional probe, against real servers

`invalidateProbes()` first, as a reconnect would.

| Backend | Before | After | Detail |
|---|---|---|---|
| Rig Directus `:8055` | `unsupported (UNPROBED)` | **`supported`** | a genuine 101 upgrade |
| Rig Parse `:8092/parse` | `unsupported (UNPROBED)` | **`unsupported`** | *"…(the websocket connection was refused)"* |

Both directions matter. The spec asks for *"a `conditional` cell resolving to
disabled after a probe"* — that is Parse. **Directus is the check that makes it
mean anything**: a probe that only ever returned one answer would have looked
identical to no probe at all. The rig's Directus has WebSockets on, which was
confirmed headlessly before the run rather than assumed.

The probe's own detail is appended to the descriptor's sentence rather than
replacing it, so the guarantee that a disabled gate carries a reason never depends
on a probe writing prose.

### 7.5 The picker

`pickerCapabilityReason` per backend: Request Magic Link reasoned on Directus and
PocketBase and clear on Supabase (at the time); Aggregate Records clear on
Directus and reasoned on Supabase and PocketBase; `Text`, which binds nothing,
silent everywhere.

⚠️ **The picker *card* rendering was not seen on screen.** The reason string, the
card's `is-unavailable` class and its `data-capability-unavailable` attribute are
in the build and unit-covered, but Request Magic Link and Aggregate Records were
both reached programmatically, and §1.3 means the first cannot be reached through
the picker at all. **Listed in §11.**

### Failures during the pass, counted honestly

- **1 real defect found and fixed** — the red ring, §8.2.
- **1 test expectation of mine was wrong** (the backend-name prefix in
  `capability-gating.spec.ts`); the code was right.
- **2 lost sessions to HMR.** Editing `CanvasTheme.ts` triggered a reload that
  dropped `window.__wr` and then the open project, sending the editor back to the
  launcher mid-pass. The handover's "relaunch rather than trust HMR" is right, and
  the cost is one full relaunch, so **script the whole pass into one `eval`**
  rather than stepping it.
- 0 failures in the assertions themselves.

---

## 8. What the live pass found that the tests could not

### 8.1 It is the only thing that showed the colour

Every assertion in §7.1–7.5 could have been made headlessly. The screenshot could
not, and it is the screenshot that found §8.2.

### 8.2 ⚠️ A capability gap was painted red — fixed

`NodeGraphEditorNodePainter` drew **any** unhealthy node with a dashed
`theme.danger` ring, and the comment beside it said *"red is an error here,
allowed"*. Until this task that was right by accident: every node warning was in
practice an error — a missing type, an illegal child, a merge conflict. A
capability gap is the first routine `warning`, and *"Directus has no magic-link
login"* drawn in red reads as a broken node. **That is the exact misreading this
task exists to prevent, one layer up.**

`getHealth()` now reports the level (`error` wins if any warning on the node is
one) and the ring follows it; `CanvasTheme` gains an amber `warning` entry.
Re-verified on screen after a clean relaunch: both marked nodes ring amber.

### 8.3 The component-tree dot and toolbar count include capability warnings

`showGlobally: false` keeps them out of the project-wide count, but the
per-component count is 2 in the fixture and the tree shows an amber dot. Judged
correct — they are things to know about in that component — but it is a visible
consequence of the feature and **Richard may want the count suppressed** for a
class of warning the user cannot act on locally. Flagged, not decided.

---

## 9. Two pins fired for real

Both while merging `cline-dev` at the end. Neither is a mutation; both are the
tests doing the job they were written for.

### 9.1 ⚠️ `supabase.auth.magicLink` moved under me

BCN-006 moved it from `supported` to `conditional` — *"magic links being
first-class in Supabase is a fact about Supabase, not about whether we can reach
them"*, with every `/auth/v1/*` answering 404 in the rig. **That is the same
argument BCN-010 made for Supabase realtime in §3.3, reached independently.** The
cell is right.

Re-pinned rather than relaxed, in `gating.test.ts` and in the MCP suite, and the
enabled-somewhere half of the demonstration moves to the built-in backend where
BAK-004 shipped passwordless. One leg of §7.3 is now stale and is marked as such
rather than quietly re-run.

### 9.2 ⚠️ `catalog:check` passed while `catalog:merge` failed — again

The register's own warning, reproduced live and **not** by a deletion this time.
Worker A's file work gave Upload File and Sign File URL dynamic ports;
`catalog:check` was happy (155 types, dynamic 88 → 90) while `catalog:merge`
errored, because the enrichment layer requires `runtimeBehavior` of any node that
has them. Both files now describe what actually changed — including the part a
reader would otherwise get wrong, that Upload File's `bucket`/`path` are
Supabase-only and `collection`/`recordId`/`field` are PocketBase-only.

**Run both. The cheap gate is not a subset of the expensive one.**

---

## 10. What the orchestrator must land

### 10.1 The four `noodl.byob.*` deletions — not touched, as instructed

When they land, **`duplicate-labels.test.js` will fail**, deliberately. Empty
`PENDING_TYPE_DELETION` (all three entries) in
`packages/noodl-runtime/test/duplicate-labels.test.js`. The test prints the exact
list it found, so the diff is mechanical. Nothing else in this task needs editing.

After that, **exit criterion 2 is met** — and not before.

Also worth doing in that commit, both one-liners and both this task's findings:

1. ⚠️ **Add `net.noodl.user.RequestMagicLink` and `net.noodl.user.SignInWith` to
   `nodelibraryexport.ts`'s picker index** (§1.3). They are registered, not
   deprecated, and unreachable from the picker. You are already in that file.
2. `docs/node-catalog/enrichment/noodl.byob.*.json` — four files to remove, plus
   `relatedNodes` references to them in `dbmodel2.json`,
   `setdbmodelproperties.json`, `newdbmodelproperties.json`,
   `deletedbmodelproperties.json`, and the examples `cloud-byob-crud.json` and
   `cloud-byob-live-refresh.json` (referenced from `dbcollection2.json:28`). The
   enrichment layer is left untouched here as asked.

### 10.2 Nothing else is owed to me

No other worker needs anything from this task, and this task needed nothing from
Worker A beyond the merge. `record-ports.ts` was not changed on anyone's behalf.

### 10.3 On the deploy-bundle warning

**None of this gating is claimed at deploy level, and none of it can be.** It is
entirely editor-side: the descriptor, the gate, the three surfaces and the probe
cache all run in the editor renderer. Nothing in `noodl.deploy.js` changed and
nothing needs rebuilding. The runtime's own refusals (`realtimeSupportFor`,
`CAPABILITY_UNAVAILABLE`) are BCN-008's and are unchanged.

---

## 11. Could not verify

Stated plainly rather than implied.

1. **The picker card's rendering was never seen on screen.** The reason, the
   `is-unavailable` class and the dimmed/badged styling are in the build and the
   logic is unit-covered, but no screenshot shows a marked card. §1.3 is why:
   the two most gated nodes are not in the picker.
2. **`degraded` was never rendered live.** Every gate exercised in §7 was
   `unsupported`. The `degraded` path is unit-tested in both packages (annotated,
   not disabled) and has no live evidence. `relations.addRemove` on Directus and
   `data.increment` on Supabase are the cases to drive.
3. **The `data.aggregate` probe never ran against a real server.** Only
   `realtime.subscribe` did. Supabase's is the sole `data.aggregate` conditional
   and the rig's PostgREST has aggregates off, so the probe would answer — it was
   not driven, and the branch's shape-check ("a 200 is not a yes") is asserted
   only by construction.
4. **No probe branch exists for any `auth.*` conditional**, of which there are now
   eleven across four descriptors. They resolve unprobed → disabled with the
   descriptor's own hedged sentence, which is correct and safe, but it means the
   affected auth nodes are **permanently** marked on those backends. That is
   honest today (nothing implements Supabase auth) and would become wrong the day
   one does.
5. **The re-probe-on-reconnect path is unit-tested, not lived.** `invalidate()`
   was called explicitly in §7.4; no backend was actually restarted underneath a
   session. BCN-008's own notes are the warning here — a status returning to
   `subscribed` proves less than it looks.
6. **The two-instances-of-one-type case is unit-tested only.** Two Directus
   servers with different WebSocket settings in one project would be the real
   check of per-`backendId` probe keying.
7. **No cloud-function graph was opened**, though `cloud-node-library.json` was
   regenerated and now carries the new labels.
8. **`npm run catalog:examples` and `validate:project` were not run.** The
   validator corpus was not re-driven; `catalog:check` and `catalog:merge:check`
   were, and both are green. The spec asks for the corpus to be error-clean and I
   am relying on the merge gate's coverage rather than on having run the
   validator myself.

---

## 12. Phase 30 is unblocked — what changed under its audit files

Phase 30 deliberately did not start `audit/data.md` (46 entries) or
`audit/cloud-services.md` (22). **Both can now proceed.** ⚠️ Those files are
partly hand-written prose and regenerating the catalog did not regenerate them,
so here is exactly what moved:

### Changed

| What | From | To |
|---|---|---|
| `NewDbModelProperties` picker label | Create New Record | **Create Record** |
| `SetDbModelProperties` picker label | Set Record Properties | **Update Record** |
| Type names | — | **unchanged**, all of them |

Any audit row keyed on the old labels needs re-reading. Rows keyed on type names
do not.

### Not changed, but newly true

- Every node in `NODE_CAPABILITIES` now carries a capability binding that the
  editor renders. An audit of "what does this node do" should read the binding
  and the descriptor cell alongside the ports — the answer is now
  **per backend**, which it was not when the audit files were written.
- `Upload File` and `Sign File URL` gained ports and dynamic ports (BCN-007), and
  their enrichment `runtimeBehavior` now describes which of their inputs are
  Supabase-only and which are PocketBase-only. An audit that reads the static
  port list alone will describe inputs that do nothing on four of six backends.
- `Query Records` carries BCN-008's twelve realtime outputs and the
  `Subscribe To Changes` input. `SubscribeToChanges` no longer exists.

### Still moving — do not audit yet

⚠️ **`noodl.byob.QueryData`, `CreateRecord`, `UpdateRecord` and `DeleteRecord`
are about to be deleted** (§10.1). Auditing those four now documents a library
that is about to change, which is the exact mistake phase 30 held back to avoid.
Everything else in the Data and Cloud Services categories is settled.

### The check phase 30 asked for is now permanent

Its FINDINGS lesson — *"a criterion that says 'no two nodes should read the same'
is a property of the registry"* — is `duplicate-labels.test.js`, one `reduce` over
the registry, with the eleven pairs it found enumerated explicitly. NDA-011
criterion 3 still owns *fixing* the ten deprecated shadows; they can no longer be
lost.

---

## 13. Gate numbers — every one run in this worktree

Baselines from the handover in brackets where they differ.

| Gate | Result |
|---|---|
| `nodegx-backend-contract` | **199 passed, 0 failed** *(169)* |
| `noodl-runtime` | **1740 passed, 0 failed**, 90/91 suites *(1682/1695, 89 suites; the unpassed suite is the env-gated `agent-live-endpoint`, as before)* |
| `noodl-viewer-react` | **379 passed** *(373)* |
| `noodl-editor` `test:ci` | **2000 specs, 0 failures** *(1963)* |
| `noodl-mcp` | **75 passed, 2 failed** — see below |
| `npm run catalog:check` | ✅ 155 node types, 90 with dynamic ports |
| `npm run catalog:merge:check` | ✅ 155/155 documented, 50 examples |
| `npm run cloud-library:check` | ✅ — see below |
| `noodl-editor` `tsc --noEmit` | ✅ 0 errors |
| `noodl-runtime` `tsc --noEmit` | ✅ 0 errors |
| `nodegx-backend-contract` `tsc --noEmit` | ✅ 0 errors |

**Pre-existing failures, verified pre-existing rather than assumed.** Both were
reproduced with this task's changes stashed *and* with the catalog checked out
from `cline-dev`:

- `noodl-mcp` `tools.test.ts` — *"create_component validates, writes and updates
  the registry"*, 3 validation errors. Fails identically on the baseline.
- `noodl-mcp` `tsc --noEmit` — one error in
  `noodl-editor/.../validation/rules/duplicateNodeId.ts(86,9)`, a file this task
  never touched.

**PLAT-004's TSFixme ratchet** was not re-baselined and not run; the handover
records it as inherited-red at `any +26`.

### ⚠️ `cloud-library:check` was RED on `cline-dev` before this task started

Found, not caused, and **it is in CI** (`.github/workflows/pr.yml:144`).
Reproduced on a clean checkout of the branch point: the committed
`cloud-node-library.json` did not match the cloud registry, and the script exits
1. Regenerating it recovers **two missing node types** (`Sign File URL`,
`On App Error`) and missing ports on **22 nodes**, including BCN-008's twelve
realtime outputs on `DbCollection2` and BCN-007's `contentType`/`size` on
`Cloud File`. Cloud-function graphs have been offered a node library several
phases out of date. The regeneration is in this branch.
