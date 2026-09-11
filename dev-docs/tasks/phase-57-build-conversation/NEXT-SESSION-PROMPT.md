# Next-session prompt — phase 57, after session 18

Paste everything below into a fresh session.

---

You are picking up **phase 57 (BLD — the Build panel as a conversation)** on `cline-dev` in
`/Users/richardosborne/vscode_projects/OpenNoodl`.

Read `dev-docs/tasks/phase-57-build-conversation/HANDOVER-SESSION-18.md` first, then `TASKS.md`.

NB: there are several parallel sessions fixing minor bugs who may take the editor from time to time.
Just set a timer for 10 mins and wait to check when it frees up. Don't complain about the other
sessions and their commits, just be patient and get the job done. We don't need super clean commits.

## 🔴 Do these checks before anything else

1. **`git log` *and* `git status` — every session since 7 has run beside a sibling.** An inherited,
   uncommitted set has now survived **eleven** sessions and is **not yours**: `dev-docs/tasks/phase-17-noodl-learn/`,
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

**15 of 17 fully built. Every *feature* in this phase is built.** ⚠️ The running total was off by
one for several sessions because each one added to the last one's number. **Count it off the tables
in `TASKS.md`.** Track A is 10 of 11 (only BLD-010); Track B is 5 of 6 (BLD-015, deferred).

⚠️ **Read `packages/nodegx-render-measure/src/index.js`'s header before touching it.** It records
the two rejected F22 options and the one rule the package exists to hold: **no `require` in it,
ever.** A single `require('path')` would not fail a typecheck, would not change a number, and would
silently put Node in the renderer bundle. Two specs bite on it.

## What is actually left

| | What | Notes |
|---|---|---|
| **BLD-010** | acceptance pass | The phase's exit test, and **its debt list is now fourteen** — see below. One of the fourteen is a *defect in shipped behaviour* rather than an unverified criterion; do that one first. |
| **BLD-015** | web search | 🔴 **Deferred, not open.** Richard was asked to choose Tavily or Brave in session 17 and chose neither; it needs him to sign up and pay for an account. **Do not re-ask it as an open question every session.** |

### 🔴 Start with R6 — AIB-003's saved plan is never restored

Found in session 18 while driving BLD-009, and **confirmed three ways** (statically, empirically
with a valid on-disk snapshot, and against the shipped parser so the fixture is ruled out):

`ProjectAuthoringView` has exactly one mount site, gated on `turn.id.startsWith('plan-')`. A plan
turn exists only when `planSession.plan` is non-null. The effect that reads
`.nodegx/plan/session.json` is **inside that view**. *The only thing that can restore a plan is a
component that mounts only once a plan has been restored.*

It is **BLD-001's B6 one instance later** — B6 hoisted the AIX-012 *launcher* handover into
`adoptScopePlan`, and left the sidecar restore (and the `docs/decisions/000-initial-scope.md`
recovery offer beside it) behind in the same effect.

⚠️ **Read BLD-009's R6 section before touching it.** Hoisting the restore is mechanical, but the
other half of that effect renders an *offer*, and **fixing half makes the other half permanently
dead rather than conditionally dead** — the panel's `consultSavedBuild` would answer first every
time. Deciding where a second offer lives (beside BLD-009's own, in the one `notice` slot) is the
actual work.

### BLD-010's list is fourteen

BLD-004's **R4** and **R5**; BLD-006's **R12**; BLD-017's **F2** and **F4**; BLD-008's drafting turns
+ restart-resume; BLD-011's **R9**; BLD-013's drag-and-drop and file-picker paths; BLD-014's
on-screen staleness and its *"agent names a responsive defect"* criterion; BLD-016's `get_component`
consequence and its `collection` leg; and new from session 18 — **BLD-009's live-candidate Accept
check** (the mechanism is verified — the expanded document is not one of `decisionOwner`'s candidate
ids, and `AuthoringCandidatePane` has zero controls by grep — but the *state* needs a billed run)
and **R6 above**.

## 🔴 Three rules session 18 paid for

> **A sweep that does not move the element is a green result about nothing.**

The first width sweep reported 0 overflow at all seven widths — and the thread was **364px at every
one of them**, because `style.width` went on an element that does not size the panel. It is a **CSS
custom property on the `FrameDivider` root** (`--frame-divider-<id>-container-1-width`). **Print the
achieved size beside every swept value.** ⚠️ And `removeProperty` on that variable does not restore
it — the FrameDivider is its only writer, so the panel collapses to 24px and the next measurement
looks like a catastrophic layout defect. Set it back to a number.

> ⚠️ **A contrast probe must start at the element itself, not its parent.**

A control paints its own ground; walking up from the parent reads the box *behind* the button. Cost:
the dismiss control read 7.10 light when it is **6.54**. Fifth of this family in four sessions.

> ⚠️ **`flex-wrap` wraps a line before it shrinks the items on it.**

A `flex: 1 1 auto` paragraph with long content claims the whole line and pushes a 14px sibling icon
onto one of its own — `min-width: 0` does not help, because shrinking happens only *within* a line
already formed. Cost 113px for a one-line offer; grouping icon and text into one flex item made it
91px.

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

## 🔴 The `test:ci` baseline is 6, and the BEN-001 cluster is SIX, not three

The documented six — **AI model registry ×2, AIX-006 style vocabulary ×4** — appear at every seed.
On top of them sits an **order-dependent BEN-001 cluster** that appears at some seeds and not
others. Session 17 established the cluster is **six specs, not the "trio" earlier handovers named**:
three in *"the component interface, as the bench reads it"* and three in *"the harness export"*, both
reading the same fixture and all failing with the same signature (the component comes back with no
ports at all). Which of them you see depends on how many of those describes ran after whatever
poisons `ProjectModel`.

**So: 6 is the floor, 9 and 12 are both reachable, and neither is automatically your fault.**
Session 18 saw **9 at seed 82776** — the six plus the *"harness export"* three, matched by name.

**The rule: match the failures BY NAME, then re-run at a different seed before investigating.** If a
cluster is reproducible across seeds on your branch and absent on the previous commit, *then* it is
yours. ⚠️ **Do not diff the spec count** — it moved 2596 → 2632 purely because a sibling's
*uncommitted* Jasmine specs are wired into two `index.ts` barrels.
