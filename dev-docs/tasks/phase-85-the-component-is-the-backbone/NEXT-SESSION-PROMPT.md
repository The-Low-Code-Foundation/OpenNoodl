# Next session — phase 85

⚠️ **If you are here to run the CMP-002 build, you are in the wrong file.** Read
`CMP-002-BUILD-BRIEF-READ-THIS-ONLY.md` and nothing else in this folder. Reading on past this line
disqualifies you from producing the baseline.

## The board, re-derived from the task FILES on 2026-09-10

| task | AC | state |
|---|---|---|
| CMP-001 | AC1 the `States.currentState` enum input | ✅ **2026-09-10**, four assertions over the wire |
| CMP-001 | AC2 the playbook ships as a doctrine field | OPEN — **now ten patterns**, P10 added |
| CMP-001 | AC3 four new corpus examples | OPEN |
| CMP-001 | AC4 a built page clears the three floors | OPEN — needs CMP-002 |
| CMP-002 | the graded baseline build | **NEXT**, and unchanged: run it from its own brief, in a clean session |
| CMP-003 | AC1 the doctrine stops forbidding the named utility | ✅ **2026-09-10**, both copies |
| CMP-003 | AC2 P10 in the playbook | 🟡 half — written into CMP-001 §3, ships nowhere (blocked on CMP-001 AC2) |
| CMP-003 | AC3 a built page produces one | OPEN — needs CMP-002 |
| CMP-003 | AC4 the ledger column | ✅ **2026-09-10** |
| CMP-004 | AC1 the shelf is in THE ORDER | ✅ **2026-09-10**, step 3 of §"The order" |
| CMP-004 | AC2 searchable by what a part does | OPEN |
| CMP-004 | AC3 parts, not just prefabs | OPEN — 🔴 **blocked on Richard's CSV**, ask for it |
| CMP-004 | AC4 the path is two-way | OPEN — 🔴 still the highest leverage in the phase |
| CMP-004 | AC5 an agent reaches for it | OPEN — graded inside CMP-002 |

Session 2 changed product code for the first time in this phase. Everything above that says ✅ is
graded by `packages/noodl-mcp/tests/phase85Doctrine.test.ts` — 12 assertions, most of them over a
real server rather than off a constant.

## The first job

1. **CMP-004 AC4 — the two-way path.** The one that makes the loop compound. Without it every cycle
   improves the doctrine and every agent still builds every part from scratch. A tool that takes a
   component out of the bound project and writes a shelf-shaped entry; graded by round trip.
2. **CMP-001 AC2 — ship the playbook.** Ten patterns, currently readable only by us. ⚠️ It cannot go
   in `instructions` (the budget gate reports **8,275 / 8,280** — five tokens). It goes in
   `get_project_info` as a fifth doctrine field, the way CMP-004 AC1 went in as step 3 of the order.
   🔴 **Consider the per-node route instead or as well** — see the gap in README §7.
3. **CMP-004 AC2 — the text query.** `list_library` takes `type` and an exact `tag`. "Is there a
   date formatter?" has no query that answers, which makes step 3 of THE ORDER weaker than it reads.

## Ask Richard for

**The CSV of community logic and visual nodes.** Still outstanding. It is the seed corpus for
CMP-004 AC3 and that AC cannot close without it. Session 2 did not have it.

## 🔴 Traps, session 2's added to session 1's

- 🔴 **MEASURE THE ARTEFACT, NOT THE TASK FILE — this phase has now failed that twice in two
  sessions.** CMP-001 §4's headline claim ("the catalog documents only the output") was false on the
  live server; the enum input was named in `runtimeBehavior`, which travels with the DEFAULT
  response. CMP-003's "49 of them one node" reproduces under no definition (it is 20, or 45 counting
  one-or-two). Both are corrected in place, with the corrections kept visible rather than tidied
  away. **Before building an AC, run the measurement its premise rests on.**
- 🔴 **A fact stated once and contradicted by the advice around it is not documented.** Five surfaces
  described `States.currentState`; four said "output" or "use signals", one clause said "enum
  input", and the sentence right after that clause said *"wire signals to `to-S`"*. A check asking
  "does the response contain the string `currentState`?" passes on that. Assert the DESCRIPTION and
  the INSTRUCTION, not the presence of the name.
- 🔴 **`get_node_type` emits neither `patterns` nor `antiPatterns`, at any detail level.** Filed in
  README §7. Cost a rewritten assertion when a test that "should" have passed did not.
- 🔴 **`npm run docs:nodes` wipes and rewrites the whole directory, and 28 pages were ALREADY stale
  at HEAD.** Regenerating in place folds someone else's unpublished catalog work into your commit.
  The gate is not in CI, so it goes unnoticed. Snapshot, regenerate, restore everything but your own
  page. Session 2 did that; the recipe is in the CMP-001 AC1 note.
- 🔴 **Two logic folders in LearnBook**, `/Global logical components/` (25) and `/#Global logic
  components/` (12). A filter on the obvious one reads 25/88 and looks like a contradiction.
- Session 1's traps still stand: **two obvious metrics were green before the work** (mean ports,
  variant port — do not reintroduce them), and **a session that has read this phase cannot grade a
  build of it**.
- The full `noodl-mcp` suite is **3 failed / 1428 passed**. Both failures are in `*Drive` suites
  (`def018-def020-layout-drive`, `sbr009ThemeEditorDrive`), reproduce identically, and reference
  none of this phase's surfaces. Pre-existing; not this phase's.
- `MEMORY.md` headroom: check it before adding. Session 1 left 14 units.
