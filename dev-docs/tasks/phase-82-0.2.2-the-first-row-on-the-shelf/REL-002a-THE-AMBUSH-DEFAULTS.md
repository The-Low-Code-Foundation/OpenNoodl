# REL-002a — The ambush defaults the template sits on

**Run-sheet row 4.** Built and closed **2026-09-01 (session 4)**. Was phase 81's VIB-005.

---

## 🔴 The headline: the template could not be filled in, and the harness could not see it

`templates/members-area` at HEAD, rendered on the product's own host CSS, at three viewports. The
numbers are **controls a user can actually click**, counted by walking the page in viewport-sized
steps and hit-testing each one with `elementFromPoint` — not "is it in the DOM", which said yes to
every single one of them.

| page | 988×313 (editor preview default) | 1280×900 | 390×844 |
|---|---|---|---|
| `/setup` **before** | **0 of 7** | 4 of 7 | 3 of 7 |
| `/join` **before** | **0 of 6** | 5 of 6 | 6 of 6 |
| `/setup` **after** | 7 of 7 | 7 of 7 | 7 of 7 |
| `/join` **after** | 6 of 6 | 6 of 6 | 6 of 6 |

The submit button — *"Set up this members' area"* — was **unreachable at all three widths**. The
first-run page of the template this release exists to publish could not be completed by anybody, on
any screen measured. `/join`'s *"Send my request"* likewise.

**This is REL-001's blocker and it was not on any board.**

---

## The mechanism, located

It is **one project setting**, and it is not on any node.

[`noodl-viewer-react/src/viewer.jsx`](../../../packages/noodl-viewer-react/src/viewer.jsx) — when
`settings.bodyScroll` is falsy, `render()` takes its else-branch and wraps the whole app in

```jsx
<div style={{ margin: 0, padding: 0, overflow: 'clip', width: '100%', height: '100%' }}>
```

whose own comment reads *"This div is pinned to the viewport and routinely holds taller content."*
`clip` — deliberately, NDA-008 — **creates no scroll container at all**, so neither the user nor the
browser can reach past it. The host page pins `#root` the same way
(`position: fixed; height: 100%; overflow: clip`) and relaxes it only under `body.body-scroll`,
which the viewer adds on `projectSettingsChanged` **only when `bodyScroll` is true**.

### 🔴 The row named three causes and none of them is it

Six arms, built as real v2 projects one parameter apart, each a 20-row page rendered at 988×313 on
the product's host CSS. The question is whether the last row can be clicked.

| the page's root Group carries | last row reachable? |
|---|---|
| nothing but `flexDirection` (the naive shape) | **no** |
| `clip: true` | **no** |
| `sizeMode: explicit`, width/height 100% | **no** |
| `sizeMode: explicit` + `clip` | **no** |
| `sizeMode: contentHeight` | **no** |
| `sizeMode: explicit` + `clip` + **`scrollEnabled: true`** | **no** ← the row's own prescription |
| — and `settings.bodyScroll: true` | **YES** |

`scrollEnabled` cannot help and the chain says why: that Group grows to its own content
(`h=724, clientHeight=724, scrollHeight=724`), so its `overflow-y: auto` has nothing to scroll, and
the clip is **two ancestors above it**. ✅ **A fix that costs a parameter and changes nothing is
worse than no fix — the author spends the change and concludes the setting is not the problem.**
The diagnostic this task ships says so in as many words.

### ✅ And the dead gaps are the same setting, which is why the row half-recognised it

The row's first ambush — *"a `Group` with no `sizeMode` is explicit 100%×100%, and in a column
becomes `flexGrow: 100`… hence the ~690px dead gaps"* — is **real, and it is a consequence of
`bodyScroll` being off**, not an independent defect. Compare the before/after pair at 1280×900:
before, ~300px of white sits between the heading and the blurb; after, the content hugs.

The reason is one line of CSS. With `bodyScroll` false the app wrapper is `height: 100%` — a
**definite** 900px box — so a child at `height: 100%` resolves to `flexGrow: 100` against real free
space and distributes it. With `bodyScroll` true the root becomes `height: auto; min-height: 100vh`,
there is no free space to distribute, and the same nodes hug their content. **One setting, both
symptoms.** The row was right about the mechanism (`percentage height → flexGrow`,
[`layout.ts:86`](../../../packages/noodl-viewer-react/src/layout.ts#L86)) and wrong about where to
fix it.

---

## 🔴 The instrument could not see any of this — and that is its own finding

`scripts/devtools/render-from-disk.js`, which is what `render:report`, `measure-from-disk` and every
`.look.ts` render through, served **its own host page**: `<style>html,body{margin:0;padding:0}</style>`
and a bare `<div id="root">`. No `#root` pin, no `.body-scroll` rule. The same seven arms, read on
both hosts:

| arm | harness host (before) | product host |
|---|---|---|
| every arm without `bodyScroll` | scrollable, **last row reachable** | **not reachable** |
| `bodyScroll: true` | reachable | reachable |

**The harness reported the defect as absent in every arm.** The first measurement this session took
was a clean negative on all three of the row's claims — and it was a reading of the instrument, not
of the product. ✅ **A control that cannot reproduce the defect is not a control**, and the tell was
that the *fix* arm and the *defect* arm read identically.

Fixed: `buildHtml` now emits the product's own `<style>` block, **read from the product file at
run time** (`VIEWER_DIR/index.html`, falling back to the tracked
`packages/noodl-viewer-react/static/deploy/index.html` for a worktree that has not built) so the two
cannot drift. If neither is readable it says so loudly rather than quietly measuring a page the
product never serves. Verified after the change: the arms now reproduce the product exactly, with no
CSS injected by hand.

⚠️ **`scrollHeight` is not a usable amputation metric here.** On the clipped wrapper it read 852
against a 313 box at 988×313 (overflow reported) and **900 against a 900 box at 1280×900, while
content really extended to 1062** (overflow not reported). An "amputated px" number built on
`scrollHeight − clientHeight` therefore reads **0 at the viewport where three controls are out of
reach**. The reachability walk is the measurement; that number is a secondary readout and is
recorded here only so the next session does not trust it.

---

## What was built

### 1. The template scrolls — `templates/members-area/nodegx.project.json`

`settings.bodyScroll: true`. This is the fix for the table at the top. Nothing else in the file
moved; the before-arm used for the pair is a copy with that one key deleted, so the pair varies one
thing.

### 2. New projects scroll — `packages/noodl-mcp/src/tools/createProject.ts`

`settings: { htmlTitle, navigationPathType: 'path', bodyScroll: true }`.

✅ **Existing projects are untouched** — this is what a new project starts with, not a change to the
runtime default, so an app deliberately built as a fixed viewport keeps its `false`.

### 3. The door says something — `validation/pageScroll.ts`, `DiagnosticCode.PageCannotScroll`

A routed page in a project that has **not decided** about `bodyScroll`. Wired into
`authoredPreconditionDiagnostics`, so it reaches **both** gates: the MCP write gate and the plan gate
(via `preconditionDiagnostics` → new `projectBodyScroll(store)`) and the editor's authoring gate
(via a new `ValidateCandidateOptions.bodyScroll`, bound at the two call sites that hold a
`ProjectModel`).

🔴 **Three states, kept distinct all the way down** — the `security` convention exactly:

| value | meaning | verdict |
|---|---|---|
| `undefined` | the caller cannot read project settings | **do not check** |
| `null` | the file was read; the setting is absent | **report** |
| `true` / `false` | the project decided | silent, either way |

**Corpus, and it is the reason the rule fires on `null` and not on `false`:** 187 projects across
both corpora, **143 carrying a `Page` — 76 set `bodyScroll: true`, 67 leave it unset, and NOT ONE
sets it to `false`.** There is no population of authors who wanted a fixed viewport and said so.
There is a population who never met the setting, and their apps ship content nobody can reach.

**Severity: warning, not blocking.** This file's standing convention — promotion into
`AUTHORED_BLOCKING_WARNINGS` is earned on evidence, and 67 hand-authored corpus projects would go red
the day it refused.

`packages/noodl-editor/tests-unit/rel-002a/pageScroll.test.ts` — **9 specs, all green**, and
**graded by mutation**: collapsing `undefined` into `null` fails the "caller cannot say" arm;
dropping the `Page` predicate fails the row-component arm. The control was restored and re-run green
after both.

### 4. V14 — the placeholder default no longer ships a tell

`'Type here...'` → `''`.

🔴 **It was in TWO source files and a one-file fix read as done.**
[`nodes/controls/text-input.ts`](../../../packages/noodl-viewer-react/src/nodes/controls/text-input.ts)
(`net.noodl.controls.textinput`) and
[`nodes-deprecated/controls/text-input.tsx`](../../../packages/noodl-viewer-react/src/nodes-deprecated/controls/text-input.tsx)
(`Text Input`) each register a type and the catalog carries an entry for each. After editing only the
live one, `node-catalog.json` still held one `Type here...` — caught by counting the artefact rather
than trusting the edit.

Measured before: the template has **18 text inputs and one** sets `placeholder` explicitly, so
seventeen fields shipped *"Type here…"* — six on `/setup`, four on `/join`, every one of them under
a real label that already named it. And **nothing fired on it**, because `render-report`'s own
placeholder finding derives the strings it hunts for **from this very default**.

Also changed with it, because each is a copy of the same tell:
- `docs/node-catalog/examples/ui-form-field.json` — the `FormField` component's own default was
  `"placeholder": "Type here"`. Removed; the three instances already demonstrate the port with real
  values (*"Ada Lovelace"*, *"you@example.com"*, *"Optional"*). ✅ `catalog:examples` **67/67 clean,
  strict, warnings-as-errors.**
- `packages/noodl-mcp/tests/renderReportModule.test.ts` — the notice spec that pins the placeholder
  set moves `['Label','Text','Type here...']` → `['Label','Text']`. That spec's own comment calls
  itself "the notice"; this is the notice firing.
- Both catalogs regenerated; `catalog:check` and `catalog:merge:check` both report **up to date**.

✅ **Verified through a rebuilt artefact, not through the source.** The production viewer bundle was
rebuilt (`build:editor:_viewer`, exit 0, **1,541,843 bytes** — the production size class, against the
14.5MB dev build the handoff warns about) and re-measured on the real template: **0 occurrences of
`Type here` in the bundle, and all 18 fields render an empty placeholder.**

---

## ACs

| AC | verdict |
|---|---|
| the door says something at authoring time for each of the first three | 🟡 **one rule, for the mechanism all three share.** `PageCannotScroll` covers what `sizeMode`, `scrollEnabled` and `clip` were each blamed for, because a rendered pair-wise measurement showed none of the three changes the outcome and the project setting is the only thing that does. Two candidate per-node rules were measured and **deliberately not shipped** — see below |
| the placeholder default no longer ships a tell | ✅ both source copies, both catalogs, the corpus example and the notice spec; confirmed through a rebuilt production bundle |
| the naive page re-authored through the door scrolls | ✅ the `bodyScroll: true` arm is the only one of seven whose last row is reachable; the template goes 0/7 → 7/7 and 0/6 → 6/6 |
| judged by before/after screenshots | ✅ `before_setup.png` / `after_setup.png` at 1280×900: before, a ~300px dead gap and a form card cut off at *"Your email"*; after, no gap and the green submit button present |

⚠️ **Honest limit on the screenshot pair.** Both shots were taken with the **rebuilt** viewer bundle,
so both show empty placeholders. The V14 before-state is the earlier reading — six `"Type here..."`
on `/setup`, four on `/join`, taken against the pre-fix bundle — not this image pair.

---

## 🧭 Registered, not built

1. **An inert `scrollEnabled` — owner `NONE`, and it wants one more measurement.**
   `scrollEnabled: true` on a node whose `sizeMode` is `contentHeight`/`contentSize` can never
   scroll: the box *is* its content's height. Corpus: **312 nodes set `scrollEnabled: true`, 115 of
   them content-sized.** Not shipped as a rule because the predicate is not finished — `scrollEnabled`
   maps to CSS `overflow` only when `nativeScroll` is true (otherwise it is iScroll), and
   `contentHeight` in a `row` still permits horizontal overflow, so the narrowing has to name the
   scroll axis. A rule shipped on the unnarrowed 115 would be a guess with a corpus number attached
   to it. Worth doing; not worth doing badly.

2. **`clip: true` amputating content — owner `NONE`, and the honest verdict is NOT REPRODUCED.**
   672 corpus Groups set it, 35 in the template. In every arm measured, `clip` on the page's own
   Group changed nothing, and no element on any template page reported clipped-away content. The
   row's third ambush has no measurement behind it today. **Recorded as disproved rather than
   quietly dropped** — the next session should not re-derive it at full price.

3. **The dead-gap geometry at wide viewports** belongs to **REL-002c**, which is redesigning these
   pages. `bodyScroll: true` removes the flexGrow gap; what is left is a landing page painting 172px
   of content in a 900px viewport, which is a design verdict, not a defect.

---

## What the next session must not re-derive

- 🔴 **The scroll defect is `settings.bodyScroll`, full stop.** Not `sizeMode`, not `scrollEnabled`,
  not `clip` — each measured, one at a time, on a rendered page.
- 🔴 **`render:report` before this session could not see a fold defect at all.** Any earlier verdict
  about reachability, page height or below-the-fold content taken through it is void. That includes
  P81's VIB family. Re-take the ones that matter.
- ✅ **`create_project` now writes `bodyScroll: true`**, so a page authored through the MCP server
  from today scrolls. Projects created before today do not, and the door now says so.
