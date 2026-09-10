# Next session — phase 85

⚠️ **If you are here to run the CMP-002 build, you are in the wrong file.** Read
`CMP-002-BUILD-BRIEF-READ-THIS-ONLY.md` and nothing else in this folder. Reading on past this line
disqualifies you from producing the baseline.

## The board, re-derived from the task FILES on 2026-09-10 (session 3)

| task | AC | state |
|---|---|---|
| CMP-001 | AC1 the `States.currentState` enum input | ✅ **s2**, four assertions over the wire |
| CMP-001 | AC2 the playbook ships as a doctrine field | OPEN — **now ten patterns**, P10 added |
| CMP-001 | AC3 four new corpus examples | OPEN |
| CMP-001 | AC4 a built page clears the three floors | OPEN — needs CMP-002 |
| CMP-002 | the graded baseline build | **NEXT**, and unchanged: run it from its own brief, in a clean session |
| CMP-003 | AC1 the doctrine stops forbidding the named utility | ✅ **s2**, both copies |
| CMP-003 | AC2 P10 in the playbook | 🟡 half — written into CMP-001 §3, ships nowhere (blocked on CMP-001 AC2) |
| CMP-003 | AC3 a built page produces one | OPEN — needs CMP-002 |
| CMP-003 | AC4 the ledger column | ✅ **s2** |
| CMP-004 | AC1 the shelf is in THE ORDER | ✅ **s2**, step 3 of §"The order" |
| CMP-004 | AC2 searchable by what a part does | OPEN — 🔴 **now the highest leverage left** |
| CMP-004 | AC3 parts, not just prefabs | OPEN — 🔴 **blocked on Richard's CSV**, ask for it |
| CMP-004 | AC4 the path is two-way | ✅ **s3** — `export_to_library`, graded by round trip |
| CMP-004 | AC5 an agent reaches for it | OPEN — graded inside CMP-002 |

Session 3 closed the one the phase called its highest-leverage item. **The loop can now compound:**
step 3 of THE ORDER reads the shelf, step 4 writes back to it.

## The first job

1. **CMP-004 AC2 — the text query.** `list_library` takes `type` and an exact `tag`. "Is there a
   date formatter?" has no query that answers, which makes step 3 of THE ORDER weaker than it reads
   — and step 4 has just started adding entries whose value is entirely in *finding* them. A text
   query over label + description + component names, or a written statement of why tags are enough.
   ⚠️ **Measure before building**: `get_library_entry` already returns component names, and
   `find_tools`' own matcher exists — check whether the query wants to live there.
2. **CMP-001 AC2 — ship the playbook.** Ten patterns, currently readable only by us. It cannot go
   in `instructions` (the budget gate reports **8,275 / 8,280** — five tokens). It goes in
   `get_project_info` as a fifth doctrine field, the way CMP-004 AC1 and AC4 went in as steps 3 and
   4 of the order. 🔴 **Consider the per-node route instead or as well** — see the gap in README §7.
3. **CMP-002** remains the thing that grades CMP-001 AC4, CMP-003 AC3 and CMP-004 AC5 — three open
   ACs across three tasks, and it needs a session that has read only its brief.

## Ask Richard for

**The CSV of community logic and visual nodes.** Still outstanding, asked for in s2 and s3. It is
the seed corpus for CMP-004 AC3 and that AC cannot close without it. ✅ **AC4 makes it cheaper than
it was**: the CSV's parts can now be turned into shelf entries by exporting them from a project
rather than hand-authoring `library.json` files.

## 🔴 Traps — session 3's, then the standing ones

- 🔴 **THE PHASE'S OWN GRADING SUITE WAS COMMITTED IN A STATE THAT COULD NOT RUN.**
  `tests/phase85Doctrine.test.ts` at `2ae2379d9` was missing one `});` — the CMP-001 describe at
  line 68 never closed — so `tsc` reported `TS1005: '}' expected` at EOF and jest could not compile
  the file. **The twelve assertions behind three ✅ rows were not running, and every document in the
  phase said they were.** s2's own recorded number (`3 failed / 1428 passed`) reproduces exactly
  once you add s3's 14 new specs (`3 failed / 1442 passed`), which dates the breakage to an edit
  made *after* the last suite run and before the commit. ✅ **Run the suite you are claiming as
  evidence AFTER your last edit to it, not before** — a green recorded mid-session is a measurement
  of a file that no longer exists. Fixed in s3.
- ⚠️ **A sibling package's in-flight edits redden `tsc -p noodl-mcp`.** s3's first typecheck failed
  in `packages/nodegx-export/src/analyze/plan.ts` — a peer's working tree, mtime ten seconds old,
  nothing to do with this phase. Filter by path before believing a typecheck, and never "fix" a file
  whose mtime is younger than your session.
- ✅ **The negative control is worth the four minutes.** Disabling the closure walk turned 9 of the
  14 round-trip specs red, which is what makes the `validate_project` absence assertion mean
  something. A spec that passes on an empty list grades nothing.
- 🔴 **MEASURE THE ARTEFACT, NOT THE TASK FILE — twice in s1/s2, and a third shape in s3.** s3's was
  a *committed* artefact contradicting three documents (above). Before building an AC, run the
  measurement its premise rests on, and prefer the instrument that reads DIFFERENTLY if you are
  wrong.
- 🔴 **A fact stated once and contradicted by the advice around it is not documented.** Assert the
  DESCRIPTION and the INSTRUCTION, not the presence of a name.
- 🔴 **`get_node_type` emits neither `patterns` nor `antiPatterns`, at any detail level.** Filed in
  README §7.
- 🔴 **`npm run docs:nodes` wipes and rewrites the whole directory, and 28 pages were ALREADY stale
  at HEAD.** Snapshot, regenerate, restore everything but your own page.
- 🔴 **Two logic folders in LearnBook**, `/Global logical components/` (25) and `/#Global logic
  components/` (12). A filter on the obvious one reads 25/88 and looks like a contradiction.
- Session 1's traps still stand: **two obvious metrics were green before the work** (mean ports,
  variant port — do not reintroduce them), and **a session that has read this phase cannot grade a
  build of it**.
- The full `noodl-mcp` suite is **3 failed / 1442 passed** (s3). Both failing suites are
  `*Drive` (`def018-def020-layout-drive`, `sbr009ThemeEditorDrive`), reproduce identically, and
  reference none of this phase's surfaces. Pre-existing; not this phase's.
- `MEMORY.md` headroom: check it before adding.
