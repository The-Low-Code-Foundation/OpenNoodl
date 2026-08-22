# FB-020 — the checkbox that cannot be checked

**Filed:** 2026-08-22, Richard + independently by the test user (Jordan, session 2 §7).
**Status: ⬜ open — a real bug, reproduced by two users; root cause needs one editor drive.**
Size: S/M. ⚠️ Do not file as "intended": Jordan concluded *"by default boxes are not
checkable"* — the code says otherwise; a fresh checkbox is **meant** to toggle on click.

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
