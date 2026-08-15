# Phase 66 — next session

**Written 2026-08-15, session 18.** **✅ FIX-014 IS CLOSED** — its MCP half was driven, the defect
the previous drive found was ruled and fixed, and the task's row was reconciled. **FIX-019 14(a) is
closed by ruling.** Thirteen of the phase's twenty-one tasks are closed, and **nothing in this phase
is blocked on a peer any more.**

🔴 **The finding that outlives this task, and it is not phase-specific: FIX-014's MCP half was never
blocked.** It was recorded as "blocked on the `noodl-mcp` `dist/` repackage" in a task doc, a
handover and three sessions' memory. It took about twenty minutes, and nothing had changed to
unblock it. §3 — read it before you believe the word *blocked* anywhere in this file.

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
| **FIX-014** | ✅ | ✅ **both clients** | 🎉 **CLOSED this session** (`a662cd44`). Build panel s16, **MCP s18**. 🔴 driven ≠ shipped — see §4 |
| **FIX-019** | ✅ | ✅ 4/4 | 🎉 **CLOSED this session** — 14(a) ruled *no sweep*, nothing left to build |
| **FIX-001** | ✅ | ✅ 5/5 | **CLOSED** s17. 🟡 §1a.5 stretch open, and worth re-deciding not building |
| **FIX-002** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-003** | ✅ | ✅ 5/5 | **CLOSED** — `will-navigate` proven (s13) |
| **FIX-007** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-009** | ✅ | ✅ 5/5 | **CLOSED** |
| **FIX-010** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-011** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-012** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-018** | ✅ | ✅ 5/5 | **CLOSED** |
| **FIX-020** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-008** A, B, E | ✅ | ✅ | C, D not built; **C needs a measurement from Richard** |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

**Thirteen closed.** There is no longer a partly-driven task.

---

## 2. Gate readings

**Tree: `a662cd44`** (`test:ci` was run one commit earlier, at `d061bc6e` plus this task's then-dirty
`layout.ts` — see the caveats).

| Gate | Reading | When |
|---|---|---|
| **`test:ci` (jasmine)** | ✅ **at the floor — 6 by NAME**: 4 × `AIX-006 style vocabulary`, 2 × `AI model registry`. `totalCount` **2843**, **`seed` 39393**, `test-results.json` mtime **19:51** over a file deleted at **19:41** | 19:51 |
| editor `tsc --noEmit` | ✅ 0 errors | 19:54 |
| editor plain-node jest (full) | ✅ **203 suites / 3138**, 0 failed | 19:36 |
| `noodl-mcp` jest (full) | ✅ **44 suites / 506**, 0 failed | 19:37 |
| `fix-014` editor specs | ✅ **19/19** (17 + 2 new) | 19:53 |
| `noodl-mcp` `authoredLayout` | ✅ 6/6 | 19:53 |

✅ **`NOODL_SPEC_SEED=39393` works AND is echoed back in `test-results.json`.** Memory recorded the
same-seed before/after control as unavailable; it is available. Use it — pinned, the gate is stable
at 6; unpinned it wanders (the `BEN-001` clusters).

🔴 **Quote the six by NAME, never the count.** `totalCount` went **2779 → 2788 → 2812 → 2843 in one
day** as sessions landed specs. A mismatch against a recorded total is almost always **age, not a
regression**. The count is only meaningful as *your own* before/after delta on *your own* tree.

⚠️ **Two limits on that `test:ci` reading, recorded rather than glossed:**

1. It webpacks the **working tree**, not `HEAD` — so it graded `d061bc6e` plus **two** dirty source
   files, one of them `scripts/library/check.ts`, which is **not mine and has no owner**. It was
   *screened*, not waved off: nothing under `tests/` or `src/` imports it, so it cannot have
   influenced the result. See §7.
2. The `COLLISION_STEP_FLOOR` refactor landed **after** the run. The computed value is identical, so
   behaviour is unchanged — but the jasmine gate has not seen that exact source text, and saying it
   had would be the "gate covered it" claim this phase keeps catching.

---

## 3. 🔴 The finding: "blocked" is a conclusion, and conclusions decay

FIX-014's MCP half was recorded as blocked on a `dist/` repackage. **Two artefacts were being
conflated under one name:**

| Artefact | Built | `grep -c COLLISION_STEP` |
|---|---|---|
| `packages/noodl-mcp/dist/noodl-mcp.cjs` | today 09:56 | **2** |
| `/Applications/NodeGX.app/.../noodl-mcp.cjs` | **Aug 13** | **0** |

The **observation** was correct and stayed correct — every registered MCP server executes the
packaged copy, so a drive routed through a session's own MCP tools measures a build without the
feature. The **conclusion** silently widened it. Nothing stopped spawning the repo build directly:

```
node packages/noodl-mcp/dist/noodl-mcp.cjs <project-dir> --allow-writes
```

— newline-delimited JSON-RPC: `initialize` → `notifications/initialized` → `tools/list` →
`tools/call`. ✅ Plain `node` is also the **peer-safe** spawn: it matches no `findDevProcesses`
`DEV_TOOL` pattern, whereas an Electron-launched server matches `electron/dist` and is sweepable.

**Why it survived three sessions:** a measurement carries its own scope inside it ("*these* servers
load *that* path"); a conclusion has already discarded the scope, so a reader cannot re-narrow it and
each relay hardens it. **Ask "blocked from what, exactly?" and expect the answer to name a route,
not a capability.** Saved to memory as `a-relayed-conclusion-decays-faster-than-a-relayed-measurement`.

⚠️ Corollary for this repo: **"the shipped product lacks it" and "the criterion cannot be measured"
are different claims.** Only the first was ever true.

---

## 4. What this session settled — do not re-derive

### FIX-014's MCP half, driven

Claims were written down before the server was started. All four hold, asserted **on disk** by node id:

- **Gap fill** (the branch session 16 never exercised): submitted with **no `x`/`y` anywhere** →
  `40,40` / `100,160` / `350,160`. Every number a pass constant, and **no model in the loop that
  could have chosen them** — stronger than s16's run 1, where the coordinates matched the *prompt's*
  wording rather than the pass's.
- **Verbatim control**, **collision** (two consecutive steps, in submission order), **logic column**
  at `maxVisualX + 250`, anchored to the `y` of the node it feeds.
- ✅ **A trap-guard fired, which is why the readings are trusted.** The first attempt was *rejected*
  (`Counter` has no output `count`) and the file **did not exist afterwards** — the "silent write
  failure, stale read" trap was real and the guard caught it.
- 📎 Schema detail worth keeping: `create_component` connections are **`fromProperty`/`toProperty`**,
  not `fromPort`/`toPort`.

### `COLLISION_STEP` — ruled and fixed

Richard ruled **raise the constant** (over passing node heights in, or leaving it). Now
`Math.max(ROW_SPACING, COLLISION_STEP_FLOOR)` = 120. Re-driven: three colliders at **400 / 520 / 640**.

🔴 **The floor is load-bearing, and this is the reusable bit.** `ROW_SPACING` is layout *rhythm*;
`COLLISION_STEP` is *clearance*. Equal today only by coincidence of value. Tightening rows for
density would have silently re-opened the defect **with every spec still green**, because all of them
assert `y + COLLISION_STEP` symbolically. Two specs now name the relationship.

**The wording was half the defect.** The module said colliders are "stepped clear" / "step down until
clear" — *clear* is exactly what they were not. It now states the real promise: the pass breaks an
exact coordinate tie, it does **not** guarantee non-overlap, and it is never given node sizes. A
190px node still overlaps at 120 and the module says so.

### 🔴 Driven ≠ shipped

The packaged app has **zero** occurrences of the pass. **No registered MCP server on this machine can
exercise it at all.** The fix exists, is driven, and reaches no user until a repackage. That is real
**deployment debt** — just not an obstacle to acceptance. Keep the two sentences separate.

### FIX-019 14(a) — ruled, no build

Measured first: the whole user-visible surface is **two strings**, not the sweep the task assumed
(everything else is comments, a CSS `isolation: 'isolate'`, and a colour note). Richard ruled
**"workbench" stays scoped to the menu item**; the caption keeps describing the mechanism. Accepted
cost, recorded in the task doc: the surface never calls itself the workbench once you arrive.

### The register had three states for one task

`TASKS.md` said **NOT DRIVEN**, commit `e824f30a` said **half-driven**, and the work was done.
Reconciled to say **which half** was owed — that is what makes a row re-derivable rather than merely
current.

---

## 5. What to do next and why

1. **FIX-008 fix C** — Richard owes a measurement on C's copy first. Now the oldest open item.
2. 🟡 **FIX-001 §1a.5 stretch** — re-decide rather than build; s15 showed the answers already reach
   the upstream cause via warnings.
3. **FIX-013**, **FIX-016**, **FIX-017** — open, each needs its ruling (see §6).
4. 🟡 **The residual on FIX-014, if anyone wants it:** the pass is size-blind, so 120 clears the
   common case and not a 190px node. Giving the pass node heights is a **future ruling**, not a bug
   in this one — the MCP door has no canvas, so it would need a per-type height table in the catalog.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

---

## 6. Owed by Richard

- 🔴 **`scripts/library/check.ts` is uncommitted and has NO OWNER.** Six sessions were asked tonight;
  none claimed it. It is the script behind **`library:check`**, and `cloud-library:check` **is a PR
  gate** — so every future library-gate reading silently reflects an edit no `git log` explains, and
  it is one `git add -A` from riding along or one `git checkout --` from vanishing. **Attribute it or
  bin it.** (I did not touch it: it is outside this phase and unattributed.)
- 🔴 **The `noodl-mcp` repackage — now correctly filed as DEPLOYMENT debt, not a blocker.** The
  packaged app has 0 occurrences of the layout pass, so FIX-014 reaches no real user until it is
  rebuilt and the servers restarted. Nothing in the phase waits on it.
- 🔴 **`MEMORY.md` is over budget** and cannot be brought under by rewording. Getting under means
  **dropping live trap entries** — a call about your own knowledge base. ⚠️ Several sessions edit it
  concurrently; targeted single-line edits only.
- ⚠️ **`d061bc6e` (the sweep fix) is committed but STILL UNPROVEN in the wild.** No session has yet
  launched over a genuinely running suite with it loaded, so "nothing died" and "it spares a live
  suite" remain indistinguishable. Proving it costs a real ~15-minute gate run.
- 🟡 **`run-editor/SKILL.md:23` teaches `nohup … &`**, which reparents the stack to PID 1 and destroys
  launch provenance. ⚠️ It also does not mention that `npm run cdp` is **root-only**.
- 🟡 **s13's datum on `linkify`**: the scoping model *declines to emit links* (3 refusals).
- **FIX-004** conversion block shape · **FIX-005** category name · **FIX-006** demote Script? ·
  **FIX-013** what a data-reading component shows · **FIX-016** signal-input semantics ·
  **FIX-008** leftovers (incl. a measurement) · **FIX-015** / **FIX-021** are their own sessions.

---

## 7. Standing constraints

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call (⚠️ **the Bash cwd
persists between calls** — use absolute paths; it cost two failed commands this session);
**pathspec-scope every `git add`/`git commit`**.

⚠️ `dev-docs/tasks/phase-65-the-library/` and `phase-69-the-node-you-write-yourself/` are untracked
and belong to neither this phase nor 67 — `MEMORY.md` links into them, so they are one `git clean`
from gone. **Leave them.**

**Announce before *and* after any `test:ci`, `test:main` or editor launch, and announce your PIDs.**
✅ `ListAgents` + `SendMessage` reaches the peers by name — six answered within a minute tonight, and
their independent `ps` checks were worth more than my own pre-flight. 🔴 **Announce the TRANSITION
too** — "drive then suite" is two windows.

⚠️ **Two hazards, two different windows** — they get conflated: a **launch or teardown** is
destructive for the **whole** run; the **~40s webpack** window bounds **source edits** only.

⚠️ **Driving the AI panels spends Richard's Anthropic key.** This session spent **zero** — the MCP
drive needs no model at all, which is also why its gap-fill evidence is stronger than a prompted run.
