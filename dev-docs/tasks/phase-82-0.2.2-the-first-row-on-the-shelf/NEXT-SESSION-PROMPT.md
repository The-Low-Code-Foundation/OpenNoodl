# Phase 82 — next session

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

### 🔴 The drives — still nothing has run in a real editor

Five to six sessions have been live on this box continuously and none of this has been driven. **This
is now the largest unexamined surface in the phase**, and REL-012's AC1/AC5 have joined it.

1. **REL-012 AC1 + AC5** — a packaged build inspected for the lesson bundles, and a clean profile
   opening a non-empty Learning tab. 🔴 **The 0.2.2 blocker's two ungraded ACs.**
2. **REL-016's five checks** before the tokens panel is ungated — listed in that file. The `devMode`
   flag stays put until they pass.
3. **A freshly placed Dropdown** (`9f5ae5a7`) — graded headlessly; his ask is a screen claim.
4. **A YouTube link pasted into a Video node** (`a97738b6`) — the iframe path has never rendered here.
5. **The Shape node's five shapes** in the property panel — gates graded, panel not.

---

## §B REGISTERED, OWNER `NONE`

| finding | where |
|---|---|
| 🆕 **Judgement 4 costs the UNBOUND first run its explanation** — with no backend bound an ejection now lands on a painted door whose form cannot work, rather than on the page carrying the waiting card. **Not put to him**; the remedy (split the destination by producer) would reverse REL-002b's *"the refusal is unconditional"* on a reading nobody asked for | [rulings](RICHARD-RULINGS-2026-09-04.md) §9.5, and in the spec beside the assertion |
| 🆕 **`projectFileWatcher.test.ts` is a stopwatch race that reddens `test:main` under load** | finding 3 above |
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
