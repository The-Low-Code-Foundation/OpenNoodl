# Phase 80 — next session

## State: DEF-001–004, 006, 008, 010, 011, 014–017 closed. DEF-007 🟡 (§3.2). DEF-009 🟡 (AC4). **DEF-012 🟡 (§2 finding only)**.

**s15 (2026-08-30)** closed DEF-012's §1 (`6deabdd4`): a `Query Records` filter that cannot be
translated now **fails the node** (`setError` → `failure` signal → `raiseRuntimeError`, which
DEF-004's step record carries) instead of running unfiltered — the path that let publishing one
page open every Section on the site. The same guard went into cloud `Aggregate Records`, where
the throw used to abandon the update pass (neither fetched nor failed). And the `pointsTo`
schema chain was closed end to end: `schemaFor` now reads the built-in backend's
`dbCollections` `columns` shape, and a first-write Pointer column records its value's
`className` as `targetClass` (`LocalSQLAdapter` create/save + `AdapterFacade.ensureImportShape`).
**Read SB-011 §5** — it holds the corrected readings, the corpus numbers, and the known limits.

## What s15 measured before building (the standing instruction, 12th payment)

- The defect **reproduced at HEAD** (string arm 2, pointer arm 3-as-200) — but SB-011's
  *"nothing in the cloud runtime populates `_collections`"* was **too wide**: the cache is a lazy
  getter over `getMetaData('dbCollections')`, and a deployed bundle carries the whole
  `project.metadata`. What was absent was metadata in a readable shape, not the mechanism.
- **Corpus: 280 `points to` rules, 14 projects.** 264 carry a legacy Parse-era schema with
  `targetClass` (work today, untouched); **16 rules in 4 projects were silently widening** and
  now fail loudly; **0** sat on the built-in `columns` shape — that half of the fix has no
  regression population at all, it is what SB-004 needed and never got.

## What to do next

- **DEF-018–DEF-025** (read phase 78's register `DEFECTS-THE-TEMPLATES-FOUND.md`, not the
  TASKS.md table), **DEF-026**.
- **DEF-012 §2 leftover** — 265/270 parameter-fed queries sit at the run-on-change default
  (78 in cloud components). 🔴 SB-011 §2's own candidate ("wait for parameters") **collides with
  the optional-filter contract** (`dropUnresolvedConnected`: a port supplying nothing must not
  narrow — so "not yet arrived" and "deliberately absent" are indistinguishable). The honest
  candidate registered in SB-011 §5: a **door-side precondition** (DEF-002 family) on
  cloud-function queries with connected filter params and run-on-change boxes on — SB-004's own
  workaround, taught at authoring, no runtime sweep needed.
- **DEF-007 §3.2** — still sequenced behind phase 77's active file, and see the trap below:
  the template is being edited RIGHT NOW.
- **DEF-005, DEF-013** — 🔒 Richard rulings. Before spending DEF-013's, re-drive SB-012 §1 at
  HEAD (unchanged advice from s14). **DEF-009 AC4** — 🧭 Richard (rateLimit default).

## Traps carried

- 🔴 **A peer is mid-flight in `site-builder.content.json`** (+861 lines, section-reorder UI,
  mtimes moving during s15's runs) plus `noodl-mcp/tests/sb004Components.ts`, `sb005*`,
  `sb007Template.test.ts` — all uncommitted. **15 nodegx-backend failures (sb015/016/017) and
  7 test:ci specs (SB-017 ×3, DEF-015 ×2, D14 ×2) are red against that mid-edit template** —
  every failing arm counts template contents (endpoints, policy coverage, connections: 142 vs
  the pinned 118). None reach the filter path s15 changed. Whoever finishes the template work
  owns re-greening them; do not "fix" those pins.
- 🔴 **The phase-77 register and the 5 `.scss` peer edits remain uncommitted in the tree**
  (unchanged from s14's list). `git log -5 -- <path>` before touching any shared file.
- ⚠️ **MEMORY.md was compacted s15: 27.5K → 22.7K units, tail VISIBLE again.** Seven heavy lines
  were filed VERBATIM into their topic files (sections titled *"Filed verbatim from the MEMORY.md
  index line"*) and replaced with pointers — 125 links intact. ~5.2K over the 17.5K budget
  remains, in lines only their owners can judge.
- ⚠️ **noodl-mcp/dist is still stale** (now also behind on DEF-009/010/011/012 behavior).
  Owner: whoever cuts the next 0.2.1 build.

## Gates (s15, all fresh, HEAD `6deabdd4`)

noodl-runtime **2596 passed (145 suites)** · nodegx-backend **1380/1395 — the 15 are the peer's
mid-edit template, named above; s15's own suites green standalone** · viewer-cloud **194/194** ·
viewer-react **1088/1088** · `tsc` runtime + backend clean · `test:ci` **2905 / 11 failed, seed
70443, fresh readout: the floor 4 `AIX-006 style vocabulary` BY NAME + the 7 peer-template
specs** (readout `gitHead` = `9b747450`, a P18 peer's EXP-011 commit — read-time, not
authorship). **Three mutants run and reverted, each killed by exactly its arm.**
