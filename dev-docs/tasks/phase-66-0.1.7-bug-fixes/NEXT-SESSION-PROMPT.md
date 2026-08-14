# Phase 66 — next session

**Written 2026-08-14, session 2 (the drive session).** The drive queue session 1 left is **cleared**:
FIX-020 and FIX-010 are closed, FIX-007 is driven as far as it can go without money or its two
unbuilt fixes. **No source changed this session** — the work was verification, one gitignored
artefact rebuild, and the records. This file is rewritten at the end of **every** session — read §0
for how, and replace it rather than appending.

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
| **FIX-007** docs half | ✅ | n/a | both catalogs, all 3 examples, `WIRE_FORMAT_LEGEND` |
| **FIX-007** gate half | ✅ | ✅ | rejected + accepted through the real MCP door |
| **FIX-007** crit 1 | ✅ | 🟡 half | MCP path driven; **internal-AI half is paid** |
| **FIX-007** crit 4 | 📋 **not built** | 🔴 | blocked on fix 4 — do not re-drive until it lands |
| **FIX-007** fixes 3 & 4 | 📋 open | — | `addConnection`/`getConnectionStatus`; `evaluateHealth()` |
| **FIX-018** | 📋 open | — | ✅ **ruled** (option C) — buildable now, no blocker |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

✅ **The drive debt is cleared.** Two tasks closed outright; the only thing FIX-007 still owes to a
*drive* is criterion 1's paid half. Criterion 4 is owed to a *build*, not a drive — see §3.

---

## 2. Gate readings

🔴 **No source file changed this session**, so session 1's full-suite readings stand unaltered.
Re-run this session on the same tree, all green:

| Gate | Reading (2026-08-14, session 2, on `343bd0c4`) |
|---|---|
| `catalog:check` | ✅ 175 node types, up to date |
| `catalog:merge:check` | ✅ 175/175 documented, 62 examples, up to date |
| `cloud-library:check` | ✅ 84 node types, up to date |
| MCP suite (`npx jest` in `packages/noodl-mcp`) | ✅ **41 suites / 458 tests** |
| `tests-unit/fix-007/function-ports.test.ts` | ✅ **17 / 17** |
| `test:ci` (session 1, unchanged tree) | ✅ **2726 total / 6 failed, seed 28337** |

**The six `test:ci` failures, read from `test-results.json` and confirmed by name this session** —
all inherited, zero new:
`AIX-006 style vocabulary` ×4 · `AI model registry` ×2.

⚠️ **`test-results.json` records failures ONLY.** Its keys are `overallStatus, totalCount,
failedCount, failures, seed` — there is no per-spec pass list, so you cannot confirm a *named* spec
passed from it. The honest reading is "2726 graded, these 6 named failures, mine is not among them".
Do not go looking for a passing spec by name in that file and conclude it never ran.

⚠️ `test:main`'s baseline is **188 / 2866**, not the 144 / 2107 in older handovers.

---

## 3. What this session settled — do not re-derive

### FIX-020 — the fix works, and the measurement that proves it

`.string-input-popup-button-ok` computes **`height: 31px; padding: 8px 20px`** with
`scrollHeight === clientHeight`. Pre-fix that same selector computed `height: 20px` under the same
padding — the 4px content box for a 13px/600 label. `.popup-layer-popup` carries
`style="height: auto"`, so `hasDynamicHeight: true` is live at all five call sites. Zero children
escape the padding box on any of the five. Both `data-theme` values, identical geometry — expected,
since the defect was `height`/`padding` and neither is themed.

The bug screenshot carried **two** defects and the second was never written down: the text input
also painted past the popup's right edge. It is fixed too (288px input, 320px popup, 16px padding).

### FIX-010 — the precondition was reproduced before the fix was exercised

A freshly opened picker cursors `Group` at index 0 of 152 — the exact head-of-list node whose
`cssClassName`/`styleCss` ports let it survive a "css" query while ranking far below the answers.
Then, read after **each** of the three keystrokes (not just at the end, because the diagnosis is
about landing stale): `scrollTop` stays `0` and the cursor re-anchors to index 0 every time.
Category-rail stickiness survives: cursor kept `Button` across an 18→14 re-rank.

### 🔴 FIX-007 — the drive found the fix was not reaching the door it was written for

`packages/noodl-mcp/bin/noodl-mcp.js` is one line: `require('../dist/noodl-mcp.cjs')`. That bundle
was dated **Aug 12 — two days before FIX-007 was built** — and `grep unprefixed-function-port dist/`
returned nothing. **The editor door had the gate; the MCP door was still serving the old code.**
`dist/` is gitignored and `build:sidecars` regenerates it, so the packaged product was never wrong —
but every locally running server was, and a drive against one would have reported the gate missing
and been believed. Rebuilt (151 ms) and verified in the bundle.

⚠️ **Richard's MCP servers are still running the pre-rebuild copy** — a process holds the bundle it
loaded. They need a restart before the gate protects them. Nothing else is affected.

**The gate itself works, driven through the real door** on a scratch copy: the unprefixed
`Component Inputs → Function` wire is **rejected with nothing written**, naming `in-items` and
`out-text`, and the rejection carries the exclusion (`run, done, success…` are not prefixed) that
holds it at zero false positives. The prefixed control writes cleanly, 0 errors.

**Criterion 4 cannot pass and this is not a drive failure.** `ProjectModel.scheduleEvaluateHealth`
(`projectmodel.ts:1374-1384`) still hard-codes `setTimeout(…, 2000)` and nothing forces
`evaluateHealth()` on `instanceports` receipt. Fix 4 is unbuilt. Re-driving now only re-measures the
2 s debounce.

### Driving traps this cost time to find

- **`cdp.js click` takes a CSS selector and the FIRST match.** The node graph is Canvas2D, so
  nothing on it is selectable that way; and clicking a tree row by class hits the header. Tag the
  intended element `id="cdp-target"` first, and **check the printed `clicked … at x,y` against the
  box you measured** — that mismatch is the only signal you hit the wrong thing.
- **To click a canvas node:** walk `ed.roots` (**views**, not `ed.model.roots`), `viewport.centerOn`
  the node, then click the canvas centre through a 1×1 `pointer-events:none` marker.
  `ed.selector.select([n])` sets `_selected` but does **not** open the property panel.
- **`tint-visual` is not the cursor.** A `/tint-v/` probe matches a category tint on most picker
  cards and returns a plausible wrong card; the cursor class is `is-cursored`.
- **Ten synthetic `ArrowDown`s in one tick move the cursor once** — batched state. Space them
  ~120 ms. It reads as "synthetic events don't work here", and it is not that.
- **A popup shell reporting `scrollHeight 160` vs `clientHeight 140` is not clipping** when it
  computes `overflow: visible`. Driving `scrollTop = 999` left it at `0`.

---

## 4. What to do next

1. **Restart Richard's MCP servers** (or tell him to), so the FIX-007 gate actually protects the MCP
   door. One line of §3 explains why; it costs nothing and the fix is inert without it.
2. **FIX-008** (Tier 1 ⭐, the other AI-trust breaker) or **FIX-018** (ruled, buildable, a visible
   win). FIX-008 has the larger payoff; FIX-018 has no ruling risk at all.
3. **FIX-007 fixes 3 and 4** if you want the task fully closed — fix 4 is the small one and it is
   what unblocks criterion 4. The ⚠️ rider (`add_connection` drops `label`/`labelT`/`route`) is
   still unfiled.
4. **Ask Richard for the paid drive** of FIX-007 criterion 1's internal-AI half — one prompt in the
   Build panel, wired Component Input → Function input. Do not spend it unasked.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

---

## 5. Rulings still owed by Richard

Unchanged. The batchable smalls (FIX-002's send key, FIX-003's opt-in, FIX-009's PortEditor,
FIX-011's persistence, FIX-012's None, FIX-014's x/y, FIX-019's chip) each have a recommendation
already written — **one sitting clears seven tasks' blockers.** Ask for that sitting early in a
session, not at the end.

The two big ones (FIX-015's eight style-token rulings, FIX-021's six memory-doc rulings) are their
own sessions and their output is a new phase, not code in this one.

---

## 6. Standing constraints — unchanged, do not relearn

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call; pathspec-scope
every `git add`. Check for a sibling session (`git log --since="3 hours ago"`, and read untracked
files rather than assuming they are yours). `dev:stop` kills Richard's MCP servers — kill the
`scripts/start.ts` pid instead (done this session; all five servers survived). Full list in the
[README](README.md) § "Standing constraints inherited".
