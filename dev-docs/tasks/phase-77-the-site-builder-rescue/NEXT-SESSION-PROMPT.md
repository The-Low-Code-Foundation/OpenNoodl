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

## 🔴 FIRST JOB — pick one; there is no forced next step

s32 closed the only rows this phase had queued as work. What is left is a choice, not a sequence:

### (a) **SBR-006 AC3 — `Unpublish` is one click**
AC3 names three actions. Publish and Duplicate are driven green (s22). **`Unpublish` has never been
clicked.** This is the cheapest open ✅ in the phase and it closes an AC.

### (b) **SBR-015 AC4 — a re-read, not a build**
The row says *"re-read: DEF-004(a) now writes a step per action"*. AC4 was recorded 🟡 on the
evidence that `execution_steps` held **0 rows**. That is no longer how the backend behaves. **Re-take
the reading before deciding anything.**

### (c) **SBR-005 — open, and it owns AC3's gallery model**
The largest remaining piece, and the one AC3 partly depends on. ⚠️ It does **not** unblock AC3 on
its own — see D15 below.

🔴 **AC3 cannot be met by any of these.** **D15** stands at HEAD: no drop-target capability in the
runtime (`dataTransfer`, `dragover`, `dragenter`, `DragEvent` all **0**, beside a **39**-hit
`onClick` control over **369** files), re-measured with a boundary control at s29.

⚠️ **s32 does NOT narrow D15, and the temptation to read it that way is now stronger.** D15 is about
**a file arriving from outside the page**. s32 dragged a real section with a real pointer, on the
shipped artefact, and needed none of it. The two were filed as twins and **only one was ever real**.
**Phase 77 must not close pretending AC3 is met.**

---

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

## Where the phase now stands

| | verdict |
|---|---|
| **SBR-005** | ⬜ open — **and it owns AC3's gallery model** |
| **SBR-006** | AC1/2/4/5 ✅ · **AC3 🟡** — `Unpublish` is the one act of three still undriven |
| **SBR-007** | 🟢 AC1 ✅, AC4 ✅, AC5 ✅ · **AC2 ✅ ALL THREE HALVES AND ON THE SHIPPED ARTEFACT** (outcome s27, gesture s30, real screen s31, shipped project s32) · AC3 blocked by D15 alone · D18/D20/D24/D30/D31 ✅ |
| **SBR-008** | ✅ all five, s18 |
| **SBR-015** | AC1/2/3 ✅ s13 · **AC4** 🟡 re-read: DEF-004(a) now writes a step per action |
| **SBR-016 / SBR-017** | ✅ s14/s15 |
| **D13 / D16** | 🔴 open, `NONE` |
| **D14** | 🟢 fixed s20, DRIVEN s22 — the **browser** deploy path is still exposed and `NONE` |
| **D15** | 🔴 `NONE` — no drop target for a FILE; **AC3 cannot be met**. Stands at HEAD |
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
