# Phase 82 — next session

> ### 🟢 THE GATE LANE, 2026-09-05 (s44) — added beside the other lanes, not over them
>
> **`test:main` now reads 423 suites / 7086 tests, EXIT=0, ZERO reds — the first fully green
> reading in this phase's record**, and it was taken *with* a peer's 7-suite jest overlapping it.
> Committed as **`b3037aa1`**. Getting there meant three separate faults, not the one that was
> registered.
>
> **1. `rel-009b/projectFileWatcher.test.ts` was a stopwatch.** A flat **600ms** budget for a
> **60ms**-debounced `fs.watch` event. The number nobody had taken: the batch lands at **73ms**
> (5 runs, 72–74ms), so the budget was **~8× headroom on a chain of timers** and two concurrent
> suites ate it. It waits on the **event** now — **278ms**, was 607ms.
>
> 🔴 **THE FIX WAS WRONG UNTIL THE GATE WAS READ TWICE.** jest's default per-test timeout is
> **5000ms** and the ceiling was 10s, so **the ceiling could never be reached**: the stopwatch had
> merely moved from the spec to the runner. Whole-gate run #1 **passed** (at 6.18s of suite time
> against 278ms alone — already on the boundary while reading green); run #2 **died on the runner
> timeout**. ✅ Ceiling is 30s with an explicit **35s `it()` timeout** above it, and they move
> together. **A single green gate run would have shipped this.**
>
> 🔴 **Three of the arms were wrong before they were right, and every correction came from READING a
> control rather than adjusting it.** (a) Arm C — ceiling cut below the latency — **PASSED**: the
> 200ms settle is itself a wait and supplied what the ceiling refused, so the ceiling was
> **decorative** and a later trim would have re-introduced the bug. Fixed by latching the answer
> before the settle is spent. (b) The first latch was a bare `expect()` **before** `watcher.stop()`,
> so a failure leaked the `fs.watch` handle and **jest never exited** — failed correctly in 35ms,
> then sat **7 minutes** until killed, **EXIT=143 not 1**. A spec that HANGS the gate is worse than
> one that reddens it. (c) Arm A briefly read **`Tests: 0 total`** — built by surgery it stripped the
> latch declaration and left its assertion, grading nothing while looking like a red. **16 total in
> every arm is what says each one graded something.**
>
> ✅ **The defect is reproduced DETERMINISTICALLY without loading the box** — stretching the
> watcher's own debounce to 900ms past a 600ms budget *is* "the callback was not scheduled in time".
> No peer's drive had to be disturbed to get a red.
>
> **2. 🔴 `sb-007/site-template.test.ts` was red at HEAD, from ANOTHER PHASE, and no per-package run
> could see it.** `expect(a.size).toBe(401)` against a template holding **406**. Reconciled exactly
> rather than adjusted to fit: **`f77e6647` (P77/SBR-007 AC3, 13:37 the same day)** adds five ids to
> `/Admin/SectionRow` — `dropZone`, `dropHint`, `dropWords`, `dropRefused`, `dropRefusal`.
> **401 + 5 = 406.** The gate lives in `noodl-editor`, the nodes live in `noodl-mcp`, **so a
> per-package run on either side is green** — the registered *"a literal count gate only works if
> somebody runs it"* trap with a package seam under it. ⚠️ **The count was reconciled; the FEATURE
> was not reviewed** — SBR-007 is phase 77's.
>
> **3. 🔴 REGISTERED, OWNER `NONE` — the stopwatch class is NOT unique.**
> `bld-004/reasoningChannel.test.ts:198,230` and `aib-009/turnDeadline.test.ts:19,94–117` both run a
> **60ms** stall window against a `sleep(STALL_MS / 2)` heartbeat — a **2× margin**, tighter than the
> 8× that was failing. **`bld-004` is the OTHER red s40 recorded and wrote off as "a lone red under
> concurrent load": the two reds in that session were ONE FAULT WITH TWO HOMES.** ⚠️ The source is
> **not** at fault — `turnDeadline.ts:27` reads `Date.now()` deliberately because Chromium throttles
> `setTimeout` in an occluded window, and there is no clock seam; the fix is spec-side (raise
> `STALL_MS`, keep the beat small in absolute terms). **Untouched here — they belong to BLD-004 and
> AIB-009.**
>
> ⚠️ **The `b3037aa1` baseline is NOT a clean-HEAD reading**: the tree carried another lane's
> uncommitted SBR-011/D46 realtime work throughout, and that lane said so before the run. It is
> **HEAD + D46 + two test files**.
>
> ⚠️ **`b3037aa1`'s message has one cosmetic gap** — backticks in a `-m` string were
> command-substituted, so *"Arm A briefly read `Tests: 0 total`"* lost its quoted phrase. A peer
> committed on top before it could be amended and shared history was not rewritten for a cosmetic
> defect. **[§6.4](REL-009-THE-WRITE-THE-EDITOR-CANNOT-SEE.md) carries the correct statement.**
>
> ⬜ **The phase's own queue is unchanged and still Richard's** — see §A below. This lane touched no
> REL row's ACs; it fixed the gate every other row is read through.

> ### 🟢 THE DRIVE LIST IS EMPTY, 2026-09-05 (s43) — added beside the other lanes, not over them
>
> **The last three undriven items are driven, and none of them needed a fix.** A freshly placed
> **Dropdown** renders **64.09px wide showing "Option 1"** (panel: *Items* "2 items", *Value*
> "option-1"); a pasted **YouTube** share link becomes one
> `youtube-nocookie.com/embed/…?start=90` **iframe with zero `<video>` elements**, and the poster
> frame really loads; the **Shape** enum offers all six values and **every `dynamicports` gate holds
> on all six arms**, each printing its own sentence. Full record with the tables:
> [NOTES §5](NOTES-UNOWNED-NODE-WORK.md).
>
> 🔴 **A control, not an assertion, is what makes the Dropdown reading mean anything.** With `value`
> set to something matching no item the wrapper collapses to **4px with no span at all** — and
> `select.value` **still reports `option-1`** in that arm, because the browser refuses an unmatched
> value. **Anyone grading this node through `select.value` would have passed both arms.** The
> original arm was re-run afterwards and came back byte-identical (`64.0859375`).
>
> 🔴 **THE INSTRUMENT WAS WRONG FIRST AND HAD A SOURCE CITATION TO PROVE IT.** Reading the panel by
> label text made every shape look identical, and `nodelibrary.ts:100` really does have the
> `conditionalports` manager commented out — a perfect fit for *"the gates never reach the panel"*.
> **They do**: this panel greys an inapplicable port and explains it
> (`div.property-port-gated-control[aria-disabled=true]`), which no label query and no
> `getComputedStyle` on the label can see. **One screenshot was the discriminator and should have
> been the first instrument.** ~⅓ of the session.
>
> ⚠️ **Two things the drive did NOT measure**, so do not read them as green: the spurious-`Changed`
> claim (nothing was wired to `onChange`) and *Start Time beats a URL `t=`* (only the URL was set).
>
> ⚠️ **The stack died once mid-drive** — every Claude process on the box restarted, the launcher went
> with it, and all peer session names changed. The launch announcement went to names that no longer
> exist. Nothing was lost; the drive was simply re-run.
>
> ⬜ **What is left in the phase is now, with no exception, Richard's** — §A's queue below. There is
> no buildable and no drivable row behind it.


> ### 🟢 THE DRIVES LANE, 2026-09-05 (s42) — added beside the other lanes, not over them
>
> **The two rows that were "asserted only" are now measured, and neither needed a fix.**
>
> **REL-012 — all five ACs graded, from ASSERTED-ONLY to a reading.** AC2/3/4 by
> `npx jest tests-unit/rel-012` (**2 suites / 30 tests, EXIT=0**). **AC1 on a real packaged
> artefact** built here (`build:bundles`, then `electron-builder --mac --arm64 --dir`, both EXIT=0):
> `NodeGX.app/Contents/Resources/lessons` present, **4 bundles / 122 files**, and the reverted arm
> was already on disk — the **2026-08-20 build has no `lessons` directory at all**. 🔴 The stowaway
> filter was graded **with a presence control**: the source really does carry two `.mcp.json` files
> naming a developer's absolute paths, and **124 − 2 = 122** reconciles exactly. **AC5 driven, both
> arms**: a clean profile seeds 3 lessons and *Log a thing* opens; the reverted arm (the one
> `seedShippedLessonsOnStartup()` line disabled) lands on *Your path* with **no register file
> written at all**. ⚠️ A peer has since committed a 4th and 5th bundle — the 4/122 reading is the
> artefact that was measured, not a claim about today's tree.
>
> **REL-016 — all five pre-ungate checks PASS**, so FIX-015's *"expect a bug list"* did not hold.
> 🔴 **But the gate is not what the row thought**: `if (config.devMode)` at `router.setup.ts:435` is
> dead in **every** build — `config-dev.js` is required by nothing — so `design-tokens`,
> `file-explorer` and `undo-queue` register **nowhere, dev included**. Measured as an A/B on the
> live experimental-panels list (6 entries, then 9). ⚠️ And un-gating is **two** gates:
> `experimental: true` keeps it behind a per-user Settings toggle that is off by default.
>
> 🆕 **New instrument, and the only source change left in the tree:**
> `packages/noodl-editor/scripts/start-electron-dev.js` now honours **`NOODL_USER_DATA_DIR`**
> (Chromium's `--user-data-dir`), which is how a *first-run* drive is done without touching the
> developer's own profile. ✅ Richard's `learning_folder.json` md5 is **unchanged across the whole
> session**. **Uncommitted, and not asked for.**
>
> ✅ **The board was stale in two more places and both are corrected off the commits**: REL-013
> (`14c9bd90`) and REL-014 (`9d58c505`) were ⬜ and are built. Full records:
> [REL-012](REL-012-THE-LESSONS-NOBODY-RECEIVES.md) and
> [REL-016](REL-016-THE-TOKENS-NOBODY-CAN-EDIT.md).
>
> 🔴 **Two editors cannot coexist on this checkout** — a second Electron on a second profile reaches
> `DevTools listening` and then aborts on *"async hook stack has become corrupted"* (port 8574 taken
> → `showMessageBox` from a `net` error handler). Every control arm here therefore costs a full
> stack restart.
>
> ⬜ **Still undriven, and now the whole of the drive list**: a freshly placed Dropdown, a YouTube
> link in a Video node, the Shape node's five shapes in the property panel.


> ### 🔴 SITE-BUILDER LANE, 2026-09-05 — added beside another session's handoff, not over it
>
> **The 9-SHITTY ruling on REL-011c AC3 was taken on pictures wearing the HARNESS's palette.**
> `vib001-site.look.ts` seeded a `Theme` row with four invented values; `#1f6feb` — §3 seam 1's
> *"the framework's default blue"* — is that seed's `colorPrimary` byte for byte, on 9 of the 10
> screens. The **door** arm, which seeds nothing, renders Studio's `#1e4d8c` correctly and was the
> control all along. Seam 4's "gradient rectangles" were the seed's `SWATCH` too.
> **Fixed** (a shipped preset, imported; four real photographs), and the door arm is **byte-identical
> across the change** — 32 PNGs, combined `md5=6d90f842`.
>
> **§3 seam 3 WAS the product, survived the instrument fix, and is built**: `minHeight: 100vh` +
> `alignItems: 'stretch'` on `Admin frame`, and the rail to `sizeMode: 'contentHeight'`. Four
> pixel-sampled arms; 🔴 **arm 3 (`stretch`) moved nothing** — a three-arm run would have shipped it.
>
> ✅ **COMMITTED 2026-09-05 (s41) as `02a3c924`**, on Richard's instruction, once the peer's
> `p18-row8` merge had landed and `MERGE_HEAD` was gone — the five files exactly, by pathspec, with
> `createProject.ts`, `validate.ts` and `sbr011LivePreview.test.ts` (three OTHER lanes' uncommitted
> work in the same package) untouched. Readings as recorded: `noodl-mcp` **93 / 1261 EXIT=0**;
> `test:main` **423 / 7086 EXIT=0**.
>
> ✅ **The +3 unattributed tests are NAMED — and no suite was run to do it.** They are a peer's
> commit landed **between the two arms**: `5f407849` (the members-area lane, 08:54) adds exactly
> three `it()` blocks to `tpl001Template.test.ts`, and its own message records the whole-suite
> reading — **93 / 1260**. So **1257 + 3 + 1 = 1261**. 🔴 **§8's registered trap, one level up**: the
> four LOOK arms were flagged artefact-varied-not-commit-controlled and the two SUITE arms had the
> identical defect unnoticed. Full record: [REL-011 §8](REL-011-THE-SITE-BUILDER-SHIPS.md).
>
> 🟢 **s41 also closed the five-seam audit and built the `<h2>` gate** — [§9](REL-011-THE-SITE-BUILDER-SHIPS.md)
> and [§10](REL-011-THE-SITE-BUILDER-SHIPS.md), commit below.

---

## 🔴 SITE-BUILDER LANE, s41 — what changed, and what the next session must NOT do

**Two commits: `02a3c924`** (s40's build, held back only by the peer's merge) **and `d8af6e5d`**
(this session). ⚠️ **Three other lanes' uncommitted files live in the same package and were left
alone** — `createProject.ts`, `validate.ts`, `sbr011LivePreview.test.ts`.

### 1. 🟢 The five seams are audited to the end — and the list is TWO, not five

§8 measured seams 1, 3 and 4 and stopped. **Seams 2 and 5 had never been re-read against the
corrected instrument at all.** Read off the 09-05 living shots beside the 09-03 shots he **actually
ruled on**, then confirmed in the artefact:

| # | §3's seam | verdict |
|---|---|---|
| 1 | the framework's default blue | 🟦 **harness** — gone |
| 2 | ruled rows + outline-secondary pills | 🔴 **PRODUCT** — `/Admin/PageRow` is all tokens, so the seed fix repainted the idiom and changed none of it |
| 3 | the shell does not fill the screen | 🔴 **product** — built |
| 4 | gradient rectangles | 🟦 **harness** — gone, four real photographs |
| 5 | one column, one rhythm | 🔴 **PRODUCT** — `shell` is the ONLY node stating a width; every section of all five kinds runs through one `/Site/SectionView` at one padding |

🔴 **A fourth round aimed at §3 as written would spend two of its five items on the harness.** What
is left to re-show him is **seam 2 and seam 5**.

⚠️ **This is not a licence to build either of them.** The template is **held**, phase 77 owns it, and
[§4](RICHARD-RULINGS-2026-09-04.md) is explicit: nothing about the look is built until he names the
seam, and he has already **declined three readings a session offered**. §9 names where the work would
land and stops there deliberately.

### 2. 🟢 `<h2>` order — the residual this lane registered TWICE — is built, and GREEN AT HEAD

`headingOrder.ts` + `headingOrder.test.ts`: **20 pages across both artefacts, 0 skipped levels.** A
checker over the corpus that exists, and the corpus passes — said out loud rather than dressed up.

🔴 **The trap it was built around**: `/Pages/Site`'s own tree holds **one** heading; the other five
arrive through `/Site/SectionView`, which is **not a child of anything** — it is the `template`
**parameter** of a `For Each`. A walker following only children reports every site-builder page as a
lone `h1` and calls it well-formed: *the answer the gate wants, arrived at by seeing nothing.* Pinned
by cardinality, and the fault detector is graded on synthetic sequences before it is aimed at
anything. Mutant on the real artefacts: **3 red of 29 that all ran**, both files restored
byte-identical.

### 3. ⬜ What is left in this lane, in order

1. ✅ **DONE — the full `noodl-mcp` suite reads `94 suites / 1290 tests, EXIT=0`**, taken the moment
   the peer announced their stack was down. It had been written down as a **prediction** first, and
   then measured. ✅ **It closes §8's register row a second way**: +1 suite and **+29 tests = exactly
   the new file's specs**, so nothing else moved.
2. **Re-take §8.3's four arms on ONE commit.** They were taken at four different commits while peers
   landed work; the artefact for each is regenerable from §8.4.
3. **Everything else here is Richard's** — the fourth round, and the V2 *"modern CSS"* seam, which
   [§4.1](RICHARD-RULINGS-2026-09-04.md) says **must not be turned into a task by guessing**.

**Session 40 built the last buildable row on the queue.** All four of Richard's §7.3 judgements are
now answered *and* built. What remains is what session 39 said remained: **his content, his
decisions, and four drives** — plus one thing session 40 found while checking the board.

**Read [`RICHARD-RULINGS-2026-09-04.md`](RICHARD-RULINGS-2026-09-04.md) §9 first** — it is the build
record for judgement 4 and it carries the one register row this session opened.

---

## ✅ WHAT SESSION 40 SHIPPED — one commit, `5f407849`

**Judgement 4** — *"`/` and `/members` unauthenticated are byte-identical… send them to `/sign-in`
instead."* The six protected pages' refusal navigator now targets `/Pages/SignIn`.

🔴 **REL-002b is untouched, and that is the shape of the change.** Same `Denied` signal, same two
producers, same six pages, same fail-closed. **Only the destination moved** — `connections.json` is
byte-identical on all six pages, and the artefact diff is **6 files · 6 targets · 6 labels · nothing
else**. `Members/Chrome`'s own navigator still goes to the landing page, because signing out is not
a refusal.

| gate | reading |
|---|---|
| `tpl001Template.test.ts` | **82/82, EXIT=0** (79 before) |
| the same file, **reverted arm** | **EXIT=1**, 1 red of 82 **that all ran**, by name |
| `noodl-mcp` full jest | **93 suites / 1260 tests, EXIT=0** |
| `rel002b-fail-closed.test.ts` (real backend, real browser) | **38/38, EXIT=0** (37 before) |
| `tpl001-refused-query.test.ts` (real backend, real browser) | **6/6, EXIT=0**, D4 still `LEGIBLE` |
| `tsc --noEmit -p packages/noodl-mcp` | **0, EXIT=0** |
| `npm run template:members` | **clean no-op BEFORE the edit**, so the diff is attributable |

---

## 🔴 THE FOUR FINDINGS WORTH CARRYING FORWARD

### 1. A byte gate cannot hold a ruling

`tpl001Template.test.ts` §1 proves the artefact is byte-for-byte what the generator writes. **That is
green for any destination** — revert the generator, regenerate, and §1 passes. Judgement 4 would have
been held by a comment and nothing else. §5b now grades the destination itself, and **derives the
gated pages from the graph** (every `Denied` wire reaching a `RouterNavigate`) rather than listing
them, so a seventh protected page with a wrong ejection reddens instead of passing.

⚠️ **The first draft of its control was WRONG and the failure was the useful part**: it asserted the
band held exactly one `RouterNavigate` and read **seven** — the band *is* the navigation. Counting
would have graded the menu; the control now finds the sign-out destination by **the wire that fires
it**.

### 2. 🔴 Renaming the node id would have INVERTED a spec's verdict

The tidy-up — `toLanding` → `toSignIn` — was measured and rejected. Ids are unique **project-wide**
(`toSignIn`, `-2`, `-3`, `-4` already exist), so renaming six renumbers the rest **by component
authoring order**. And `tpl001-refused-query.test.ts` addresses this exact node **by literal id**
when it pushes its twin's wire: a rename aims that wire at a node that does not exist, the arm
navigates nowhere, and *"the refused arm did not move"* reads as **"a refusal is SILENT to the
graph"** — the exact inverse of D4's answer, with no platform change at all.

✅ That spec now **derives** its expected URL from the artefact in two hops (`target` → the page's
`urlPath`), so a future retarget moves the spec instead of silently inverting it.

### 3. `projectFileWatcher.test.ts` reddens `test:main` whenever the box is busy

**Two `test:main` runs, both `423 suites / 7086 tests` with exactly ONE red** — `REL-009b › reports
the component when a real two-phase save lands in it` — and **16/16 EXIT=0 when run alone**. It
waits **600ms** for a debounced (60ms) `fs.watch` event in a temp directory; under two concurrent
peer suites that budget blows. It imports nothing this session touched.

⚠️ **So `test:main` was NOT read green here**, and the honest statement is: identical suite/test
counts to the `335be2e9` baseline, one load-sensitive red, green in isolation, and **the three
editor specs that actually read `templates/members-area` — `def-002`, `def-009`, `def-025` — passed
in both runs.** 🔴 **Registered, owner `NONE`: that spec needs a wait that is not a stopwatch, or
this repo's most-used gate is red on a busy box for ever.**

### 4. 🔴 The board's status column is stale in BOTH directions — re-derive from the FILES

`TASKS.md` still showed **REL-012 as ⬜ BLOCKS 0.2.2** and **REL-014 as ⬜**, and both were built and
committed by session 39 (`ead2d04f`, `9d58c505`). It also still said *"judgements 1 and 4 are still
unbuilt"* when judgement 1 shipped in `0b72b600`. **Only the REL-002c sentence was corrected here**,
because it is this row's own and it was measurably false; the others were **read, not flipped**:

🔴 **REL-012's ⬜ may well be CORRECT rather than stale.** Its own file ends *"Not run here — no
suite, no tsc, no webpack, no build, no editor. Every AC is ASSERTED-ONLY."* **AC1 wants a packaged
artefact inspected and AC5 wants a clean profile opening the Learning tab in a running editor** —
neither has been done by any session. **It is the 0.2.2 blocker and its two hardest ACs are the two
nobody can grade headlessly.** Do not mark it green off the commit.

---

## §A THE QUEUE — what is left

### ⬜ Everything here needs Richard. There is no buildable row behind it.

| what | what unblocks it |
|---|---|
| **Default tutorial content** (FB-012, phase 75) | his brief |
| **The empty template shelf** (FB-005, phase 75) | closes on **REL-001**, publishing the members' area |
| **REL-015 AC9/AC11** | two YouTube links and one real tutorial, his content |
| **REL-001 — publish** | ⏳ cleared by D2; `/unsubscribe` was re-ruled PASSABLE, so the condition is met |
| **REL-004 — cut and tag `v0.2.2`** | his. `cline-dev` is far ahead of `origin`; **RE-DERIVE the count at cut time**. Pushing is his standing decision — **do not push, do not re-raise** |
| **The V2 "modern CSS" brief** | his seam. 🔴 **Must not be turned into a task by guessing** — he declined three readings already ([rulings](RICHARD-RULINGS-2026-09-04.md) §4.1) |
| **A seam for REL-002c** | §4.2 — fourteen PASSABLE verdicts arrived with no why. **One** would do: the page he would call *nearly* worthy, and the single thing keeping it there |

### 🟢 The drives — ALL FIVE ARE DONE (s42 took 1–2, s43 took 3–5)

Written when nothing had ever run in a real editor. It is now empty, and that sentence is kept only
so the next reader can see what it cost to empty it.

1. ✅ **REL-012 AC1 + AC5** — s42: a real packaged artefact (`lessons` present, 4 bundles / 122
   files) and a clean-profile first run seeding 3 lessons, both arms.
2. ✅ **REL-016's five checks** — s42: all five PASS. 🔴 But `config.devMode` is dead in **every**
   build, so the three panels register nowhere; un-gating is two gates, not one.
3. ✅ **A freshly placed Dropdown** (`9f5ae5a7`) — s43: **64.09px, "Option 1" on screen**, panel
   reads *2 items* / *option-1*; control arm collapses to **4px**. [NOTES §5](NOTES-UNOWNED-NODE-WORK.md).
4. ✅ **A YouTube link pasted into a Video node** (`a97738b6`) — s43: one
   `youtube-nocookie.com/embed/…?start=90` iframe, **zero `<video>`**, poster frame loaded.
5. ✅ **The Shape node's shapes in the property panel** — s43: **six** values offered (five drawn
   plus Custom SVG), and every gate correct across all six arms.

---

## §B REGISTERED, OWNER `NONE`

| finding | where |
|---|---|
| 🆕 **Judgement 4 costs the UNBOUND first run its explanation** — with no backend bound an ejection now lands on a painted door whose form cannot work, rather than on the page carrying the waiting card. **Not put to him**; the remedy (split the destination by producer) would reverse REL-002b's *"the refusal is unconditional"* on a reading nobody asked for | [rulings](RICHARD-RULINGS-2026-09-04.md) §9.5, and in the spec beside the assertion |
| ✅ ~~**`projectFileWatcher.test.ts` is a stopwatch race**~~ — **FIXED s44 (`b3037aa1`)**, and the sweep found the same class in `bld-004`/`aib-009` (below) | the gate lane at the top |
| 🆕 🔴 **`bld-004/reasoningChannel.test.ts` and `aib-009/turnDeadline.test.ts` run a 60ms stall window on a 2× margin** — the same defect class, and `bld-004` is the OTHER red s40 called a flake. Spec-side fix; the source is correct | gate lane §3 |
| **`noodl-core-ui`'s jest runs in no CI gate** — it caught a real drift and nobody saw it | session 39 |
| **Fill/Stroke are inert for a custom SVG shape**, deliberately ungated | [`NOTES`](NOTES-UNOWNED-NODE-WORK.md) §1 stage 3 |
| **`/unsubscribe` has three left edges** — the defect REL-002c fixed on `Pages/Post`, surviving on a door page | [rulings](RICHARD-RULINGS-2026-09-04.md) §6.5 |
| **The workbench dropdown fix is UNGATED** — `@testing-library/react` is not installed | [`TESTING-PASS`](TESTING-PASS-2026-09-04.md) §3 |
| **`/unsubscribe`'s ~220px void** — 🔴 he ruled it PASSABLE *having been told the void was there*. **Do not "fix" it without asking** | ruling §6.4–6.5 |

---

## §C WORKING RULES — the ones this session actually needed

0. 🔴 **`tsc -p packages/nodegx-backend/tsconfig.tests.json` CANNOT BE READ ON THIS BOX.** `EXIT=134`,
   OOM, and **its log carries 0 `error TS` lines** — the exact reading that has been mistaken for a
   pass. Narrowing to **two files** still OOMs at 6GB after 393s. ⚠️ And ts-jest runs those specs
   with `isolatedModules: true`, so **the drives do not typecheck them either**. New logic there
   must be exercised some other way — here, by running the function against the real artefact.
1. 🔴 **BUILD THE REVERTED ARM, AND RECONCILE THE COUNTS.** Mutate the **behaviour**, keep the
   **surface**: the six targets went back to `/Pages/Landing` and the generator was **regenerated**,
   so the byte gate stayed green and only the ruling could speak. `81 + 1 = 82` is what says the
   revert compiled; a revert that does not compile grades nothing.
2. 🔴 **A CONTROL THAT FAILS IS DOING ITS JOB — READ IT BEFORE "FIXING" IT.** *"The band holds one
   navigator"* read seven, and the right answer was a better control, not a bigger number.
3. 🔴 **WAIT FOR A PEER'S SUITE, AND CHECK AGAIN AFTER IT ENDS.** Both `test:main` reds landed
   beside other people's jobs; the box had **five live sessions**, a worktree mutant loop, three
   `vib001-site.look.ts` runs and a full `noodl-mcp` suite. `ps -Ao pid,command` before every gate.
4. 🔴 **RESTORE BY ABSOLUTE PATH AND `md5` THE RESULT** — and `diff -rq` the artefact. A compound
   `cd X && …` persisted its cwd into a later call here and made a present file read as missing.
5. ✅ **REGENERATE AS A NO-OP FIRST.** `npm run template:members` was run and diffed **before** the
   edit, so every byte of the later diff is attributable.
6. 🔴 **DERIVE, DON'T TYPE, ANYTHING A RENAME CAN MOVE** — the spec's expected URL, the list of
   gated pages, the sign-out navigator. Every literal here was a place a future edit could invert a
   verdict silently.
7. 🔴 **NEVER `git stash`**, never `isolation: worktree` on this repo; commit **by pathspec**,
   `git add` untracked first.
