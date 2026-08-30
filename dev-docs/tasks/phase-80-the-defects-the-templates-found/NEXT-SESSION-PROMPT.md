# Phase 80 — next session

## State: DEF-001–004, 006, 008, 010, 011, 014–017, 021, 023, **026** closed. DEF-007 🟡 (§3.2). DEF-009 🟡 (AC4). DEF-012 🟡 (§2 finding only). DEF-025 🟡 (door half built; flip 🧭). **Open: DEF-018, 019, 020, 022, 024.**

**s17 (2026-08-30)** closed DEF-026 and built DEF-025's door half, both reproduced/measured at
HEAD first:

- **DEF-026 (`263bf183`)** — the refusal was lost to a **TypeError in the one handler that could
  report it**: `cloudfunction2.ts`'s error callback did `e.error` unconditionally, and a
  connection refusal hands it `undefined` (real Chrome probed at HEAD: readyState 4, status 0,
  empty body ⇒ `JSON.parse` throws). The one route to `failure` died upstream of `setError`.
  Handler now total, `xhr.status` threaded through, status 0 reports *"Could not reach the backend
  at \<endpoint\>"*; same hole filled in `Noodl.CloudFunctions.run` (shape-preserving). Also
  covered: any non-JSON error body. ⚠️ **The committed viewer bundles still carry the old
  handler** — an editor drive today tests the stale bundle; the end-to-end conjunction rides with
  the next viewer rebuild and P77 SBR-015's 🟡 wired-not-driven admin drive.
- **DEF-025 (`0cb8dd44`)** — `label-not-a-click-target`: warns on a Checkbox/Radio Button whose
  effective `useLabel` is off beside an immediate sibling Text with words. Toggle pair ONLY (the
  doctrine's `field` composition is Text-above-input on purpose). Corpus 178 projects: 186
  toggles, 43 findings, all read and true → stays advisory. `catalog:examples` went 61/62 on a
  task-row exemplar teaching the defect — example repaired (title rides the checkbox's own wired
  `label` port), 62/62, catalog re-merged. 🧭 **The default flip is Richard's**: a blunt flip
  stamps the literal `'Label'` beside every existing bare checkbox; the honest third option is
  flip-at-CREATION (STARTER-params shape). See TASKS.md s17 section for the three options.

## What to do next

- **DEF-022** (a cloud function cannot learn the app's own public origin — narrow fix is an
  output port on the Request node, which already holds the headers and throws them away;
  `request.ts:257`; P78 D34 holds the measurements).
- **DEF-020/DEF-018** (the layout pair — both door-warning shaped; read them against each other
  in P78's register before building either), **DEF-019**.
- **DEF-024** (Condition only turns gates ON — closest to a design ruling, do it last or take it
  to Richard).
- **DEF-012 §2 leftover** — door-side precondition (DEF-002 family) on cloud queries with
  connected filter params and run-on-change boxes on. SB-011 §5.
- **DEF-007 §3.2** — still sequenced behind phase 77's active file.
- **🧭 Richard queue**: DEF-025 flip (3 options in TASKS.md s17) · DEF-009 AC4 (rateLimit
  default) · DEF-005, DEF-013 rulings (re-drive SB-012 §1 at HEAD before spending DEF-013's).

## Traps carried

- 🔴 **The peer committed their template work mid-session** (`ab17845d` P77/D24, `102c614e`,
  `10b26d57`, `d0584629`) — s15's uncommitted-peer-files list is STALE; the 7 peer test:ci reds
  are GONE (floor back to 4). ⚠️ **`sb-007/site-template` is RED at HEAD (2 arms, template
  component count)** — the peer's lane; their own `10b26d57` names the suite as already red.
  `git log -5 -- <path>` before touching anything shared; they are still moving in P77.
- 🔴 **`git checkout -- <file>` as a mutant undo discarded the DEF-026 fix mid-session** — the
  exact filed trap, paid again. Snapshot/`cp` or python string-swap restores only.
- ⚠️ **dist staleness now covers DEF-021/023/026**: noodl-mcp/dist, nodegx-backend `dist/cli.js`,
  and the committed viewer bundles (`noodl-editor/src/external/viewer`, `deploy`, ssr,
  `nodegx-backend/deploy/artifact`) all predate the fixes. Owner: whoever cuts the next 0.2.1
  build.
- ⚠️ **MEMORY.md ~20.0K vs 17,510 budget** — the ~2.5K over sits in ACTIVE peers' lane lines
  (P18/P75/P77/P78), theirs to judge.

## Gates (s17, all fresh, HEAD `0cb8dd44`)

noodl-viewer-react **1091/1091** (1088 + 3 DEF-026 arms) + `tsc --noEmit` clean · editor jest
**6409/6411** (2 = peer's sb-007 template-count arms) · noodl-mcp **966/966** · `catalog:examples`
**62/62** · `catalog:check` clean · `typecheck:editor` / `:editor-tests` / `:mcp` clean ·
**`test:ci` 2905 specs / 4 failures, all AIX-006 BY NAME, seed 90017, fresh readout** — the
canonical floor. Mutants: DEF-026 pre-fix red + status-branch mutant; DEF-025 four mutants each
killed by exactly its arm (the adjacency mutant survived its first arm — the strengthened
two-spacer shape is the lesson).
