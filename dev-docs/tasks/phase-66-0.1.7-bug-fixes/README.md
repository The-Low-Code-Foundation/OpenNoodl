# Phase 66 — 0.1.7 bug fixes, toward the 0.1.8 alpha (Track FIX)

**Created:** 2026-08-14, from Richard's 16-item user-test report
([user-test-bug-report.md](user-test-bug-report.md), screenshots `workbench-1.png`,
`new-port-1.png`), researched by ten parallel read-only lanes the same day. **Every mechanism
claim below was read in source at file:line on `cline-dev` (HEAD includes `3f633df4`).**

## The premise, in one sentence

This is the first bug list filed by *using* 0.1.7 as a builder rather than building 0.1.7 — and
the research found that most of it is not missing features but **built machinery that the user
cannot reach**: live port values the Explain panel never asks for, a Signal option hidden in a
nested row, a token system with no editing UI in any shipped build, a `.mcp.json` writer that only
runs on create, markdown rendering that one panel has and its neighbours abandoned.

## Report → task map

| Report | Task(s) | One line |
|---|---|---|
| 1 a–c | [FIX-001](FIX-001-THE-EXPLAINER-CANNOT-SEE-THE-APP.md) | explain sees live values, warnings, walks; inside components |
| 1 d | [FIX-002](FIX-002-THE-COMPOSER-YOU-CANNOT-TYPE-IN.md) | multiline composer; one send key everywhere |
| 1bis | [FIX-003](FIX-003-TEXT-YOU-CANNOT-SELECT-OR-CLICK.md) | selectable, clickable AI text app-wide |
| 2 | [FIX-004](FIX-004-THE-BLOCKS-THAT-ARE-MISSING.md) | conversion + log blocks; free toolbox adds; objects-as-data |
| 3 | [FIX-005](FIX-005-THE-DROPDOWN-YOU-CANNOT-READ.md) | dropdown contrast; the category-name ruling |
| 4 a–b | [FIX-006](FIX-006-THE-AI-WRITES-CODE-FROM-2019.md) | node-choice + code-style briefs; Script validator |
| 4 c | [FIX-007](FIX-007-THE-CONNECTOR-THE-AI-CANNOT-DRAW.md) | the `in-`/`out-` prefix; the write-path port gate |
| 5 | [FIX-008](FIX-008-THE-SERVER-BOUND-TO-THE-WRONG-PROJECT.md) | idempotent Connect; `.mcp.json` backfill; project scope |
| 6 | [FIX-009](FIX-009-ONE-WIDTH-FOR-THE-SELECTION-SLOT.md) | components + properties share one width — ✅ **CLOSED** |
| 7 | [FIX-010](FIX-010-THE-PICKER-SCROLLS-AWAY-FROM-ITS-ANSWER.md) | search results start at the top |
| 8 a | [FIX-011](FIX-011-THE-BENCH-FRAME-HAS-NO-HEIGHT.md) | bench height, resize, per-component default |
| 8 b | [FIX-012](FIX-012-NO-WAY-BACK-TO-NO-SCENARIO.md) | a None row; Reset all clears the chip — ✅ **CLOSED** |
| 8 c | [FIX-013](FIX-013-THE-DATA-MODE-TEARDOWN.md) | remove the Data/sample/real-backend maze |
| 9 | [FIX-014](FIX-014-THE-AI-PILES-NODES-IN-ONE-COLUMN.md) | logic gets its own column |
| 10 | [FIX-015](FIX-015-THE-TOKENS-NOBODY-CAN-EDIT.md) | the style-token resurrection → its own phase |
| 11 | [FIX-016](FIX-016-THE-SIGNAL-OUTPUT-HIDDEN-IN-A-NESTED-ROW.md) | Signal at add time; the mismatch diagnostic |
| 12 | [FIX-017](FIX-017-THE-EDITOR-SHOWS-WHAT-YOU-CAN-TYPE.md) | completions at an empty position; API level 2 |
| 13 | [FIX-018](FIX-018-A-COMPONENT-SAYS-IT-CAN-BE-ENTERED.md) | component distinction — **mockups delivered** |
| 14 | [FIX-019](FIX-019-THE-WORKBENCH-SAYS-WHERE-YOU-ARE.md) | "Show in workbench"; divergence chip + jump back |
| 15 | [FIX-020](FIX-020-THE-POPUP-THAT-CLIPS-ITS-BUTTONS.md) | the duplicated `.string-input-popup` stylesheet |
| 16 | [FIX-021](FIX-021-THE-PROJECT-THAT-KNOWS-ITS-BUILDER.md) | project + global memory docs — brainstorm + slices |

## 🔴 Report premises the research found FALSE or already-built — verify before "fixing"

This register's most expensive repeated mistake is building against an unchecked premise. Five of
the sixteen reports contain one:

1. **Report 11:** `Signal` **is** already an output type on the Function node's panel — the
   defect is discoverability (a nested Type row created after the port), not absence. (FIX-016)
2. **Report 1b:** multi-node explain **is built** (marquee → subgraph scope, pluralised menu
   label). Reproduce before building; likely a discoverability fix. (FIX-001)
3. **Report 3's rename** reverses a phase-64 ruling: VFN-012 renamed `App Variables` →
   `Runtime Variables` *deliberately*, so `App Config` (`Noodl.Config`) could exist without two
   shelves reading alike. Needs a naming decision, not a commit. (FIX-005)
4. **Report 12's premise "no autocomplete"** understates the tree: phase 61 is **8 of 9 built**
   (its TASKS.md is four tasks stale — reconcile it first or someone rebuilds FUN-004/006/008).
   The real gaps: nothing at an empty position, API one level deep, no browse affordance. (FIX-017)
5. **Report 10:** the token system is not dead — it shipped and is **live in the AI write path**;
   what never shipped is any human UI (the panel is gated on `config.devMode`, set in no build,
   ever). The rescope is inversion, not resurrection. (FIX-015)

## Pinned mechanisms worth carrying in your head

| Finding | Where |
|---|---|
| Function-node ports are `in-<name>` / `out-<name>`; the catalog docs told the AI the opposite — ✅ **fixed, and the AI now writes the prefix unprompted** (driven 2026-08-14) | FIX-007 |
| 🔴 ~~The manual drag validates ports (`getConnectionStatus`); no AI/MCP write path ever consults ports at all~~ — **FALSE, struck 2026-08-14.** `getConnectionStatus` never checked port *existence*, and `rules/nonexistentPort` errors for every static node type on both write doors | FIX-007 |
| The Explain panel is static-by-construction, while `TraceSession.resolvePortValues` + `walkEngine.backwardWalk` sit one import away | FIX-001 |
| The Explain composer's `TextInput` grows to full text width inside `overflow-x: hidden` — backspace works, invisibly | FIX-002 |
| `div { user-select: none }` (style.css:205) makes every AI surface unselectable; the Build panel **regressed** phase-38's markdown decision (AiChatMessage does it right and is mounted nowhere) | FIX-003 |
| Core Blockly ships **no type-conversion block at all**; `text_print` = `window.alert`; `console` works in both runtimes, so a log block needs no runtime change; **statement blocks must join `HATTABLE_BLOCK_TYPES`** | FIX-004 |
| Dropdown selected row measures **2.33:1** (dark); Blockly's `blocklyMenuItemHighlight` class is unstyled; our padding destroys the 28px checkmark gutter | FIX-005 |
| Script node: no `run` signal, no static outputs; top-level code runs **once at parse** — Function-shaped code in a Script ran once at import, forever, while still minting ports | FIX-006 |
| `nodegx-puppy-test-3` is registered at **user scope** and visible in every folder; 43 of 44 projects have no `.mcp.json`; "already connected" is `claude mcp add` refusing a duplicate, rendered as failure | FIX-008 |
| The bench frame has **no height anywhere in its type chain**; 150px is the `<webview>` UA default leaking through `margin: auto` cancelling `align-items: stretch` | FIX-011 |
| The scenario none-state exists in the model and no UI reaches it; **Reset all leaves the chip lying** | FIX-012 |
| The Data screenshot is the degenerate case: zero collections, yet `hasDataset = Boolean(dataset)` on an empty dataset still offers the button | FIX-013 |
| The only layout instruction in the product is one sentence that *specifies* a single column | FIX-014 |
| The only component-instance cue is an 18px grey diamond that **disappears when the node has a warning** | FIX-018 |
| Two stylesheets both style `.string-input-popup*` (the only duplicated family); per-property cascade leaves `height: 20px` under `padding: 8px` | FIX-020 |
| Every project already has a CLAUDE.md — a test-enforced signpost nothing reads back; launcher-scoped projects get a **degraded** one (no summary, no docs pointer) | FIX-021 |

## The rulings queue — decisions Richard owes this phase, grouped for one sitting

**Product-shaping (need discussion):**
- FIX-015 — the eight style-token rulings (schema, editing home, derive-vs-set, **shadows**,
  hover, logic-node outputs, import mapping, legacy endgame). *The biggest sitting; likely its own
  session, output = a new phase.*
- FIX-021 — the six memory-doc rulings (who writes, taxonomy, CLAUDE.md's role, privacy scope,
  always-vs-pull, structured-vs-prose).
- ~~FIX-018 — pick a mockup option~~ ✅ **RULED 2026-08-14: option C, chip + stacked card**
  ("awesome, validated"); purple default = plumbing keeps it, glyph disambiguates.
- FIX-013 — what a data-reading component shows on the bench (recommend: shim serves zero rows);
  does the AI preview keep its toolbar.
- FIX-005 — the category name (A keep / B Global Variables + App Settings / C revert VFN-012).

**Small, unblock-a-task (batchable):** ✅ **seven cleared in one sitting, 2026-08-14 (session 5).**
- ~~FIX-002 — the send key~~ ✅ **RULED: Enter = send, Shift+Enter = newline, both composers.**
  ⚠️ This changes **`TextArea`**, not Explain — re-drive BLD-010, and grep every `TextArea` consumer.
- ~~FIX-003 — global `user-select` inversion now or later~~ ✅ **RULED: invert the global rule NOW**
  — *against* the written recommendation of opt-in-now. 🔴 The deferred **drag-surface test plan is
  therefore in scope here**: canvas, panel trees, list rows, node picker, sidebar divider.
- FIX-004 — conversion block shape; log level; Msg keys.
- FIX-006 — demote Script from the AI-authorable set? prefer Visual Function?
- ~~FIX-009 — does `PortEditor` join the width group~~ ✅ **RULED: yes**, three-panel group only;
  Docs/Search keep their own widths (that is criterion 4's control).
- ~~FIX-011 — per-component bench size persists to metadata?~~ ✅ **RULED: yes, behind the explicit
  "Set as default size" gesture** (a knowing second R5 exception); default height = **fill the stage**.
- ~~FIX-012 — None = clear to defaults~~ ✅ **RULED: yes**, and None resets the frame too; Delete
  keeps its values (the asymmetry is intended).
- ~~FIX-014 — is model-supplied x/y authoritative~~ ✅ **RULED: authoritative** — the pass fills gaps
  and resolves collisions only, and `update_component` repositions nothing unasked.
- FIX-016 — signal-input semantics, or rule them out.
- ~~FIX-019 — jump-back direction; assertive vs passive chip~~ ✅ **RULED: back-to-benched, assertive
  chip** (appears only on divergence). 🟡 *Not* ruled: whether the surface is called "the workbench"
  **everywhere** or only in that menu item — 14(a)'s vocabulary sweep still needs a word.
- ~~FIX-008 — backfill-on-open posture~~ ✅ **ruled 2026-08-14: silent backfill on open** (A+B+E
  built and driven). Still open: **stale-registration cleanup**, and whether fix C's two-servers-in-
  one-session state is better or worse for the model.

## Standing constraints inherited — unchanged, do not relearn

- Work on `cline-dev`. **Never `git stash`**; `cd` to the repo root in every git call; commit with
  explicit pathspecs; check no sibling session is live before running suites.
- Gates — 🔴 **these numbers were TWO baselines out of date under a "do not relearn" heading, which
  is the worst place for a stale figure: it instructs the reader to trust it.** Corrected 2026-08-16
  (s26): `test:ci` floor is **2843 passed / 6 failed at seed `NOODL_SPEC_SEED=39393`**, tree
  `d0891746`, reproduced twice four hours apart — compare **names**, never the count (4 ×
  `AIX-006 style vocabulary`, 2 × `AI model registry`). `test:main` is **205 suites / 3157**
  (08-16; 203 / 3140 before CN-001/CN-002 landed). ⚠️ *Was* recorded here as `6 / 2670 @ 39386` and
  `144 / 2107`; the long-quoted `3136` **does not reproduce** either. Read
  `tests/test-results.json` not the log, and **check its mtime** — a stale one reads as a perfect
  pass. `npx tsc -p tsconfig.json --noEmit`
  (**never** without `--noEmit`); `cloud-library:check` is a required PR gate; run the MCP suite
  after any catalog change (FIX-007 changes the catalog).
- 🔴 **RETRACTED 2026-08-16 (s26): "`dev:stop` kills Richard's MCP servers — kill the
  `scripts/start.ts` pid instead" is NOT the safe route, and it reads as the careful one.**
  `scripts/start.ts:74` spawns `dev-watchdog.js`, which on launcher death calls
  `sweep({ protectAncestors: false })` (`dev-watchdog.js:44`) — **the same checkout-wide sweep, with
  a protection `dev:stop` leaves ON.** By-pid does spare the MCP servers; it does **not** spare a
  peer's suite. A teardown that comes out clean is clean because of the shields (`2b758a87` +
  `4fd2cfdb`), not the command. ✅ **Announce the teardown — that is what actually protects people.**
- Blockly React-side registration goes in `BlocklyWorkspace.tsx`, never `initialize.ts` —
  but plain-Blockly blocks/generators (FIX-004) belong in `NoodlBlocks.ts`/`NoodlGenerators.ts`,
  which `initialize.ts` reaches safely.
- Drive on `NOODL_REMOTE_DEBUG_PORT=9333`; check `lsof -i:9222` for a stray Chrome; occluded
  Electron clamps timers and fires zero ResizeObserver events.
- Built ≠ spec-proved ≠ driven. Every task file's acceptance criteria say which is required.

## What is deliberately not in this phase

- **The style-token build** (FIX-015 delivers rulings + a new phase, not code).
- **Async blocks / fetch in the Visual Function** — named in FIX-004 as its own future task; it
  changes the compiler and touches probes, Do It, and the bench.
- **FUN-005, the code-editor ports rail** — stays phase 61's.
- **The "import a record as dummy data" bench idea** — follows FIX-013, separately.
- **A "Tidy this component" canvas command** — noted in FIX-014 as the layout pass's second
  consumer, not scheduled.
