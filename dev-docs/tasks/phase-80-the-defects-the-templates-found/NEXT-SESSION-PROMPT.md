# Phase 80 — next session

## State: DEF-001–004, 006, 008, 010, 011, 014–018, **020**, 021–023, 026 closed. DEF-007 🟡 (§3.2). DEF-009 🟡 (AC4). DEF-012 🟡 (§2 finding only). DEF-025 🟡 (door half built; flip 🧭). **Open: DEF-019, DEF-024.**

**s19 (2026-08-30)** closed the layout pair DEF-018 + DEF-020 (`11a6bf4c`), both re-driven at
HEAD first — **neither claim narrowed; both rows held exactly as recorded** (a first since the
re-drive rule started paying):

- **One module, two codes** — `layoutInertCombination.ts` (editor validation, both doors via
  `authoredPreconditionDiagnostics`): `columns-child-keeps-own-width` (per child — a
  contentSize/contentWidth child of a Columns ignores its box; resolved against catalog defaults,
  a BARE button fires, its type default is contentSize) and
  `justify-content-distributes-nothing` (per row — ≥2 growers under a distributing
  justifyContent; exactly-one-grower rows silent by design). The candidate grouping in TASKS.md
  ("both the layout system doing nothing and saying nothing") was read against the source and is
  real; filed as two codes because the repairs differ. `gridAutoFit`'s description carries D28's
  "cheapest honest fix" sentence.
- 🔴 **The calibration found the D32 predicate's one WRONG shape** (not noise — wrong): a
  **maxWidth-capped grower leaves real free space and there justifyContent WORKS**. 10 of 43
  corpus firings were that shape; a child with authored/wired maxWidth is now unknowable-not-
  growing, with its own spec arm and mutant.
- **Corpus** (`npm run calibrate:layout`, 178 projects, denominators printed): D28 13/562
  children (all authored, 0 from type default), D32 33/317 distributing rows. Sampled true from
  disk, incl. the reference build's own footer and sonnet's Basket ("Subtotal"/"£33.50" split
  even). Both **advisory**, non-promotion pinned in the spec; the promotion case (phase55 replay
  firings are all agent-authored) is recorded in the module header.
- **Mutants: 9 killed, 1 survivor by EQUIVALENCE** — recorded as a comment at the site (D32
  row-level default-resolution; no catalog default makes a row or distributes), not faked.

## What to do next

- **DEF-019** (P78 D30 — type ramp cannot reach `font-variant-numeric`; every column of numbers).
  Read D30 in P78's register first; it names the one shared port group every Text reads.
- **DEF-024** (P78 D36 — Condition only turns gates ON) — closest to a design ruling; do it last
  or take it to Richard with options.
- **DEF-012 §2 leftover** — door-side precondition (DEF-002 family) on cloud queries with
  connected filter params and run-on-change boxes on. SB-011 §5.
- **DEF-007 §3.2** — still sequenced behind phase 77's active file.
- **🧭 Richard queue**: DEF-025 flip (3 options in TASKS.md s17) · DEF-009 AC4 (rateLimit
  default) · DEF-005, DEF-013 rulings (re-drive SB-012 §1 at HEAD before spending DEF-013's).

## Traps carried

- ⚠️ **dist staleness now covers DEF-018/020 too**: a *running* MCP server (noodl-mcp/dist, the
  installed app's) validates without the two new codes until rebuilt — same standing note as
  021/022/023/026 (+ the editor's `cloudruntime/sandbox.viewer.bundle.js`). Owner: whoever cuts
  the next 0.2.1 build.
- ⚠️ **TASKS.md is now COMMITTED** (`11a6bf4c`) — the P77 peer committed their `domelement` row
  themselves at `eac2544d`, so s18's carried "uncommitted on purpose" resolved. Still
  `git log -5 -- <path>` before touching shared registers; peers were committing mid-session
  (P77 `5b196e5a` 11:20, P18 `bfa1fb34` 11:09).
- ⚠️ **Editor jest floor: 6433/6435** — the 2 are the peer's sb-007 template-count arms
  (their `ab17845d`/`10b26d57` lane; same two as s17). `site-builder.content.json` sat modified
  in the tree all session — theirs, untouched.
- 🔴 **`git checkout -- <file>` is not a mutant undo** — python string-swap restores only.
- ⚠️ **`grep` refused `HttpServer.ts` as binary (s18)** — `-a` on any grep over
  `nodegx-backend/src/server/`.

## Gates (s19, all fresh, commit `11a6bf4c`)

editor jest **6433/6435** (2 = peer's sb-007) · tests-unit 24/24 · noodl-mcp **985/985** ·
`catalog:examples` **62/62 strict** (the new warnings fire on no shipped recipe) ·
`typecheck:editor`/`:editor-tests`/`:mcp` clean · **`test:ci` 2905 specs / 4 failures, all
AIX-006 BY NAME, seed 03427, fresh readout** — the canonical floor (its `gitHead 5b196e5a` is the
P77 peer's 11:20 mid-window commit; read-time fact).
