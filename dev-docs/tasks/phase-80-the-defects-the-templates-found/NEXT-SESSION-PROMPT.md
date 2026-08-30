# Phase 80 — next session

## State: DEF-001–004, 006, 008, 010, 011, 014–017, 021, **022**, 023, 026 closed. DEF-007 🟡 (§3.2). DEF-009 🟡 (AC4). DEF-012 🟡 (§2 finding only). DEF-025 🟡 (door half built; flip 🧭). **Open: DEF-018, 019, 020, 024.**

**s18 (2026-08-30)** closed DEF-022 (`ae890a71`), reproduced/measured at HEAD first:

- **DEF-022 (`ae890a71`)** — the Request node has an **`Origin` output**; `requestOrigin.ts` holds
  the one derivation (caller's `Origin` when it is a usable web origin — a browser POST always
  carries the page's own address, the thing TPL-002 had to be told from outside — else
  forwarded-host/host + sanitised proto, else honestly blank for a workflow step). Trust boundary
  on the port description: caller-supplied, right for links back to whoever called, NOT for a
  reset link a third party clicks — that stays `effectiveBaseUrl`'s job.
  🔴 **The re-drive narrowed the CLAIM, not the fix** (14th payment, new direction): D34's
  *"nothing exposes it to a graph"* was too strong — an Object node with Id `Request` reads the
  raw `Headers` bag today, probed through the real runner. Register corrected in place, not
  silently. Two mutant survivors were both verdicts about the code: a dead `=== 'null'` clause
  (removed) and a stale-origin mutant that cannot fire (fresh instance per request — DEF-023's
  construction).
- **Registered `NONE` (TASKS.md findings section): DEF-022's broader half** — the operator-
  configured site address (`effectiveBaseUrl`) is unreachable from a graph; a workflow with no
  request and a third-party-clickable link both need it. D34's `Site Address` node shape stands
  (the `Secret` seam: process global + cloud-only node).

## What to do next

- **DEF-020/DEF-018** (the layout pair — both door-warning shaped; read them against each other
  in P78's register before building either), **DEF-019** (type ramp cannot reach
  `font-variant-numeric`).
- **DEF-024** (Condition only turns gates ON — closest to a design ruling, do it last or take it
  to Richard).
- **DEF-012 §2 leftover** — door-side precondition (DEF-002 family) on cloud queries with
  connected filter params and run-on-change boxes on. SB-011 §5.
- **DEF-007 §3.2** — still sequenced behind phase 77's active file.
- **🧭 Richard queue**: DEF-025 flip (3 options in TASKS.md s17) · DEF-009 AC4 (rateLimit
  default) · DEF-005, DEF-013 rulings (re-drive SB-012 §1 at HEAD before spending DEF-013's).

## Traps carried

- 🔴 **`TASKS.md` is UNCOMMITTED ON PURPOSE** — it carries s18's DEF-022 row/section beside a
  P77 peer's new uncommitted `domelement` register row (their 10:57 edit; their D23 close
  committed at `eac2544d` mid-session but NOT this file). A pathspec commit would sweep their
  edit. The peer is still moving in P77 (s29) — `git log -5 -- <path>` before touching anything
  shared.
- ⚠️ **dist staleness now covers DEF-021/022/023/026**: noodl-mcp/dist, nodegx-backend
  `dist/cli.js`, the committed viewer bundles AND the editor's `cloudruntime/sandbox.viewer.bundle.js`
  (no `Origin` port on the canvas until rebuilt) all predate the fixes. Owner: whoever cuts the
  next 0.2.1 build.
- 🔴 **`git checkout -- <file>` is not a mutant undo** (s17 paid it) — python string-swap
  restores only; assert the anchor before mutating.
- ⚠️ **`grep` refused `HttpServer.ts` as binary this session** — `-a` on any grep over
  `nodegx-backend/src/server/` (the filed six-ways trap, live again).
- ⚠️ **MEMORY.md over budget** — the overage sits in ACTIVE peers' lane lines, theirs to judge.

## Gates (s18, all fresh, commit `ae890a71`)

noodl-viewer-cloud **219/219** (204 + 15 DEF-022) + `tsc --noEmit` clean · noodl-mcp **971/971** ·
backend consumer suites 22/22 (`--runInBand`) · `catalog:check` + `catalog:merge:check` clean ·
**`test:ci` 2905 specs / 4 failures, all AIX-006 BY NAME, seed 75285, fresh readout** — the
canonical floor (its `gitHead eac2544d` is the peer's mid-window commit; read-time fact).
Mutants: M1×6-arm kill, M2×7, M4′×3; two survivors both taught code facts (dead clause removed;
held-by-construction pinned).
