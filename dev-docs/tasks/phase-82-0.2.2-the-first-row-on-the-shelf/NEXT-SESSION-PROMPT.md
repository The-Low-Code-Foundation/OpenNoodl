# Phase 82 — next session

## The board, re-derived from [`TASKS.md`](TASKS.md) at 2026-09-03, session 25

🔴 **Re-derive it again yourself.** This phase has now been overtaken six times by a ruling or a row
that landed after a handoff was written. **The task files are the board; this section is a
convenience.** ⚠️ s20 said *"there is no fully-buildable row left"*, s22 said *"every row is CLOSED
or waiting on Richard"*, s23 said the same of rows 6/6b, s24 said rows 6 and 6b were down to
Richard's look — and s25 built a whole session out of a finding s24 had **registered and
deliberately not built**. ✅ **Read the FINDINGS a row owns, not only its status.**

| # | row | state |
|---|---|---|
| 6 | REL-002c — every page as good as the homepage | 🟢 **Everything a session can do is done.** s24 read the phone column; s25 built the semantic tags. ⏳ **RICHARD'S LOOK** + the four judgements §7.3 names |
| 6b | [REL-010](REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md) | ⏳ **RICHARD'S LOOK.** AC1–AC5 met s15, AC6 is a person. ✅ The pictures are current — **re-taken s25 and byte-identical to s24's** |
| 7 | REL-001 — publish the members' area | ⏳ **RICHARD.** *fix first, publish once*. ✅ **s24's one finding against this row is CLEARED** (s25 — the artefact has an outline now) |
| 8 | REL-004 — cut and tag `v0.2.2` | 🔴 **Blocked**: `cline-dev` unpushed (**667** at s25 close — re-derive at cut time), CI has run on none of it |
| 9a / 9b / 10 | REL-011a / REL-011b / REL-009b | 🟢 CLOSED s17 / s19 / s21 |
| 9c | REL-011c — the three surfaces reach PASSABLE | 🟡 AC1 + AC2 met, all findings built. ⏳ AC3 is Richard's ruling |

## 🟢 What session 25 did

One job, taken straight from s24's §4. Write-up: **[REL-002c §8](REL-002c-WHAT-I-WOULD-CHANGE.md)**.

**The members-area template went from 0 semantic tags in 100 files to 63**, and now has a document
outline and landmarks: **one `h1` and one `main` on each of the thirteen pages**, `h2` on band
heads and repeater rows, `h3` on the tiles, `header`/`nav` on the chrome and `footer` on the foot,
`section` on the page sections, `span` on the seventeen lines that wear a heading's size and are
not headings. One source file (`tpl001Components.ts`) + `npm run template:members`. **24 of 100
artefact files changed; two nodes added (551 → 553); no connection added (493 both sides).**

### The two readings, and they are each other's control

| | s24 | s25 |
|---|---|---|
| shots carrying an `h1`/`h2` at render time | **0 of 60** | **60 of 60** |
| PNGs that moved | — | **0 of 120** |

🔴 ***"120 of 120 identical"* is exactly the shape of a run that photographed the OLD artefact** — a
stale copy, a cached bundle, a drive pointed at the wrong directory. It is excluded **from inside
the same run**: the byte-identical shots are the ones whose manifests record 116 headings where
s24's recorded none. An old artefact cannot produce both. Together they say the thing neither says
alone — **the tags are served, and they change nothing a person sees**, which is what a semantic tag
is for.

### ✅ s24's `artefactTreeMd5` earned its keep on the very next change

Door arm: `artefactTreeMd5` **`32c42a43` → `eeb3b2f0`**, while the single-file `artefactMd5` it
replaced read **`f969ad96` on both sides** — unchanged, across 22 component files gaining tags. The
pin s24 built for exactly this case is the only one of the two that could see it.

### ✅ The gate, driven RED on three mutants

Five specs in `tpl001Template.test.ts`. A green census over a tree is worth nothing until it has
been shown to go red, and this one was the vacuous kind — one session ago the same specs would have
read clean against a template with zero tags, had they counted the wrong field. Sabotaged three
ways (a page losing its `h1`+`main`; the chrome losing `nav`+`header`; an `as` put on the nav
`Columns`, a type with no such port); **§8.4 correctly stayed green on the first pair because it is
about the TYPE, not the value.** Files restored and **md5-checked**.

### 🔴 A correction to s24's §7.4 that cost a wrapper

s24's table said `Text` carries `nav`, `header`, `footer`, `section`. **It does not.** `Text`'s
`as` enum is `div|h1…h6|p|span`; the landmark names are on **`Group`**. And **only those two node
types have an `as` port at all** — `Columns` has none, which is why the band's nav needed a wrapper
`Group` (`navWrap`) rather than a parameter. REL-002b's `isSignedIn → mounted` gate **moved up onto
the wrapper rather than being duplicated**: left where it was, a signed-out stranger would have got
an empty `<nav>` on `/`, `/join` and `/sign-in` — a landmark announcing navigation that is not
there. `/` needed a second wrapper (`landingMain`) because it is one of the two pages with no
`ground` node to carry `main`.

### The readings taken, in full

| gate | reading |
|---|---|
| `tpl001Template.test.ts` | **77/77, EXIT=0** (72 before §8's five) |
| `noodl-mcp` full jest | **92 suites / 1231 tests, EXIT=0** |
| `tsc --noEmit -p packages/noodl-mcp` | **0 errors, EXIT=0** |
| `tpl001-members-drive.test.ts` (real backend) | **59/59, EXIT=0** |
| `noodl-editor` `test:main` | **412 suites / 6847 tests, EXIT=0** |
| `noodl-editor` `test:ci` | **2943 specs, 4 failures, seed 23116, HEAD `a013697d`** — the floor, all four `AIX-006 style vocabulary` **by name** |
| `vib001-members.look.ts` | **EXIT=0, 2/2, 60 shots** |

## ⬅️ What is left

1. ⏳ **Rows 6, 6b, 7 and 9c are RICHARD'S** — and 6/6b are genuinely ready: pictures current,
   §7.3's four phone-column judgements named rather than left to be found, and the one product
   finding that stood against REL-001 is now built.
2. 🔴 **Row 8 needs a push**: **667** commits ahead of `origin/cline-dev`, CI has run on none.
3. ⚠️ **The `h1` sits OUTSIDE `<main>` on the nine chrome pages** — `pageHead()` roots in
   `headBand`, which is `ground`'s sibling. Common, legal, not ideal. Fixing it means wrapping in
   `pageShell` and re-photographing. **Owner: NONE — register it before building it.**
4. ⚠️ **Still not run, carried from s23/s24**:
   `packages/nodegx-backend/tests/ac2-page-editor-drag-drive.test.ts`. Judged not worth a drive,
   **not** measured. Owner: whoever cuts REL-004.
5. ⚠️ **Registered, owner `NONE`**: `/Site/ContactForm`'s stale comment block in
   `sb006Components.ts` (~1242). Stale prose, not a defect.
6. ⚠️ **The site-builder has no equivalent gate.** It ships 26 tags and nothing holds them there;
   §8's five specs cover the members' area only. One seam if somebody wants it.

## Working rules for this tree — carried forward, plus what s25 earned

1. 🔴 **AN INVISIBLE CHANGE NEEDS AN INSTRUMENT THAT IS NOT A PICTURE — and the picture is still
   worth taking, as the OTHER half of the pair.** s25's whole result is two readings from one run
   that are each other's control. Either alone is the classic false positive: the census alone
   cannot say the artefact is served, and the pictures alone cannot tell "nothing changed" from
   "nothing was measured." ✅ **When a null result is the answer you wanted, name the broken
   instrument that produces the same null, then find the reading that excludes it.**
2. 🔴 **A PROVENANCE FIELD PINS WHAT IT HASHES, NOT WHAT IT IS NAMED AFTER** (s24) — demonstrated
   live: `artefactMd5` read identical across 22 changed files, one session after s24 diagnosed why.
3. 🔴 **A SHARED CONSTANT IS THE CHEAP SEAM, AND THE EXCEPTIONS ARE WHERE THE THINKING IS.** Seven
   type-ramp constants carried the whole outline; the work was the **two overrides** — the band's
   association name wears a card title's SIZE and is not a heading, and a tile is one level deeper
   than the rows that share its style.
4. 🔴 **A CHECK ON A PORT MUST NAME THE TYPES THAT HAVE IT.** Only `Group` and `Text` carry `as`.
   A parameter on a type with no such port is a value nothing reads and every gate ignores — §8.4
   exists for that, and it is the spec the first mutant pair could not redden.
5. 🔴 **CHECK WHOSE VERDICT DIRECTORY YOU ARE ABOUT TO WRITE INTO** (s24). `judge()` keys by
   `today()`. ✅ s25 snapshotted the committed `2026-09-03` tree to scratchpad **before** running
   and diffed against that copy.
6. 🔴 **A LITERAL COUNT GATE ONLY WORKS IF SOMEBODY RUNS IT** (s23) — and the prior half is that it
   has to **exist**. ✅ Touch the template artefact ⇒ mcp jest + `tpl001-members-drive` +
   `test:main` **and** `test:ci`.
7. 🔴 **A NAMED ROW IS RE-POINTED, NEVER DELETED** (s23). **A MUTANT SHOULD GRADE THE PREDICATE,
   NOT THE ARTEFACT** (s23) — §8's control runs `tagsIn` over a hand-built mutant holding the two
   near-misses that would make the census a tautology.
8. 🔴 **COMMIT BY PATHSPEC, NEVER `git add`** — except untracked paths, which a pathspec commit
   **skips silently**. ⚠️ `phase-82/README.md` and `packages/noodl-mcp/tests/sbr011LivePreview.test.ts`
   carry a peer's uncommitted work right now; **s25 left both alone**, as s24 did.
9. 🔴 **NEVER OPEN `templates/members-area` OR the site-builder template IN THE EDITOR.** Work
   through `npm run template:members` / `template:site-builder`.
10. ⚠️ **The Bash tool reaps an `&`-backgrounded pipeline.** Use the tool's background mode and gate
    on an exit file you write yourself — **`timeout` does not exist here**, and a task-completion
    notice reporting "exit code 0" is the WRAPPER's status, not the command's. s25's `test:ci`
    notice said 0 while the exit file said 1.
11. ⚠️ **The box is shared. Announce a SUITE the way you announce a launch**, and announce the
    teardown to everyone you announced the launch to. ⚠️ **`typecheck:backend-tests` cannot complete
    on this 16GB box** — CI runs it.
12. ⚠️ **`tests-unit/rel-009b/projectFileWatcher.test.ts` has a real-FS timing arm that flakes** — a
    lone red there is a flake until re-run.
