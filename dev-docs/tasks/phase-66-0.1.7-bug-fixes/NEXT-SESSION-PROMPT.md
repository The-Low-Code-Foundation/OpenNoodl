# Phase 66 — next session

**Written 2026-08-16, session 46.** A rewrite, per §0. s46 took items 1 and 2 of s45's queue and
built both — `b5418806` (FIX-004 §C dual-list) and `0a0c156e` (FIX-005 rename). **Two tasks, two
commits, source + specs + task files.**

✅ **The queue has a cheap end again, and s46 made it: a single drive closes the remaining half of
both.** Same toolbox, same flyout, one editor launch. It is item 1 below.

🔴 **s46's headline is the third instalment of the same method result, and it is the sharpest.**
s44: *a premise asserting an ABSENCE is the one nobody has checked.* s45: *an absence you go and
check passes for free unless the instrument is proven alive when you read it.* s46:
**a CONTROL passes for free unless the broken arm is proven to have been broken.** A mutation table
of four rows ran against unmodified source and printed four passes — details in §3. The general form
is in memory as `a-mutant-that-never-applied-reports-a-pass`.

🔴 **Every ruling and every build is recorded in its own task file.** §4 here is a work order, not
the source of truth.

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, **overwritten** each session. Four things:

1. **Built vs. driven**, per task — *built* is code plus gates; *driven* is the app doing it.
2. **Gate readings with their date and tree.** ⚠️ **Mark which ones this session actually took.**
3. **What is settled**, so nobody re-litigates it.
4. **What to do next**, ordered, with rulings owed by Richard called out separately.

Learnings that outlive the phase go to **memory**, not here. ⚠️ **If you find yourself prepending an
amendment, rewrite the file instead.**

---

## 1. Built vs. driven

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-001 / 002 / 003 / 007 / 009 / 010 / 011 / 012 / 014 / 017 / 018 / 019 / 020** | ✅ | ✅ | **CLOSED** — thirteen tasks |
| **FIX-016** §2, §3, §3c, **ruling 1** | ✅ | ✅ s45, 2×2 + 2 controls | The mining slice is still open — item 5 |
| **FIX-004** §A+§B, §C, **§C dual-list (s46)** | ✅ | §A/§B/§C ✅ · **dual-list ❌** | **Redaction (b) is the one build left** — item 6 |
| **FIX-005** part 1, dead selectors, **the rename (s46)** | ✅ | part 1 ✅ · **rename ❌** | ✅ **Part 2 acceptance 5 closes.** Nothing left to build |
| **FIX-021** slice 0 + wizard location | ✅ | ✅ s44 3/3 | **Slices A/B are the open work** |
| **FIX-006** — AC1–AC4 | ✅ | ✅ | **The Substring weighting is the one build left** |
| **FIX-022** | ✅ | ✅ | Re-graded s43. **No rule written yet** |
| **FIX-008** A, B, E | ✅ | ✅ | C unblocked (**the measurement is an agent's, not Richard's**); D unstarted |
| **FIX-013** | 📋 | — | Ruling 1 = **(c)**. Rulings 2–4 still open |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |

**Thirteen closed outright.** ⚠️ **Count the names, don't copy a total.**

🔴 **Two tasks now have a built-but-undriven half, and they are the same drive** — see item 1.

---

## 2. Gate readings

✅ **s46 took the four marked.** This session changed **source**, so the readings are its own.

| Gate | Reading | When |
|---|---|---|
| **`noodl-editor` `test:main`** | ✅ **225/226 suites, 3498 / 3499** — the one failure attributed, below | ✅ **s46, 22:33** |
| **`--findRelatedTests`, all 4 changed source files** | ✅ **26 suites / 492 tests** | ✅ **s46** |
| **`tsc -p tsconfig.json`** | ✅ 0 errors | ✅ **s46** |
| **`tsc -p tsconfig.tests.json`** | ✅ 0 errors | ✅ **s46** |
| `test:ci` (jasmine) | ✅ 2843 / 6 @ 39393, six by name | run **2026-08-16 21:53:37** — **inherited, see below** |
| `noodl-core-ui` jest | ✅ 26 suites / 461 tests | s44 — inherited |
| `nodegx-backend` jest | ✅ 100 suites / 1085 | s40 — inherited |
| `lint:ci` ratchet | ✅ exit 0, 876 against a 3916 baseline | s44 — inherited |
| `library:check` | ✅ 58/58 | s30 — inherited |

⚠️ **Re-measure before quoting any of these.** ⚠️ **Both `tsc` readings are off empty output, not an
exit code** — `… | tail` reports the pipe's status.

### ✅ The one `test:main` failure is s44's known load-flake, attributed three ways

`bld-004/reasoningChannel`. Not assumed unrelated — **measured**:

1. **3/3 in isolation.**
2. **Absent from `--findRelatedTests`** for every file s46 touched.
3. **Green in s46's own earlier full run at 22:21**, on the same tree bar the later edits.

✅ **`--findRelatedTests` is the cheap instrument for "is that failure mine?"** — it answers from
jest's module graph rather than from your reading of the imports.

### 🔴 `test:ci` NOT taken by s46, and the reason is a measurement

Both items were flagged *"Blockly ⇒ `test:ci`"*. Two findings, pointing opposite ways:

1. ✅ **No jasmine spec reads any of these modules.** `grep` over `packages/noodl-editor/tests/**/
   *.spec.*` for `BlocklyToolbox` / `buildToolbox` / `BlocklyEditor` returns **zero** — the only hits
   under `tests/` are webpack **bundle artifacts**. `test:ci` would grade this only as *"the renderer
   bundle still builds"*, and neither commit adds an import or a symbol.
2. 🔴 **A reading taken then would not have been of these changes.** A **peer's editor stack was live
   for the whole session**: `scripts/start.ts` (pid 4024), **three** `webpack` processes, an Electron
   editor (pid 6031, renderer on 9222) — attributed by **PPID**, not by the 26 `electron/dist`
   matches, most of which are MCP servers. Peer source edits landed at **22:12:34 / 22:12:16 /
   22:13:02** (`noodl-core-ui` code-editor files), uncommitted, inside the ~40s webpack window a
   `test:ci` run would compile.

**So the floor stays inherited: 2843 / 6 @ 39393, witnessed 21:53:37.** ⚠️ **Record a TREE and the
mtimes of the fixtures a spec reads, not just `git rev-parse HEAD`** — a spec reads its fixture from
the **working tree**, which is why three "is the checkout clean?" checks missed a peer's fix in s45.

---

## 3. What s46 did, and the control that proved nothing

### ✅ FIX-004 §C dual-list — BUILT (`b5418806`)

`App Objects` carries seven entries. The four object-shaped blocks are **interleaved, not appended**:
each computed-key block sits directly beneath the literal-key sibling it generalises, so the flyout
reads as a pair. `noodl_new_object` and the JSON pair stay under `Data` only, and a spec pins that
asymmetry **with its reason**, so nobody later reads it as an oversight and "finishes the job".

**The fence narrowed to its own title.** `browser-blocks.spec.ts`'s `toEqual` over each whole seam
category became *"every id VFN-012 put there is still present, spelled the same, in the same relative
order"* — which is what *"changes no existing block type id"* asserts. It now permits exactly one new
thing: an addition.

### ✅ FIX-005 part 2, the rename — BUILT (`0a0c156e`). Acceptance 5 closes.

Four surfaces, one word: the English label, **six locales**, `APP_CONFIG_SETTINGS_PATH`, and the
settings-panel section that was calling it **`Custom Variables`** — a third name for the second of
two bags, sitting at the end of the route the flyout sends builders down. A spec now requires the
route's last segment to equal the heading.

⚠️ **The locales were not translated from the English.** Each took the "app" wording that language
*already* used for `App Objects` / `App Arrays`, so the renamed shelf sits **with** its neighbours in
every language rather than merely being a correct translation.

🔴 **And nothing could grade those locales, or ever had.** `BlocklyLocale.ts` imports
`@noodl-utils/editorsettings` at module scope, which does not resolve under `tests-unit` — so the
whole translation table was **unreachable from the only runner that could read it**, ungated since
VFN-012 shipped it. The table moved into `BlocklyToolbox.ts`, which imports nothing a plain-Node
runner cannot resolve — the same reason `convertModes.ts` and `objectData.ts` exist.
🔴 **Do not "fix" this by testing through `applyLanguage`**: it catches every load failure into
English, so a locale spec cannot tell a good translation from a bundle that would not load. Assert
the reading **is not the fallback object**.

### 🔴 The control that proved nothing, and printed four passes doing it

s46's first mutation table — four mutants, one per renamed surface — reported `7 passed` four times.
**None of them had applied.** The helper ran as `node -e '…' "$FILE" "$FROM" "$TO"`, and **under
`node -e` there is no script path, so `process.argv[1]` is the FIRST USER ARGUMENT**. Every
substitution tried to open the *search pattern* as a filename, `ENOENT`'d, and changed nothing.

⚠️ **A controls table's only job is to show the check FAILS on a broken input.** If the broken input
was never produced, every row is a healthy suite passing on correct source — the reading you already
had, restated four times and presented as evidence.

✅ **What caught it was node's own stack trace being loud.** A helper that swallowed the error would
have shipped the table. ✅ **The rerun uses a script file and prints `[mutant applied]` per row.**
⚠️ **Read the failure COUNTS, not pass/fail** — the fictional rows matched the un-mutated total
exactly, which is the tell.

### The eight mutants, once they were real

| mutant | bites |
|---|---|
| **M2 — rename `noodl_get_object_property` → its `_expr` twin** | 🔴 the narrowed fence, 1 of 19 |
| **M4 — weaken the fence predicate so order stops mattering** | 🔴 its own controls, 1 of 19 |
| M1 — drop a dual-listed block from `App Objects` | 🔴 `object-data`, 2 of 24 (fence green — by design) |
| M3 — append the four instead of interleaving | 🔴 `object-data`, 1 of 24 (fence green) |
| **M5 — leave the German locale behind** | 🔴 2 of 7 |
| **M6 — settings section keeps `Custom Variables`** | 🔴 2 of 7 |
| **M7 — `APP_CONFIG_SETTINGS_PATH` goes stale** | 🔴 3 of 7 |
| **M8 — English label never moves** | 🔴 1 of 7 **+ 1 in `vfn-012/app-config-block.spec.ts`** |

🔴 **M2 is the one that matters** — the plausible near-miss where a computed twin absorbs the
literal-key block, which would break every saved program holding it. **The narrowed fence still turns
red on it**, which is the whole licence for narrowing it.

### ⚠️ Two corrections to FIX-005's own blast-radius list

- **`browser-blocks.spec.ts` never pinned the string.** It reads `DEFAULT_TOOLBOX_LABELS
  .noodlVariables` **by reference** and followed the rename for free. Only
  `app-config-block.spec.ts:263` pinned the literal.
- **There is no `.jsx` anywhere in the rename's blast radius**, so it was not the *"`.jsx`/`test:ci`
  half"* it had been filed as for four sessions.

---

## 4. What to do next and why

**Ordered by cost.** Items 1 and 2 of s45's queue are gone; the drive is new.

1. 🟢 **DRIVE the two s46 builds — one editor launch closes both.** Open the Logic Builder flyout and
   read **`App Objects`** (expect **seven** rows, interleaved) and the **category name**
   (`App Variables`), then Settings → Project for the **`App Config`** heading. ⚠️ **Read the FLYOUT
   WORKSPACE, not the toolbox XML** — s38 records why: *"a block whose definition failed to register
   would still be named in the toolbox and simply not draw."* ⚠️ **The settings-panel half is
   currently graded by reading SOURCE TEXT for the `title` prop** — that spec says so itself, and it
   cannot prove the section renders.
2. 🟠 **FIX-008 C** — take the two-servers-visible measurement yourself (**it is an agent's, not
   Richard's**), then build C.
3. 🔴 **FIX-006 Substring weighting** — the one most likely to be got wrong. The rule is **not**
   "prefer nodes"; see §5.
4. 🔴 **FIX-022 — add the reuse-available cell** before writing any rule. ~$0.10 in API, and it is
   the difference between a rule that helps and one that forbids deliberate work.
5. 🔴 **FIX-016 — the script-mode mining slice.** `unionPorts` calls `minePorts(code)` in script
   mode, so FUN-005's rail and FUN-006's bar can show a Script node **ports it does not have**; the
   Script node's ports come from `parser.getPorts()`, never a regex over the document
   (`javascript.ts:831-840`). **Four surfaces.** ⚠️ s45's drive read the code editor's lint state
   only, not the rail or the bar.
6. 🔴 **FIX-004 redaction (b)** — route `noodl_log` through the scrubbed sink. ⚠️ **Not free**: the
   sink is per-run `runContext`, which generated code has no handle on today.
7. 🔴 **FIX-013** — build against ruling 1(c). ⚠️ Rulings 2–4 still owed.
8. 🔴 **FIX-021 slices A/B** — the user profile. Big; three of six questions answered.

**Do not start** FIX-015 here — it is its own phase.

### How to start here

🔴 **Census before you build, whatever the task file says.** s46's census took one `grep` and found
the rename's real blast radius was **four** surfaces, not the three the task file listed — and that
one of the three it did list was wrong.

🔴 **A "suite failed to run" line is COVERAGE NEWS, not a broken spec.** That is how s46 found six
languages had never been gradeable. Before fixing the import path, ask what else that module exports
and whether anything has ever graded it.

🔴 **Before deleting anything a spec might grade, search THREE roots**: `src/`, `tests/` **and
`tests-unit/`**. ⚠️ **Exclude `*.bundle.js`** — three sessions have now lost a search to a multi-MB
bundle hit.

✅ **A mutation check costs one shell call** — apply, run, restore, `diff` back, all in **one** Bash
invocation so no peer's `git add -A` can catch the broken file. 🔴 **And make each mutant announce
that it applied**, per §3.

🔴 **Grading anything in the code editor, headlessly:** `javascriptDiagnostics(state, validationType)`
is pure and runs in `noodl-core-ui`'s jest. `setOpenNodeContext({typeName, declaredInputs,
declaredOutputs})` says which node is open; `null` is a code **file**, not a node.

✅ **Grading it in the running editor** (s45's recipe): `forEachDiagnostic` off the module cache at
`../../node_modules/@codemirror/lint/dist/index.js`, against
`document.querySelector('.cm-content').cmTile.view.state`. Select the node by its **view** node via
`NodeGraphContextTmp.nodeGraph`, then `cdp click "button.property-codeeditor-button"`.
⚠️ **Settle ~20s before reading, and return `{alive}` from every read.**

🔴 **Grading what the AI plans:** `packages/noodl-editor/scripts/aix002-measure/dist/fix022-plan.cjs`.
✅ `--dump=<path>` writes the arm's system prompt and exits before the provider is built.
⚠️ `--model` is effectively required. **Authoring** is the sibling `dist/aix002-harness.cjs`.

---

## 5. Rulings — what a builder must not get wrong

- 🔴 **FIX-006 Substring — "weight built-in nodes heavier" is only HALF the rule.** Richard's
  exception is load-bearing: *"unless the operation requires more complexity which could be easily
  rolled into a Function, otherwise you end up with function nodes connected to substring nodes
  connected to functions."* The failure being ruled against is **alternation**. Simple ⇒ the node;
  complex ⇒ **all of it in one Function**. ⚠️ **A rule that only pushes "use the node" manufactures
  exactly the chain this forbids.** Measure node choice **and** chain shape. ⚠️ n=5 cells are not a
  floor; re-run at n=10. ⚠️ **Coupling:** this preference belongs in FIX-021's user profile, where
  Richard can change it — **do not build it in a way that forecloses slices A/B.**
- ✅ **FIX-004 §C dual-list — BUILT s46, NOT driven.** The seam fence is narrowed and its narrowing
  is mutant-checked; **do not widen it back** to admit a future change, narrow it to *its own claim*
  and prove it still bites.
- ✅ **FIX-004 — redaction (b)**, scrubbed sink. **Still the one FIX-004 build left.**
- ✅ **FIX-005 — rename BUILT s46**, reversing VFN-012 knowingly and saying so in the commit. **The
  argument lives on `ToolboxLabels.noodlVariables`; do not re-litigate it from `appConfig.ts`.**
- ✅ **FIX-016 ruling 1 — BUILT s44, DRIVEN s45.**
- ✅ **FIX-013 ruling 1 → (c), shim serves zero rows.** ⚠️ The Fix direction **hard-codes
  `useSampleData: true`** and must stop. 🔴 **Rulings 2, 3, 4 still owed.**
- ✅ **FIX-021 — wizard location (B) BUILT + DRIVEN. Slices A/B GREEN as a USER PROFILE**, per-user
  and gitignored, `CLAUDE.md` stays the signpost, human-authored first. 🔴 **Q2, Q5, Q6 still open.**
- ✅ **FIX-008 C — the measurement is an AGENT's, not Richard's.**
- ✅ **FIX-022 — no numeric floor; the axis is REUSE.** One cell still missing before a rule is safe.

### 🔴 Two things Richard raised that are NEW TASKS, not P66 items

- 🔴 **Blockly should enumerate declared globals as draggable blocks** — App Variables, Objects,
  Arrays, plus `Function Variables`, in their own drawer. ✅ **Blockly's own native model.** ⚠️ **s46's
  rename does NOT pre-empt this** — it only made the four shelves share one vocabulary, which is the
  thing that drawer would enumerate. **Its own task.**
- 🔴 **FIX-015 → its own phase, green-lit.** ⚠️ **Slice 1 is "build and test the panel", not "un-gate
  it"** — expect the first drive to return a bug list.

### Still owed by Richard

- 🔴 **FIX-013 rulings 2, 3, 4** · 🔴 **FIX-015's eight** · 🔴 **FIX-021's Q2, Q5, Q6.**
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work.** ⚠️ Unlanded work on a PR-gated script is exactly what a sibling's `git add -A`
  sweeps. **Still uncommitted at s46** — fourteen sessions now.
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Fourteen
  sessions have declined.**
- ⚠️ **The packaged-app repackage is still owed** (`noodl-mcp/dist` rebuilt s36, gitignored).
- ⚠️ `fix021-drive-ai` / `fix021-drive-plain` still point at a scratchpad path that will be cleaned.
- ⚠️ `fix016-msg6-drive` is worth keeping — the only fixture with **both** JS node types in one
  component.

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the phase
directory is `phase-66-0.1.7-bug-fixes`.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file: `add`
and commit in the **same** command, which is how s46 landed `toolbox-vocabulary.spec.ts`.
✅ **s46 committed twice, pathspec-only**; peers' work (phase-50 notes, phase-65, phase-68, phase-69
TASKS, `scripts/library/check.ts`, and in-flight `noodl-core-ui` code-editor edits) was untouched
throughout, and two peer commits landed between s46's own two without incident.

⚠️ **This checkout is busy and peers save source constantly.** A save triggers a webpack rebuild that
HMR-reloads the renderer mid-drive. ✅ **A peer will hold saves if you ask.** ✅ **Re-establish the
whole rig in ONE eval afterwards**, so the re-entry window is a single call.

### 🔴 Peer etiquette — s46 launched nothing, and that is why it said nothing

s46 ran **no editor and no `test:ci`**, so it had nothing to announce and announced nothing. It did
**measure** the checkout, and found **a peer's editor stack live throughout** — which is the input to
the `test:ci` decision in §2, not a complaint.

⚠️ **If you launch, that changes.** 🔴 **Announce teardown to the FULL launch list**; a launch with no
matching close manufactures a reservation that outlives you. 🔴 **Reply to a socket on its socket.**
🔴 **All `electron/dist` matches on an idle checkout are MCP servers, not editors** — attribute by
**PPID**, never quote a count as evidence of an editor.

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler. 🔴 **`pkill` never reaches
`sweep()`.** ⚠️ **Compare pids, never counts.** ⚠️ The launcher exiting **144** is `dev:stop` reaping
it, not a failure.

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**.
🔴 **s46 measured `17,399` code points / `17,492` UTF-16 — roughly EIGHTEEN characters of headroom.**
**`MEMORY.md` is FULL.** s46 added **nothing** to it: two new memories and one update were filed
under existing pointer entries, which costs zero budget.

🔴 **The next session that needs an index line MUST collapse something first.** Promote traps out
before collapsing, and a section with a 📚 pointer takes new entries **in the pointer file**.

🔴 **It moves while you read it** — a peer added ~107 UTF-16 between s45's measurement and s46's.
`grep -rl` the memory dir before writing anything up as new.

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

### 🔴 Re-read this file immediately before rewriting it

s44 overwrote a peer's 29 lines by rewriting from its context copy; s45 was saved by re-reading. ✅
**s46 checked `git log -1 --stat` plus the mtime before rewriting and found it unchanged since
22:12:42** — the check is cheap and has now paid twice in three sessions.

✅ **Before rewriting any shared document, `git log -1 --stat` it and re-read it.** A whole-file
overwrite is the one edit that cannot conflict — git accepts it happily, and the loss is invisible in
the diff you are looking at.
