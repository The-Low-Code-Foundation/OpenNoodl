# Phase 66 — next session

**Written 2026-08-15, session 9 (FIX-002, FIX-003 and FIX-014 all BUILT and merged; nothing
driven).** The seven-ruling backlog is now **empty of buildable work** — every ruled task has code.
What the phase owes from here is almost entirely **drives**, plus Richard's remaining rulings.

⚠️ **Three tasks landed today and NONE of them has been driven.** Do not read the merge commits as
closures. §1 is the honest table.

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, overwritten each session. It carries exactly four things:

1. **Built vs. driven**, per task, as a table — *built* is code plus gates; *driven* is the app
   doing it. Never let the two blur into "done".
2. **Gate readings with their date and commit**, so the next session compares NAMES against a
   reading it can trust rather than re-deriving one.
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
| **FIX-002** | ✅ **today** | 🔴 **0/4** | + **BLD-010 must be RE-DRIVEN** — see §3 |
| **FIX-003** | ✅ **today** | 🔴 **0/5** | + the **drag-surface drives the ruling put in scope** |
| **FIX-014** | ✅ **today** | 🔴 **0/1** | criterion 1 is "driven, both clients" |
| **FIX-008** A, B, E | ✅ | ✅ | C, D not built |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

**Eight closed, three built-not-driven, ten open.** 🔴 **The built-not-driven column is the whole
story of this session** — it is the largest it has ever been in this phase, and driving is now the
critical path rather than building.

---

## 2. Gate readings

Taken on the merged tree at **`1716236a`** (or its parent where noted), 2026-08-15:

| Gate | Reading |
|---|---|
| `test:main` (jest, editor) | ✅ **196 suites / 3022 tests, 0 failed** — was 190/2932 at the phase-66 start of day |
| `noodl-mcp` jest | ✅ **43 suites / 494 tests, 0 failed** (includes the instructions token-budget gate) |
| `noodl-core-ui` jest | ✅ **23 suites / 369 tests, 0 failed** |
| editor `tsc --noEmit` | ✅ 0 errors |
| `noodl-core-ui` `tsc --noEmit` | 44 errors — **known-red project**, all TS2307 path-alias failures in *editor* files; three independent readings agreed on 44 today |
| `noodl-mcp` `tsc --noEmit` | 7 errors — **pre-existing**, verified by running the identical check on a clean tree; FIX-014 adds none |
| `test:ci` (jasmine) | ✅ **2779 specs / 6 failures, seed 39393** at **`1716236a`** — the floor exactly, by name (4 × `AIX-006 style vocabulary`, 2 × `AI model registry`) |

### ✅ The `test:ci` that was in flight has LANDED and is discharged

Resolved before this file was finished, so §1 stands on a measured gate rather than an assumption.
The run covered **`1716236a`** — every task in this phase plus the concurrent phase-67 session's six
commits, since `test:ci` webpacks from the working tree.

Freshness evidence, because a green number is exactly when nobody checks it (§3): the results file
was **deleted before the run** and **exists again**, written at 09:42, with a **new seed (39393**,
against 75857 and 81235 on the two earlier runs). The log's own
`Jasmine: 2779 specs, 6 failures` agrees with the JSON. Both failing spec names resolve to real
files in the tree (`tests/ai/authoring-style.test.ts`, `tests/ai/models.test.ts`), so it is not a
stale bundle either.

⚠️ FIX-014 changes `candidate.ts`, which those authoring specs *do* exercise — so this run was not a
formality, and the floor holding is a real result about FIX-014 rather than an untouched baseline.

✅ **Provenance was challenged and checked: the bundle contains `1716236a` and nothing else.** A
*third* session began writing into `packages/` (UNI-007's next slice) while the suite was running,
which is the 08-14 contamination shape exactly. It did not reach this bundle:

- `1716236a` committed **09:32:27**; the log says `webpack … compiled successfully in 37734 ms`, so
  **the bundle was frozen at ~09:33:05**. `test:ci` is `webpack && run-electron-tests` — nothing
  written after that point can enter it.
- The third session's **earliest** write was **09:37:50**, and `ProjectsPage.tsx` was modified at
  **09:43:22, after the suite had already finished**. All twelve of its files postdate the bundle.

🔴 **The generalisable lesson, which is better than "keep the tree quiet for the whole run": the
contamination window is only the ~40 seconds of webpack after launch.** A tree has to be quiet for
that, not for the fifteen minutes everyone assumes — which is a far easier thing to arrange, and
also means a run that *looks* safely isolated can still be poisoned if a sibling saves during those
40 seconds.

⚠️ **And a misattribution to learn from: this session read that uncommitted work as the phase-67
session's leftovers and told them so — wrongly.** We all commit as Richard, so `git log` authorship
proves nothing. `ListAgents` (eight sessions live at the end of this one, two started within 15
minutes) plus **file mtimes** is what separates authors. "The sibling is never singular" is a
recorded trap and it caught this session anyway.

⚠️ **`totalCount` will NOT move for any of today's work** and that is correct, not a miss — every
spec added today is under `tests-unit/` (graded by `test:main`), and the electron suite never sees
those. Use `test:main`'s own total for that check.

---

## 3. What this session settled — do not re-derive

### 🔴 The most convincing false pass this repo has produced

The first `test:ci` on the FIX-002/003 merge **exited 0** and `test-results.json` reported
`totalCount: 2779`, six failures, **the exact floor by name**, `seed 81235`. Every content check
agreed it was a clean baseline run. **The mtime had not moved** — it was the previous night's file.

The webpack step had failed. `test:ci` is `webpack && run-electron-tests`, so the suite never
started. **Names, count and seed are all checks on *content*, and the content was a real previous
measurement — of the floor specifically, which is the likeliest thing to be sitting there. Only
freshness dissents.**

✅ **The fix is procedural: `rm packages/noodl-editor/tests/test-results.json` before every run.**
Deleting removes the failure mode; stat'ing asks you to remember a check precisely when a green
number has stopped you looking. This session's third run did exactly that.

### 🔴 A `.jsx` file is invisible to every gate but `test:ci`, and that gate fails silently

The break was a `{/* … */}` placed between `return (` and the root element, which parses as an
**object literal**. It passed `test:main` (195/3005 green — no `tests-unit/` spec imports
`curveeditor.jsx`, so jest never compiled it) and passed the typecheck (it is `.jsx`; `tsc` does
not read it). Fixed in `fb936f6d`.

✅ Scanned all of `packages/` for both spellings (`return (` and `=> (`) afterwards: **zero other
instances**. It is a new-edit hazard, not a latent one — a pre-existing instance in a compiled path
could not survive. **Cheap check for next time:** parse the file with `@babel/parser` directly;
it answers in under a second and needs no webpack.

### 🔴 An HTML sink plus model-authored content — one real bug found, one surface cleared

FIX-003's step 4 asked whether any `ConfirmModal` caller feeds model-authored content to its
`dangerouslySetInnerHTML`. **Two do.** `TextStylePicker` and `colorstylepicker` interpolate a
**style name** raw, and style names are user-chosen or **AI-written** — so a style named with a tag
executed in the editor's renderer. Fixed via a new shared
`packages/noodl-editor/src/editor/src/utils/escapeHtml.ts` (three private copies already existed;
this is the one for new callers).

✅ **The markdown path was then measured and is clear — do not re-probe it.** 13 payloads through
Remarkable as `Markdown` configures it, including every spelling that defeats a naive check
(`JaVaScRiPt:`, `java\tscript:`, embedded newline/NUL, leading control byte, HTML-entity
`&#106;avascript:`, `vbscript:`, `data:text/html` on link *and* image): **all refused**, no anchor
emitted at all. Now pinned in `tests-unit/aib-009/markdownHtml.test.ts`, which previously covered
three spellings and nothing on the image path.

⚠️ **Escaping and scheme allow-listing are different defences** — the payload is a *scheme*, not
markup, so `escapeHtml` would not have stopped it. A concurrent phase-67 session found the same
class in `lessonformat.ts` (a live anchor in a node-integrated renderer) the same day.

### The selection inversion's real shape

`div { user-select: none }` → **`:root { user-select: text }`** plus a **container-level** opt-out
list. 🔴 **Never add a `div { user-select: text }` rule** — an explicit `text` on every div punches
through every container-level `none` and silently undoes all of it.

Opt out **per card grid, in that grid's own module** — deliberately *not* hoisted to
`Projects.module.scss`'s `.Main`, which would also swallow the welcome copy and the no-results
message. A container opt-out is right for a surface that is drag all the way down (the canvas) and
wrong for a page region that merely contains cards. Plus one rule the ruling did not anticipate:
`body.noodl-dragging * { user-select: none !important }`, added/lifted by both drag engines, because
both drag on *window* listeners and a container opt-out cannot help once the pointer leaves.

### FIX-002's "~9 at-risk sites" were eight `TextInput`s

The nine `onEnter` consumers flagged as needing classification resolved to **two** real `TextArea`
ones (Build composer, function-node `AiChat`) plus the Explain composer this task converted.
Verified by resolving the enclosing JSX component at each site — **the prop name tells you nothing**,
since `TextInput.onEnter` fired on plain Enter before and after and is unaffected by construction.
No opt-out prop was needed. The policy is a pure module, `TextArea.keys.ts`, checking
`defaultPrevented` first so BLD-016's completion menu can still consume Enter.

### FIX-014's two open calls, decided by the agent

**Logic column at `maxVisualX + 250`**, not a fixed x (a fixed column collides with any wider visual
arrangement); all-logic components fall back to `VISUAL_COLUMN_X`. **Comment nodes do not
participate** — they are `nodes.json`'s separate `comments` array, not `NodeV2`s, and are carried
verbatim. Collisions are **exact-coordinate ties only**, and a node whose position is carried
unchanged from the baseline is **locked outright**, which is the mechanism honouring "never move a
human's arrangement".

### Both remaining agents were stopped mid-flight; their work was preserved and verified

FIX-003's and FIX-014's building agents were stopped by Richard before either committed. Both
worktrees' contents were committed as clearly-labelled WIP (`1b75f99d`, `7240b99f`), then verified
by this session. FIX-014's agent had already written a complete build record; FIX-003's had not, so
**FIX-003's build record is written by a different author than its code** — worth knowing if
something in it turns out wrong.

---

## 4. What to do next and why

1. 🔴 **DRIVE the three built tasks.** This is the phase's critical path now and it is a full
   session's work. In rough dependency order:
   - **FIX-003's drag-surface drives** — canvas node drag, panel tree row drag, sidebar divider,
     both launcher grids, each per surface. This is the regression the ruling *knowingly accepted
     the risk of*, so it is the one that must actually be measured. ⚠️ Watch `body.noodl-dragging`:
     it is added and lifted by JS, so **a drag that ends outside the window** is the failure mode —
     that is the state where the class sticks and nothing anywhere selects.
   - **FIX-003's five criteria** — a URL opens in the system browser from each of four surfaces,
     text selects and ⌘C yields it, citations still navigate, the Build panel renders markdown.
   - **FIX-002's four criteria** + 🔴 **BLD-010's re-drive** (its driven acceptance recorded
     Shift+Enter as the Build composer's send key; FIX-002 reverses that).
   - **FIX-014 criterion 1** — ask the internal AI *and* the MCP for a page with a visual tree plus
     3 logic nodes; logic must land in its own column with no overlap. ⚠️ Needs a **paid** provider;
     verify from `editorSettings.json` (`ai.provider`, `ai.hasKey.anthropic`,
     `ai.verified.anthropic`), not localStorage.

   🔴 **Before driving anything, decide what the CONSEQUENCE is — a drive that measures the
   mechanism passes on a feature that does not work.** A phase-67 session shipped a Learning-folder
   lesson on 08-15 whose live drive verified that *the project opened* and that *recents did not
   grow*. Both were true. Neither was "can this lesson be taught?" — the handler never set
   `project.lesson`, so the lesson opened as an ordinary project with no lesson layer and nothing to
   grade. The drive passed; the feature was broken. A sibling found it a day later by building the
   caller. For this phase's ten criteria specifically, the consequence is not the mechanism:

   | Task | The mechanism (not enough) | The consequence (what to measure) |
   |---|---|---|
   | FIX-002 | Enter fires `onEnter` | the message actually **sends**, and Shift+Enter leaves a **visible** newline the composer grows for |
   | FIX-003 | the anchor has an `href` | the **system browser opens** on that URL, and ⌘C **yields the text** to the clipboard |
   | FIX-003 drag | the class appears on `body` | the node/row/divider **actually moves**, and **no selection is left behind** after mouseup |
   | FIX-014 | the pass runs | the logic nodes are **visibly in their own column**, and a model-positioned node is **byte-identical** to what was asked for |

   ⚠️ **Apply that test per sentence, not per drive.** The author of the incident above audited
   their own five-criterion record afterwards: **four sentences survived and one failed** — and the
   record read as thorough precisely because the other four were genuine consequences. One
   mechanism-shaped sentence wearing a consequence's clothes is what hid the defect, which is far
   harder to spot by feel than a uniformly sloppy drive. Write the ten sentences out first, then
   test each one on its own.
2. **FIX-001** (Tier 1, the explainer) — only minor rulings outstanding; the M-sized live-value
   layer is the phase's biggest remaining user-visible win, and the only Tier 1 task with no code.
3. **FIX-008 fix C** (`--scope project`) if the report should stop recurring — but read §5, Richard
   owes a measurement on C's copy first.
4. ⚠️ **`noodl-mcp/dist` needs a rebuild** for FIX-014 to reach Richard's running MCP servers, and
   the servers need restarting after it. The merge changed `src/tools/author.ts` and
   `src/instructions.ts`.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

---

## 5. Rulings still owed by Richard

- 🟡 **FIX-019 14(a)** — is the surface called *the workbench* everywhere? The caption still says
  "isolated component, not the app" while the menu item says workbench. Loose thread, not a blocker.
- **FIX-004** conversion block shape, log level, Msg keys · **FIX-005** the category name (reverses
  VFN-012) · **FIX-006** demote Script from the AI-authorable set? · **FIX-013** what a data-reading
  component shows on the bench · **FIX-016** signal-input semantics.
- **FIX-008 leftovers:** cleanup of stale user-scope registrations, and whether two visible NodeGX
  servers in one session is better or worse for the model — that second one is a **measurement**, so
  take it before shipping C's copy.
- The two big ones (**FIX-015**'s eight style-token rulings, **FIX-021**'s six memory-doc rulings)
  are their own sessions and their output is a new phase, not code in this one.

---

## 6. Standing constraints — unchanged, do not relearn

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call; **pathspec-scope
every `git add`** — the tree carries other sessions' work in progress, and today it carried three
sessions' at once. ⚠️ `dev-docs/tasks/phase-65-the-library/` is untracked and belongs to **neither**
this phase nor phase 67; leave it alone. The sweep fix means `dev:stop` no longer kills Richard's
MCP servers, but it **still reaps a live `test:ci` tree** — kill the `scripts/start.ts` pid instead.

**Parallel work:** use `scripts/devtools/make-worktree.sh`, never the harness's
`isolation: "worktree"`. Three lanes were cut that way today and merged with **zero conflicts**,
including the one file two lanes shared — because each lane's prompt named the other's territory as
off-limits. Fence regions explicitly in the prompt; it is what made the merge free.

**Coordinating with live sessions:** announce before **and after** any `test:main` or `test:ci`
(two concurrent runs manufacture failures), ask `ListAgents` and message peers directly, and hold a
formal window for merges. This worked flawlessly today across two sessions and caught two real
cross-lane defects neither could see alone. ⚠️ Match **real runner processes**
(`node scripts/run-electron-tests.js`, `Electron test.js`) and **print the pids** — never the
npm-script name, which matches stale watcher shells on a completely quiet checkout.

⚠️ **But a negotiated window only covers the sessions you negotiated with.** This checkout ended the
day with **eight live sessions**, two of which started in the final fifteen minutes and had agreed
nothing with anyone. The protocol above is necessary and not sufficient: **re-check `ListAgents` and
`git status` immediately before a run**, and know that the part that must be quiet is the ~40-second
webpack, not the whole suite (§2).

**Drive fixtures:** `fix012-drive` is the one project whose `/Probe` has 6 typed inputs and a real
placed instance; `vfn64-drive`'s `/Components/Product photo` is the only other component with ports.
`NOODL_REMOTE_DEBUG_PORT=9333` if a stray Chrome holds 9222. `BaseDialog` renders every dialog
**twice** — filter `:not([class*=MeasuringContainer])` on any text-matched click. A React state write
is **invisible in the same `eval`**; read it back in a second one.
