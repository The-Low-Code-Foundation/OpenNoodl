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

✅ **D5–D8 and D10 were re-measured at HEAD on 2026-08-29** — see
[THE-SWEEP-2026-08-29.md](THE-SWEEP-2026-08-29.md) §2. Two came back different: **D6's cause is
refuted** and **D8 is a duplicate of phase 76's F15**. The rest stand.

🔴 **And the platform had *not* moved under them** — which was the assumed reason to re-measure and
was wrong. D6's file predates its own measurement by three weeks. **The rows were mis-derived, not
stale**, and a re-measure scoped to "has the platform moved?" would have confirmed all five.
