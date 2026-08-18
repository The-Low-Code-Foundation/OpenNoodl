# Phase 66 — next session

**Written 2026-08-18, session 59's brief, by session 58.** A rewrite, per §0. s58 took s57's item 1 —
**FIX-021 slices A/B — and slice B is BUILT** (`912b89b2`) — plus s57's item 4, the fixture rename.

## 🔴 How much of phase 66 is left: TWO SESSIONS OF ENGINEERING, and a pile of rulings

**Twenty-four tasks. Eighteen closed outright. FIX-015 left the phase** (its own, green-lit).
Of the remaining five, **four have no open build at all** — what they have is a *ruling owed by
Richard* — and the fifth is FIX-021, whose slice B is built and undriven.

✅ **So the engineering that remains fits in two sessions, and s58 has bundled it that way.** §4 is
no longer a list of four items; it is **two bundles**, ordered, each of which pays one set of gates
instead of two. 🔴 **The bundling is not cosmetic: in both bundles the second half depends on the
first**, so taking them apart costs a launch or re-runs a gate for nothing.

🔴 **The phase's real remaining risk is not code, it is the eight-session-old REPACKAGE.** Three
finished tasks — FIX-008 D, FIX-013 and now slice B — are all *"driven in the checkout, absent from
the packaged app"*. They clear together, in one build, in bundle 1.

🔴 **s58's headline finding: TWO specs were green while measuring nothing.** One row named a branch
it never exercised. The other, worse: *"absent means omitted"* compared a turn built without the
argument against one built with `''`, asserted byte equality — and **could not see a block emitted
unconditionally, because both arms are built by the same code.** 🔴 **An equality between two arms is
blind to any mutant that shifts both arms equally.** A differential assertion needs an absolute one
beside it.

⚠️ **And the mutant GUARD lied, twice, in the safe-looking direction.** Two prompt-side mutants first
reported `MUTANT DID NOT APPLY`; both had applied, and both killed rows on the retry. See §4.

🔴 **Every ruling and measurement is in its own task file.** §4 here is a work order. Slice B's full
write-up — the empty-file rule, the three assumed answers with their rejected options, the mutant
table, and what is deliberately *not* built — is at the foot of FIX-021's own file.

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
| **FIX-001 / 002 / 003 / 005 / 007 / 009 / 010 / 011 / 012 / 013 / 014 / 017 / 018 / 019 / 020 / 023 / 024** | ✅ | ✅ | **CLOSED** — seventeen tasks |
| **FIX-008** A, B, C, D, E | ✅ | ✅ | **CLOSED** (s56) |
| **FIX-021** slice 0 + wizard location | ✅ | ✅ s42/s44 | Closed halves |
| **FIX-021 slice B** — the global user profile | ✅ 🆕 s58 | ❌ | 🔴 **THE PHASE'S ONLY OPEN DRIVE.** Needs no credit — bundle 1 |
| **FIX-021 slice A** | ⛔ | — | 🔴 **DELIBERATELY NOT BUILT** — see §5. This is a decision, not an omission |
| **FIX-004** §A+§B, §C, §C dual-list, + redaction (b) | ✅ | ✅ / ⚠️ | **No open build.** Browser half needs no drive — s51's note, kept in §5 |
| **FIX-016** §2, §3, §3c, ruling 1, + the mining slice | ✅ | ✅ s50 | **No open build.** ⚠️ **AC1 still false as built** — §5 |
| **FIX-006** — AC1–AC4 + the Substring weighting | ✅ | ✅ | **No open build** (s52). Two judgements left — §5 |
| **FIX-022** — re-grade + the reuse cell | ✅ | ✅ | **No open build** (s53). ⚠️ The §7 ruling is the only thing owed |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |

🔴 **EIGHTEEN tasks closed outright** — the seventeen named in row 1, plus FIX-008.
⚠️ **s58 inherited "nineteen" here and it was wrong**: the number had been copied forward across a
table whose rows changed under it. **Count the names, never copy a total** — and the arithmetic that
has to balance is **18 closed + FIX-015 (left the phase) + 5 still open = 24**.

---

## 2. Gate readings

✅ **s58 took EVERY reading in this table itself.** Nothing below is inherited, which is the first
time that has been true in this phase — the build touched five source files in the editor bundle, so
every editor gate was genuinely owed.

| Gate | Reading | When |
|---|---|---|
| `test:ci` (jasmine) | ✅ **2849 / 6 @ seed 39393** — **the floor**, both known families (AIX-006 style vocabulary ×4, AI model registry ×2) | ✅ **s58** |
| `noodl-editor` `test:main` (jest) | ✅ **239 suites / 3658 tests, 0 failed** | ✅ **s58** |
| `tests-unit/fix-021/` | ✅ **4 suites / 32 tests** (7 inherited + **25 new**) | ✅ **s58** |
| `typecheck:editor` | ✅ exit 0, and `--listFiles` confirms all five new files **are** in the compile | ✅ **s58** |
| `typecheck:editor-tests` | ✅ exit 0 | ✅ **s58** |
| root `npm run typecheck` | ✅ exit 0 | ✅ **s58** |
| `lint:ci` ratchet | ✅ **877** / 3916 baseline — **identical to s55**, so slice B adds zero lint debt | ✅ **s58** |
| `noodl-mcp` jest, FULL | ✅ 53 suites / 633 tests | s56 — inherited |
| resident tool-surface budget | ✅ 8,223 / 57 under the 8,280 bar | s56 — inherited |
| `tsc -p tsconfig.json` (noodl-mcp) | ⚠️ **8 errors — pre-existing, diffed byte-identical** | s56 — inherited |
| `noodl-runtime` jest | ✅ 137 suites / 2515 | s54 — inherited |
| `nodegx-backend` / `viewer-react` / `cloud-runtime` | ✅ | s51 — inherited |
| `library:check` | ✅ 58/58 | s30 — inherited |

⚠️ **Re-measure before quoting any of these.** 🔴 **Quote a TREE, not a commit.**

### 🔴 Readings that will mislead you

- 🔴 **`test:ci`'s total is the cross-check that matters, not just the failure count.** slice B adds
  **zero** jasmine tests (both new suites are `tests-unit`, plain-Node jest), and the total came back
  **2849 — the same integer as s55**. A total that had moved would have meant a bundle change nobody
  intended. ⚠️ **The exit code lied as documented:** npm reported 1, and the backgrounded
  `… | tail` reported **0**. **Read `tests/test-results.json`, having deleted it first.**
- 🔴 **`noodl-mcp` has NO root typecheck gate.** ✅ **Re-measured 2026-08-18, not inherited:**
  **nine** `typecheck:*` scripts in the root `package.json` plus a plain `typecheck`, and
  **`typecheck:mcp` is not among them**. The package's own `tsc` reports **8** errors — **1 real**
  (`disclosure.ts:381`, `Exclude<ToolGroupId,'core'>` vs zod) and **7 across three test files**.
  ⚠️ **s58's own earlier draft said "ten `typecheck:*`" and that was wrong** — counted before it was
  measured. **Nothing watches this package** — bundle 2, step 1.
- 🔴 **A tool added to an existing DEFERRED MCP group costs ZERO surface budget** — measured twice.
- 🔴 **`provision.test.ts` and `projectOwnsBackend.test.ts` flake** on real ports. **Do not report
  them as a regression without an isolation re-run.**
- 🔴 **A jest run of `tests/` is NOT what a client runs** — in-process `InMemoryTransport` vs
  `dist/noodl-mcp.cjs` over stdio.

### ⚠️ A peer landed uncommitted work mid-session

At s58's start the tree carried three long-standing modified files plus `?? dev-docs/tasks/phase-65-the-library/`.
By s58's finish a peer had added, uncommitted:

```
 M packages/nodegx-kit-catalog/src/{health.js,index.js,index.d.ts}
 M packages/nodegx-kit-catalog/tests/{health.test.js,overlay.test.js}
 M packages/noodl-mcp/tests/kitOverlay.test.ts    M scripts/devtools/render-from-disk.js
 M packages/noodl-editor/tests-unit/cn-001/render-harness-injects-modules.test.ts
 ?? dev-docs/tasks/phase-69-the-node-you-write-yourself/notes/cn-012-measurement.md
```

✅ **s58 committed by explicit pathspec and verified afterwards that every one of those survived.**
Do the same. ⚠️ **None of it is in the editor webpack bundle**, so it could not have contaminated
`test:ci` — and the bundle was already built and running before s58's first source mutation, which
is the window that matters.

⚠️ **The bundled-editor-build gap is now eight sessions old.**

---

## 3. What s58 did

### FIX-021 slice B — `<userData>/PREFERENCES.md`

One markdown file per person, per machine: outside every project directory and therefore outside
git, which is **Q4's ruling honoured by location rather than by a rule**. Seeded, never rewritten,
read before the AI builds anything, in every project.

Nine files — four new under `models/UserProfile/`, one new settings section, four wired
(`prompts/authoring.ts`, `ContextBuilder.ts`, `AuthoringSession.ts`, `router.setup.ts` +
`EditorSettingsTab.tsx`). The full table is in the task file.

🔴 **The empty-file rule is the build.** A global always-doc is a charge on every turn of every
project forever — the objection Q5 raises — and the answer is mechanical rather than a policy:

- guidance lives in **HTML comments** and is stripped before anything is sent;
- a **heading with nothing under it is dropped**;
- a file that says nothing renders `undefined`, and the block is **omitted entirely**.

So a freshly seeded `PREFERENCES.md` costs **zero prompt bytes** and is charged **nothing** — not
zero chars, *nothing*, because a row per turn is still a row. The settings section prints the number
that goes out, beside the button that changes it.

The block is appended **last** in the reference blocks, in the cache-stable half: writing your first
preference invalidates only the **tail** of the prefix. ⚠️ **Being last is a caching argument and not
a priority one**, so the precedence ladder is stated in the block itself — below the project's own
conventions, above the model's defaults.

### Item 4 — `fix013-drive`'s `project.json`

`"name"` read `fix012-drive`; renamed on the source fixture. The launcher coin-toss s57 hit is gone.

---

## 4. What to do next and why — TWO BUNDLES, in this order

⚠️ **Both bundles were sized at s58 against a re-measured tree, not recalled.** Where a cost is
unknown it says so.

### 🔴 Bundle 1 — "everything that runs the app" (drive slice B, then repackage)

**Why these are one session and not two: the drive must precede the package anyway.** You would
launch the dev editor, verify slice B, tear down, and then build — and the package verification
re-checks the same feature in the shipped bundle. Split across two sessions you pay two launches and
verify slice B twice for one answer.

**Step 1 — drive FIX-021 slice B in the dev stack. No API credit needed.** The half the specs cannot
reach is `install.ts` — `platform.getUserDataPath()`, the seeding write, and the poll — and it is
exactly the half a user meets first. **Pre-register these four before launching:**

- Settings → **Editor** tab → **"About you"** section is present, below the AI keys.
- With no file: caption reads *"You have no preferences file yet"*, button reads
  **"Create and open preferences"**.
- Click it → the file appears at `<userData>/PREFERENCES.md` → the caption becomes *"…you have not
  written in it yet, so nothing is being sent."* 🔴 **This is the empty-file rule end to end and it
  is the one row worth having** — a seeded file reporting a NON-zero count would mean the
  comment-stripping never ran against the real template.
- Write one line into the file from outside the editor → within ~2s the count goes non-zero
  **without reopening the panel**. That is the poll, and the whole *"the document is the UI"* promise.

⚠️ **It writes into Richard's live `~/Library/Application Support/NodeGX/`.** Back it up if a file is
already there; a seeded one is the product's own behaviour and can be left.

**Step 2 — `npm run build:sidecars` then `npm run build:editor:pack`, and verify THREE tasks at
once.** `/Applications/NodeGX.app` is dated **2026-08-13** — measured at s58, not recalled. Three
finished features exist only in the checkout:

| task | what to look for in the packaged app |
|---|---|
| **FIX-008 D** | `open_project` exists as a tool |
| **FIX-013** | the bench has no Data / sample / real-backend controls |
| 🆕 **FIX-021 slice B** | Settings → Editor → **About you** is there at all |

🔴 **This is the item with a live user impact**, and it is the only thing in the phase that is
*shipped-vs-built* rather than built-vs-driven. ⚠️ **Its cost is UNMEASURED** — eight sessions have
gone past it, which may mean it is bigger than it looks. **If the pack turns out to be a project,
stop and write down why**; the drive in step 1 still stands on its own.

### 🔴 Bundle 2 — "everything inside noodl-mcp" (the gate first, then the code under it)

**Why these are one session: same package, same gates.** `noodl-mcp`'s jest suite (53 suites / 633),
its surface-budget line and its esbuild build all get run once instead of twice. 🔴 **And the order
is causal, not cosmetic — step 1 is the gate that would catch step 2's mistakes.**

**Step 1 — add a root `typecheck:mcp` and deal with the 8 errors.** ✅ **Re-measured 2026-08-18, not
inherited: still exactly 8, and still absent from the root.** The root has **nine** `typecheck:*`
scripts plus a plain `typecheck`, and **`typecheck:mcp` is not among them** — so this package's types
are watched by nothing.

- **1 is real:** `disclosure.ts:381`, an `Exclude<ToolGroupId,'core'>` vs zod `ZodEnum` mismatch —
  the handler's parameter type excludes `'core'` and the schema does not.
- **7 are in three test files:** `connectionPresentation.test.ts` (a dead `../src/types` import) and
  six `Property 'text' does not exist on type 'ToolCallResult<…>'` in `interfaceGate.test.ts` /
  `stagingDiagnostics.test.ts`.

⚠️ **Decide out loud whether the new gate covers `tests/`.** Seven of the eight errors are there, so
a gate scoped to `src/` is green on day one and a gate scoped to both is red — and shipping a red
gate is how a ratchet gets ignored. Either is defensible; silently picking the green one is not.

**Step 2 — build FIX-021's MCP half, under the gate you just added.** Slice B specified it and s58
deliberately did not build it: the profile path goes into `.mcp.json` `env` at registration (the
BST-004 *"front door, never guess"* pattern), and **it breaks the server's
every-path-inside-`projectDir` invariant, so it needs its own read-only containment note.** That
argument is why it is a task and not a paragraph. **Today the editor's AI reads the profile and
Claude Code does not.**

### What is NOT a bundle, and why

- 🔴 **The four "no open build" tasks (FIX-004, 006, 016, 022) cannot be bundled into anything,
  because none of them is waiting on work.** Each is waiting on a sentence from Richard — see §5.
- ⚠️ **FIX-016 AC1 is the one that could become a build**, and it is already **driven and found
  false**: clicking `+` beside `SCRIPT OUTPUTS` opens *a name field and nothing else*, so
  *"offers Signal at creation time"* is false as built. **Do not re-measure it.** It is retire-or-build,
  and only Richard can say which.

**Do not start** FIX-015 here — it is its own phase.

### Carried, uncosted

- 🔴 **A bar that teaches `define()`** (s50). Needs the node's **real** port list, behind
  `parser.getPorts()`. **Wants a task; needs a syntax-tree parse of `define()`.**
- ⚠️ **A Script node's `define()`-declared ports are invisible to every editor surface** (s50).
- 🔴 **The `io-error: Unexpected failure: ${err.message}` wrapper names neither the tool nor the
  project.** **Wants its own task.**
- ⚠️ **A missing `id` has the identical shape to FIX-023's missing `type` and is unguarded.**
- ⚠️ **`noodl-core-ui` cannot be eslinted at all**: `eslintConfig` extends an uninstalled `react-app`.
- 🆕 ⚠️ **The PLANNING turn does not carry the profile** — only the authoring turn does, which is what
  slice B specified. Arguably the wrong line: *"prefer built-in nodes"* is a decision a **planner**
  makes. One extra parameter on `planningUserMessage`, but a planning turn has **no `cacheBoundary`**
  and is not cached, so it is a real per-plan cost. Belongs with Q5.

### How to start here

🔴 **A differential assertion needs an absolute one beside it.** s58's *"absent means omitted"* spec
compared two turns and asserted byte equality — and survived a mutant that emitted the block
**unconditionally**, because both arms are built by the same code and both got the block. ✅ **Ask of
every A/B spec: is there a mutant that moves A and B together?** The tell is a spec whose every
assertion is `toBe(other)` with no literal anywhere in it.

🔴 **Guard a mutant by COUNTING THE PATTERN BEFORE mutating, and require exactly 1** — not *"is it
gone afterwards"*. s58's after-the-fact `grep` reported `DID NOT APPLY` for a mutant that applied
perfectly, because the deleted line occurs **three times** in `ContextBuilder.ts`. A second guard
missed because BRE `\?` is the *optional operator*, not an escaped `?`. 🔴 **A "did not apply" row is
not a free skip — re-run it.** Two of five did apply, and both killed rows.

🔴 **`perl -0777 -pe 's{…}{…}'` cannot carry a pattern containing `{` or `}`** — a TypeScript method
body always does. ✅ **Use a script file doing plain-string `split`/`replace`.** ⚠️ And perl
interpolates `@noodl/...` inside a double-quoted replacement — one package name silently became
`/platform`.

🔴 **Read the CONTROL row before the measurement row** (s57's, still true).

🔴 **Write the expected observation BEFORE driving, and expect to be wrong in a way that teaches.**

🔴 **Check the exit code before reading the output, never through a pipe** — ⚠️ **`${PIPESTATUS[0]}`
is empty in zsh** (it is `$pipestatus`). 🔴 **macOS has no `timeout`.**

---

## 5. Rulings — what a builder must not get wrong

- 🆕 ✅ **FIX-021 slice B — BUILT s58, on three ASSUMPTIONS Richard has not ruled.** Each is a
  sentence to overturn, not a rewrite:
  - **Q5 → `always`, capped at 2,000 chars, free when empty.** **Rejected:** `pull` — `when:` hints
    are unwritable for preferences, so it would arrive only when the model thought to ask.
  - **Q6 → prose only, for now.** **Rejected in this slice:** splitting deploy-target / go-to-backend
    into `ai.role.*`-style keys. Right eventually; guessing the fields before anyone has written a
    profile is not.
  - 🔴 **Q2 → ONE file, and NO second project-level document. Slice A is deliberately NOT built.**
    A per-project `.nodegx/preferences.md` beside `docs/CONVENTIONS.md` is two overlapping taxonomies
    and two sources of truth. A per-project rule already has a home; what had none was the person.
- 🆕 🔴 **Things slice B must keep doing:** guidance stays in **HTML comments** (they are what makes
  seeding free); an empty section stays **dropped**; the block stays **last** and stays **ahead of
  `cacheBoundary`**; the **precedence sentence stays in the block**; `globalPreferences()` keeps
  charging **nothing** — not zero — for an empty profile; `ensureUserProfileSeeded` keeps writing
  **only when there is no file**.
- ✅ **FIX-013 — CLOSED s57.** 🔴 **`useSampleData` is not the switch.** 🔴 **`emptyState` must keep
  shipping the class list NAMED.** 🔴 **`synthesizeMissing` defaults `true`, bench sends `false`.**
  🔴 **`list()` caches the empty array.** 🔴 **The bench summary must keep WRAPPING** — a measured
  property. 🔴 **`ComponentBench` imports neither `SandboxToolbar` nor `SandboxDataEditor`.**
- ✅ **FIX-013 ruling 2 → the two surfaces DIVERGE.** 🔴 **The AI preview keeps its toolbar and data
  editor.** BEN-004 §7 knowingly retired for the bench.
- ✅ **FIX-013 rulings 3 + 4 → the non-destructive branch.** ⚠️ **Richard's answers still owed.**
- ✅ **FIX-008 D — BUILT + DRIVEN s56.** 🔴 **`completeBind` stays the single successful-bind path.**
  🔴 **`ProjectBinding`'s bind-once boundary holds.** 🔴 **`list_projects`' note branches on
  `isBound`.** 🔴 **The same-directory case keeps its own answer.**
- ✅ **FIX-022 — the reuse cell BUILT + MEASURED s53.** 🔴 **`minPlacementSites` OFF for `trivial`,
  `small-logic`, `multi-section`.** 🔴 **BOTH evidence paths.** 🔴 **A REGRESSION detector.**
- ✅ **FIX-022 — no numeric floor; the axis is REUSE** (s42).
- ✅ **FIX-006 — the Substring weighting BUILT + MEASURED s52.** 🔴 **`NODES_BEFORE_CODE` keeps BOTH
  halves**, a separate export from `THREE_WAYS_TO_COMPUTE`.
- ✅ **FIX-006 AC4.** 🔴 **`Javascript2` must keep leading the Script paragraph** (`traps.ts:61-63`).
- ✅ **FIX-004 — redaction (b) CLOSED s51.** 🔴 **`console` stays LAST in all four parameter lists**;
  do not tidy the four spellings into one constant; `createBlockConsole` returns `console` ITSELF
  when there is no sink.
- ✅ **FIX-016 — mining slice CLOSED s50.** 🔴 **`modeHasDeclaredPorts` stays `true` for `'script'`.**
  ⚠️ **AC1 as originally written is still FALSE as built.** **Retired or still owed? s50–s58 did not
  decide.**
- ✅ **FIX-023 — CLOSED s49.** 🔴 **`malformedNode` 2nd in `ALL_RULES`; `duplicateNodeId` leads.**
- ✅ **FIX-008 C — 🔴 Observe stays `user` on purpose.** 🔴 **`--scope project` resolves against the
  shell's cwd**; the `scopeNote` names the folder.
- ✅ **FIX-005 — CLOSED s48.** The rename reversed VFN-012 knowingly.
- ✅ **FIX-021 — wizard location (B) BUILT + DRIVEN s44.**
- ✅ **FIX-024 — CLOSED s51.** 🔴 **`'learn'` and `'learning'` are two different pages.**

### 🔴 Two things that are NEW TASKS, not P66 items

- 🔴 **Blockly should enumerate declared globals as draggable blocks** — App Variables, Objects,
  Arrays, plus `Function Variables`, in their own drawer. ✅ **Blockly's own native model.**
- 🔴 **FIX-015 → its own phase, green-lit.** ⚠️ **Slice 1 is "build and test the panel".**

### Still owed by Richard

- 🔴 **THE ANTHROPIC CREDIT BALANCE IS EXHAUSTED.** ⚠️ **s54–s58 all needed none of it, and neither
  does bundle 1.**
- 🔴 **THE REPACKAGE — still the item with a live user impact.** `nodegx-puppy-test-3` resolves to
  `/Applications/NodeGX.app/…`, the **Aug-13** bundle. FIX-008 D's `open_project` and FIX-013's fix
  exist in the checkout bundle and in no packaged app. 🆕 **Slice B joins them.**
- 🆕 🔴 **FIX-021 Q2, Q5 and Q6 — confirm or overturn the three assumptions in §5.** Q2 is the one
  that changed what got built.
- 🔴 **FIX-013 rulings 3 and 4 — confirm or overturn.** Not blocking; overturning is a deletion
  someone has to authorise.
- 🔴 **FIX-022 §7 — (a) accept, (b) a rule on the reuse axis, or (c) `planAdvisories`?**
- 🔴 **FIX-006 — is `Substring` → `Expression` the shape you want?**
- 🔴 **FIX-015's eight** · 🔴 **FIX-016 AC1 — RETIRE IT, or build a type control at creation time?**
  ⚠️ **Already driven and found false at s50** — clicking `+` beside `SCRIPT OUTPUTS` opens a name
  field and nothing else. **This is the only owed ruling that would create a new build.**
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work. Still uncommitted at s58 — twenty-six sessions.**
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Twenty-six
  sessions have declined.**
- ⚠️ `fix021-drive-ai` / `fix021-drive-plain` still point at a scratchpad path that will be cleaned.
- ⚠️ **Fixtures kept on purpose:** `puppy-test-3-fix008c`, `fix016-msg6-drive`, `fix004c-s48-drive`.
  ✅ 🆕 **`fix013-drive`'s `project.json` `name` is fixed** — s57's item 4, done at s58.
  ⚠️ **`fix016-s50-drive` is a scratch copy, deletable.**

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the phase
directory is `phase-66-0.1.7-bug-fixes`. ⚠️ **The shell's cwd persists between Bash calls** *and is
reset after some tool results*; write every path absolute and the question does not arise.
✅ **s58 was bitten by this twice** — both times a `cd` in a compound command, reported in the result.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file: `add`
and commit in the **same** command. ⚠️ **s58 had five new files and one new directory**; both went in
one chain with the message in a file.

🔴 **This checkout is SHARED and the peer commits mid-session.** ⚠️ **`hot: true`**: an edit to
`packages/noodl-editor/src` hot-reloads a live editor mid-drive — **and so does an edit to
`packages/noodl-viewer-react/src`**, because its webpack build emits into
`packages/noodl-editor/src/external/`, which the editor dev server watches. ✅ **Take each measurement
in ONE uninterrupted chain of `cdp` calls**, and re-establish `__req` after any reload.

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler. 🔴 **`pkill` never reaches
`sweep()`.** ⚠️ **Compare pids, never counts.** ⚠️ The launcher exiting **144** is `dev:stop` reaping
it, not a failure. 🔴 **All `electron/dist` matches on an idle checkout are MCP servers** — attribute
by PPID and cmdline. ✅ **s58 measured an idle checkout exactly this way at its start.**

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**.
🔴 **s58 measured 17,504 — SIX characters of headroom.** ✅ **Both of s58's findings went into
EXISTING pointer files** (`a-control-pair-proves-what-you-varied-only.md`,
`a-mutant-that-never-applied-reports-a-pass.md`), which costs zero index budget. **Do the same; the
index cannot take a new line.**

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

### 🔴 Re-read this file immediately before rewriting it

✅ **s46 through s58 all checked `git log -1 --stat` plus the mtime before rewriting** — the check has
now paid or cleared fourteen sessions running. ✅ **s58 also ran `git diff --stat HEAD` on this file
immediately before writing**, which is the cheapest proof that the context copy is current.

✅ **Before rewriting any shared document, `git log -1 --stat` it and re-read it.** A whole-file
overwrite is the one edit that cannot conflict — git accepts it happily, and the loss is invisible in
the diff you are looking at.
