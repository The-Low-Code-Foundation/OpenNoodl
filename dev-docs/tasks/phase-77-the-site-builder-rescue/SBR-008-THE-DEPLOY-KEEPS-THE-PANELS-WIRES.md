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
