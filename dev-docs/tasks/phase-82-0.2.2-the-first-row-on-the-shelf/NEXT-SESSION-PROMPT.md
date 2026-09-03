# Phase 82 — next session

## The board, re-derived from [`TASKS.md`](TASKS.md) at 2026-09-03, session 27

🔴 **Re-derive it again yourself.** This phase has now been overtaken eight times by a ruling or a
row that landed after a handoff was written. **The task files are the board; this section is a
convenience.** ⚠️ s20 said *"there is no fully-buildable row left"*, s22 said *"every row is CLOSED
or waiting on Richard"*, s23 said the same of rows 6/6b, s24 said rows 6 and 6b were down to
Richard's look, s25 built a session out of a finding s24 had **registered and not built**, s26 did it
again out of s25's, and **s27 did it a third time out of s26's**.
✅ **Read the FINDINGS a row owns, not only its status.** Three sessions running, the next job was
sitting in the previous handoff's "⬅️ What is left" list with owner `NONE`.

| # | row | state |
|---|---|---|
| 6 | REL-002c — every page as good as the homepage | 🟢 **Everything a session can do is done.** ⏳ **RICHARD'S LOOK** + the four judgements §7.3 names |
| 6b | [REL-010](REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md) | ⏳ **RICHARD'S LOOK.** AC1–AC5 met s15, AC6 is a person. Pictures current as of s26 |
| 7 | REL-001 — publish the members' area | ⏳ **RICHARD.** *fix first, publish once*. ✅ Nothing stands against this row |
| 8 | REL-004 — cut and tag `v0.2.2` | 🔴 **Blocked**: `cline-dev` unpushed (**671** at s27 close — re-derive at cut time), CI has run on none of it |
| 9a / 9b / 10 | REL-011a / REL-011b / REL-009b | 🟢 CLOSED s17 / s19 / s21 |
| 9c | REL-011c — the three surfaces reach PASSABLE | 🟡 AC1 + AC2 met, all findings built, **plus s27's document outline**. ⏳ AC3 is Richard's ruling |

## 🟢 What session 27 did

One job, taken from s26's §"What is left" item 3 — registered, owner `NONE`, explicitly not built.
Write-up: **[REL-011 §5](REL-011-THE-SITE-BUILDER-SHIPS.md)**. Commit `373375fd`.

**The site-builder template had seven headings and no landmarks.** Measured before a line was
written: **7 of 7 pages carried exactly one `h1`, 0 of 7 carried a `main`, and 0 of the artefact's
26 `as` tags were held by any assertion anywhere in the repo.**

### 🔴 A NEARLY-complete outline is harder to see than a missing one

That is the transferable half. REL-002c met the members' area at *0 semantic tags in 100 files* —
every instrument agreed, including the render-time reading. Here the heading census reads **perfect**,
the pictures are identical either way, and the thing that is missing is the region a reader jumps to
in order to skip the rail. **The closer an outline gets to complete, the fewer instruments can see
what is still missing from it.**

The fix: `as: 'main'` on the six admin screens' existing content column — each already held its
heading and nothing else — plus **one new node** (`siteMain`) on `/Pages/Site`, whose `shell` also
holds the nav band and the colophon. `/Admin/Shell`'s rail took `as: 'nav'`, which is the **control**
as much as the markup. **400 → 401 nodes, 553 connections both sides, 26 → 34 tags.**

### The gate, and the two mutants that are the point of it

**§12 of `sb007Template.test.ts`, nine specs.** The mutants are why it is worth reading:

| mutant | what it says |
|---|---|
| the artefact **exactly as it shipped** | §12.2 and §12.3 redden — and §12.1, §12.5 and §12.4's swallow sweep all stay **GREEN**. That is why nothing caught it |
| the **shortcut fix** — the landmark moved up onto `/Pages/Site`'s `shell` | passes §12.1, §12.2 **and** §12.3; **§12.4 alone can see it**. A `main` that swallows the site navigation |

### 🔴 And the browser half — a parameter is an intention

`sb008-public-site-drive.test.ts` gained **§6**, riding the four page loads it already takes against
a real backend:

| per page load | reverted arm | HEAD |
|---|---|---|
| exactly one `<main>` and one `<h1>` | **0 of 4** | **4 of 4** |
| the `<h1>` inside the `<main>` | **0 of 4** | **4 of 4** |
| a `<nav>` in the document | 4 of 4 | 4 of 4 |
| `<nav>` inside the `<main>` | 0 | 0 |

The third row is what makes the first two mean anything: without a known negative **in the same
document**, a probe that answered *"inside"* for everything would pass on every page ever written.

### ⚠️ `artefactMd5` is NOT a pin, and reading it as one was the trap avoided

It hashes `nodegx.project.json` **alone** and it moved on the *living* run — a randomly allocated
backend port is written into that file — while staying **identical** on the *door* run, whose graphs
changed just as much. What excludes the stale-artefact explanation is the code path:
`authorSiteTemplate` writes `SB005_COMPONENTS`/`SB006_COMPONENTS` through the MCP door **at run
time**. ✅ **Before trusting a provenance field, ask what it hashes and what would move it.**

### The readings taken, in full

| gate | reading |
|---|---|
| `sb007Template.test.ts` | **71/71, EXIT=0** (62 before §12's nine) |
| `noodl-mcp` full jest | **92 suites / 1242 tests, EXIT=0** |
| `tsc --noEmit -p packages/noodl-mcp` | **0 errors, EXIT=0** |
| `sb008-public-site-drive.test.ts` (real backend + browser) | **24/24, EXIT=0** (20 before §6's four) |
| `vib001-site.look.ts` | **EXIT=0, 2/2, 40 shots** — 192/200 PNGs and 96/100 text dumps byte-identical; the 8 that moved are `/admin/messages`' printed clock (`20:15` → `23:07`) |
| `noodl-editor` `test:main` | **412 suites / 6847 tests, EXIT=0** — **red first** on the sb-007 node-count literal (400 → 401), fixed and decomposed in place |
| `noodl-editor` `test:ci` | **2943 specs, 4 failures, seed 06584, HEAD `6112e946`** — the AIX-006 floor, all four by name |

## ⬅️ What is left

1. ⏳ **Rows 6, 6b, 7 and 9c are RICHARD'S**, and nothing stands against 6/6b/7 any more.
2. 🔴 **Row 8 needs a push**: **671** commits ahead of `origin/cline-dev`, CI has run on none.
3. ⚠️ **No drive grades the SIX ADMIN screens' rendered outline.** §6's four loads are all the
   public catch-all. The *mechanism* carries (`as: 'main'` renders a `<main>`; a child node renders
   inside it) and per-page authoring is §12's job, but nobody has seen those six documents.
   Covering them means `sbr010-messages-drive`, `sbr009ThemeEditorDrive` and
   `ac2-page-editor-drag-drive`. **Owner: NONE.** *This is the strongest buildable candidate left.*
4. ⚠️ **`<h2>` order is unchecked in BOTH templates.** Every section kind carries one; nothing
   asserts a page's headings descend without skipping a level. **Owner: NONE.**
5. ⚠️ **Neither outline gate is general.** The members' area has §8/§8.7/§11, the site builder has
   §12/§6, and the next template on the shelf starts at zero. **Owner: NONE.**
6. ⚠️ **Still not run, carried from s23/s24/s25/s26**:
   `packages/nodegx-backend/tests/ac2-page-editor-drag-drive.test.ts`. Judged not worth a drive,
   **not** measured. Owner: whoever cuts REL-004.
7. ⚠️ **Registered, owner `NONE`**: `/Site/ContactForm`'s stale comment block in
   `sb006Components.ts` (near line 702, *"`/Pages/Site` used to carry the same wrapper…"*). Stale
   prose, not a defect.
8. ⚠️ **REL-010 AC4 and REL-002c §8.5 both say "the nine chrome pages"; the artefact says EIGHT.**
   The gate asserts eight. Neither doc was edited — **`README.md` carries a peer's uncommitted
   paragraph** and REL-010's own text is Richard's reading material.

## Working rules for this tree — carried forward, plus what s27 earned

1. 🔴 **A NEARLY-COMPLETE VERSION OF A THING IS HARDER TO MEASURE THAN AN ABSENT ONE.** Seven `h1`s
   and no `main` reads better on every census than zero of both, and is the same defect for the
   person who cannot skip the rail. ✅ **When a census reads perfect, ask what it counts and what
   the count cannot arrange.**
2. 🔴 **A CENSUS COUNTS THINGS; IT CANNOT SEE A RELATIONSHIP BETWEEN THEM** (s26). ✅ **When a gate
   is a count, ask what arrangement of the same count would be wrong.**
3. 🔴 **A PARAMETER IS AN INTENTION** (s26). ✅ **Take the claim one layer down where a harness
   already goes** — §6 rides four page loads the drive was already making and cost one `evaluate`.
4. 🔴 **A CONTAINMENT CHECK NEEDS A THING THAT IS DELIBERATELY OUTSIDE** (s26), **in the same
   document**, not merely an absence elsewhere.
5. 🔴 **A PROVENANCE FIELD HASHES WHAT IT HASHES.** `artefactMd5` is one file of ninety-eight; it
   moved for a random port and did not move for a changed graph. ✅ **Ask what would move the field
   before you use it as a pin — and prefer the CODE PATH: what does the harness read, and when.**
6. 🔴 **MEASURE THE ARTEFACT BEFORE BELIEVING THE NOTE THAT REGISTERED IT.** s26's handoff said
   *"26 `as` tags and nothing holds them"*; the artefact also said **no landmark on any page**,
   which is a different and larger job.
7. 🔴 **A LITERAL COUNT GATE ONLY WORKS IF SOMEBODY RUNS IT** (s23). ✅ Touch either template
   artefact ⇒ mcp jest + its drive + `test:main` **and** `test:ci`. `test:main` caught the sb-007
   node-count literal this session; nothing in `noodl-mcp` sees it.
8. 🔴 **CHECK WHOSE VERDICT DIRECTORY YOU ARE ABOUT TO WRITE INTO** (s24). `judge()` keys by
   `today()`. ✅ Snapshot the committed tree to scratchpad **before** running and diff against that
   copy — that is how the 192-of-200 reading exists at all.
9. 🔴 **COMMIT BY PATHSPEC, NEVER `git add`** — except untracked paths, which a pathspec commit
   **skips silently**. ⚠️ `phase-82/README.md`, `packages/noodl-mcp/tests/sbr011LivePreview.test.ts`,
   `packages/noodl-editor/tests-unit/rel-002a/` and two more untracked paths carry peers' work;
   **s27 left all of them alone**, as s24, s25 and s26 did.
10. 🔴 **NEVER OPEN `templates/members-area` OR the site-builder template IN THE EDITOR.** Work
    through `npm run template:members` / `template:site-builder`.
11. ⚠️ **A task-completion notice reporting "exit code 0" is the WRAPPER's status, not the
    command's.** It misreported **three times** this session — the reverted-arm drive (really 1),
    `test:main` (really 1) and `test:ci` (really 1). ✅ **Gate on an exit file you write yourself.**
12. ⚠️ **`test:ci`'s readout is `packages/noodl-editor/tests/test-results.json`**, not
    `packages/noodl-editor/test-results.json`. Check `gitHead` and mtime rather than deleting the
    wrong path and believing you armed the guard.
13. ⚠️ **`typecheck:backend-tests` cannot complete on this 16GB box** — tried again at s27, OOM at
    ~4GB after 214s. CI runs it. `electron/dist` in `ps` matches the MCP servers: **six "editors"
    were all `noodl-mcp.cjs`** at s27 open. Read `ps -o command=` before believing one.
