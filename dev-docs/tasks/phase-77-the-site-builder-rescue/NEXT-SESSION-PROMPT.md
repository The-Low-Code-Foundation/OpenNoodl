# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s32 fixed both of s31's defects. AC2 is met on the artefact a person receives.**

s31 ended with a sentence it refused to round up: *"AC2's gesture works on the real page editor, and
the artefact a person receives cannot show it."* That is no longer true. **D30 and D31 are fixed,
driven on the shipped project, and the specs that pinned them are now the regression net for them.**

Read in this order:

1. **[SBR-007 §35](SBR-007-THE-PAGE-EDITOR.md)** — the two edits, what the drive reads now, and the
   three things that were not obvious.
2. **[D31](DEFECTS-THE-SITE-BUILDER-FOUND.md#d31)** 🟢 and
   **[D30](DEFECTS-THE-SITE-BUILDER-FOUND.md#d30)** 🟢 — both closed, with the before/after readings.
3. Still open and unchanged: **[D15](DEFECTS-THE-SITE-BUILDER-FOUND.md#d15)** 🔴 (AC3's only
   remaining blocker), **[D13](DEFECTS-THE-SITE-BUILDER-FOUND.md#d13)**,
   **[D16](DEFECTS-THE-SITE-BUILDER-FOUND.md#d16)**,
   **[D22](DEFECTS-THE-SITE-BUILDER-FOUND.md#d22)**,
   **[D29](DEFECTS-THE-SITE-BUILDER-FOUND.md#d29)** (a peer's).

---

## 🔴 THE BOARD — this is the agenda. Build a task.

🔴 **Standing rule, set by Richard 2026-08-30 — read
[`dev-docs/guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md) before doing
anything else:**

> **A defect becomes the next session's first job ONLY if it blocks an acceptance criterion.**
> Otherwise it is filed with an owner, and **the next session builds the next task.**

**Why this phase in particular:** s19 → s32 filed **19 new defect rows in 14 sessions — not one
session filed zero** — and closed **one** task. The last genuinely new task to go green was
**SBR-008, at s18**. Seven tasks have never been started. 🔴 **The ratchet has TRIPPED: build.**

### 🟢 BUILD THIS: **SBR-006 AC3 — `Unpublish`**

AC3 names three actions. Publish and Duplicate are driven green (s22). **`Unpublish` has never been
clicked.** It is one click on a fixture that already exists, it closes an acceptance criterion, and
it is the cheapest ✅ on the board.

**First concrete step:** mint a project from the current template, claim it, publish a page, then
click `Unpublish` from the row menu and read the **stored row** — not the response, not the screen.
The fixture pattern and credentials are in *Standing context* below.

### Then, in order

| | what |
|---|---|
| 2 | **SBR-015 AC4** — a **re-read, not a build**. AC4 was recorded 🟡 because `execution_steps` held 0 rows; DEF-004(a) now writes a step per action. Re-take the reading |
| 3 | **SBR-012** — the raw-colour gate. ⚠️ **It owns SBR-004's AC3**, so it closes an AC in another task too |
| 4 | **SBR-005** — sections worth having; **owns AC3's gallery model**. The largest unbuilt piece |
| 5 | **SBR-009 / 010 / 011 / 013** — never built. SBR-011 was **ruled BUILD, not strike** |
| last | **SBR-014** — re-verifies every person-sentence AC, so it **cannot run until the rest are built** |

### 🔴 The phase's end condition

**SBR-014 is the gate on closing phase 77**, and it re-verifies every person-sentence AC. It cannot
start while seven tasks are unbuilt. 🔴 **That is the distance to done — not the length of the
defect register.**

⚠️ **AC3 of SBR-007 cannot be met at all** — **D15**, no drop-target capability in the runtime for a
file arriving from outside the page (`dataTransfer`, `dragover`, `dragenter`, `DragEvent` all **0**
against a **39**-hit `onClick` control over **369** files), re-measured at HEAD with a boundary
control at s29. **Phase 77 must not close pretending AC3 is met**, and s32's pointer drag does
**not** narrow it — that was in-page pointer work and needed none of the missing API.

## 🔴 What s32 paid for, and would pay again

- 🔴 **The handoff told me to import a constant, and doing that would have broken the build.**
  s31 said to import `SECTION_SORT` from `sb006Components.ts`. But `sb006` already imports `ROUTER`
  **from `sb005`** *and uses it at module-eval time* — so importing back makes a cycle in which
  `ROUTER` is still in its **TDZ** when `sb006`'s body runs. ✅ **Move the constant to the module
  that is already upstream and re-export it downstream** (the pattern `ROUTER` itself used). One
  copy either way, which was the point. 🔴 **`grep '^import'` both files before believing a
  "just import it" instruction**, and check whether the symbol is used at module-eval time or
  inside a function — that decides whether the cycle is fatal or merely ugly.
- 🔴 **When a fix lands, its mutants must INVERT — and their preconditions with them.** s31's
  mutants *repaired* the project to name a cause; after the fix that mutant repairs nothing, and
  `setParams`' precondition (*keys ABSENT beforehand*) goes red. The arms now **restore** the defect,
  and `setParams` grew a **mirror precondition**: the keys must be present **and `false`** before
  being overwritten. ✅ **Without it, a template that quietly stopped stating them would leave the
  arm "restoring" a defect that was never absent** — the shipped arm reddens and the mutant still
  looks like it did its job.
- 🔴 **A control does not become obsolete when the bug is fixed — it becomes a control about the
  MUTANT.** s31's exclusion of the obvious suspect (removing `Changed → storageFetch` does not stop
  the loop) proves nothing about a loop that no longer exists. Re-based on the restored defect it
  still reads **20,507** row writes with the wire gone.
- ✅ **"Check X while you are there" is answered by reading X's wires, not by applying the same fix.**
  `unpack` takes `in-data` on the same wire but has **no `run` connected** — the value change is its
  only trigger, so silencing it would blank the body textarea and the image preview permanently.
- ⚠️ **A flipped spec reddened a DIFFERENT spec, and the difference mattered.** `sb007Template` went
  52/53 — the red was a **mutant** whose offender string enumerates the query's stored parameters,
  which now includes `visualSort`. 🔴 **The real gate never moved** (`offenders: []`, same nine
  graded reasons), so `visualSort` added a stored **parameter**, not a **trigger**. ✅ **Check the
  gate that would catch the real regression is still green before editing an expected literal.**
- ⚠️ **A census that counts by LABEL counts things that are not the same kind of thing.** Four nodes
  are labelled *"This page's sections"*; two are now sorted and two are not — and the two that are
  not are **cloud functions with no screen**. `reorderSection` sorts in its own script because it
  cannot trust query row order at all. "2 of 4" would have read as a half-fix.
- 🔴 **A wait-loop that greps `ps` for a runner name never exits here.** A peer has a watcher running
  for over a day whose *command line* contains `jest|vitest`, so `ps` output always contains the
  word. ✅ **Wait on a PID** (`while kill -0 <pid>`), never on a name — the same reason kills are
  attributed by PPID.

---

## Richard's, still small and still unanswered — carried from s26, untouched by s27–s32

**D20's fix moved the actions.** The heading grows as well as shrinks — `layout.ts` assigns
`flexGrow` and `flexShrink` in the same branch, so there is no third option — which puts
`Preview`/`Save page` at the **right** of the header rather than clustered beside the title. Nothing
is clipped at any width; the question is only whether that look is wanted. **Two parameters revert
it** (`sizeMode: 'contentSize'`, drop `width`) at the cost of putting D20 back.

---

## ✅ The instruments — SIX, and they answer different questions

🔴 **Pick by what is being asked, not by which one you used last.**

| question | tool |
|---|---|
| does it *lay out* / render correctly | `render-from-disk.js` + `withRenderedPage` (§20, §30) |
| does the thing a person **deploys** work | `deploy-from-disk` + `drive-deployed.js` (§26) |
| does a **cloud function** actually do what it claims | `sb004-publication-invariant.test.ts` (§31) |
| does a **node's port** report what it declares | `d23GeometryDrive.test.ts` (§32) |
| does a **gesture** do what it looks like it does | `ac2DragGestureDrive.test.ts` (§33) |
| does **the shipped screen** do it, against a real backend | `ac2-page-editor-drag-drive.test.ts` (§34–§35) |

```
# the shipped-screen drive — now green on the SHIPPED project, mutants restore the defects
cd packages/nodegx-backend && npx jest ac2-page-editor-drag-drive     # 23 specs, ~6 min

# the gesture-mechanism drive
cd packages/noodl-mcp && npx jest ac2DragGestureDrive

# the cloud-function drive
cd packages/nodegx-backend && npx jest sb004-publication-invariant

# the template gate — byte-identity with a fresh generation
npm run template:site-builder && cd packages/noodl-mcp && npx jest sb007Template
```

- 🔴 **Read the stored rows, never the answer** — *and count them.*
- 🔴 **A page in the middle of a write storm refuses the reader too** — read stored rows BEFORE
  opening a writing screen, not only after.
- 🔴 **`buttons: 1` on every `mouseMoved`** or `react-draggable` ignores the move and the failure
  reads like *"the runtime cannot drag"*.
- 🔴 **Vary something the store cannot fill back in.** `data: null` is not `undefined`, so a
  "without `data`" arm is not a control.
- ⚠️ **Count every mutant edit** — `removed:1`, `matched:1`, and the precondition on the keys.
- 🔴 **A new endpoint owes a rule in `site-builder.security.json`** or SB-016's gate refuses a
  public bind.
- ✅ **`--sabotage` wires a connection to a port that does not exist.** If the census does not report
  it dropped, the health filter did not run and **every other reading in that run is void**.
- 🔴 **A headless export's health filter fails OPEN, silently** — `registerModule(project)` first.

## The register — an APPENDIX, not the agenda

🔴 **Every row below is `BACKLOG` unless it says `BLOCKS <AC>`.** Do not open a session on one of
these while a task is unbuilt.

### `BACKLOG` — [D32](DEFECTS-THE-SITE-BUILDER-FOUND.md#d32), the gate that let D31 through

⚠️ **Blocks no AC.** Real and worth fixing — but it is a defect about this phase's own instruments, which is the exact signature the standing rule exists to interrupt.
Filed by the parallel s32 session that fixed D30/D31 in a worktree; the template fix landed from the
other one (`505d9b38`) and this row is what that work did not carry.

`sb007Template`'s `gradeMountTriggered` walks the migration's writes and opens with a `continue` for
any node not triggered by `didMount` — so it examines **1 of 65** (68 before the fix). **D31's three
writes were among the skipped**, which is why a suite that already knew about the migration was
green while the page editor wrote six figures of updates in eleven seconds.

The missing rule, in D31's exact shape and statically checkable: does a silenced input's value come,
directly or transitively, from a record write that this same node's output causes? 🔴 **Do not "fix"
it by making the template state all 65** — that changes what the migration is for. **The gate is the
gap.** ✅ **Count what a checker REACHED, not just what it flagged.**

## Where the phase now stands

🔴 **Re-derived from the task FILES at s32** — s31's version omitted seven open rows and carried
SBR-016 as open when its own file had said 🟢 since s15.

| | verdict |
|---|---|
| **SBR-001 / SBR-002** | ✅ closed s2 / s4 |
| **SBR-003** | 🟡 built, swept, driven — **owed: the `var(--token)` dimension-port probe** |
| **SBR-004** | 🟢 AC1/2/4 driven · AC3 is SBR-012's |
| **SBR-005** | ⬜ **OPEN, never built** — **and it owns AC3's gallery model** |
| **SBR-006** | AC1/2/4/5 ✅ · **AC3 🟡** — `Unpublish` is the one act of three still undriven |
| **SBR-007** | 🟢 AC1 ✅, AC4 ✅, AC5 ✅ · **AC2 ✅ ALL THREE HALVES AND ON THE SHIPPED ARTEFACT** (outcome s27, gesture s30, real screen s31, shipped project s32) · AC3 blocked by D15 alone · D18/D20/D24/D30/D31 ✅ |
| **SBR-008** | ✅ all five, s18 |
| **SBR-009** | ⬜ **OPEN, never built** — the theme editor demos itself |
| **SBR-010** | ⬜ **OPEN, never built** — messages |
| **SBR-011** | ⬜ **OPEN, never built** — live preview over the realtime hub; **ruled BUILD, not strike** |
| **SBR-012** | ⬜ **OPEN, never built** — the raw-colour gate; **it owns SBR-004's AC3** |
| **SBR-013** | ⬜ **OPEN, never built** — the doctrine rule |
| **SBR-014** | ⬜ **OPEN, and LAST** — re-verifies every person-sentence AC, so it cannot go before the rest |
| **SBR-015** | AC1/2/3 ✅ s13 · **AC4** 🟡 re-read: DEF-004(a) now writes a step per action |
| **SBR-016** | ✅ **s15, all four ACs** — ⚠️ `TASKS.md` read `⬜ open` until s32 corrected it |
| **SBR-017** | ✅ s14 · AC1 🟡 half (SBR-016 owned the other half) |
| **D13 / D16** | 🔴 open, `NONE` |
| **D14** | 🟢 fixed s20, DRIVEN s22 — the **browser** deploy path is still exposed and `NONE` |
| **D15** | 🔴 **`BLOCKS` SBR-007 AC3** · `NONE` — no drop target for a FILE; **AC3 cannot be met**. Stands at HEAD |
| **D17 / D18 / D21** | 🟢 fixed and driven (s21/s24/s25) |
| **D19** | 🟢 reds fixed s23 — 🔴 **`test:main` watched is still `NONE`** |
| **D20** | 🟢 FIXED + DRIVEN s26; **the appearance half is Richard's** |
| **D22** | 🔴 `NONE` — no `textOverflow` port on `Text` |
| **D23** | 🟢 DISPROVED s29, kept |
| **D24** | 🟢 FIXED + GATED s28 |
| **D25 / D26 / D27** | 🔴 `NONE` — all three registered in phase 80 |
| **D28** | 🟢 **FIXED by a peer as phase 80 `DEF-027`** during s32 — the spread was discarding the author's `cssClassName` |
| **D29** | 🔴 `NONE` — one-way gate latches; **a peer's row**, filed from phase 80 s21 |
| **D30 / D31** | 🟢 **FIXED + DRIVEN s32** — template work, done in this phase, as s31 decided |
| **D32** | 🔴 **NEW s32, `NONE`** — the gate that let D31 through: `gradeMountTriggered` examined **1 of 65** nodes |

## Standing context

- ✅ **The template is generated, not authored.** Edit
  `packages/noodl-mcp/tests/sb00{4,5,6}Components.ts`, then `npm run template:site-builder`.
  `sb007Template.test.ts` asserts the committed artefact is byte-identical to a fresh generation.
  ⚠️ **Census literals live in FIVE files**; a **parameter-only** change should move none — s32
  verified this rather than assuming it.
- 🔴 **`SECTION_SORT` now lives in `sb005Components.ts`** and `sb006Components.ts` re-exports it.
  Both section-drawing queries share that one copy. Do not reintroduce a second.
- ✅ **Fixture: `SBR-007 Page Editor Drive`**, backend `backend_mterfnli74qwv`, port **8601**,
  `SITE_SETUP_TOKEN=drive-token-007`, `owner@sbr007.test` / `drive-pass-007`. Page
  `e921dd5b-93a5-40e4-bb75-75c37da395c0`, slug `drive-007`. 🔴 **Drive a COPY of the backend data.**
  ⚠️ Its `Section` table is EMPTY — the s31/s32 drive seeds its own backend instead.
- ✅ **The setup token is a file, not a UI step**: `~/.noodl/backends/<id>/secrets.json`, `functions`
  namespace. `SecretsStore` re-reads on every call, so no restart.
- 🔴 **A node's port description lives in FOUR generated copies.** Changing one in the runtime owes
  `catalog:generate` → `catalog:merge` → `docs:nodes` **and** `cloud-library:generate`.
- 🔴 **A source change is not a drive until the bundle carries it** — the viewer
  (`external/viewer/noodl.viewer.js`), the deploy runtime (`external/deploy/noodl.deploy.js`, a
  *different file*), and `nodegx-backend/dist`. **A template change is different** — project data,
  read from disk every boot, so no rebuild. **s32 changed no product source**, so no bundle is stale.
- ⚠️ **A peer was active in the shared checkout throughout s32**, fixing D28 as phase 80's
  `DEF-027` (`ac2DragGestureDrive.test.ts`, and the runtime's `NoodlReactComponent.render`). Their
  files were **excluded from s32's commit** — attributed by **mtime**, not by `git status`.
- Shared checkout: **pathspec commits only, never `git add` to stage** (except to make an untracked
  file committable); `git status --porcelain | grep '^??'` before committing. Announce editor
  launches **and** teardowns. `test:ci` alone.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
