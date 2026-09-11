# The testing pass — 2026-09-04

_Richard drove a pre-0.2.2 build and reported nineteen things in a single afternoon, in the order he
hit them. This file is the register: what each one was, what happened to it, and **who owns what is
left**. Nine were fixed the same day; the rest are rows._

🔴 **This file exists so nothing here is rediscovered at full price.** Every unfixed finding below
carries an owner or the literal word `NONE`. A row with no owner is a row somebody pays for twice.

⚠️ **Read a row's FINDINGS, not its status.** Three of these were reported as one thing and turned
out to be another, and two were found by reading the *sibling* of something reported.

---

## §1 Fixed in the same session

All nine are in the working tree, **not committed**. Each was measured twice — the gate green on the
fix, and the same gate red against a reverted arm — because a reading that fits is not a reading
that excludes.

| # | what he hit | what it actually was | readings |
|---|---|---|---|
| 1 | Visual Function errored on its own default | `done` is on `RESERVED_OUTPUTS`; both signal blocks defaulted to it. Now `Output1`, **shared** by define and send so an all-defaults program runs | gate 7/7 `EXIT=0`; reverted `EXIT=1`, 2 specs |
| 2 | the error persisted after he fixed the program | the runtime error bus **raises and never withdraws**; only a viewer reconnect cleared it. A good run now withdraws what is no longer true | 7/7 `EXIT=0`; reverted `EXIT=1`, 3 specs; 496 tests; `tsc` 0 |
| 3 | checkbox would not visually uncheck | the **author's** icon had no `checked` gate at all — FB-020 gated the built-in tick and left this path open | 21/21 `EXIT=0`; reverted `EXIT=1`, 3 specs |
| 4 | — *(not reported)* | **Radio Button had the identical defect**: an author icon drew on every option in the group at once. Found by reading the checkbox's sibling | same suite |
| 5 | "Open project folder" did nothing | it revealed `<dir>/project.json`, which **v2 projects do not have** — the manifest is `nodegx.project.json` and migration deletes the legacy file. `showItemInFolder` is a silent no-op on a missing path | `tsc` 0 |
| 6 | workbench dropdown missed a new component | `getComponents()` returns the **live array** and `addComponent` pushes in place, so React's `Object.is` bail-out discarded every re-read. Reopening worked because a new project model is a new array | ⚠️ **NOT GATED** — see §3 |
| 7 | every icon was white | one shared default fed Icon, Checkbox, Radio and Button. Now black. Text Input and Select had already set black by hand — the same judgement reached one node at a time | 11/11 `EXIT=0`; reverted `EXIT=1`, 3 inheriting nodes; 1156 viewer tests |
| 8 | *(his ruling)* Button icon = label colour | Button is the one node where **no constant works**: `primary` is a filled ground, `outline`/`ghost` are transparent with dark text and were **already invisible**. Ships no default, inherits | 11/11 `EXIT=0`; reverted `EXIT=1` |
| 9 | Hello World and Site Builder in the create modal | both now **held** — registered, not offered | 278 tests, 9 suites; near-miss reintroduced → `EXIT=1` |

### 🔴 §1.1 Two things in that table were wrong before they were right

**Finding 2's first fix ate its own warning.** A refused *signal* send fails inside the
`sendSignalOnOutput` wrapper, which returns from the wrapper and **not** from `_executeLogic` — so a
run that was refused still reaches the success path. Clearing everything there withdrew the warning
raised microseconds earlier. The test caught it; the fix now withdraws only what this run did not
re-raise.

**Finding 9 nearly broke every blank project.** `hello-world` was first deleted from the registry
outright, on the reasoning that nothing imported it. That was true of the *symbol* and false of the
*id*: `DEFAULT_PROJECT_TEMPLATE` is `'embedded://hello-world'` and `resolveTemplateUrl` returns it
whenever no template was chosen — so it is the source of every **blank** project, and deleting it
would have made *Quick Start* throw `Unknown embedded template` while the shelf looked correct.
Richard had said so himself — *"I start a blank app and that has the hello world thing"* — and it was
read as description rather than dependency. It is now **held, not removed**, and
`template-needs-backend.test.ts` reddens if anyone tries again.

### ⚠️ §1.2 D1's premise was false, and this is where it was false

Richard's D1 (2026-09-04) held the site builder from 0.2.2 believing *"holding costs no action — it
is not in `templates/` and has never been staged for publication."* True of the community shelf, and
false of the editor: it sat in `EmbeddedTemplateProvider`'s map and `list()` returned the whole map,
so **every 0.2.2 user would have been offered the held template in the create wizard.** Holding costs
exactly one line — `HELD_TEMPLATE_IDS` — and that line now exists. Phase 77 unholds it by deleting
one string.

---

## §2 What is left, and who owns it

### §2.1 Rows opened on this board

| row | what | why it is 0.2.2 |
|---|---|---|
| [REL-012](REL-012-THE-LESSONS-NOBODY-RECEIVES.md) | the lesson bundles ship in no artefact a user receives | 🔴 **blocks** — a fresh install opens Learning empty |
| [REL-013](REL-013-THE-TEMPLATES-TAB.md) | the launcher Templates tab is still a placeholder | the create modal already reads the registry; the tab reads nothing |
| [REL-014](REL-014-THE-VALUE-THE-FIELD-DESTROYS.md) | a `var()` value is destroyed by touching its field | **data loss**, unrecoverable through the UI |
| [REL-015](REL-015-THE-SHELVES-YOU-CAN-FILL.md) | People self-listing, and publishers for replays and tutorials | Richard has the content and no way to put it anywhere |

### §2.2 Already owned elsewhere — **do not open a duplicate row**

| finding | owner | evidence |
|---|---|---|
| the token **picker** is built and mounted nowhere; the Design Tokens panel is `devMode`-gated | 🔴 **FIX-015's successor phase** (green-lit, not yet created) | [FIX-015](../phase-66-0.1.7-bug-fixes/FIX-015-THE-TOKENS-NOBODY-CAN-EDIT.md) is a **ruled scope** with eight rulings; its slice 1 is exactly this. REL-014 takes only the *data-loss defect*, which FIX-015's gap list A–J does not name |
| Community chat has no composer in the editor | **FB-013**, phase 75 | its board row already reads *"The launcher composer is unbuilt; free tags are unruled"* |
| default tutorial **content** | **FB-012**, phase 75 | blocked on Richard's brief, rolls forward on purpose |
| the empty template shelf | **FB-005**, phase 75 → closes on **REL-001** | the shelf is real and empty; publishing the members' area is what fills it |

### 🔴 §2.3 Unowned — owner `NONE`

These are real, they are recorded, and **nobody is going to do them** until someone claims them.
They are listed so that fact is visible rather than implied.

| finding | shape | owner |
|---|---|---|
| **Circle → a Shape/SVG node** — premade shapes plus pasted SVG. Richard: *"you'd be a hero"* | a plan exists and is in [NOTES-UNOWNED-NODE-WORK](NOTES-UNOWNED-NODE-WORK.md); **extend in place, no migration** | `NONE` |
| **Video node** — mp4 only; no YouTube or Vimeo anywhere; no start/end time | plan in the same notes file; mp4 start/end is **half built** already | `NONE` |
| **Dropdown** places invisible with no options; wants two defaults and a beginner JSON mode | research incomplete — the one agent that did not report | `NONE` |
| ~~**Filter properties bar** — ~59px tall, and its field has no border and no fill, so contrast against the panel is **1.00:1**~~ 🔴 **This row was FALSE from `645c3922` onward and still read as open here.** Struck in [NOTES §4](NOTES-UNOWNED-NODE-WORK.md) by s53 and not in this register, which is the second place it had to be struck | fixed under `input.property-filter-input` (`propertyeditor.css:349`) and graded by `nat-001/palette-contrast.spec.ts`'s last `PAIRS` row | ✅ done |
| **"Add style variant" vs "Style → Variant"** — two genuinely different systems, emitted adjacently with no separator | one test asserts the literal port name `'Variant'` | `NONE` |
| ~~**Button `outline`/`ghost` icons** were invisible before §1's fix and are now correct *by inheritance* — but no gate pins the variants themselves~~ ✅ **CLOSED 2026-09-05 (s55) — §5 below.** ⚠️ The shape said *five* variants; there are **six** | ~~a render-level gate over all five variants~~ built, and the population is read from the registry so a seventh cannot ship ungraded | s55 |

---

## §3 ✅ CLOSED 2026-09-05 (s46) — the one fix that was not gated now is

**Finding 6 (workbench dropdown) has a gate**: `packages/noodl-editor/tests-unit/ben-004/previewScopeMenuRead.test.ts`,
**13 tests, EXIT=0**, and it reddens against both halves of the fix reverted.

### 🔴 The reason it was written off was right about the conclusion and wrong about the cause

The row below said the blocker was the missing dependency. **Measured, it is not.**
`PreviewChrome.tsx` cannot be graded by this runner for a blunter reason: it imports
`@noodl-core-ui/components/common/Icon`, and ts-jest rejects that file's `require.context` call
outright — `Icon.tsx:207`, `TS2339: Property 'context' does not exist on type 'Require'`. The module
**fails the suite to run**, so `@testing-library/react` would not have helped; it is the registered
`Icon` trap, hit a third time. A probe measured both sides in one run before anything was written:
`previewScope.ts` imports clean (17 exports), `PreviewChrome.tsx` returns that error and **zero**
exports.

### ✅ What closed it: the decision was never in the rendering

*"What list does the menu read when it opens"* is a function from a getter to an array. It moved to
**`previewScope.readMenuComponents`** — a module whose only import is one type constant — and
`open()` calls it. That is the standard move for this runner and it is what makes the fix
gradeable without a DOM, without React and without opening a menu.

| § | what it grades | reverted arm |
|---|---|---|
| §1 | **the premise** — a model shaped exactly like `ProjectModel` (`getComponents()` returns `this.components`, `addComponent` pushes in place) hands out **one object** across two reads | *known-firing control* — reads `true` today; a `false` here means ProjectModel started copying and §2 is holding a property the product no longer needs |
| §2 | **the fix** — the read is not the live array, each open has its own identity, and each snapshot is of **the moment it was taken** | Arm A (`return getComponents()`): **5 red of 13 that all ran** |
| §3 | **the symptom** — Richard's bug reproduced through the real `benchTargets` behind a faithful `useMemo` (`Object.is` per dep): the live-array arm computes **once**, and `/Cards/New` is **not in the menu** | same arm |
| §4 | **the wire** — `open()` calls it, read off source with comments stripped | Arm B (`setComponents(getComponents())`): **2 red of 13 that all ran**, EXIT=1 |

🔴 **§4 is the source-level row the commit warned about, and the warning was answered rather than
waved through.** The fix's own prose quotes `setComponents(getComponents())` — the reverted form —
so a raw text match would have passed on the *documentation* of a change that had been undone. Two
arms prove the strip is load-bearing rather than decorative:

- **Arm C1** — the reverted line named in `open()`'s comment, fix in place: **13/13, EXIT=0**.
- **Arm C2** — `stripComments()` removed from the spec's own reader, nothing else changed:
  **exactly 1 red of 13**, and it is *"open() does NOT hand the live array straight to
  setComponents"*. The comment alone reddens the gate the moment the strip goes.

**13 total in every arm** is what says each one graded something rather than failing to compile.

⚠️ **What this still does NOT establish.** No menu was opened. This holds the identity contract and
the wire; it cannot see focus, the search field, the scroll, or whether the row is clickable. A
drive against a real editor would still be worth its cost — it is just no longer the *only* thing
that could close this.

### The row as it stood

> Finding 6 (workbench dropdown) is **fixed and ungated**. `@testing-library/react` is not installed in
> this repo, so the menu cannot be opened and read in a spec, and a second editor cannot be launched
> while Richard's is running. A source-text assertion was deliberately **not** written — it would pass
> on dead code.
>
> **What would close it:** a drive against a real editor — create a component, open the scope chip,
> read the menu — or `@testing-library/react` as a dev dependency, which would also unblock the
> several other launcher views that currently have no render coverage.

⚠️ **`@testing-library/react` really is absent** — the tree has `@testing-library/dom`, `jest-dom`
and `user-event`, and no package declares the React binding. That half of the row was true; it was
simply not the thing standing in the way.

---

## §4 What this pass says about the instruments

Three findings were invisible to green suites, and each was invisible for the same reason: **the
suite only ever saw the arm that works.**

- FB-020 has six specs on the checkbox and every one is either iconless or already checked, so the
  author-icon path had no case at all.
- The site-builder shelf had 226 green specs and none asked *what does `list()` return in a shipped
  build*.
- The Blockly palette had specs on every block's behaviour and none on its **default**.

✅ The three gates written this session are all **population-derived** rather than list-based: the
block-defaults gate reads `Blockly.Blocks`, the icon-colour gate counts `addIconInputs` call sites on
disk, and the template gate distinguishes *held* from *removed* by asking the provider both
questions about the same id. A node or block added next month is inside all three the day it lands.

## §5 ✅ CLOSED 2026-09-05 (s55) — the Button variants are gated, and the gate is the product's own chain

**`packages/noodl-viewer-react/tests/corpus/p82-button-icon-inherits-every-variant.test.ts` — 39 tests, `EXIT=0`.**

### The hole was between two green gates, and neither could see it

Finding 8's fix is *"ships no default, inherits"*, and two gates already stood either side of it:

| gate | what it holds | what it cannot see |
|---|---|---|
| `noodl-viewer-react/tests/icon-colour-defaults.test.ts` §3 | Button ships **no** `iconColor` default, and `_renderIcon` emits no `color` when the author set none | it renders a Button carrying **no variant at all** — it says nothing about the grounds a real Button lands on |
| `noodl-editor/tests-unit/def-001/design-token-contrast.test.ts` | every variant's `color` against every ground, in every shipped palette, states included | it reads `ButtonConfig` and **renders nothing** |

So DEF-001 proves the variant's foreground is visible on its ground, and `icon-colour-defaults`
proves the glyph takes the button's colour *in one implicit case*. 🔴 **The link between them — that
a Button stamped with variant V really does hand its glyph V's colour — was what nothing held**, and
that link is the entire content of *"correct by inheritance"*. Break it and both gates stay green
while `outline` and `ghost` go back to the invisible icon Richard reported.

⚠️ **No contrast is computed in the new file.** That is DEF-001's instrument, and a second copy of it
would be two readings that can disagree — the standing *"a check in a second pipeline is a duplicate
first"* trap. This one grades **identity**: the glyph's colour *is* the button's.

### It exercises the chain rather than modelling it

```
ButtonConfig.variants[v]
  → ElementConfigRegistry.applyVariant(...)   what a variant click actually stamps
    → node.parameters                          camelCase CSS keys on the node model
      → the `color` inputCss port              targetStyleProperty: 'color' → setStyle
        → noodlNode.style → props.style        react-component-node's props assembly
          → <button style="color:…">           Button.tsx
            → <span class="fa fa-check">       IconGlyph, carrying NO colour of its own
```

A real node in a real graph (`createCorpusGraph`), rendered by its own `render()`. The markup a
`primary` Button actually produces is
`<button … style="…color:var(--primary-foreground)…"><span class="fa fa-check"></span></button>` —
the glyph has **no `style` attribute at all**, which is the fix, seen rather than asserted.

### 🔴 The row asked for five variants. There are six.

`primary`, `secondary`, `outline`, `ghost`, `destructive`, `link`. §1 reads the population from
`ElementConfigRegistry.getVariantNames` — the same call the VariantSelector UI makes — so it is
derived, not listed, and it carries a `length > 0` control because `all([])` is the answer you
wanted.

### Five reverted arms, and they redden on different rows

| arm | mutation | reading |
|---|---|---|
| green | — | **39/39, `EXIT=0`** |
| A | `iconColor: '#FFFFFF'` back in `button.ts`'s `addIconInputs` defaults — **the defect exactly as it shipped** | **6 red of 39 that all ran**, §3's inheritance rows |
| B | `iconStyle.color = props.iconColor` deleted from `_renderIcon` | **6 red of 39**, §4's rows — an author's own Icon Color silently dropped |
| C | that line made `props.iconColor ?? '#FFFFFF'` — a constant at the render site instead of the port | **6 red of 39**, §3's rows |
| D | `ghost` loses its `color` in `ButtonConfig` | **2 red of 39**, §2 and §3 for that variant only |
| E | a seventh variant `subtle` added to the config | **39 → 45 tests**, the six new rows graded automatically and **exactly 1 red** on §1 |

🔴 **B and C are the discrimination pair.** Both remove a colour from the glyph and they redden
**opposite** sections — without §4, *"the glyph declares no colour"* would read identically on a
`_renderIcon` that had stopped emitting colour at all, and the gate would have called an author's
dropped choice a pass.

🔴 **Arm E is what proves the population is derived rather than listed.** A listed table would have
stayed at 39 tests and graded the seventh variant not at all, silently. All three mutated sources
(`button.ts`, `Button.tsx`, `ButtonConfig.ts`) restored **md5-identical** after every arm.

### Readings

`noodl-viewer-react` **98 suites / 1322 tests, `EXIT=0`** (the new file is the only delta: 97/1283
without it), and `tsc -p noodl-viewer-react` **`EXIT=0`, 0 errors** — gated on the exit status, not
on a count of error lines.

### ⚠️ What it still does not establish

- **Hover and disabled are not rendered.** `outline`/`ghost` swap to `--accent-foreground` on hover
  and the runtime applies visual states through CSS classes, not inline style, so a static render
  cannot reach them. DEF-001 *does* grade those pairs' contrast (`…/outline:hover`), so what is
  unheld is the inheritance at hover, not the colours.
- `context.styles.resolveColor` is stubbed as identity. The real one resolves a project colour style
  *name*; a `var(--token)` passes through it unchanged, which is what every value in `ButtonConfig` is.

---
