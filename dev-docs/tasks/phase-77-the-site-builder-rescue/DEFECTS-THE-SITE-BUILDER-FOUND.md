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
| **D6** | ❌ **symptom DOES NOT REPRODUCE** (driven, P80 DEF-008 s13) — `maxWidth` applies on `Text` in every authored form incl. §9.3's exact shape; the one measured route to `none` is a parameter on a component **instance**, which the door blocks |
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
| D6 | ❌ **SYMPTOM DOES NOT REPRODUCE — DRIVEN 2026-08-29 (P80 DEF-008 s13), rendered in a browser through the from-disk harness.** `maxWidth` on `Text` reaches the DOM in **every authored form**: bare `240` → computed `240%` (the D8/DEF-003(a) coercion, and `unitless-dimension` fires on it — driven); `{value:240,unit:'px'}` → `240px`, offsetWidth 240; **this row's exact shape** (`sizeMode:'contentSize'` + `{value:100,unit:'%'}`) → computed `100%`; and inside a component instantiated by a **For Each** (the nav link's real placement) → `240px`. Controls: a Text with no `maxWidth` reads `none`; a Group beside it reads `240px`. **The one measured route to `none`**: the parameter authored on a component **instance** (no matching Component Input) — dropped silently at runtime, but the door blocks it (`interfaceless-instance` fired naming `maxWidth`, driven). ⚠️ What the re-drive cannot see: which element §9.3's probe read, and its render path — the platform did not move between the two measurements, so the disagreement is in the fixture or the probe, not the code. | SBR-004 §9.3, s5/s8 · re-driven P80 DEF-008 s13 | ✅ **CLOSED into [DEF-008](../phase-80-the-defects-the-templates-found/DEF-008-THE-MEASUREMENT-OWED.md)** — it works; the bare-form half is DEF-003(a)'s, already warned |
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

## D14 — 🟢 FIXED s20 · `Outputs.<signal>()` throws in a cloud Function node, and both row actions die at their first node

**Found: SBR-006 §5.12, s19 (2026-08-29). Owner: `NONE`.**

> 🟢 **s20 (2026-08-29): FIXED and gated — read the CLOSED section at the end of this file first.**
> The cause was neither of the two candidates below. The deploy wrote `ports: []`; the project on
> disk had the ports all along; and the `claimSite` "control" ran against a bundle replaced three
> and a half hours later. The two paragraphs headed *"Two variables, neither eliminated"* and the
> experiment under them are **superseded** and kept only as the record of what was believed.

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

---

## 🟢 D14 — CLOSED s20 (2026-08-29). The bundle shipped with no ports, and neither of the two candidates above was the cause.

> 🟢 **s22 (2026-08-29): DRIVEN through the app, which s20 never did.** On a project minted after
> the fix (`SBR-007 Page Editor Drive`, `backend_mterfnli74qwv`, port 8601), **Publish** and
> **Duplicate** were both clicked from the row's overflow menu:
>
> | action | UI | backend record |
> |---|---|---|
> | Publish | `One page, one published`, row reads `Published` | ✅ `success`, **25 ms** |
> | Duplicate | `Two pages, one published`, `Copy of Original Title` / `drive-007-copy-ogsb33` | ✅ `success`, **23 ms** |
> | `claimSite` | — | ✅ `success`, 55 ms — control, same backend |
>
> `execution_steps` for the publish records **five steps, all `success`**, and step **0** — the
> `JavaScriptFunction` gate that is the *first* node of the function and the one that threw
> `Outputs.ready is not a function` — returns `{"outcome":"done"}` in 2 ms. The fix is real in the
> app, not only in the red-then-green spec pair. See SBR-007 §13.
>
> ⚠️ **Scope**: the editor-preview deploy path only. The same `ports: []` exposure on the **browser**
> deploy path (`build/deployer.ts`), recorded at the end of this row, is untouched and unowned.

**Fix: `withScriptPorts` in `utils/exporter/cloudFunctions.ts`.** Gate:
`sb017-deploy-connection-parity.test.ts`, a suite that is **red without it** (2894 specs,
6 failures) and green with it (4 failures, all four `AIX-006` by name — the documented floor).

### What it actually was, read off the two artefacts

The deployed bundle carries `ports: []` on **all 11** cloud Function nodes. The bundle from the
backend where `publishPage` succeeded carries **50** ports across the same 11 nodes. Nothing else
in either bundle differs in this respect — every other node type exports zero ports in **both**,
because only three node types in the codebase set `exportDynamicPorts`.

| | `backend_mte82r1qhnr87` (failed) | `backend_mte62ofkj8whc` (succeeded) |
|---|---|---|
| bundle written | **15:48** | 11:19 |
| `JavaScriptFunction` nodes | 11 | 11 |
| ports on them | **0** | **50** |
| `publishPage` | `error` 400, 59 ms | `success` |

From that empty array the throw is four lines of source, no inference:

1. a deployed node's `outputPorts` come **only** from `nodeData.ports` — `NodeModel.createFromExportData`
   (`nodemodel.ts:255`); there is no editor to send them;
2. `_isSignalType` (`simplejavascript.ts:635`) reads `model.outputPorts[name].type === 'signal'`;
3. the loop that writes the callable stub (`:400`) is gated on it, so nothing is written;
4. `Outputs.ready` is `undefined`, and `Outputs.ready()` throws exactly what `execution_steps` recorded.

### 🔴 Two things this register asserted about D14 were wrong

- **"Two variables — the cloud runtime, or the project."** Neither. **The project on disk carries
  the ports**, in both projects, identically: `components/__cloud__/publishPage/nodes.json` holds
  `out-ready:output:signal` on the gate node in the failing project too, and the template
  (`site-builder.content.json`) persists all 13 signal ports statically on the nodes. The deploy
  read a project that had them and wrote a bundle that did not. The runtime never entered it; the
  experiment named above ("mint a project and never open it, build a backend from before
  `d229bf4b`") would have varied two things that were both innocent.
- **"`claimSite` — control, same backend."** Same backend, **different artefact**. `claimSite`
  succeeded at **12:27:59**; the bundle it ran against was replaced at **15:48**, three and a half
  hours later, by the one with no ports. It was never a control on the failing build, and
  `claimSite`'s own gate node calls `Outputs.ok()` — against the 15:48 bundle it would throw too.

⚠️ **What made the live editor drop them was not observed and is not claimed.** The single gate in
`exportPorts` (`util.ts:16`) that can drop a *persisted* port is `node.type.exportDynamicPorts`,
falsy on an `UnknownNodeType` — the state every node is in until the node library resolves. That
reproduces `ports: []` exactly and is what the spec drives. Whether the live editor was in it at
15:48 — a full reload after the `noodl-runtime` edit in `a14fb8e7` (15:25) is the obvious
candidate, and the standing notes record one happening mid-session — is unmeasured.

### This is D13's family, with a worse casualty

**[D13](#d13)** says what a build contains depends on when it was taken, and names dropped *wires*.
This is the same property costing a node its *ports*, which is not a degraded function but a dead
one — and it is silent in the editor, silent in the deploy, and only nameable at the backend because
DEF-004(a) writes execution steps. D13 stays open and `NONE`: the fix below is scoped to cloud
functions and does not touch the filter or the session-dependence D13 is about.

### 🔴 What the fix does NOT cover — `NONE`, and worth a row of its own

`exportPorts` is shared. **The browser deploy path (`build/deployer.ts`) has the same exposure**: a
browser Function node exported while its type is unresolved ships with no ports, and
`Outputs.done()` in a deployed app throws the same way. `withScriptPorts` is applied in
`exportCloudFunctionsToJSON` only — deliberately, because that is the scope of SB-017's ruling and
the half with a measured failure. The browser half is untested and unowned.

⚠️ **And the derivation is narrower than the calls it protects.** `scriptPortsFromSource` types a
signal from `Outputs.x()` with **empty parens and no underscore in the name**
(`cloudDynamicPorts.ts:203`). `Outputs.done(1)` and `Outputs.my_sig()` mint no signal port and
still throw at runtime. No script in the template does either — the spec's population is asserted
at 13 with the looser pattern, so one appearing turns the suite red rather than passing quietly.

---

## D15 — 🔴 The runtime has no file-drop capability at all, so "drop a file here" is not authorable

**Found:** s21, building SBR-007 · **Owner:** `NONE` · **Product**, not template · **Bites:** any
builder who wants a drop target, and SBR-007 AC3 as literally written.

SBR-007 AC3 asks that *"dropping an image file onto the gallery editor uploads it"*. It is not
buildable with the shipped node library, and the reason is a missing capability rather than a
missing wire.

**Measured, with a known-firing control beside it** — over `packages/noodl-viewer-react/src` and
`packages/noodl-runtime/src`:

| grep | hits |
|---|---|
| `onClick\|onMouseDown` — the control, proving the search path is right | **39** |
| `onDrop=\|ondrop\|dataTransfer\|dragover\|dragenter\|DragEvent` | **0** |

⚠️ The control earned its place: the first run of this pair used an unquoted shell variable for the
two paths, zsh did not word-split it, and **both numbers came back 0** — an absence that looked
exactly like the finding. A zero next to a zero is not a measurement.

**What DOES exist, and why it is not the same thing:**

- `visual/drag.ts` — a `Drag` node with `Drag Started`/`Moved`/`Ended` and `Drag X/Y`, `Delta X/Y`.
  It moves an element by position. It reports **no drop target and no hit test**, so "what did I
  drop this on" is arithmetic the author must do.
- `std-library/openfilepicker.ts` + `uploadfile.ts` — the upload path that the template already
  uses: **click** a button, get an OS file dialog, upload the result. `Open File Picker` has no
  drop affordance.

So the gesture AC3 names needs a new runtime node (a Drop Target that surfaces `dataTransfer.files`)
or a drop-handling input on an existing visual node. That is a product change in the viewer, not a
template edit, which is why SBR-007 did not quietly build something else and call it AC3.

🔴 **Unowned on purpose.** It is not SBR-007's (that task owns a screen, not the node library) and
it is not SBR-005's (that owns the gallery data model). It needs a task, and phase 77 should not
close pretending AC3 was met.

### D15 update, s29 — re-measured at HEAD, and it STANDS (unlike its twin)

[D23](#d23) was filed as this row's twin and has now been disproved, so this one was re-run rather
than inherited. It holds, and the re-run sharpened it:

| grep, over the same two packages | s21 | s29 |
|---|---|---|
| `dataTransfer` | 0 | **0** |
| `dragover` / `dragenter` / `dragleave` | 0 | **0** |
| `DragEvent` | 0 | **0** |
| `onDrop` (word-bounded) | 0 | **0** |
| `onClick` / `onMouseDown` — control | 39 | **39** |
| `.ts`/`.tsx` files reached — control on the *boundary*, which is what D23 lacked | — | **369** |

⚠️ **A combined `onDrop|ondrop|…` alternation now reads 8, and all 8 are `onDropped`** — the
pending-inner-action queue's discard callback (`react-component-node.ts:153-1546`), nothing to do
with dropping a file. A substring match on an unrelated identifier, in the direction that would have
*retired* this row. Split the terms.

🔴 **The file-count control is the one this row did not have before**, and it is the exact control
whose absence made D23 wrong: it proves the search reached the *population*, not merely that the
*predicate* fires. D15 survives it; D23 did not.

---

## D16 — 🟢 FIXED s24 (phase 80 DEF-030). The appearance ratchet's per-page check could not fail for any page that places a styled component

**Found:** s21, while paying SBR-007's appearance debt · **Owner:** `NONE` · **Product** (a gate) ·
**Bites:** anyone who reads a green §4 as "this screen is designed".

`templateAppearance.test.ts` §4 asks whether a page is "an unstyled column". `barePages()` walks
`reachable(t, page)` — the **transitive closure of placed components** — and calls the page styled
if *any* node in that closure sets one of `STRUCTURE_PARAMS`.

**Sabotage, run over the shipped artefact at HEAD:**

| | bare? |
|---|---|
| `/Pages/PageEditor` as built | `false` |
| `/Pages/PageEditor` with **every one of its own structure parameters stripped** | **`false`** |
| `/Pages/Site` with every one of its own structure parameters stripped (control) | **`false`** |

Because `/Admin/Shell` carries `backgroundColor`, a page that merely *places the shell* passes §4
with an entirely unstyled body. The check grades **"does this page reach anything styled"**, not
"is this page styled".

🔴 **This matters to the row above it.** SBR-007 took site-builder from 1 bare page to 0 and
tightened `BARE_PAGES_TODAY['site-builder']` to `[]` — but §4 would have reported that improvement
for the shell placement alone. **The evidence that the page editor is actually designed is the
count of structure parameters in its OWN tree: 0 → 9.** §4 is not that evidence and is not cited as
it.

**The stricter rule was measured and is NOT green today**, which is why this is a row and not a
patch: grading each page's own tree makes `/Pages/ThemeEditor` bare (it delegates everything to the
shell), and the rule change would re-grade `members-area` and `hello-world` too — two templates and
another phase's gate. ⚠️ A rule promotion re-grades corpora nobody listed.

---

### 🟢 The fix, s24 (2026-08-30) — phase 80 **DEF-030**

**Sabotage reproduced at HEAD first.** Strip every structural parameter from `/Pages/PageEditor`'s
own nodes and `barePages` still returns `[]`. The check could not fail.

🔴 **And it was worse than "cannot fail": it found nothing anywhere.** Under the placement rule,
`barePages` returns `[]` for **all three** shipped templates — so §4 was comparing an empty set
against its floor in every case. Both of its arms (a subset filter and a `<=` count) pass trivially
on an empty set.

**The rule is now the page's OWN tree.** Placing a designed component is not an answer to *"was this
screen designed"* — every admin page places the same shell, so under the old rule the shell answered
for all of them at once. `STRUCTURE_PARAMS` is unchanged and still deliberately narrow (no padding,
no gaps, no `flexDirection` — the artefact that provoked the file set 125 of those and still read as
one column), so a page that places a shell and sets a `maxWidth`, a `fontSize` or a surface on
anything of its own passes.

**What the stricter rule re-grades — ONE page, not two:**

| template | bare under the own-tree rule |
|---|---|
| hello-world | none |
| **site-builder** | **`/Pages/ThemeEditor`** |
| members-area | none |

🔴 **`/Pages/ThemeEditor` is real debt and it is this phase's.** Its own tree sets not one
structural parameter: the single Group it owns (`shell-3`) carries `flexDirection`, `rowGap` and
`sizeMode`, every one of which `STRUCTURE_PARAMS` excludes on purpose. Everything that paints the
screen belongs to `/Admin/Shell`, which the page merely places. It is on the floor **by name with
its reason**, not exempted — template-side, so **phase 77 owns the repair**.

🔴 **A second vacuity, found while re-measuring the floor.** `hello-world`'s allowance was
`['/Home']` — but that template's page is `/#__page__/Home`, so the entry named a page that does not
exist under that spelling, *and* the real page sets a `fontSize` so it was never bare either. An
allowance nobody can spend and nobody notices. A new arm now asserts **every floor entry names a
real page**.

**§4's assertion is now EQUALITY**, not a subset and not a count — the old pair let the floor go
stale *generous*, which is the failure mode the file already names one screen above its own floor.
Fixing a page reddens the arm, and shrinking the floor in the same commit is what a ratchet is for.

✅ **The mutant asserts BOTH halves**, which is what makes it about the defect rather than about the
new rule: the sabotaged page is called designed by `barePagesByPlacement` (kept, for exactly this)
and named by `barePages`. Asserting only the second would prove the new rule works without showing
what was wrong.

`templateAppearance.test.ts` 24/24; noodl-mcp **1007/1007**, `tsc --noEmit` clean.

## D17 — 🟢 FIXED s21 · The page editor was the one admin screen that did not wear the admin shell

**Found and fixed:** s21, SBR-007 · **Template**, not product · **Bites:** every client, on the
screen they spend their time in.

SBR-006 moved "Theme and settings" out of a button at the bottom of the page list and into *"a
permanent sidebar item in `/Admin/Shell`, on every admin screen"*. Measured over the shipped
artefact, that sentence was false:

| page | places `/Admin/Shell`? |
|---|---|
| `/Pages/Admin` | `active: "pages"` |
| `/Pages/ThemeEditor` | `active: "theme"` |
| **`/Pages/PageEditor`** | 🔴 **none** |
| `/Pages/Site`, `/Pages/SignIn`, `/Pages/Setup` | none — correct, these are not admin screens |

So the rail, the theme link and `Sign out` vanished the moment a client opened a page to edit, and
came back when they left. `sb005AdminPanel.test.ts`'s AC5 case pinned the placements at exactly
`['Pages/Admin', 'Pages/ThemeEditor']` and was green throughout — **the gate asserted the defect.**

✅ Fixed by placing the shell with `active: 'pages'`. ⚠️ **And AC5's second assertion had to change
shape, not just its numbers**: it read `new Set(active).size === placements.length` — "every
placement is unique" — which was accidentally equivalent to the real invariant while there were
exactly two placements and is the *wrong rule* at three. The page editor sharing `pages` with the
page list is correct (editing a page is still the Pages section). The invariant that survives is
"more than one rendering exists", i.e. the interface is load-bearing.

🟢 **s22 (2026-08-29): DRIVEN.** On `/admin/page/<id>` in `SBR-007 Page Editor Drive`, the rail is
present *while editing* and `active: 'pages'` is **lit, not dark** — `Pages` at `rgb(30,77,140)`
(`--primary`) weight **600** against `Theme & settings` and `Messages` at `rgb(27,26,23)`/400, items
stacked at y=65/96/127. Screenshot: `notes/sbr007-page-editor-driven.png`. This row is closed.

---

## D18 — 🟢 FIXED s23, **DRIVEN s24** · The page editor's header row did not fit, and `Save page` could not be reached — at 1440 px, once the page title was an ordinary length

**Found:** s22, driving SBR-007 AC1 · **Owner: `SBR-007`** (open — AC2 ⬜, AC3 blocked — and the row
is this task's own build, §7) · **Template**, not product · **Bites:** any client on a narrow
window, on the screen they spend their time in.

The header row s21 added — `Editing · <title>`, the pill, `Preview`, `Save page` — is laid out at a
fixed content width and neither wraps, shrinks, nor scrolls. Measured on the driven screen with
`elementFromPoint`, sweeping the viewport:

| viewport | `Save page` visible / box | hit test at its visible centre | horizontal scroll available |
|---|---|---|---|
| 1440 | 104 / 104 px | ✅ SELF | 0 |
| 1024 | 104 / 104 | ✅ SELF | 0 |
| **988** — the width this phase drives at | **91 / 104**, clipped | ✅ SELF | **0** |
| **800** | **0 / 104** | 🔴 **none** | **0** |
| **600** | **0** — and `Preview` is gone too | 🔴 **none** | **0** |

The row's right edge sits at **1001 px at every viewport**, so the threshold is 1001 for "clipped"
and 897 for "gone".

✅ **The control that makes the fixed 1001 mean something**: `#root` tracks the viewport exactly —
1440 / 988 / 600 — in the same probe, in the same call. A layout that had simply not processed the
resize would have moved neither. And `document.scrollWidth === innerWidth` at every width, so the
overflow is **clipped, not scrollable**: there is no gesture that reaches the button.

✅ **Two more controls put the blame on this row rather than on `/Admin/Shell`**, which it now sits
inside:

- `/admin/pages` — the row buttons `Edit` and `More` **do** track the viewport: right edge
  **1336 → 884 → 496** at 1440 / 988 / 600.
- `/admin/theme` — `Save theme` is left-anchored at 384 and fully visible at every width.

So the shell reflows and its other two screens reflow; this header row does not.

⚠️ **Stated at its real size, not inflated.** At 988 px the label is readable and the button still
clicks — which is exactly why SBR-007 AC1 was driveable this session. The defect is everything
below 1001 px, and it is total below 897.

🔴 **s24 correction — that last sentence, and this row's own heading, were understatements.** `1001`
and `897` are properties of **the fixture's 22-character title**, not of the defect. The row's width
is `sidebar + title + pill + two buttons`, and the title is the only term a user controls. Re-driven
with a 56-character title (965 px at 30 px): `Save page` hit-tests **`none` at 1440, 1200, 1024 and
800**, and is reachable only at 1920. On an ordinary laptop screen, with an ordinary page title, the
button did not exist. See [SBR-007 §21](SBR-007-THE-PAGE-EDITOR.md).

~~**Likely shape of the fix, not yet measured:** SBR-004 §9.1 found the same family...~~ — two
things in that sentence were wrong, and both are corrected below.

## 🟢 D18 — FIXED s23 (2026-08-29), in the template. 🔴 **BUILT, NOT DRIVEN.**

### 🔴 Two corrections to the row above, before the fix

1. **The citation was wrong.** The `sizeMode` precedent is **SBR-004 §8.2 and §10**, not §9.1 —
   §9.1 is AC2 passing on a real page load and says nothing about layout. (`grep -n 'sizeMode'`
   over that file: lines 425, 443–445.)
2. **It was not the same family.** SBR-004's was a **height** problem — a nav 219px tall with its
   links on three lines — and `contentHeight`/`contentSize` fixed it by making groups stop claiming
   height. D18 is a **width** problem in the opposite direction: the children are *already*
   `contentSize`, and that is precisely what breaks it.

### The mechanism, read off the source rather than guessed

`layout.ts:82` sets **`style.flexShrink = 0` for every node**, and only the percentage-along-the-
parent's-direction paths beneath it opt back in (`flexShrink = 1`). Every child of this row is
`IN_A_ROW` (`contentSize`), which assigns a percentage on **neither** axis. So:

> no child of the header row can shrink, and with the default `flexWrap: nowrap` the row overflows
> its container and is **clipped**.

That accounts for all three readings at once — the right edge fixed at 1001px, `#root` tracking the
viewport, and `scrollWidth === innerWidth`. 🔴 **It also explains why `flex-grow` was never the
lever, in SBR-004 and here: growing a child that cannot shrink does nothing about overflow.**

### The fix

`flexWrap: 'wrap'` (plus `rowGap`, which `group.ts:478` gates on exactly that condition) on
`/Pages/PageEditor`'s `headerRow`, in `sb005Components.ts`. The row stays a single line wherever it
fits — the wide-screen design is byte-for-byte unchanged — and the actions move onto a second line
where it does not, instead of being clipped away.

✅ **Not a novel lever in this template**: `/Site/Nav` already ships `flexWrap: 'wrap'`. The artefact
now holds exactly two such nodes.

### The gate, and what it honestly does not do

`sb007Template.test.ts` gains `D18 — a row sized by a string nobody has typed yet stays reachable`:
a grader plus a mutant that drops `flexWrap` and reddens it.

⚠️ **It pins this row's shape; it is not a detector for "rows that clip."** Eleven row-direction
Groups ship, and five are `nowrap` with every graded child non-shrinking — but §14's drive
**measured two of those five reflowing correctly**, so a rule reading *row + cannot shrink ⇒ broken*
would contradict readings already taken. The graded property is instead **a wire-fed `Text` at a
display font size** — a width the template cannot know because it is a user's page title. That
population is exactly 1, and it is this row.

### 🟢 DRIVEN s24 — on a rendered screen, without the editor

A peer held 9222 and `:8574` again, so the drive went through
`scripts/devtools/render-from-disk.js` + `withRenderedPage` — the **same
`noodl-editor/src/external/viewer/noodl.viewer.js` bundle** the editor's viewer runs, in headless
Chrome on a free port. Two arms, both copies of the fixture, differing by exactly the three lines of
`10b26d57`'s artefact diff (the fixed arm's parameter block was read out of
`site-builder.content.json` at HEAD, not typed).

- ✅ **The control arm reproduced §14 in full** — 104/104 `SELF` at 1440 and 1024, **91/104** at 988,
  **`none`** at 800 and 600, right edge pinned at **1001**, `scrollWidth === innerWidth` throughout.
  Seven readings, seven agreements, through a different host.
- ✅ **The fixed arm**: computed `flex-wrap: wrap` and `row-gap: 12px`, row height 35 → 73 below
  1024, and `Save page` **`SELF`, 104/104, at every width from 1440 down to 600** — and at every
  width down to 800 with the long title too.
- ✅ Screenshot pairs: [`notes/d18-before-800.png`](notes/d18-before-800.png) ·
  [`notes/d18-after-800.png`](notes/d18-after-800.png) ·
  [`notes/d18-longtitle-before-1440.png`](notes/d18-longtitle-before-1440.png) ·
  [`notes/d18-longtitle-after-1440.png`](notes/d18-longtitle-after-1440.png).

⚠️ **What the drive does not cover**: it is not the editor's preview pane, and it renders the fixed
arm rather than a project freshly installed from the HEAD template. Why that second seam is closed
by a measurement rather than assumed — the fixture's own header row was byte-identical to the
pre-fix artefact — is in [SBR-007 §20](SBR-007-THE-PAGE-EDITOR.md).

🔴 **The residual the fix cannot reach is [D20](#d20).**

## D19 — 🟢 FIXED s23 · Three commits landed on a red `test:main`, because the phase watches a different runner

**Found:** s23, running the editor suite before committing D18's fix · **Owner: `SBR-007`** (found
and fixed in the same session) · **Product gate**, not template · **Bites:** every phase-77 task,
silently.

`packages/noodl-editor/tests-unit/sb-007/site-template.test.ts` was failing **at HEAD**, three
assertions, and had been since `7913e6b6`:

| assertion | expected | actual at HEAD | first wrong at |
|---|---|---|---|
| components in the installed project | 21 | **22** | `7913e6b6` (SBR-017's `/Pages/SignIn`) |
| components carrying `visualRoots` | 14 | **15** | `7913e6b6`, same component |
| distinct node ids after the id rewrite | 236 | **274** | `7913e6b6` → `cdd842fc` → `7a156972` |

✅ **Measured read-only, not reasoned**: the three counts were computed from `git show HEAD:<artefact>`
and from the working tree, and they are **identical** (22 / 15 / 274). D18's fix adds no node and no
component, so it could not have moved any of them — the reds pre-date this session entirely.

### 🔴 Why nobody saw it

The phase's standing gate note reads *"`test:ci` = 2894 specs, 4 failures, all four `AIX-006 style
vocabulary` by name"*. That is true, and it is **about a different runner**. These three live in
`test:main` — plain Node jest — which nothing in the phase's routine runs. Three feature commits
(SBR-017, SBR-016, SBR-007 s21) landed on top of a red suite without a single report.

⚠️ **So "the gate is unchanged since s21" was never a statement about this suite.** A green quoted
for one runner says nothing about the other, and this register should stop reading as if it did.

### The repair, and why it is not a bump

The literals were restored **with their attribution**, in the ledger style the file already uses
(*"The literal is the point: a rewrite that renamed ids instead of regenerating them would keep the
disjointness assertion green on a set that had SHRUNK"*). Bumping 236 to 274 with no reason would
have thrown away exactly the property the comment exists to protect. Each step is now named:
236 → 257 (SBR-017), → 259 (SBR-016), → 274 (SBR-007 s21, +16/+2/+2 net of what the rebuild
replaced).

✅ After the repair: `tests-unit` is **363 suites / 6105 tests / exit 0**.

### 🔴 What is owed, and by whom

**`test:main` still is not in anybody's routine.** This session fixed the three reds; it did **not**
make the suite watched, and the next drift will be just as silent. `NONE` — it needs a decision
about where `test:main` runs, which is bigger than one task.

---

## D20 — 🟢 **FIXED and DRIVEN s26** · The page title was unreadable below its own width

**Found:** s24, driving [D18](#d18) · **Owner: SBR-007** (was `NONE`) · **Template** — confirmed by
measurement, see below · **Bites:** any client whose page title is longer than their window.

🔴 **The decision it was waiting for was settled by measuring the runtime, not by taste**, and the
two options it listed turned out to have OPPOSITE dispositions: **wrap is template work and was
reachable all along**; **ellipsize is product work and has no port** — now [D22](#d22). Full working,
both arms and the short-title control, in [SBR-007 §30](SBR-007-THE-PAGE-EDITOR.md).

**The fix:** the heading takes `{ sizeMode: 'contentHeight', width: { value: 60, unit: '%' } }`,
which flips `layout.ts:82` (`flexShrink: 1`) and `Text.tsx:60` (`whiteSpace: pre-wrap`) at once.
Driven at six viewports: the heading tracks the window (1296 → 193 px) instead of sitting at 965 px,
nothing is clipped at any width, and `Save page` still hit-tests `SELF` throughout, so D18 holds.

⚠️ **It was not free.** `layout.ts` assigns `flexGrow` and `flexShrink` in the SAME branch, so the
actions now sit right of the header rather than beside the title. **That half is Richard's** — it is
an appearance judgement and it reverts in two parameters.

The `Editing · <title>` heading in `/Pages/PageEditor`'s header row **never shrinks and never
wraps**. Measured with the same probe, in the same runs as D18's drive, in **both** arms:

| page title | title box | measured at 1920 / 1440 / 1200 / 1024 / 800 / 600 |
|---|---|---|
| `Retitled By The Drive` (22 ch) | 272..681, **409 px** | 409 px at **every** width |
| `Quarterly Board Meeting Minutes and Strategic Review 2026` (56 ch) | 272..1237, **965 px** | 965 px at **every** width |

`document.scrollWidth === innerWidth` at every width, so the overflow is **clipped, not
scrollable**. With the 56-character title the heading is cut off at every viewport at or below
**1237 px** — including in the fixed arm, on a 1024 or 1200 px screen.

✅ **This is the same mechanism as D18** (`layout.ts:82` — every node starts `flexShrink: 0`, and a
`contentSize` child opts back in on neither axis) **and D18's fix cannot address it.** `flexWrap`
moves whole children onto a new line; it does nothing to a single child that is itself too wide.
That is why this is a separate row rather than a reopening: wrapping the row was the right fix for
the actions, and it is not a fix that exists for the text.

⚠️ **Honest about severity.** Nothing is unreachable — the actions all work, the title is editable
in the `Title` field below, and the heading is a label rather than a control. It is a legibility
defect, not a blocked task, which is why it is filed at `NONE` rather than escalated.

**The decision it needed, now taken (kept for the reasoning):**

- let the title shrink and ellipsize (`flexShrink: 1` plus a text-overflow treatment) — but the
  runtime opts a node into shrinking only via a percentage size along the parent's direction, so
  this may be a **product** change in `layout.ts`, not a template one;
- let the heading wrap to a second line (it is a `Text`, so this is a template-side parameter);
- or accept it and say so.

🔴 **Do not re-derive the threshold from the fixture.** `1237` is this title's number. The general
statement is *the heading's right edge is `sidebar + title-text-width`, at every viewport* — which
is the same trap D18's `897` fell into, recorded here so the next reader does not repeat it.

---

## D21 — 🟢 FIXED s25, **DRIVEN s25** · A deployed site whose backend is another origin could not sign anybody in, and blamed their password

**Found:** s25, driving [SBR-007](SBR-007-THE-PAGE-EDITOR.md) AC1's deployed half ·
**Owner: `NONE` when found — fixed in the same session** · 🔴 **Product** (`nodegx-backend`), not
template · **Bites:** every deployed NodeGX app whose backend is not the page's own origin, which is
the normal deployed shape. Not the site builder only — the seam is the runtime's, shared by every
project that has users.

### The reading

The deploy folder served at `http://127.0.0.1:<port>`, its backend at `http://localhost:8601` — a
different origin by the browser's rule, and the only difference between the two arms below. Correct
owner credentials.

| | |
|---|---|
| the page says | *"That email and password did not match."* |
| the console says | `net.noodl.user.LogIn (/Pages/SignIn): The action could not be performed [user/log-in-failed]` |
| the backend says | **nothing — the request never arrived** |
| Chrome says | `corsError: "HeaderDisallowedByPreflightResponse"`, `failedParameter: "x-parse-installation-id"` |

Timeline, one click: `POST /login` queued at t+6 ms, preflight `OPTIONS /login` answered **204** at
t+7 ms, and at t+8 ms the POST died `net::ERR_FAILED` — after a preflight that succeeded.

### The mechanism, both halves named

`ParseAuthAdapter._makeRequest` (`noodl-runtime/src/api/backends/ParseAuthAdapter.ts:371`) sets
`X-Parse-Installation-Id` on every **auth** call. `ALLOW_HEADERS`
(`nodegx-backend/src/ops/headers.ts`) listed the other three headers that seam sends and not that
one. The browser therefore refuses the request it has just been told the method and origin are fine
for.

🔴 **The scope follows from which seam sends it.** `ParseWireAdapter._makeRequest` — the data path —
does **not** set the header, and its own docblock (`ParseAuthAdapter.ts:318`) says so as one of the
three deliberate differences between them. So a cross-origin deployed app had **working data and no
authentication at all**: the admin page list rendered fine over the same origin pair that could not
log in, which is exactly what the first probe of this session saw and nearly mis-filed as an ACL
question.

⚠️ **Why every previous arm was green.** A same-origin request is never preflighted. The editor's
preview serves the app and proxies the backend on one origin; `render-from-disk.js` proxies it at
`/__backend` for the same reason. Every AC1 reading before this one — s22's included — was taken
where this defect cannot appear.

### The fix, and the control that makes its test mean something

One header added to `ALLOW_HEADERS`. The spec is
`packages/nodegx-backend/tests/sbr007-auth-preflight.test.ts`, and it has two cases because the
first one alone is satisfiable by a regression: *"every header I asked for came back allowed"* is
also what a list that had become `*`, or one echoing the request, would produce. So a header nothing
sends is requested **in the same call** and must come back refused.

✅ **Mutant-checked.** With the header removed from `ALLOW_HEADERS` again, **both** cases fail;
restored, both pass. A spec that cannot fail is not a gate.

✅ **Driven, on the artefact, after rebuilding `dist/`.** The backend runs from a bundle, so the
source fix was invisible until `npm run build` — the same trap as a viewer bundle. Re-running the
identical cross-origin drive afterwards completes the whole AC1 loop, zero console errors:
[`notes/d21-cross-origin-signin-1440.png`](notes/d21-cross-origin-signin-1440.png) ·
[`notes/d21-cross-origin-signin-fixed-1440.png`](notes/d21-cross-origin-signin-fixed-1440.png).

### 🔴 What this session got wrong first, kept because it nearly shipped

The first network capture recorded `POST /login → 200` **and** the node reporting failure, and was
written down as *"the backend authenticated and the panel lied about it."* That 200 was **my own
control `fetch`**, fired from the same page a moment later and matched by the same URL filter. The
runtime's request had failed all along.

Two readings, one filter, opposite owners. What caught it was re-running with `loadingFailed`
captured and timestamps on every event, at which point the runtime's POST had no response at all.
**A capture filtered by URL attributes nothing to a producer** — and a probe that adds its own
traffic to the surface it is measuring must exclude itself before it reads.

The credentials theory that followed was wrong too, and wrong in the more dangerous way: a
`credentials: 'include'` pair *reproduced* `ERR_FAILED` exactly, which fits and excludes nothing.
`corsErrorStatus` was there to be read the whole time and named a different cause.

---

## D22 — 🔴 A `Text` cannot be ellipsized, because the runtime ships no `text-overflow` port

**Found:** s26, deciding [D20](#d20) · **Owner:** `NONE` · **Product**, not template · **Bites:** any
author who wants a single-line label that degrades gracefully instead of wrapping.

D20 offered three options — shrink-and-ellipsize, wrap, or accept. Wrap was buildable and is now
shipped. **Ellipsize is not authorable at all**, and the reason is a missing port, not a missing wire.

**Measured over `packages/noodl-viewer-react/src` and `packages/noodl-runtime/src`:**

| grep | hits |
|---|---|
| `textOverflow` / `text-overflow` — the finding | **0** |
| `wordBreak` — control, a `Text` `inputCss` port that DOES exist | **2** |
| files carrying `inputCss` — control, the mechanism a new port would use | **11** |

⚠️ **The controls earned their place.** The first run passed both search paths as a quoted shell
variable, zsh did not word-split it, and the finding *and both controls* came back **0** — an absence
indistinguishable from the finding. Identical to the trap [D15](#d15) records; caught here only
because the controls were read alongside.

**What exists and why it is not the same thing:** `Text` declares exactly one `inputCss` port,
`wordBreak` (`normal` | `break-all`), and `Text.tsx:60` picks `whiteSpace` from `sizeMode` alone —
`pre` for `contentSize`/`contentWidth`, `pre-wrap` otherwise. An author can choose *where* text
breaks and cannot choose *not to break it*, so "one line, then …" has no expression.

**The shape of the fix:** a `textOverflow` `inputCss` port on `Text` (the `wordBreak` block is the
template for it, three lines), plus the `whiteSpace: nowrap` + `overflow: hidden` pair that
`text-overflow: ellipsis` requires to do anything. 🔴 That last part is why it is a **product** row
and not a port addition: `whiteSpace` is currently derived from `sizeMode` with no author input, so
an ellipsis port that cannot also stop the wrapping would be inert — the same shape as
[D12](../phase-78-the-templates/DEFECTS-THE-TEMPLATES-FOUND.md)'s inert `borderWidth`.

🔴 **Unowned on purpose.** It is not SBR-007's — that task owns a screen, not the node library.

---

## D23 — 🟢 **DISPROVED s29 · every visual node has reported its rendered geometry the whole time**

**Found:** s27, building [SBR-007](SBR-007-THE-PAGE-EDITOR.md) AC2 · **Re-measured and DISPROVED:**
s29, in a browser · **Owner:** SBR-007 · **Kept, not deleted** — a disproved row is evidence about
the instrument, and this one is the sharpest the phase has.

### What it said

*"No visual node reports its rendered geometry, so a drag cannot know what it is over."* Measured
over `packages/noodl-viewer-react/src/nodes` (67 files, 51 `outputs:` blocks):

| grep | hits |
|---|---|
| an output naming `clientHeight` / `offsetHeight` / `measuredHeight` / `boundingBox` / `boundingClientRect` | **0** |
| `displayName` matching height/width/size/bounds/top/left — control | **20** |

### Why that 0 was a fact about the grep

🔴 **The four ports are declared once for every visual node, in a file that is not in `nodes/`.**
`react-component-node.ts:1053-1111` declares `screenPositionX`, `screenPositionY`, `boundingWidth`
and `boundingHeight` in a `Bounding Box` group, as getters over `clientBoundingRect`, filled by a
`DOMBoundingBoxObserver` that starts on `onFirstConnectionAdded`. `boundingHeight`'s own description
is *"Height this element actually ended up with after layout, in pixels"* — the sentence the row
said did not exist.

**Measured over the 175-node catalog — the product surface, not the source tree:**

| | count |
|---|---|
| visual nodes in the catalog | **29** |
| carrying **all four** `Bounding Box` outputs | **27** |
| carrying none | **2** — `Component Children`, `For Each`, neither of which draws a box |

⚠️ **The control could not have caught this, and that is the lesson.** It was run over the *same
directory* as the finding, so it proved the grep reached port declarations and could not prove it
reached *these* port declarations. **A control drawn from the same population as the finding tests
the search syntax, not the search boundary.** The row already carried one repair of exactly this
kind — `plug: 'output'` → `outputs:` — and repairing the *predicate* twice never re-asked whether
the *directory* was right.

### Driven, because a declaration is a claim

`packages/noodl-mcp/tests/d23GeometryDrive.test.ts` — authored through the real MCP door, rendered
in a headless Chrome by `withRenderedPage`, **5 specs, ~11s**. Two `Group`s at deliberately
different authored heights, each wired `boundingHeight → Text.text`, plus a literal `Text` as the
render control:

| probe | read back |
|---|---|
| box A, authored `height: 160px` | `offsetHeight` **160** · its port says **"160"** |
| box B, authored `height: 240px` | `offsetHeight` **240** · its port says **"240"** |
| box A `boundingWidth`, authored `320px` | **"320"** |
| the script arm (below) | **"160"** |
| the literal control | `"render control literal"` |

🔴 **Two boxes, not one, on purpose.** One box is satisfied by a port reporting the viewport, the
page, or a constant. Two that disagree by exactly the amount they were authored to disagree by are
not.

### And the script hatch the row said did not exist

The row's second claim was that the only escape was `domelement`, *"1 hit (`visual/video.ts`)"*.
That is also false, and by a wider margin: **every visual node exposes `this`** — a `reference`
output carrying the node itself, **27 of them in the catalog**. A `Function` node's author-declared
input defaults to `type: '*'` (`simplejavascript.ts:699`), and `canCastPortTypes` accepts anything
into `*`. So this connection is legal today:

```
Group.this ──▶ Function.in-el        // script:
                                     //   Inputs.el.getDOMElement().getBoundingClientRect().height
```

`getDOMElement()` is the same accessor `Group.tsx`'s own `Scroll To Element` resolves through. The
drive's fifth spec runs exactly this and reads back **160** — *the row pitch the row said "the graph
cannot see at all"*.

### What this changes

- **SBR-007 AC2's gesture is not blocked by a missing capability.** `Drag` gives `Drag Y`, the
  `Bounding Box` ports give the pitch, and the arithmetic between them is authoring work. It was
  never built, which is a different and much smaller statement than the one on file.
- 🔴 **The proposed fix would have shipped a dead port.** *"A `domelement` output on `Group` (three
  lines, `video.ts:283-288` is the template)"* — see **[D27](#d27)**: `domelement` reaches **0** of
  the library's typed inputs, and cannot reach the one destination `Video`'s own description names.
  A row that is wrong about the defect is usually wrong about the repair in the same direction.
- **[D15](#d15) is untouched.** It is about `dataTransfer`, not geometry, and it was re-measured at
  HEAD this session and stands. The two were filed as twins and are not: one was a real absence,
  one was a grep boundary.

---

## D24 — 🟢 FIXED s28 · `duplicatePage` wrote FOUR pages per call, and the 400 was its last symptom

**Found:** s27, driving AC2 · **Re-measured and fixed:** s28 · **Owner:** SBR-007 ·
**Template** (the fix) with **two product rows behind it** ([D25](#d25), [D26](#d26)) ·
**Bites:** anybody who presses Duplicate — they get one page in the answer and three junk drafts
in the list.

### 🔴 s27's recorded mechanism was wrong, and this is what the trap looks like

s27 wrote *"a cloud function's graph outlives its request … state left behind by an earlier
request, because the graph is shared across requests"*. It is not. Traced at HEAD (an env-gated
`[D24]` line in `runtasks.ts` and `simplejavascript.ts`, since reverted), **every request builds a
fresh `Run Tasks` instance** — `CloudRunner.run` creates the component in a per-request `NodeScope`
and tears it down on settle — and the two `Do` pulses that produced `already-running` were **1ms
apart inside one request**, on an instance that had `initialize`d 20ms earlier:

```
inst=15 initialize                      ← this request's own node
inst=15 Do PULSE   {state: idle}        ← pulse 1
inst=15 RUN START  {numTasks: 2}
inst=15 Do PULSE   {state: running}     ← pulse 2, 1ms later, SAME instance
inst=15 ALREADY-RUNNING                 → unchanged → deny → 400
```

⚠️ The reading that fitted and excluded nothing was *"an earlier request left state behind"*: it
explains the flakiness, it explains the traffic dependency, and it is false. What separated it from
the truth was an **instance identity in the trace** — not more reasoning about the same evidence.
The peer session that fixed [DEF-023] the same morning had already established the opposite
(component scope now dies with the request), which is the second signal this row had available and
did not use.

### What was actually happening

`duplicatePage` hangs its page write off a code node, and that code node **ran four times per
request**. Each run fired `Outputs.built()`, and `built` is wired to `Create Record.store`:

| run | why it ran | what it wrote |
|---|---|---|
| 1 | `source.fetched` — fired by the **`Id` setter**, before any read | `Copy of Untitled`, 0 sections |
| 2 | `title` and `slug` arrived (changed) | `Copy of Pricing`, 0 sections |
| 3 | `title` and `slug` arrived **again, identical** (`same: true` in the trace) | `Copy of Pricing`, 0 sections |
| 4 | the last arrival | `Copy of Pricing`, **2 sections** — the one it answered with |

Measured over the class rather than off the answer, one call left **four `Copy of …` rows**. The
`already-running` 400 is the fourth run's `Do` landing while the third run's was still in flight —
a symptom of the same repeat, and the only one that was ever visible, because it is the only one
that reaches the caller. **The suite had been green for ten sessions with this happening**: every
assertion read the copy the response named, and that one is always correct.

### The fix, and what it costs

Two lines of template, in `sb004Components.ts`:

- **`source.done` instead of `source.fetched`** into `newProps.run`. `Done` is the fetch
  invocation's outcome and cannot fire before the read; `Fetched` fires on binding too. See
  [D25](#d25).
- **`runOnChange-in-title` / `-in-slug` / `-in-sourceId` unticked** on `newProps`, so a value
  arrival no longer re-runs a node whose run performs a write. See [D26](#d26).
- Plus `source.id -> newProps.in-sourceId` and a readiness guard on the id, which is belt-and-braces
  on both.

**Result: four rows → one**, and the reorder-before-duplicate arrangement that used to fail one run
in five to three in five is **5/5 green with zero `already-running` events**.

🔴 **The gate is a count, and it had to be**: `it('wrote exactly ONE page — the copy it answered
with, and no others (D24)')` in `sb004-publication-invariant.test.ts`, asserted over
`/classes/Page` and naming each row `answered` or `ORPHAN`. Reverting the template reddens it and
prints the orphans. The AC2 drive is **back in front of `duplicatePage`**, where s27's comment said
it could not go — that arrangement is now the D24 gate rather than a workaround.

⚠️ **What this fix does NOT do.** It repairs one endpoint. The two runtime behaviours behind it are
unowned and every other graph in the product is still exposed to them — a code node that writes is
the ordinary shape, not an exotic one. That is D25 and D26, and they are the rows that matter.

---

## D25 — 🟡 `Record.Fetched` fires when the `Id` merely BINDS, and its description promised a read

**Found:** s28, tracing [D24](#d24) · **Owner:** `NONE` (the behaviour) · **Product** ·
**Bites:** any graph that acts on `Fetched` — it acts once on a record nobody has read yet.

`setModel` sends `Fetched` straight from the `Id` input setter (`dbmodelnode2.ts:324`), where
`Model.get(id)` has minted an **empty local model** and nothing has been fetched. The behaviour is
deliberate and documented in the file's own outcome note — `Done` exists precisely because the two
paths differ, and `erg-001-cloud-services-outcomes.test.ts` pins the binding path as outcome-free.

🔴 **What was wrong was the sentence an author reads.** The port said *"Fires once the record has
been read and the property outputs are up to date"* — false on that path in both halves, and the
twin node (`Model2`) already said "bound". A template believed it and wrote a junk row per request.

✅ **Fixed s28, the description only**: it now names the bind, and points at `Done` for acting on
data that is really there. Regenerated through `catalog:generate` → `catalog:merge` → `docs:nodes`
and `cloud-library:generate`, so the property panel, the MCP catalog, the docs site and the cloud
library all say it — **four copies, and a fix to one of them is not a fix**.

🟡 **Still open, and unowned: the behaviour.** A signal named `Fetched` that fires without a fetch
is a trap a description can only warn about. Two candidate repairs, neither costed: fire it only
when the bound model has data, or split the bind announcement onto its own port. Both would
re-grade browser graphs that rely on the current shape, which is why this is a row rather than a
patch.

---

## D26 — 🔴 A value that has not changed re-runs a "Run On Value Change" input

**Found:** s28, tracing [D24](#d24) · **Owner:** `NONE` · **Product** · **Bites:** any code node
that writes, sends, or charges — it does it once per arrival, not once per change.

`simplejavascript.ts`'s `setScriptInputValue` schedules a run whenever a value lands on a ticked
input. It **never compares the value to the one already there**. Measured in the D24 trace:
`title: 'Pricing'` and `slug: 'pricing'` arrived a second time carrying exactly what they carried
the first time (`same: true`), the node ran again, and that run wrote a Page row.

🔴 **The contract this contradicts is the runtime's own.** `run-on-value-change.ts` — Richard's
2026-08-01 decision, written up in that file — says an async re-fetch *"that returns an identical
value fires no change, so a node that must re-run once per fetch still wires `Run`"*. That sentence
is the justification for keeping `Run` at all, and it is only true if an identical value is not a
change. Today it is one.

**The shape of the fix, and why it is not in this session:** an equality guard for **primitives
only** in `setScriptInputValue` (objects and arrays must still re-run — a producer may have mutated
one in place, and the runtime cannot know). It is four lines. What makes it a row rather than a
patch is that **twelve node families share this idiom** — `expression.ts`, `condition.ts`,
`dbcollectionnode2.ts` and nine more all call `shouldRunOnValueChange` with no comparison — and
repairing one of them leaves the runtime inconsistent in a way an author cannot see. It wants a task
that sweeps the family, with the primitive/reference line stated once.

---

---

## D27 — 🔴 The only `domelement` port in the product cannot reach the destination its own description names

**Found:** s29, while disproving [D23](#d23) · **Owner:** `NONE` · **Product**, not template ·
**Bites:** anyone who follows `Video`'s `DOM Element` port to the place the port tells them to take
it — and anyone who copies it, which is what D23 proposed doing.

`Video.onVideoElementCreated` is declared `type: 'domelement'` and described as *"The underlying
video element, **for a Group to scroll to** or a script to reach"* (`video.ts:283-288`). The
destination in that sentence is `Group`'s `Scroll To Element - Element`, and it is declared
`type: 'reference'` (`group.ts:133-142`).

**`canCastPortTypes` transcribed from `nodelibrary.ts:369` and executed over the shipped catalog's
own `typecasts` table:**

| pair | result |
|---|---|
| `domelement` → `reference` — **the wire the description names** | **`false`** |
| `domelement` → `string` | `false` |
| `domelement` → `*` — control, the rule does return `true` for something | `true` |
| `reference` → `reference` — control, the destination is reachable by *something* | `true` |
| `number` → `string` — control, an ordinary cast still works | `true` |

So the editor refuses that connection with `type-mismatch`, and `getConnectionStatus` renders
*"a source port of type **DOM Element** cannot be connected to a target port with type
**Reference**"*. **The port's description is a route the product does not have.**

**And it would not have worked if it had connected.** `Group.tsx:113-139` implements
`scrollToElement(noodlChild)` by calling `noodlChild.getDOMElement()` — it wants the **node**, not
the element. `Video.tsx:217` sends the raw `HTMLVideoElement`, which has no `getDOMElement`, so the
guard would return *"the node on Element has no rendered DOM element — it may not be mounted"*: a
plausible sentence, and the wrong one, about an element that is mounted. Two defects stacked in the
same eight words of description.

**Measured over the 175-node catalog:**

| | count |
|---|---|
| `domelement` **outputs** in the whole library | **1** (`Video.onVideoElementCreated`) |
| `domelement` **inputs** in the whole library | **0** |
| typed input ports it can legally reach | **0** — the 14 it reaches are all `*` wildcards |
| `reference` **outputs** — control, the type the destination *does* take | **27** (`this`, on every visual node) |

🔴 **The working wire already exists and is one identifier away**: `Video.this → Group.scrollToElement.element`, a `reference` on both ends, driven green in `d23GeometryDrive.test.ts`'s script arm through the same `getDOMElement()` accessor.

**The shape of the fix**, in ascending order of blast radius:

1. **Repair the description** — one string, no behaviour: say the port hands a raw DOM element to a
   script, and point `Scroll To Element` at `This` instead. ⚠️ A node's port description lives in
   **four generated copies** (`catalog:generate` → `catalog:merge` → `docs:nodes` **and**
   `cloud-library:generate`).
2. **Widen `scrollToElement`** to accept either a node or an element — three lines in `Group.tsx`,
   and `domelement → reference` added to the cast table.
3. Leave the port as the script hatch it actually is.

🔴 **Unowned on purpose, and it is the reason [D23](#d23)'s proposed fix had to be stopped.** D23
offered *"a `domelement` output on `Group` (three lines, `video.ts:283-288` is the template)"*.
Copying this port would have doubled a dead end — and the row would have read as closed.

---

<a id="d28"></a>

## D28 — 🔴 A `Drag`'s child loses its CSS class, so a draggable element cannot be styled or selected

**Found s30, by driving.** Product. ✅ **FIXED 2026-08-30 by phase 80 as
[DEF-027](../phase-80-the-defects-the-templates-found/DEF-027-A-DRAG-CHILD-LOSES-ITS-CSS-CLASS.md)**
(owner was `NONE`; the row was moved into that phase's table at 12:50 and closed at s23).

🔴 **The mechanism below is right about the symptom and wrong about where it lives.** The
discarding is not `react-draggable`'s and not `Drag`'s — it is the **wrapper's prop spread**.
`NoodlReactComponent.render` spread `...noodlNode.props` and then `...otherProps`, so the
library's injected `className` overwrote the author's. The library had in fact tried to merge
(`clsx(children.props.className || '', 'react-draggable', …)`) and had nothing to see, because
the child it clones is the wrapper element, whose props are only `{key, noodlNode, ref}`. Both
halves had to be true; either alone is harmless. Corrected here rather than silently, and the
"shape of the fix" paragraph below is corrected in place for the same reason.

**The sweep this row asked for has an answer: one.** `Drag.tsx:214` is the only `cloneElement`
in `packages/noodl-viewer-react/src`, and `react-draggable` the only third-party wrapper any
node puts around authored children. It was fixed at the spread anyway, so a future wrapper
cannot reopen it.

`react-draggable` clones its child with its own `className`, and the child's authored
`cssClassName` does not survive it. The element that reaches the DOM carries `react-draggable` and
nothing else.

| read off the rendered page (`ac2DragGestureDrive.test.ts`) | |
|---|---|
| `Group` inside a `Drag`, `cssClassName` set by connection | class in DOM: **`react-draggable`** — the authored one is **absent** |
| `Group` one level further in, same kind of connection, same `Component Inputs` node | **present** |
| `Text` inside the same card, same kind of connection | **present** |
| `Group` outside any `Drag`, `cssClassName` by parameter | **present** |

🔴 **The three controls are what make this about `Drag` and not about `cssClassName`.** The obvious
competing reading — "a *connected* `cssClassName` does not apply" — is excluded by rows two and
three, which take their class by the same mechanism from the same node and keep it. Row four
excludes "this Group was special". Without them a single missing class proves nothing, which is the
shape [D23](#d23) got wrong.

**Who it bites.** Anyone who makes something draggable and then tries to style it, animate it, or
reach it from a stylesheet — which is most of what a person does with a drag. It fails **silently**:
the class is accepted in the editor, stored in the graph, survives the deploy, and is simply not
there at runtime. There is no error and nothing to search for.

**Not the same defect as [D27](#d27)**, though they rhyme: D27 is a port that cannot be connected,
this is a port that connects, stores, and is discarded on render.

**The shape of the fix** — recorded as written, then what it turned out to be. *Written:*
"`Drag.tsx` renders `<Draggable>` around the child and lets `react-draggable` own `className`.
Merging rather than replacing is the repair, and it is in the viewer's own component — not in the
dependency. ⚠️ Check it against `Drag`'s siblings first […] Nobody has counted them."

*Built:* merging was right and "in the viewer's own component" was right; the **place** was the
wrapper's spread, not `Drag.tsx`. Fixing it there is what makes the sibling warning moot rather
than merely answered.

✅ **The two pinning assertions in `ac2DragGestureDrive.test.ts` were flipped, not deleted**,
exactly as this paragraph instructed, and `READ` now finds the cards by `probe-card-` instead of
borrowing `.react-draggable`. The drive was re-run at HEAD **before** the fix (9/9, both pins
passing — the defect confirmed as shipped) and again after (9/9 with the pins inverted).

⚠️ **Between those two runs the viewer bundle has to be rebuilt.** `render-report.js` serves
`packages/noodl-editor/src/external/viewer/noodl.viewer.js`, a gitignored build artifact; the
first post-fix run came back **9/9 red** purely because of it, which reads exactly like a broken
fix. Anyone driving a runtime change through this harness owes
`cd packages/noodl-viewer-react && npx webpack --config webpack-configs/webpack.viewer.prod.js`
first.

✅ **Moved, and the delay very nearly cost the row.** It was appended to phase 80's `TASKS.md`
at 12:50; that phase's s22 wrote its handoff at 13:22 saying the queue held **no workable open
row left**, having read the same file. 32 minutes. The row survived because s23 read the table
rather than the handoff — which is the argument for grading a phase against its table and never
against a summary of it.

---

## D29 — 🔴 The template's confirmation and refusal are one-way latches, so a retry that succeeds shows both

**Found 2026-08-30 by P80 DEF-024's corpus calibration (`npm run calibrate:gates`), verified
against this template's own source at HEAD** (`site-builder.content.json`, read-only — filed
here rather than fixed because the file is this phase's active lane). Owner: **NONE**.

Four gates in the embedded template are constant-`true` Conditions whose only trigger is
`Evaluate`, feeding `mounted`/`visible` — the shape P80's new `gate-only-turns-on` warning names:

| component | gate | port |
|---|---|---|
| `/Site/ContactForm` | `The one confirmation` ← 'Show the confirmation' | `mounted` |
| `/Site/ContactForm` | `The one refusal` ← 'Show the refusal' | `mounted` |
| `/Pages/Setup` | `The one refusal` ← 'Show the refusal' | `visible` |
| `/Pages/Setup` | `Signup refusal` ← 'Show the signup refusal' | `visible` |

Nothing can ever push `false` into any of them within a page life. A visitor whose contact-form
send **fails and then succeeds on the retry** is shown *the confirmation and the refusal at
once*, with nothing to say which won — P78 D36's exact accumulation, in the OTHER shipped
template. The mechanism drive is `noodl-mcp/tests/def024-gate-drive.test.ts` (real Chrome:
tick-then-untick leaves both notices in the document; the Switch-per-answer control arm leaves
exactly one).

**The repair is one node per answer, not more Conditions**: `Switch` — `done → on` on its own
switch and `→ off` on the other's, `state → mounted`. Or the members template's paired
constant-`false` clear (`tpl001Components.ts` s15 shape) if the Conditions stay. Either shape
also silences the new warning; regenerating the template surfaces it today as 4 advisory
`gate-only-turns-on` diagnostics.

⚠️ The 17-ish SBR drive-fixture projects in the corpus all carry copies of this shape — they are
this one defect, not seventeen.

---

## D30 — 🟢 FIXED s32. The page editor drew its sections in an order nobody else used, so reordering moved the wrong one

**Found 2026-08-30 (s31) by driving the real `/Pages/PageEditor`** —
`nodegx-backend/tests/ac2-page-editor-drag-drive.test.ts`, 23 specs, real backend with enforcement
on, real pointer. 🟢 **FIXED and DRIVEN 2026-08-30 (s32)** — see the block at the end of this row
and [SBR-007 §35](SBR-007-THE-PAGE-EDITOR.md). See also [§34.3](SBR-007-THE-PAGE-EDITOR.md).

`/Pages/Site`'s section query carries `visualSort: [{ property: 'order' }]`. `/Pages/PageEditor`'s
carries **none**. Both are labelled *"This page's sections"*; the template holds four such queries
and exactly one is sorted, and the unsorted one is the editor's — identified by its unique
`runOnChange-qp-pageId`, not by position.

🔴 **It is AC2's own foundation.** `dropIndex` counts **DOM siblings**; `reorderSection` renumbers
the list sorted by **`order`**. Those are the same list only while the editor draws in `order`.

Measured on the screen, with the stored order deliberately made to differ before any browser opened:

| | |
|---|---|
| drawn | `hero, richText, gallery` |
| stored | `richText, hero, gallery` |
| drag the bottom card to the top | screen **unchanged**; stored becomes `gallery, richText, hero` |
| `Move up` on the card a client sees LAST | button real, reachable, hit-tested — **nothing happens** |

✅ **The last row is how a person meets it.** The bottom card holds stored position 0, so the
planner's guarded return is *correct* and the press is legitimately refused — on a row that visibly
has two above it, with no message. The button is not broken; the list is.

⚠️ **It predates the drag.** `Move up`/`Move down` have always renumbered a list the client was
never shown. The ten stored-row cases in `sb004-publication-invariant.test.ts` grade the
**endpoint**, which is correct, and never open a screen.

### 🟢 The fix, s32

`visualSort: SECTION_SORT` on the `sections` node of `PAGE_EDITOR_NODES` in `sb005Components.ts`,
then `npm run template:site-builder`.

🔴 **`SECTION_SORT` MOVED, rather than being imported where it stood.** It was defined in
`sb006Components.ts`, but `sb006` already imports `ROUTER` from `sb005` **and uses it at
module-eval time** — importing back would have made a cycle in which `ROUTER` is still in its TDZ
when `sb006`'s body runs. It now lives in `sb005Components.ts` and `sb006` re-exports it exactly
the way it already re-exports `ROUTER`, so there is still **one copy** and no consumer moved.

**Driven, on the real screen** (`ac2-page-editor-drag-drive.test.ts`, 23/23):

| | before | after |
|---|---|---|
| drawn vs stored at boot | `hero, richText, gallery` vs `richText, hero, gallery` | **both `richText, hero, gallery`** |
| after dragging the bottom card to the top | drawn unchanged, stored `gallery, richText, hero` | **both `gallery, richText, hero`** |
| `Move up` on the card a client sees LAST | hit-tested, **nothing happens** | **moves the row they pointed at** |

⚠️ **Two of the four section queries are still unsorted, and that is correct.** They are
`/#__cloud__/publishPage` and `/#__cloud__/reorderSection` — **cloud functions, not screens**.
`reorderSection` sorts in its own script with an `id` tie-break and its comment says why it cannot
trust query order at all: *"That array is a query result whose row order the backend does not
promise."* The two queries that **draw a list to a person** are the two that are now sorted.

The three FINDING specs were **flipped, not deleted** — `editorSorted:true`, and the two
drawn-vs-stored specs moved from `not.toEqual` to `toEqual`. 🔴 The `beforeAll` pre-move that makes
the stored order differ from the creation order matters MORE now, not less: without it a screen
that ignored `order` would still draw the right list and those specs would pass on a template with
no `visualSort` at all.

---

## D31 — 🟢 FIXED s32. Opening the page editor on a page with sections started a cyclic write loop that never stopped

**Found 2026-08-30 (s31), same drive.** 🟢 **FIXED and DRIVEN 2026-08-30 (s32)** — see the block at
the end of this row and [SBR-007 §35](SBR-007-THE-PAGE-EDITOR.md). See also
[§34.4](SBR-007-THE-PAGE-EDITOR.md).

Eleven seconds of a page that was opened and looked at — **no pointer, no key, no click**:

| arm | `SetDbModelProperties` errors | `cyclic-loop` | `query-failed` | writes landed |
|---|---|---|---|---|
| **shipped** | **115,755** | 142 | 69 | ✅ |
| minus the editor's `Changed → storageFetch` wire | **15,102** | 6 | 0 | ✅ |
| plus three `runOnChange-in-…: false` on `merge` | **0** | **0** | **0** | ❌ |

🔴 **The runtime names it** — `[noodl] JavaScriptFunction (/Admin/SectionRow): Cyclic loop detected
[runtime/cyclic-loop]`. Not an inference.

🔴 **The obvious suspect is excluded by an arm.** `save.done → Changed → sections.storageFetch` is a
real edge and removing it does **not** stop the loop; it only stops the query failures. A fix aimed
at the editor would have measured green on every gate and changed nothing.

**The cycle is inside the row.** `merge` re-runs whenever a value lands on it (`runOnChange` reads
**absent as ticked**), `merge.out-built → save.store` writes the section, `SetDbModelProperties`
writes into the very model `For Each` feeds the row's `data` from, and `merge` returns a *fresh
object* every run, so the value always counts as changed.

**Consequences**: the backend's 1200/min limiter is reached from an idle screen; the page's own
`DbCollection2` is refused with everything else; the client's section list has been observed
emptying entirely (two of four runs — the refusal is the stable reading, the empty list is not).

✅ **The three parameters that stop it are ones the product already knows about.** Eleven other
`JavaScriptFunction` nodes in this template state `runOnChange-…: false`, three of them in this same
screen, and the editor's NDA-017 migration writes exactly these three onto any node whose `run` is
connected — which `merge`'s is (`saveButton.onClick`, `upload.done`).

⚠️ **Scope, stated so it is not overclaimed.** A project *opened in the editor* is repaired by
`applyRunOnValueChangeMigration` on load — the `SBR-007 Page Editor Drive` fixture on disk carries
the three parameters and the template at HEAD does not. Every consumer that reads the artefact
without running `applyPatches` gets the loop: a headless render, a deploy taken from the artefact,
an agent reading the project through the MCP door.

### 🟢 The fix, s32

Three parameters on `merge` in `sb005Components.ts` — `'runOnChange-in-data': false`,
`'runOnChange-in-body': false`, `'runOnChange-in-image': false` — **first in the bag**, because
`NodeScope.setNodeParameters` drains queued values in key order and a flag that landed after the
value it governs would let the load-time run happen once anyway. Then
`npm run template:site-builder`.

**Driven, on the real screen** (`ac2-page-editor-drag-drive.test.ts`, 23/23):

| arm | `SetDbModelProperties` errors | `cyclic-loop` | `query-failed` | writes landed |
|---|---|---|---|---|
| **shipped, after the fix** | **0** | **0** | **0** | **none** |
| shipped + the three flags forced back to `true` | 20,000+ | ✅ | ✅ | ✅ |
| …and that arm with the refetch wire also dropped | 20,507 | 6 | 0 | ✅ |

✅ **`unpack` was checked, and it must NOT get the same treatment.** It takes `in-data` on the same
wire and has **no `run` connected** (`connections.json` gives it exactly one inbound wire), so the
value change is its only trigger — silencing it would leave the body textarea and the image preview
permanently empty. The NDA-017 migration skips it for the same reason. 🔴 **That is a measurement,
not a decision to leave it alone**: s31 recorded it as unmeasured and this is the reading.

✅ **Save still works.** `merge.run` keeps both its wires (`saveButton.onClick`, `upload.done`), and
the three flags govern only the value inputs. The quiet arm renders all three cards, which is the
spec that stops "quiet" being confused with "broken".

🔴 **The arms INVERTED, and the specs were flipped rather than deleted.** The gesture now runs on
the **shipped** project — s31 could only drive it on a mutant — and the mutants now *restore* the
defect instead of repairing it. `setParams` grew a mirror precondition for this: the defect-arm
asserts the three keys are present **and `false`** beforehand, so a template that quietly stopped
stating them cannot leave an arm "restoring" a defect that was never absent.

✅ **Neither D30 nor D31 owes a row in phase 80** — s31 settled that by the rule below (both fixes
touch the template, not the product surface) and s32 closed them here, which is where they belonged.

---

## D32 — 🟢 FIXED s24 (phase 80 DEF-032). The pass that grades the migration's writes examined one of sixty-five

**Found 2026-08-30, in a parallel session that fixed D30/D31 independently in a worktree.** Owner:
**NONE**. Not a screen defect — a **gate** defect, and it is the answer to *why D31 shipped past a
suite that already knew about the migration*.

The template deliberately does not state every `runOnChange-*` its nodes need; it leaves most to the
editor's NDA-017 migration, and `sb007Template.test.ts` asserts that on purpose — *"the migration
really does fire on this template, in bulk"*. That is a good known-firing signal and it is **not**
the problem.

The problem is the pass that grades those writes. `gradeMountTriggered` walks `plan.writes` and opens
with:

```ts
if (!incoming.some((w) => MOUNT_SIGNALS.includes(w.fromProperty))) continue;
```

so a write is examined **only** when its node is triggered by `didMount`. Everything else is skipped
before a single rule runs.

**Measured on the artefact** (`planRunOnValueChangeMigration` over `site-builder.content.json`, with
the grader's own predicate applied to every write):

| artefact | writes the migration would make | **graded** | **skipped** |
|---|---|---|---|
| before the D31 fix | **68** — three of them `merge:in-data/in-body/in-image` | **1** | **67** |
| **at HEAD, after the fix** | **65** — none on `/Admin/SectionRow` | **1** | **64** |

🔴 **D31's three writes were among the sixty-seven.** `merge`'s control signal is `saveButton.onClick`
and `upload.done`, never `didMount`, so the grader `continue`d past it while the shipped page editor
wrote six figures of updates in eleven seconds.

⚠️ **The mount rule is not wrong.** It grades a real hazard — an input silenced on a node whose
producer arrives after mount — and it grades it correctly. The defect is that **nothing grades the
other failure mode**: a silenced input whose value is fed, directly or transitively, by a record
write that this same node's output causes. That is D31's shape, and it is statically checkable from
the artefact.

**What a repair looks like**: a second pass over `plan.writes` asking, for each, whether the node's
output reaches a `SetDbModelProperties` / `NewDbModelProperties` whose collection feeds the
`For Each` supplying the silenced input. 🔴 **Do NOT "fix" this by making the template state all 65** —
that changes what the migration is for and needs its own argument. **The gate is the gap.**

🔴 **The general lesson, and it is this phase's recurring one.** `gradeMountTriggered` reads as
coverage of the migration's writes and is coverage of **1.5%** of them. ✅ **A pass whose first line
is a `continue` is not coverage until you have counted what it REACHED** — the number that mattered
here was never the offender count, it was the `1`.

### 🟢 The fix, s24 (2026-08-30) — phase 80 **DEF-032**

**Measured first, and the table above is confirmed at HEAD**: `plan.writes` = **65**,
mount-triggered = **1**, graded = **1**, skipped = **64**.

Three things shipped in `sb007Template.test.ts`, and the second is the repair:

**1. The `1` is now asserted.** `D32 — the mount pass reaches 1 of 65 writes` pins both the write
count and the reach, with the cardinality asserted where they meet. The mount pass is unchanged —
it grades a real hazard correctly — but it can no longer read as coverage without the number beside
it.

**2. `gradeWriteBackCycle` — the failure mode nothing graded.** For every write, whether the node's
output reaches a `SetDbModelProperties`/`NewDbModelProperties` on a collection that also feeds the
silenced input. Two confidences, deliberately kept apart:

| bucket | shape | at HEAD | asserted as |
|---|---|---|---|
| `repeaterItem` | the input is a **repeater item** and the node writes the collection the repeater draws from — **D31 exactly** | **0** | a defect (green, mutant-killed) |
| `sameCollection` | reads and writes one collection by any other route | **6** | a **pinned census**, not a defect |
| `cleared` | writes a collection that does not feed it | 23 | reason column |

**It reaches 29 of 65**, against the mount pass's 1, and that number is asserted too — D32's own
lesson applied to D32's own repair.

🔴 **The mutant restores D31 and names TWO ports, not three.** With `merge`'s three
`runOnChange-*` deleted, the pass reds on `in-data` **and** `in-body` — `in-body` traces back to the
repeater item through `unpack-2 → bodyField.startValue → bodyField.onTextChanged`, which is why
D31's fix needed three flags rather than one. `in-image` is correctly absent: it comes from
`upload.cloudFile`, so it is in the migration's write set without being in the cycle. *A grader that
named all three would be naming the port list, not the loop.*

✅ **A CONTROL asserts the two passes are not the same pass** — the offending write is invisible to
`gradeMountTriggered` and visible to this one. Without it the mutant could pass for the wrong reason.

⚠️ **The template is NOT asked to state all 65**, per this row's own warning. The pass fires only
where a write is load-bearing against a cycle.

**3. A latent contamination fixed, found by the new control.** `migrationProject()` shallow-spread
each node, so every `parameters` object was **the same object** as the module-level `shipped`
artefact's — and the two mutant arms `delete` from it. The mutation outlived the test that made it:
a later `migrationProject()` came back with the previous mutant's damage already applied, which is
how the new control arm failed with `merge` undefined. Nodes and connections are now copied.

---

## D33 — 🔴 Six same-collection writes on the theme editor, plausible and unmeasured

**Found 2026-08-30 (s24), by D32's new pass.** Owner: **NONE**. **Not a confirmed defect — a
candidate list with a number on it.**

`gradeWriteBackCycle`'s `sameCollection` bucket holds six writes on `/Pages/ThemeEditor` whose node
both reads and writes one collection:

| node | inputs | collection |
|---|---|---|
| `buildTokens` | `in-primary`, `in-background`, `in-text`, `in-fontDisplay` | `Theme` |
| `readTheme` | `in-rows` | `Theme` |
| `readSettings-2` | `in-rows` | `SiteSettings` |

**The plausible reading is benign**: the route back runs through `startValue` on a text input, and
`startValue` does not emit `onTextChanged`, so the written value may never re-enter the node. On
that reading the migration's flags are belt-and-braces and nothing is wrong.

🔴 **Plausible is not measured, and D31 is why this row exists rather than a sentence in D32.** D31
looked benign by exactly this kind of reasoning until the runtime named it —
`[noodl] JavaScriptFunction (/Admin/SectionRow): Cyclic loop detected [runtime/cyclic-loop]` — and
it was 115,755 write errors in eleven seconds of a page nobody had touched. The difference between
these six and D31 is a runtime question the artefact cannot answer.

**What it needs**: a drive on the theme editor, watching for `cyclic-loop` and counting
`SetDbModelProperties` writes on an idle screen — the same instrument that settled D31.

✅ **The census is asserted exactly**, so a **seventh** cannot appear quietly: a new entry fails
`D32 — the unconfirmed same-collection census is exactly the six known rows` and someone reads the
reason. That is the point of pinning an unknown rather than skipping it.

---

## D34 — 🔴 Publishing a page that no longer exists answers `200 published: true`, and writes nothing

**Found 2026-08-30 (s34), by [SBR-015 AC4's own drive](SBR-015-A-FAILURE-WITH-NOWHERE-TO-GO.md#4c-🟢-ac4-is-met--driven-2026-08-30-s34-two-arms-one-variable)** ·
**Owner: `NONE`** · **Product (runtime), not template** · **Bites:** an admin who clicks Publish on
a row whose page was deleted in another tab, or by a colleague a minute ago. They are told it
published. The list agrees. Nothing was written.

Measured on a deployed site-builder, both calls in one session against one backend:

| the call | answer | `execution_steps` | rows in `Page` afterwards |
|---|---|---|---|
| `publishPage {pageId: <real>, publish: true}` | **200** `{published:true}` | 7, all `success` | 1, updated |
| `publishPage {pageId: 'sbr015-no-such-page-0000'}` | **200** `{published:true}` | **5, all `success`** | **1 — nothing created, nothing changed** |

🔴 **Attributed exactly one hop, and deliberately no further.** The backend route the node's own
contract names answers correctly:

```
PUT /classes/Page/sbr015-no-such-page-0000  →  404
```

So a 404 exists and is lost somewhere between that route and the node. `SetDbModelProperties`
passes `error: (err) => setError(err, tokens)` (`setdbmodelpropertiesnode.ts:146-148`), which
reports `failure` — and `failure` **is** wired to `deny` in this graph, by SBR-015's own fix. A
failure here would therefore have refused correctly and said so.
⚠️ **Which hop drops it — the cloud-side store adapter, or the callback — is NOT established.**
That is the first measurement for whoever takes this, and the control pair is already standing in
`sbr015-execution-steps-drive.test.ts`.

**Not SBR-015's, and not AC1's either.** AC1's sentence is *"an admin who clicks Publish on a page
that **cannot be published** is told so"*, and it is met on both arms (§2.3d, §4c): the refusal
path works whenever a node fails. This row sits upstream of all of that — a node that **should**
fail reports `done` — so no failure edge can reach it and wiring is not the fix.

🔴 **It is the runtime, not the site builder.** It fires for any app that writes a record by
explicit id, which is why it is registered here (where it was measured) but belongs beside
[D25/D26/D27](#d25) in phase 80. **Ids collide across registers — this is phase 77's `D34`.**

---

## D35 — 🟢 FIXED s35. The setup page spaced itself with a bare `24` where `--space-6` is `24px`

**Found by SBR-012's gate on its first run over the whole artefact, and fixed in the same session
because the doctrine left no other disposition.**

`/Pages/Setup` → the `Form` group carried `paddingTop: 24`, `paddingLeft: 24`, `paddingRight: 24`
(`sb005Components.ts`). `--space-6` **is** `24px`, so the intent was the token and the spelling was
a literal.

⚠️ **Not a rendering defect, and that was measured rather than assumed.** `paddingTop` on a `Group`
is `px`-only in `node-catalog.json` (`defaultUnit: "px"`, `units: ["px"]`), so it rendered 24px.
`DiagnosticCode.UnitlessDimension` fires only when a port's default unit is `%` — it was **right**
to stay silent here, and the sibling `width` port, which *is* `%`-default, is why the check exists
at all. Reasoning from that sibling would have produced a confident wrong reading.

🔴 **It is a survivor, and that is the finding.** The identical trio was removed from
`/Pages/PageEditor`'s `Editor` group during **SBR-007**, with the sentence *"a raw dimension here
had no token reason."* This copy lived on because **nothing scanned it**: `sb006PublicSite.test.ts`
reads the five SB-006 components, and Setup belongs to SB-005. A gate whose population is narrower
than the artefact reports a clean template it has not looked at.

### 🟢 The fix, s35

`var(--space-6)` on all three ports. `npm run template:site-builder` regenerates with a diff of
**exactly those three lines**; `sb007Template` byte-identity holds; the full `@noodl/mcp` suite is
79 suites / 1040 tests, exit 0.

**No owner needed — it is closed.** Filed here rather than left in the task file because a fix with
no row is a repair the register cannot count, and this one is the argument for SBR-012's second
population.

---

## D36 — 🟢 FIXED IN THE SAME SESSION (s36). Three new `merge` inputs shipped without their D31 keys

**Found by `sb007Template.test.ts`'s D32 write-back arm, on SBR-005's first regeneration.** It named
all three by hand:

> `/Admin/SectionRow JavaScriptFunction#merge.in-heading — writes "Section" and is fed it AS A
> REPEATER ITEM` — and the same for `in-linkLabel` and `in-linkTarget`.

SBR-005 gave `Admin/SectionRow` three new text fields. `merge` already carried
`runOnChange-in-{data,body,image}: false` and the three new inputs arrived **unstated** — which
`run-on-value-change.ts` reads as **ticked**. That is [D31](#d31) exactly, three new ways in: `merge`
builds a fresh object every run, `save` writes it into the very model `For Each` feeds the row's
`data` from, so the value always counts as changed and the node runs again. D31's own measurement of
that cycle was **115,755 write errors in eleven seconds** with nobody touching the screen.

### 🔴 The finding, which is not "somebody forgot"

**A `runOnChange-*` key is a per-INPUT obligation, and nothing in the repository states it as one.**
D31's fix is written up as a property of a *node* — *"the three keys are FIRST in the bag
deliberately"* — and reads, correctly, as done. It is silent on what happens when the node grows a
fourth input, which is the only way the defect can come back.

⚠️ **And the only thing that caught it was a suite in another task's file, run because the artefact
was regenerated.** `sb005AdminPanel.test.ts` — the panel's own suite, the one an author editing this
component would run — was **green** through the entire defect. It counts code nodes and grades
signal-port declarations; it does not know what a write-back cycle is.

### 🟢 The fix

`runOnChange-in-heading`, `runOnChange-in-linkLabel`, `runOnChange-in-linkTarget`, all `false`, and
`runOnChange-in-image` **removed** — the picture fold left `merge` for `absorb` in the same change,
and a key governing an input that is no longer wired is an exemption matching nothing.

**The rule, now written where the next person will hit it** (`sb005Components.ts`, on `merge`):
**a new value input on a repeater-item write-back node owes a key.** The population count in
`sb007Template.test.ts` moved 19 → 26 with every one of the seven named, so the next arrival moves
it again.

---

## D37 — 🟢 FIXED IN THE SAME SESSION (s36). Every contact section drew the form TWICE

**Found by SBR-005's drive. Introduced by SBR-005, and the register row filed about it an hour
earlier was WRONG about its own premise.**

### What the first version of this row said, and why it was wrong

It said: *the page offers two switches, and an author who turns both on gets two forms.* That reads
as a hazard with a workaround, which is why it was filed with an owner (SBR-007) rather than fixed.

**There is no second switch.** `/Pages/Site`'s `contactWrap` was mounted from
`readSections.out-hasContact`, and that function is:

```js
Outputs.hasContact = rows.some(function (r) { return (r.data || r).kind === 'contact'; });
```

— **the identical predicate** the section view dispatches on. So the page-level form and the new
`contact` section fire on the same fact about the same record. Not "if an author turns on two
switches": **always**, for every page with a contact section, from the moment SBR-005 shipped.

🔴 **The lesson is the one this phase keeps paying for.** The row was written from the *graph* — two
nodes carrying `mounted`, therefore two independent conditions — and the graph was where the answer
was NOT. The browser said `7` `<section>` elements on a five-section page, and the page's own text
carried *"Get in touch / Your name / Your email / Your message / Send"* twice. See
[[verify-the-consequence-not-just-the-mechanism]] and
[[a-recorded-row-can-be-a-hypothesis]] — a row records what one session saw.

⚠️ **`sb006PublicSite.test.ts` had been reporting it since the first green run.** Its cross-component
walk listed `Site/ContactForm`'s four nodes **twice**, and the session that updated the expected list
read the second pass as correct and wrote a paragraph explaining why. **An expected-value update is a
claim, and a session updating a census it did not cause is the moment to ask what changed.**

### 🟢 The fix

The page-level form is **gone**, with `readSections` (whose only output was `hasContact`) and its
three wires. It was never a page-level feature: it existed because *"a repeater item cannot be handed
the page slug the form needs"*, and SBR-005 retired that constraint by reading the slug out of
`SITE_CURRENT_SLUG_VAR` the way `Site/NavLink` always has. The kind renders itself; nothing else
needs to.

---

## D38 — 🔴 The hero's scrim is a fixed black wash and its text colour is a THEME RECORD FIELD

**Owner: SBR-003** (the twelve-field theme contract is that task's, and this is a constraint the
contract does not express).

`--gradient-scrim` is the one gradient token in `DefaultTokens.ts` **not** written in terms of other
tokens — a literal `linear-gradient(180deg, rgb(0 0 0 / 0.15), rgb(0 0 0 / 0.78))`, deliberately,
because a scrim's job is to darken whatever photograph is under it. The corpus pairs it with
`var(--primary-foreground)` for the type (`ui-image-scrim-band`), and SBR-005's `Site/HeroSection`
follows the corpus rather than minting a rule of its own.

🔴 **But `--primary-foreground` is `colorOnPrimary`, a field the site owner edits in the theme
editor — and the shipped `night` preset sets it to `#191713`.** Dark type on a black scrim is
unreadable, and every gate in this repository would stay green: the value is a token, the token is
in the contract, the parameter is not a raw colour.

⚠️ **What is measured and what is not.** SBR-005's drive photographs the hero under the **Studio**
preset only, which is what a new site wears. Whether `night` (or a hand-typed dark `colorOnPrimary`)
actually renders unreadable is **not measured here** — the row records the mechanism and names the
arm that would settle it: theme the site to each preset and read the computed contrast between the
`h2` and the scrim's painted end. Until that runs, this is a **hypothesis with a named test**, not a
finding, and it should be re-derived before anyone builds on it — three phase-81 register rows in one
session were each wrong about their own premise.

**Two candidate fixes, neither ours to pick:** a thirteenth theme field for "type over a picture", or
a derived companion token the overlay computes from `colorBackground`'s luminance rather than from a
field an author can set independently.

---

## D39 — 🟢 FIXED IN THE SAME SESSION (s36). The contact form showed BOTH its answers before anybody pressed Send

**Pre-existing — `Site/ContactForm` is a component SBR-005 did not touch. Found because SBR-005 AC3
is the first acceptance criterion in this phase that submits the form.**

Every visitor to every page with a contact section read this, stacked under the Send button, before
typing a word:

> Send
> **Thanks — your message has been sent.**
> **That message could not be sent.**

`sentGate` and `refusedGate` are `Condition` nodes carrying `condition: true` and **no**
`runOnChange-condition` key. Absent reads as **ticked** (`run-on-value-change.ts:178-181`), so the
parameter's own value lands at load, the Condition evaluates, publishes `result: true`, and both
`mounted` wires fire.

### 🔴 Why five sessions of gates never saw it

`sb006PublicSite.test.ts` asserts both Texts are authored `mounted: false` **and** wired to a
decider. Both true. Both beside the point: an authored default only stands *until something
publishes*, and this file's own module header says exactly that about `isEmpty` two hundred lines
above. **What nothing checked was whether the decider publishes on load** — which is the same
question, one node upstream, and no gate in the repository asks it.

⚠️ It is [D14](#d14)'s family (a gate that fires on the boot rather than on the act) and
[D31](#d31)'s family (an unstated `runOnChange-*` doing something nobody asked for), in a third
component, and it outlived both fixes.

🔴 **`sb007Template.test.ts` listed both nodes in its `runsOnValue` population the whole time** —
`/Site/ContactForm sentGate.condition` and `refusedGate.condition`, positions 7 and 8. That
population is graded for *write-back cycles*, and these two write nothing, so they were correctly
silent there. **A node can be in a hazard census, correctly cleared of that hazard, and carrying a
different one.**

### 🟢 The fix

`'runOnChange-condition': false` on both. `eval` becomes the only trigger, which is what the
`send.done` / `send.failure` wires already were.

---

## D40 — 🔴 A published page does not scroll, so every control below the first screen is unclickable

**Owner: SBR-002** (the first-run/page-shape task — this is `/Pages/Site`'s ground, not a section
kind). **Pre-existing.** Found by SBR-005's drive, which is the first thing in this phase to try to
*press* something on a public page.

### The measurement

`clickButton` refused both the CTA and the pre-existing `Send`, saying they were *behind something*.
They are not. The blocker probe answered `hits: "outside-viewport"` with an **empty ancestor chain** —
`elementFromPoint` returns `null` for any coordinate outside the viewport, so *below the fold* and
*behind a modal* are the same reading, which `members-drive.ts` warns about in its own source. So the
question was never about the button:

| | |
|---|---|
| `document.documentElement` | `scrollHeight 469 / clientHeight 469` — **equal** |
| `document.body` | `scrollHeight 0 / clientHeight 0` — **zero tall** |
| elements with a scrollable `overflow-y` | **none, anywhere on the page** |
| `window.scrollTo(0, 1200)` then `scrollY` | **0** |
| the CTA button | painted, correct, at `y = 1144` |

The document believes it is exactly one screen tall while the content runs to ~1900px. Nothing
scrolls, and nothing *can* be scrolled to.

### 🔴 What is measured, and what is NOT

✅ Measured, and **identical at both sizes**, so it is not a small-window artefact:

```
756x469  docHeight 469/469  bodyHeight 0/0  scrollers []  scrollY after scrollTo(0,1200) = 0
1280x900 docHeight 900/900  bodyHeight 0/0  scrollers []  scrollY after scrollTo(0,1200) = 0
```

The document's scroll height tracks the **window**, not the content. The reading is printed by
`sbr005-sections.look.ts` itself on every run, not only recorded here.

⚠️ **A corroborating reading from a different instrument**: the judge's own per-shot line for this
run says `scroll=NO unreachable=92px` on the gallery page at phone size — the same page phase 81's
`unreachablePx` sweep would have called 0. **Two instruments, and they do not agree. That is the
first thing to settle.**

❌ **Not measured, and it must not be assumed:**
- whether a real Electron/browser window behaves the same. This is `render-from-disk.js` serving the
  deployed bundle through a headless Chrome; the container it mounts into may not be the container a
  deploy uses.
- whether the members-area template behaves the same in the same harness. **That control is the one
  that would settle harness-vs-product and it has not been run.** Without it this row cannot say
  which of the two it is.
- ⚠️ **Phase 81's VIB-001 measured `unreachablePx` as 0 on all 44 shots and concluded "the document
  scrolls regardless".** That is either about a different container or one of the two readings is
  wrong. **Re-derive both before building on either** — this row is a hypothesis with named
  arms until somebody runs the members control.

### Why no gate could have found it

A page's whole content is in the DOM, correct, styled and painted. `textChars` is right,
`unreachablePx` reads 0, every structural assertion passes. The only thing wrong is that a person
cannot get to two thirds of it, and the only instrument that can say so is one that tries to press
a button.

⚠️ **SBR-005's drive works around it and says so where it does**: AC2 and AC3 resize to a viewport
tall enough to hold the whole page before clicking. They are about *where a link goes* and *what the
form says*; **they are not a test that the page scrolls**, and this file must not be read as one.

---

## D41 — 🟢 FIXED IN THE SAME SESSION (s36). The contact form sent itself, with nobody pressing anything

**Pre-existing. `Site/ContactForm` is a component SBR-005 did not open. Found because SBR-005 AC3 is
the first acceptance criterion in this phase that fills the form in.**

### The measurement

Anonymous, real Chrome, `sbr005-sections.look.ts`. Three fields filled through the product's own
inputs. **Nothing clicked.** Then the page was read:

```
answered before the press — sent: true, refused: false
```

*"Thanks — your message has been sent."* was already on the page, and a `ContactMessage` row was
already in the backend.

### The mechanism, and the sentence that caused it

`gather` is the code node that folds the four fields and fires `Outputs.go()` → `send.call`. Its four
value inputs carried **no** `runOnChange-*` key, which reads as **ticked**. So:

- while any field is empty the guard returns — correct, and the reason nobody noticed;
- **the instant the third field stops being empty**, `gather` runs to the end and calls the cloud
  function;
- **every keystroke after that calls it again.** A visitor typing a forty-character message posts
  forty enquiries, and the owner gets forty emails.

🔴 **The comment on the node argued for it.** *"Returning is safe — `runOnValueChange` defaults to
ticked, so a late value re-runs it."* Every word is true, and it is an argument for re-running the
**guard**, not for re-running the **send**. The node's last statement is a signal into a cloud call.
**A guard that re-runs is safe; a guard whose last act is an effect is a trigger.**

### 🔴 Why it survived, and what it says about the census that saw it

`sb007Template.test.ts` has listed all four of these inputs in its `runsOnValue` population for five
sessions. That census grades **write-back cycles** — a node that writes a collection which feeds it —
and this node writes nothing it reads, so it was **correctly** silent. Third time in this session:
**a node can sit in a hazard census, be rightly cleared of that hazard, and be carrying another one.**
(D36 and D39 are the other two, and D39 is two nodes below this one in the same file.)

⚠️ It is the **third** unstated-`runOnChange` defect in this template — [D31](#d31) on
`/Admin/SectionRow`, [D39](#d39) on this component's gates, and this — and the pattern is now stable
enough to state: **an unstated `runOnChange-*` on a node whose script ends in an effect is a defect,
whatever the effect is.** Nothing in the repository checks that shape.

### 🟢 The fix

`runOnChange-in-{name,email,message,pageSlug}: false`. `sendButton.onClick` becomes the only trigger,
which is what a Send button is. The guard is unchanged and still refuses an incomplete form on the
press.

---

## D42 — 🟢 FIXED IN THE SAME SESSION (s38). The template's ONE public endpoint stored every enquiry TWICE

**Template. Owner: SBR-010 (fixed there). Pre-existing since SB-004.** Found because SBR-010 is the
first thing in eleven sessions that ever **reads a `ContactMessage` back**.

### The measurement

`sbr010-messages-drive.test.ts`, real Chrome with no session, against a real `BackendService` with
the shipped policy and enforcement on. Three visitors filled the template's own public contact form
and pressed **Send** once each. The owner then read the store:

```
GET /classes/ContactMessage  →  6 rows
```

Two rows per submission, ~10 ms apart, identical in every field and different only in `objectId`.

🔴 **The browser was never at fault**, which is the reading that matters and the one a screen alone
could not have given. The backend's execution history recorded **three** runs of
`submitContactForm` — one per click — and each run's step list read:

```
compose → fallback → pick → save-3 → fallback → pick → save-3 → stored → mail → res-3
```

One `compose`, one `res`, **two** `fallback → pick → save`. So the visitor was told once, correctly,
and the owner got two of everything.

### The mechanism, and the sentence that caused it

`/#__cloud__/site/ContactRecipient`'s `settings` node is an unfiltered `DbCollection2` over
`SiteSettings`. It had its `runOnChange-*` checkboxes **ticked** *and* a `storageFetch` wire
(`RECIPIENT_WIRES`' first entry, `inputs.Fetch → settings.storageFetch`). Two triggers, two
`fetched` pulses, and everything downstream ran twice.

🔴 **The comment on the node argued for it, from a premise that was false eight lines below.** It
read: *"The `runOnChange-*` checkboxes are left TICKED here — measured, not assumed… **because this
node has no `storageFetch` wire**."* It has one, and it is the first wire in the list. And the very
next paragraph of the same comment stated the consequence exactly:

> *"Boxes on with a `storageFetch` wire fetches twice and runs everything downstream twice (SB-013).
> The two settings are alternatives, never a belt and braces."*

⚠️ **This is D41's shape a second time in the same file, and the fourth unstated/mis-stated
`runOnChange` defect in this template** (D31, D39, D41, this). It is also the *second* time SB-013's
rule has been broken by the node it was written for: `claimSite`'s copy of this query carries the
correct settings and a comment recording that one claim once left **two** identical `SiteSettings`
rows — the identical failure, in the identical shape, one component away.

### 🔴 Why it survived eleven sessions

Nothing had ever read the collection. `submitContactForm` was driven for its **response** (SB-017
§10.5, SB-018 (5)) and the response is correct on both paths; the duplicate lived only in a table no
screen opened and no spec listed. **A write nobody reads is a write nobody grades** — which is
SBR-010's thesis, arrived at as a measurement rather than as an argument.

### 🟢 The fix, and the arm that holds it

`runOnChange-collectionName: false` and `runOnChange-querySettings: false` on `settings`, so the
`storageFetch` wire is the only fetch. `pick`'s existing `if (Inputs.rows === undefined) return;`
is what makes that safe, exactly as `claimSite`'s gate guard does.

Re-measured on the same instrument: `stores: 1` on all three runs, one `fallback`, one `pick`, three
rows. `sbr010-messages-drive.test.ts` asserts the count **exactly**, both ways round — a regression
that stores twice reddens, and so does a repair that stops storing at all.

---

## D43 — 🔴 A REFUSED page list says "No pages yet", so *not allowed* renders as *nothing here*

**Template. Owner: `NONE` — needs a session that may re-drive `/Pages/Admin`.**
Measured on the twin, not on the subject: **nobody has driven `/Pages/Admin` in this state.**

### What was measured, and where

SBR-010's first browser run put a signed-out visitor on `/admin/messages`. The screen said **three**
things at once:

```
You are not signed in. Sign in to manage this site.
No messages yet. When somebody sends the contact form on your site, their message arrives here.
Your messages could not be loaded. You may not have permission to manage this site.
```

The middle sentence is a lie told to somebody who was never allowed to ask.

`run` is **additive**: `tally.run` was wired to `messages.fetched`, but `runOnChange-in-rows` was
`true`, so `messages.items` publishing an empty collection ran the count script with **no successful
query behind it**. Fixed on `/Pages/Messages` in the same session by stating the box `false` —
`fetched` is then the only trigger and the line stays at its standing `''`.

### 🔴 Why this is a row and not a closed fix

**`/Pages/Admin`'s `count` node is wired identically and still states `true`.** The page list is
expected to render the same three-sentence screen to a signed-in non-admin, and the reason it was
NOT changed here is that `/Pages/Admin` carries verified acceptance criteria from SBR-006, SBR-015
and SBR-016 — editing it blind would be a change to driven work without re-driving it.

⚠️ **It is SBR-016's own defect, one state further along.** That task made *empty* distinguishable
from *never asked*; **refused** had quietly re-joined *empty*, on the screen SBR-016 repaired.

`sbr010Messages.test.ts` carries the row as a **measurement**: it asserts `/Pages/Admin`'s flag is
still `true`, so the day somebody fixes it this arm reddens and the row gets closed rather than
forgotten.

---

## D44 — 🟢 FIXED IN THE SAME SESSION (s39). Realtime never connected for the built-in backend, because the app id was sent as a session token

**Product — `noodl-runtime`. Not the template, and not the hub.** Found by SBR-011, which is the
first thing ever built that asks the shipped runtime to hold a subscription open against our own
backend.

### The symptom, and how long it hid

A published site with three subscribing queries opened **three** `EventSource` connections, exactly
as designed — and the hub's `connectionCount` was **0**. Nothing was logged. The page rendered
perfectly, every query answered, and the only observable difference between "realtime is on" and
"realtime is off" was that nothing ever updated.

### The chain, end to end

| | |
|---|---|
| 1 | `endpointBackendEntry` fills the endpoint entry's `auth.publicToken` from **`cloudservices.appId`** (`resolveBackend.pure.ts:160`) |
| 2 | `RealtimeSubscription.token` returned `sessionToken \|\| publicToken` — so for an anonymous visitor, the **app id** |
| 3 | `SseTransport`'s nodegx dialect puts that in the URL: `GET /realtime?token=<app id>` |
| 4 | `HttpServer.resolveSSEPrincipal` reads `?token=` as an **`x-parse-session-token`** |
| 5 | Parse semantics: an unknown session token is a **refusal**, not a fallback to anonymous |

Measured against a real `BackendService`, no browser involved:

```
GET /realtime                              → 200  event: connected {"clientId":…}
GET /realtime?token=myapp        (app id)  → 400  {"error":"Invalid session token","code":209}
GET /realtime?token=not-a-session-token    → 400  {"error":"Invalid session token","code":209}
```

🔴 **`publicToken` means two different things and only one of them is a token.** On Directus,
PocketBase and Supabase it is a genuine public auth token (`byob-utils.ts:113` uses it as one). On
`nodegx`/`parse` it carries the Parse **Application Id**, deliberately — `ParseWireAdapter` sends it
as `X-Parse-Application-Id`. The fallback treated the two as the same kind of thing.

### The fix, and its shape

One predicate, in `RealtimeSubscription.token`: on a Parse-wire backend, the session token or
**nothing**. The empty string is the correct answer rather than a tolerated one — an anonymous
subscriber *is* anonymous, the hub accepts it, and delivery is still gated per event on the row ACL,
so a public site is live and a draft still cannot leak. It narrows **by type** rather than dropping
the fallback, because on the BYOB backends the fallback is right.

### 🔴 Why no gate caught it, and what now does

`realtime-transports.test.ts` had **357 green arms** across five transports and stayed green through
the whole defect: every fixture carried either a real `sessionToken` or no auth at all, and **not one
of them asserted what ends up in the URL.** A hole shaped exactly like the defect.

Three arms now read the URL, and the mutation confirms them: with the predicate removed, *"sends NO
token when a nodegx handle carries only an app id"* reddens with the literal
`http://nodegx.test:8593/realtime?token=myapp`, while the session-token arm and the PocketBase
control stay green — so they are grading the change and not merely reflecting it.

⚠️ **The control had to be re-pointed to be a control at all.** Its first version asserted the
public token was in PocketBase's stream URL and went red: that dialect deliberately puts no token
there and sends it as an `authorization` header on the subscribe POST. A control aimed at the wrong
surface grades the dialect, not the change.

---

## D45 — 🟡 SPLIT AND HALF FIXED (s40). Subscriptions are not confirmed and retry forever, LEAKING A STREAM EACH TIME

**Owner: the leak half is CLOSED; the delay half moved to [D46](#d46), owner `NONE`.**

### 🔴 s40 — the discriminating test was run, and the row was TWO defects with two different owners

The register named the test — *time the hello frame through the `/__backend` proxy against direct,
in one run* — and refused to attribute anything until it had been run. It has been, in
`packages/nodegx-backend/tests/d45-realtime-proxy-timing.test.ts`, and it separates the row cleanly:

| the half | verdict | what settled it |
|---|---|---|
| **the abandoned stream stays open** | **HARNESS**, `render-from-disk.js`. ✅ **FIXED s40.** | §2: a proxied stream's close left the hub's `connectionCount` unmoved for ten seconds, while the **direct control on the same counter in the same run** reaped immediately. |
| **confirmation times out at 15s** | **PRODUCT**, `SseTransport`. → **[D46](#d46)** | §1: the hello frame through the proxy is **8ms** against direct's **9ms**. Nothing here was ever holding a frame. |

✅ **The leak was `up.pipe(res)` not destroying its source.** A proxied `GET /realtime` outlived the
browser that opened it: the upstream response stayed writable, so `RealtimeHub` never saw the `close`
it reaps a connection on, and the entry sat in its map forever. One line —
`res.on('close', () => p.destroy())` — and the arm that grades it reddens when that line is removed
and the direct control stays green.

✅ **Measured end to end on the real drive, which is the reading that matters**: SBR-011's
`openStreams` went **15 → 3**. Three streams for three subscriptions, which is what the transport
says it opens.

🔴 **What that did NOT fix, and the register should not have expected it to**: every subscription
still times out at 15s and still retries. The leak was spending
`rateLimit.realtimeMaxConnections` on dead connections — a real cost with a real blast radius —
but it was never the reason confirmation failed. Two defects that produced one symptom.

### 🔴 The AC3 isolation the row asked for — settled, and it is NOT Theme

> *"the two runs cannot tell apart 'the `Theme` subscription specifically does not deliver' from
> 'AC3's window lost the same race the others won'. Isolating that is the first job of whoever
> takes this row."*

`liveCollections` on the s40 run reads **`{Page: false, Section: false, Theme: false}`**. All three
collections are equally dead inside the warm-up window, so **there is nothing `Theme`-specific and
AC3 is not blocked by a `Theme` defect**. AC1, AC2 and AC4 pass because their windows fall after a
retry cycle happens to land; AC3's does not. The blocker is [D46](#d46) and nothing else.

---

### The original row, as filed at s39

⚠️ **It was not yet known whether this was the product or the harness**, and the row said so rather
than picking. The discriminating test is named below.

### What was measured

SBR-011's drive, on the run immediately after [D44](#d44) was fixed. The page opened its streams —
the hub's `connectionCount` went from **0** to **6** — and the browser logged three of these:

```
[noodl] DbCollection2 (/Site/Nav):    The realtime subscription to "Page" was not confirmed within 15000ms.
[noodl] DbCollection2 (/Pages/Site):  The realtime subscription to "Section" was not confirmed within 15000ms.
[noodl] DbCollection2 (/Pages/Site):  The realtime subscription to "Theme" was not confirmed within 15000ms.
```

**Six streams for three subscriptions** on that run: each attempt times out and **leaves its stream
behind**, the transport retries, and eventually one lands. In the same run the nav had gained every
published link by the time the later arms read it, so the page really does go live.

🔴 **The next run made it much worse, and that variability is itself the finding.** Same code, same
harness, one run later: **fifteen streams for three subscriptions**, the same three messages
repeating (the readout caps at eight), and a 120-second warm-up window in which **not one of the
three collections ever went live** — while AC1, AC2 and AC4, measured later in the same run, all
passed. So the subscriptions do connect in the end; how long that takes is **unpredictable between
runs of the identical code**.

⚠️ **The leak is the part with a blast radius.** A retry that opens a stream without the old one
being reaped costs a connection per attempt, and the realtime tier is capped by exactly that
(`rateLimit.realtimeMaxConnections`, default 500). A handful of visitors on a slow link would spend
the cap on dead streams. Two separate questions live here and both need answering: **why
confirmation fails**, and **why the abandoned stream is still open**.

🔴 **This is why the first post-D44 run read AC1, AC2 and AC3 as failing.** Their windows fell
inside the dead period. The drive now establishes liveness with throwaway rows in **all three**
collections before it measures anything — an honest fix on the instrument side that says nothing
about the cause, and one that cannot make the drive a stable gate while this row is open.

🔴 **AC3 is the criterion this actually blocks.** AC1, AC2 and AC4 passed in both post-D44 runs;
AC3 passed in neither, and the two runs cannot tell apart *"the `Theme` subscription specifically
does not deliver"* from *"AC3's window lost the same race the others won"*. **Isolating that is the
first job of whoever takes this row** — and it is cheap now that `liveCollections` names which of
the three went live.

### The discriminating test, and why neither answer is safe to assert yet

The drive reaches the backend through `render-from-disk.js`'s `/__backend` proxy, which pipes the
upstream response (`up.pipe(res)`). A proxy that holds the hello frame until something flushes it
would produce exactly this: the transport cannot POST its subscription until it has the `clientId`
the hello frame carries, so a delayed hello frame *is* an unconfirmed subscription.

Against that: an anonymous `openStream` **straight to the backend**, in the same test file and the
same run, gets its `connected` frame immediately.

✅ **So the test is a timing comparison, not an inspection**: time the hello frame through the proxy
and direct, in one run. If the proxy is slow, this is the harness — the same shape as
[D40](#d40) — and `render-from-disk.js` owes an explicit flush. If both are fast, the delay is in
`RealtimeSubscription`'s POST and the row is the product's.

⚠️ **Do not close it by raising the 15-second deadline.** That is the number that made the failure
visible; a longer one would only make the same wait silent.

---

## D46 — 🔴 SIX realtime subscriptions on one origin SILENCE the app. Owner `NONE`

**Product, `packages/noodl-runtime/src/api/backends/realtime/SseTransport.ts`.** The delay half of
[D45](#d45), measured, and it is larger than the row it came out of.

### What was measured

**The browser's own clock, on SBR-011's drive.** Resource Timing for every `/realtime` request the
open page made, read after the warm-up window:

| url | start | **queued** | wait | duration |
|---|---:|---:|---:|---:|
| `/__backend/realtime` ×3 | 125ms | 2ms | 1ms | 15008ms |
| `/__backend/realtime/subscriptions` ×3 | 128ms | **15007ms** | **5ms** | 15011ms |
| `/__backend/realtime` ×3 | 16136ms | 1ms | 2ms | 15005ms |
| `/__backend/realtime/subscriptions` ×3 | 16141ms | **15001ms** | **6ms** | 15008ms |
| …and again at 33143ms, identically | | | | |

🔴 **`queued 15007ms, waited 5ms`.** The subscription POST was not slow and the backend was not
slow — **the request was never sent**. It sat in the browser's queue for exactly the confirmation
deadline, and the queue drained at the instant that deadline closed the streams. Three cycles of
that, then a fourth.

### The mechanism, priced

`SseTransport` opens **one never-ending stream per subscription** — its own header calls this "the
honest trade" and notes the cost is "one connection per subscribing node". The registration POST
that every one of those streams *requires* competes for the same per-origin connection pool the
streams are *holding*.

✅ **The pool is six, measured in the product's own browser** (`d45-realtime-proxy-timing.test.ts`
§4 — streams opened one at a time, an ordinary same-origin request timed after each):

| streams open | 1 | 2 | 3 | 4 | 5 | **6** |
|---|---:|---:|---:|---:|---:|---:|
| an ordinary request | 6ms | 3ms | 2ms | 2ms | 2ms | **never sent** |

⚠️ **Every stream still opens.** The starvation is of *other* requests, not of the streams — which
is exactly why it presents as "the subscription was not confirmed" and not as "the connection
failed", and why nothing in any log names the cause.

🔴 **So the ceiling is a product limit, not a harness artefact: an app with six realtime
subscriptions on one origin cannot make any other request to its backend.** Not its queries, not
its writes, not the registration POSTs for those very subscriptions. It is not a slow app, it is a
stopped one. The site-builder template reaches this with **three** subscriptions, because the page's
own boot traffic occupies the rest of the pool while the POSTs wait.

### Why it self-heals, and why that is worse than failing

The deadline fires, `transportDownFrom` closes the stream, the freed slot lets the POST out, the
backend answers `200` in 5ms — and `RealtimeSubscription` discards it, because `this._clientId !==
clientId` for a generation that has already been replaced. A new stream opens and the same thing
happens. **A page goes live only when a retry cycle happens to win the race**, which is why the
same code read 6 streams on one run and 15 on the next: the timing is genuinely unpredictable, and
that unpredictability was the finding all along.

### The fix, named and sized

🔴 **One SSE connection per backend, shared across subscriptions, with a registry that POSTs the
union.** The transport's header rejected this — *"the alternative is a shared registry that has to
be right about ordering"* — but the measurement above is the argument the header did not have.
Three things make it smaller than it looks:

- `parseChange` **already** filters by `payload.collection`, so the shared-stream receive path is
  the one that is written.
- The hub's `POST /realtime/subscriptions` takes an **array**, so the union is one request.
- The subscription POST *replaces* the set for a `clientId` — which is the reason a registry is
  mandatory rather than an optimisation, not a reason to avoid one.

⚠️ **Two things that must not be got wrong.** Two subscriptions on the same collection with
*different* filters would share a stream that delivers the union, and today each consumer filters
only by collection name — so a filtered subscriber would see rows it did not ask for. And the
**PocketBase** dialect has to come along: its change event name is the *collection's* own name, so
a shared stream needs listeners added and removed as the registry changes.

⚠️ **Do not close this by raising the 15-second deadline**, for the reason [D45](#d45) gave: that
number is what made the failure visible, and a longer one only makes the same wait silent. A
deadline long enough to survive the race would also be long enough to hide a real refusal.

🔴 **It blocks SBR-011 AC3**, and it is the only thing that does.

---

## D47 — ⚠️ Two drives are RED in the working tree, and it is not D45's fix. Owner `NONE`

**Measured s40, and filed as a fact rather than a diagnosis.** Run while checking D45's fix had not
downgraded a neighbour:

| suite | result |
|---|---|
| `sbr011-hub-unreachable-drive` | ✅ 3/3 pass |
| `sbr010-messages-drive` | 🔴 **17/17 fail** |
| `sb008-public-site-drive` | 🔴 **7 fail** |

✅ **Not D45's fix, established by two controls, not by argument**: the identical 24 failures occur
with the fix reverted, **and** with `render-from-disk.js` restored to its committed HEAD version.

⚠️ **The shape.** `sbr010` fails at `fill()` with `absent:0:[]` — `document.querySelectorAll('input,
textarea')` returns the **empty array**, so the page draws no text input at all. `sb008` fails
differently, on page text equality. The working tree carries phase 82's in-flight REL-002a edits to
`noodl-viewer-react/src/nodes/controls/text-input.ts` (the `Placeholder` default, `'Type here...'` →
`''`) and to `render-from-disk.js`'s host stylesheet, and **the built viewer bundle contains them**
(`grep 'Type here' → 0`). That is a lead and not a finding: a default is not a rendering break, and
nothing here has been run against a bundle built without those edits.

🔴 **Whoever owns this must re-derive it rather than relay it.** The one thing worth carrying
forward is the control: it is *not* the D45 proxy fix, and that has been measured twice.

---

## Where these rows were filed, and why not all of them went to the same place

**s31, 2026-08-30.** Phase 80's `TASKS.md` came clean in the working tree while this session was
writing, and the three rows owing a home were placed by **which surface the fix touches**, which is
that register's own stated rule:

> *Three of phase 78's eleven unowned rows are NOT here, deliberately: D22, D23 and D24 are
> template-side. This phase is graded on the product surface and never on a template being fixed
> downstream of it.*

| row | fix touches | filed |
|---|---|---|
| **D28** — a `Drag`'s child loses its `cssClassName` | the **wrapper's prop spread** (not `react-draggable`) | ✅ **FIXED — phase 80 `DEF-027`, s23** |
| **D30** — the editor's section query has no `visualSort` | `sb005Components.ts` → the **template** | **stays here** |
| **D31** — `merge` re-runs on the value it writes | `sb005Components.ts` → the **template** | **stays here** |

🔴 **D30 and D31 were not unowned by omission — they were this phase's own work.** Filing them in
phase 80 would have put two template edits behind a product phase's dependencies, which is the
exact split phase 78 recorded and phase 80 refused. Phase 77 owns the site-builder template.

✅ **s32 fixed both, which is what that decision was for.** The routing call took one session to
pay off: the rows stayed where the hands were, and the mutant arms s31 left behind meant the
repair was not a proposal but an arm that had already run.
