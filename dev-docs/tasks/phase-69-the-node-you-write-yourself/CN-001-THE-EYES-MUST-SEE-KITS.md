# CN-001 — The eyes must see kits

| Field | Value |
|---|---|
| **Tier** | 0 — do this first |
| **Effort** | S |
| **Surface** | `scripts/devtools`, one new no-build package |
| **Rulings** | none — the only task in the phase with no ruling attached |
| **Depends on** | nothing |
| **Blocks** | the *verification* of every other task in this phase |
| **Status** | ✅ **CLOSED 2026-08-16.** All five acceptance criteria met and measured. |

## ✅ Closed 2026-08-16 — what was measured, and one correction to this spec

**The defect was worse than this spec described, and the difference matters.** The prediction was
"renders as an **empty box**". What actually happens is that the page renders *everything except the
kit node*, and the report calls it **"Rendered clean"** with `findings: []` and `consoleErrors: []`.
A blank at least looks like a failure. This looked like a pass.

Measured on a purpose-built drive fixture, `NodeGX test projects/cn001-kit-drive` — a v2 project
holding a built-in `Text` (as a control), a lucide `Icon`, and the cashflow kit's `DangerBanner`:

| | before | after |
|---|---|---|
| `<script src="/noodl_modules/cashflow-kit/index.js">` | **absent** | present |
| `text.elements` | **2** (18px control, 32px icon) | **4** |
| `text.fontSizes` | `{18px:1, 32px:1}` | `{18px:1, 32px:1, 15.6px:1, 13px:1}` |
| the two icon stylesheets | present (hardcoded) | present (**through the scan**) |
| `findings` / `consoleErrors` | `[]` / `[]` | `[]` / `[]` |
| `summary` | **"Rendered clean"** | "Rendered clean" |

The two new font sizes are the `DangerBanner`'s own signature — 13px is its default `fontSize` port
and 15.6px is its `⚠` span at `1.2em` of that. That is why the after-reading is evidence and "the
page is non-blank" would not have been: those two numbers are set by the kit's JavaScript and by
nothing else in the project.

🔴 **One correction to this spec's verification section.** It says to point the harness at
`NodeGX test projects/cashflow-command-centre`. **That project is v1** — it has `project.json` and no
`nodegx.project.json`, so `render-from-disk.js` rejects it with exit 2 and always would have. The
known-broken control had to be built, not borrowed. `cn001-kit-drive` is that control and it carries
its own built-in `Text` element *deliberately*: without it, "the kit node is missing" and "the render
died" produce the same empty page and have opposite fixes.

### What landed

- **`@nodegx/module-inject`** — new no-build workspace package holding `scanModuleManifests`, the
  manifest schema, `toInjectModules`, the `runtimes` filter, and the tag strings
  (`buildInjectionTags` / `injectIntoTemplate`). Hand-written `.d.ts`, `main` at `src/index.js`.
- **`projectmodules.ts`** re-exports it and keeps its public surface byte-identical; its header now
  says where the core went, so the next reader is not misled by the old "single scanner" claim.
- **`render-from-disk.js`** calls the shared injector, and its tag **order** copies the product's own
  `index.html` — dependencies, then the `defineModule` shim, then module mains, then the viewer. A
  tag in the wrong place is indistinguishable at render time from no tag at all.
- **`--print-html`** added beside the long-standing `--print-project`, so the emitted page can be
  asserted on without a browser, a port, or a built viewer bundle.

### The tests, and the proof they can fail

`packages/noodl-editor/tests-unit/cn-001/` (5 tests, under `npm run test:main` — plain Node, so it
runs beside a live editor) plus 11 in the package itself. Three of the five exist only so the others
can fail: a no-modules control, a cloud-only kit the `runtimes` filter must drop, and the ordering
assertion.

**Both mutations were run.** Dropping `${modulesMain}` from the template turns 2 tests red;
*moving* it above the `defineModule` shim — tag present, but too early to work — turns exactly the
ordering test red and leaves the presence test green. Each assertion is bitten by the mutation it
owns, which is what makes them separate assertions rather than one restated.

⚠️ **`@nodegx/render-measure` was in no gate at all.** `test:packages` scopes its packages by name
and that one was never added, so its five `purity.test.js` assertions had never run in CI. They pass
(checked). Both it and `@nodegx/module-inject` are now in the scope — a second no-build package would
have inherited the same silence.

### Acceptance criteria

1. ✅ A project containing a kit renders the kit's nodes — screenshot and font-size signature above.
2. ✅ `<script type="text/javascript" src="/noodl_modules/cashflow-kit/index.js"></script>` is emitted.
3. ✅ Both icon stylesheets still resolve — the lucide `alert-circle` renders in the drive fixture,
   and they now arrive *through* the scan rather than beside it.
4. ✅ Regression test asserts on the **emitted tag**, never on "non-blank", and is proven to fail.
5. ✅ `projectmodules.test.ts` passes **9/9 unchanged**, including its
   *"produces byte-identical HTML to the committed golden"* snapshot. Its stack traces now point
   into `../nodegx-module-inject/src/index.js`, which is the positive control that the editor is
   really running the extracted code and not a leftover copy.

`test:main`: **204 suites / 3145 tests**, all passing. Without this task's suite the same tree reads
203 / 3140 — so the delta is exactly +1 suite / +5 tests. ⚠️ Note the previously recorded floor of
*203 / 3136* does **not** reproduce; no commit since tree `d0891746` touched `tests-unit/` or
`tests-main/`, so that is a 4-test error in the record, not drift.

### 🔴 The phase-67 ordering call, stated as the spec requires

**CN-001 landed FIRST. UNI-010's criterion-3 five-lesson run had not started, and must now score all
five lessons after this change.** Nothing already measured is invalidated — criterion 2's 8/8 was
scored on lesson projects that use no kits, so their F4 readings are unaffected — but the five-lesson
run must not be split across this commit.

## The defect, measured

`scripts/devtools/render-from-disk.js:346-364` builds its own `index.html` as a template literal.
It contains **two hardcoded module stylesheets**:

```js
<link href="/noodl_modules/inter/styles.css" rel="stylesheet">
<link href="/noodl_modules/lucide-icons/styles.css" rel="stylesheet">
```

…and it **never scans `noodl_modules/` for code modules**. `ProjectModules.instance.injectIntoHtml`
is not called. So a project whose page uses a custom node renders as an **empty box** through
`render_report` — and an empty box is a *blank*, not an error.

**Every other HTML path injects correctly** — the preview web-server (`web-server.js:74`), the deploy
`HtmlProcessor` (`html-processor.ts:98`), the headless `noodl-preview` (via `HtmlProcessor`), and
`ViewerConnection.ts:297`. The verification tool is the only blind one, which is the worst place for
this to be.

**Why it matters more than its size suggests.** `render_report` is the MCP tool that exists so an
agent can *look* rather than assume. An agent authoring with a kit would write correct nodes,
measure a blank, and "fix" working code. This is the second failure mode in
`a-gate-that-rejects-the-correct-answer`: **a probe that silently exonerates.**

## The design constraint that shapes the fix

The obvious fix — `require` the editor's `projectmodules.ts` — **does not work**, and the reason is
written in `render-report.js`'s own header: these scripts are **plain JS on purpose** and must keep
running "in a fresh checkout with no build step". `projectmodules.ts` is TypeScript inside the
editor package.

Nor should the scan be reimplemented here: `projectmodules.ts`'s header explicitly claims to be
**"the single `noodl_modules` scanner (LIB-003)"**, and LIB-003 existed precisely because there used
to be two. Adding a third is a regression of a completed task.

✅ **Use the established pattern: a no-build workspace package.** `@nodegx/render-measure`
(F22 / LAS-005, 2026-08-10) exists for exactly this reason — *"the pure half now lives in its own
no-build package so the editor can import it too"*: plain JS, a hand-written `.d.ts`, `main` at
`src/index.js`, no compile step, consumed by both a devtool script and the TS editor.

⚠️ Resolve it **through the workspace**, never a relative `require('../../packages/…')` — the same
header records that a relative path works in a checkout and breaks everywhere else.

## What to build

1. **Extract the scan + inject into `@nodegx/module-inject`** (name to taste), a no-build package
   holding the pure half of `projectmodules.ts`: `scanModuleManifests`, the manifest schema, the
   `runtimes` filter, and `injectIntoHtml`'s string work. Node `fs` is acceptable (the package is
   Node-side only); Electron and `@noodl/platform` are not.
2. **`projectmodules.ts` re-exports from it** and keeps its public surface byte-identical. It stays
   the single scanner — it just no longer *owns* the code. Its header comment must be updated to say
   where the core now lives, or the next reader will believe the old claim.
3. **`render-from-disk.js` calls the shared injector** instead of its template literal's hardcoded
   `<link>` tags. The two icon stylesheets must keep working — they should now arrive *through* the
   scan, not beside it.

**Serving already works.** `render-from-disk.js:391-397` serves from the viewer dir and then the
project dir, which is why the hardcoded icon stylesheets resolve today. `/noodl_modules/<kit>/index.js`
will resolve by the same route once the tag is emitted. **Do not add a second static route.**

## Acceptance criteria

1. A project containing a kit renders **the kit's nodes** through `render_report`, not a blank.
2. `curl`ing the render server's HTML shows `<script src="/noodl_modules/<kit>/index.js">`.
3. The two icon stylesheets still resolve — verified by a project that uses a lucide icon.
4. A regression test fails if module script tags stop being emitted. ⚠️ It must assert on the
   **emitted tag**, not on "the render is non-blank" — a blank has too many causes, and
   `the-render-harnesss-blank-rule-is-two-numbers` records that the blank rule is already subtle.
5. `projectmodules.ts`'s existing tests pass unchanged. If they don't, the extraction changed
   behaviour and the extraction is wrong.

## How to verify it, given the tool being fixed is the one that verifies

🔴 **This is a probe that silently exonerates, so the check must run against a KNOWN-BROKEN input.**
Point the fixed harness at `NodeGX test projects/cashflow-command-centre` **before** the fix and
confirm it reports blank; then after, and confirm it reports the pills. A test that only runs
against the fixed state proves nothing — see `a-gate-that-rejects-the-correct-answer`.

The independent control is `noodl-preview`, which injects correctly today and was used to prove the
kit works on 2026-08-15. If the two disagree after this task, the harness is still wrong.

## 🔴 It shares its file with phase 67, and the ordering matters

Added 2026-08-15 (README §4). **UNI-010's failure class F4 — "a solution that draws nothing" — is
graded by this exact chain**: `NODEGX_RENDER_CLI` points at `scripts/devtools/measure-from-disk.js`,
which imports [`render-report.js:41`](../../../scripts/devtools/render-report.js), which spawns
`render-from-disk.js`. Two consequences:

1. **Do not let phase 67's criterion-3 run straddle this task.** UNI-010's five-lesson experiment
   scores F1–F4 mechanically per lesson against a pre-registered ≥3-of-5 rule. If this task lands
   mid-run, the instrument changes under the experiment and the five scores are not comparable.
   Either finish criterion 3 first, or do CN-001 first and score all five after — **and say which**.
   (Lesson projects do not use kits today, so the *current* F4 numbers are not wrong; the risk is a
   split-instrument dataset, not a bad reading.)
2. ⚠️ **This task does NOT close UNI-010's F4 hole, and should not be read as closing it.** That hole
   is that `scripts/` is absent from `package.json`'s `build.files`, so on a packaged install the
   harness is not present at all — the injector being correct does not help a file that never
   shipped. What this task *does* do is move the pure half into a workspace package, which is the
   same shape as the "ship the render harness with the sidecar" option Richard is holding. **Worth
   telling him this task exists before he rules**, because it makes that option cheaper; do not
   pre-empt the ruling by shipping it here.

## Out of scope

- The catalog overlay (CN-003) — this task is about **rendering**, not about knowing types.
- `render-from-disk.js`'s `/react19/` handling, which is already correct.
- **Shipping the harness to packaged installs** — that is phase 67's open F4 scope call (above), not
  this task's to take.
