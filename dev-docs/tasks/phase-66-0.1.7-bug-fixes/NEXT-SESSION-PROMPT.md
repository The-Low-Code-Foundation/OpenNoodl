# Phase 66 — next session

**Written 2026-08-14, session 6 (two of the seven ruled tasks built AND driven).** The seven-ruling
backlog is now **2 down, 5 to go**. FIX-009 and FIX-012 are **closed** — built, gated and driven
against the real editor in one launch. Nothing in this session needed Richard, and nothing cost a
paid request. ⚠️ **A sibling session is live on this checkout** and opened **phase 67** while this
one ran. This file is rewritten at the end of **every** session — read §0 for how, and replace it
rather than appending.

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
| **FIX-007** | ✅ | ✅ **4/4** | prefix docs, write-time gate, urgent lane, paid drive — **CLOSED** |
| **FIX-009** | ✅ | ✅ **5/5** | one `selection-slot` key; Search keeps its own — **CLOSED (this session)** |
| **FIX-012** | ✅ | ✅ **3/3** | None clears + gives the frame back; Delete unchanged — **CLOSED (this session)** |
| **FIX-008** A, B, E | ✅ | ✅ | idempotent Connect, backfill on open, bound directory |
| **FIX-008** C, D | 📋 **not built** | — | C stops it recurring; D removes the class |
| FIX-002/003/011/014/019 | 📋 open | — | ✅ **ruled**, buildable by an agent alone |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

✅ **SIX tasks closed.** Nothing built is waiting on a drive, and nothing in the phase is waiting on
a paid request.

🔴 **FIX-002 is not the S it was filed as** — see §3.

---

## 2. Gate readings

| Gate | Reading (2026-08-14, session 6, on top of `933cf00a`) |
|---|---|
| `test:ci` | ✅ **2757 total / 6 failed** — all six inherited, by name |
| `test:main` (jest: `tests-main` + `tests-unit`) | ✅ **188 suites / 2880 tests, 0 failed** |
| `tsc -p packages/noodl-editor/tsconfig.json --noEmit` | ✅ **0 errors** |
| `tsc -p packages/noodl-editor/tsconfig.tests.json --noEmit` | ✅ **0 errors** |
| MCP suite | not run — **no MCP file touched this session** |
| catalog trio, `cloud-library:check` | unchanged — **no catalog, node or library file touched** |

The six `test:ci` failures, by name: `AIX-006 style vocabulary` ×4 · `AI model registry` ×2 — the
same six as sessions 2–5.

✅ **2748 → 2757 is exactly the 9 new specs** in `tests/sidepanel/widthGroups.spec.ts`. `test:main`
is unchanged at 2880, which is correct: this session added jasmine specs only.

🔴 **The backgrounded `test:ci` exit code said `0` while its log ended in `npm error code 1`.**
The results file is the only readout that told the truth. Read
`packages/noodl-editor/tests/test-results.json` **and check its mtime is younger than your run** —
this session found the previous session's 20:38 file still sitting there at launch, and would have
reported session 5's numbers as its own.

---

## 3. What this session settled — do not re-derive

### FIX-009 — the persisted map is the evidence, not the pixels

After the drags, the drive project stores **one** entry: `{"selection-slot": 300}`. The same
settings file still holds the pre-fix shape for older projects — `{"components":274,…}`,
`{"PropertyEditor":394}`, `{"project-docs":448,"PropertyEditor":384}` — which is both the reported
bug in the wild **and** a real upgrade population for the legacy-inheritance leg. That leg is not
hypothetical; without it those users' sidebars silently reset.

Checked rather than assumed: `useSetupSettings.migrateRetiredPanelIds` rewrites the same
`editor-sidebar-widths` map but only drops keys in `RETIRED_PANEL_IDS`, so the new group key passes
through untouched; and all three slot panels declare **no** `defaultWidth`, so the group default is
uniformly 328 with nothing to reconcile.

### FIX-012 — three gestures, provably different

The frame column is what separates them, and it is why they are three buttons and not one:

| | values | frame | chip |
|---|---|---|---|
| **None** | cleared | **→ 768 (default)** | → `None` |
| **Reset all** | cleared | **kept** (not an input) | → `None` |
| **Delete** | **kept** | kept | → empty state |

### 🔴 FIX-002 is bigger than filed — check before starting it

The ruling flips **`TextArea`**'s Enter semantics, and `TextArea` is a `noodl-core-ui` component.
Beyond the two AI composers, `onEnter` is passed by **~9 more call sites** — `PageTemplatePopup`,
`NodeLabel`, `SavedBlocksSection`, `BenchInputsRail`, `BlocklyDialogs`, `MyBlocksSaveDialog` (×2),
`AiChat`, `AiAuthoringPanel`. Most are `TextInput`, but each has to be *classified* before the flip,
and `NodeComment` documents in its own source why it deliberately binds no `onEnter` at all. Treat
it as **M**, with BLD-010's re-drive attached. It was not started this session for that reason.

### Two drive recipes, corrected

- 🔴 **`ed.selectNode()` takes the VIEW node** (`NodeGraphEditorNode`), not the model node. Passing
  what `model.forEachNode` yields throws `Cannot read properties of undefined (reading 'type')`.
  Walk `ed.roots` and `.children` instead. (`window.__nodeGraphEditor` is the handle; `ed.selection`
  still does not exist — it is `ed.selector._selected`.)
- 🔴 **The panel switch is not visible in the same `eval` that selects it.** React has not
  re-rendered, so the first read still says "Components" — this session nearly recorded a false
  negative. Measure in a second call.
- ✅ A **real divider drag** is drivable with plain synthetic events: `FrameDivider.startDragging`
  is a React `onMouseDown` and its move/up are `window` listeners, so mousedown → mousemove →
  mouseup drives it, and `onSizeChanged` (the call that persists) fires on mouseup. Aim at
  `rootRect.x + RAIL_WIDTH + wantedPanelWidth`; it reads `pageX - bounds.x`.

---

## 4. What to do next

1. **Build the five remaining ruled tasks.** FIX-011 and FIX-019 want the 30px chrome strip laid
   out **once, together** — do them as a pair, and FIX-011 is the one FIX-012 already defers to
   (`DEFAULT_BENCH_FRAME` is imported, not re-declared, so the height ruling flows through with no
   second edit). **FIX-003** is the big one (the global `user-select` inversion — enumerate the
   opt-*out* list before flipping `style.css:205`). **FIX-014** is independent. **FIX-002** — see §3
   before committing to it.
2. **FIX-008 fix C** (`--scope project`) if the report should stop recurring — `MCP_SCOPE` split,
   `McpSettingsSection.tsx:163`, `tests-unit/mcp-001`, plus a cleanup hint for stale user-scope
   entries. **Five `noodl-mcp.cjs` servers are still registered against `Puppy test 3` user-scope**
   and visible in every folder.
3. **Repackage the app** (or say so out loud) if FIX-008 fix E is to reach the running servers —
   they run `/Applications/NodeGX.app/.../noodl-mcp.cjs`, not `packages/noodl-mcp/dist/`.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.
**Do not rebuild** FIX-007 fix 3 or re-file its rider; both are struck with evidence.

---

## 5. Rulings still owed by Richard

- 🟡 **FIX-019 14(a)** — "the workbench" everywhere, or only in that menu item? (Small, still owed
  from session 5's sitting.)
- **FIX-004** conversion block shape, log level, Msg keys · **FIX-005** the category name (reverses
  VFN-012) · **FIX-006** demote Script from the AI-authorable set? · **FIX-013** what a data-reading
  component shows on the bench · **FIX-016** signal-input semantics.
- **FIX-008 leftovers:** cleanup of stale user-scope registrations, and whether two visible NodeGX
  servers in one session is better or worse for the model — that second one is a *measurement*, so
  take it before shipping C's copy.
- The two big ones (**FIX-015**'s eight style-token rulings, **FIX-021**'s six memory-doc rulings)
  are their own sessions and their output is a new phase, not code in this one.

---

## 6. Standing constraints — unchanged, do not relearn

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call; pathspec-scope
every `git add`. ⚠️ **A sibling session committed `37d3117b` (phase 67) mid-session** — check
`git log` before assuming the parent commit is where you left it, and read untracked files rather
than assuming they are yours. **`dev:stop` kills Richard's MCP servers** — kill the
`scripts/start.ts` pid instead (done this session; all five survived). Restore
`recently_opened_project.json` after any launcher drive (done — 28 in, 29 during, 28 out).
⚠️ **Do not restore `~/.claude.json` from a backup.** Full list in the [README](README.md)
§ "Standing constraints inherited".

**Drive fixtures:** `fix012-drive` is a scratch copy of `erg005-qa` (source verified untouched) and
is the one project on this machine whose `/Probe` component has **6 typed inputs**, which is what
makes the bench's inputs rail non-empty. Only two projects on disk have a `Component Inputs` node
with actual ports — that one and `vfn64-drive`'s `/Components/Product photo`. It also holds a real
component **instance** (`/Probe` placed in `/App`), which most fixtures lack.

⚠️ **Before any paid drive, verify the provider from `editorSettings.json`, not localStorage** —
`ai.provider`, `ai.hasKey.anthropic`, `ai.verified.anthropic`. It was live on 2026-08-14.
