# Phase 82 — next session

## The board, re-derived from [`TASKS.md`](TASKS.md) at 2026-09-03, session 26

🔴 **Re-derive it again yourself.** This phase has now been overtaken seven times by a ruling or a
row that landed after a handoff was written. **The task files are the board; this section is a
convenience.** ⚠️ s20 said *"there is no fully-buildable row left"*, s22 said *"every row is CLOSED
or waiting on Richard"*, s23 said the same of rows 6/6b, s24 said rows 6 and 6b were down to
Richard's look, s25 built a whole session out of a finding s24 had **registered and deliberately not
built** — and s26 did it again, out of a finding **s25** registered and did not build.
✅ **Read the FINDINGS a row owns, not only its status.**

| # | row | state |
|---|---|---|
| 6 | REL-002c — every page as good as the homepage | 🟢 **Everything a session can do is done.** s24 read the phone column; s25 built the tags; s26 put the heading inside the landmark. ⏳ **RICHARD'S LOOK** + the four judgements §7.3 names |
| 6b | [REL-010](REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md) | ⏳ **RICHARD'S LOOK.** AC1–AC5 met s15, AC6 is a person. ✅ The pictures are current — **re-taken s26 and byte-identical to s25's and s24's** |
| 7 | REL-001 — publish the members' area | ⏳ **RICHARD.** *fix first, publish once*. ✅ **Nothing stands against this row**: s25 gave the artefact an outline, s26 made the outline correct |
| 8 | REL-004 — cut and tag `v0.2.2` | 🔴 **Blocked**: `cline-dev` unpushed (**669** at s26 close — re-derive at cut time), CI has run on none of it |
| 9a / 9b / 10 | REL-011a / REL-011b / REL-009b | 🟢 CLOSED s17 / s19 / s21 |
| 9c | REL-011c — the three surfaces reach PASSABLE | 🟡 AC1 + AC2 met, all findings built. ⏳ AC3 is Richard's ruling |

## 🟢 What session 26 did

One job, taken from s25's §8.5 item 2 — registered, owner `NONE`, explicitly not built.
Write-up: **[REL-002c §9](REL-002c-WHAT-I-WOULD-CHANGE.md)**.

**The `h1` was outside the `<main>` on twelve of the thirteen pages** — not the nine §8.5 named.
`/` alone was right, and only because it had no `ground` for s25's shortcut to be taken on.
`PAGE_GROUND` loses `as: 'main'`; **`pageMain`** (11 pages, in `pageShell()`) and **`joinMain`**
(`/join`'s twin of `landingMain`) carry it, wrapping the head band **and** the ground. **13 of 100
files changed; 553 → 565 nodes; 493 connections both sides.**

### 🔴 The gate that shipped the tags one session ago stays entirely GREEN on the defect

That is the transferable half. §8.1 counts an `h1` per page and §8.2 counts a `main` per page, and
**both are satisfied by twelve pages where the two are siblings.** A census is a count; a count
cannot see a relationship. Run against the s25 artefact, §8.7 goes red naming all twelve pages while
§8.1–§8.4 and the §8 control stay green.

### 🔴 And a parameter is an intention — §11 takes the same claim in the browser

Nothing on disk says the runtime emits a `<main>` for `as: 'main'` on a `Group`, or that the node
tree and the DOM tree agree. Both were assumed by this change. So `tpl001-members-drive.test.ts`
gained **§11**, over the twenty page loads that drive already takes against a real backend:

| | s25 artefact (reverted arm) | HEAD |
|---|---|---|
| loads whose `<h1>` is inside their `<main>` | **0 of 17** | **20 of 20** |
| loads with exactly one `<main>` and one `<h1>` | 20 of 20 | 20 of 20 |
| `<nav>` inside the `<main>` | 0 | 0 |

The middle row is the point: the census arm stayed green through the reverted arm. The `<nav>`
control is what makes the first row mean anything — a probe that answered *"inside"* for everything
in the document would pass it on every page ever written.

### The pictures, and why "everything identical" is a reading here

**200 of 200 PNGs and 100 of 100 text dumps byte-identical**, while `artefactTreeMd5` moved on both
arms (`eeb3b2f0` → `b7b30627`, `bf0e9ac3` → `bac9598a`). The pin excludes the stale-artefact
explanation **from inside the same run**.

### The readings taken, in full

| gate | reading |
|---|---|
| `tpl001Template.test.ts` | **79/79, EXIT=0** (77 before §8.7's two) |
| `noodl-mcp` full jest | **92 suites / 1233 tests, EXIT=0** |
| `tsc --noEmit -p packages/noodl-mcp` | **0 errors, EXIT=0** |
| `tpl001-members-drive.test.ts` (real backend + browser) | **63/63, EXIT=0** (59 before §11's four) |
| `vib001-members.look.ts` | **EXIT=0, 2/2, 200 shots** |
| `noodl-editor` `test:main` | **412 suites / 6847 tests, EXIT=0** |
| `noodl-editor` `test:ci` | **2943 specs, 5 failures, seed 97192, HEAD `2c494793`** — four `AIX-006 style vocabulary` **by name** plus the known order-dependent fifth (`pending project saves … re-arms a held save`) |

## ⬅️ What is left

1. ⏳ **Rows 6, 6b, 7 and 9c are RICHARD'S**, and nothing stands against 6/6b/7 any more.
2. 🔴 **Row 8 needs a push**: **669** commits ahead of `origin/cline-dev`, CI has run on none.
3. ⚠️ **The site-builder template has no outline gate.** It ships 26 `as` tags and nothing holds
   them there; §8/§8.7 cover the members' area only and §11 drives only this template. **This is the
   strongest buildable candidate left, and it is the same two files' worth of work s26 did.**
   **Owner: NONE.**
4. ⚠️ **Still not run, carried from s23/s24/s25**:
   `packages/nodegx-backend/tests/ac2-page-editor-drag-drive.test.ts`. Judged not worth a drive,
   **not** measured. Owner: whoever cuts REL-004.
5. ⚠️ **Registered, owner `NONE`**: `/Site/ContactForm`'s stale comment block in
   `sb006Components.ts` (~1242). Stale prose, not a defect.
6. ⚠️ **REL-010 AC4 and REL-002c §8.5 both say "the nine chrome pages"; the artefact says EIGHT.**
   The gate asserts eight now. Neither doc was edited — **`README.md` carries a peer's uncommitted
   paragraph** and REL-010's own text is Richard's reading material.

## Working rules for this tree — carried forward, plus what s26 earned

1. 🔴 **A CENSUS COUNTS THINGS; IT CANNOT SEE A RELATIONSHIP BETWEEN THEM.** "One `h1` per page" and
   "one `main` per page" were both green on twelve pages where the `h1` was outside the `main`.
   ✅ **When a gate is a count, ask what arrangement of the same count would be wrong** — and if one
   exists, that is the spec you are missing.
2. 🔴 **A PARAMETER IS AN INTENTION.** An assertion about a value in a file says nothing about what
   the runtime does with it. ✅ **Take the claim one layer down where a harness already goes** — §11
   rides twenty page loads the members drive was already making, and cost one `page.evaluate`.
3. 🔴 **A CONTAINMENT CHECK NEEDS A THING THAT IS DELIBERATELY OUTSIDE.** Without the `<nav>` arm,
   a probe that answered *"inside"* for the whole document passes every page. The control has to be
   a known negative **in the same document**, not merely an absence elsewhere.
4. 🔴 **MEASURE THE ARTEFACT BEFORE BELIEVING THE NOTE THAT REGISTERED IT** — §8.5 said nine pages
   and one shape; it was twelve pages and three, one of which (`/join`) is not built on `pageShell`
   at all and needed its own wrapper.
5. 🔴 **AN INVISIBLE CHANGE NEEDS AN INSTRUMENT THAT IS NOT A PICTURE — and the picture is still
   worth taking, as the OTHER half of the pair** (s25). ✅ **When a null result is the answer you
   wanted, name the broken instrument that produces the same null, then find the reading that
   excludes it** — here, `artefactTreeMd5` moving on both arms.
6. 🔴 **CHECK WHOSE VERDICT DIRECTORY YOU ARE ABOUT TO WRITE INTO** (s24). `judge()` keys by
   `today()`, and 2026-09-03 now holds s24's, s25's and s26's runs. ✅ Snapshot the committed tree
   to scratchpad **before** running and diff against that copy.
7. 🔴 **A LITERAL COUNT GATE ONLY WORKS IF SOMEBODY RUNS IT** (s23). ✅ Touch the template artefact
   ⇒ mcp jest + `tpl001-members-drive` + `test:main` **and** `test:ci`.
8. 🔴 **COMMIT BY PATHSPEC, NEVER `git add`** — except untracked paths, which a pathspec commit
   **skips silently**. ⚠️ `phase-82/README.md` and `packages/noodl-mcp/tests/sbr011LivePreview.test.ts`
   carry a peer's uncommitted work; **s26 left both alone**, as s24 and s25 did.
9. 🔴 **NEVER OPEN `templates/members-area` OR the site-builder template IN THE EDITOR.** Work
   through `npm run template:members` / `template:site-builder`.
10. ⚠️ **The Bash tool reaps an `&`-backgrounded pipeline.** Use the tool's background mode and gate
    on an exit file you write yourself — **a task-completion notice reporting "exit code 0" is the
    WRAPPER's status, not the command's.** s26's mutant drive notice said 0 while the exit file said
    1, which was the whole result of that run.
11. ⚠️ **`test:ci`'s readout is `packages/noodl-editor/tests/test-results.json`**, not
    `packages/noodl-editor/test-results.json`. The runner deletes and rewrites it itself; check the
    `gitHead` and the mtime rather than deleting the wrong path and believing you armed the guard.
12. ⚠️ **The box is shared. Announce a SUITE the way you announce a launch**, and announce the
    teardown to everyone you announced the launch to. ⚠️ **`typecheck:backend-tests` cannot complete
    on this 16GB box** — CI runs it. ⚠️ `electron/dist` in `ps` matches the MCP servers: **five
    "editors" were all `noodl-mcp.cjs`** at s26 open. Read `ps -o command=` before believing one.
