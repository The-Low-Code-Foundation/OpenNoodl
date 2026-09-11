# SBR-008 — The deploy keeps the panel's wires

**Fixes finding 7.** 🧭 **Ruled s1: SB-017 §11.4 option 1 — derive it in the runtime, where
the one writer already is.** The deployed admin panel currently drops all 19 record-field
(`prop-`) wires: it writes a page that is published, in the navigation and ordered — with no
title and no slug. Works in preview, breaks on deploy, the worst way round.

## 1. The person sentence

**A client on the DEPLOYED panel edits a title and a slug, saves, and the save saves.**

## 2. The fix, as ruled (SB-017 §11.4, unchanged)

- The viewer is already the single writer for these dynamic ports, and `setDynamicPorts`
  **replaces** — so a fourth `NodeTypeAdapters` class is a second writer and the two erase each
  other. Instead: `recordFieldPorts`'s callers also mint `prop-<field>` **from the node's own
  wires**. Reachable: `ComponentModel.addConnection` emits `inputConnectionAdded` on the target
  node (`componentmodel.ts:149-158`); `NodeModel.inputs`/`.outputs` are the connection lists.
- ⚠️ **Stated cost, accepted in the ruling**: a second copy of the rule (the editor cannot
  import `@noodl/runtime`; `cloudDynamicPorts.ts` imports nothing). The mitigation exists:
  `tests-unit/sb-017/cloud-ports-agree-with-the-runtime.test.ts` is exactly the harness for
  grading two copies against each other — extend it to this pair.
- Why these 19 exist at all (SB-017 §12, keep in mind while fixing): `prop-<field>` is derived
  from the **columns of a class**, and a site nobody has written to has none. The wire-derived
  answer is satisfiable from the project alone — the same answer §10.2 took on the cloud side.

## 3. Acceptance criteria

1. **(person)** Deploy the template to a folder, serve it, claim, edit title+slug, save — the
   record has the new values and the public site renders them.
2. The warnings-chip census reads **0** (from 19). The census spec asserts the new number the
   same way s19's did — pinned to a reading, so a regression moves it visibly.
3. `sb017-deploy-connection-parity.test.ts`'s `REMOVED_BY_SB018` exemption is revisited
   deliberately: the shortfall list should now be empty or renamed to what remains — never
   silently widened.
4. The two copies of the derivation rule are graded against each other (extended agreement
   harness), with a mutant in each direction.
5. Preview behaviour is unchanged (the class-column derivation still works when columns exist)
   — the control pair varies only the deploy.

## 4. Traps

- 🔴 Two producers meeting = assert cardinality where they meet: if both the class-column and
  wire-derived paths mint the same port, it must exist once, not twice (the
  check-in-a-second-pipeline trap — counts doubled, suites green).
- 🔴 The export's health filter keeps meaning what it says (option 3 stays rejected) — the fix
  is runtime-side; do not touch the exporter's wire filtering.

---

## 5. 🔴 s16 (2026-08-29) — the symptom is NOT paid, and two premises in §2 are wrong

s15 recorded, as an observation rather than a closure, that *"SBR-008's symptom did not
reproduce"*: the `Page` row created on `SBR-016 Arrive Drive` carried `title` and `slug`. s15 was
right to hold it open. **Re-measured asking "is this reading right?" rather than "is it stale?",
it is not evidence that anything has been fixed** — and the measurement that shows why also
corrects the task's own framing.

### 5.1 The two fixtures are the same project, measured on every static axis

| axis | `SBR-017 Sign In Drive` (no title/slug) | `SBR-016 Arrive Drive` (title/slug) |
|---|---|---|
| `/Pages/Admin` `prop-` wires | `closeResult-title → prop-title`, `closeResult-slug → prop-slug` | **identical** |
| `/Admin/NewPageDialog` graph | 20 nodes, 4 connections | **identical but for node ids** |
| `nodegx.security.json` | — | **byte-identical** |
| project metadata keys | `initialOpenComponent`, `designTokens`, `cloudservices` | **identical** — neither carries `dbCollections` or `backendServices` |
| provisioned `Page` columns | `published`, `showInNav`, `navOrder` | **the same three** (see §5.2) |
| product code on the `prop-` path | — | **no commit** touched `record-ports.ts`, `schema-ports.ts`, `exporter/util.ts` or `NodeGraphModel.ts` after 08-28 12:00 |

🔴 **So the difference is not in the project, and not in the product.** Whatever decided the two
outcomes was session state.

### 5.2 The provisioned baseline is three columns, and that is excluded rather than assumed

`_Schema.Page` in the 016 backend lists five columns with `updatedAt` equal to the write, so on
that fixture alone "provisioned with five" and "provisioned with three, grown by the write" fit
equally. They are told apart by the other fixture: provisioning runs the same code over the same
template in both, so the provisioned set is the same set — and 017 shows that set carrying **no
`title` and no `slug`**, which a write can only add to, never remove. **Therefore 016's write
carried `title` and `slug` into a class that had no such columns at the time.**

### 5.3 🔴 §2's first premise is wrong: it is one filter, and preview is behind it

The task says *"Works in preview, breaks on deploy, the worst way round."* Preview is on the same
side of the filter as the deploy. `exportComponent` (`utils/exporter/util.ts:61`) drops every
connection `getConnectionHealth` calls unhealthy, and **every** path reaches it:

- the viewer's component bundles — `editorapi.js:88` → `exportComponentBundle` → `json.ts:217`
- incremental preview updates — `ViewerConnection.ts:993`
- the full project export and the deploy — `json.ts:159`/`:178`, `deployer.ts:108`

There is one filter with three callers, not a deploy-only one. This matters beyond wording: **the
three preview observations of a nameless row (s9 §5.6, s12, s14 §6.5) were filed against a
deploy-only defect and are not evidence of one.** They are evidence of this filter, on the preview
caller.

### 5.4 🔴 §2's second premise is wrong: the filter does not read the port set

`getConnectionHealth` (`NodeGraphModel.ts:662`) reads no ports. It asks `WarningsModel` whether a
warning is currently recorded, and **returns `healthy: true` when none is** — including when none
has been evaluated yet. The warning it looks for, `con-no-target-port`, is written by
`evaluateConnectionHealth` on a **debounced** pass: `EVALUATE_HEALTH_DEBOUNCE_MS` ≈ 2 s lazy,
50 ms on the urgent lane that a viewer's arriving ports arm. Nothing on any of the three export
callers forces `evaluateHealth()` first — `grep evaluateHealth` over the editor finds no caller in
the deploy path, the bundle path or `ViewerConnection`.

**So what a build contains is a function of when the build was taken relative to the last health
pass, not of what the project says.** Both readings — s14's dropped wires and s15's kept ones —
are what that mechanism produces, and neither discriminates.

### 5.5 What this does and does not establish

✅ **Established.** The two fixtures are the same project; 016's write reached a class with no
matching columns; the export filter is shared with preview and reads a debounced store that
nothing forces to settle. **s15's observation cannot close AC1, and cannot unblock anything.**

❌ **Not established.** *Which* timing obtained in each session. The debounced store is the only
session-dependent input I can find on the path, and it is a candidate, **not a confirmed cause** —
it predicts a race that has not been observed live. Recording it as the cause would be the
reading-that-fits trap this phase keeps paying for.

**The discriminating measurement, for whoever takes this next:** on `SBR-016 Arrive Drive`, create
a second page *late in a settled session* — same fixture, same act, one variable (when in the
session the create happens). A row that arrives nameless confirms the timing account and closes
the question; a second named row refutes it and sends the search back to the fixtures. It is also
the second row **SBR-006 AC1** has been waiting for, so the drive pays twice.

### 5.6 Consequences for this task

- **AC1 is unchanged and unmet.** The person sentence still needs a deployed panel that saves.
- 🔴 **AC5's control pair needs a third variable.** It says *"the control pair varies only the
  deploy"* — but preview and deploy share the filter, so a pair that varies only the deploy varies
  nothing on the path that drops the wires. It must hold the health pass constant, or force it.
- The fix itself (§2, ruled: derive `prop-` from the node's own wires) is untouched by all of this
  and remains right. It removes the *cause* of the warning; §5.4 is about a second defect that
  survives it — see **D13**.

### 5.7 🔴 The spec this task's census rests on was not measuring anything — and its control could never have caught it

Running `tests-unit/sb-017/the-browser-half-drops-every-record-field.test.ts` while checking §5.3:
**one red, with a completely blank message.** The failing case is its central one —
*"🔴 the runtime announces NO `prop-` port for any Record node in this template"*.

The cause is not a port. `dbmodelcrudbase.ts` uses the bare global
`_noodl_cloud_runtime_version`, declared only in `noodl-runtime/src/globals.d.ts`, and the file
carried no `/// <reference>` to it. Required from **noodl-editor's** jest program the declaration is
out of scope, so ts-jest threw `TS2304` at require time for **six of the seven** Record nodes in the
template. The spec caught nothing and asserted on an empty array it never filled — *"the runtime
announces no `prop-` port"* was the module failing to load, dressed as a measurement. **ts-jest
renders that `TSError` with an empty message**, which is why the red said nothing and reads exactly
like a flake.

🔴 **And the known-firing control could not have caught it, because it is in a different module.**
The next test — *"…and the same instrument DOES announce the families the browser keeps"* — was put
there for precisely this failure mode (*"the runtime announced nothing, because the harness never
ran it"*) and it passes, because `storageFetch` and `in-`/`out-` come from the Query and script
families, whose modules compile fine. **A control has to be scoped to the population the rule is
about**; this one proved the harness worked for nodes the rule was not about.

✅ **Fixed here**, one line, on the precedent `TokenLifecycle.ts` and `ParseWireAdapter` already
set: a `/// <reference path="../../../globals.d.ts" />` at the top of `dbmodelcrudbase.ts`. With the
modules actually compiling, all **seven** Record nodes announce **no `prop-` port**, and
`tests-unit/sb-017/` is **12/12 green**.

⚠️ **What that changes, and what it does not.** The census claim is now *measured* rather than
inferred from a throw, so §5.1–§5.6 are unaffected and the artefact-level deadlock is confirmed on
the shipped template. It sharpens the contradiction rather than resolving it: `/Pages/Admin`'s
`create` announces no `prop-title`, and the 016 fixture still wrote one. **The timing account in
§5.4 remains the candidate, and remains unconfirmed.**

---

## 6. 🟢 s17 (2026-08-29) — the mechanism was driven, and the fixture the drive was asked for no longer exists

§5.5 asked for a drive: *"on `SBR-016 Arrive Drive`, create a second page late in a settled
session"*, on the stated grounds that this varies **one** thing. **It does not, any more.** The
confound and the mechanism were both measured, live, in one editor session.

### 6.1 🔴 The flip, watched happening — D13 is a cause, not a candidate

A probe was armed **before** the project was opened and sampled the editor once a second: the
`/Pages/Admin` `prop-` wires' target ports, their `getConnectionHealth` verdict, their
`WarningsModel` entries, and what `exportComponent` would return **if a build were taken at that
instant**. 90 samples. No edit was made at any point.

| sample | wall clock | `targetPortExists` | `healthy` | warning | `exportComponent(/Pages/Admin)` | project census |
|---|---|---|---|---|---|---|
| 6 | 14:17:01.6 | **false** | **true** | — | **13 connections** | **32 prop wires, 32 healthy, 0 unhealthy** |
| 7 | 14:17:02.7 | false | true | — | 13 connections | 32 healthy |
| 8 | 14:17:03.9 | **false** | **false** | `con-no-target-port` | **11 connections** | **32 prop wires, 13 healthy, 19 unhealthy** |
| 9–90 | →14:18:32 | false | false | `con-no-target-port` | 11 connections | 13 healthy |

🔴 **Two builds of the same project, 2.3 s apart, differ by 19 connections.** The ports are absent
in *both* rows — `targetPortExists: false` at 14:17:01.6 and at 14:17:03.9 — so nothing about the
port set changed. What changed is that the debounced pass landed and wrote the warning
`getConnectionHealth` reads. **That is the whole of D13, observed rather than inferred**, and the
lost count is exactly the **19** this task's header names.

✅ **The instrument reports both values.** The 32/32 reading at sample 6 and the 13/32 reading at
sample 8 come from the same code path in the same session, so neither is the probe's floor — the
"before" row is the negative control the "after" row needed.

### 6.2 The same thing again, through the product, into the running app

`ViewerConnection.instance.sendRefresh()` — the editor's own preview refresh — was called at
14:21:53 with no edit before or after it. Read on the **viewer's** own graph model:

| | connections in the running app | `prop-` wires |
|---|---|---|
| build the preview had been running since load | **221** | **19** |
| after one refresh | **202** | **0** |

The preview had been running, the whole time, on a build containing 19 wires the editor already
called broken. One refresh and they were gone from the live app. **§5.3 is confirmed from the other
side: this is not a deploy property.**

### 6.3 🔴 The third state, which nothing had recorded: the defect heals itself

Between 14:18:32 (last sample, `dbCollections: undefined`) and 14:22:57 the project's metadata
gained a `dbCollections` key, and with it:

```
Page:[published,showInNav,navOrder,title,slug]   SiteSettings:[siteName,homeSlug]
Theme:[tokens]                                   Section:[order,pageId]
```

and the `/Pages/Admin` wires read **`targetPortExists: true`, `healthy: true`** — the census moving
**19 unhealthy → 4 unhealthy**, again with no edit to the project.

`SchemaHandler` (`utils/schemahandler.ts:72`) fetches the built-in backend's schema on
**`window-focused`** and `Model.cloudServicesChanged`, and `_store()` writes it to
`ProjectModel.setMetaData('dbCollections')`. `resolveSchemaPortContext`
(`schema-ports.ts:501`) reads exactly that key, and `recordFieldPorts` mints one `prop-<field>` per
column of the selected class. **So a column that exists produces a port, a port makes the wire
healthy, and a healthy wire survives the build.**

🔴 **Which means the fixture §5.5 named is not the fixture s15 drove.** s15's own write created
`Page.title` and `Page.slug` (§5.2), and those two columns are what now heals these two wires. A
second page created on it today arrives **named for a reason that has nothing to do with timing** —
so the proposed drive is over-determined and cannot discriminate. It was run anyway, twice, and
both rows came back named:

| | act | row |
|---|---|---|
| **arm A** 14:20:36 | create, on the build the preview had loaded with (wires present) | `Arm A Early Build` / `arm-a-early` — **named** |
| **arm B** 14:22:26 | create, after the refresh above (wires absent at 14:22:00) | `Arm B Settled Build` / `arm-b-settled` — **named** |

⚠️ **Arm B is not evidence about timing and is not reported as such.** The ports had returned
between the census read and the click. **A control pair proves what you varied, and a third
variable moved underneath this one** — recorded because the pair looks decisive and is not.

### 6.4 🟢 The person sentence, failing, with its control on the same screen

The pair the fixture *can* still answer needs no second session and no second project. After the
heal, **four** `prop-` wires remain unhealthy, and they are exactly the fields whose column does
not exist yet:

| component | wire | class | column exists? |
|---|---|---|---|
| `/Pages/PageEditor` | `onTextChanged → prop-seoDescription` | `Page` | **no** |
| `/Pages/PageEditor` | `prop-seoDescription → startValue` | `Page` | **no** |
| `/Pages/PageEditor` | `value → prop-kind` | `Section` | **no** |
| `/Admin/SectionRow` | `out-data → prop-data` | `Section` | **no** |

So `Edit page` carries `Title` (column exists) and `Search description` (column does not) **in one
form, saved by one button, out of one build**. Both were changed and saved at 14:24:59:

| field | wire in the build | result in the record |
|---|---|---|
| `Title` → `About us EDITED` | ✅ present | ✅ **saved** — `updatedAt` `2026-08-29T12:24:59.929Z` |
| `Search description` → `SEO-CANARY-17` | ❌ filtered out | 🔴 **discarded** — no `seoDescription` column, nothing in `_Schema.Page`, and the screen said nothing |

The save reported success. The row updated. The field was never written and there is no column to
write it to. **That is AC1's person sentence failing, driven, with a control that differs from it in
exactly one property**, and it is the first time the symptom has been reproduced beside a field that
works.

### 6.5 What this changes for the acceptance criteria

- **AC1 — still unmet**, and now reproducible on demand without a fresh mint: use a field whose
  column does not exist. §6.4 is the standing repro.
- 🔴 **AC2 is unsafe as written.** It pins the census at *"0 (from 19)"*. In this one session, with
  no edit to the project, that number read **19** at load and **4** four minutes later. **It is not
  a property of the template** — it is a function of how much of the schema has been written and
  whether the editor has focused since. A spec pinning `19` would have gone red on a correct
  project. Pin the number **beside a stated schema state**, or pin it on a project with no backend
  bound at all.
- **AC5 — §5.6's correction stands and sharpens.** A control pair must hold *two* things constant,
  not one: the health pass (§6.1) **and** the introspected schema (§6.3). Varying "preview vs
  deploy" varies neither.
- **The §2 fix is confirmed as the right one.** Deriving `prop-<field>` from the node's own wires
  removes the dependence on a column that does not exist yet — which is precisely the circularity
  `cloudDynamicPorts.ts`'s docblock already documents for the cloud side (*"a fresh site can never
  have the schema its own `prop-` ports would need"*). §6.3 is that same circularity on the browser
  side, where nothing yet fixes it.

### 6.6 ⚠️ A control that read zero for its own reasons, caught by a sibling line

The first viewer census reported **0** `prop-` wires while the line above it, in the same probe,
listed `closeResult-title -> prop-title` among the connections. The viewer's connection shape is
`{sourceId, sourcePort, targetId, targetPort}`; the editor's is
`{fromId, fromProperty, toId, toProperty}`. The census filtered on the editor's names against the
viewer's objects and matched nothing. **A zero from the wrong field name is indistinguishable from a
zero that means "the wires were dropped"** — and this one would have read as confirmation. It was
caught only because two lines of one probe disagreed. The corrected census is the **19** in §6.2.

---

## 7. 🟢 s18 (2026-08-29) — the fix is built, and §2 named the wrong field

The §2 ruling is right and is now implemented. Two of the sentences describing *how* were
not, and both were sentences rather than measurements — which is the same shape as the two
premises §5 had to correct.

### 7.1 🔴 `NodeModel.inputs` / `.outputs` are dead fields, and §2 sent the fix at them

§2 says, as its reachability argument:

> `ComponentModel.addConnection` emits `inputConnectionAdded` on the target node
> (`componentmodel.ts:149-158`); **`NodeModel.inputs`/`.outputs` are the connection lists.**

The first half is true. The second is false. `models/nodemodel.ts` initialises both to `[]`
in the constructor and **nothing in the runtime ever writes to either** — searched as
mutations *and* assignments across `noodl-runtime/src`, with the same search shape run for
`.connections` as a known-firing control, which finds `componentmodel.ts`'s `push` and
`splice` immediately. The other packages have no writer either.

🔴 **The claim came from the field's own docblock** — *"Connections into this node.
Populated by `GraphModel`, not by this class."* A comment describing a collaborator that
does not exist, restated into a plan as a fact about the code. It is the
recommendation-carries-a-measurement trap with no measurement in it at all: nobody had read
the field, only its label.

✅ **The real accessor was already in the tree, doing this exact job.** Numbered inputs
derive their port count from what the author wired, and have since long before this phase:

```js
const connections = node.component.getConnectionsTo(node.id).map((c) => c.targetPort);
```

— `nodedefinition.ts:588`, `registerSetupFunctionForNumberedInputs`. The fix uses
`getConnectionsTo` / `getConnectionsFrom`, and both are now named on `ComponentModelLike`
in `@noodl/types` rather than reached through `any`. The dead fields are relabelled at their
declaration so the next reader is not sent the same way.

### 7.2 🔴 The two halves of this fix speak different names for the same wire

The editor's connection is `{fromId, fromProperty, toId, toProperty}`; the runtime's is
`{sourceId, sourcePort, targetId, targetPort}`. `utils/exporter/util.ts` `exportConnection`
renames all four, and **every** path into a runtime goes through it — including the live
preview's per-wire deltas (`viewer-frame`'s `Model.connectionAdded` handler wraps
`e.args.model` in it). So a runtime module reading `fromId` finds `undefined` on every wire,
derives nothing, and reports it as *"there was nothing to derive."*

⚠️ **`site-builder.content.json` holds the EDITOR spelling**, because a template is a
project file and not an exported bundle. Both specs convert on the way in and say why.

🔴 This is §6.6's trap one layer down, and it is now a **graded** one: mutating the runtime
copy to read `fromId`/`toId` reddens **5 cases**. Before this session nothing would have
caught it.

### 7.3 What was built

| | |
|---|---|
| `record-ports.ts` | `recordWiredFieldNames` + `recordWiredFieldPorts` — `prop-<field>` from the node's own `prop-*` parameters and the `prop-*` endpoints of wires touching it, typed `'*'`, skipping any name the schema half already minted |
| `dbmodelcrudbase.ts` | the write nodes' `plug: 'input'` half, no longer gated on `ctx.selectedCollection` |
| `dbmodelnode2.ts` | the Record node's `plug: 'output'` half |
| both | re-push on `inputConnectionAdded`/`Removed` **and** on the component's `connectionAdded`/`Removed` filtered to this node |
| `@noodl/types` | `getConnectionsTo` / `getConnectionsFrom` published on `ComponentModelLike` |

🔴 **Both events are needed and neither covers the other.** `inputConnectionAdded` reaches
only a wire's **target** node (`componentmodel.ts:155-158`), which is the write nodes' case
and *not* the Record node's, whose `prop-*` are outputs. The component-level event carries
both ends. Listening only to the node-level one would have left `DbModel2` never updating —
and every spec here would still have passed, because they call `setup()` and read what it
announces rather than moving a wire.

### 7.4 The rule now exists twice, on purpose, and the pair is graded

`cloudDynamicPorts.ts` `recordFieldNames` (editor, cloud components) and `record-ports.ts`
`recordWiredFieldNames` (runtime, browser components) are the same rule. That is the cost
§2 stated and accepted; the mitigation it named is now in place.
`tests-unit/sb-017/cloud-ports-agree-with-the-runtime.test.ts` runs the **real runtime
modules** over the shipped template's cloud nodes and requires the two to produce the same
`prop-` signature, with `compared > 0` so it cannot pass on two empty lists.

**AC4's mutants, run:**

| mutant | reddens |
|---|---|
| the derivation returns `[]` | **5 cases** |
| the parameter half dropped (wires only) | **1 case** — the agreement |
| the runtime copy reads the editor's field names (§7.2) | **5 cases** |

The mutant *inside* the agreement case had to be chosen rather than taken: `connections[0]`
killed nothing, because most wires are not `prop-` wires and a field that is also a saved
parameter survives losing its wire. It now picks a field reachable **only** through a wire.
🔴 A mutant that kills nothing is a finding about the mutant, and this one was mine.

### 7.5 🔴 The census this task's AC2 rests on was not asking anything

`the-browser-half-drops-every-record-field.test.ts`'s `unresolvedWires()` was documented as
*"a wire is counted when the node that owns the port does not announce it"* — **and it never
asked**. It counted every `prop-` wire unconditionally. That was the right number for as
long as the runtime announced no `prop-` port at all, so it read as a measurement for four
sessions while being an assumption spelled as one; the moment the runtime started
answering, it would have gone on reporting **19** for ever.

It is now split: `recordWires()` is the population (still 19, unchanged by the fix — the
wires were never the problem) and `unresolvedWires()` runs each node's real `setup()` and
asks. **19 → 0.**

✅ **AC2, pinned where §6.5 says it is safe to pin.** This harness states its schema —
`getMetaData` answers `undefined` for every key, no backend, no columns, and none possible —
so the only thing that can move the number is the derivation. The editor's chip cannot be
pinned this way and this does not try to; §6.5 stands.

🔴 **A negative control sits beside the zero**, because `[]` has two readings — *"every wire
resolves"* and *"the census stopped finding anything"* — and they are indistinguishable
from the zero alone. The same instrument is asked about `prop-nothingIsWiredToThis` on the
same node in the same call, and still says no.

### 7.6 Where the acceptance criteria stand

| | verdict | evidence |
|---|---|---|
| **AC1** (person) | ⬜ **not driven** — the code is built, the deploy-and-save drive is not run. §6.4's repro is the acceptance pair and is still standing |
| **AC2** (census 19 → 0) | ✅ **met, in the harness**, beside a stated schema state — §7.5 |
| **AC3** (parity exemption) | ⚠️ **the AC names a constant that does not exist.** There is no `REMOVED_BY_SB018`; the list is `REMOVED_SINCE_THE_BUNDLE` in `tests/cloud/sb017-deploy-connection-parity.test.ts`, and the string `REMOVED_BY_SB018` appears in the repo **once**, inside a comment in `noodl-mcp/tests/sb006Components.ts` describing the *pattern*. A mention read as a name. The list is about wires the template deliberately **removed** (SB-018 (5), SBR-015) and is cloud-side; this fix is browser-side and should not touch it — **not yet re-run**, see below |
| **AC4** (two copies graded) | ✅ **met** — §7.4, with mutants in both directions |
| **AC5** (control pair) | ⬜ open, and §6.5's correction still governs it |

### 7.7 ⚠️ What has NOT been run, and why

`tests/cloud/sb017-deploy-connection-parity.test.ts` is an Electron spec and needs
`test:ci`, which must run alone. **A peer's `nodegx-backend` jest suite was running for the
whole of this session** (pid 87683, the TPL-001 drive specs), and two package suites at once
produce flakes that read as the change's. The gate is left for the next session, first job,
with nothing else competing.

⚠️ The `tests-unit/sb-017` runs above overlapped that suite. They are pure — no ports, no
database, no fixtures on disk — and the mutant runs discriminated cleanly, so the readings
stand; recorded because "it was green" is not the same claim as "it was green alone".

---

## 8. 🟢 s18 — AC1 DRIVEN. The person sentence passes, with §6.4's control beside it

`SBR-016 Arrive Drive`, the standing repro, on a stack built from HEAD (viewer bundle rebuilt
15:11:37 and confirmed to carry `recordWiredFieldPorts` **before** the drive — a source change
that has not reached the bundle is a drive of the old code).

### 8.1 The four-cell control, on one node, in one call

`/Pages/PageEditor`'s `SetDbModelProperties` (class `Page`). The editor's introspected schema at
that moment — read from `dbCollections`, *before* the save — was
`Page:[navOrder, published, showInNav, slug, title]`. **No `seoDescription`.**

| port | column exists | wired | `node.getPort(...)` |
|---|---|---|---|
| `prop-seoDescription` | **no** | yes | ✅ **true** ← the fix |
| `prop-title` | yes | yes | ✅ true |
| `prop-published` | yes | **no** | ✅ true — the schema half, untouched |
| `prop-neverWiredNoColumn` | no | no | 🔴 **false** |

🔴 **The last row is why the other three mean anything.** Three `true`s are also what a
`getPort` that had started saying yes to everything would produce, and that reading is
indistinguishable from the fix working. The negative control is on the **same node, same call,
same instrument** — the mistake §6.6 caught was a control that read zero for its own reasons, and
this is the same mistake pre-empted in the other direction.

### 8.2 The export keeps every wire, with the health pass forced

`evaluateHealth()` called explicitly before each read, so **D13 is held constant rather than
raced** — which is what §6.5 says AC5's control pair must do:

| component | authored | exported | `prop-` authored | `prop-` kept |
|---|---|---|---|---|
| `/Pages/PageEditor` | 26 | **26** | 13 | **13** |
| `/Pages/Admin` | 13 | **13** | 2 | **2** |
| `/Admin/SectionRow` | 19 | **19** | 1 | **1** |

**Zero unhealthy `prop-` wires** across all three. §6.1 measured `/Pages/Admin` flipping
**13 → 11**; it is now **13 → 13**, and the two wires it used to lose are `prop-title` and
`prop-slug`.

### 8.3 🟢 AC1 — the save saves, and the discarded field is the one that changed

Through the running preview, `/admin/pages` → `Edit` on `About us EDITED` → both fields changed
in one form → one `Save page`:

| field | column existed | result |
|---|---|---|
| `Title` → `About us ED s18ITED` | yes | ✅ saved |
| `Search description` → `SEO-CANARY-18-FIXED` | **no** | ✅ **saved** — was silently discarded in §6.4 |

```
sqlite> SELECT objectId, title, slug, seoDescription, updatedAt FROM Page ORDER BY updatedAt DESC;
62d8abb8…|About us ED s18ITED|about|SEO-CANARY-18-FIXED|2026-08-29T13:20:56.670Z
5f4bcc4d…|Arm B Settled Build|arm-b-settled||2026-08-29T12:22:26.598Z
3d5d8c25…|Arm A Early Build |arm-a-early ||2026-08-29T12:20:36.881Z
```

And the column and the class schema were **created by this save**:

```
sqlite> PRAGMA table_info(Page);   →  … 9|seoDescription|TEXT
sqlite> SELECT name, updatedAt FROM _Schema;
Page    | … "seoDescription","type":"String" …  | 2026-08-29 13:20:56   ← the second of the save
Section | "order","pageId"                      | 2026-08-29 11:07:03   ← unchanged
```

✅ **`Section` is the second control**: a class in the same database, on the same backend, at the
same moment — it did not grow. So `Page` growing is the write, not the backend introspecting or
migrating something on its own.

⚠️ **Scope, stated rather than rounded off.** This is the **preview** caller of the export filter,
not a deploy-to-folder. §5.3 established that preview, the viewer's component bundles and the
deploy are **one filter with three callers** — which is why this is evidence about the filter and
not only about preview — but AC1's literal text says *"deploy the template to a folder, serve
it"*, and that was not done. The mechanism is driven end to end; the deploy caller is inferred
from the shared filter.

⚠️ The two `Arm` rows have an empty `seoDescription` because nobody ever typed one into them, not
because they failed — they are not a before/after control and are not offered as one. The
before-reading is §6.4's drive at `12:24:59`, where the same form on the same row saved `title`
and discarded `seoDescription` with no column to write it to.

### 8.4 Acceptance criteria, closed

| | verdict |
|---|---|
| **AC1** | ✅ **met, driven** — §8.3, with a control differing in one property and a negative control on the instrument |
| **AC2** | ✅ **met** — 19 → 0, beside a stated schema state (§7.5) |
| **AC3** | ✅ **un-widened**, and the AC named a constant that does not exist (§7.6) |
| **AC4** | ✅ **met** — two copies graded, mutants both directions (§7.4) |
| **AC5** | ✅ **met** — §8.2 holds the health pass constant by forcing it, which is what §6.5 said the pair had to do |

---

## 9. 🔴 s45 (2026-09-02) — AC1 was met on a fixture that had already healed. On a fresh site the fix could not reach, and now it can

s44's acceptance drive (SBR-014) stopped at step 3 because a page created through the panel on a
**wizard-fresh** site had no title and no slug. Its hand-off named this task's AC1 as the cause and
quoted §6.5's *"nothing yet fixes it"*.

🔴 **That quote is s17's, and §8 superseded it three sections later.** `TASKS.md` has recorded this
row as *"s18: BUILT + DRIVEN — AC1–AC5 all ✅"* since 2026-08-29. So the first job was not to build
the fix again. **The symptom was real; its named cause was not.**

### 9.1 What was measured, before anything was changed

Every static candidate was excluded first, and each reading has its control.

| asked | answer |
|---|---|
| Did the `prop-` path change since the s18 fix? | **No commit** touched `record-ports.ts`, `dbmodelcrudbase.ts` or `dbmodelnode2.ts` since 08-29 |
| Does the fresh project differ from the template? | **No** — `/Pages/Admin` on disk is the template's 13 connections, `closeResult-title → prop-title` included |
| Does the dialog produce the values? | **Yes** — `NavigationClosePopup` declares `results: "title,slug"` and both are wired from `onTextChanged` |
| Does the **runtime** announce the ports for this exact node? | ✅ **Yes** — `prop-title` and `prop-slug`, in both schema states |
| Was the viewer bundle current when s44 drove? | **Yes** — built 21:50, minutes before the drive |

🔴 **So "the export drops the wire as unhealthy" was excluded at its source, and the hand-off's
first job would have been a fix to a non-defect.** The port probe ran the **real runtime modules**
over the failing project on disk, and it discriminates in both directions: `prop-neverWiredNoColumn`
**absent**, `prop-seoDescription` (a real `Page` field, wired on *another* component) **absent**, and
a mutant with the `prop-` wires stripped announces only the three parameter-derived ports. Three
`yes`es beside two `no`s and a killed mutant, which is what makes the `yes`es mean anything.

### 9.2 The editor and the runtime disagreed, and the editor is what the exporter asks

Driven in the live editor on `sbr014-drive`, with `flushEvaluateHealth()` forced so D13 is held
constant rather than raced:

```
closeResult-title -> prop-title    healthy: false   "Target port doesn't exist."
closeResult-slug  -> prop-slug     healthy: false   "Target port doesn't exist."
```

And the create node's ports, as the **editor** holds them:

```
prop-published, prop-showInNav, prop-navOrder          ← exactly its three saved parameters
```

**`prop-title` and `prop-slug` are absent — and they are exactly the two that exist only as wire
endpoints.** The census over the whole project: **43 `prop-` wires, 19 unhealthy** — the same 19
this task's header has named since it was written.

⚠️ **The 19 account for both of s44's symptoms, and the second one this task's story never
covered.** `/Pages/PageEditor` loses `onTextChanged → prop-title` *and* `prop-title → startValue`,
in both directions — so the page editor's form cannot be filled from the record and its save writes
**nothing at all**, which is what s44 measured (`updatedAt` did not move) and what "a field is
silently lost" does not describe.

### 9.3 🔴 The loop, and why §8's drive could not have seen it

`recordWiredFieldPorts` mints `prop-<field>` from `component.getConnectionsTo(node.id)` — the wires
of the component the **runtime** holds. That component reached the runtime through
`exportComponent`, which drops every wire the editor called unhealthy. So:

```
editor health  →  exported wires  →  runtime ports  →  editor health
```

The wire is dropped, the runtime never sees it, the port is never minted, and the verdict stays
true **for ever**. The wire half could only ever recover fields that are *also* saved parameters —
which is precisely the three ports the editor had.

✅ **`NodeGraphModel.ts`'s own `URGENT_EVALUATE_HEALTH_DEBOUNCE_MS` docblock already describes this
verdict as *"correct and temporary — the ports do not exist until the running viewer mints them and
pushes them back."*** It is temporary in every case but this one, and nobody had noticed the case
where the pushing back can never happen.

🔴 **Why §8 read green.** Re-reading §8's own recorded numbers rather than re-measuring: §8.1 states
the introspected schema at that moment was `Page:[navOrder, published, showInNav, slug, title]`. So
the **schema** half minted `prop-title` and `prop-slug`, those wires were healthy, the component
exported intact — and the runtime therefore saw *every* wire on the node, including the
`prop-seoDescription` one. The wire half worked because the bootstrap had already happened by other
means. **§8 graded the fix on a fixture that had healed itself (§6.3), so the one case the fix
exists for was never exercised.** That is this phase's own budget-on-a-fixture lesson, and §8 is
where it bit.

### 9.4 The fix — one break in the loop, at the verdict

The loop has to be broken exactly once, and two of the three places were already ruled out by this
task: not in `exportComponent`'s filter (**§4's trap** — it keeps meaning what it says) and not by
minting the port in the editor (**§2** — `setDynamicPorts` replaces, so a second writer erases the
runtime's). What is left is the **verdict**, which is also the only one of the three that is simply
*wrong*: a wire into a `prop-` port is the author declaring the field, which is this task's whole
ruling.

| | |
|---|---|
| `dbmodelcrudbase.ts` | the write family declares `wireDeclaredPortPrefix = 'prop-'`, beside `_hasInputProperties` |
| `dbmodelnode2.ts` | the Record node declares the same, for its `prop-*` **outputs** |
| `nodedefinition.ts` | carries it into `metadata` |
| `nodelibraryexport.ts` | carries it into the library the editor receives |
| `@noodl/types` | the field, documented on both declaration sites |
| `NodeGraphModel.ts` | `isWireDeclaredPort` — `con-no-source-port` / `con-no-target-port` are not raised for such a port |

**The runtime stays the only thing that mints a port.** This only stops the editor calling the wire
broken before it can.

⚠️ **The stated cost, which is the ruling's own.** A mistyped `prop-titel` no longer reddens.
`record-ports.ts`'s docblock accepts exactly this for the runtime half — *"the wire does register
the port at run time"* — and the warning was only ever correct while the port set came from the
schema alone. Scoped by prefix **and** by node type, so nothing else on the canvas loses a warning.

### 9.5 🟢 AC1 driven on a wizard-fresh site — the case that was deadlocked

Same fixture, same wizard-created project, through the panel's UI.

✅ **The input path was proved with a known-firing signal first**: signing in through the same
`cdp type` mechanism succeeded, so the typed text reaches the graph. Without that, "the value never
arrived" and "the harness never typed it" are the same reading — and s44's two input methods shared
one failure mode.

| | before the fix | after |
|---|---|---|
| create node's `prop-` ports | 3 (its parameters) | **5** — `prop-title`, `prop-slug` minted from wires |
| `prop-` wires unhealthy | **19** of 43 | **0** of 43 |
| page created through the dialog | no title, no slug | ✅ `title: "Bootstrap Proof"`, `slug: "bootstrap-proof"` |
| `Page` columns | 7 | **9** — `title` and `slug` *created by that write* |
| page editor's save | `updatedAt` did not move | ✅ moved `20:59:42.785Z` → `21:01:10.063Z` |
| `seoDescription` (no column) | discarded silently | ✅ **saved**, column **created by that save** (9 → 10) |

✅ **The two rows s44 created are still in the table, `title` and `slug` `null`** — the same product
path, the same class, before the fix. A before/after control that needed no constructing.

✅ **The second control is the rest of the database**: `_Schema.Page` moved to the second of the
save (`21:01:10`) while `SiteSettings`, `Theme`, `Section` and `_User` did **not** move. So `Page`
growing is the write, not the backend introspecting or migrating on its own.

Picture: `notes/sbr008/sbr008-ac1-bootstrap-named-row.png` — two blank rows above a named one, in
one frame. ⚠️ 988×313 css px; the preview window cannot be resized from this tooling, so it is
evidence, not a look verdict.

### 9.6 How the fix is graded, and the two controls that failed first

`test/nodelibraryexport.wire-declared-ports.test.ts` (3 specs) grades the **runtime → editor hop**,
which is where this field was silently swallowed **twice** while being built — once by
`defineNode`'s metadata whitelist and once by `generateNodeLibrary`'s. That is the same hole
`nodelibraryexport.port-descriptions.test.ts` exists for.

**Mutants, run:**

| mutant | reddens |
|---|---|
| dropped from `defineNode`'s whitelist | **2 of 3** (the negative control correctly stays green) |
| dropped from `generateNodeLibrary`'s copy | **2 of 3** |
| dropped from the crud mixin only | **1 of 3** — and it names which, discriminating the mixin from the Record node's own declaration |

🔴 **Two controls read wrong before they read right, and both are the same mistake in different
clothes:**

1. **Fabricated wires read "healthy".** Asking `getConnectionHealth` about connections that are not
   in the graph returned `healthy: true` for three deliberately-broken descriptors — it reads a
   `WarningsModel` keyed by real connections, so an absent wire has no warning. **A control that
   reads zero for its own reasons**; it would have read as "the fix suppresses everything."
2. **The live mutant killed nothing, and that is not a failure.** Stripping the flag from the node
   types in the running editor left all 43 wires healthy — because by then the runtime **had**
   minted the ports, so the wires are healthy on their own merits. The flag is load-bearing only
   during the bootstrap, and **a healed fixture cannot grade it.** This is §6.3's over-determination
   in a new guise, and it is why the grading is a spec and not a live mutant.

### 9.7 Acceptance criteria, restated honestly

| | verdict |
|---|---|
| **AC1** | ✅ **met** — and now met in the bootstrap case, which §8 could not have exercised (§9.3). §8's reading was true of its fixture and is left standing as such |
| **AC2** | ✅ unchanged — 19 → 0 in the harness; and the *project* census moved 19 → 0 for the first time on a fresh site (§9.5) |
| **AC3** | ✅ unchanged |
| **AC4** | ✅ unchanged, and extended — the runtime → editor hop is now graded too, with three mutants (§9.6) |
| **AC5** | ✅ unchanged — the health pass was forced for every reading here, as §6.5 requires |

⚠️ **What is NOT claimed.** This is the **preview** caller again, not a deploy-to-folder; §5.3's
one-filter-three-callers argument is what carries it to the deploy, unchanged and still an
inference. Suites: `noodl-runtime` **149 suites / 2632 tests, exit 0**; `tsc` clean on
`noodl-runtime` and `noodl-editor`, both gated on exit status. `tests-unit/sb-018` has **3
pre-existing failures** — verified identical with these six files reverted to HEAD, so they are
**not this change** and belong to whoever owns that template's standing values.

### 9.8 ⚠️ s45's fix was necessary and NOT sufficient — and the second blocker had the same shape

s45's hand-off said *"step 3 is unblocked — the blocker is fixed and driven"*. 🔴 **That was an
overreach and the record should say so.** What was fixed and driven is this task's AC1: the create
and the save keep their `prop-` wires, measured end to end (§9.5). **Step 3 also authors five
section kinds**, and s45 drove neither of those halves before calling the step unblocked — it
generalised from the blocker it had measured to the step as a whole.

s46 found the rest: `/Admin/SectionRow`'s script returned **before `Outputs.built()`** whenever the
section had no `data`, which is every section the panel creates. Fixed there; the drive reached
**step 6 of 8**.

🔴 **Worth more than the correction: it is the same shape, one layer up.** A step is gated on a
value; the thing that would produce the value is skipped precisely in the state where it is needed;
so the state can never leave itself. §9.3's loop is that shape in the port derivation, and this one
is that shape in the template's own script. **Two independent instances in one day, in one
feature** — see the memory note `a-derivation-fed-by-its-own-gate-cannot-bootstrap`. When one is
found, look one layer up and one layer down before declaring the path clear.

✅ **The right claim for a fix like this**: *"the blocker I measured is gone, measured this way"* —
never *"the step is unblocked"*, unless the step was driven to its end.

---

## 🟢 s47, 2026-09-03 — driven on the DEPLOYED artefact, end to end

Driven inside SBR-014 step 7 — full record:
[`notes/sbr014/SBR-014-DRIVE-2026-09-03-s47.md`](notes/sbr014/SBR-014-DRIVE-2026-09-03-s47.md).

The artefact was the folder `deployToFolder` produces (`deploy-from-disk.cjs`, endpoint 8604),
served statically. **Nothing in this run went through the editor.**

1. `/admin/signin` on the deployed bundle → `POST /login` → `/admin/pages`, *"Four pages, two
   published"*. **The deployed panel is live.**
2. The page editor's Title field **arrived populated from the stored row** — the panel reads the
   record, not a cached echo.
3. Retitle + `Save page` → **one `PUT`** carrying `title`, `slug`, `seoDescription`, `navOrder` and
   `showInNav` **together**. Zero console errors.
4. **Read back from the row**: the new title landed and `seoDescription` still reads
   `SEO-CANARY-S45`. **Nothing was dropped** — the exact loss this task exists to prevent.
5. A **separate anonymous Chrome** (fresh profile, empty `localStorage`, verified) shows the new
   title in the deployed site's nav. Before and after on the same instrument.

✅ **The deploy's health filter was proved alive, not merely green.** `droppedByHealthFilter: 0` on
the real deploy, and the `--sabotage` control drops **exactly 1** connection and names it
(`/Admin/MessageRow`). A zero from a filter that never ran and a zero from a filter that found
nothing are byte-identical otherwise.

📷 `notes/sbr014/s47-step7-deployed-public-retitled-full.png`,
`s47-step7-deployed-panel-retitled.png`, `s47-step7-deployed-admin-pages.png`.

⚠️ **But the deploy does NOT keep every wire** — see
**[D54](DEFECTS-THE-SITE-BUILDER-FOUND.md#d54)**: the theme editor's preset buttons fire in the
editor preview and do nothing in the deployed bundle, while `Save theme` on the same screen works.
That is this task's family, and it is not diagnosed.
