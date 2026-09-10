# Phase 84 — next session

**Phase:** 84, *the defects the field report found*. **Prefix `FLD`.** Scoped 2026-09-09.
Read [README.md](./README.md) first — §2 carries the rulings; **R1 is answered (0.2.3)** and four
still gate tasks.

🔴 **READ §6 BEFORE ANYTHING ELSE.** CI was blind for 34 days, session 10 restored it, and it came
back with **six red gates**. Three of them are one command each. That is now the largest pile of
loose work attached to this phase and none of it is FLD work.

## 1. The board — re-derived from the task FILES, 2026-09-10 (end of session 11)

Seventeen task files, each grepped for its own marker. **Eight built, THREE partly built, six never
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
| FLD-011 | The render report writes to disk and stops sleeping | #40 | 🟡 **PARTLY** `c7f5ea794` · ✅ **replied, STAYS OPEN** | — |
| FLD-013 | An agent learns what will not translate before it designs | #37 | 🟢 **BUILT** `e51c8c61d`, 5/5 ACs · ✅ **replied + CLOSED** | — |
| FLD-014 | The MCP surface stops costing a round trip | #43 | ⬜ never built | 🔴 **P25 — does not FIT the budget** |
| FLD-015 | Charts that export | #39 | ⬜ never built | **R2**, 🔴 **P9 collision** |
| FLD-016 | The Linux install works on a current distribution | #29 | 🟡 **PARTLY** `556915fa4` · ✅ **replied, STAYS OPEN** | 🔴 **needs a Linux box** |
| FLD-017 | The release stops shipping what it never runs | #42 | 🟡 **PARTLY** `07f6a7e74`, −85.4 MB + idle 2.42% → 0.14% · ✅ **replied, STAYS OPEN** | 🔴 **R5** for the rest |

🔴 **THREE tasks are `🟡 PARTLY BUILT` and NONE is done.** FLD-011 is missing parallelise-by-tab
(AC3, AC6). FLD-016 has all four fixes in and AC2/AC4/AC5 measured, but **AC1 and AC3 cannot be
measured on any machine we have** — see §8. FLD-017 has the size fix, the idle fix and the
multicast gate in, and **its whole remainder is minification, which is R5**.

## 2. What session 11 built — FLD-017, `07f6a7e74`

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

Gates: `test:main` **448 / 7,372, exit 0**; `typecheck:editor` 0; `typecheck:core-ui` **45 errors,
the identical set at HEAD** (proved with `git show HEAD:` over the changed file, md5 both ways).
New spec `tests-unit/fld-017/primary-button-spinner.test.ts`, 4 tests, **two reverted arms run**.

## 3. The next task to build

🔴 **There is no wholly ungated FLD task left.** FLD-017 was the last one, and it is built except
for the half R5 decides. Ranked:

1. **FLD-011's remaining half** — parallelise by tab. The only remaining work that needs **no
   ruling at all**. ⚠️ Weaker case than the task file assumed; the settle budget already took the
   corpus 205s → 55s. AC3's shared `consoleErrors` array is the trap.
2. **FLD-010** (#41) — unblocked, and **R6 can reasonably be answered *no*** (in public, on #41).
   Ask before building a lock; the tool itself does not need one.
3. **FLD-003** (#22) — unblocked by FLD-002 but still gated on **R3** and FLD-004.

🔴 **Gated and not to be started without the ruling:** FLD-004 (**R4**), FLD-005 (**P13**),
FLD-014 (**P25 — does not fit the budget**), FLD-015 (**R2** + **P9 collision**), FLD-017's
remainder (**R5**). **FLD-016 needs a Linux box, not a ruling** — see §8.

⚠️ **R5 is now the cheapest ruling with the most behind it that is purely a decision**: one line in
`webpack.renderer.production.js`, worth roughly another **35 MB**, and the only thing standing
between FLD-017 and 🟢.

⚠️ **But read §6 first and decide honestly whether a red CI outranks all of these.** It is not FLD
work and it is not this phase's, and it is the reason a month of drift went unseen. Session 11 did
not touch it.

## 4. 🔴 The reply gate — 20 sent, 4 owed

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

**Re-derived from GitHub at the end of session 11, with the loop above:**

**Sent (20):** #1 #5 #9 #12 #13 #14 #15 #21 #22 #25 #27 #29 #30 #32 #33 #34 #37 #40 #41 **#42**.
**Closed (10):** #1 #5 #9 #12 #14 #15 #21 #32 #33 #37.

**Owed (4): #26 #35 #39 #43.** Every one is behind a ruling: #26 = FLD-004 (**R4**),
#35 = FLD-005 (**P13**), #39 = FLD-015 (**R2** + **P9**), #43 = FLD-014 (**P25**). 🔴 **There are no
replies left that a build alone can unlock** — from here the count moves only when a ruling does.

🔴 **TEN issues stand replied-and-deliberately-open: #13, #22, #25, #27, #29, #30, #34, #40, #41,
#42.** Most are the same shape — *the issue asked for two things, one is built, closing it would
close the other*. Say which half is which, in the reply. #42's open half is **minification (R5)**.

⚠️ Do not count with `grep replied` — the table spells them **SENT**, and that grep undercounts.

## 5. 🔴 What session 11 learned, and it is mostly about instruments

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

## 6. 🔴 Gates — CI is alive again, and it came back with six red

**`9b3017f8b` fixed the cause** (`package-lock.json` was missing `@nodegx/project-contract`, added
2026-09-09 in `55f657b8a`). Pushed. Run **34512521036** is the first in 34 days to reach the gates.
**3 green / 6 red / 1 job's worth never reached.** None of the six is caused by this session's work;
they were exposed by it.

| job | reading | fix |
|---|---|---|
| Test (platform-node) | 🟢 | — |
| Check build artefacts | 🟢 | — |
| Build (viewer + editor bundles) | 🟢 | — |
| **Node catalog freshness** | 🔴 `cloud-library:check` — `cloud-node-library.json` **stale** | **one command**: `npm run cloud-library:generate`, commit |
| **Library check (LIB-001)** | 🔴 `starter-iconset:check` — `manifest.json` **out of date** | **one command**: `node scripts/library/make-starter-iconset.js`, commit |
| **Lint** | 🔴 `npm run tsfixme` — TSFixme **819 vs 582**, `any` **806 vs 415**, `@ts-nocheck` **4 vs 0** | 🔴 **a decision, not a command** — burn down or raise the baseline with a reviewer looking. See **P31** |
| **Typecheck** | 🔴 `typecheck:backend-tests` **OOM, exit 134** (`FatalProcessOutOfMemory`, core dumped) | the known one — [[the-smallest-runner-fails-first-and-names-nothing]]; **cannot be reproduced locally** |
| **Lesson bundles (FIX-027)** | 🔴 `lessons:chain:self-test` — *"a break this gate claims to catch went through it"*, **12 mutations, 2 not caught** | a gate hole; needs reading, not a regenerate |
| **Test (runtime, backend, viewer, mcp, preview)** | 🔴 `@nodegx/node-kit-types` **1 suite / 5 tests failed**; lerna stops there, so **`noodl-mcp` never ran in CI** | unread |
| **Test (editor)** | 🔴 exit 1, no summary line in the tail | unread — expect the AIX-006 floor plus whatever else |

🔴 **Two of these are one command and would take the red from six to four.** ⚠️ But a regenerate is
an unperformed merge — `--out-dir` or `git diff` the artefact before committing it, and check whose
work made it stale.

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

## 7. 🔴 Rulings — one down, four still gating

✅ **R1 ANSWERED: 0.2.3, not split.** What is *published* is **0.2.2** (2026-09-07) — re-derive per
issue with `gh release list`.

Still open: **R2** charts as a kit or core nodes · **R3** the Advanced Columns prefab · **R4** does
the units-port fix ship in a patch · **R5** is minification in scope · **R6** does FLD-010 include
the lock (answered *"probably not"* in public on #41 — confirm). Full wording in
[README.md](./README.md) §2.

🔴 **R4 and P13 remain the phase's critical path — and after session 11, EVERY remaining FLD task
is behind a ruling, a collision or a Linux box except FLD-011's second half.** R5 is the cheapest
one to ask for and it is now worth a concrete number: **~35 MB, one line, and a full editor QA
pass**, and it is the only thing between FLD-017 and 🟢.

## 8. 🔴 Three things for Richard

**(a) FLD-016's AC1 and AC3 need a real Linux box, and AC3 has teeth.** Re-enabling Chromium's
sandbox is a genuine behaviour change on older kernels and under restrictive AppArmor profiles.
**It must be smoke-tested on at least two distributions before 0.2.3 ships.** #29's reporter is on
Fedora 44 / KDE / Wayland and has been asked, in the reply, to verify — that is the cheapest path
and it is waiting on them.

**(b) The `tsfixme` baseline is a decision nobody has made.** +237 TSFixme and +391 bare `any` since
2026-08-07, accumulated while the gate could not report. The gate's own text says raising the
baseline silently is the one thing it exists to stop — so somebody has to either fund the burn-down
or look at the raise. Per-package floors is the shape proposed to @SgtSpork on #13.

**(c) R5 — minification — is now the single most valuable ruling that costs nothing to make.**
FLD-017 took 85 MB off the archive and it is the only ungated size item that existed. Minification
is worth roughly another **35 MB** on a 199 MB archive, it is one line
(`optimization: { minimize: false }` in `webpack.renderer.production.js`, never touched or justified
since the fork), and the risk is entirely in the QA: this codebase has legacy prototype code and
dynamic `require` in its plugin paths, which is what mangling breaks. **Yes/no, and if yes who runs
the QA pass.** #42 is being held open for it.

⚠️ `brew install rpm` remains installed on this machine from session 9. Reversible with
`brew uninstall rpm`.

⚠️ Session 11 moved four gitignored stray macOS duplicate directories out of
`packages/noodl-editor/src/external/` (`deploy 2/`, `viewer 3/`, `ssr 3/`, `cloudruntime 3/`, ~16 MB)
into its scratchpad rather than deleting them, because `build.files` includes `"src"` wholesale and
a local packaging run would have shipped them. **They are recoverable; if they are genuinely dead,
delete them for good.**

⚠️ Two stray untracked files sit at the repo root — `-d` and `2026-09-10 15:00`. Not session 11's;
they look like the fallout of a mis-quoted command. Left alone.

## 9. The end condition has not moved

The phase closes when the issues are each **fixed and closed, or answered on the thread with the
measurement that changed our mind**. Read the count off §5 of the register, not off README §6's
"fifteen".

**Twenty sent, four to go — and all four are behind a RULING, not a build.**
