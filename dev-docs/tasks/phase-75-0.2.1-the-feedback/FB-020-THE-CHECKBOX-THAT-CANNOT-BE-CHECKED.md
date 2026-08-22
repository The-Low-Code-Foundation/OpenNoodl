# FB-020 — the checkbox that cannot be checked

**Filed:** 2026-08-22, Richard + independently by the test user (Jordan, session 2 §7).
**Status: ✅ done 2026-08-22** (AC1–AC4, driven). Size: S/M. ⚠️ Do not file as "intended":
Jordan concluded *"by default boxes are not checkable"* — the code says otherwise; a fresh
checkbox is **meant** to toggle on click.

> 🔴 **The ranked hypothesis list below was wrong, and wrong in an instructive way — read the
> Done section first.** Every candidate assumed the click was being swallowed. It was not: the
> click always worked. What was missing was anything that *draws* a tick. The premise that sent
> the ranking off — "a click that reaches the input visibly ticks the box regardless of the
> node" — is false, because the real `<input>` is `opacity: 0`.

> Richard: *"I add it to a page, 'enabled' is true, I click it in preview mode (not design)
> and it doesn't check, no reaction."*

---

## What the code says (read 2026-08-22) — the component should work, which is the clue

- `Checkbox.tsx:31–41,109–117`: the component keeps **local state** and the `<input>`'s
  `onChange` sets it before telling the node — so a click that *reaches the input* visibly
  ticks the box regardless of the node. `enabled` initializes true
  (`controls/utils.ts:325`), so the disabled path is ruled out.
- Therefore "no reaction at all" means **the click is being killed before the input**, or the
  tick is being reverted the same frame. Candidates, ranked:

1. **Inspect-mode listeners live during preview** (prime suspect). Design mode registers
   capture-phase listeners on `document` that `stopPropagation()` **and `preventDefault()`**
   on click (`inspector.ts:56–71,109–124`). `preventDefault` cancels the native toggle *and*
   the stopped propagation never reaches React's root listener → no `onChange` → controlled
   input reverts: **zero visible reaction.** If `setInspectMode(false)` fails to disable (or a
   second Inspector instance leaks), every control in the preview dies this way after design
   mode is visited once. Discriminators: is the cursor `crosshair` over the app? does clicking
   the checkbox *select its node in the editor*? does a fresh editor session that never enters
   design mode have a working checkbox?
2. **An ancestor eats the event** — a parent with `blockTouch` (`pointerlisteners.ts:95–114`
   stopPropagation on all 16 events) between the page and the box; same React-revert
   consequence. Discriminator: a checkbox as the page's direct child.
3. **Same-frame revert on remount** — see the latent bug below; only matches if something
   remounts on interaction.

## 🔴 A latent bug to fix regardless of which candidate wins

`checkbox.ts:39–47` (`checkedChanged`, the user-click path) updates `_internal.checked`, fires
outputs and visual state — but **never writes `this.props.checked`**, unlike the `checked`
input setter (`:63`) and `setCheckedByAction` (`:177`), which both do. The visual survives
only as the component's local state; **any remount** (Mounted toggled, navigation, a parent
re-key) silently reverts the box to the stale prop while the node's output still says `true` —
the graph and the screen disagree. One line; radio button (`radiobutton.ts`) likely shares
the shape — check it in the same pass.

## Plan

1. Reproduce in the running editor (⚠️ a peer has held it — ask): fresh project, one
   checkbox, preview, click. Run the three discriminators above; read
   `document.querySelector('input[type=checkbox]').disabled/.checked` and dispatch a real
   click via CDP. Diagnose from what actually happens, not from this file's ranking —
   the ranking is a hypothesis list, not a finding.
2. Fix the cause; fix the `props.checked` desync either way; sweep radio/button/text-input
   for the same swallowed-click behaviour (if candidate 1 is it, they are all dead too —
   which is also the strongest evidence *for* it).
3. Spec: the component's controlled/local-state contract (jest can grade the component here);
   the desync gets a remount assertion. The click-path can only be graded by the drive —
   record the observation before driving (verify the consequence, not the mechanism).

## Acceptance criteria

- AC1: a fresh checkbox on an empty page toggles on click in preview, `Changed` fires,
  `Checked` output reads true — driven.
- AC2: leaving design mode provably restores interactivity (enter design mode, leave, click —
  asserted in the drive; if candidate 1 was the cause, this is the regression test).
- AC3: after a remount, the box renders what the `checked` output reports (desync fixed).
- AC4: radio button checked for the same desync shape; fixed or recorded clean.

---

## Done — 2026-08-22

**The click was never broken. Nothing drew a tick.**

Driven in the real editor on a purpose-built fixture (`fb020-drive`, then `fb020b-drive` for the
fix). A real trusted CDP click on a bare default checkbox produced:

| measurement | before the fix |
|---|---|
| `input.checked` | **true** |
| `_internal.checked` | **true** |
| `Checked` output, read through a connected Text node | **`false` → `true`** |
| the box on screen | **pixel-identical, byte-for-byte** |

Three things all have to be off at once for that to happen, and on a fresh node all three are:

1. `assets/style.css:87` — `.ndl-controls-checkbox-2 { opacity: 0; position: absolute }`. The
   real `<input>` is invisible, so it can never be the mark. **This is what falsified the whole
   candidate list**: every candidate was a way for the click to be swallowed, and the click was
   landing.
2. `Checkbox.tsx` `_renderIcon()` returns `null` unless `iconIconSource !== undefined`, and
   `addIconInputs` (`node-shared-port-definitions.ts:1348-1355`) ships **no default source** —
   `useIcon` defaults true and `iconSourceType` defaults `'icon'`, which together get you as far
   as an icon slot with nothing in it.
3. `_updateVisualState()` → `setVisualStates(['checked'])` → `getParametersForStates(...)`
   (`react-component-node.ts:1713`) applies only parameters an **author has already configured**.
   A brand new node has none.

**The control that made this a measurement rather than a story.** The fixture carried a second
checkbox with `stateParameters: { checked: { backgroundColor: '#FF0000' } }`. The same click
turned it red. So the visual-state machinery is alive and firing; the bare box's stillness is a
missing *default*, not a broken *mechanism*. Without that arm beside it, "nothing happened" is
equally consistent with the mechanism being dead.

**Not our regression.** `style.css` carries this from `b9c60b07`, the initial commit — inherited
from upstream Noodl. The *deprecated* checkbox it replaced had a visible checked state
(`.ndl-controls-checkbox:checked { background-color: #000 }`); the "new" one moved styling to the
wrapper, delegated the mark to an icon, and shipped no icon.

### What changed

- `Checkbox.tsx` — `_renderDefaultCheck()` draws an inline SVG tick when the box is checked and
  the author has supplied no icon of their own. An author icon, an author image, or Enable Icon
  turned off all still win.
- `RadioButton.tsx` — **AC4 found the same defect from the other side.** `fillColor` ships no
  default and `initialize` sets `props.styles.fill = {}`, so the dot was
  `backgroundColor: undefined` and a fresh radio looked identical selected or not. It was also
  painted on *every* button in the group at once, so an author who set `Fill Color` as a plain
  parameter got a filled dot on every option; only setting it on the checked visual state ever
  worked, and nothing said so. The dot is now drawn only for the selection.
- `checkbox.ts` — the `props.checked` desync, fixed as planned.

⚠️ **The trap inside the fix.** Borders are stored **per side** — `borderTopColor`, never the
`borderColor` shorthand. The first version read the shorthand, got `undefined`, and fell through
to `currentColor`: black on this page, **invisible on a dark one**. It looked correct in the
drive and in the first spec run. Caught only because the radio's dot — which has no `currentColor`
to fall back to — stayed unpainted and forced the question.

### Acceptance criteria

- **AC1 ✅** A fresh checkbox on an empty page toggles on click in preview, `Changed` fires,
  `Checked` reads true — and now *shows* a tick. Driven, before and after.
- **AC2 ✅ — but the premise was wrong.** Design mode never had anything to do with it. The
  Inspector's capture-phase `preventDefault` (`inspector.ts:56-71`) is real and would do what the
  candidate described, but it was not what either user hit: the click worked in a session that
  entered design mode and in one that never did. **No regression test for a leak that was not
  happening**; the discriminators are recorded above so a future report of *genuinely* swallowed
  clicks can be told apart from this one in a single measurement.
- **AC3 ✅** `props.checked` and `_internal.checked` agreed after a click in the re-drive
  (`{internal: true, props: true}` on all three boxes). The consequence is worse than a stale
  pixel and is worth keeping in mind: on a remount the component re-seeds from the stale `false`,
  and because `_internal` was still `true` the **next click computes `changed` as false and fires
  nothing at all** — a box ticked once could go permanently quiet.
- **AC4 ✅** Radio button checked and **fixed, not recorded clean**. It has no `props.checked`
  desync (`checked` is derived from group context on every render, so there is nothing to fall out
  of step) but it had the appearance defect and the paint-every-button defect described above.

### Specs

`packages/noodl-viewer-react/tests/fb-020-checkbox-shows-its-state.test.tsx`, 14 tests, rendering
the real components through `renderToStaticMarkup` (this package's jest is `testEnvironment: node`,
but hooks render fine server-side, so no helper extraction was needed).

🔴 **Two of them originally passed on the unfixed code.** "Draws the tick in the border colour"
and "fills the dot with the border colour" asserted the colour against the *whole* markup — and
the wrapper's own border carries the very same value, so the assertion was satisfied whether or
not a mark was ever drawn. Both are now scoped to the mark's own element. Verified by reverting
all three fixes and re-running: **4 red before the tightening, 6 red after.** The other 8 are
regression guards that are meant to hold both ways.

Full viewer suite after the change: **945 passed / 74 suites**. `tsc -p packages/noodl-viewer-react
--noEmit` exits 0 (run unpiped — a pipe would have reported the exit code of `tail`).

### Fixtures left on disk

`fb020-drive` (the diagnosis: bare / visual-state control / labelled) and `fb020b-drive` (the fix:
A bare, B author checked-state, C Enable Icon off, D bare radio group, E author fill colour — B, C
and E are the regression arms). Both are in the launcher's recent list because the editor genuinely
opened them.
