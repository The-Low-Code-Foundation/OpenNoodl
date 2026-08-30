# Phase 80 — next session

## State: DEF-001–004, 006, 008, 010, 011, 014–023, 026 closed. DEF-007 🟡 (§3.2). DEF-009 🟡 (AC4). DEF-012 🟡 (§2 finding only). DEF-025 🟡 (door half built; flip 🧭). **Open: DEF-024 only.**

**s20 (2026-08-30)** closed DEF-019 (`f14a1faa`), re-driven at HEAD first — and the re-drive
**sharpened the claim rather than the fix**: the rag is not a corner case, it is the default in
every new project, because **the shipped Inter itself** (v3.019, the file `starterAssets.ts`
copies into `noodl_modules/inter/`) has proportional default figures (`1` = 1308/2048 em, `8` =
1736) *and* a `tnum` feature nothing could switch on.

- **The tenth text-style port**: `fontVariantNumeric` ('Numerals', enum Normal/`tabular-nums`,
  `targetStyleProperty` straight through), added in **three places in
  `node-shared-port-definitions.ts`** — the port block, the `textStyle` picker's `childPorts`,
  and the `addLabelInputs` dynamic list (five `useLabel` controls) — plus `nodegx-export`'s
  `PASSTHROUGH`. The `fontStyle` commit (`14815f1e`) was the recipe: same three places + catalog
  regen, and reading that commit first was the whole consumer map.
- **Driven in real Chrome against the shipped TTF through the real door**
  (`noodl-mcp/tests/def019-numerals-drive.test.ts`): without the port `1111` = 59.47px vs
  `8888` = 78.92px — **19.45px of rag on four digits**; with `tabular-nums`, both exactly
  82.921875px. The control arm doubles as the font-load check: every likely fallback font has
  equal-width digits, so a failed load reddens the CONTROL, never greens the arm. Font loaded
  via the product's own `FontLoader` path (`fontFamily: 'fonts/Inter-Regular.ttf'`).
- **4 mutants** (port key · childPorts entry · label-list entry · PASSTHROUGH entry), each
  killed by exactly its arm; python string-swap + md5 parity, no `git checkout --`.
- **Two census gates moved by exactly the understood amount** and were re-pinned WITH the
  reason: `fb-021/portGateReason` 349→354 gated / 338→343 explained (= `labelfontVariantNumeric`
  × five `useLabel` controls, all explained); `fb-022/scrubPolicy` 40→41 rejected (an enum
  offers nothing to drag-scrub). A census red that moves by the exact predicted delta is the
  change arriving, not a regression — s11's rule, paid forwards.
- **The external viewer bundle was REBUILT** (prod config, 14.4MB dev → 1.5MB, now carries the
  port) — the drive needed the runtime, not just the door. `noodl.viewer.js` is gitignored;
  grep it for `fontVariantNumeric` before believing any render measurement of this feature.

## What to do next

- **DEF-024** (P78 D36 — a `Condition` can only turn a gate ON, so a screen accumulates
  contradictory answers) — **the last open row**, and closest to a design ruling. Read D36 in
  P78's register first (s15 section: the `missingClear` constant-`false` workaround shape).
  Options for Richard if it turns out to be a ruling: do it last or take it with the 🧭 queue.
- **DEF-012 §2 leftover** — door-side precondition (DEF-002 family) on cloud queries with
  connected filter params and run-on-change boxes on. SB-011 §5.
- **DEF-007 §3.2** — still sequenced behind phase 77's active file.
- **🧭 Richard queue**: DEF-025 flip (3 options in TASKS.md s17) · DEF-009 AC4 (rateLimit
  default) · DEF-005, DEF-013 rulings (re-drive SB-012 §1 at HEAD before spending DEF-013's).

## Traps carried

- ⚠️ **dist staleness now covers DEF-019 too** — a *running* MCP server (noodl-mcp/dist, the
  installed app's) answers `get_node_type` without the Numerals port until rebuilt; same
  standing note as 018/020/021/022/023/026. **The editor's external viewer bundle is NOW
  FRESH** (rebuilt this session, prod) — but the editor's `cloudruntime/sandbox.viewer.bundle.js`
  half of the note stands.
- ⚠️ **Editor jest floor: 6431/6435, all 4 reds peers'**: sb-007 ×2 (template-count lane, same
  as s17/s19) + **sb-018 ×2 NEW** — the P77 peer's drag-gesture commits (`102c614e`/`12cc718a`,
  landed after s19's gate run) added `DropAt`/`DropIndex` row signals their own sb-018 pin
  doesn't list. Their lane; do not re-pin it for them.
- ⚠️ **The P18 peer was committing mid-session again** (`plan.ts` modified in-tree at 11:54,
  committed by ~12:15; exporter suite red 1147/1148 during their window, **1153/1153 after
  their commit**). A suite run beside a peer's live edit grades a dirty tree — re-run before
  attributing.
- 🔴 **`git checkout -- <file>` is not a mutant undo** — python string-swap restores only.
- ⚠️ **`grep` refused `HttpServer.ts` as binary (s18)** — `-a` on any grep over
  `nodegx-backend/src/server/`.

## Gates (s20, all fresh, commit `f14a1faa`)

viewer-react **1095/1095** · noodl-mcp **990/990** · nodegx-export **1153/1153** (post peer
commit) · editor jest **6431/6435** (4 = peers', named above) · `catalog:examples` **62/62
strict** · catalog generate/check/merge/merge:check/groups:check clean ·
`typecheck:editor`/`:editor-tests`/`:mcp` clean · **`test:ci` 2905 specs / 4 failures, all
AIX-006 BY NAME, seed 29648, fresh readout** — the canonical floor (its `gitHead 0ec82518` is a
mid-window commit; read-time fact, at-the-floor tolerates it).
