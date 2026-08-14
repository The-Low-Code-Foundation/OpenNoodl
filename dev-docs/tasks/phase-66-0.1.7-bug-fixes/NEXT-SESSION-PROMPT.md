# Phase 66 — next session

**Written 2026-08-14, session 3 (build + drive).** **FIX-018 is CLOSED** — built, spec-proved with
10 new specs, and driven 5/5 across both themes. It is the first task this phase to go from ruling
to closed inside one session. This file is rewritten at the end of **every** session — read §0 for
how, and replace it rather than appending.

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, overwritten each session (the phase-57/60/61 convention).
It carries exactly four things and nothing else:

1. **Built vs. driven**, per task, as a table — the phase-64 discipline. *Built* is code plus gates;
   *driven* is the app doing it. Never let the two blur into "done".
2. **Gate readings with their date and commit**, so the next session compares NAMES against a
   reading it can trust rather than re-deriving one.
3. **What this session settled**, so nobody re-litigates or re-measures it.
4. **What to do next and why**, ordered, with the rulings still owed by Richard called out
   separately from the work an agent can do alone.

Learnings that outlive the phase go to memory, not here. This file is the phase's working state;
memory is the repo's. Both get written at the end of a session — the memory index line is what makes
a learning findable six phases later.

---

## 1. Built vs. driven

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-020** | ✅ | ✅ **3/3** | five popups, both themes — **CLOSED** |
| **FIX-010** | ✅ | ✅ **3/3** | picker anchors + stickiness survives — **CLOSED** |
| **FIX-018** | ✅ | ✅ **5/5** | chip + stacked edge + freed icon slot + menu — **CLOSED** |
| **FIX-007** docs half | ✅ | n/a | both catalogs, all 3 examples, `WIRE_FORMAT_LEGEND` |
| **FIX-007** gate half | ✅ | ✅ | rejected + accepted through the real MCP door |
| **FIX-007** crit 1 | ✅ | 🟡 half | MCP path driven; **internal-AI half is paid** |
| **FIX-007** crit 4 | 📋 **not built** | 🔴 | blocked on fix 4 — do not re-drive until it lands |
| **FIX-007** fixes 3 & 4 | 📋 open | — | `addConnection`/`getConnectionStatus`; `evaluateHealth()` |
| **FIX-008** | 📋 open | — | Tier 1 ⭐; **fix B carries a posture question for Richard** — see §5 |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

✅ **Three tasks closed. The drive debt is still clear** — nothing built is waiting on a drive except
FIX-007 criterion 1's paid half.

---

## 2. Gate readings

| Gate | Reading (2026-08-14, session 3, on `95301039`) |
|---|---|
| `test:ci` | ✅ **2736 total / 6 failed, seed 04897** |
| `tsc -p packages/noodl-editor/tsconfig.tests.json --noEmit` | ✅ clean on all touched files |
| catalog trio, `cloud-library:check`, MCP suite | unchanged — **no catalog, node or MCP file touched** this session |

**The six `test:ci` failures, read from `tests/test-results.json` and confirmed by name** — all
inherited, zero new:
`AIX-006 style vocabulary` ×4 · `AI model registry` ×2.

✅ **The count is the second proof.** 2726 → **2736** is exactly the 10 specs added in
`NodeComponentMark.test.ts`. On a suite whose results file lists *failures only*, a matching total
delta is the one available evidence that a new spec file actually executed — and this repo's barrel
trap is precisely the failure it catches.

🔴 **`test:ci` exited `0` while `overallStatus` was `failed`.** The backgrounded exit code lied in
the direction that matters least this time (there were only inherited failures), but it lied. Read
the file, never the exit code.

⚠️ The results file is at **`packages/noodl-editor/tests/test-results.json`**, not
`packages/noodl-editor/test-results.json`.

⚠️ `test:main`'s baseline is **188 / 2866**.

---

## 3. What this session settled — do not re-derive

### FIX-018 — three marks, and the one that carries the affordance

The chip override, the 3px stacked-card edge, the freed icon slot, and the context-menu item all
landed in `95301039`. The full measurement table is in
[FIX-018](FIX-018-A-COMPONENT-SAYS-IT-CAN-BE-ENTERED.md) § "What the drive measured"; the two facts
worth carrying here:

- **`Component Inputs` paints the *identical* purple chip as a component instance** (`40,39,59`
  both). That is the ruling working as written — purple means "component-related" — and it makes
  **the stacked edge the only thing that distinguishes an instance from the plumbing.** Anyone
  tempted to soften the edge should know it is load-bearing, not decorative.
- **The edge does not stay clear of the unhealthy ring**, which the task doc had required. The −1px
  dashed ring runs through the band (`dx=1` reads `114,59,58`). Both stay legible because the ring
  is dashed and the band's outer stroke is clear of it. Not worth redesigning — but the constraint
  as written is false.

**A consequence, not a bug:** freeing the icon slot drops the 12px `iconOffset` from healthy
component instances, so their titles get 12px more width. That is a layout change in every project.

### 🔴 No existing project could drive this

The QA fixture has 24 components and **zero placed component instances**; one graph in ~40 test
projects had a single one. `NodeGX test projects/fix018-drive` was built for the drive and is worth
keeping — it is the only graph on this disk with a component wrapping a Group, a logic-only
instance, a plumbing node and a *genuinely* unhealthy instance side by side.

### Driving traps (the expensive ones)

- 🔴 **Tagging a React-managed element with an id and clicking it in a second `cdp` call opened the
  wrong project.** React recycled the DOM node between the two calls. Append a `position:fixed`
  marker to `document.body` instead. The `clicked … at x,y` line versus the box you measured is the
  only tell — check it every time.
- ⚠️ **A `data-theme` flip does not apply inside the same `eval`** (`CanvasTheme` refreshes off a
  MutationObserver). A whole state-stack sweep silently re-measured light theme as "dark".
- ⚠️ Sampling a card's right edge at `y + h/2` hits the connection-drag circle when the node is
  highlighted, and reads as the mark being erased by hover.

---

## 4. What to do next

1. **FIX-008** (Tier 1 ⭐, the other AI-trust breaker). Fixes **A** (idempotent, honest Connect) and
   **E** (`get_project_info` returns the bound directory) need no ruling and can land immediately.
   **Fix B — backfilling `.mcp.json`/`CLAUDE.md` into a project the user merely *opened*** — reverses
   a deliberate BST-005 decision and is a posture question; ask before building it, and note the
   task's own open question about *which* open seam all routes cross.
2. **FIX-007 fixes 3 and 4** if you want that task fully closed — fix 4 is the small one and it is
   what unblocks criterion 4. The ⚠️ rider (`add_connection` drops `label`/`labelT`/`route`) is
   still unfiled.
3. **Restart Richard's MCP servers** if they have not been restarted since session 2 — they were
   still running the pre-rebuild sidecar bundle then, so the FIX-007 gate is inert for them. (Five
   `noodl-mcp.cjs` processes were alive this session and left untouched.)
4. **Ask Richard for the paid drive** of FIX-007 criterion 1's internal-AI half. Do not spend it
   unasked.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

---

## 5. Rulings still owed by Richard

The batchable smalls (FIX-002's send key, FIX-003's opt-in, FIX-009's PortEditor, FIX-011's
persistence, FIX-012's None, FIX-014's x/y, FIX-019's chip) each have a recommendation already
written — **one sitting clears seven tasks' blockers.** Ask for that sitting early in a session, not
at the end.

**New this session:** FIX-008's fix B needs a posture ruling — *is writing `.mcp.json` + `CLAUDE.md`
into a folder the user merely opened acceptable?* BST-005 chose create-only on purpose. A+E can ship
without it.

The two big ones (FIX-015's eight style-token rulings, FIX-021's six memory-doc rulings) are their
own sessions and their output is a new phase, not code in this one.

---

## 6. Standing constraints — unchanged, do not relearn

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call; pathspec-scope
every `git add`. Check for a sibling session (`git log --since="3 hours ago"`, and read untracked
files rather than assuming they are yours). **`dev:stop` kills Richard's MCP servers** — kill the
`scripts/start.ts` pid instead (done this session; all five survived). Restore
`recently_opened_project.json` from a backup after any launcher drive (done). Full list in the
[README](README.md) § "Standing constraints inherited".
