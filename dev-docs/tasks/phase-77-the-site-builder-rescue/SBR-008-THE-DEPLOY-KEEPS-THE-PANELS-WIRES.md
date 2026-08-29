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
