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
| CMP-004 | AC2 searchable by what a part does | OPEN — 🔴 **the highest-leverage SHELF item left** |
| CMP-004 | AC3 parts, not just prefabs | OPEN — 🔴 **NOT blocked**; the CSV was in the repo all along, and reading it CHANGED the AC |
| CMP-004 | AC4 the path is two-way | ✅ **s3** — `export_to_library`, graded by round trip |
| CMP-004 | AC5 an agent reaches for it | OPEN — graded inside CMP-002 |
| CMP-005 | the date formatter — node or part | **WRITTEN s3**, not built. AC1 is a decision, not code |

Session 3 closed the one the phase called its highest-leverage item. **The loop can now compound:**
step 3 of THE ORDER reads the shelf, step 4 writes back to it. It also opened **CMP-005** from
Richard's own words, and killed a blocker two handoffs had carried without checking it.

## The first job

1. **CMP-005 AC1 — decide: extend the node, or ship a part.** One paragraph, before any code.
   Richard raised it and left the choice open; §2 of the task lays out both with the measurement
   behind each, and recommends **the node, additively, then a part that demonstrates it**. 🔴 The
   task's §1.2 already rejected the two hypotheses you would otherwise spend an hour on — **do not
   re-derive them**. Then AC2/AC3: new tokens, and existing projects byte-identical.
2. **CMP-004 AC2 — the text query.** `list_library` takes `type` and an exact `tag`. *"Is there a
   date formatter?"* — the AC's own worked example, and now a real question with a real answer
   coming — has no query that answers it. ⚠️ **Measure before building**: `get_library_entry`
   already returns component names, and `find_tools` has a name-matching matcher; check whether the
   query wants to live in one of those before writing a third.
3. **CMP-004 AC3 — the shelf's granularity.** No longer blocked, and no longer what it said: read
   the corrected AC before starting. What it needs is **three single-component entries, one of them
   exported rather than hand-authored** — CMP-005's formatter is the obvious first.
4. **CMP-002** still grades CMP-001 AC4, CMP-003 AC3 and CMP-004 AC5 — three open ACs across three
   tasks, and it needs a session that has read only its brief.

## ✅ Nothing outstanding from Richard

**The CSV arrived long before anyone asked.** Sessions 2 and 3 both wrote *"ask Richard for the CSV
of community logic and visual nodes"*; it was vendored and committed at `121fd5c5f` as
`dev-docs/tasks/phase-86-the-community-already-built-it/corpus/components/Components.csv` —
**thirty-four minutes before s2 recorded the blocker.** Richard pointed at it when asked.

🔴 **Reading it changed CMP-004 AC3.** It is 29 *prefab-scale* community components, not one-node
utilities; P86's COM-005 has already measured 8 of them as covered by existing shelf entries and
exactly 3 as gaps. The boundary is P86's own (COM-003 §7): **P86 turns the corpus into examples and
the three missing entries; P85 owns the shelf that carries them and its granularity.**

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
- 🔴 **MEASURE THE ARTEFACT, NOT THE TASK FILE — twice in s1/s2, and TWICE MORE in s3.** s3's were
  (a) a *committed* grading suite contradicting three documents, above, and (b) a **blocker that had
  never been true**: two handoffs said "blocked on Richard's CSV, ask for it" while the CSV sat in
  the repo, committed half an hour before the blocker was written. 🔴 **A blocker owned by nobody is
  the one most likely already resolved — re-measure it before inheriting it**, and `git log` the
  thing it names. Before building an AC, run the measurement its premise rests on, and prefer the
  instrument that reads DIFFERENTLY if you are wrong.
- ⚠️ **A blocker's removal can invalidate the AC, not just unblock it.** Reading the CSV showed
  CMP-004 AC3 was asking for the wrong thing (prefab-scale community components, not the one-node
  utilities its own §2 argued for). Check what an unblocked AC now *means* before building it.
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
