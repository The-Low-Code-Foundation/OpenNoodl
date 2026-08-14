# Phase 66 — next session

**Written 2026-08-14, session 4 (build + drive).** **FIX-008's A, B and E are built and driven** —
the minimum that closes report 5, plus the detectability fix. Richard ruled *silent backfill on
open* at the top of the session, which is what made B buildable in the same sitting. **C and D
remain open**, and the seven batchable rulings are still owed. This file is rewritten at the end of
**every** session — read §0 for how, and replace it rather than appending.

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, overwritten each session (the phase-57/60/61 convention).
It carries exactly four things and nothing else:

1. **Built vs. driven**, per task, as a table — the phase-64 discipline. *Built* is code plus gates;
   *driven* is the app doing it. Never let the two blur into "done".
2. **Gate readings with their date and commit**, so the next session compares NAMES against a
   reading it can trust rather than re-deriving one.
3. **What this session settled**, so nobody re-litigates or re-measures it.
4. **What to do next and why**, ordered, with the rulings still owed by Richard called out
   separately from the work an agent can do alone.

Learnings that outlive the phase go to memory, not here. This file is the phase's working state;
memory is the repo's. Both get written at the end of a session — the memory index line is what makes
a learning findable six phases later.

---

## 1. Built vs. driven

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-020** | ✅ | ✅ **3/3** | five popups, both themes — **CLOSED** |
| **FIX-010** | ✅ | ✅ **3/3** | picker anchors + stickiness survives — **CLOSED** |
| **FIX-018** | ✅ | ✅ **5/5** | chip + stacked edge + freed icon slot + menu — **CLOSED** |
| **FIX-008** A (honest Connect) | ✅ | ✅ | clicked live; `~/.claude.json` byte-identical after |
| **FIX-008** B (backfill on open) | ✅ | ✅ | launcher card → both files → `claude mcp list` sees it |
| **FIX-008** E (bound directory) | ✅ | ✅ | over real stdio, not only the in-process harness |
| **FIX-008** C, D | 📋 **not built** | — | C stops it recurring; D removes the class |
| **FIX-007** docs half | ✅ | n/a | both catalogs, all 3 examples, `WIRE_FORMAT_LEGEND` |
| **FIX-007** gate half | ✅ | ✅ | rejected + accepted through the real MCP door |
| **FIX-007** crit 1 | ✅ | 🟡 half | MCP path driven; **internal-AI half is paid** |
| **FIX-007** crit 4 | 📋 **not built** | 🔴 | blocked on fix 4 — do not re-drive until it lands |
| **FIX-007** fixes 3 & 4 | 📋 open | — | `addConnection`/`getConnectionStatus`; `evaluateHealth()` |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

✅ **Three tasks closed, one Tier 1 task most of the way.** Nothing built is waiting on a drive
except FIX-007 criterion 1's paid half.

---

## 2. Gate readings

| Gate | Reading (2026-08-14, session 4, on top of `37fada92`) |
|---|---|
| `test:ci` | ✅ **2736 total / 6 failed, seed 34417** — all six inherited, by name |
| `test:main` (jest: `tests-main` + `tests-unit`) | ✅ **188 suites / 2880 tests, 0 failed** |
| MCP suite (`packages/noodl-mcp`, jest) | ✅ **41 suites / 467 tests, 0 failed** |
| `tsc -p packages/noodl-editor/tsconfig.tests.json --noEmit` | ✅ **0 errors** |
| `packages/noodl-mcp` `tsc --noEmit` | 7 errors, **all pre-existing** in files not touched (`connectionPresentation`, `interfaceGate` ×4, `stagingDiagnostics` ×2) |
| catalog trio, `cloud-library:check` | unchanged — **no catalog, node or library file touched** |

The six `test:ci` failures, by name: `AIX-006 style vocabulary` ×4 · `AI model registry` ×2 — the
same six as sessions 2 and 3. `test:ci` **totalCount is unchanged at 2736**, which is correct: this
session added no jasmine specs, only jest ones.

✅ **`test:main` 2866 → 2880 is exactly the 14 new specs** in
`tests-main/mcp/connect-bootstrap-server.test.js`. The MCP suite rose by the 9 added there.

🔴 **The MCP suite is GREEN, not red.** Memory carried "MCP suite red since DSG-003"; 41/41 pass
today. That note has been corrected.

⚠️ **Read `packages/noodl-editor/tests/test-results.json` — and check its mtime.** This session
read it once *before its own run had finished* and got the previous session's numbers back,
identical seed and all. A results file is only yours if it is younger than your run.

---

## 3. What this session settled — do not re-derive

### The seam: `LocalProjectsModel.bindProject`

The task's first open question — *which seam do all open routes cross?* — is answered.
**`bindProject`**, and specifically **not `projectFromDirectory`**, which the import engine also
uses to read a *source* project it is not opening (`import-engine/analyze.ts:104`, `apply.ts:158`);
backfilling there would write into a folder the user only pointed an importer at. Every route that
produces an opened project passes through `bindProject`: `loadProject` (launcher rows, recents,
clone, `projectlibrarymodel`), `_addProject` (new, unzip, open-from-folder), and `EditorPage`'s
reload.

### The v2 gate, and why it is read off the folder

A legacy project gets **neither file**: `noodl-mcp` refuses a monolithic `project.json`, so the
registration would be an approval prompt in front of a server that dies at startup. The test is the
folder's own markers (`components/_registry.json` / `nodegx.project.json`) read through the same
host the writes go through — 🔴 **not `ProjectModel._projectFormat`**, because at creation time the
project is still legacy on disk when its config is written, and a model-based gate would have
silently broken the creating path.

### What the drive proved, in one line each

- Connect, clicked when already connected: **success card**, "there was nothing to change",
  `~/.claude.json` **sha256 identical** before and after. `claude` *is* installed here, so pre-fix
  this exact click produced the red error in the report.
- A v2 project opened from its launcher card gained `.mcp.json` + `CLAUDE.md` + the ignore line, and
  `claude mcp list` **in that folder** then showed `nodegx-fix008-v2` as *pending approval*.
- A legacy copy gained nothing; a git-tracked copy gained both files and a **three-line**
  `.gitignore` diff; re-opening either changed no byte and left a hand-edited `CLAUDE.md` intact.
- `get_project_info` returns `projectDirectory`, driven over real stdio against the built bundle.

Full measurement tables: [FIX-008](FIX-008-THE-SERVER-BOUND-TO-THE-WRONG-PROJECT.md) § "What the
drive measured".

### 🔴 The packaged app carries its own MCP bundle

Richard's five running servers run
`/Applications/NodeGX.app/Contents/Resources/noodl-mcp/noodl-mcp.cjs`, **not**
`packages/noodl-mcp/dist/`. Grepped after this session's rebuild: **0 occurrences** of fix E's new
string in the packaged copy. So `npm --prefix packages/noodl-mcp run build` fixes the `nodegx`
bootstrap registration (which points at the checkout) and **nothing else** — every project-bound
server stays on the old code until the app is repackaged. Last session's "rebuild the dist" lesson
has a second half.

### ⚠️ The posture has a visible edge

Backfilling into a git repo modifies a **tracked** `.gitignore` (three lines, measured). That is the
first thing a user will notice about the silent-backfill ruling, and it is deliberate: the
alternative is a machine-specific `.mcp.json` getting committed.

---

## 4. What to do next

1. **The seven-ruling sitting.** Asked at the top of this session and deferred — FIX-002's send key,
   FIX-003's opt-in, FIX-009's PortEditor, FIX-011's persistence, FIX-012's None, FIX-014's x/y,
   FIX-019's chip. Each has a written recommendation; **one sitting clears seven tasks' blockers.**
   Ask first, not last.
2. **FIX-007 fixes 3 and 4** — fix 4 is the small one and it is what unblocks criterion 4. The ⚠️
   rider (`add_connection` drops `label`/`labelT`/`route`) is still unfiled.
3. **FIX-008 fix C** (`--scope project` for the per-project Settings command) if the report should
   stop recurring. It needs `MCP_SCOPE` split, `McpSettingsSection.tsx:163`, `tests-unit/mcp-001`,
   and a cleanup hint for the stale user-scope `nodegx-<slug>` entries — `nodegx-puppy-test-3` is
   **still** visible in every folder on this machine.
4. **Ask Richard for the paid drive** of FIX-007 criterion 1's internal-AI half. Do not spend it
   unasked.
5. **Repackage the app** (or say so out loud) if fix E is to reach the running servers.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

---

## 5. Rulings still owed by Richard

The batchable smalls (FIX-002, 003, 009, 011, 012, 014, 019) each have a recommendation already
written — **one sitting clears seven tasks' blockers.**

**FIX-008 leftovers:** cleanup of stale user-scope registrations (a "registered elsewhere" list in
Settings?), and whether two visible NodeGX servers in one session — the project's own plus a stale
global bound elsewhere — is better or worse for the model. The second is a measurement, not a
preference; take it before shipping C's copy.

The two big ones (FIX-015's eight style-token rulings, FIX-021's six memory-doc rulings) are their
own sessions and their output is a new phase, not code in this one.

---

## 6. Standing constraints — unchanged, do not relearn

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call; pathspec-scope
every `git add`. Check for a sibling session (`git log --since="3 hours ago"`, and read untracked
files rather than assuming they are yours). **`dev:stop` kills Richard's MCP servers** — kill the
`scripts/start.ts` pid instead (done this session; all five survived). Restore
`recently_opened_project.json` after any launcher drive (done — 28 entries in, 28 out).
⚠️ **Do not restore `~/.claude.json` from a backup**: Richard's live Claude Code sessions write to
it constantly, and this session's own backup was already stale within the hour. Full list in the
[README](README.md) § "Standing constraints inherited".
