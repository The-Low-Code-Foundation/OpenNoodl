# Defects the site builder found

**Richard, 2026-08-28** (stated on phase 78, and general): *"If you find a problem with the
codebase or MCP or whatever, add it to the next session prompt to fix please. We're making
templates to surface bugs and issues with the whole NodeGX concept as well."*

Phase 77 had no such file for its first ten sessions — its product findings were recorded inside
task files as notes and acceptance criteria, which is where they go to be *understood* and not
where they go to be *fixed*. This is the standing register for phase 77, and the sibling of
[phase 78's](../phase-78-the-templates/DEFECTS-THE-TEMPLATES-FOUND.md).

🔴 **Scope: the product, not the template.** A wire missing from the site-builder's own graph is
a template fix and belongs in an SBR task. A row here is something **any** NodeGX user hits.

## 🔴 The objective, so it survives a prompt rewrite

**Richard, 2026-08-29:** *"Part of the main objective of creating this template is to uncover
bugs a builder might experience using NodeGX and fix them."*

Uncovering is the half that is working. **Fixing is the half that is not**: at the time this
file was created, across phases 77 and 78 there were ~20 unresolved rows and **one** named an
owning task. So:

- 🔴 **Every row carries an owner, or the literal `NONE`.** `NONE` is not a status, it is a
  backlog item — a row that is recorded and unowned has been left behind, it just takes longer
  to notice.
- 🔴 **Every row says product or template.** A fix in this template's graph helps one template;
  a fix in `validate.ts`, the runtime or the editor helps every builder. Only the second one is
  the objective.
- 🔴 **A template-scoped test does not close a row.** SBR-015 is the worked example and D1 is
  left open because of it.
- ⚠️ **Sweep both registers each phase-end** — this one and
  [phase 78's](../phase-78-the-templates/DEFECTS-THE-TEMPLATES-FOUND.md). Ids drift (phase 78
  carried two different `D10`s), and a register nobody re-reads is a notebook.

## ✅ SWEPT 2026-08-29 — every row below now has an owner

[THE-SWEEP-2026-08-29.md](THE-SWEEP-2026-08-29.md) re-measured all three registers **at HEAD** —
this one, phase 78's, and **phase 76's 28 findings, which had no register at all** (Richard:
*"don't forget phase 76"*). The unowned product rows became
**[phase 80](../phase-80-the-defects-the-templates-found/TASKS.md)**, ranked by who they bite.

Six rows came back different from how they were written. In this file:

| row | what changed |
|---|---|
| **D2** | cause **corrected for the third time** — the cloud path *does* call the recorder, from the `Log` node handler only |
| **D4** | 🔄 **reclassified as TEMPLATE work** — `failure` and `error` both exist; the site builder never wired them |
| **D6** | ❌ **cause REFUTED** — `maxWidth` *is* a declared port the door knows. Symptom unexplained |
| **D8** | = **phase 76's F15**. The same defect, found twice, unowned in both |
| **D5** | real **and deliberate** (Richard's 2026-08-06 decision); the residual is the disk/load seam |
| **D1, D3, D7, D10** | confirmed real at HEAD, unchanged |

## House rules

- 🔴 **A row is a measurement, not an impression.** Say what was done and what happened.
- ⚠️ **Disproved candidates stay, marked.** They stop the next person re-deriving them.
- Each row names **where it bites a person**.
- Each row says whether it has an **owner**. "No owner" is the thing this file exists to fix.

---

## D1 — 🔴 Nothing anywhere warns that a node's `Failure` reaches nobody

**Severity: high. Owner: [DEF-002](../phase-80-the-defects-the-templates-found/DEF-002-THE-DOOR-DOES-NOT-CHECK-CONNECTIONS.md)** (assigned 2026-08-29). Found by SBR-015 (s10).
✅ **Re-measured at HEAD 2026-08-29: still real.** `validate.ts` holds 8 occurrences of "failure" and every one is the `StructuralFailure` type or an unrelated comment.

In a cloud function a `Failure` that reaches no `noodl.cloud.response` is not a degraded
result — it is a **thirty-second hang**, because the request only ends when something sends.
`publishPage` and `duplicatePage` shipped in a real template with **zero** failure wires between
them, and neither the door nor the editor said a word.

Measured:

| where a check could live | what is there |
|---|---|
| MCP door (`noodl-mcp/src/validate.ts`) | **no rule about outcome or failure wiring** — the word `failure` appears twice, both unrelated |
| editor warnings (`WarningsModel`) | nothing for an unconnected outcome port |
| runtime | NDA-012 / ERG-001 made every node **report** a failure on its outcome ports and the error channel — but nothing checks that an author **wired anyone to listen** |

🔴 **The Failure Contract solved the half that was in the runtime's gift and left the half that
is in the author's.** A node that reports perfectly into an unwired port is exactly as silent as
one that never reported.

**Where it bites:** an admin clicks Publish, watches a spinner for thirty seconds, is told
nothing, and the page is not published. The one outcome downstream cannot react to.

**Suggested shape:** a door diagnostic — `failure-reaches-nothing` — over any component holding a
`noodl.cloud.request`. SBR-015 ships this rule as a **template-scoped test**
(`sb007Template.test.ts`), which protects this one template and no user. ⚠️ Grade the failure
**edge**, not the node: "does this node reach a Response?" is true of every node on a happy path
and would pass the unfixed graph. Same family as phase 78's D1.

## D2 — 🔴 A cloud function's node steps are never recorded, so the execution log cannot say *where* it hung

**Severity: medium-high. Owner: [DEF-004](../phase-80-the-defects-the-templates-found/DEF-004-WHEN-IT-GOES-WRONG-YOU-CANNOT-SEE-WHERE.md)** (assigned 2026-08-29). Found by SBR-015 (s10).

🔴 **THE CAUSE BELOW IS WRONG — third wrong reading of this row.** The cloud function path **does** call the recorder: `WorkflowRunner.ts:261` is inside the **`Log` node handler**, writing one step per author log line with `nodeType` hardcoded to `net.noodl.Log`. The site-builder template holds **zero** `Log` nodes, which is the whole explanation of "3 executions, 0 steps". The true sentence: **`execution_steps` records what the author chose to log, never what the graph ran** — so the fix is smaller than the text below assumes. Kept as written because the correction is the finding.

`executions.sqlite` has an `execution_steps` table with a full schema — `node_id`, `node_type`,
`node_name`, `step_index`, `status`, `error_message`. After the SBR-006 drive it held **3
executions and 0 steps**.

⚠️ **The first two readings of this were wrong and are kept as the correction.** It is *not*
that nothing writes the table, and *not* that the recorder is unimplemented:
`ExecutionLogger.startNode()` / `completeNode()` are complete, and they **do** have callers —
`WorkflowEngine.ts:524` and `WorkflowRunner.ts:261`. The defect is narrower and only visible
once you look for the caller: **step recording is wired to the workflow engine, and a cloud
function's graph is run by a different executor that never calls it.** The execution-level row
*is* written (the dispatcher calls `startExecution`), so the feature is half-wired rather than
absent — which is why the table looks like a bug in the logger and is not one.

**Where it bites:** this table is the fastest way to tell "never called" from "called and
failed", and SBR-006 reached for it first exactly as intended. For a cloud function it can say
*that* one hung and never *where* — which is what made SBR-015 cost a whole session.

## D3 — ⚠️ `completed` reads as success, and the product has already been told so once

**Severity: medium. Owner: [DEF-004](../phase-80-the-defects-the-templates-found/DEF-004-WHEN-IT-GOES-WRONG-YOU-CANNOT-SEE-WHERE.md)** (assigned 2026-08-29). Found by SBR-015 (s10).

`completed` *"fires after every invocation, whatever the outcome"* (`outcome.ts`). Wired into a
record write or a Response's `send` it therefore reports success **after a failure**. In the
shipped template it had been wired into both: `publishPage` marked a page `published` after a run
that set no section's access rules.

🔴 **This is a recurrence, not a discovery.** `outcome.ts`'s own FH-022 / TALK-006 note records
Richard hitting the `done`/`completed` pair on `Condition` and reading two identically-behaving
ports as the vocabulary doubling up. The repair then was **wording**. This is the same confusion
arriving with a data-integrity consequence, which is evidence the wording fix did not reach far
enough.

**Where it bites:** a site owner sees a page listed as published that no visitor can read.

⚠️ **Do not "fix" this by banning `completed`** — two uses in the same file are correct and
documented (an unprovisioned secret must still reach the picker; a bounced mail must still answer
the visitor). The rule is about **where it lands**.

## D4 — ⚠️ A refused query and an empty collection are the same screen

**Severity: medium. 🔄 RECLASSIFIED 2026-08-29 — TEMPLATE work, and not Richard's call.** Owner: **SBR-006/SBR-010**.

🔴 **Phase 78's D4 drove the opposite result and it holds at HEAD.** `DbCollection2` carries a `failure` **signal** and an `error` **string** (confirmed through the door, 2026-08-29), and a 403 fires `failure` — measured on one backend, two arms: an approved member got `200` and a row, a pending person got `403`, `failure` fired, and the console named `query-records/query-failed`. **The product supplies the means; the site builder never wired it.** Left as a platform row this would have opened a platform task for a wire.

On a cold load with no session the admin page list renders the shell, the heading and `New page`
and nothing else: no rows, and no row-count sentence, because `count` runs on `pages.fetched` and
a refused query never fires it. No "no pages yet", no "you are not signed in".

**Where it bites:** two states with opposite fixes are pixel-identical, and the screen reads as
broken in both. The product gives an author no ready way to tell them apart.

### D4 update, 2026-08-29 (s15) — the template half is paid, the product half is not

SBR-016 shipped three sentences where there was one screen: `You are not signed in…`,
`No pages yet…`, and `The page list could not be loaded…`, the last raised by `pages.failure` and
lowered by `pages.fetched`. **This template no longer has the defect.**

🔴 **The product row is untouched and should not be read as smaller.** What closed it here was an
author knowing that `DbCollection2` has a `failure` signal and wiring it. Nothing warns an author
who does not — the same absence as D1 — and the default screen for a refused query is still an empty
one. ⚠️ **And the refusal path has never been observed on a live refusal**: this template's
`Page.find` is `public`, so no principal it has can be refused (SBR-016 §8.6).

---

## Collected from earlier phase-77 sessions

Recorded in task files at the time, gathered here so they are findable as **work**. Attributed to
the session that measured them; not re-measured in s10.

| id | defect | measured | owner |
|---|---|---|---|
| D5 | 🔴 The NDA-017 migration writes `runOnChange-*: false` on load for **every** node whose control signal is wired — 37 nodes in a fresh project, zero `true`s. An explicit `true` survives; absent does not. Caused the site's root URL to render no page at all. | SBR-004 §9.2, s8 | ✅ **re-measured 2026-08-29: real AND DELIBERATE** (Richard's decision, 2026-08-06 — the module states it at length). The residual is the disk/load seam → **[DEF-007](../phase-80-the-defects-the-templates-found/DEF-007-DISK-AND-LOAD-DISAGREE.md)** |
| D6 | ❌ **CAUSE REFUTED 2026-08-29** — `maxWidth` **is** a declared port on `Text` and the door knows it (`get_node_type` returns it; `useDimensionConstraints` defaults `true` and no node opts out). The file last moved **2026-08-08**, three weeks *before* this was measured, so the row is **wrong, not stale**. Symptom unexplained. | SBR-004 §9.3, s5/s8 | **[DEF-008](../phase-80-the-defects-the-templates-found/DEF-008-THE-MEASUREMENT-OWED.md)** — a measurement owed, not a fix |
| D7 | ⚠️ `Text` declares **no padding ports and no `borderRadius`** — margins only. A padded nav item needs a wrapping `Group`. | SBR-006, s9 | ✅ **confirmed at HEAD** (`paddingLeft`, `borderRadius` → `notFound`; `text.ts` calls `addMarginInputs` only) → **[DEF-003](../phase-80-the-defects-the-templates-found/DEF-003-THREE-AUTHORING-ACTS-WITH-NO-SURFACE.md)** |
| D8 | ⚠️ A bare number in a dimension port means **percent** (`width: 240` → `240%`). The door refuses it; the object form is the fix. Easy to write, hard to see. | SBR-006, s9 | ✅ **confirmed at HEAD** (`react-component-node.ts:1925`). 🔴 **= phase 76's F15** — the same defect found twice, unowned in both → **[DEF-003](../phase-80-the-defects-the-templates-found/DEF-003-THREE-AUTHORING-ACTS-WITH-NO-SURFACE.md)** |
| D9 | 🔴 The deploy drops **wire-only** `prop-*` — a parameter survives, a wire does not. | SB-017 §11.1 / SBR-006 §5.6 | **SBR-008** ✅ |
| D10 | ⚠️ A signal into a **value** port writes true-then-false, and the input queue holds one entry per input name, so the two coalesce and the consumer runs **once, with `false`**. | SBR-002, s4b | ✅ real — re-confirmed independently by **phase 78's D4 instrument bug** and **D14** (s6). Runtime half → **[DEF-002](../phase-80-the-defects-the-templates-found/DEF-002-THE-DOOR-DOES-NOT-CHECK-CONNECTIONS.md)** rule 3 |

## Added 2026-08-29 (s15, SBR-016's fix)

## D11 — 🔴 The NDA-017 migration reverses a graph authored *after* NDA-017, and the only defence is undocumented

**Severity: high. Product.** Owner: 🔄 **[DEF-007 §1.1](../phase-80-the-defects-the-templates-found/DEF-007-DISK-AND-LOAD-DISAGREE.md)**
(phase 80) — **reassigned 2026-08-29, same day it was filed.** It was recorded `NONE` here on the
reading that DEF-007 is about the disk/load *seam* and this is about the migration's *population*.
DEF-007's owner read it at HEAD and took it: it is that row's mechanism, in that row's file, and it
**changes DEF-007 §1's conclusion** — §1 exonerated the migration (*"None of that is the defect"*)
on the reading that it only bites paths that do not load, and this case is one that reading does not
cover.

🔴 **This file keeps the finding and not the ownership.** An unowned copy of an owned row is exactly
how phase 76's F15 became phase 77's D8 — two write-ups, zero fixes. Read DEF-007 §1.1 for the
owner's version; what follows is the measurement it was derived from.

✅ **A number reconciled the same day, and the reason is worth more than the number.** DEF-007 §1.1
first said `RUN_ON_CHANGE_FAMILIES` has **17** families, and used it to correct phase 77's fifteen.
At HEAD it has **18 entries / 15 families** — the module says so two lines above the table (the four
`Variable` types share one definition and one row each). Corrected in `b4299300`; nothing in either
claim moved.

🔴 **The cause: a one-line regex keyed on `[\w.\-]+`, which skips `'Filter Collection'` because it
has a space in it.** 18 − 1 = 17. **A hand-rolled counter's first output is a measurement of the
counter, not of the thing** — and this one was hard to catch precisely because it was *plausible*:
17 sits between the two true numbers, so it fitted nothing and excluded nothing, and was used to
overturn a figure taken from the author's own prose. ✅ **When a count disagrees with a comment
written by the code's author, suspect the count first**, and say which artefact you counted.

**Sharper than D5, which recorded the migration as "real AND DELIBERATE" and stopped there.** It is
deliberate, and it is still a defect for every project created from today onwards, because the
migration has no way to tell a pre-§2 graph from a post-§2 one — the module says so itself:
*"nothing is stamped into the project (the format has nowhere to put a marker — an open question §2
recorded and did not close)"*.

**Measured**, on the shipped site-builder artefact through the real module: **56 writes over 35
signal-driven nodes**, on a template authored entirely after §2. Two of them were live defects —
`/Pages/Admin`'s page list and `/Pages/PageEditor`'s section list, both fixed in SBR-016 — and the
other 54 are silent because their control signals happen to be consequences.

**Where it bites:** an author writes a graph against the documented current contract, ships it, and
the editor rewrites it into the *old* contract on every load. The only defence is to write
`runOnChange-<input>: true` explicitly on every governed input you rely on — which is not in any
document, is not offered by the property panel as a thing you would think to do, and is invisible in
the graph. **Two sessions' worth of drives measured the symptom at the network layer without
reaching the parameter bag.**

**What would close it:** a marker in the project format saying which contract it was authored
against, so the migration can skip projects that never needed it. Failing that, a diagnostic when
the migration writes into a project whose `nodegxVersion` postdates §2.

## D12 — ⚠️ Every arrival at the page list and the page editor issues the query twice

**Severity: low. Template.** Owner: **`NONE`**.

**Measured 2026-08-29** on `SBR-016 Arrive Drive`, with a spy on `XMLHttpRequest.open` / `fetch`:
arriving at `/admin/pages` with one row produces **two** `POST /classes/Page`; arriving at the page
editor produces **two** `POST /classes/Section`. With **zero** rows it is one — which is what names
the cause: `list.itemOutputSignal-Changed` → `storageFetch` fires when the repeater first renders a
row, so the fetch that produced the row triggers a second identical fetch.

**Where it bites:** one wasted round trip per arrival on both admin screens, and a second render.
Harmless at one row, linear in nothing, but it is a query the user pays for on every navigation.
⚠️ **The wire is not removable as-is** — it is the only refresh after a publish/unpublish/duplicate
inside a row (SB-018 (1)). The fix is a trigger that fires on a row's *change* rather than on its
first render.

## Added 2026-08-29 (s16, SBR-008's re-measurement)

## D13 — 🔴 What a build contains depends on when it was taken, not on what the project says

**Severity: high. Product.** Owner: **`NONE`** — ⚠️ **and deliberately not SBR-008.**

> 🔄 **s18 (2026-08-29): still `NONE`, still open, and SBR-008's fix landed without touching it.**
> The `prop-` family now resolves from the node's own wires, so *this* family leaves the filter's
> reach — exactly as the paragraph below predicted. **The filter is unchanged and every other
> dynamic-port family is still exposed to it.** What did change is the direction the race settles
> in for `prop-`: the ports exist from component import rather than waiting on a column, so the
> window narrows to "before the viewer has reported any ports at all", which is common to every
> dynamic family and is what D13 is about. ⚠️ **Do not read SBR-008's green specs as evidence
> here** — they call `setup()` and read what it announces; the debounced pass is not in them.
> Re-checked that no task has taken it: still no acceptance criterion in this phase or phase 80
> mentions the health pass, the export filter or build determinism. SBR-008's
ruled fix makes the `prop-` ports resolve, which removes *this family* from the filter's reach; it
does not change the filter, and every other dynamic-port family stays exposed. Grepped the phase's
task files for the behaviour before recording it as unowned: no task's acceptance criteria mention
the health pass, the export filter, or build determinism.

`exportComponent` (`utils/exporter/util.ts:61`) drops every connection `getConnectionHealth` calls
unhealthy. **`getConnectionHealth` (`NodeGraphModel.ts:662`) reads no ports** — it asks
`WarningsModel` whether a warning is recorded and returns `healthy: true` when none is, which is
also the answer when none has been evaluated yet. The warning it reads, `con-no-target-port`, is
written on a debounced pass (≈2 s lazy; 50 ms on the urgent lane a viewer's arriving ports arm),
and **nothing forces that pass to settle before an export**: no caller of `evaluateHealth()` exists
in the deploy path, the viewer-bundle path or `ViewerConnection`.

**One filter, three callers** — the viewer's component bundles (`editorapi.js:88`), incremental
preview updates (`ViewerConnection.ts:993`), and the full export and deploy (`json.ts:159`/`:178`,
`deployer.ts:108`). So this is not a deploy-only property, and a "works in preview" observation is
not a control for it.

**Where it bites:** two builds of a byte-identical project can differ in which wires they contain,
with no diagnostic and nothing in the artefact recording which one you got. It is silent in both
directions — a wire kept that the editor would call broken, or a wire dropped that the author can
see on the canvas.

🔴 **What it already cost this phase: four sessions of evidence pointing two ways.** s9, s12 and
s14 each read a nameless `Page` row and filed it under SBR-008; s15 read a named one on a fixture
measured identical to s14's on every static axis (SBR-008 §5.1) and recorded that the symptom "did
not reproduce". **Both are what this mechanism produces.** The register carried it as a defect
about *the deploy* for three sessions because no reading distinguished the filter from its caller.

**What would close it:** force `evaluateHealth()` to completion before any export, so a build is a
function of the project; or carry the health verdict in the artefact so a build says which wires it
dropped and why. ⚠️ The first is the smaller change and the one that makes the second honest.

🟢 **s17 (2026-08-29): CONFIRMED — the flip was watched happening, twice, with no edit.** The
earlier caution below is superseded; it is kept because it was the right caution at the time.

A probe armed before the project opened sampled the editor once a second (SBR-008 §6.1). At
**14:17:01.6** the `/Pages/Admin` `prop-` wires read `healthy: true` and `exportComponent` returned
**13 connections**; at **14:17:03.9** the same wires read `healthy: false` with `con-no-target-port`
and the same call returned **11**. Project-wide, the census moved **32 healthy → 13 healthy** — the
**19** wires this phase has been chasing. `targetPortExists` was `false` in *both* rows, so no port
set changed; only the debounced pass landing did. Then through the product: one
`ViewerConnection.sendRefresh()` took the **running** preview from **221 connections to 202**, with
no edit before or after.

🔴 **And a second session-dependent input, on the same path.** `SchemaHandler`
(`utils/schemahandler.ts:72`) fetches the backend schema on **`window-focused`** and writes it to
`dbCollections` project metadata; `resolveSchemaPortContext` (`schema-ports.ts:501`) reads that key
and `recordFieldPorts` mints one port per column. So **which ports exist — and therefore which wires
survive a build — also depends on whether the editor window happened to get focus with the backend
up.** Measured in the same session: the census went **19 unhealthy → 4 unhealthy** on its own,
between 14:18:32 and 14:22:57, with no edit. ⚠️ *Which* of the two triggers fired was not observed.

**So the count is not a property of the project.** In one session, with nothing edited, it read
**32/0**, then **13/19**, then **28/4**. Any spec pinning it must pin the schema state beside it —
see SBR-008 §6.5, where this makes that task's AC2 unsafe as written.

⚠️ *(Superseded, kept for the record.)* Stated as a mechanism, not a confirmed cause of the two
readings. The timing account explains both and is grounded in the code above; *which* timing
obtained in s14 and s15 was not observed, and the drive that would settle it is named in
SBR-008 §5.5.

---

---

✅ **D5–D8 and D10 were re-measured at HEAD on 2026-08-29** — see
[THE-SWEEP-2026-08-29.md](THE-SWEEP-2026-08-29.md) §2. Two came back different: **D6's cause is
refuted** and **D8 is a duplicate of phase 76's F15**. The rest stand.

🔴 **And the platform had *not* moved under them** — which was the assumed reason to re-measure and
was wrong. D6's file predates its own measurement by three weeks. **The rows were mis-derived, not
stale**, and a re-measure scoped to "has the platform moved?" would have confirmed all five.

---

## D14 — 🔴 `Outputs.<signal>()` throws in a cloud Function node, and both row actions die at their first node

**Found: SBR-006 §5.12, s19 (2026-08-29). Owner: `NONE`.**

Through the admin overflow menu on `SBR-017 Sign In Drive`:

| action | UI | backend record |
|---|---|---|
| Publish | `This page could not be published.` **71 ms** | `error`, HTTP 400, 59 ms |
| Duplicate | `This page could not be duplicated. A partial copy may exist.` **35 ms** | `error`, HTTP 400, 13 ms |
| `claimSite` | — | ✅ `success`, 39 ms — **control, same backend** |

`execution_steps` names the node and the throw:

```
JavaScriptFunction  error
  function/script-threw: The script threw: Outputs.ready is not a function
```

Both are the **first** node of their function — the gate that holds the request until its
parameters arrive — so nothing downstream runs. Reproduced 3/3.

### Why this is a *defect row* and not an SBR-006 acceptance failure

SBR-006 AC3 asks that publish/unpublish/duplicate work from the menu. They cannot, and the reason
is in the cloud runtime and the template's Function nodes, not in the admin shell. **AC3's
messaging half is fine** — the refusals are visible and fast, which is SBR-015's fix doing its job;
the old behaviour was a silent 30 s 504.

### 🔴 It refutes a refutation, and it is only nameable because of DEF-004(a)

SBR-015 s10 marked *"undeclared signal ports"* **REFUTED** on the grounds that *"the artefact
declares all six."* Measured on the shipped artefact at HEAD:

```
18 Function nodes call a signal output (Outputs.x())
 0 declare it in `scriptOutputs`
```

Eighteen of eighteen undeclared, `claimSite` included. The refutation was about a different field
from the one that decides.

🔴 **And SBR-006 s9 and SBR-015 both looked straight at this failure and could not see it** — before
`d229bf4b` it was an opaque HTTP 400 with zero steps. DEF-004(a) turned "publish does not work"
into a file, a node and a message inside a day of landing.

### ⚠️ What is NOT established — two variables, neither eliminated

`publishPage` **succeeded in 12 ms at 09:26:44Z** on `SBR-015 AC1 Drive`. So "undeclared ⇒ throws"
is not the whole story, and the 18/18 census does not settle it either.

1. **The cloud runtime.** `d229bf4b` (12:10Z) is the only commit today touching
   `packages/nodegx-backend/src`. The process serving the success predates it; the one serving the
   failures postdates it. **The pre-commit runtime was not run**, and the `node.ts` diff adds step
   recording without touching how `Outputs.x` is built — so this is a timing coincidence, not a
   mechanism.
2. **The project.** 🔴 The two projects' `publishPage` are byte-identical bar node ids — **and that
   proves nothing**, because both had been rewritten after the success (mtimes 11:17, 12:13) by the
   same NDA-017 migration (D5/D11). The artefact's gate node carries only `functionScript`; both
   projects carry `runOnChange-in-pageId: false` added on open. **A diff between two equally
   mutated copies measured that they were mutated alike** — the one thing it could not fail to find.

✅ **The experiment that separates them:** mint a project and **never open it**, then call
`publishPage` against a backend built from a commit before `d229bf4b`. Vary one, then the other.

⚠️ `_updatePorts` derives output ports from `scriptOutputs` **and** from
`_parseScriptForErrorsAndPorts` over the script text (`simplejavascript.ts:781`). Whether that
parser types `Outputs.x()` as a **signal** is the live question. `simplejavascript.ts` has not moved
since 08-12, so the Function node itself is not the change.

### Owner

**`NONE`** — deliberately, per this file's own rule. The nearest fit is
**[DEF-002](../phase-80-the-defects-the-templates-found/DEF-002-THE-DOOR-DOES-NOT-CHECK-CONNECTIONS.md)**,
and only for **half** of it: "a Function node calls a signal output the node does not declare, and
the door says nothing" is exactly DEF-002's shape and would be a fourth rule there. The runtime half
— whether this should throw at all, and what changed between 09:26Z and 14:05Z — fits no open task
read today. Phase 80 outlives phase 77, so DEF-002 is a live home for the door half if its owner
wants it.
