# Next-session prompt — phase 57, after session 16

Paste everything below into a fresh session.

---

You are picking up **phase 57 (BLD — the Build panel as a conversation)** on `cline-dev` in
`/Users/richardosborne/vscode_projects/OpenNoodl`.

Read `dev-docs/tasks/phase-57-build-conversation/HANDOVER-SESSION-16.md` first, then `TASKS.md`.

NB: there are several parallel sessions fixing minor bugs who may take the editor from time to time.
Just set a timer for 10 mins and wait to check when it frees up. Don't complain about the other
sessions and their commits, just be patient and get the job done. We don't need super clean commits.

## 🔴 Do these checks before anything else

1. **`git log` *and* `git status` — every session since 7 has run beside a sibling.** An inherited,
   uncommitted set has now survived **nine** sessions and is **not yours**: `dev-docs/tasks/phase-17-noodl-learn/`,
   both files under `packages/noodl-core-ui/src/components/code-editor/`, the four `Launcher/` files,
   `hello-world.template.ts`, `ProjectsPage.tsx`, `ExtractToComponent.ts`, `EditorClipboard.ts`,
   `useComponentActions.ts`, three files under `packages/noodl-editor/tests/`, and four untracked
   `ExtractToComponentPopup` / spec files. **Leave all of it.** Three untracked
   `dev-docs/tasks/phase-59…61` directories are likewise not yours.
   **Pathspec-scope every commit; never `git add -A`; never `git stash`.**
   ⚠️ A clean `git status` can also mean *a sibling already committed your work* — check `git log`.
   ⚠️ A pre-existing `stash@{0}` on this branch belongs to nobody who has been here since session 7
   and still wants identifying.
2. **`ps aux | grep "[e]lectron/dist"` before you launch or stop anything.** `npm run dev:stop` reaps
   by *checkout* and a sibling shares this one. If something is running that you did not start,
   **ask Richard before stopping it** — the editor is a queue, not a resource to seize.
3. ⚠️ **Never run `test:ci` with a dev stack up** — it manufactures phantom failures. Stop the stack,
   redirect to a file, `grep -E "^Jasmine:"`; never `tail` it, the `FAILED:` list prints *after* the
   verdict line. **The baseline is 6 failures, confirmed by name at five seeds** (39386, 30232,
   27603, 52977, 97132) — **but see the BEN-001 note below: a run can legitimately show 9.**
   ⚠️ **Do not diff the spec count** — it moved 2596 → 2632 purely because the sibling's
   *uncommitted* Jasmine specs are wired into two `index.ts` barrels.
4. **`ai-test` holds two things that look like litter and are not.** Its `project.json` carries a
   sibling's Slider/Expression graph; `docs/uk-vat.md` is BLD-007's acceptance fixture. **Do not
   clean either.** Session 15 drove the whole of BLD-013 against this project without writing to it —
   attachments were constructed in the renderer's memory, so `project.json` was never touched.

## 🔴 And one about money

> **The editor has a real, verified Anthropic provider (`editorSettings.json`, not localStorage).
> A drive costs Richard money.**

**Session 15 spent nothing** — every path in BLD-013 and BLD-014's webview half is reachable without
a billed call, so none was made. Sessions 11 and 14 spent `$0.0588` and `$0.0298`.

⚠️ **Ask before the first one, and scope it.** A request phrased to reach the *plan* route stops at
the proposal; one phrased to reach the *component* route runs a whole authoring session on top of
the call you were given permission for.

## Where the phase is — recount, do not increment

**13 of 17 fully built, plus BLD-014's webview half.** ⚠️ The running total was off by one for
several sessions because each one added to the last one's number. **Count it off the tables in
`TASKS.md`.** Track A is 9 of 11; Track B is 4 of 6 plus a half.

**All three open decisions are now answered and recorded in their task files** — Q5 (PDF: a
capability gate, no library), Q6 (a capture is a one-click offer, not automatic) and **F22 (the
shared render substrate: a no-build package, `@nodegx/render-measure`)**.

⚠️ **Read `packages/nodegx-render-measure/src/index.js`'s header before touching it.** It records
the two rejected F22 options and why, and the one rule the package exists to hold: **no `require`
in it, ever.** A single `require('path')` to build one file path would not fail a typecheck, would
not change a number, and would silently put Node in the renderer bundle. There is a spec that bites
on the source text and a second that evaluates it with `require` out of scope.

## What is actually left

| | What | Notes |
|---|---|---|
| **BLD-015** | web search | The cheapest remaining feature, and the same shape one more time: a kind, a resolver, a glyph. Needs a backend decision (Q4). |
| **BLD-009** | expanded mode | A real feature, not a bolt-on: the same thread as a document, two-pane with the live preview. Closes **D10**. `BuildThread` already takes a `ThreadWidth` and has an `is-expanded` variant, so the host is the work. |
| **BLD-010** | acceptance pass | Not a task so much as a sweep, and **its debt list is now nine** — see below. |
| **BLD-014** | the CDP half | ✅ **Unblocked — F22 was resolved 2026-08-10.** `@nodegx/render-measure` is a no-build package with no `require` in it; the editor already imports it for the webview producer. What is left is the *transport*: a `Page.navigate` entry point for an arbitrary URL and the viewport vocabulary (`desktop,phone` or `390x844`), which `DEFAULT_VIEWPORTS` already exports. LAS-005 estimated ~50 lines plus live QA once decided. |
| **BLD-012** | 🟡 two legs | OpenAI's image leg is stub-only; the panel chip claim is about a *message* carrying an image, which BLD-011's composer chip does not close. |

**Suggested order: BLD-014's CDP half, then BLD-015, then BLD-009, then BLD-010.** The CDP half
jumped the queue because F22 no longer blocks it and the measurement side is already proven inside
the editor — only the transport is missing.

**Original ordering rationale:** BLD-009 is the last unbuilt *feature*; BLD-010 should run last
because every task before it adds to what it has to sweep. ✅ BLD-016 closed in session 16.

### BLD-010's list is eleven

BLD-004's **R4** (Ollama open-weight leg, inferred not driven) and **R5** (OpenAI-compatible
`reasoning_content`, deliberately unwired); BLD-006's **R12**; BLD-017's **F2** and **F4**; BLD-008's
drafting turns + restart-resume; BLD-011's **R9** (a comprehension probe the request's actual route
can answer); from session 15 — **BLD-013's drag-and-drop and file-picker paths** (paste was
driven end to end, the drop handlers were not) and **BLD-014's on-screen staleness**; and new from
session 16 — **BLD-016's `get_component` consequence** (the mechanism is built and specced; the
criterion says to compare tool calls before and after on a fixture run, which costs one billed call)
and **BLD-016's `collection` leg** (built, never driven — `ai-test` has no backend, so the group
correctly never rendered).

## 🔴 Two rules session 16 paid for

> **An acceptance criterion can decide the architecture — read them before choosing a design.**

BLD-016's *"deleting the token removes the chip, and vice versa"* is unsatisfiable by the obvious
build (the menu inserts a token **and** attaches a reference: two writes to two stores). Making the
composer text the **single source of truth** and deriving the chip row from it on every change
removed the problem instead of solving it — and made *typing* a mention work for free, which is the
AIB-010 half of the same task. **A criterion that is awkward to satisfy is usually describing an
invariant the design does not have yet.**

> 🔴 **A member declared ahead of its task is a default nobody measured.**

BLD-011 declared the whole `ReferenceKind` union up front so the chip row, caps, meter, carry-over
and persistence would be written once. That bet paid off completely — BLD-016 changed none of them.
But `REFERENCE_CAPS.page` had been declared *beside* `doc` and inherited a doc-sized **12,000**,
while a page's payload is a **component's** v2 serialization. Every mentioned page would have been
cut to half a graph. **The shape a union declares up front is trustworthy; its values are not.**

> ⚠️ **Measure the element you are making a claim about, and print what you measured.**

Session 16's first contrast sweep read **4.58 in light** for a refusal line and nearly filed it — it
was the *danger icon* (a graphical object, 3:1 threshold), because `querySelector('span')` grabs the
first span. The sentence is **7.70 / 7.10**. Third of this shape in two sessions, after session 15's
phantom 71px overflow. **A ratio with no `fg`/`bg` hex beside it is a number you cannot check.**

## The one thing to read before touching the opening turn

> 🔴 **Media placement is a Rule 6 question, not a formatting one.**

An authoring turn is a string with a character `cacheBoundary`. Media cannot be concatenated into a
string, so a turn carrying it converts that offset into a `cache: true` marker — and the *natural*
order (media first, which is what every provider's guidance says and what the planning turn
correctly does) puts a 900KB screenshot **ahead of the breakpoint**. That does not cost the
screenshot: it re-bills the entire AIX-007 stable prefix, uncached, on every operation of every
plan. Nothing on screen changes. The only symptom is the invoice.

`openingTurnWithMedia` places it after. `tests-unit/bld-013/mediaCacheSafety.test.ts` asserts the
marked block's **index**, not just its bytes, and was inverted before it was trusted (4 of 7 red).

## The traps sessions 14 and 15 paid for

> **A rule that was right about its old subject. Six for six this phase.**

Session 15's was the sharpest yet, because the rule was *ours and correct*: BLD-011 gave `.Picker`
`width: 100%` to stop its list opening 113.8px wide. Add two sibling buttons and a full-width flex
item claims the whole line — both siblings pushed to a second row at **every** width, 67px tall even
at 800px where all three fit in 742px. **When you add a sibling to a box, re-read the rules that box
was given when it was alone.**

> ⚠️ **A synchronous measurement sweep lies in this renderer.**

Session 15's first width sweep reported **71px of overflow that did not exist** — it set
`style.width` and measured in the same synchronous loop, and an occluded Electron window clamps
timers ~1000× and never fires `ResizeObserver`. Re-swept with `await` between steps: 0 everywhere.
**Always await ~180ms after changing a size, and confirm the element actually resized.** A defect
reported at one end of a sweep only should be re-run async before you believe it.

> **A ceiling must be round in the unit it is *printed* in.**

`20_000_000` bytes rendered as `"19.1 MB"`, so a user who trimmed a PDF to just under 20MB was told
the limit was 19.1. Assert the rendered string, not the constant.

> **Decide what state the defect would live in, then go and measure that state.**

Three for three now: BLD-004's collision painted only in an unscreenshotted frame; BLD-011's picker
list was only wrong while *open*; session 15's row was only wrong *with siblings present*.

## Driving this panel

The recipe is in handovers 5–16. What session 16 adds:

- ⚠️ **A controlled `TextArea` cannot be driven with `el.value = …`** — React ignores it. Use
  `Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el, v)` then
  `el.dispatchEvent(new Event('input',{bubbles:true}))`. Caret moves want a `select` event, keys want
  `new KeyboardEvent('keydown',{key,bubbles:true})`, and all of it reaches the real handlers.
- ⚠️ **Pick a popup row with `mousedown`, not `click`** where the popup closes on blur: the click
  blurs the input first, so it lands on a menu that has already decided it is shut.
- ⚠️ **To claim a popup costs no layout, measure open against shut at the same width.** "The row is
  30px" is not the claim; "the row is identical with the menu up" is, and it needs both readings.
- **Measure the `test:main` baseline rather than inheriting it.** Session 15 recorded 106/1448 (its
  own commit said 1447); the same 106 suites returned **1452** today. One command settles it:
  `npx jest --testPathIgnorePatterns "/node_modules/" "<your new dir>"`.

What session 15 adds:

- **The whole of BLD-013 is driveable with no billed call.** Construct a `DataTransfer`, add a
  `File`, dispatch a bubbling `ClipboardEvent('paste')` at
  `[class*=BuildThread-module__Composer]` — that runs the real handler through the real resolver.
  Generate a genuine oversized PNG via `canvas.toBlob` so the resize path actually runs.
- **BLD-014's capture needs a sandbox mounted, and the component bench provides one** — click
  `[data-test=preview-scope-chip]`, pick a component. No AI session, no cost.
- ⚠️ **Opening the bench hides the side panel.** Measurements taken then return `0×0` at `x:0` and
  look exactly like a layout defect. Re-click `[data-test=ai-authoring-panel]` first, and check for
  a `display: none` ancestor before believing any zero.
- ⚠️ **HMR did not apply either SCSS change in session 15.** The class was in the DOM from a
  previous edit and the *new* rules were not — computed style still showed the old values. **Check
  `getComputedStyle` against what you wrote before concluding a fix failed**, and restart rather
  than `cdp reload` (still forbidden — it lands `file://` on `chrome-error://`).
- **Theme flips with `document.documentElement.setAttribute('data-theme','light')`**, and a probe
  element carrying a CSS-module class is how you measure a state you cannot reach through the UI.
- **Measure disabled and enabled separately.** `Look at it` reads 3.17:1 disabled (WCAG-exempt) and
  6.66:1 enabled; reporting the first without the second looks like a failure that is not one.

## 🔴 The `test:ci` baseline is 6 *plus an order-dependent BEN-001 trio*

Session 15 hit **9 failures at seed 82196** and had to rule itself out, because it had just changed a
module the bench imports. Re-running **the same commit at seed 97132 gave 6** — the documented set.

```
BEN-001 the component interface, as the bench reads it reads declared inputs off the plug…
BEN-001 …degrades to untyped rather than guessing, for an input wired to nothing
BEN-001 …gives a logic-only component an interface too
```

They fail with `Expected $.length = 0 to equal 2` — the fixture component came back with **no ports
at all**, which is a spec-order effect on `ProjectModel`, not a capability change. ⚠️ Earlier
handovers recorded *"BEN-001 ×3 did not appear at any of the three seeds"*, which is now falsified
rather than confirmed: they appear at some seeds and not others.

**So the rule is: 6 is the floor, and a run showing 9 is not automatically your fault.** Re-run at a
different seed before investigating — and if the trio is reproducible across seeds on your branch and
absent on the previous commit, *then* it is yours.
