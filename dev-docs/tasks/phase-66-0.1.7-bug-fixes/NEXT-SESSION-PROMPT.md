# Phase 66 — next session

**Written 2026-08-15, session 14.** One build: **FIX-001 §1a**, the runtime layer for Explain Mode —
the explainer can now see the running app. **1b was reproduced from source and is discoverability,
exactly as the task predicted.** Nothing was driven this session.

🔴 **The day's real story is not the build. Two `test:ci` runs were destroyed, both behind a zero
exit code, and the second one was caused by my own advice.** The mechanism is now understood, fixed
and verified — see §3. If you read only one section, read that one, because it changes the
announce-and-verify protocol every session in this checkout has been using.

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, overwritten each session. It carries exactly four things:

1. **Built vs. driven**, per task, as a table — *built* is code plus gates; *driven* is the app
   doing it. Never let the two blur into "done".
2. **Gate readings with their date and tree**, so the next session compares NAMES against a reading
   it can trust rather than re-deriving one.
3. **What this session settled**, so nobody re-litigates or re-measures it.
4. **What to do next and why**, ordered, with rulings owed by Richard called out separately.

Learnings that outlive the phase go to memory, not here.

---

## 1. Built vs. driven

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-007** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-009** | ✅ | ✅ 5/5 | **CLOSED** |
| **FIX-010** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-011** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-012** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-018** | ✅ | ✅ 5/5 | **CLOSED** |
| **FIX-019** | ✅ | ✅ 4/4 | **CLOSED** — 🟡 14(a) vocabulary sweep still owed |
| **FIX-020** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-002** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-003** | ✅ | ✅ 5/5 | **CLOSED** — `will-navigate` proven (s13) |
| **FIX-001 §1a** | ✅ **NEW** | 🔴 **0/3** | built + gated this session; **criteria 1, 2, 3 are undriven** |
| **FIX-001 §1b** | ✅ pre-existing | 🔴 0/1 | **source-verified as discoverability**; criterion 4 needs a drive |
| **FIX-001 §1c** | 📋 open | — | untouched |
| **FIX-014** | ✅ | 🔴 0/1 | not started; MCP half **blocked on a repackage** |
| **FIX-008** A, B, E | ✅ | ✅ | C, D not built |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

**Ten closed.** FIX-001 is now the phase's largest *built-but-undriven* item.

---

## 2. Gate readings

**Tree at 13:20, 2026-08-15.** 🔴 Quote against a **tree**, not a commit — `test:ci` webpacks the
working tree. Phase-67's lesson work (`8c5a9ef7`) was committed mid-session and is included.

| Gate | Reading | When |
|---|---|---|
| `test:ci` (jasmine) | ✅ **2812 specs / 6 failures — the floor exactly by name**, pinned seed 39393 | 13:29 (run 4) |
| `test:main` (jest) | ✅ **203 suites / 3136 tests, 0 failed** — phase-67's reading, +1 suite/+16 for their new `uni-010` spec | ~12:40 |
| editor `tsc --noEmit` | ✅ 0 errors | 13:16 |
| `tsconfig.tests.json` | ✅ 0 errors | 13:16 |
| `lint:ci` | not run | — |

### `test:ci` — run 3, seed 39393, `test-results.json` mtime 13:14

```
totalCount   2812      (= 2788 floor + 24 new specs — the delta IS the proof they ran)
failedCount  9         (= the 6-name floor + 3 spec-side regressions, all mine)
```

✅ **The floor held exactly:** 4 × `AIX-006 style vocabulary`, 2 × `AI model registry`.
✅ **Zero `BEN-001`** — notable, because adding 24 specs shifts the seed permutation and the cluster
still did not appear.
✅ **Zero `tests/lessons/*` failures** — the first electron compile of phase-67's
`lessonevalconditions` → `.live.ts` split, reported to them as a measurement.

**The 3 beyond the floor were all spec-side, not code-side**, and were fixed for run 4:

1. + 2. `FIX-001 rendering the runtime layer …` ×2 — 🔴 **my `not.toContain('[now =')` assertions
   were satisfied by my own explanatory header.** When runtime values are present the Nodes header
   explains the notation and contains the literal token, so both specs failed against **correct
   code**. Now matched as a whole bracketed form with the header's `…` placeholder filtered out.
3. `AIX-004 read-only guarantee exposes no method that could write to a project` — an **exact-list
   guardrail over prototype names**, doing precisely its job: it caught the new `readRuntime`.
   Admitted deliberately with a comment saying why it is a read. ⚠️ **`private` in TypeScript erases
   at build time** — a private method is still a prototype method at runtime and still trips a list
   like that one.

### ✅ `test:ci` — run 4, seed 39393, `test-results.json` mtime **13:29** (deleted 13:16)

```
totalCount   2812
failedCount  6         ← the floor, exactly, by name
```

**4 × `AIX-006 style vocabulary`, 2 × `AI model registry`. Nothing else.** Zero `BEN-001`, zero
`tests/lessons/*`, zero `FIX-001`, zero `AIX-004`. All three run-3 regressions are fixed and the
floor is untouched.

✅ **This is the reading to quote for the tree carrying FIX-001 §1a.** ⚠️ The **committed** floor is
still **2788 / 6** — the +24 is my uncommitted spec file, and the total drops back when it lands or
rises if it is committed.

🔴 **THE VERDICT IS `test-results.json` PLUS ITS MTIME. The exit code is worthless in both
directions here** — `test:ci` exits **1** on a clean floor run (npm exits non-zero if any spec
fails), and exits **0** when the run was killed before it graded anything. Both happened today.

---

## 3. 🔴 The gate-destroying defect — found, fixed, verified

**Two full runs were lost. Read this before running any gate in this checkout.**

### What happens

**Launching an editor kills a running `test:ci` in ~6 seconds, and npm exits 0.**
`scripts/start.ts:49` → `reapPreviousSession()` → `sweep()`. Rule 1 in
`scripts/devtools/dev-processes.js:359` is `proc.command.includes(ROOT) && DEV_TOOL.test(...)`, and
`DEV_TOOL` includes `electron[/\\]dist`. The suite's own process is
`…/OpenNoodl/node_modules/electron/dist/…/Electron test.js --ci` — it matches both halves.
`noodl-mcp.cjs` was explicitly excluded; `test.js --ci` was not. Hence the **"MCP servers spared +
suite reaped"** signature, which reads exactly like a `dev:stop` and is not one.

⚠️ **Age is no protection.** `sweep()` defaults `minAgeSeconds = 0` and `start.ts` passes no floor,
so a suite is reaped at any age.

🔴 **And teardown does it too — this is the half that cost the second run, and it was my fault.**
I advised peers to *"kill your own pids by pid, never `dev:stop`"*. That advice is **wrong** while a
suite is running: `scripts/devtools/dev-watchdog.js:44` calls `sweep({ protectAncestors: false })`
when the launcher dies. A peer killed exactly their own two pids, as asked, and my suite died with
them. **Both ends of a dev stack's life reap a concurrent suite.** By-pid protects the *MCP servers*,
not a gate.

### The fix — verified, uncommitted

One `continue` in `dev-processes.js`, beside the existing `noodl-mcp.cjs` skip:

```js
if (proc.command.includes('test.js --ci')) continue;
```

It closes **all three doors at once** — launch sweep, `dev:stop`, watchdog teardown — because all
three go through the single shared `findDevProcesses()`.

**Verified against a known-broken and a known-good input simultaneously** (a live suite and a live
dev stack happened to coexist, which will not recur):

| pid | what | rule 1 **before** | after |
|---|---|---|---|
| 7991 | live `test:ci` Electron | **SWEPT** | spared |
| 3573 | real dev stack | SWEPT | **still swept** |
| 7989 / 3613 | suite runner + shell | never seeds | spared |

So it is load-bearing, not decoration, and it does not over-reach. `withDescendants` cannot drag the
suite back in — its runner and shell contain no ROOT and were never seeds.

⚠️ **`scripts/` is not in `build.files`.** No gate covers this file and it never reaches a packaged
app. It is **uncommitted** and outside FIX-001 — Richard's call whether it rides along.

🔴 **It did not save the run it was written for, and the reason generalises.** The edit landed 12:58;
the suite still died at 13:00:20. The watchdog had `require`d `dev-processes.js` at **12:51:55**, when
its stack launched — **a running process does not see an edit to a module it already loaded.** So the
fix only protects stacks launched *after* it. Same shape as the stale-`dist` trap: the question is
not "is the file on disk correct" but "when did the reaper start".

### What this changes about the protocol

- ✅ **The checkout must be quiet of dev stacks for the WHOLE run**, not merely at launch. "I started
  before their run" is not safety, and bringing your stack down mid-run is just as fatal.
- 🔴 **An editor stack is not attributable from the process table.**
  `.claude/skills/run-editor/SKILL.md:23` prescribes `nohup npm run dev:debug -- --quiet &`, so the
  tree reparents to **PID 1** and no `/tmp/cc-socks/` entry matches. The one action that can destroy
  a peer's 15-minute run is the one action the process table cannot trace to anybody. **Announce
  PIDs on launch, not just intent** — you are the only one who can attribute your stack, and you
  lose that the moment your shell exits.
- ⚠️ **PIDs wrapped on 2026-08-15.** A 3-digit pid can be *newer* than a 5-digit one. Use `lstart`;
  never infer age or a shared parent from pid ordering.
- ✅ **Delete `test-results.json` before every run.** It converts both failure modes — stale file
  (webpack failed) and missing file (run reaped) — into something visible.

---

## 4. What this session settled — do not re-derive

Full record in [FIX-001](FIX-001-THE-EXPLAINER-CANNOT-SEE-THE-APP.md) §"What shipped".

### FIX-001 §1a — built and gated

New `explain/runtime.ts` (pure) + `utils/provenance/explainRuntime.ts` (the only part touching a
socket or a singleton), with `resolveRuntime` as an injection seam on `ExplainSession`, read **once
per turn**.

**Five decisions not to re-litigate:**

1. 🔴 **A missing snapshot renders no Runtime section at all** — byte-identical to pre-FIX-001. The
   MCP assembler and the measurement harness pass no `resolveRuntime` and are unaffected.
2. 🔴 **A failed read is not "no preview running".** Opposite instructions to the user;
   `RuntimeSnapshot.error` keeps them apart, and a spec forbids one rendering containing the other's
   words.
3. 🔴 **Criterion 2 is met by words, not by omission.** A context that simply stops after the node
   types is indistinguishable, to a model, from "every value was null" — it will answer as though it
   had seen them. **This is the criterion most easily "passed" by a build that did nothing.**
4. 🔴 **`[now = …]` sits beside the authored value, never over it**, and is omitted when they agree
   — including when the two were merely **cut at different lengths** (assembly allows 400 chars at
   node scope, the runtime layer 200). Equality alone would announce a change on every long script
   body that never changed.
5. **Snapshot per turn**, re-resolved on each follow-up, per the task's own recommendation.

**Not done:** the `backwardWalk` stretch (§1a.5) — the task marks it a stretch; the criterion's
non-stretch half is what shipped.

### FIX-001 §1b — discoverability, verified from source

🔴 **Do not build against this.** Both entry routes are already complete: `scopeForSelection`
(`ExplainPanel.tsx:59-63`) returns `subgraph` and pluralises; `NodeContextMenu.ts:280` pluralises and
captures every id; `panelHoldsCanvasSelection` (`EditorEventBindings.ts:120-122`) lists
`ExplainPanel_ID` so opening Explain does **not** deselect; `getSelectedNodes()` returns the whole
selection. ⚠️ **A reading, not a run** — criterion 4 asks for it driven on both routes. If it
reproduces, look at the label and affordance, not at assembly. The one open knob is subgraph
`neighbourDepth` 1 → 2 (`assemble.ts:70`), a judgement call.

---

## 5. What to do next and why

1. 🔴 **Drive FIX-001 §1a** — three criteria, and criterion 2 (preview stopped ⇒ honest refusal) is
   the one worth doing first, because it is the one a broken build passes. Needs an editor, so read
   §3 first and announce PIDs.

   ⚠️ **This is the first drive in the phase that needs a *running preview*, not just an editor** —
   criteria 1 and 3 read live port values over `getPortValues`. Two hazards on that surface, both
   reported 2026-08-15 by the session doing a custom-nodes demo, and **both are single observations,
   not characterised bugs** — reproduce before trusting:
   - 🔴 **`cdp reload --target=viewer` reloaded the EDITOR, not the preview.** It printed
     `reloaded`, the editor fell back to the Launcher, and the open project was lost. The skill
     documents that *asking* for a nonexistent viewer target errors rather than silently falling
     back; that guarantee may not hold for `reload`. **Drive a copy** of a project, not one you care
     about.
   - ⚠️ **The components-panel tree measures 0×0 during its expand animation** — tag a row
     immediately after clicking its folder and the click is refused or lands at 0,0. Re-measure a
     second later. Same family as the "cdp click races the layout" note, and a close cousin of the
     0×0 trap that produced two invalid drive runs in s13.

   ✅ **Write the consequence down before driving.** For criterion 2 the honest one is hard: "the
   answer says it cannot see the value" is *also* true of a build that renders no Runtime section at
   all. Require the answer to distinguish **"nothing is running"** from **"the value is null"** — an
   explanation that merely hedges is the failure this criterion exists to catch.
2. **FIX-014 criterion 1** — the oldest undriven item. Drive the Build-panel half; the MCP half is
   blocked on a repackage.
3. **FIX-001 §1c** (look inside component instances) — the largest remaining build.
4. **FIX-008 fix C** — Richard owes a measurement on C's copy first.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

---

## 6. Owed by Richard

- 🔴 **NEW — the `dev-processes.js` fix is uncommitted and outside this phase.** Two runs were
  destroyed by the defect today and it will keep costing sessions. Commit it, or say to drop it.
- 🔴 **NEW — `MEMORY.md` is 20.1 KB against a 17.1 KB target** and cannot be brought under by
  rewording; the remaining bulk is already one hook per entry. Getting under budget means **dropping
  live trap entries**, which is a call about your own knowledge base. ⚠️ Several sessions edit it
  concurrently, so a compaction pass must be targeted single-line edits — a whole-file rewrite will
  silently clobber a peer's entry.
- 🟡 **NEW — `run-editor/SKILL.md:23` teaches `nohup … &`**, which destroys launch provenance for
  every session that follows it (§3). Worth changing the recipe.
- 🟡 **s13's datum on `linkify`**: the scoping model *declines to emit links* (3 refusals). Narrows
  criterion 1's *"any URL the AI emits"* premise. Does not argue for reversing your ruling.
- 🟡 **FIX-019 14(a)** — is the surface called *the workbench* everywhere?
- **FIX-004** conversion block shape · **FIX-005** category name · **FIX-006** demote Script? ·
  **FIX-013** what a data-reading component shows · **FIX-016** signal-input semantics ·
  **FIX-008** leftovers (incl. a measurement) · **FIX-015** / **FIX-021** are their own sessions.

---

## 7. Standing constraints

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call; **pathspec-scope
every `git add`**. ⚠️ `dev-docs/tasks/phase-65-the-library/` is untracked and belongs to neither this
phase nor 67 — `MEMORY.md` links into it, so it is one `git clean` from gone. Leave it.

**Announce before *and* after any `test:ci`, `test:main` or editor launch** — and now **announce your
PIDs**, per §3. `test:main` is plain Node and safe beside a live suite (phase-67 ran one during mine).

✅ **The peer protocol worked well today under real pressure.** Five sessions independently declined
to kill an unattributable dev stack, three corrected each other's mechanisms with source citations,
and two withdrew claims they had propagated from memory rather than measurement. The one thing that
went wrong went wrong because I gave confident advice (`kill by pid`) that I had not verified.
