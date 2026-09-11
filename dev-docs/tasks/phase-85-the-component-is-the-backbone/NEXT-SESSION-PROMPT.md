# Next session — phase 85

⚠️ **If you are here to run the CMP-002 build, you are in the wrong file.** Read
`CMP-002-BUILD-BRIEF-READ-THIS-ONLY.md` and nothing else in this folder. Reading on past this line
disqualifies you from producing the baseline.

## The board, re-derived from the task FILES on 2026-09-11 (session 10)

| task | AC | state |
|---|---|---|
| CMP-001 | AC1 the `States.currentState` enum input | ✅ s2, four assertions over the wire |
| CMP-001 | AC2 the playbook ships as a doctrine field | ✅ s6 — `interfaceDoctrine` on `get_project_info`; s7 added an eleventh rule and 4 specs |
| CMP-001 | AC3 four new corpus examples | 🟡 s6 built four; s7 judged the remainder and closed it as a judgement — 26% publishing, floor still FAIL, deliberately |
| CMP-001 | AC4 a built page clears the three floors | OPEN — needs CMP-002 |
| CMP-002 | the graded baseline build | **FIRST JOB, and still the only AC-moving work.** 🔴 s7, s8, s9 and s10 all could not run it — the reason is measured, see below |
| CMP-003 | AC1/AC2/AC4 | ✅ s2 / s6 / s2 |
| CMP-003 | AC3 a built page produces one | OPEN — needs CMP-002 |
| CMP-004 | AC1–AC4 | ✅ s2/s3/s4/s5 |
| CMP-004 | AC5 an agent reaches for it | OPEN — graded inside CMP-002 |
| CMP-005 | all five | ✅ CLOSED s4 + s5 |
| CMP-006 | AC1/AC2 | ✅ CLOSED s8 |
| CMP-006 | AC3 should the DEFAULT carry `antiPatterns`? | 🔴 OPEN — **needs a phase-55-style REPLAY, not a ruling.** Two server variants, so it needs a session whose CLI process is its own |
| CMP-007 | AC1/AC2/AC3 | ✅ CLOSED s9 |
| **CMP-008** | AC1–AC5 the person's door | ✅ **CLOSED s10** — 60 specs, 5 control arms, and one of them found a hole in this task's own gate |

## 🔴 s10: THERE IS NOTHING LEFT TO PROMOTE THAT DOES NOT NEED A FRESH SERVER

s9 wrote: *"a session that cannot run CMP-002 no longer has a promotable gap to fall back on"*, and
named the editor-side token row as the one exception. **s10 took that row (CMP-008).** §7 now holds
two NEW owner-NONE rows, both filed by s10 and both honest but small:

1. **`tsc -p noodl-editor/tsconfig.tests-main.json` is red at HEAD** (32 lines, EXIT=2 — measured
   against a HEAD baseline *before* any edit). `tests-unit/` is graded file-by-file by ts-jest, so
   the suite is green while the whole-program check is not, and the `include` list that keeps the
   renderer out of the plain-Node runner has no gate proving it still holds.
2. **`ResultStage`'s rendering of `summary.warnings` has no local grader** — it imports `Icon`.

🔴 **Neither is an AC.** If you are session 11 and you cannot run CMP-002, read
[[build-the-tasks-do-not-farm-the-defects]] before starting either: the honest options are the
CMP-006 AC3 replay (which needs two servers, so it needs its own CLI process), promoting row 1 into
a numbered task with real ACs, or **waiting for Richard**.

## 🔴 s10: THE CLI PROCESS WAS `89837` FOR THE FOURTH SESSION RUNNING

Measured, not inherited: `ps -o ppid -p $$` walked to CLI pid **`89837`, started
2026-09-10 14:26:46**, with MCP children `89852` / `89857` started at that same moment — about
**20 hours before** `dist/noodl-mcp.cjs` was last rebuilt (10:09:15 on 2026-09-11). s7, s8, s9 and
s10 have all been the same process. `/clear` wipes the conversation and leaves the MCP children
running; a subagent shares them. See [[an-mcp-server-is-a-child-of-the-cli-process]].

⚠️ s10 did **not** need an MCP server for its work and did not probe one — the pid arithmetic above
is sufficient and cheaper. A server started 20 hours before the bundle cannot be carrying it.

## ✅ s10 built CMP-008 — and the row it came from was wrong about where the door is

s9 filed the leftover as *"a person clicking Install in the EDITOR goes through `views/ImportFlow`"*.
🔴 **It does not.** `ModuleLibraryModel._install` forks on `dryRun.hasCollisions`, and the
no-collision branch — every install of a part into a project that does not already have it, i.e.
the common one — calls `applyToProject` directly and **never opens the flow**. A warning hosted in
`ImportFlow` would have been *present in the code and absent in practice*, and would have passed any
spec that rendered `ResultStage` with a warning in its props.

**The file's own CN-017 comment, twelve lines above that fork, already says this in those words.**
CN-017 read it and put its consent gate above the fork; s9's row put its successor's warning below
it. Seventh premise in this phase not to survive contact —
[[measure-the-artefact-before-believing-the-task-file]].

🔴 **And that branch was discarding EVERY engine warning, not just tokens** — a module that failed
to copy, a provenance record that could not be written, CN-017's own refusal to copy an unconsented
kit — all under a green *"Prefab X cloned"*. CN-017's words for that state are *"a kit that is
simply absent, with nothing anywhere saying why"*.

So the answer went into `apply.ts`, which is the one line every route converges on, by the argument
CN-017 AC2 had already written there. Doors 2 and 3 came free: `summarizeResult` already lifts
`result.warnings` into what `ResultStage` renders.

## 🔴 s10's trap, and it is aimed at gate-writing itself

`apply.ts` cannot be executed without Electron, so CMP-008's caller gate walks TypeScript's **AST**
rather than the file's text — precisely because this phase's notes say a source-text `toContain`
passes on commented-out code.

**Arm B switched the whole feature off with `if (false && …)` and the AST gate passed anyway.** The
import was still there, the call expression was still there, the spread into `warnings` was still
there. **A static gate cannot see reachability**, and knowing about the dead-code trap is not the
same as being immune to it.

The fix was to stop asking it to: the export-staging exemption moved out of an `if` at the call site
and into the pure `tokenWarningsFor`, where it is graded **by being run**, and `apply.ts` was left
with one unconditional statement — a property the gate *can* assert. Arm B2 (the same subversion via
a ternary) goes red. Generalises: **when a gate has to guess, remove the thing it is guessing
about.**

⚠️ Two smaller ones worth carrying:

- **`entryTokens` cannot read a v2 project**, and it is right anyway — all **75** shelf entries are
  legacy single-file projects (re-measured: `find library -maxdepth 4 -type d -name components` is
  **0**). The editor could not reuse it: a project imported from elsewhere on this machine is likely
  v2, where `project.json` holds almost nothing, so a scan of it is a **silent zero on the door most
  likely to carry a hand-made token**. The two sides share the *matcher*, not the source. Arm E
  (reading `project.json` in the engine) reds exactly one spec.
- 🔴 **zsh does not word-split an unquoted `$FILES`** — `md5 -q $FILES` with a plain string read the
  whole list as ONE filename and reported `No such file or directory` while looking like a path
  problem. Use an array. Already in [[a-peer-may-be-doing-your-exact-task]].

## ✅ s10 re-measured CMP-007's corpus number independently, and extended it

| | entries | reading tokens | distinct | outside `DEFAULT_TOKENS` |
|---|---|---|---|---|
| `library/prefabs` | 45 | **18** | **29** | **0** |
| `library/modules` | 30 | 6 | 10 | **0** |

CMP-007's *"18 of 45, 29 distinct, 0 outside"* reproduces **exactly**, and the modules half is new.
`DEFAULT_TOKENS` is **192** names from `@nodegx/project-contract/tokens`. ⚠️ CMP-007's *"45 entries
on the shelf"* is the **prefab** count; the shelf is **75** (`library:check` 75/75), which is why
s5's number and s9's look like they disagree and do not.

## 🔴 The first job is still CMP-002, and s8 MEASURED why two sessions have bounced off it

It alone grades CMP-001 AC4, CMP-003 AC3 and CMP-004 AC5.

**s7's two stated preconditions were both correct. They reproduced exactly in s8, and s8 found the
root cause of the first one.**

### The blocker, named precisely: an MCP server is a child of the CLI PROCESS, and `/clear` does not restart it

s8 walked `$$` up the process tree and its CLI pid was **`89837`, started Thu 2026-09-10 14:26:46 —
the same CLI process as session 7.** `/clear` wiped the conversation and left the MCP children
running. `ps` showed one server pair per CLI process, four pairs on the box, and s8's `nodegx` server
was pid `89857`, started 14:26:46 against a `dist/noodl-mcp.cjs` that was **rewritten at 22:34:12**
the same evening.

🔴 **Measured, not inferred.** `list_examples({query: 'badge states variant'})` returned `[]` while
the control `list_examples({query: 'component'})` returned **24** examples including
`comp-repeater-set-item-object` — so the `comp-` prefix was not being filtered, and **none of s6's
four `comp-*` examples existed in the running bundle.** That dates the server's image to before
`b438e8c05`.

⚠️ **A subagent cannot escape this.** Subagents share the parent CLI's MCP connections — the `ps`
output shows one server pair per CLI process, not per agent. So spawning a fresh-context agent gives
you a fresh *reader* and the *same stale server*.

### ✅ What s8 fixed so the next session is not blocked

**`dist/noodl-mcp.cjs` was rebuilt at 2026-09-11 07:25:30** and carries all four anchors:

- *"What goes on a component's interface"* (s6's doctrine)
- *"A repeated row publishes to the repeater"* (s7's eleventh rule)
- *"relatedNodes, patterns, antiPatterns"* (s8's CMP-006)
- `comp-variant-badge-states` (s6's example)
- 🆕 *"set_project_tokens, or repoint those parameters"* (s9's CMP-007 — the newest, so it dates the
  bundle most precisely)

🔴 **s9 REBUILT IT AGAIN at 10:09:15 on 2026-09-11**, carrying all five. Use the s9 string: a bundle
carrying s8's four but not this one was built between 07:25 and 10:09.
**So any CLI session started after 10:09:15 on 2026-09-11 gets a server that carries the work.**

### 🔴 The unblock, and it is RICHARD'S action, not the next session's

CMP-002 needs a session that has read **only** the build brief. A session told *"continue phase 85"*
reads this file and is disqualified by its first line. So the run has to be started deliberately:

> **In a NEW Claude Code session (not `/clear` — a new session, so the MCP server is a new process),
> say exactly: `Read dev-docs/tasks/phase-85-the-component-is-the-backbone/CMP-002-BUILD-BRIEF-READ-THIS-ONLY.md and do what it says.`**

✅ **s9 (2026-09-11) MOVED THE SETUP PRECONDITION INTO THE BRIEF ITSELF**, because it was
unreachable: the freshness check lived here, in the file a CMP-002 session is forbidden to read by
its own first line. The brief now carries, as its own §"Setup", (a) **use `nodegx`, never
`nodegx-puppy-test-3`** — the second is the INSTALLED APP, already bound and advertising the full
toolset, so it is the path of least resistance and the wrong instrument — and (b) a self-identifying
shell check that finds *that session's own* server among the several on this box and prints
`OK` / `STALE` / `NO SERVER` rather than two dates to compare by eye. **Both branches were exercised
when it was written.** 🔴 It deliberately does NOT use the `list_examples({query:'badge'})` probe s7
and s8 recommended: naming `comp-variant-badge-states` to the instrument hands it one of the very
patterns CMP-001 grades. Zero-leak checks only.

The check below is kept for anyone debugging from THIS side:

1. `get_project_info` must contain *"What goes on a component's interface"* **and** *"A repeated row
   publishes to the repeater"*.
2. Cheaper and it needs no bound project: `list_examples({query: 'badge'})` must return
   `comp-variant-badge-states`. If it returns `[]` while `list_examples({query: 'component'})`
   returns two dozen, the server is stale — **rebuild `packages/noodl-mcp` and start a new session.**
3. The general form: `stat` the dist, `ps` the server, and compare. A server older than the bundle
   cannot carry it, and an absent field is not an error.

⚠️ **The bound PROJECT server on this machine (`nodegx-puppy-test-3`) is the INSTALLED APP**
(`/Applications/NodeGX.app/.../noodl-mcp.cjs`) and contains **zero** occurrences of the anchor
strings, so it can never carry this work however recently it started. The repo-built server is
`nodegx`, which is unbound — `create_project` is the door, and it binds ONCE per process.

## What session 9 built — CMP-007, the LAST owner-NONE gap in §7

s9 was a `/clear` told *"continue phase 85"*, so it is disqualified from CMP-002 by the first line of
this file — and it MEASURED the second disqualifier rather than inheriting it: its CLI pid is
**`89837`, started 2026-09-10 14:26:46, the same process as s7 and s8**, and
`list_examples({query: 'badge'})` returned a CTA band instead of `comp-variant-badge-states`. A stale
server, exactly as predicted. The CMP-006 AC3 replay needs two server variants and hits the same wall.

So it took §7's remaining 🔴 owner-NONE row, and it was §2's shape for the SIXTH time: **the answer
existed on both sides and reached neither.** `export_to_library` collected the `var(--token)` names a
part reads and put them in its response and its README — one agent on one turn, and a human. Neither
reaches the project that installs the part, which is the only place the answer can be acted on.
`install_prefab` named components, styles, assets and modules and said **nothing about tokens**.

🔴 **Not carrying overrides was correct and stays** — it is CMP-004 AC4's whole mechanism. The hole
it left is a token project B never DEFINED: `var(--brand-accent)` with no such token is an unset
property, not an error, so the part installs, reports success, and draws the wrong colour.

🔴 **A THIRD OF THE FIX WAS DELETED BY THE ARTEFACTS.** The obvious first move — write `tokens` into
`library.json` so the record outlives the response — was built, passed its spec, and then refused
twice: `scripts/library/schema.json` is `additionalProperties: false` so `library:check` rejects the
key, and `build.js` copies a FIXED key set into `index.json` so nothing downstream would read it. An
inert field whose only reader was the test asserting it — **and that schema's own `runtimeVersion`
description already records the trap in those words.** Both paths derive from the graph instead,
which is also the only thing that works for the 45 entries already on the shelf.

## 🔴 s9's trap, and it is the one worth carrying forward

**The gate had to be built on an INVENTED token, because the corpus reads zero.** Counted first:
18 of 45 shelf entries read tokens, 29 distinct names, and **0 of the 29 are outside
`DEFAULT_TOKENS`**. A gate written against the shipped shelf reads "0 unresolved" before the fix and
after it — both arms zero, grading nothing. The defect lives on the path CMP-004 AC4 opened, where a
part is exported from a project that invented tokens via `set_project_tokens`. The zero is kept as a
labelled MEASUREMENT rather than dressed as a gate, so the day a first-party prefab reads an invented
token the number moves and somebody looks at it.

⚠️ **Arm C is the arm that mattered**: an install that trusted `library.json` instead of the graph
passes **every other spec in the file** and reports nothing for all 45 shipped entries — an absence
indistinguishable from a pass, on exactly the entries most likely to be installed.

## What session 8 built — CMP-006, promoted from §7's owner-NONE gap

Everything on §A of the board needs CMP-002, which s8 could not be the instrument for. So it took the
phase's only other 🔴 owner-NONE row, and it was on-thesis: **§2's shape for the fifth time — the
doctrine existed and nobody measured whether it arrived.**

`get_node_type` emitted neither `patterns` nor `antiPatterns` at any detail level. **130 of 176 types
carry `patterns`** (259 entries) and **113 carry `antiPatterns`** (203 entries) — ~14.9k tokens of
authored guidance whose only reader was the EDITOR's node-docs panel, i.e. a person.

🔴 **The root cause §7 did not have: `NodeEnrichment` in `catalog.ts` never DECLARED `antiPatterns`.**
`patterns` was declared and not copied; `antiPatterns` was not in the interface at all, so no copy of
it could have typechecked. The hole was in the server's own type, which is why it survived five
sessions of people reading that function.

**AC3 was deliberately left open, and the reason is a measurement.** Putting them on the DEFAULT
summary is the obvious next thought and it is not free: `antiPatterns` alone is a **median 36%** of a
summary payload and **up to 151%** — on `noodl.cloud.request`, 528 chars of anti-pattern against ~349
of summary — while costing 0.8% on `Group`. It is most expensive exactly where summaries are cheapest
and most numerous. AWP-005 §2 measured that doc volume was *anti*-correlated with building, so
overturning it wants a replay, not an opinion. Arm D holds that line on purpose.

## 🔴 Traps — session 8's, then the standing ones

- 🔴 **THE RESIDENT TOOL SURFACE HAD FIVE TOKENS OF HEADROOM.** 8275 against
  `toolDisclosure.test.ts`'s 8280. CMP-006's first description wording cost 19 tokens and put it at
  **8294, 14 OVER** — and the red arrived in a suite about *tool disclosure*, nowhere near the change.
  The literal was **not** bumped: the text was funded by naming the real response keys instead of
  paraphrasing them, and by collapsing a sentence `get_node_type`'s schema was paying for **twice**.
  Final **8272, 8 under — 3 tokens cheaper than before the work.** ✅ The only reason this was legible
  is CN-006's `[surface] … under the … budget` line, which prints the margin **on a passing run**.
  **A description edit is a product change with a price**, re-sent every turn of every session.
- 🔴 **A SPEC THAT BATCHES `detail: "full"` FAILS ON ITS OWN CONSTRUCTION.** Five sampled types are
  ~100 KB against the 60 KB byte budget (DEBT-009), which degrades the tail to **summaries** in-band
  — and a summary carries neither field by design. It reads as a broken relay. `Group` alone is
  ~47.8 KB. One type per call, and assert `summarized` is `undefined`.
- ⚠️ **Arms A and B red the SAME two tests**; only the failure *messages* distinguish which half of
  the relay went missing. If you add a field, add the content assertion that names it.
- ⚠️ **The corpus row in `STUDIED-APPS.md` was stale by 16 points** (10% from the 67-example reading)
  while three source literals and CMP-001 had all moved to 26%. A dated row is history and was left
  intact; a second dated row now carries the current measurement. **Re-measure before quoting a
  ledger.** `./measure-interfaces.py corpus ../../../packages/noodl-types/src/node-catalog-enriched.json`
  reproduced 34 / 26% / 12% / 0.06 independently.
- 🔴 Sessions 3–7's still stand: **the examples gate passed `Group.gap`, a parameter that does not
  exist** — check every new port by hand against `node-catalog.json`; **count the artefact, never bump
  the literal**; **run the suite you are citing AFTER your last edit to it**; **`npm run docs:nodes`
  wipes and rewrites the whole directory** (owner NONE, still stale); **`catalog:merge` rewrites a
  shared artefact — `merge.js --check` with your inputs moved aside first**; **the thing you are
  changing may ship twice**; **an inert parameter in a corpus example teaches a lie**; **editing JSON
  with `json.dumps` reformats every array — do the surgery on the text**.
- 🔴 Session 1's still stand: two obvious metrics were **green before the work** (mean ports, variant
  port — do not reintroduce them), and **a session that has read this phase cannot grade a build of
  it**.

## Numbers, measured 2026-09-11 at `5af046b5d` + s10's work

- `noodl-editor` `npm run test:main`: **452 suites / 7428 tests, ALL PASSING, EXIT=0.** There is no
  floor of reds on this runner. 4 suites / 56 tests are CMP-008's; the prior count is *derived*
  (7428 − 56 = 7372), not measured — do not treat it as a baseline someone took.
- `noodl-mcp` `npx jest`: **3 failed / 1561 passed / 1564 total, EXIT=1.** ✅ Delta reconciles:
  s9's **1560 + 4 = 1564**. Reds are the two long-standing `*Drive` suites
  (`def018-def020-layout-drive`, `sbr009ThemeEditorDrive`), named and unrelated.
  ⚠️ s9's third red, `projectOwnsBackend.test.ts`, was **GREEN** this run — which confirms s9's
  reading of it as a flake under full parallel load rather than a real red.
- `npx tsc --noEmit -p packages/noodl-editor`: **0 lines, EXIT=0.**
  `npx tsc --noEmit -p packages/noodl-mcp`: **0 lines, EXIT=0.**
- `npm run library:check`: **75/75 entries clean, EXIT=0.**
- `toolDisclosure.test.ts`: 18/18, **8272 / 8 under — UNCHANGED.** No tool description was touched;
  CMP-008 adds no MCP surface at all.
- Five control arms (A, B, B2, C, D, E — B is the one that PASSED and had to be answered),
  **56 of 56 editor specs running in every arm**. Four of six sources restored md5-identical to the
  pre-arm snapshot; `apply.ts` and `tokenGap.ts` md5-identical to their post-redesign snapshots,
  because those two changed by design between arm B and arm B2.
- ⚠️ **`test:ci` NOT run.** The two webpack-resolution risks CMP-008 introduces were closed by
  precedent instead of by a ten-minute build: `@noodl-models/StyleTokensModel/ProjectTokenCss` is
  already imported that way by `utils/compilation/build/processors/html-processor.ts`, and
  `@noodl-utils/import-engine/legacy/...` by `router.setup.ts`; both are plain prefix aliases in
  `webpackconfigs/shared/webpack.shared.js`. **NOT PUSHED** — Richard's standing decision.

## Numbers, measured 2026-09-11 at `f89f805ab` + s9's work

- `npx jest` in `packages/noodl-mcp`: **5 failed / 1555 passed / 1560 total, EXIT=1.**
  ✅ **Delta reconciles: 1540 (s8) + 11 + 9 = 1560** — the 11 are `fld011ParallelTabs.test.ts`, added
  by **P84's `01ea605cc` AFTER s8 wrote its number**; the 9 are CMP-007's. Reds: s7/s8's two
  pre-existing `*Drive` suites, plus **`projectOwnsBackend.test.ts`, which passes 12/12 in
  isolation** — it provisions real backend processes and races under a full parallel run.
- `npx tsc --noEmit -p packages/noodl-mcp`: **0 lines, EXIT=0.**
- `npm run library:check`: **75/75 clean, EXIT=0** — the gate the deleted field would have broken.
- `toolDisclosure.test.ts`: **18/18, 8272 / 8 under — UNCHANGED.** `install_prefab`,
  `get_library_entry` and `export_to_library` are all in the DEFERRED `explore` group, so their
  descriptions and responses cost **zero** resident tokens. Measured before and after.
- Five control arms, **9 of 9 tests running in every arm**, both sources restored **md5-identical**.
- `dist/noodl-mcp.cjs` rebuilt **10:09:15**, five anchors present (the four below plus
  *"set_project_tokens, or repoint those parameters"*).
- ⚠️ **`test:ci` NOT run** — s9 touched only `packages/noodl-mcp` and `dev-docs`. **NOT PUSHED** —
  Richard's standing decision.

## Numbers, measured 2026-09-11 at `8898a7171` + s8's work

- `npx jest` in `packages/noodl-mcp`: **3 failed / 1537 passed / 1540 total, EXIT=1.** The three reds
  are in the two pre-existing `*Drive` suites (`def018-def020-layout-drive`, `sbr009ThemeEditorDrive`),
  neither referencing anything here. ✅ **Delta reconciles: 1540 − 1535 = 5**, all in the new
  `cmp006PatternsOnTheWire.test.ts`. This is s7's floor exactly, re-taken.
- `npx tsc --noEmit -p packages/noodl-mcp`: **0 lines, EXIT=0.**
- `toolDisclosure.test.ts`: **18/18**, `[surface] 8272 tokens / 20 resident tools — 8 under the 8280 budget`.
- `measure-interfaces.py corpus`: **34 components, 26% / 12% / 0.06.** All three floors still FAIL,
  which is the honest reading — re-measured, not inherited.
- Four control arms, **5 of 5 tests running in every arm**, both sources restored **md5-identical**.
- `dist/noodl-mcp.cjs` rebuilt **07:25:30**, four anchors present.
- ⚠️ **`test:ci` NOT run** — s8 touched only `packages/noodl-mcp` and `dev-docs`, and the editor suite
  is untouched by both. **NOT PUSHED** — Richard's standing decision.

## Ordered next steps

1. 🔴 **CMP-002, and it needs Richard to start it** — a NEW session (not `/clear`, so the MCP server
   is a new process), pointed at `CMP-002-BUILD-BRIEF-READ-THIS-ONLY.md` **by name**, with the
   brief's own §Setup check run first. Nothing on §A of the board moves until it lands.
2. Then grade it: `./measure-interfaces.py v2 <project>/components` against the 50/20/0.15 floors,
   `./measure-logic-components.py` for the CMP-003 column, and the §3 **six questions** over the
   graph — a ledger row without the reading is three columns and no insight.
3. CMP-006 AC3, **if and only if** you are willing to build the replay: same brief, two servers, one
   with `antiPatterns` on the default, graded on whether the built graph avoids the named
   anti-patterns. Not on token count. Needs a session whose CLI process is its own.
4. 🔴 **§7's two remaining rows are NOT acceptance criteria.** s9 took the first owner-NONE row
   (CMP-007), s8 the second (CMP-006), s10 the last leftover (CMP-008). What s10 filed in their place
   — the red `tsconfig.tests-main.json` whole-program check, and `ResultStage` having no local
   grader — are instrument gaps, not product gaps. **A session that cannot run CMP-002 should
   promote row 1 into a numbered task with real ACs, or wait**; see
   [[build-the-tasks-do-not-farm-the-defects]] and do not simply start fixing.

### Needs Richard, not the next session

- **Starting the CMP-002 run** (above) — the one thing blocking every open AC on the board. It has
  now been the first job for four consecutive sessions.
- The cadence itself: §3.1 is event-driven, *"whenever Richard gets time"*. The Friday routine
  (`trig_01MFceQCDiZvLy7cuSyeU877`) reports where the loop stands and never does the work.
