# Phase 73 — The First Tutorial

**Created:** 2026-08-19, out of a conversation with Richard about adding data blocks to the Visual
Function. **Prefix:** `TUT`. **Surfaces:** `editor`, `noodl-mcp`, `platform` (`nodegx-community`).

> **The concept, in one sentence.** The Visual Function will not learn to talk to a database — it
> composes with the data nodes on the canvas instead — and this phase ships the tutorial that
> *teaches* that composition, plus the three things that tutorial turns out to need.

---

## 0. The ruling this phase exists to teach

The conversation started at *"should we add `create record` / `query` blocks to the Visual
Function?"* The answer is **no**, and the reason generalises further than data:

| | |
|---|---|
| The Visual Function compiles with a **synchronous** `new Function` | [`logic-builder.ts:530`](../../../packages/noodl-runtime/src/nodes/std-library/logic-builder.ts) |
| So does the bench | [`BenchRunner.ts:206`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BenchRunner.ts) |
| There is no `async`/`await`/`Promise` anywhere in the block or generator definitions | `NoodlBlocks.ts`, `NoodlGenerators.ts` |

[FIX-004 §"Deliberately separate — async"](../phase-66-0.1.7-bug-fixes/FIX-004-THE-BLOCKS-THAT-ARE-MISSING.md)
already recorded this and sized the fix at **L**, listing five block families it blocks:
`fetch`/HTTP, `Noodl.Records`, CloudFunctions, Users, Navigation.

🔴 **Every one of those five already has canvas nodes.** Records → the Record family
([`data/`](../../../packages/noodl-runtime/src/nodes/std-library/data/)); HTTP →
[`restnode.ts`](../../../packages/noodl-runtime/src/nodes/std-library/data/restnode.ts);
CloudFunctions → [`cloudfunction2.ts`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/cloudfunction2.ts);
Users → [`std-library/user/`](../../../packages/noodl-runtime/src/nodes/std-library/user/);
Navigation → [`nodes/navigation/`](../../../packages/noodl-viewer-react/src/nodes/navigation/).

So the line is not *"we didn't get to async"*. It is **async lives on the canvas; blocks are
synchronous computation** — one sentence that explains all five cases instead of five exceptions.

**And the runtime already guarantees the handoff is safe.**
[`logic-builder.ts:400-406`](../../../packages/noodl-runtime/src/nodes/std-library/logic-builder.ts)
flags every output the program wrote *before* firing `success`, and sends `done` after, with a
comment saying why: *"so a graph sequenced on `Success` reads values that are already up to date."*
**The signal wire is the await.** That sentence is written nowhere a builder can read it, which is
what TUT-003 is for.

### The cost this ruling accepts, stated plainly

Splitting a program at every data call means **state must be re-threaded through ports across the
split**. "Compute a discount, but you need the customer's tier from the DB" becomes
VF → Query → VF. The mitigation is already in the block set (`Noodl.Variables` / `Objects` blocks),
and TUT-003 must teach it in the same breath, or the pattern reads as a workaround.

### 🔴 The reopen trigger, so this is a decision and not an omission

> If builders are routinely splitting one program across **three or more** Visual Functions to
> thread state, revisit `AsyncFunction`. Until then, this stands.

---

## 1. What is already there, measured

Four findings. Three of them make this phase **smaller** than it looked; one makes it different.

### A. Per-tutorial databases do not cost what they look like they cost

Richard's proposal was one shared DB across all tutorials, on the grounds that a DB per tutorial
would *"suck up CPU"*. Measured, that cost is already handled:

[`ProjectBackendLifecycle.ts`](../../../packages/noodl-editor/src/editor/src/services/ProjectBackendLifecycle.ts)
reconciles *"the open project's bound backend should be running"* in both directions — it **starts**
the bound backend on project open and **stops the ones it started** once that project is no longer
open. The editor takes `app.requestSingleInstanceLock()` and runs one `ProjectModel.instance`.

> **12 tutorials = 12 backend directories, but one running `nodegx-backend` process at a time.**

Ports allocate lazily from 8578 up ([`BackendManager.js:1110`](../../../packages/noodl-editor/src/main/src/local-backend/BackendManager.js)),
so they do not stack either. What per-tutorial DBs *do* cost is **disk** (a SQLite dir per tutorial,
never collected), **clutter** (N rows in a panel), and **orphans on crash** — which is what
`BackendProcessRegistry`'s reaper exists for.

### B. 🔴 Sharing one DB across tutorials re-opens a defect that was already fixed

[`provisionBackend.ts:120-138`](../../../packages/noodl-editor/src/editor/src/models/BackendServices/provisionBackend.ts),
on why `findReusableBackend` now requires ownership and not only a name match:

> …every AI-created project on a machine reused the first backend ever provisioned there … **two
> apps silently sharing one datastore**, and the whole live cause of `prop-age` / `prop-bio` not
> existing, because `createTable` returned `created: false` for a `Puppy` it had never made.

Tutorials that create tables are the **worst case** for this, not a benign one. Tutorial 7 says
"create `Puppies` with `name` and `age`"; the learner already has a `Puppies` from tutorial 2 with
different columns; `createTable` returns `created: false`, keeps the old schema, the Record node
gets **no `prop-*` ports**, and the tutorial's `hasPort` condition never goes green — for a reason
completely invisible to the learner.

`planSchemaReconciliation` (AAQ-002/F5) mitigates this **only on the plan-apply path**. A learner
creating a collection by hand in the Data Browser gets none of it.

> ✅ **Ruled: one DB per tutorial stands.** The thing worth building is **disposal and concealment**
> (TUT-001), not sharing.

### C. The lesson condition vocabulary cannot see data at all

[`lessonformat.ts:48-66`](../../../packages/noodl-editor/src/editor/src/models/lessonformat.ts) is
entirely graph-structural: `hasType`, `hasPort`, `hasParams`, `paramsEqual`, `connection`,
`routerLists`, `metadata`, `previewRouteEquals`, `activeComponentEquals`.

A data tutorial can therefore grade *"you wired Create Record's `Do` to the Visual Function's
signal output"* but **cannot grade "you actually created a record."** That is TUT-002.

The seam is clean: `evalConditionsWithContext` is **synchronous**
([`lessonevalconditions.ts:498`](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.ts))
and `LessonEvalContext` is a plain data bag the **caller** builds. So the evaluator does not become
async — the context carries a **pre-fetched snapshot**.

### D. 🔴 One-click install is a CALLER, not a mechanism — and the type for it already exists

This is the finding that most changes the plan, and it is the **BUILD-THE-CALLER** shape again — the
one this codebase has paid for repeatedly, most recently an HMAC that nothing invoked.

| | |
|---|---|
| `LearningFolderModel.instance.install({ bundleDir, provenance })` | **exists and is wired** — [`ProjectsPage.tsx:417`](../../../packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx) |
| `LearningSource = { kind: 'local'; path } \| { kind: 'platform'; url }` | **the platform arm exists** — [`learningfolder.ts:98-100`](../../../packages/noodl-editor/src/editor/src/models/learningfolder.ts) |
| Anything in `packages/**` that constructs `kind: 'platform'` | 🔴 **nothing.** Two test files, and no production code |

So TUT-004 is **fetch + unpack + call the install that is already there**, plus the re-pull that
`reset` needs (`ResetLessonOutcome`'s `'unavailable'` arm is what a missing fetcher returns today).
It is not a new install path, and a task that builds one has misread this.

### E. A community tutorial and a lesson bundle are two different artefacts

The platform's `articles` table (`nodegx-community/src/db/schema.ts:408-423` — a separate repo, not linkable from here) is markdown `body` +
metadata (`level`, `category`, `estimatedMinutes`, `outcomes`, node chips) plus a **nullable
`projectUrl`**, rendered by `tutorials/[slug]/page.tsx` as *"Download the starter project →"*.

The editor's artefact is a **bundle on disk** — a project directory plus `lesson.json` plus a
`solution/` ([`lessonbundleread.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonbundleread.ts)) —
registered in the Learning folder, which
[`learningfolder.ts:20-27`](../../../packages/noodl-editor/src/editor/src/models/learningfolder.ts)
says is written by **the editor process only, never a sidecar and never the platform**.

> ✅ **Ruled by Richard 2026-08-19:** the **community panel in the editor** gets one-click install
> (phase 72 is rebuilding it there anyway); the **web page** stays *download the bundle*. Beaming a
> tutorial to a signed-in user's editor from the browser is a bigger job and is **not in this
> phase**.

---

## 2. What this phase is NOT

- **Not `AsyncFunction`.** §0 rules it out and records the trigger that would reopen it. No task
  here touches `_executeLogic`.
- **Not data blocks in Blockly.** Same ruling.
- **Not NAT-011.** That task renders *article bodies* in the editor. This phase installs *gradeable
  bundles*. They meet at the community panel and nowhere else — 🔴 grep the behaviour before
  claiming either owns the other, per NAT-011's own warning.
- **Not a shared tutorial database.** §1B.
- **Not the reworking of backend ownership.** TUT-001 hides and disposes; `findReusableBackend`'s
  rule is untouched.

---

## 3. Rulings needed

| | Question | Blocks |
|---|---|---|
| **R1** | Does a hidden-but-running backend need a persistent visible affordance, or is the finder enough? A hand-started backend is **not** stopped by `ProjectBackendLifecycle` (it adopts rather than owns), so hiding the list can leave a process running with nothing on screen pointing at it | TUT-001 AC4 |
| **R2** | What provenance does a community bundle install under? [`lessoninstallpolicy.ts`](../../../packages/noodl-editor/src/editor/src/models/lessoninstallpolicy.ts) already grades `local` vs `local-ai`; a platform bundle is a third trust profile and the F1–F4 scorecard applies differently to each | TUT-004 AC3 |
| **R3** | Does the tutorial ship its collection pre-made, or does the learner create it? Learner-creates is better pedagogy and is exactly the half TUT-002 makes gradeable; pre-made is gradeable today | TUT-003 |

## 4. The order

**TUT-002 before TUT-003**, so the tutorial is authored against the verbs rather than retrofitted to
them. **TUT-001 is independent** and has no fork in it — start there. **TUT-004 last**, because it
needs a bundle to install and phase 72's community panel to install it from.
