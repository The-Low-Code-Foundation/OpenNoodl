# Phase 66 — next session

**Written 2026-08-15, session 17.** One task built and driven end to end.
**✅ FIX-001 IS CLOSED — §1c built, gated and driven, so all five criteria now pass against the
running app.** Twelve of the phase's twenty-one tasks are closed.

🔴 **Two findings outlive this task.** The first is a gate blind spot that cost a full cycle and is
not phase-specific: **`tsc --noEmit` reads zero files under `tests/`**, so a type-broken spec is
green there, green in a scratch jest runner with the wrong matchers, and reported by the one gate
that covers it as **exit 0 with no results file** — the same signature as a reaped run. §3.

The second is a rule this feature has now hit **three times**: **an absence a reader has to derive
gets derived wrongly.** §4.

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
| **FIX-001** | ✅ | ✅ **5/5** | 🎉 **CLOSED this session.** 1a s15, 1b s16, **1c s17**. 🟡 §1a.5 stretch open, and worth re-deciding not building |
| **FIX-002** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-003** | ✅ | ✅ 5/5 | **CLOSED** — `will-navigate` proven (s13) |
| **FIX-007** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-009** | ✅ | ✅ 5/5 | **CLOSED** |
| **FIX-010** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-011** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-012** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-018** | ✅ | ✅ 5/5 | **CLOSED** |
| **FIX-019** | ✅ | ✅ 4/4 | **CLOSED** — 🟡 14(a) vocabulary sweep still owed |
| **FIX-020** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-014** | ✅ | 🟡 half | Build panel driven s16. 🔴 **MCP half still undriven — blocked on the `noodl-mcp` `dist/` repackage.** Oldest partly-driven item, and the phase's only known shipped defect (`COLLISION_STEP`) sits under it |
| **FIX-008** A, B, E | ✅ | ✅ | C, D not built; C needs a measurement from Richard |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

**Twelve closed.** FIX-014 is now the only partly-driven task, and it is blocked on someone else.

---

## 2. Gate readings

**Tree at 18:04, 2026-08-15**, working tree (FIX-001 §1c uncommitted at time of writing).

| Gate | Reading | When |
|---|---|---|
| **`test:ci` (jasmine) — FINAL** | ✅ **at the floor — 6 failures BY NAME**, `totalCount` **2843**, seed 39393. `test-results.json` mtime **18:13:32** | 18:13 |
| editor `tsc --noEmit` | ✅ 0 errors — ⚠️ **but see §3: this does not cover `tests/`** | 18:00 |
| `eslint` (changed surfaces) | ✅ clean | 17:05 |
| `test:main` (jest) | ✅ **203 suites / 3138, 0 failed** — run by a peer, and it graded this tree's `assembleContext` via `tests-unit/leg-003` | 17:30 |
| `test:ci` (earlier run) | ✅ floor, `totalCount` 2840, mtime 17:42:22 — the tree **before** the §4 render fix | 17:42 |

🔴 **The six failures by name** (never by count): 4 × `AIX-006 style vocabulary`, 2 × `AI model
registry`. **Quote the names.** `totalCount` has legitimately been 2788, 2812, 2814, 2840 and 2843
today depending on whose uncommitted specs were in the tree — comparing counts across handovers
manufactures a regression out of nothing. Within this session the deltas are fully accounted for:
2814 → **2840** is the 26 `explain-nested` specs, → **2843** is the 3 added with the §4 render fix.

---

## 3. 🔴 The gate blind spot — three ways to be green on a broken spec

The first `test:ci` of this session **exited 0 and wrote no `test-results.json`**. That is the
documented broken-build signature, and it was a broken build: the webpack compile failed on **one
line** of the new spec.

```
TS2339: Property 'arrayContaining' does not exist on type '{ … jasmine … }'
```

Three instruments, all green or silent on it:

1. **`expect.arrayContaining` is a jest matcher; `tests/` runs under jasmine.** The plain-Node jest
   config used for fast feedback has it, so the spec compiled and passed **26/26** there.
2. 🔴 **`npx tsc --noEmit -p tsconfig.json` never reads `tests/` at all.** `include` is
   `["src/editor", "src/shared", "src/main", "@include-types"]`. Measured, not inferred:
   `tsc -p tsconfig.json --noEmit --listFiles | grep -c "noodl-editor/tests/"` → **0**.
3. **The one gate that does cover it reports failure as exit 0** — and that is *also* what a reaped
   run looks like, so the same signature has two very different causes.

✅ **Rules:** a spec under `tests/` is only proven by `test:ci`; never quote a `tsc` reading as
covering one; when using a scratch jest runner, **use only matchers both runners have**; and check
`test-results.json`'s **mtime** before reading anything else. Saved to memory as
`the-editor-typecheck-does-not-read-tests`.

---

## 4. 🔴 The rule that has now bitten this feature three times

**An absence a reader has to derive gets derived wrongly. Write the empty case as text.**

- §1a: a context that merely *stops* after the node types reads, to a model, as "every value was
  null". Fixed by saying "no preview is running" in words.
- §1a: `everything − answered` called three demonstrably-running nodes "not mounted". Fixed by
  `asked − answered`, and by making a reader that cannot say what it asked claim nothing.
- **§1c, this session:** a *complete* interior with no interface made the model write *"only a
  2-node, bounded read … I can't rule out the component having its own Inputs defined elsewhere."*
  Completeness was two numbers to compare; the empty interface was a line that simply did not
  render. Both are now sentences, and the re-drive's answer flipped to the definite, true claim.

Anyone touching Explain Mode's render should assume the next instance of this rule is already in
there somewhere.

---

## 5. What this session settled — do not re-derive

### FIX-001 §1c, decided and gated

- **One level in, selected instances only, own budget.** That answers all three of the task's open
  §1c questions. The interior gets 40 nodes / 3 components at node scope, 25 / 2 at subgraph, and
  the parent's own bounds are untouched. Re-open with a measurement, not a preference.
- **The interior is `context.nested`, never `context.nodes`.** Four rules take their meaning from
  "`context.nodes` is one component's slice": the runtime port set, the warning filter, the node
  budget, and what a citation may reach without switching components.
- **A component the graph cannot resolve is skipped silently** — assembly cannot tell "no such
  component" from "you handed me one component". Gated: a single-component graph produces
  **byte-identical** output to pre-1c.
- **The interface is computed from all the component's nodes, not the ones this read kept** — so
  "it has no Component Outputs" stays true when the bound cuts the read short.

### 🔴 The defect found by reading the diff, not by a gate

Clicking a citation into an interior **would have disposed the explanation the click came from**:
the panel drops a session when the active component changes, and an interior citation changes it.
The answer would have blanked at the moment the feature worked. Fixed with
`componentsInExplanation`, and **driven in both directions** — navigating into a covered interior
keeps the answer, navigating to an uncovered component still drops it.

### Driving notes

- ✅ **The Explain panel's rail button is `[data-test=explain-panel]`** — the rail has no accessible
  name and no `button` elements; this attribute is the only reliable handle.
- ⚠️ **`npm run cdp` only exists at the repo root.** Run from `packages/noodl-editor` it fails with
  *"Missing script: cdp"* — and inside an `until` loop that reads as "the editor never came up".
  Cost ten minutes. ⚠️ **The Bash cwd persists between calls.**
- ⚠️ **A reopened project restores the last-viewed component, not the root** — a wait loop keyed on
  `/App` never fired because the editor came back on `/Widgets/Product Card`.
- ⚠️ **A `cdp click`'s reported coordinates can disagree with a rect measured in the previous
  invocation** (`284,481` against a box at y 414–429) — the panel moved between two connections. The
  effect was correct; the coordinate claim would not have been. **Claim the effect, not the point.**
- ✅ **Four of the seven drive claims cost no AI turn at all** — `assembleContext` is pure, so the
  live editor's own modules can be asked what a session *would* be given, through the webpack module
  cache. Only the answer itself needs a provider.

---

## 6. What to do next and why

1. 🔴 **FIX-014's MCP half** — the only thing between FIX-014 and closure, and the phase's oldest
   partly-driven item. **Still blocked on the `noodl-mcp` `dist/` repackage.** ⚠️ Running servers
   load `/Applications/…`, so check the *path* and *start time*, not just that a server is up.
2. 🔴 **Rule on `COLLISION_STEP`** (s16's finding: 40px is shorter than a node is tall, so
   "separated" nodes still overlap). Three options recorded in [FIX-014](FIX-014-THE-AI-PILES-NODES-IN-ONE-COLUMN.md).
   It is the only known defect in shipped phase-66 code and it is cheap once decided.
3. **FIX-008 fix C** — Richard owes a measurement on C's copy first.
4. 🟡 **FIX-001 §1a.5 stretch** — re-decide rather than build. s15 showed the answers already reach
   the upstream cause via warnings.
5. **FIX-019 14(a)** — is the surface called *the workbench* everywhere?

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

---

## 7. Owed by Richard

- 🔴 **STILL OWED — `scripts/devtools/dev-processes.js` is uncommitted** (line 371 spares a running
  `test:ci` from the launch/teardown sweep). Verified present on disk this session;
  `git show HEAD:… | grep -c` returns **0**. Two peers asked me to commit it; **I did not** — it is
  outside this phase and a peer's request is not your authorisation. It is one `git checkout --` or
  `git add -A` from being lost, and the loss is silent. **Commit it with an explicit pathspec, or
  say to drop it.**
- ⚠️ **The fix it contains is still unproven in the wild.** Two sessions have now had clean
  launch/teardown cycles with it loaded, but **no suite was running during either**, so
  "nothing died" and "it spares a live suite" remain indistinguishable. Proving it means
  deliberately launching over a running suite — nobody has been willing to spend a real gate run on
  it, and I was not either.
- 🔴 **STILL OWED — the `noodl-mcp` `dist/` repackage.** It blocks the last piece of FIX-014.
- 🔴 **STILL OWED — `MEMORY.md` is over budget** and cannot be brought under by rewording. A peer
  moved the "Driving the app" section out to `memory/driving-the-app-pointers.md` this session
  (nothing deleted). Getting under budget means **dropping live trap entries**, which is a call
  about your own knowledge base. ⚠️ Several sessions edit it concurrently — targeted single-line
  edits only; a whole-file rewrite clobbers a peer's entry.
- 🟡 **STILL OWED — `run-editor/SKILL.md:23` teaches `nohup … &`**, which reparents the stack to
  PID 1 and destroys launch provenance. Ignored again in favour of `NOODL_REMOTE_DEBUG_PORT=9223`
  under a tracked shell. ⚠️ **The skill also does not mention that `npm run cdp` is root-only.**
- 🟡 **A ruling on `COLLISION_STEP`** — see §6.2.
- 🟡 **s13's datum on `linkify`**: the scoping model *declines to emit links* (3 refusals).
- **FIX-004** conversion block shape · **FIX-005** category name · **FIX-006** demote Script? ·
  **FIX-013** what a data-reading component shows · **FIX-016** signal-input semantics ·
  **FIX-008** leftovers (incl. a measurement) · **FIX-015** / **FIX-021** are their own sessions.

---

## 8. Standing constraints

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call (⚠️ **the Bash
cwd persists between calls** — use absolute paths); **pathspec-scope every `git add`**.
⚠️ `dev-docs/tasks/phase-65-the-library/` and `phase-69-the-node-you-write-yourself/` are untracked
and belong to neither this phase nor 67 — `MEMORY.md` links into them, so they are one `git clean`
from gone. Leave them.

**Announce before *and* after any `test:ci`, `test:main` or editor launch, and announce your PIDs.**
🔴 **Announce the TRANSITION too** — "drive then suite" is two windows, and a peer waiting only for
the drive to end will launch into the suite.

⚠️ **Before launching beside a peer, check the sweep by its actual rule, not by reputation:**
`findDevProcesses` needs **both** the repo path in argv **and** a `DEV_TOOL` match
(`webpack|lerna|electron/dist|nodegx-backend|start-electron-dev|scripts/start.ts|dev-debug.js|scripts/devtools/`),
plus anything in `node_modules/.cache/noodl-dev-pids.json`. Plain-Node jest matches none of it.

⚠️ **Driving the AI panels spends Richard's Anthropic key.** Two turns this session, and four of the
seven claims were checked without one.
