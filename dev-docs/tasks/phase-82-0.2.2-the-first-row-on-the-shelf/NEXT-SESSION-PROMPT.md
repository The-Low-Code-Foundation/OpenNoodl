# Phase 82 — next session

**Session 39 ran the previous handoff's queue end to end.** Job 0 and every buildable row of §B are
committed, gated, and mutant-checked. What is left is §B7 — the rows that need Richard — plus the
drives nothing here could do on a shared box.

**Read [`RICHARD-RULINGS-2026-09-04.md`](RICHARD-RULINGS-2026-09-04.md) and
[`NOTES-UNOWNED-NODE-WORK.md`](NOTES-UNOWNED-NODE-WORK.md) first.** Four new rulings were given on
2026-09-04 and all four are now built; they are recorded in the notes file beside the work.

---

## ✅ WHAT SESSION 39 SHIPPED — 15 commits, `7439efc8`…`335be2e9`

### Job 0 — the uncommitted pile is gone

Richard answered **"commit all eight"**. All eight are in, as seven logical commits, and every
untracked path was `git add`ed first.

| commit | what |
|---|---|
| `7439efc8` | Visual Function: `done`→`Output1` default, and a failure warning that comes back down |
| `b1ae7462` | "Open project folder" reveals the folder, not a `project.json` v2 does not have |
| `16f38e79` | Workbench dropdown sees a component created since the project opened (`.slice()`) |
| `c6db0d32` | Hello World + Site Builder held off the shelf, still installable |
| `ead2d04f` | 🔴 **REL-012 — the 0.2.2 blocker.** Lessons reach the artefact and something seeds the shelf |
| `14c9bd90` | REL-013 — the launcher Templates tab |
| `9d58c505` | REL-014 — a `var()` value survives being touched |

🔴 **Two gates in other phases went red and BOTH WERE RIGHT** (`14ceaa99`):

- **VFN-011's drift gate** builds its runtime node from an enumerated list of members
  `_executeLogic` touches — deliberately, as a tripwire. `_clearFailureWarnings` was not on it, so
  the call threw, the throw was caught, and **all six fixtures reported a runtime error the bench
  did not have**. ⚠️ The failure names `Boolean(bench.error)` disagreeing, which points at *drift*
  rather than at a missing stub member — so when every fixture reddens at once, check that list
  first. **Never derive it**: copying every method off the definition would end the loud failure
  and with it the only signal the runtime's reach has grown.
- **SB-007** asserted the Site Builder row is on the shelf, which ruling D1 has now held off it.
  Its own control (`getTemplateIds()`) passed throughout, correctly reporting registration was
  untouched. The row-shape assertions now run against a provider constructed with nothing held,
  and a new test pins the ruling itself.

🔴 **Neither was visible from the touched directories.** Every per-directory run before each commit
read green. **Only `test:main` sees them.** The previous handoff's §D said `test:main` was not run;
the notes file had in fact recorded both reds and attributed them correctly to the uncommitted pile.

### §B — every buildable row

| row | commit | note |
|---|---|---|
| **B1** Shape stage 2 | `6129076d` | Polygon, Star, `cornerRadius`. All four registries moved together |
| **B2** Shape stage 3 | `0a46e663` | `svgSource` + a shared sanitiser closing `<style>`, CSS `url()`, SMIL |
| **B3** Video start/end | `827ee855` | The Android `#t=0.01` hack becomes the *default start* |
| **B4** YouTube/Vimeo | `a97738b6` | URL parameters only, per his ruling. Auto-detected from the Source |
| **B5** `optionslist` | `0ce92adc` | Direction 1. Landed entirely in the codec, no new UI component |
| — | `9f5ae5a7` | 🔴 **A Dropdown with a selected value CRASHED its own render** (below) |
| **B6** Tokens panel | `335be2e9` | REL-016. Rows are editable; the `devMode` flag is deliberately untouched |

---

## 🔴 THE THREE FINDINGS WORTH CARRYING FORWARD

### 1. A Dropdown with a selected value crashed the render — shipped, and four years old

`Select.tsx` read `props.items.items.length`; `props.items` is a plain array, so that is
`undefined.length` and it **throws**. Present since the initial commit (2024-01-26, `git log -L`),
invisible because it sits behind `selectedIndex >= 0`, false whenever `value` is undefined.

🔴 **`4672d924` made it reachable on every freshly placed Dropdown** by seeding `value` with the
first default item — the node that commit existed to make visible threw instead. It shipped uncaught
because **`Select.tsx` had no render coverage of any kind**. ⚠️ *The commit that exposes a defect is
not the commit that causes it* — but it is the one that makes it a user's problem.

### 2. `TokenPicker` is the wrong component for FIX-015 slice 1

Slice 1 says *"editable rows via the already-built TokenPicker"*. Measured: its callback is
`onTokenSelect(cssVar)` — it chooses **which token a property references** and cannot change a
token's own value, which is the only thing that panel is for. Its zero call sites mean the
*property-side* picker has no host yet — **gap B's work, not slice 1's**. Slice 1's estimate should
not have included it. Full write-up in [`REL-016`](REL-016-THE-TOKENS-NOBODY-CAN-EDIT.md).

### 3. A pre-existing red nobody could see

`noodl-core-ui`'s jest is in **neither `test:main` nor `test:ci`**. Its
`listPortCoverage.test.ts` outputs census was already wrong — 40 against an expected 32 — **before
this session touched anything**, verified by restoring the pre-session catalog and codec at
`bc3d033b`. All 8 extras are `array` outputs on nodes the library gained. Updated with the
derivation, and the two movements kept separate in the header. ⚠️ **That suite needs an owner or it
will drift again silently.**

---

## §A THE QUEUE — what is left

### ⬜ Everything here needs Richard. Nothing else is blocked.

| what | what unblocks it |
|---|---|
| **Default tutorial content** (FB-012, phase 75) | his brief |
| **The empty template shelf** (FB-005, phase 75) | closes on **REL-001**, publishing the members' area |
| **REL-015 AC9/AC11** | two YouTube links and one real tutorial, his content |
| **REL-004 — cut and tag `v0.2.2`** | his. `cline-dev` is now **711 commits ahead of `origin/cline-dev`** (1685 ahead of `origin/main`), measured 2026-09-05. Pushing is his own standing decision — **do not push and do not re-raise it** |
| **The V2 "modern CSS" brief** | his seam. 🔴 **Must not be turned into a task by guessing**; he declined three readings already. [`RICHARD-RULINGS-2026-09-04.md`](RICHARD-RULINGS-2026-09-04.md) §4.1 |

### 🟢 The one small thing he has already answered

**REL-002c / REL-010 judgement 4** — `/members` unauthenticated should navigate to `/sign-in`.
**Answered by him, unbuilt, gates nothing.** Not started here only because the queue ran out of
buildable rows before it; it is a genuine 🟢 for whoever wants a short one.

### 🔴 The drives nothing in session 39 could do

Five sessions were live on this box and none of this was driven in a running editor. In rough
priority:

1. **REL-016's five checks before the tokens panel is ungated** — listed in that file. The
   `devMode` flag stays put until they pass; FIX-015 is explicit that revealing an unexercised
   panel is the wrong verb.
2. **A freshly placed Dropdown** — `9f5ae5a7` is graded headlessly, but Richard's actual ask ("the
   user immediately sees a dropdown with a real option") is a screen claim.
3. **A YouTube link pasted into a Video node** (`a97738b6`) — the iframe path has never rendered in
   a real browser here.
4. **The Shape node's five shapes** in the property panel — the gates are graded, the panel is not.

---

## §B REGISTERED, OWNER `NONE`

| finding | where |
|---|---|
| **`noodl-core-ui`'s jest runs in no CI gate** — it caught a real drift and nobody saw it | this session |
| **Fill/Stroke are inert for a custom SVG shape** and are deliberately left ungated — switching them off needs a condition covering every other shape *including `shape NOT SET`*, changing the panel of every Circle ever saved | [`NOTES`](NOTES-UNOWNED-NODE-WORK.md) §1 stage 3 |
| **`/unsubscribe` has three left edges** — the same defect REL-002c fixed on `Pages/Post`, surviving on a door page | [`RICHARD-RULINGS-2026-09-04.md`](RICHARD-RULINGS-2026-09-04.md) §6.5 |
| **The workbench dropdown fix is UNGATED** — `@testing-library/react` is not installed, and a source-text assertion would pass on dead code | [`TESTING-PASS`](TESTING-PASS-2026-09-04.md) §3 |
| **`/unsubscribe`'s ~220px void** — 🔴 he ruled the page PASSABLE *having been told the void was there*. A consequence of a ruling, not an open defect. **Do not "fix" it without asking** | ruling §6.4–6.5 |

---

## §C READINGS — all taken 2026-09-05, at `335be2e9`

| gate | reading |
|---|---|
| editor `test:main` | **423 suites / 7086 tests, EXIT=0** (was 422/7080 before REL-016) |
| `noodl-viewer-react` | **96 suites / 1271 tests** |
| `nodegx-export` | **68 suites / 2246 tests** |
| `noodl-mcp` | **93 suites / 1257 tests** |
| `noodl-core-ui` | **29 suites / 551 tests** |
| `catalog:check` · `catalog:merge:check --require-coverage` · `catalog:examples` | EXIT=0 · EXIT=0 · 67/67 |
| `tsc` — viewer-react, nodegx-export, noodl-editor | 0 errors each |
| `tsc -p noodl-core-ui` | 50 errors, **all pre-existing**, all in noodl-editor files about unbuilt sibling packages; none in any file touched |

**Not run: `test:ci`.** ⚠️ A peer's `webpack.test-ci` reddens for everyone and the box carried five
live sessions; `test:main` covers the same specs without the webpack. **Not driven in a running
editor** — see the drive list above.

⚠️ **One flake**: `noodl-mcp`'s `projectOwnsBackend` went red once in a full-suite run, passed alone,
and the full suite was green on re-run. Five green mcp readings this session against that one red.

---

## §D WORKING RULES — the ones this session actually needed

0. 🔴 **A SPEC THAT FAILS TO *RUN* REPORTS A CLEAN TEST COUNT.** Hit twice here. A `Tests: 0 total`
   was a **barrel import** dragging `projectmodel` → `bugtracker` into a view spec; the fix was to
   import the two leaf modules. Gate on the **exit status and the suite count**, never on the
   absence of a `✕`.
1. 🔴 **PER-DIRECTORY RUNS DO NOT SEE CROSS-PHASE GATES.** Every commit in Job 0 was green in its
   own directory and two other phases' gates were red. **Run `test:main` before believing a
   package-local green.**
2. 🔴 **RESTORE BY ABSOLUTE PATH AND `md5` THE RESULT.** Every mutant in this session did; a
   compound `cd X && …` persists its cwd into later tool calls, and session 38 lost a restore to it.
3. 🔴 **A REVERTED ARM THAT FAILS TO COMPILE GRADES NOTHING.** The first HELD_TEMPLATE_IDS control
   returned `EXIT=1` with `188 passed, 188 total` — 90 tests never ran, because the reverted source
   had no export to import. ✅ **Mutate the BEHAVIOUR, keep the surface**: removing just the filter
   line gave 2 assertion failures out of 278 that all ran.
4. 🔴 **`git status` IS NOT AUTHORSHIP HERE — MTIME IS.** The §A table missed two files
   (`NoodlBlocks.ts`, and the wizard pair in REL-013) that mtime placed in the same minute, and
   correctly excluded four 08-28 scss files that a status column would have swept.
5. 🔴 **COMMIT BY PATHSPEC, `git add` UNTRACKED FIRST** — a pathspec commit skips them silently.
6. ✅ **The catalog dance is cheap now** but still do it: `--out-dir` + diff, and for the enriched
   one (no `--out-dir`) `cp -a` aside, merge in place, diff against the backup. Four rounds here,
   and every round the diff named exactly one node.
7. 🔴 **A LITERAL COUNT GATE MOVES, AND THE INTERESTING NUMBER IS USUALLY NOT THE TOTAL.** fb-021
   went 362→364→365. ✅ **Measured, not argued**: rewriting one gate as `#js` leaves the *total*
   unchanged while the unexplained remainder rises. The total cannot tell "two new gated ports" from
   "two new ports an author cannot be told about"; the remainder can.
8. 🔴 **A LONE RED IS A FLAKE UNTIL RE-RUN ALONE** — and a *pre-existing* red must be measured
   against the session's starting commit before it is called yours. Both happened here.
9. 🔴 **NEVER `git stash`**, never `isolation: worktree` on this repo.
10. ⚠️ **`electron/dist` in `ps` matches the MCP servers.** All five "editors" seen at session start
    were `noodl-mcp.cjs`. Read `ps -o command=` before attributing a process.
