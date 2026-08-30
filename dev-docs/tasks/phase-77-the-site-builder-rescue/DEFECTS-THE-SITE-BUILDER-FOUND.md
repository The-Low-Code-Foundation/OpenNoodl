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

---

## D16 — ⚠️ The appearance ratchet's per-page check cannot fail for any page that places a styled component

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

## D23 — 🔴 No visual node reports its rendered geometry, so a drag cannot know what it is over

**Found:** s27, building [SBR-007](SBR-007-THE-PAGE-EDITOR.md) AC2 · **Owner:** `NONE` ·
**Product**, not template · **Bites:** any author asked for drag-to-reorder, drag-to-resize, a
sticky header, or anything else whose logic depends on where a node actually ended up.

AC2's own sentence is *"dragging a section from position 3 to 1"*. `visual/drag.ts` gives
`Drag Started/Moved/Ended`, `Drag X/Y` and `Delta X/Y` — **an offset in pixels and no drop target**,
which [D15](#d15) already recorded for files. So the author has to turn an offset into an index
themselves, and that needs the row pitch. **There is no way to ask for it.**

**Measured over `packages/noodl-viewer-react/src/nodes` (67 files, 51 `outputs:` blocks):**

| grep | hits |
|---|---|
| an output port naming `clientHeight` / `offsetHeight` / `measuredHeight` / `boundingBox` / `boundingClientRect` — the finding | **0** |
| `displayName` matching height/width/size/bounds/top/left — control, the search reaches port declarations | **20** |
| nodes exposing `type: 'domelement'` — the one escape hatch a script could measure through | **1** (`visual/video.ts`) |

⚠️ **The first population was wrong and the control is what said so.** Grepping `plug: 'output'`
returned **18** hits across the whole directory, which is far too few for 51 output blocks — viewer
nodes declare outputs in an `outputs:` object, not with `plug`. A finding of 0 against that
denominator would have been a fact about the grep. Re-run against `outputs:`, the controls fire and
the 0 stands.

The single near-hit is `Video`'s `videoWidth`/`videoHeight`, and they are the **intrinsic media
size**, not layout geometry — a `Group` has no equivalent. `Video` also carries the only
`domelement` output in the runtime, described as *"for a Group to scroll to or a script to reach"*;
one node having it is the shape of the fix, not an existing capability.

**Why it bites here specifically:** these rows are a textarea and an image preview, so no two are
the same height. `Drag Y / rowHeight` has no `rowHeight` — not one that is merely awkward to
compute, one the graph cannot see at all.

**What shipped instead:** `Move up` / `Move down` on each `SectionRow`, which hand
`reorderSection` the same `toIndex` a drop would. AC2's *outcome* — a person changes the order and a
visitor sees it — is met and driven; **AC2's gesture is not**, and the task file says so rather
than rounding it off.

**The shape of the fix:** a `domelement` output on `Group` (three lines, `video.ts:283-288` is the
template) would be enough — a code node could then measure siblings itself. A drop-target port pair
would close [D15](#d15) at the same time.

---

## D24 — 🔴 A cloud function's graph outlives its request, and one endpoint's traffic can 400 another

**Found:** s27, driving AC2 · **Owner:** `NONE` · **Product**, not template · **Bites:** any site
whose admin reorders sections and then duplicates a page — the second act answers *"A partial copy
may exist"* having copied nothing.

Adding the `reorderSection` drive to `sb004-publication-invariant.test.ts` **before** the
`duplicatePage` block makes that block fail, and the backend names the cause itself:

```
RunTasks (/#__cloud__/duplicatePage): Do was triggered while a run was still in progress,
so it was ignored [run-tasks/already-running]  { nodeId: 'run' }
```

`already-running` reports `unchanged`, `unchanged` is wired to `deny`, and the caller gets a 400.
🔴 **The node is `duplicatePage`'s own**, and nothing in that request started a run — the state was
left behind by an **earlier request**, because `internal.state` lives on the node instance and the
instance outlives the invocation.

**Three controls, five runs each, same slot in the same file:**

| what runs before `duplicatePage` | green |
|---|---|
| the `reorderSection` drive (7 calls) — the finding | **1 / 5** |
| `publishPage` × 10 — a control that also uses `Run Tasks` | **5 / 5** |
| `submitContactForm` × 7 — a control with no `Run Tasks` | **5 / 5** |

So it is **not** call volume, and not "any traffic". ⚠️ **The mechanism is not established** — why
this endpoint provokes it and a `Run Tasks` endpoint at higher volume does not is unexplained, and
naming a cause here would be the thing this phase keeps writing down as a trap.

🔴 **Two readings this session got wrong before the controls existed**, both kept because each
looked conclusive:

1. *"The insertion shifted node ids."* Moving the two new components to the end of
   `SB004_COMPONENTS` turned the suite green three times running. **The ids were identical in both
   arrangements** — measured, after asserting it. What actually varied was position in the bundle,
   not ids.
2. *"So it is bundle order."* Appending them was then green 3/3 — and **1/5** when re-run. The
   first arrangement had been flaky all along (1 pass, then 3 fails) and both "stable" readings were
   luck. Swapping two *existing* components with the new ones removed changes nothing, which is the
   control that killed the theory.

**Meanwhile:** the AC2 drive is placed after every `duplicatePage` call in that file, which is
deterministic rather than lucky — the traffic cannot reach a request that has already finished. That
is ordering, **not a fix**, and it is commented as such at the placement.

---
