# FIX-014 — The AI piles nodes in one column

**Report 9** · Tier 2 · Effort **S** (prompt) + **M** (layout pass)

> *"When the MCP or AI builds something with visual and logic nodes, it seems to tend to put all
> nodes in the same central column."*

## Mechanism — pinned: there is no layout algorithm anywhere

`x`/`y` are whatever the model typed, copied verbatim (`candidate.ts:171-172`; MCP passes them
through untouched; omitted values become `undefined` and draw stacked at the origin — the
phase-42 fixture symptom). The **only** placement instruction in the product is one line:

> `authoring.ts:65` — *"Lay nodes out readably: flow left-to-right or top-to-bottom, roughly
> 150–300 units apart."*

— which is literally a spec for one column. `ContextBuilder.ts:379` gives visual nodes a placement
sentence and logic nodes silence. The MCP's instructions say **nothing about placement at all**.
This report is new — no prior finding in phases 40/55/58.

The discriminator needed already exists on both sides: `catalogVisualPredicate`
(`noodl-mcp/src/visualRoots.ts:56`) and `CatalogNode.isVisual` (editor).

## Fix direction

1. **Prompt (S):** replace `authoring.ts:65` with a two-family rule — the visual tree flows down
   a left column at its hierarchy depth; logic nodes sit in a column offset to the right
   (e.g. `x ≥ maxVisualX + gutter`), grouped beside the visual node they feed. Mirror line in
   `ContextBuilder.ts:380` for `!node.isVisual`; add the same sentence to the MCP `instructions.ts`.
2. **Structure (M):** a pure `layoutAuthoredNodes(nodes, isVisual)` in a module both clients
   import (the `traps.ts`/`visualRoots.ts` containment pattern): walk the visual tree for the left
   column, place logic nodes in a right column ordered by their first connection target's `y`.
   Run in `candidate.ts` (after `reconcileHierarchy`) and in the MCP apply path — **only for nodes
   whose `x`/`y` the model omitted or which collide**. Never move a human's arrangement.
3. **Nice-to-have (L, file separately):** an editor "Tidy this component" command reusing the same
   pass — gives the layout function a non-AI consumer and a reason to be good.

## ✅ RULED 2026-08-14 — model-supplied `x`/`y` is **authoritative**

- ✅ **Authoritative.** The pass **fills gaps and resolves collisions only** — it never moves a node
  the model positioned, and never moves a human's arrangement. Acceptance criterion 2 (a
  model-positioned node is never moved) is the load-bearing control, not a formality: it is the
  whole difference between this ruling and the advisory one.
- ✅ Following directly from that: **`update_component` on a hand-arranged component repositions
  nothing** unless explicitly asked. Decided before the pass is written, as the task required.
- 🟡 **Still open, agent's call:** fixed `x` vs `maxVisualX + gutter` for the logic column's
  offset, and whether comment/annotation nodes participate. Neither changes the architecture.

## Acceptance criteria

1. Ask the internal AI for a page with a visual tree + 3 logic nodes: logic lands in its own
   column beside the visuals, no overlap — driven, both clients (Build panel and MCP).
2. A model-positioned node is never moved by the pass (control).
3. Two nodes emitted at identical coordinates are separated.
4. Pure-function specs for `layoutAuthoredNodes` (tree shapes, collisions, all-logic, all-visual).

---

## 🔨 BUILD RECORD — 2026-08-15 (branch `fix014-lane`)

**Built, specs green in both packages. ⚠️ Acceptance criterion 1 (driven, both clients, in the
live app) is NOT met yet — nothing here was driven; that is the next session's job.**

> **Superseded in part by the DRIVE RECORD at the foot of this file (session 16, 2026-08-15):**
> criterion 1 is driven for the **Build panel**, criteria 2 and 3 were observed live, and the drive
> found a defect (`COLLISION_STEP = 40` is shorter than a node is tall, so separated nodes still
> overlap). The **MCP client half is still undriven** and the task is still open.

### Files changed

- **NEW** `packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/layout.ts` — the pure
  pass: `layoutAuthoredNodes(nodes, isVisual, {connections?, lockedIds?})` +
  `positionsUnchangedFrom(nodes, baseline)`. Imports only types from `../../../schemas`.
- `packages/noodl-mcp/src/editor-deps.ts` — re-exports it (the `traps.ts`/`pageRegistration`
  containment pattern: pure module in the editor, one import point for MCP).
- `packages/noodl-editor/.../authoring/candidate.ts` — runs the pass in `buildCandidate` after
  children derivation; new optional 5th param `isVisual` (defaults `() => false`, tree membership
  still classifies every parented node).
- `packages/noodl-editor/.../authoring/AuthoringSession.ts` — passes the catalog predicate.
- `packages/noodl-editor/.../authoring/ContextBuilder.ts` — new public `isVisualType()`, and the
  mirror prompt line for `!node.isVisual` in `renderNodeType` ("Logic node — no `parent`; it sits
  in the logic column…").
- `packages/noodl-editor/.../authoring/prompts/authoring.ts` — the one-column line at :65 replaced
  with the two-family rule (visual tree down a left column, ~60 x-indent/depth, ~120 apart; logic
  right of the deepest visual x with a ~250 gutter, beside the node it feeds; never share an x/y).
- `packages/noodl-mcp/src/tools/author.ts` — the pass runs in `assembleCreateFiles` and
  `assembleSetFiles` (so `create_component`, `update_component --set` AND both plan-staging kinds
  get it through the shared assemblers), plus the `operations` branch of `update_component`
  (an `add_node` without x/y no longer lands at the origin).
- `packages/noodl-mcp/src/instructions.ts` — one tight LAYOUT sentence in `projectInstructions`;
  the three `tests/fixtures/boundInstructions.*.txt` captures updated in the same commit (that is
  the designed flow — the fixture diff is the review).
- `packages/noodl-editor/tests-unit/leg-001/authored-comment.test.ts` — one assertion re-scoped:
  "adds nothing to a node with no comment" now tolerates the x/y the pass legitimately adds and
  keeps guarding what LEG-001 actually owns (no stray metadata/comment key).

### The open calls, decided

- **Logic column offset: `maxVisualX + LOGIC_COLUMN_GUTTER (250)`**, not a fixed x — a fixed
  column collides with any visual arrangement wider than the constant. All-logic component
  (no visual x anywhere): the column falls back to `VISUAL_COLUMN_X` and flows down.
- **Comment/annotation nodes do not participate.** Canvas comments are `nodes.json`'s separate
  `comments` array, not `NodeV2`s, not submit-expressible in either client; carried verbatim from
  the base, never seen by the pass.
- **"Which collide" honoured narrowly:** exact-coordinate ties only. First occupant keeps the
  spot; later ones step down `COLLISION_STEP (40)` until clear. A `lockedIds` node (position
  carried unchanged from the baseline = a human's arrangement) is never nudged at all — two
  locked nodes sharing a spot both stay.
- **Tree membership beats the predicate:** a node with `parent`/`children` is visual even when
  the catalog predicate says false (component instances). Discriminators used as ruled:
  `catalogVisualPredicate`/`projectVisualPredicate` (MCP), `CatalogNode.isVisual` via
  `ContextBuilder.isVisualType` (editor). No new discriminator invented.
- **Half-positioned (x xor y) counts as unpositioned** and gets both coordinates.
- **Baseline nodes with NO stored position are not locked** on update — an origin pile is not an
  arrangement, it is this bug; they get placed on the next write through either update door.
- **`update_node.set.x/y` is "explicitly asked"** — written verbatim (spec pinned).

### Specs (all new, all green)

- `packages/noodl-editor/tests-unit/fix-014/layoutAuthoredNodes.test.ts` — 17 specs: tree shapes,
  all-visual, all-logic, mixed, logic ordering by fed-node y, **the never-moved control**,
  collision separation, locked-vs-unlocked colliders, half-positioned, instance-in-tree,
  no-mutation, `positionsUnchangedFrom`, and 3 `buildCandidate` door specs (incl. update-mode
  locking).
- `packages/noodl-mcp/tests/authoredLayout.test.ts` — 6 specs on the real doors, asserted ON DISK:
  create lays out + logic column + no shared coordinates, create control (verbatim x/y),
  collision on create, `set` resubmission of a hand arrangement repositions nothing,
  `operations/add_node` gap-fill leaves the arrangement alone, explicit reposition honoured.
  ⚠️ Node ids in these specs are `fx14-`-prefixed on purpose: bare ids like `root`/`title`
  collide with the fixture project and AAQ-011 remaps them project-wide.

### Gate readings (worktree, 2026-08-15)

- `noodl-editor` jest (tests-unit + tests-main): **191 suites / 2949 tests, 0 failed**
  (baseline 190/2932; +1 suite = fix-014, +17 tests).
- `noodl-mcp` jest: **43 suites / 494 tests, 0 failed** (my file adds 8; total went UP, nothing
  vanished).
- **MCP instruction budget:** first draft of the LAYOUT sentence read **8203 > 8200** on
  `toolDisclosure.test.ts` — trimmed ("auto-placed; x/y you set are kept verbatim"), now
  **within budget** with the full surface at 20 tools. `instructions.test.ts` green against the
  updated fixtures.
- Typecheck `noodl-editor tsconfig.json --noEmit`: **0 errors**.
- Typecheck `noodl-editor tsconfig.tests-main.json --noEmit`: 31 errors, **all pre-existing**
  (erg-005 pending file etc.), none in files this task touched.
- Typecheck `noodl-mcp tsc --noEmit`: 7 errors, **all pre-existing** (`.text` on
  `ToolCallResult` in interfaceGate/stagingDiagnostics tests), none in files this task touched.

### Still owed

1. **DRIVE acceptance criterion 1 in the live app, both clients** (Build panel submit and an MCP
   `create_component`), and look at the canvas.
2. `noodl-mcp` **dist/ needs a rebuild** after merge (MCP source changed) and the live servers a
   restart — orchestrator's call, not done from this lane.
3. The jasmine `tests/ai/*` suites (test:ci) were **not run** — forbidden beside live sessions.
   `authoring-candidate.test.ts` was read line-by-line: its assertions are field-scoped
   (children/type/parameters/comments), none pin absent x/y, so no failure is expected there.
4. The nice-to-have "Tidy this component" editor command (L) — not filed here.

---

## 🚗 DRIVE RECORD — session 16, 2026-08-15

**Acceptance criterion 1 is DRIVEN for the Build-panel client.** Criteria 2 and 3, previously
spec-only, were also observed in the live app. The MCP client half remains blocked on a repackage.

Fixture: a copy of `nodegx-qa-fixture` in the session scratchpad, opened over CDP; dev stack on
`NOODL_REMOTE_DEBUG_PORT=9223`; provider `anthropic`, verified. Three real authoring turns.

### The claims were written down before the app was touched

Per the discipline that caught session 15's defect, four falsifiable sentences were pinned in
advance, **including the trap that matters here**: *"a component can satisfy every claim with the
pass doing nothing — the prompt half alone can produce a good canvas."* That is exactly what run 1
turned out to be, and the run would have been scored as a pass for the wrong reason without it.

### Run 1 — a page with a visual tree and three logic nodes

Asked for a group with a title text and a button plus a counter, a string formatter and a
condition, **dictating no coordinates**. The AI authored `/Library/Widgets/Fix014Probe`, 6 nodes,
5 connections, passed validation. Accepted into the project. On the canvas:

| Node | Kind | x | y |
|---|---|---|---|
| Probe container (Group) | visual | 0 | 0 |
| Count display (Text) | visual | 60 | 120 |
| Increment button (Button) | visual | 60 | 240 |
| Formats the count into the title (String Format) | logic | 420 | 120 |
| Click counter (Counter) | logic | 420 | 240 |
| Gate kept true… (Condition) | logic | 420 | 360 |

✅ All four pre-written claims hold: every node has numeric x/y; no two share a coordinate pair;
`min(logic.x) = 420 > max(visual.x) = 60`; the spread is 0→420, so it is **not** one column.
The report symptom is gone.

🔴 **But the pass did not place any of it.** The coordinates match **none** of the pass's constants
(it would emit root `x=40,y=40`, children `x=100`, logic at `maxVisualX + 250 = 310`). They match
the **prompt's** wording instead (~60 indent per depth, ~120 apart, logic right of the visuals).
So run 1 is the **prompt half** working, with the structural pass correctly doing nothing — its
`x`/`y` were model-supplied, and the ruling says those are authoritative.

⚠️ **Instrumenting the pass to prove this directly is not possible over CDP.** Webpack's harmony
exports are non-configurable, so `layoutAuthoredNodes` cannot be wrapped
(`defineProperty` → *"Cannot redefine property"*). The constants **can** be read
(`COLLISION_STEP 40`, `VISUAL_COLUMN_X 40`, `ROW_SPACING 120`, `LOGIC_COLUMN_GUTTER 250`), which is
what made the "these are not the pass's numbers" inference available.

### Runs 2 and 3 — forcing the pass to act, by asking for collisions

Since a well-behaved model never exercises the structural half, the pass was given work it could
not refuse: coordinates it must change.

- **Run 2** — *"a second Counter and a String Format, both at exactly x 900, y 200"*.
  Result on canvas: `(900,200)` and `(900,240)`. Separated by exactly `COLLISION_STEP`.
- **Run 3** — *"a Number, a Boolean and a Counter, ALL THREE at exactly x 1200, y 400"*.
  Result: `(1200,400)`, `(1200,440)`, `(1200,480)` — the step applied **twice, in order**.

✅ **Run 3 is the decisive one.** One 40 could be a model's own choice; two consecutive 40s landing
exactly on the pass's constant is the pass's signature. **Criterion 3 is driven.**

✅ **Criterion 2 is driven as a by-product, and it is the stronger reading of the control:** the six
model-positioned nodes from run 1 kept their exact coordinates through **both** later update passes.
A control that survives two subsequent writes is better evidence than a single-shot spec.

### 🔴 What the drive found: a 40px step does not clear a node

**`COLLISION_STEP = 40` is smaller than a node is tall.** Measured on this canvas, node heights ran
**64 to 190** px. So two nodes separated by the collision rule **no longer share a coordinate — and
still visibly overlap**: the screenshot shows *"Second string format"* drawn over the lower half of
*"Second counter"*, and the run-3 trio stacked like shingles.

The loop is `while (occupied.has(keyOf(n))) n.y += COLLISION_STEP` — it stops as soon as the exact
pair is free, which is what the specs assert. The build record's word for that state is **"until
clear"**, and *clear* is precisely what it is not.

⚠️ **No spec could have caught this.** All 17 assert coordinate *inequality*; none knows a node has
a height, because the pure pass is not given sizes. The defect is only visible on a canvas.

**Recommendation (needs a ruling, not a reflex).** Stepping by `ROW_SPACING` (120) instead of 40
would clear the common case and matches the spacing the prompt already asks for — but it **cannot
guarantee** non-overlap either, because a 190px node still overlaps at 120 and the pure layer has no
access to node sizes. Options are (a) raise the constant and accept "usually clear", (b) pass
measured heights into the pass, or (c) leave it, on the grounds that identical coordinates only
arise from a misbehaving model. **This is a judgement about what the pass promises, so it is
recorded here rather than changed.**

### What this drive does NOT show

- ⚠️ **The MCP client is untouched** — criterion 1 says *both clients*, and the MCP half is still
  blocked on a `dist/` repackage. **Criterion 1 is half-driven, and the task is not closed.**
- ⚠️ The gap-filling branch (a model that omits `x`/`y` entirely) was **never exercised** — the model
  supplied coordinates on all three turns. The collision branch is what ran.

---

## 🚗 DRIVE RECORD — session 18, 2026-08-15 (the MCP half)

**Acceptance criterion 1's remaining half is DRIVEN.** The `noodl-mcp` client applies the layout
pass through a real MCP stdio session, and **the gap-filling branch — never exercised by session
16's drive — ran here.** All four claims were written down before the server was started
(`scratchpad/CLAIMS.md`).

### 🔴 The repackage was NOT the blocker it was recorded as

Two different artefacts were being conflated under "the `dist/` repackage":

| Artefact | Built | Has the pass (`grep -c COLLISION_STEP`) |
|---|---|---|
| `packages/noodl-mcp/dist/noodl-mcp.cjs` | 2026-08-15 09:56 | **2** |
| `/Applications/NodeGX.app/Contents/Resources/noodl-mcp/noodl-mcp.cjs` | 2026-08-13 19:19 | **0** |

The repo `dist/` was already rebuilt (after `7240b99f`, 09:29). What is stale is the **installed
app**, and the registered `nodegx-puppy-test-3` server runs *that* copy — which is why every
attempt to drive this through the session's own MCP tools would have measured a build without the
feature. **Driving the built `dist/` directly needs no repackage and no session restart.**

### Method

`node packages/noodl-mcp/dist/noodl-mcp.cjs <project> --allow-writes` spawned under **plain node**
(deliberately: plain node matches no `findDevProcesses` `DEV_TOOL` pattern, so this is safe beside
a peer — an Electron-launched server would have matched `electron/dist`), driven over
newline-delimited JSON-RPC: `initialize` → `notifications/initialized` → `tools/list` (20 tools)
→ `tools/call`. Project: a copy of `packages/noodl-mcp/tests/fixtures/demo-app` in the session
scratchpad. Assertions read `nodes.json` **on disk**, by node id.

### The results

**C2 + C3 — `Library/Fix014McpCollide`**, one node placed by hand and three submitted at an
identical coordinate:

| id | type | submitted | on disk |
|---|---|---|---|
| `fx14c-root` | Group | 900, 50 | **900, 50** — verbatim ✅ |
| `fx14c-a` | Number | 1200, 400 | **1200, 400** |
| `fx14c-b` | Counter | 1200, 400 | **1200, 440** |
| `fx14c-c` | String Format | 1200, 400 | **1200, 480** |

✅ Two consecutive `COLLISION_STEP`s, in submission order — the pass's signature, not a coincidence.

**C1 + C4 — `Library/Fix014McpGap`**, submitted with **no `x`/`y` on any node**:

| id | type | on disk | why that number |
|---|---|---|---|
| `fx14g-root` | Group | **40, 40** | `VISUAL_COLUMN_X` / `VISUAL_COLUMN_TOP` |
| `fx14g-text` | Text (child) | **100, 160** | `40 + 1×HIERARCHY_INDENT_X`; `40 + ROW_SPACING` |
| `fx14g-counter` | Counter (logic) | **350, 160** | `maxVisualX(100) + LOGIC_COLUMN_GUTTER(250)`; anchored to the `y` of the node it feeds |

✅ Every coordinate is a pass constant. **This is stronger evidence than session 16's run 1**, where
the model supplied coordinates and the numbers matched the *prompt's* wording rather than the
pass's: here there is no model in the loop at all, so nothing but the pass could have written them.

### The trap-guards fired, which is why the readings are trusted

- The first gap-fill attempt was **rejected** (`Counter` has no output `count`) and
  `Fix014McpGap/nodes.json` **did not exist afterwards** — the "silent write failure, stale read"
  trap was real and the guard caught it. The corrected call created the file at a fresh mtime.
- `Library/` did not exist in the fixture before the run, so no fixture coordinate could be
  mistaken for the pass's output.
- An earlier call also surfaced a **schema detail worth keeping**: `create_component` connections
  are `fromProperty`/`toProperty`, **not** `fromPort`/`toPort`.

### 🔴 What this drive does NOT show

- **The installed `/Applications/NodeGX.app` still does not have the pass.** Every registered MCP
  server in every live Claude session loads that copy. The repackage is still owed — but it is now
  a *deployment* debt, not a blocker on this criterion. Restarting the servers needs Richard.
- Nothing here re-opens `COLLISION_STEP`: 40 is still shorter than a node is tall (see the session
  16 record above). The three colliders would still visibly overlap on a canvas. **Ruling still owed.**

---

## ⚖️ RULING 2026-08-15 (session 18) — `COLLISION_STEP` is raised to `ROW_SPACING`

Richard ruled option (a): **raise the constant and accept "usually clear"**, over passing measured
heights in or leaving it at 40.

```ts
export const COLLISION_STEP_FLOOR = 120;
export const COLLISION_STEP = Math.max(ROW_SPACING, COLLISION_STEP_FLOOR);
```

**And the wording is corrected with it, which was half the defect.** The module header said later
colliders "are stepped clear" and the code comment said "step down until clear" — *clear* is exactly
what they were not. Both now state the real promise: **the pass breaks an exact coordinate tie; it
does not guarantee non-overlap, because it is never given node sizes.** A 190px node still overlaps
at 120 and the module says so.

### 🔴 Why there is a floor rather than a bare `= ROW_SPACING`

Raised in review by a peer, and it is the kind that brings a fixed bug back. The two constants have
**different jobs** — `ROW_SPACING` is layout *rhythm*, `COLLISION_STEP` is *clearance* — and are
equal today only by coincidence of value. Someone tightening rows for density (120 → 100 is a
plausible visual tweak) would silently cut clearance and re-open this defect, and **every existing
spec would stay green**, because all of them assert `y + COLLISION_STEP` symbolically. Nothing in
the suite named the relationship. Two specs now do.

### Verification of the ruling — driven, not just specced

Re-driven through a **rebuilt** `dist/` over MCP stdio, three nodes submitted at an identical
`(1200, 400)`:

| id | submitted | before the ruling | after |
|---|---|---|---|
| `fx14r-root` (control) | 900, 50 | 900, 50 | **900, 50** |
| `fx14r-a` | 1200, 400 | 1200, 400 | **1200, 400** |
| `fx14r-b` | 1200, 400 | 1200, 440 | **1200, 520** |
| `fx14r-c` | 1200, 400 | 1200, 480 | **1200, 640** |

Two consecutive 120s, control untouched.

### Gate readings — session 18, 2026-08-15

| Gate | Reading | When |
|---|---|---|
| **`test:ci` (jasmine)** | ✅ **at the floor — 6 by NAME**: 4 × `AIX-006 style vocabulary`, 2 × `AI model registry`. `totalCount` **2843**, `seed` **39393**, `test-results.json` mtime **19:51** (deleted 19:41, so the file proves the run) | 19:51 |
| editor `tsc --noEmit` | ✅ 0 errors | 19:54 |
| `fix-014` editor specs | ✅ **19/19** (17 + the 2 new floor specs) | 19:53 |
| `noodl-mcp` `authoredLayout` | ✅ 6/6 | 19:53 |
| editor plain-node jest (full) | ✅ **203 suites / 3138, 0 failed** | 19:36 |
| `noodl-mcp` jest (full) | ✅ **44 suites / 506, 0 failed** | 19:37 |

⚠️ **Two honest limits on the `test:ci` reading, both recorded rather than glossed:**

1. `test:ci` webpacks the **working tree**, not `HEAD`. It graded `d061bc6e` plus two dirty source
   files: this task's `layout.ts`, and `scripts/library/check.ts`, which belongs to nobody who
   answered. The latter was **screened, not waved off** — nothing under `packages/noodl-editor/tests/`
   or `src/` imports it (the only `scripts/library` mention in source is a comment at
   `starterAssets.ts:68`), so it cannot have influenced the result.
2. 🔴 **The `COLLISION_STEP_FLOOR` refactor landed AFTER that run.** The computed value is identical
   (`Math.max(120, 120)` = the 120 the suite graded), so the bundle's behaviour is unchanged — but
   the jasmine gate has not seen that exact source text, and saying otherwise would be the
   "gate covered it" claim this phase keeps catching. The editor and MCP specs above did run against it.
