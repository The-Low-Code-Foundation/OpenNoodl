# Phase 66 — next session

**Written 2026-08-15, session 16.** Two drives, both from the top of last session's list.
**FIX-001 criterion 4 is driven on both entry routes — FIX-001 is now open only on §1c.**
**FIX-014 criterion 1 is driven for the Build panel**; the MCP half is still blocked on a
repackage, so the task stays open.

🔴 **The FIX-014 drive found a defect no spec could catch: `COLLISION_STEP = 40` is shorter than a
node is tall, so two "separated" nodes stop sharing a coordinate and still visibly overlap.** It is
recorded with options, **not fixed** — what the pass promises is a ruling. See §3.

⚠️ **The bigger methodological result is in §2: run 1 passed every pre-written claim with the layout
pass doing nothing.** The prompt half alone produced a good canvas. Only a deliberately hostile run
showed the structural half working at all.

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, overwritten each session. It carries exactly four things:

1. **Built vs. driven**, per task, as a table — *built* is code plus gates; *driven* is the app
   doing it. Never let the two blur into "done".
2. **Gate readings with their date and tree**, so the next session compares NAMES against a reading
   it can trust rather than re-deriving one.
3. **What this session settled**, so nobody re-litigates or re-measures it.
4. **What to do next and why**, ordered, with rulings owed by Richard called out separately.

Learnings that outlive the phase go to memory, not here.

---

## 1. Built vs. driven

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-007** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-009** | ✅ | ✅ 5/5 | **CLOSED** |
| **FIX-010** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-011** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-012** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-018** | ✅ | ✅ 5/5 | **CLOSED** |
| **FIX-019** | ✅ | ✅ 4/4 | **CLOSED** — 🟡 14(a) vocabulary sweep still owed |
| **FIX-020** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-002** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-003** | ✅ | ✅ 5/5 | **CLOSED** — `will-navigate` proven (s13) |
| **FIX-001 §1a** | ✅ | ✅ 3/3 | driven s15; one defect found + fixed. Stretch §1a.5 still open |
| **FIX-001 §1b** | ✅ pre-existing | ✅ **1/1 NEW** | **criterion 4 driven s16, both routes.** Nothing needed building — s14's source reading was right |
| **FIX-001 §1c** | 📋 open | — | untouched — **the only part of FIX-001 left**, and the largest remaining build in the phase |
| **FIX-014** | ✅ | 🟡 **half NEW** | **Build panel driven s16 (criteria 1, 2, 3).** 🔴 **MCP half still undriven — blocked on a `dist/` repackage.** New defect found, see §3 |
| **FIX-008** A, B, E | ✅ | ✅ | C, D not built |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

**Eleven closed.** FIX-014 is the oldest *partly* driven item; FIX-001 §1c is the largest open build.

---

## 2. Gate readings

**Tree at 16:05, 2026-08-15**, carrying `e824f30a` (docs only — no source changed this session).

| Gate | Reading | When |
|---|---|---|
| editor `tsc --noEmit` | ✅ **0 errors** | 16:02 |
| `test:ci` (jasmine) | **not run** — s15's reading stands: 2814 specs / 6 failures = the floor by name, seed 39393. **No source changed this session**, so it cannot have moved | — |
| `test:main` (jest) | not re-run — s14's 203 suites / 3136, 0 failed, stands for the same reason | — |
| `lint:ci` | not run | — |

⚠️ **This session changed only two markdown files.** That is why no suite was re-run, and it is the
only condition under which quoting an older reading is honest. **Do not carry this forward past any
source edit.** 🔴 Quote against a **tree**, not a commit — `test:ci` webpacks the working tree.

⚠️ A peer session (`592af959…`) drove `noodl-preview` on ports 8581/8583 plus headless Chrome on
9334 for this whole session. Checked before launching that neither matches the sweep (`findDevProcesses`
needs **both** the repo path in argv **and** a `DEV_TOOL` match; a relative `packages/noodl-preview/…`
argv has neither), and confirmed after `dev:stop` that **both survived**. The pidfile did not exist,
which is the other way a peer's process can be swept.

---

## 3. 🔴 The defect the FIX-014 drive found — and the trap it hid behind

Full write-up in [FIX-014](FIX-014-THE-AI-PILES-NODES-IN-ONE-COLUMN.md) §"DRIVE RECORD".

### What it is

**`COLLISION_STEP = 40` is smaller than a node is tall.** Measured node heights on the drive canvas
ran **64 to 190** px. The separation loop is `while (occupied.has(keyOf(n))) n.y += COLLISION_STEP`
— it exits as soon as the exact coordinate pair is free. So two colliding nodes end up 40 apart:
**no longer sharing a coordinate, and still visibly overlapping.** The screenshot shows one node
drawn across the lower half of another.

**No spec could have caught it.** All 17 assert coordinate *inequality*. None knows a node has a
height, because the pure pass is never given sizes.

### The ruling it needs (not an agent's reflex)

- (a) raise the constant — `ROW_SPACING` (120) clears the common case but **still not a 190px node**;
- (b) pass measured heights into the pass, which costs the pure layer its purity;
- (c) leave it, on the grounds that identical coordinates only ever come from a misbehaving model.

**Recorded rather than changed**, because it decides what the pass *promises*.

### 🔴 The trap that nearly scored the run wrong

Run 1 — a normal request, no coordinates dictated — **satisfied all four pre-written claims while
the layout pass did nothing at all.** The coordinates matched the **prompt's** wording (~60 indent,
~120 apart, logic to the right), not the pass's constants (root `40,40`, children `100`, logic at
`maxVisualX + 250`). A canvas that looks right is not evidence that the mechanism you built ran.

✅ **What worked: ask for something the pass cannot decline.** Three nodes requested at one
coordinate came out at y = 400, **440**, **480** — the step applied twice, in order. One 40 could be
a model's choice; two consecutive 40s on the constant is a signature.

✅ **And criterion 2 came free, in its stronger form:** the six model-positioned nodes from run 1
kept their exact coordinates through **both** later update passes.

---

## 4. What this session settled — do not re-derive

### Reaching the live canvas editor

- 🔴 **`window.__nodeGraphEditor` is assigned in `render()`, so the last editor to render wins.**
  After an AI build it points at the **detached preview canvas** — `roots: []`, element measures
  **0×0** — while the live graph has 9 roots. Navigating does **not** re-register it.
- ✅ **The live one is `NodeGraphContextTmp.nodeGraph`** (`contexts/NodeGraphContext/NodeGraphContext.tsx`),
  reached through the webpack module cache.
- ✅ **Model→screen is `canvasRect.origin + (model + pan) * scale`**, with
  `ed.viewportActions.setPanAndScale({x, y, scale})` then `relayout(); repaint()`. Predicted and
  measured positions matched to the pixel.
- 🔴 **`nodeSize` is NOT the selectable bounds.** A marquee drawn tightly around two nodes' `nodeSize`
  boxes selected **zero**; a wider rectangle around the same two selected **both**. This reads
  exactly like "overlapping nodes cannot be marquee-selected" and was nearly written up as a defect.
  It is not one.

### Right-clicking the canvas

🔴 **A synthetic DOM `MouseEvent` with `button: 2` does nothing** — `InteractionController` reads
`evt.button === 2` off its own dispatcher. A genuine `Input.dispatchMouseEvent` with
`button: 'right'` is required, and `cdp.js` has no such command; one was written against its
exported `connect`/`appTarget`. ⚠️ **`connect` takes the target object, not a URL.**

### Instrumenting the authoring pass

⚠️ **`layoutAuthoredNodes` cannot be wrapped over CDP** — webpack harmony exports are
non-configurable (`defineProperty` → *"Cannot redefine property"*). The **constants can be read**,
which is what made the "these are not the pass's numbers" inference available. Plan for a signature
in the output rather than a spy on the call.

### Driving the Build panel

- Composer is a plain `textarea`; `cdp type` works. Accept buttons are **"Add to project"** on a
  create and **"Apply the change"** on an update.
- ⚠️ A wait loop keyed on the accept button **fires early on a transient state** — gate on
  `Stop` being *absent* as well.
- ⚠️ **A marquee that selects nothing flips the sidebar to Components**, which deselects. The order
  that works is **marquee first, then switch to Explain** — `panelHoldsCanvasSelection` keeps the
  selection, confirmed live at 3 nodes.

---

## 5. What to do next and why

1. 🔴 **FIX-014's MCP half** — criterion 1 says *both clients*, and this is now the only thing
   between FIX-014 and closure. **It needs the `noodl-mcp` `dist/` repackage first** (orchestrator's
   call, still outstanding), then one `create_component` with mixed node kinds and a look at the
   canvas. ⚠️ Running servers load `/Applications/…`, so check the *path* and *start time*.
2. 🔴 **Rule on `COLLISION_STEP`** (§3) — cheap to act on once decided, and it is the only known
   defect in shipped phase-66 code.
3. **FIX-001 §1c** (look inside component instances) — the largest remaining build, and now the
   only part of FIX-001 open.
4. **FIX-008 fix C** — Richard owes a measurement on C's copy first.
5. 🟡 **FIX-001 §1a.5 stretch** (`backwardWalk` on "why is X null") — s15 showed the answers already
   reach the upstream cause **via warnings**, so the marginal value is lower than the task assumed.
   Worth re-deciding rather than building on reflex.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

---

## 6. Owed by Richard

- 🔴 **STILL OWED — the `dev-processes.js` fix is uncommitted** (it spares a running `test:ci` from
  the launch/teardown sweep). Two runs were destroyed by that defect on 2026-08-15. It is outside
  this phase, so it has been left uncommitted again. **Commit it, or say to drop it.**
- 🔴 **STILL OWED — the `noodl-mcp` `dist/` repackage.** It now blocks the last piece of FIX-014,
  not just a convenience.
- 🔴 **STILL OWED — `MEMORY.md` is over its 17.1 KB target** and cannot be brought under by
  rewording; getting under budget means **dropping live trap entries**, which is a call about your
  own knowledge base. ⚠️ Several sessions edit it concurrently — a compaction pass must be targeted
  single-line edits; a whole-file rewrite silently clobbers a peer's entry.
- 🟡 **STILL OWED — `run-editor/SKILL.md:23` teaches `nohup … &`**, which reparents the stack to
  PID 1 and destroys launch provenance. Ignored again this session in favour of
  `NOODL_REMOTE_DEBUG_PORT=9223` under a tracked shell, which made the stack attributable. Worth
  changing the recipe.
- 🟡 **A ruling on `COLLISION_STEP`** — see §3. Three options, all recorded.
- 🟡 **s13's datum on `linkify`**: the scoping model *declines to emit links* (3 refusals).
- 🟡 **FIX-019 14(a)** — is the surface called *the workbench* everywhere?
- **FIX-004** conversion block shape · **FIX-005** category name · **FIX-006** demote Script? ·
  **FIX-013** what a data-reading component shows · **FIX-016** signal-input semantics ·
  **FIX-008** leftovers (incl. a measurement) · **FIX-015** / **FIX-021** are their own sessions.

---

## 7. Standing constraints

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call (⚠️ **the Bash
cwd persists between calls** — use absolute paths); **pathspec-scope every `git add`**.
⚠️ `dev-docs/tasks/phase-65-the-library/` and `phase-69-the-node-you-write-yourself/` are untracked
and belong to neither this phase nor 67 — `MEMORY.md` links into them, so they are one `git clean`
from gone. Leave them.

**Announce before *and* after any `test:ci`, `test:main` or editor launch, and announce your PIDs.**
✅ Launching with `NOODL_REMOTE_DEBUG_PORT=<not 9222>` under a tracked shell is what keeps a stack
attributable in the process table.

⚠️ **Before launching beside a peer, check the sweep by its actual rule, not by reputation:**
`findDevProcesses` needs **both** the repo path in argv **and** a `DEV_TOOL` match, plus anything in
`node_modules/.cache/noodl-dev-pids.json`. Both were checked this session and both peer previews
survived `dev:stop`.

⚠️ **Driving the Build panel spends Richard's Anthropic key.** Three authoring turns this session.
Ask for what you need in one prompt where you can.
