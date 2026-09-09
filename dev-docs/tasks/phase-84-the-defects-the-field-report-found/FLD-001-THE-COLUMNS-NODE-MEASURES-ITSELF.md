# FLD-001 — The Columns node measures itself

The breakpoint code is correct. It has never once been reached. This is the only issue on the board
whose reporter marked it *"Blocks me — I cannot work around it"*, and the reporter is Richard.

## 1. The person sentence

**Someone adds a Columns node, sets Medium Below to 700 and a Medium Layout, narrows the preview,
and the columns re-lay-out.**

## 2. What was reported, and what the code says

[#21](https://github.com/The-Low-Code-Foundation/NodeGX/issues/21): set Medium Below and Medium
Layout, shrink the preview, nothing happens — the default layout string keeps rendering. Reproduces
in a brand-new project, macOS, 0.2.2.

Measured 2026-09-09 at `cline-dev` HEAD (`11b2d3a9`, which **is** the `v0.2.2` tag):

- `Columns.tsx:358-372` — the `ResizeObserver` is created inside a `useEffect` with **`[]` deps**
  that reads `containerRef.current` and returns early if it is null.
- `Columns.tsx:431` — `if (!props.children) return null;` The `<div class="columns-container">` that
  carries the ref is **not rendered** when the node has no children.
- `react-component-node.ts:1410-1428` — `renderChildren()` returns **`null`, not `[]`**, for zero
  children, so `props.children` is falsy.
- Children arrive by `addChild` → **`forceUpdate()`** (`react-component-node.ts:1247-1257`), a
  re-render with an unchanged React key. **Not a remount.** `useEffect([])` never runs again.
- `Columns.tsx:174-181` — with `containerWidth === null`, `resolveColumnLayout` returns the
  **authored** layout on its first branch, and `pickBreakpointLayout` (`:206-217`, itself correct
  and unit-tested at `nda-006-columns-layout.test.tsx:152-168`) is never called.

🔴 **The authoring order in the issue is the trap.** Add the node (childless mount — trap armed),
*then* add children. A preview refresh cures it for that session, because on a fresh graph build the
children exist before the first render. That is why it can look intermittent.

🔴 **The fix for one bug created this one.** The comment above `:431` says the early return was added
because a Columns node whose last child was deleted at runtime changed its hook count and React
threw. Live-editing a graph does exactly that. Do not simply delete the early return.

**Second, independent defect in the same measurement.** `container.offsetWidth` (`:367`) is read on a
div declared `width: calc(100% + marginX)` (`:502`), so the measured width is **16px wider than the
container** by default. "Medium Below 700" actually fires below 684, and the runtime disagrees with
the export, which measures the true container.

**Blast radius beyond breakpoints:** the same null width kills **Auto Fit and autofold** on the same
node instances. It also reaches deployed and exported-as-viewer apps, not only the editor: any
Columns whose children are all unmounted at first paint arms the identical trap.

## 3. Scope

- Key the observer off the **element**, not the mount — a callback ref that sets state, and an effect
  that depends on that state. Disconnect and null the width when the element goes away.
- Give the second refless path (`:446`, `if (!columnLayout) return <>{props.children}</>`) the same
  treatment, or hoist the container div above both early returns. It is the same trap.
- Fix the gutter: measure the true container width, not `offsetWidth` of a div widened by `marginX`.
- 🔴 **Ship the observer fix and the gutter fix together.** They push in opposite directions, and
  landing one without the other moves every existing breakpoint by 16px in the wrong direction.
- Say in the release note that Auto Fit and autofold start working on nodes where they were dead.

## 4. Acceptance criteria

1. **(person)** In the editor: add a Columns node, add three Text children, set Medium Below 700 and
   Medium Layout `1 1`. Narrow the preview below 700. The layout changes. Widen it. It changes back.
2. A spec mounts `Columns` with `children={null}`, re-renders it **with** children without
   remounting, and asserts the measured width becomes a number. This is the regression control and
   it must fail on the **reverted** arm — the `[]`-deps effect restored — and pass at HEAD.
3. 🔴 **A presence control:** the same spec with the observer deliberately broken reads `null`, so a
   green AC2 cannot be a spec that observes nothing. `nda-006-columns-layout.test.tsx:1-15` states
   outright that the measured path is exercised **only by calling `calcAutofold` directly** — that
   is the hole this closes, so do not extend that file's habit.
4. The measured width equals the container's true width, asserted against a known `marginX` — not
   `offsetWidth`. A spec with `marginX: 16` and a 700px container measures 700, not 716.
5. Auto Fit and autofold are shown working on a node authored in the issue's order (node first,
   children second) — the two features that were dead for the same reason.
6. The exported React for the same graph still uses container queries and is unchanged: a spec
   asserts the emitted `@container` rules before and after are identical. This task must not move
   the export.

## 4b. What was built — 2026-09-09, session 1 🟢 **BUILT**

Commit: see `fix(p84/fld-001)`. Two changes in
`packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx`, shipped together:

1. **The observer is keyed off the element, not the mount.** The `containerRef`/`useEffect([])`
   pair is gone; the callback ref sets a `containerElement` **state** and the effect depends on it.
   Mounting the container div arms the observer whenever it happens; unmounting it disconnects and
   sets the width back to `null`. Neither early return was touched — the `!props.children` one is
   still there, still load-bearing, and the second refless path (`!columnLayout`) is covered by the
   same mechanism rather than by a second special case.
2. **`measureContainerWidth(el, marginX)`** — exported — subtracts the gutter the container div is
   widened by (`width: calc(100% + marginX)`), clamped at 0, and treats an unresolvable tokenised
   gutter as 0, which is the rule `toPixels` already follows for the fold.

**Deliberately no eager measurement in the effect.** `observe()` delivers an initial callback in
every browser; reading `offsetWidth` synchronously would report `0` for anything not yet laid out —
a *number*, so it takes the measured branch and folds the node to one column instead of leaving the
authored layout up.

### The measurements

**Spec** — `packages/noodl-viewer-react/tests/corpus/fld-001-columns-measures-itself.test.tsx`,
8 tests, all green. It drives the real component in hand-built jsdom (this package has no
`jest-environment-jsdom`; `nda-012-radio-button-group` set the precedent) through `createRoot`, with
a counted `ResizeObserver` stub, and asserts **rendered `width:` percentages** — the consequence —
never the state behind them.

**Both arms, measured rather than assumed** (`--noEmit` clean, floor 0 errors):

| arm | result | what it attributes |
|---|---|---|
| HEAD before the fix | **7 of 8 red** | only the pure `measureContainerWidth` unit test passes |
| R1 — `[]`-deps effect restored, gutter fix kept | **7 of 8 red** | the observer keying owns 6 render tests |
| R2 — gutter fix reverted, observer fix kept | **exactly 1 red** | the AC4 render test, and only it, discriminates 700 from 716 |
| fixed | **8 of 8 green** | — |

R2 is the useful one: it shows the AC4 *unit* test stays green while the gutter is broken, because
it grades the helper; only the *render* test grades whether the helper is wired. A green unit test
there would have been a mechanism check passing over a dead path.

⚠️ **A stub bug cost a cycle and is worth keeping.** `return { ...state, get calls() {…} }` reads
correctly and does not work: object spread copies `observerCalls`/`disconnects` by value (both `0`),
and ts-jest's downlevel turns the literal into `__assign`, which evaluates the accessors eagerly and
stores their results as plain properties too. Every counter froze at zero while `observed` kept
working, because an array is copied by reference. **A counter that always reads `0` fails an arming
assertion in exactly the way a genuinely unarmed observer does.** The stub returns the live object
now.

**No regression:** `noodl-viewer-react` — **100 suites, 1348 tests, all green**, including
`nda-006-columns-layout` (32) and `f49-columns-token-margins`.

### AC1 and AC5 — driven in the real editor

A fresh editor (`NOODL_USER_DATA_DIR` in the scratchpad, so Richard's launcher config and projects
were never touched) on a **copy** of the `test` starter, with the node authored in the issue's
order: **Columns created childless first**, children dragged in afterwards, one at a time, preview
live throughout. Confirmed on disk at each step: `Group → Columns` with **no** `.columns-container`
in the preview (a childless Columns renders `null` — the trap armed), then `Group → Columns → Text`
and the container appears.

Medium Below `700`, Medium Layout `1 1`, Layout String `1 2 1`, three Text children:

| preview width | container (true) | `offsetWidth` | item widths | layout |
|---|---|---|---|---|
| 1000 | 1000 | 1016 | `25% 50% 25%` | authored `1 2 1` |
| 600 | 600 | 616 | `50% 50% 50%` | medium `1 1` |
| 1000 | 1000 | 1016 | `25% 50% 25%` | back again |
| **690** | **690** | **706** | `50% 50% 50%` | **medium fires** |
| **710** | 710 | 726 | `25% 50% 25%` | medium does not |

🔴 **690 is the row that proves the gutter half in the product.** Its `offsetWidth` is **706**, and
`706 < 700` is false — the pre-fix runtime would have refused to fire there. The boundary now sits
at a true container width of 700, not at 684, and `parentClientWidth` matches the measured width
exactly at every row.

**AC5, same node, same authoring order.** Min Column Width `300`: 1400 and 1000 render `25/50/25`,
800 folds to `33.3/66.7/33.3` — autofold running on an instance where it had been dead.

### AC status

| AC | state | instrument |
|---|---|---|
| 1 person sentence | 🟢 | editor drive, table above |
| 2 childless→children regression control | 🟢 | spec; red on arm R1 |
| 3 presence control | 🟢 | spec: observer reports nothing ⇒ authored layout, armed identically |
| 4 true width, not `offsetWidth` | 🟢 | spec unit + render; render red on arm R2; drive rows 690/710 |
| 5 Auto Fit and autofold alive | 🟢 | spec (both) + editor drive (autofold) |
| 6 export unchanged | 🟢 **pre-existing gate, not new work** | `nodegx-export/tests/visual-controls.test.ts:192` asserts the emitted `@container` rule verbatim; 48 tests green. Nothing in `nodegx-export` was touched. |

⚠️ **AC6 was green before the work** — it is a must-not-break, and it is recorded as one rather
than counted as something this task built.

### Left for the release note (§3 asks for it)

- Auto Fit and autofold **start working** on nodes where they were silently dead.
- Every existing breakpoint moves by one gutter: "Medium Below 700" used to fire below 684 and now
  fires below 700. Projects authored around the broken behaviour will start folding. This is a real
  behaviour change on existing user projects.

### Found while building — filed as register rows P14, P15 and P16, not chased here

- 🔴 **The launcher's "New project → Quick Start" hangs.** Name typed, folder defaulted, "Create
  Project" spins forever: no project directory is created, no error is shown, nothing reaches
  `.logs/dev.log`. Reproduced twice on `cline-dev` HEAD. It blocked AC1's drive until worked around
  by seeding a recent-projects entry instead. **Owner: NONE.**
- The component context menu offers **no "Make Home"** for either a page or the `App` component in
  this build, while the viewer's own error page instructs the user to click exactly that.
  `ComponentItem.tsx:240` gates it on `component.isPage || component.isVisual`. **Owner: NONE.**
- `NodeContextMenu.ts:179` builds "Add new child" with `parentModel: editor.highlighted?.model` —
  the **hovered** node, not `selectedNodes[0]` which the menu item's own condition tested.
  **Owner: NONE.**

## 5. Traps

- 🔴 **Do not delete the `:431` early return.** It is load-bearing against a hooks-count crash on
  live deletion. Hoist the ref-carrying div above it, or move the guard inside the render.
- 🔴 **A drive that opens a saved project cannot see this.** Loading a project builds the graph with
  children already present, which is the arm where the bug does not reproduce. The drive must
  **create the node and then add children**, in that order, in a live editor.
- ⚠️ Fixing this starts folding columns in projects authored around the broken behaviour. That is a
  real behaviour change on existing user projects and belongs in the release note, not in a
  footnote.
- ⚠️ `ResizeObserver` in jsdom needs a stub. Assert the stub is *called*, or AC2 grades nothing.
- ⚠️ The runtime uses a strict `<` where the exported CSS `max-width` is inclusive. Do not "fix" one
  to match the other inside this task; record it and let FLD-002 or a follow-on take it.
