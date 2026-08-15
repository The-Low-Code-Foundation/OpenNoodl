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
