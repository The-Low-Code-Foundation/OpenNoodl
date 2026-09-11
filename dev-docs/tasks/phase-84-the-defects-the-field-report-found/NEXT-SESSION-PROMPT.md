# Phase 84 — next session

**Phase:** 84, *the defects the field report found*. **Prefix `FLD`.** Scoped 2026-09-09.
Read [README.md](./README.md) first — §2 carries the rulings; **R1 is answered (0.2.3)** and four
still gate tasks.

🔴 **READ §8 BEFORE ANYTHING ELSE.** CI was blind for 34 days, session 10 restored it, and it came
back with **six red gates**. Session 13 took **four** of them and left three, and none of that is
FLD work. 🔴 **The phase still has NO ungated FLD task** — every remaining one is behind a ruling
or a Linux box, and the rulings were re-derived from GitHub on 2026-09-11 with **none answered**.

🔴 **NOTHING IS PUSHED.** `origin/cline-dev` is at `aedcc4d79` (2026-09-10 20:07) and local is
**21 commits ahead**. Every reading in §8 that says "CI" was taken on a commit that does not
contain this phase's last three sessions — including `aedc51f64`'s minification, which §10(c) asks
someone to watch the first CI run for. **A push is the single highest-value act available**, and it
is Richard's to authorise.

## 1. The board — re-derived from the task FILES, 2026-09-11 (end of session 13, UNCHANGED by it)

Seventeen task files, each grepped for its own marker. **TEN built, ONE partly built, six never
built.** That is the file count, not a copied status. Re-derive it, do not inherit this table:

```sh
cd dev-docs/tasks/phase-84-the-defects-the-field-report-found
for f in $(ls FLD-*.md | grep -v WHAT-WAS-BUILT); do
  id=$(echo "$f" | cut -d- -f1,2)
  if grep -q '🟢 \*\*BUILT\*\*' "$f"; then echo "$id BUILT"
  elif grep -q '🟡 \*\*PARTLY BUILT\*\*' "$f"; then echo "$id PARTLY"
  else echo "$id --"; fi
done
```

⚠️ **Do not pipe that into a counter that greps `BUILT`** — `🟡 **PARTLY BUILT**` contains it, and
session 9's first count came out `5 / 2 / 8`. The three states are mutually exclusive only because
the `elif` orders them.

**Track A — it went wrong and said nothing** (outranks track B in every ordering decision)

| id | task | issue | state | depends on |
|---|---|---|---|---|
| FLD-001 | The Columns node measures itself | #21 | 🟢 **BUILT** `3c13818d` · ✅ **replied + closed** | — |
| FLD-004 | A wire into a dimension port is honoured, or refused out loud | #26 | ⬜ never built | 🔴 **R4** |
| FLD-005 | A column of Groups does not multiply out | #35 | ⬜ never built | 🔴 **P13 collision** |
| FLD-006 | Fit view fits | #33 | 🟢 **BUILT** `901280af`, AC1 driven · ✅ **replied + closed** | — |
| FLD-007 | A lesson step that can be completed | #5 | 🟢 **BUILT** `4068d139` · ✅ **replied + closed** | — |
| FLD-008 | An aggregation that cannot answer says so | #14 | 🟢 **BUILT** `d1daabb1` · ✅ **replied + closed** | — |
| FLD-009 | The editor does not overwrite what an agent wrote | #41 | 🟢 **BUILT** `fa227028`, driven · ✅ **replied, issue STAYS OPEN** | — |
| FLD-012 | The empty-box warning stops crying wolf | #32 | 🟢 **BUILT** `0df984a11`, AC1–AC5 measured · ✅ **replied + closed** | — |

🔴 **Track A is still exhausted except for its two gated tasks.** FLD-004 needs **R4**, FLD-005
needs **P13**. Do not start either without the ruling.

**Track B — it costs too much to install and to drive**

| id | task | issue | state | depends on |
|---|---|---|---|---|
| FLD-002 | The Columns node says which breakpoint it is at | #22 | 🟢 **BUILT** `4e8ce7ab5`, AC1 driven · ✅ **replied, STAYS OPEN** | — |
| FLD-003 | Advanced Columns, as a prefab | #22 | ⬜ never built | FLD-002 ✅, FLD-004, **R3** |
| FLD-010 | An agent can ask whether a human has the project open | #41 | ⬜ never built | FLD-009 ✅, **R6** |
| FLD-011 | The render report writes to disk and stops sleeping | #40 | 🟢 **BUILT** `c7f5ea794` + `01ea605cc` — 6/6 ACs, `members-area` **53.8s → 6.13s** · ✅ **replied ×2 + CLOSED** | — |
| FLD-013 | An agent learns what will not translate before it designs | #37 | 🟢 **BUILT** `e51c8c61d`, 5/5 ACs · ✅ **replied + CLOSED** | — |
| FLD-014 | The MCP surface stops costing a round trip | #43 | ⬜ never built | 🔴 **P25 — does not FIT the budget** |
| FLD-015 | Charts that export | #39 | ⬜ never built | **R2**, 🔴 **P9 collision** |
| FLD-016 | The Linux install works on a current distribution | #29 | 🟡 **PARTLY** `556915fa4` · ✅ **replied, STAYS OPEN** | 🔴 **needs a Linux box** |
| FLD-017 | The release stops shipping what it never runs | #42 | 🟢 **BUILT** `07f6a7e74` + `aedc51f64` — asar **−40.7%**, idle **2.42% → 0.14%** · ✅ **replied ×2 + CLOSED** | R5 ✅ |

🔴 **ONE task is `🟡 PARTLY BUILT`: FLD-016.** All four fixes are in and AC2/AC4/AC5 are measured,
but **AC1 and AC3 cannot be measured on any machine we have** — see §10. FLD-011 stopped being the
other one in session 12.

🔴 **There is now NO ungated FLD work left at all.** Every remaining task is behind a ruling
(FLD-004/R4, FLD-005/P13, FLD-014/P25, FLD-015/R2+P9, FLD-003/R3, FLD-010/R6) or behind a Linux box
(FLD-016). The next session's first job is therefore §8's red CI or a register row, **not** an FLD
task — unless a ruling has been answered in the meantime, in which case that ruling's task is the job.

## 2. What session 13 did — four red gates, and THREE of them were a source of truth that moved

**Session 13 built no FLD task, because §1 is right that there is no ungated one.** It took §8's
red CI instead, which §5 had already ranked first. `b1ca71f5b` and `3fe956fd7`.

🔴 **The headline is not that four gates went green. It is that the phase's own instructions for
two of them were WRONG, and following them would have shipped a regression.**

**`cloud-library:check` — the only one that was genuinely one command.** The artefact was last
built 2026-08-30 (`ab17845d1`); `noodl.cloud.listusersinrole` landed 2026-08-31 in `ab6772587`
(P80/DEF-005) and nothing regenerated after it. **181 insertions, 6 deletions — and all six
deletions are the `-` half of five reworded descriptions plus one changed default**
(`substring`'s End, `0` → `-1`), so nothing was clobbered. New ports `locale`, `roles`, `origin`.

🔴 **`starter-iconset:check` was red BECAUSE the artefact had been hand-edited, so the documented
fix would have UNDONE the work that made it red.** VIB-007 (`03c327c84`) put `icon-inbox`,
`icon-recycle` and `icon-sprout` straight into the generated `manifest.json` — 212 → 215,
deliberately — and never added them to `CURATED` in the generator. The fix is in the SOURCE list;
**the manifest is byte-identical and this ships zero product difference.** Register **P36**.
⚠️ Measured the hard way: an exploratory `node -e "require('./scripts/library/make-starter-iconset.js')"`
**ran the script's main** and deleted all three. Restored from HEAD, verified 215 with all three
present — and the damage diff was exactly those three lines, which is what proved they were the
*whole* of the staleness. **Requiring a CLI script executes it.**

**`@nodegx/node-kit-types` — the job that never reached `noodl-mcp`.** Reproduced locally at CI's
exact reading (1 suite / 5 tests). Five failures, two members: `InputPortDefinition.placeholder`
(FB-015) fails **four** of them, because the three `ReactInput*` types reach it through
`Omit<InputPortDefinition, …>`; `NodeDefinitionOptions.wireDeclaredPortPrefix` (P77/SBR-008) is the
fifth — **the same field that surfaced in the cloud-library regenerate the same morning, from the
same cause.** → **4 suites / 82 tests, exit 0.**

🔴 **Fixing it only moves lerna's stop, so the next package was measured too — and it was the same
shape a third time.** `@nodegx/kit-scaffold` validates the tokens it emits against the editor's
registry; HLS-001 (`4fd171fc7`, 2026-09-09) moved the vocabulary into
`@nodegx/project-contract/tokens` and left `DefaultTokens.ts` a 12-line re-export. Repointed at
`packages/nodegx-project-contract/tokens.ts` (192 names, identical format) → **5 suites / 68 tests,
exit 0**. Register **P37**.

🔴 **The instrument lesson, and it is the one to carry:** that spec has an `existsSync` probe whose
own comment says *"fail rather than skip if the registry moves"* — and **the file went on EXISTING
and stopped DECLARING, so that probe stayed green for two days.** The neighbouring
`declared.size > 100` floor is what went red. **A probe on a file's PATH and a probe on its CONTENT
fail in different circumstances, and only the content one survives a move that leaves a stub
behind.** Comment corrected in place; floor kept; armed with a mutation (`--color-surface-2`, the
exact fake the spec's own comment names) which reddens `unknown` toEqual `[]` and nothing else.

🔴 **THE JOB DOES NOT GO GREEN, and the next session must not claim it will.** Letting lerna past
`node-kit-types` lets it reach `noodl-mcp`, which carries **three known reds of its own**
(`def018-def020-layout-drive`, `sbr009ThemeEditorDrive`, plus s12's floor). Expect *"Test (runtime,
backend, viewer, mcp, preview)"* to go red **later in the list**, not green. What changes is that
every package after `node-kit-types` gets graded in CI **at all**, for the first time.

⚠️ **A peer session was live on this checkout throughout** (`noodl-mcp` CMP-007, phase 85, still
uncommitted at the end). Both commits used explicit pathspecs and the peer's four files were
verified untouched after each. **Never `git add -A` here.**

### Readings, 2026-09-11, on top of `f89f805ab`

| gate | reading | exit |
|---|---|---|
| `cloud-library:check` | was *stale*, now up to date | **1 → 0** |
| `starter-iconset:check` | was *out of date*, now 215 curated glyphs | **1 → 0** |
| `@nodegx/node-kit-types` | 1 failed/3 passed, 5/77 → **4 suites / 82 tests** | **1 → 0** |
| `@nodegx/kit-scaffold` | 1 failed/4 passed, 1/67 → **5 suites / 68 tests** | **1 → 0** |
| editor `test:ci` | **2978 specs, 4 failures, seed 44268** — the AIX-006 floor BY NAME, `test-results.json` written 17s before it was read, `gitHead` matching | 1 (floor) |
| `test:main` | **448/448 suites, 7372/7372 tests** | 0 |
| the 3 `tests-unit` specs importing `cloud-node-library.json` | 3 suites / 32 tests | 0 |

⚠️ **`test:packages` was NOT run as a whole** — it includes `@noodl/mcp`, which the peer held with
uncommitted edits, so the run would have graded their in-flight code and burned the box for nothing.

## 3. What session 12 built — FLD-011's last half, `01ea605cc`

**The routed-page sweep runs on four tabs. FLD-011 is 🟢, 6/6 ACs, and #40 is CLOSED** — the third
issue this phase has closed by answering its second half rather than by arguing the first.

`withRenderedPage` gained `openTab`/`closeTab`; the per-tab plumbing it already had for one tab is now
`attachTab`, so the primary tab and every helper are built by the **same** function. One Chrome, one
server, N tabs — `PAGE_TABS = 4`, `concurrency` per call, `--concurrency` on the CLI.
🔴 **`concurrency: 1` IS the serial sweep, navigation for navigation**, which is why every number
below is one build against itself rather than a build against a `git show HEAD:` copy.

| lanes | `templates/members-area`, 11 pages |
|---|---|
| 1 (serial) | 9.33s |
| 2 | 6.65s |
| **4 (default)** | **6.13s** |
| 6 | 6.77s — *slower* |

**20 of 20 corpus projects IDENTICAL, both arms run twice**, 0 CHANGED, 0 unstable either side. The
whole report is byte-identical at 1/2/4/6 lanes once the clocks and the ephemeral port go — **92,793
bytes, one md5**. End to end on #40's fixture: **53.8s → 10.3s → 6.13s, 8.8x.**

🔴 **The honest reading: 1.52x on the one many-page project and 1.00x on the other nineteen** —
eighteen have no routed pages to sweep, and a single-page drive is mostly ~1.76s of fixed cost (server
spawn, Chrome spawn, port polling) that no number of tabs touches. **Session 7 predicted this exactly.**
It also **corrects s7's own reply to #40**, which said the remaining serial cost was "real CPU": 1.52x
is how wrong that was, and the correction went out on the thread.

🔴 **Building AC3's fixture found P33, which is bigger than the speed work: the report was DROPPING
every console error a page logged while LOADING.** The attribution window opened *after* the
navigation, so both shouting fixture pages came back **silent** — and so did every start page's boot.
**13 findings across 3 corpus projects had been invisible**: `members-area` 61 → 71 (start page plus
nine of ten routed pages), `landing-pages` 18 → 20, `log-a-thing/solution` 5 → 6.
✅ **It surfaced only because the fixture carries a known-firing control.** Without *"heard both pages
shout"*, four assertions about *which* page an error landed on all passed on a report with no errors
in it at all. Register rows **P33** (fixed), **P34** (three 404ing images in a shipped template, real
and unowned), **P35** (the noise this creates for a cloud project rendered with no backend — a
**decision**, not a defect, and it needs a ruling).

⚠️ **Two things about driving Chrome that cost a wrong arm each:** opening a second tab
**backgrounds the first**, and a backgrounded page does not render — the first parallel arm read a
good page as two `blank-render` findings, 2,953ms of navigation and both viewport settles out of
budget, against 308ms clean on one lane. `Emulation.setFocusEmulationEnabled` +
`Page.setWebLifecycleState` on **every** tab including the one already there, per session. And a
**fresh tab's first navigation is a document load**, so it needs the BOOT ceiling, not the route one.

⚠️ **`execFile` resolves when the child's STDIO closes, not when it exits.** AC6's orphan-maker
(`sh -c '… & echo $!'`) hung the suite for five minutes at 0% CPU, looking exactly like a hung drive,
until `>/dev/null 2>&1` was put on the backgrounded sleeper.

⚠️ **An assertion written from the shape of the loop instead of from the fixture will fail and be
right to.** *"counted each shout"* expected one error per viewport because two viewports are measured;
the page loads once. It now asserts **exactly once, in the window that holds the navigation** — the
half of the fix the "right page" assertions cannot see.

Gates: noodl-mcp **107 of 109 suites, 1,548 of 1,551 tests**; the two red are
`def018-def020-layout-drive` and `sbr009ThemeEditorDrive`, **re-proved pre-existing against THIS
change** (`git show HEAD:` over both changed files, the new spec moved aside, identical **3 failed /
15 passed by name**, restored, md5-verified all three ways — s7's lesson applied, since this change
touches `withRenderedPage` itself). `tsc --noEmit` 0. `@nodegx/render-measure` 13/13.
⚠️ **`packages/nodegx-backend`'s drive specs were NOT run** — they share `withRenderedPage` through
`helpers/site-drive` and need PostgreSQL a peer may hold. What makes that risk low and not zero: the
page object **gained** three members and lost none, the raw `consoleErrors` array those callers slice
themselves is untouched, and eight render-drive specs inside noodl-mcp exercise the primary-tab path.

## 4. What session 11 built — FLD-017, `07f6a7e74` + `aedc51f64`

**#42 reported a 271 MB archive and a 4%-of-a-core idle launcher. Both were real. Neither cause was
where the issue — or the task's own §2 — said it was.**

- **−85,414,531 bytes.** `"!**/*.map"` in `build.files`, and the `cli.js.map` extraResource gone.
  Two `electron-builder --dir` runs of the same pipeline: `app.asar` **283,432,139 → 198,017,608 B
  (−30.1%)**, **13,113 → 11,932 files**, and **0** `.map` files anywhere in the built `.app`
  (was 1,181 / 81.2 MB). AC3 driven: map-free app, project opened, caught and uncaught throws both
  still report, editor still holding the project.
- 🔴 **The idle CPU was three `bouncedelay 1.4s infinite` dots nobody could see.**
  `.popup-layer-activity` hides itself with `opacity: 0` — **and an `opacity: 0` element still
  animates; only `display: none` stops a CSS animation** — and it is built once in `popuplayer.ts`'s
  constructor and never leaves the tree. `PrimaryButton` had the identical defect and was found by
  **driving**, not reading: its `.Spinner` is also `opacity: 0` and mounted its dots unconditionally,
  so the Deploy button animated behind every open project.
  `document.getAnimations()`: **3 → 0** on the welcome screen, **3 → 0** with a project open.
  Idle over 180 s: **gpu 0.92% → 0.03%, renderer 1.42% → 0.04%, total 2.42% → 0.14% of a core.**
- 🔴 **The GPU time this phase wrote down as "not explained by anything static" is explained**, and
  it was static after all — it was compositing that spinner. `getAnimations()` is the instrument the
  code read could not be.
- **What did NOT change: the main process, 0.06% either way.** The UDP multicast is now gated on
  project-open (it used to advertise `No Project Open` to `225.0.0.100` every 2 s forever), and the
  commit and the reply both say in words that this is **network hygiene, not a CPU fix**.

🔴 **Two of the task's five scope items are REFUSED with a measurement, not deferred.**
Item 2 claimed breaking `readableCode.ts`'s value import of `blockly` saves 13 MB. It saves **zero**:
`getExternalModules({production: true})` marks **every** `node_modules` directory a webpack
external, so `index.bundle.js` holds one `require("blockly")` and none of blockly's code. A cold
re-`require` in the packaged renderer is **4 ms**. ⚠️ **AC4 is vacuous, not met.** Item 4's profile
poll **does not run on the welcome screen at all** and, with a project open, is 8 samples of 112,752
(**0.007%**) in a 30 s V8 profile — the renderer's JS is **99.78% idle** there.

🔴 **R5 was answered mid-session (Richard: in scope for 0.2.3, with `keep_classnames`/`keep_fnames`)
and minification shipped `aedc51f64`, so FLD-017 is 🟢 and #42 is CLOSED.** `app.asar` the whole day:
**283,432,139 → 198,017,608 → 168,143,884 B — −40.7%.**
🔴 **The QA burden was overstated and the measurement says how.** `mode: 'production'` was **already
set**, so tree-shaking and `sideEffects` were live in every shipped build and only terser is new;
`constructor.name` has **zero** call sites; the ~25 `.name ===` hits are **data strings from project
JSON**. The one real hazard — `eval(fileContent)` in `compilation.ts` — is handled by terser itself,
**read off the minified artefact**: that whole scope is unmangled. AC6's QA pass was driven headlessly
against the packaged build (launcher → project → panels → the detached `viewer-frame` window → the
live preview): **0 uncaught exceptions in either renderer**.
⚠️ ~1 MB is the cost of `keep_*`; full mangling was not worth it.

Gates: `test:main` **448 / 7,372, exit 0**; `typecheck:editor` 0; `typecheck:core-ui` **45 errors,
the identical set at HEAD** (proved with `git show HEAD:` over the changed file, md5 both ways).
New spec `tests-unit/fld-017/primary-button-spinner.test.ts`, 4 tests, **two reverted arms run**.

## 5. The next task to build

🔴 **The ungated pile is EMPTY. Session 12 took the last item in it.** Every remaining FLD task is
behind a ruling or a Linux box, so the honest ranking is no longer a ranking of FLD tasks:

0. 🔴 **A PUSH.** 21 commits, three sessions, none of it in CI. Every §8 reading attributed to CI
   was taken on `aedcc4d79`. This is Richard's call and it costs one command — **ask for it first**,
   because until it happens no CI claim in this document can be confirmed or refuted.
1. 🔴 **`lessons:chain:self-test`** — the one remaining red gate a session can actually take.
   *"A break this gate claims to catch went through it"*: 12 mutations, 2 not caught. It is a gate
   hole, which means it needs reading, not a regenerate, and this phase has had good luck with
   those. ✅ **Session 13 cleared the other four**; Lint and Typecheck are §10's decisions.
2. **Register rows P32 and P34** — both small, both user-visible, both unowned, both proved against a
   shipped artefact rather than argued. P32: the canvas icons have never shipped in any release.
   P34: three images that 404 in `templates/members-area`.
3. **FLD-010** (#41) — needs **R6**, and R6 can reasonably be answered *no* in public on #41. That is
   a ruling a session can ask for and then build the same day, which makes it the cheapest FLD task.
4. **FLD-003** (#22) — needs **R3** and FLD-004.

🔴 **If a ruling has been answered since this was written, its task outranks all of the above** —
R4 (FLD-004, and #26's reply) has the most behind it, then R3, then P13.

⚠️ **Register row P32 is small, user-visible and unowned**: the node-graph canvas icons have never
shipped in any packaged release. Found by the R5 QA drive, proved pre-existing against
`/Applications/NodeGX.app`. Not FLD-017's; somebody should take it.

🔴 **Gated and not to be started without the ruling:** FLD-004 (**R4**), FLD-005 (**P13**),
FLD-014 (**P25 — does not fit the budget**), FLD-015 (**R2** + **P9 collision**).
**FLD-016 needs a Linux box, not a ruling** — see §10.

⚠️ **§8 is where the red CI is, and the list above still puts it first.** Session 13 took four of
the six. The minification watch is still owed and still cannot be done: it takes the renderer build
from 58–73 s to 113 s and the macOS runners are the ones that OOMed at 2048 MB
(`scripts/webpackHeapCeiling.ts`) — **and `aedc51f64` is not pushed**, so there has been no first
CI run after it to watch. That is item 0.

## 6. 🔴 The reply gate — 20 sent, 4 owed, TWELVE closed

Standing authorisation, 2026-09-10: post and close from Richard's account, **no ask**. Every reply
carries (1) a first line saying it is an **automated reply generated from Claude** and (2) **the
release the fix ships in — re-derived per issue, never inherited.**

**Re-derive the count from GitHub, case-INSENSITIVELY** (`jq`'s `test` is case-sensitive and the
shipped line is capitalised; s8's first run reported a false 3/21):

```sh
for i in 1 5 9 12 13 14 15 21 22 25 26 27 29 30 32 33 34 35 37 39 40 41 42 43; do
  n=$(gh issue view $i --repo The-Low-Code-Foundation/NodeGX --json comments \
      --jq '[.comments[]|select(.body|test("(?i)automated reply generated from claude"))]|length')
  [ "$n" != "0" ] && echo "sent  #$i" || echo "OWED  #$i"
done
```

**Re-derived from GitHub at the end of session 12, with the loop above:**

**Sent (20):** #1 #5 #9 #12 #13 #14 #15 #21 #22 #25 #27 #29 #30 #32 #33 #34 #37 #40 #41 #42.
**Closed (12):** #1 #5 #9 #12 #14 #15 #21 #32 #33 #37 **#40** #42.

**Owed (4): #26 #35 #39 #43.** Every one is behind a ruling: #26 = FLD-004 (**R4**),
#35 = FLD-005 (**P13**), #39 = FLD-015 (**R2** + **P9**), #43 = FLD-014 (**P25**). 🔴 **There are no
replies left that a build alone can unlock** — from here the count moves only when a ruling does.

🔴 **EIGHT issues stand replied-and-deliberately-open: #13, #22, #25, #27, #29, #30, #34, #41.**
All the same shape — *the issue asked for two things, one is built, closing it would close the
other*. Say which half is which, in the reply. ✅ **#40 stopped being one of them in session 12 and
#42 did in session 11** — that is the pattern, and it is now the phase's main way of closing an
issue: **build or rule on the second half, then close.** For #42 the second half was a ruling; for
#40 it was a build. 🔴 **The reply on #40 also CORRECTED its own predecessor** — s7 had told the
reporter the remaining cost was "real CPU" and it was not. A follow-up reply that only adds good news
is not the only kind owed.

⚠️ Do not count with `grep replied` — the table spells them **SENT**, and that grep undercounts.

## 7. 🔴 What session 11 learned, and it is mostly about instruments

🔴 **`opacity: 0` is not "not rendered", and only `display: none` stops a CSS animation.** An
invisible spinner mounted at startup and never removed was the whole of a 4%-of-a-core idle CPU
report. `visibility: hidden` would not have stopped it either. This is the third time this phase
has been bitten by *hidden ≠ absent* — FLD-012's `visible` check was the first.

🔴 **A code read cannot enumerate what is animating; `document.getAnimations()` can.** The task
file said, correctly, that `ProjectsPage` has no interval, no rAF and no keyframes — and there were
**three running animations on that screen**, in a layer mounted underneath it. The same call found
the second instance (`PrimaryButton`) the moment a project was open, which no amount of reading
`ProjectsPage` would ever have reached.

🔴 **The decisive control was free and needed no rebuild.** Setting `display: none` on the one
element **in the live renderer over CDP** took `getAnimations()` to 0 and idle CPU from 2.42% to
0.06% of a core in the same process, over the same 180 s window — before a line of source was
changed. Do that before building the fix, not after.

🔴 **A `ps` window says HOW MUCH; a V8 sampling profile says WHAT.** The renderer read 1.42% of a
core, and its JavaScript was **99.81% idle** — the cost was compositing, not code. That gap is what
killed scope item 4: the profile put the file poll at **8 samples of 112,752**.

🔴 **"It is in the bundle" is a claim about the BUILD CONFIG, not about the import graph.** The
static trace confirmed exactly the chain the task file described into `blockly` — and it saves
nothing, because `getExternalModules({production: true})` makes every `node_modules` package an
external. **Grep the bundle for the library's own code before believing a bundle-size claim**;
`require("blockly")` appearing once is the tell. Same family as
[[a-client-property-read-as-a-fact-about-the-source]].

⚠️ **`ELECTRON_RUN_AS_NODE=1` is set in this session's environment** (an MCP server exports it), and
with it set a packaged Electron binary parses argv with **Node's** option parser and dies on
`bad option: --user-data-dir=…`. It reads exactly like the app rejecting the flag. Launch with
`env -u ELECTRON_RUN_AS_NODE`.

⚠️ **A test whose NAME overclaims will pass its reverted arm.** The spec's fourth case was called
*"the two arms differ ONLY by the dots"* and it passed with the dots deleted outright, because the
wrapper keeps its `is-loading` class either way. Renamed to what it grades. **Run the second
reverted arm — the one in the other direction.**

## 8. 🔴 Gates — six red, four taken by session 13, THREE left

**`9b3017f8b` fixed the cause** (`package-lock.json` was missing `@nodegx/project-contract`, added
2026-09-09 in `55f657b8a`). Pushed. Run **34512521036** is the first in 34 days to reach the gates.
**3 green / 6 red / 1 job's worth never reached.** None of the six is caused by this session's work;
they were exposed by it.

| job | reading | fix |
|---|---|---|
| Test (platform-node) | 🟢 | — |
| Check build artefacts | 🟢 | — |
| Build (viewer + editor bundles) | 🟢 | — |
| **Node catalog freshness** | ✅ **GREEN (s13, `b1ca71f5b`)** — regenerated; it really was one command | — |
| **Library check (LIB-001)** | ✅ **GREEN (s13, `b1ca71f5b`)** — and 🔴 **NOT by the command this table used to name**, which would have deleted three glyphs. See §2 and register **P36** | — |
| **Lint** | 🔴 `npm run tsfixme` — TSFixme **819 vs 582**, `any` **806 vs 415**, `@ts-nocheck` **4 vs 0** | 🔴 **a decision, not a command** — burn down or raise the baseline with a reviewer looking. See **P31** |
| **Typecheck** | 🔴 `typecheck:backend-tests` **OOM, exit 134** (`FatalProcessOutOfMemory`, core dumped) | the known one — [[the-smallest-runner-fails-first-and-names-nothing]]; **cannot be reproduced locally** |
| **Lesson bundles (FIX-027)** | 🔴 `lessons:chain:self-test` — *"a break this gate claims to catch went through it"*, **12 mutations, 2 not caught** | a gate hole; needs reading, not a regenerate |
| **Test (runtime, backend, viewer, mcp, preview)** | 🟡 **`@nodegx/node-kit-types` and `@nodegx/kit-scaffold` both GREEN (s13, `3fe956fd7`)** — but 🔴 **the job will NOT be green**: lerna can now reach `noodl-mcp`, which has three known reds. Expect it to fail **later in the list**. The win is that every package after `node-kit-types` gets graded at all | measured locally; CI unproven (nothing pushed) |
| **Test (editor)** | 🔴 exit 1 — ✅ **READ (s13): it is the documented AIX-006 floor and nothing else.** `2978 specs, 4 failures, seed 44268`, all four `AIX-006 style vocabulary` **by name**, on a `test-results.json` written 17s before it was read with a matching `gitHead`. 🔴 **So this job can never be green until AIX-006 is fixed or quarantined** — that is a decision nobody has made | a decision, not a command |

🔴 **Session 13 took four of these. THREE remain, and not one of them is a command:**
**Lint** (`tsfixme` — a baseline decision, §10(b)), **Typecheck** (`typecheck:backend-tests` OOM,
[[the-smallest-runner-fails-first-and-names-nothing]], not reproducible locally), and **Lesson
bundles** (`lessons:chain:self-test` — *"a break this gate claims to catch went through it"*,
12 mutations, 2 not caught: **a gate hole, and the only one of the three a session can just take**).

⚠️ **The advice that used to live here — "two of these are one command" — was half wrong, and the
half that was wrong would have shipped a regression.** Keep the caution it carried and strengthen
it: **a regenerate is an unperformed merge. `git log` the artefact, diff the regenerate, and ask
whether a HUMAN edited the generated file** — because if they did, the generator is what is stale,
not the artefact. Register **P36**.

**Local readings from session 10, for comparison:**

- 🟢 `nodegx-export`: **98 suites / 3,400 passed / 1 skipped, exit 0**.
- ⚠️ `noodl-mcp`: **102 of 104 suites**; `def018-def020-layout-drive` (D28) and
  `sbr009ThemeEditorDrive` are red. 🔴 **Re-proved pre-existing against THIS change**, not
  inherited: every changed file snapshotted, `git show HEAD:<path>` written over it, the two new
  files moved aside, the pair re-run for an identical **3 failed / 15 passed**, restored and
  md5-verified. Do that again if you touch anything they import. **Never `git stash` here.**
- 🟢 `tsc --noEmit` in both `nodegx-export` and `noodl-mcp`. 🔴 The export package's tsconfig
  **includes `tests/**`**, so it is the cheap local gate for a new spec there.
- 🟢 `noodl-mcp` esbuild bundle, with `structurePorts` present in `dist/noodl-mcp.cjs`. **Check all
  three resolvers** — tsconfig `paths`, jest `moduleNameMapper`, esbuild `alias` — when importing
  `@nodegx/export`; the bare specifier is aliased in all three, subpaths are not.
- 🔴 `npx jest tests/toolDisclosure.test.ts` in `packages/noodl-mcp` prints the margin on a
  **passing** run. **8,275 of 8,280 — 5 tokens.** Check it BEFORE adding to the MCP surface. P25.

## 9. 🔴 Rulings — TWO down, four still gating, NONE answered since

✅ **R1 ANSWERED: 0.2.3, not split.** What is *published* is **0.2.2** (2026-09-07) — re-derive per
issue with `gh release list`.

✅ **R5 ANSWERED 2026-09-10 (s11): minification IS in scope for 0.2.3**, with
`keep_classnames`/`keep_fnames`. Shipped `aedc51f64`; FLD-017 🟢; #42 closed.

Still open: **R2** charts as a kit or core nodes · **R3** the Advanced Columns prefab · **R4** does
the units-port fix ship in a patch · **R6** does FLD-010 include the lock (answered
*"probably not"* in public on #41 — confirm). Full wording in [README.md](./README.md) §2.

🔴 **Re-derived from GitHub 2026-09-11 (s13): NONE of the four has been answered.** #26, #35, #39
and #43 are all OPEN and the most recent comment on each is our own automated reply. **Do not
inherit that — re-check it**, because it is the one fact that would change the whole ranking, and
it is two `gh issue view` calls.

🔴 **R4 and P13 are now the phase's whole critical path.** Every remaining FLD task is behind a
ruling, a collision or a Linux box except FLD-011's second half. **R4 has the most behind it:** it
gates FLD-004, which in turn gates FLD-003, and it owes #26 a reply.

## 10. 🔴 Things for Richard

**(0) 🔴 A PUSH — this is the one that blocks everything else in this section.** `origin/cline-dev`
is at `aedcc4d79` (2026-09-10 20:07); local is **21 commits ahead** across sessions 11, 12 and 13.
Nothing in FLD-011, FLD-017, or session 13's four gate fixes has ever been seen by CI. (c) below
asks someone to watch the first CI run after `aedc51f64` — **there has not been one.**

**(a) FLD-016's AC1 and AC3 need a real Linux box, and AC3 has teeth.** Re-enabling Chromium's
sandbox is a genuine behaviour change on older kernels and under restrictive AppArmor profiles.
**It must be smoke-tested on at least two distributions before 0.2.3 ships.** #29's reporter is on
Fedora 44 / KDE / Wayland and has been asked, in the reply, to verify — that is the cheapest path
and it is waiting on them.

**(b) The `tsfixme` baseline is a decision nobody has made.** +237 TSFixme and +391 bare `any` since
2026-08-07, accumulated while the gate could not report. The gate's own text says raising the
baseline silently is the one thing it exists to stop — so somebody has to either fund the burn-down
or look at the raise. Per-package floors is the shape proposed to @SgtSpork on #13.

**(c) ✅ R5 ANSWERED and SHIPPED — nothing owed, but read this before 0.2.3 cuts.** `app.asar` is
**168,143,884 B, down 40.7% from this morning**. Two consequences to know about: the renderer build
goes **58–73 s → 113 s** (watch the first CI run — the macOS runners are the ones that OOMed), and
**a minified bundle with no shipped map is a stack trace nobody can read**, so
`index.bundle.js.map` should be attached to the 0.2.3 release as an asset. The maps are still
generated; they just do not go in the archive.

⚠️ `brew install rpm` remains installed on this machine from session 9. Reversible with
`brew uninstall rpm`.

⚠️ Session 11 removed the four gitignored stray macOS duplicate directories under
`packages/noodl-editor/src/external/` (`deploy 2/`, `viewer 3/`, `ssr 3/`, `cloudruntime 3/`, ~16 MB)
before taking any measurement — `build.files` includes `"src"` wholesale, so a local packaging run
would have shipped them. They went to the **session scratchpad, which is ephemeral**, so treat them
as gone; they were regenerable build output.

⚠️ Session 11 also removed `packages/noodl-editor/dist/mac-arm64` (525 MB, its own `--dir` build) —
the machine is down to **11 GiB free**. The `0.1.6` / `0.1.7` / `0.2.2` dmg+zip in that directory
are from earlier sessions and were **not** touched. A `--dir` build reproduces in about four
minutes: `npm run build:bundles`, then
`CSC_IDENTITY_AUTO_DISCOVERY=false node_modules/.bin/electron-builder --mac --arm64 --dir --publish never --config.npmRebuild=false`
(🔴 never `npm run build:editor` — it runs `npx rimraf ./node_modules`, register **P28**).

⚠️ Two stray untracked files sit at the repo root — `-d` and `2026-09-10 15:00`. Not session 11's;
they look like the fallout of a mis-quoted command. Left alone.

## 11. The end condition has not moved

The phase closes when the issues are each **fixed and closed, or answered on the thread with the
measurement that changed our mind**. Read the count off the register's §5, not off README §6's
"fifteen".

**Twenty sent, four to go, TWELVE closed — and all four remaining are behind a RULING, not a build.**
🔴 **Which means the phase can no longer be advanced by building.** #26 needs R4, #35 needs P13, #39
needs R2+P9, #43 needs P25. Session 12 spent the last ungated build there was, and session 13
confirmed it by re-deriving the board and the rulings before doing anything else.

🔴 **So what a session here is actually for, until a ruling lands: the loose work the phase
accumulated.** Session 13 is the model — it closed four red CI gates, added two register rows, and
built no FLD task, because there was no FLD task to build. **What is left of that pile:**
`lessons:chain:self-test` (a gate hole, takeable), P32 and P34 (small, user-visible, unowned), and
two decisions that are Richard's (§10(b) the tsfixme baseline, and now the AIX-006 floor that keeps
the editor CI job red forever). When that pile is empty too, say so and stop, rather than inventing
FLD work behind a ruling.
