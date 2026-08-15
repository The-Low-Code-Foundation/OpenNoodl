# Phase 66 — next session

**Written 2026-08-15, session 15.** **FIX-001 §1a is now driven — criteria 1, 2 and 3 all pass
against the running app.** That closes the phase's largest built-but-undriven item and makes
**eleven** closed tasks.

🔴 **The drive found a real defect that every gate and both typechecks had passed: the explanation
told the user a button was "not mounted in the running app" while I was clicking it.** It is fixed,
verified two-sidedly and re-driven (§3). That is the section to read if you read only one, because
it is a shape that recurs and no gate in this repo can catch it.

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
| **FIX-001 §1a** | ✅ | ✅ **3/3 NEW** | **criteria 1, 2, 3 driven (s15)**; one defect found + fixed. Stretch §1a.5 still open |
| **FIX-001 §1b** | ✅ pre-existing | 🔴 0/1 | source-verified as discoverability; **criterion 4 still needs a drive** |
| **FIX-001 §1c** | 📋 open | — | untouched — now the largest remaining build |
| **FIX-014** | ✅ | 🔴 0/1 | not started; MCP half **blocked on a repackage** — **the oldest undriven item** |
| **FIX-008** A, B, E | ✅ | ✅ | C, D not built |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

**Eleven closed.** FIX-014 is now the oldest undriven item; FIX-001 §1c is the largest open build.

---

## 2. Gate readings

**Tree at 14:16, 2026-08-15**, carrying commits `eadd3ce7` (§1a) and `f8f215d0` (the fix).
🔴 Quote against a **tree**, not a commit — `test:ci` webpacks the working tree.

| Gate | Reading | When |
|---|---|---|
| `test:ci` (jasmine) | ✅ **2814 specs / 6 failures — the floor exactly by name**, seed 39393 | 14:29 |
| editor `tsc --noEmit` | ✅ **0 errors** | 14:12 |
| `tsconfig.tests.json` | ✅ **0 errors** | 14:13 |
| `test:main` (jest) | not re-run this session — s14's reading (203 suites / 3136, 0 failed) stands; nothing this session touched its surface | — |
| `lint:ci` | not run | — |

### `test:ci` — seed 39393, `test-results.json` deleted 14:16 before the run

```
totalCount   2814      (= s14's 2812 + the 2 new regression specs — the delta IS the proof they ran)
failedCount  6         ← the floor, exactly, by name
```

✅ **The floor held exactly:** 4 × `AIX-006 style vocabulary`, 2 × `AI model registry`. Nothing else.

```
AI model registry treats openai-compatible as sharing the OpenAI catalogue
AI model registry has exactly one default per provider that owns models
AIX-006 style vocabulary AIB-009 F11: a provider that stalls during the style pass …
AIX-006 style vocabulary a style suggestion never downgrades a valid authoring …
AIX-006 style vocabulary offers one advisory style pass on a valid-but-raw candidate …
AIX-006 style vocabulary with guidance off, a raw candidate is accepted immediately …
```

✅ **Zero `BEN-001`**, zero `FIX-001`, zero `AIX-004`, zero `tests/lessons/*`.
⚠️ Run made on a **quiet checkout** — my dev stack was stopped first (26 processes, "nothing left
running") and no editor was launched for the whole ~13 minutes.

🔴 **THE VERDICT IS `test-results.json` PLUS ITS MTIME, NOT THE EXIT CODE.** `test:ci` exits **1**
on a clean floor run (npm exits non-zero if any spec fails) and exits **0** when the run was killed
before grading anything. Both were seen on 2026-08-15.

⚠️ **The committed floor is 2788 / 6.** The delta above it is this phase's uncommitted-then-committed
spec files; the two new regression specs in §3 add to it.

---

## 3. 🔴 The defect the drive found — and why no gate could have

**Fixed in `f8f215d0`.** Full write-up in [FIX-001](FIX-001-THE-EXPLAINER-CANNOT-SEE-THE-APP.md)
§"The drive".

### What it was

The explanation told the user **"Not mounted in the running app right now, so they hold no values"**
about `btn`, `obj` and `filt` — while I was clicking `btn`, and while `obj.completed` and
`filt.completed` were each firing on every click.

`renderRuntime` derived absence as `context.nodes − liveNodeIds`. A node only enters `liveNodeIds`
if **one of its ports was in the request**, and `portsToResolve` asks only about the selected node
and ports on a wire, **excluding signals throughout**. Those three nodes reach `c1` only by signal,
so **zero** of their ports were ever requested — the entire request was **2 ports across a 5-node
context** — and they could never answer.

**The model relayed it faithfully** (*"the button isn't currently on screen"*) because `prompts.ts`
instructs it that a not-mounted node *"is often the entire answer to why is this empty"*. The false
claim was load-bearing, not cosmetic.

### The rule to carry forward

🔴 **`asked − answered = absent`. Never `everything − answered`.** A thing nobody asked about is
**unknown**, not absent. A reader that cannot say what it asked must make **no absence claim at all**.

⚠️ **The file already knew.** `runtime.ts` guards the identical failure shape one line at a time —
*"asking the runtime for a port in the wrong direction returns `exists: false`, which reads as 'the
node is not mounted' and is a lie"* — and still got the general case wrong. **A rule written about
one instance does not protect the others.**

### Why no gate caught it, and what that means for the next drive

🔴 **Every spec constructed its own `RuntimeSnapshot`, so every spec encoded the same wrong
assumption.** The specs were green, both typechecks were green, and the feature was confidently
lying. It was found only by driving the real feature and checking a claim I could **independently
falsify** — I knew the button was mounted because I had just clicked it seven times.

✅ **Write down, before driving, a claim you can independently falsify.** Not "does the answer look
right" — "is this specific sentence true, and how do I know?"

### The fix, and how it was verified

Snapshots carry `askedNodeIds`; absence is intersected with it; `undefined` makes no claim.
Verified on known-good and known-broken input **and required to disagree**:

| snapshot | expected | got |
|---|---|---|
| asked `[a]`, answered `[a]`, `b` never asked | no claim | ✅ silent |
| asked `[a,b]`, answered `[a]` | **still reports `b` absent** | ✅ reports |
| `askedNodeIds` undefined | no claim | ✅ silent |

Then re-driven end-to-end against the running app: the false line is gone, the real values (`4` on
the re-run) and both warnings remain. Two regression specs added.

---

## 4. What this session settled — do not re-derive

### FIX-001 §1a is driven, 3/3

The fixture and the reason it constitutes proof are in the task file. The short version:
**`/erg-rig` in the QA fixture is a runtime-value rig** — `t1`–`t4` have no authored `text` and the
`Counter`s no authored parameters, so pressing the button *N* times puts **N** somewhere that
**exists nowhere in the authored graph**. Runs used 7 and then 4.

🔴 **The single strongest datum: the same question on the same node answers *oppositely* with the
preview running vs. stopped** — *"the runtime shows currentCount = 7"* against *"nothing is running
right now, so I can't point to a specific current value"*. A runtime layer that were never consulted
could not produce both.

Criterion 2 passed the **strict** bar set before driving: it did not merely hedge, it named
**nothing-is-running** as the cause and explicitly separated that from "the value is null".

### Things that cost time and need not cost it again

- ⚠️ **In a `dev:debug` stack a viewer is attached from boot**, so `isPreviewRunning` is **already
  true**. To drive a genuine no-preview case, navigate the viewer to `about:blank`; navigate back to
  `http://localhost:8574/` to restart (counters reset). ✅ `eval --target=viewer` hits the viewer
  correctly — I did **not** reproduce s14's `cdp reload --target=viewer` hazard, and did not test it.
- 🔴 **A dev viewer showing `PRESS 0 0 0 0` is the QA fixture itself, not a stale example project.**
  I nearly discarded a valid run over this.
- ✅ **Opening a project over CDP: `loadProject` does NOT set `ProjectModel.instance`.** Reach
  `Router` by fiber (depth 1; match `typeof sn.route === 'function'` — **not** `_route`, which is
  unset until first use) and call `route({to:'editor', project})`. Recipe in memory.
- ⚠️ **`LocalProjectsModel.instance.projects` does not exist** — it is `projectEntries`.
- 🔴 **Three separate directories are all named "NodeGX QA Fixture."** Match on
  `retainedProjectDirectory`, never on the card label.

---

## 5. What to do next and why

1. 🔴 **FIX-014 criterion 1** — now the oldest undriven item. Drive the Build-panel half; the MCP
   half is blocked on a repackage.
2. **FIX-001 criterion 4** (§1b, both entry routes) — the mechanism is verified complete in source,
   so this is a **drive, not a build**. If it reproduces, look at the label and affordance, not at
   assembly. Cheap, and it would close FIX-001 apart from §1c.
3. **FIX-001 §1c** (look inside component instances) — the largest remaining build.
4. **FIX-008 fix C** — Richard owes a measurement on C's copy first.
5. 🟡 **FIX-001 §1a.5 stretch** (`backwardWalk` on "why is X null") — the drive showed the answers
   already reach the upstream cause **via warnings**, so the marginal value is lower than the task
   assumed. Worth re-deciding rather than building on reflex.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

---

## 6. Owed by Richard

- 🔴 **STILL OWED — the `dev-processes.js` fix is uncommitted** (it spares a running `test:ci` from
  the launch/teardown sweep). Two runs were destroyed by that defect on 2026-08-15. It is outside
  this phase, so I have left it uncommitted again this session. **Commit it, or say to drop it.**
- 🔴 **STILL OWED — `MEMORY.md` is over its 17.1 KB target** and cannot be brought under by
  rewording; getting under budget means **dropping live trap entries**, which is a call about your
  own knowledge base. ⚠️ Several sessions edit it concurrently — a compaction pass must be targeted
  single-line edits; a whole-file rewrite silently clobbers a peer's entry.
- 🟡 **STILL OWED — `run-editor/SKILL.md:23` teaches `nohup … &`**, which reparents the stack to
  PID 1 and destroys launch provenance. I ignored it this session and launched with
  `NOODL_REMOTE_DEBUG_PORT=9223` under a tracked shell instead, which made my stack attributable.
  Worth changing the recipe to that.
- 🟡 **s13's datum on `linkify`**: the scoping model *declines to emit links* (3 refusals).
- 🟡 **FIX-019 14(a)** — is the surface called *the workbench* everywhere?
- **FIX-004** conversion block shape · **FIX-005** category name · **FIX-006** demote Script? ·
  **FIX-013** what a data-reading component shows · **FIX-016** signal-input semantics ·
  **FIX-008** leftovers (incl. a measurement) · **FIX-015** / **FIX-021** are their own sessions.

---

## 7. Standing constraints

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call (⚠️ **the Bash
cwd persists between calls** — it bit me twice this session; use absolute paths); **pathspec-scope
every `git add`**. ⚠️ `dev-docs/tasks/phase-65-the-library/` is untracked and belongs to neither this
phase nor 67 — `MEMORY.md` links into it, so it is one `git clean` from gone. Leave it.

**Announce before *and* after any `test:ci`, `test:main` or editor launch, and announce your PIDs.**
✅ Launching with `NOODL_REMOTE_DEBUG_PORT=<not 9222>` under a tracked shell is what made this
session's stack attributable in the process table — worth making the habit.

⚠️ **A peer session was driving `noodl-preview` + headless Chrome from the scratchpad throughout
this session.** I confirmed from source before launching that `start.ts` calls `sweep()` **without**
`includeScratchpad`, which defaults **false**, so a dev-stack launch does not reap a sibling's drive.
Worth knowing rather than re-deriving under time pressure.

⚠️ **A stale `SingletonLock` in `Application Support/NodeGX` pointed at a dead pid** and read exactly
like a live editor. Check the pid is alive (`ps -p`) before concluding a peer has one open.
