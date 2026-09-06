# What the hell is a "border sweep"?

_Written 2026-08-28, because I'd used the phrase in about forty handover notes without ever saying
what it meant._

## The one-paragraph version

Buttons and text boxes in the editor are drawn with a thin outline. The design system has **two
greys for lines**: a *divider* grey, deliberately almost invisible, for hairlines between panels;
and a *control* grey, deliberately visible, for the edge of something you can click. A lot of
buttons and input boxes were drawn with the **divider** grey by mistake — so they had, in effect,
no edge at all. The "sweep" is going through the app one screen at a time, finding those, switching
them to the right grey, and locking each fix with an automated test.

## Why it's a real bug and not fussiness

There's an accessibility rule — WCAG 1.4.11 — that says the edge of anything you're expected to
identify as a control must be at least **3 times** the brightness of what's behind it.

The ones we've been fixing measure **1.07**. For scale:

| ratio | what your eye sees |
|---|---|
| 1.0 | literally the same colour — no line at all |
| **1.07** | what these buttons had |
| 3.0 | the minimum the standard allows |
| 4.17 | what they measure after the fix |

A button at 1.07 doesn't look like a button. It looks like a piece of text that happens to be
clickable. In today's batch, one of them — the "Dismiss" button on the styling suggestion card —
had **no background fill either**, so its nearly-invisible outline was the *only* thing on screen
saying "this is a button".

## Why not just find-and-replace all of them?

I've been asked this, and the honest answer is that a blanket replace has been wrong in **four**
separate ways, each found by doing it carefully:

1. **Some lines are supposed to be invisible.** The hairline between two panels is a divider doing
   its job. Sweeping those too makes the app look like a spreadsheet. There's a test in every batch
   whose entire purpose is to fail if I over-correct.

2. **Hovering is a separate rule.** Fixing a button's resting state while leaving its hover state
   alone means the outline gets *worse* the moment you point at it — visible at rest, invisible
   under the cursor. A find-and-replace does exactly this, silently.

3. **The same button sits on different backgrounds.** A grey that's clearly visible on a dark panel
   can be nearly invisible on a lighter card. Each one has to be measured against the surface it's
   actually on — which today meant tracing a button through three files into a *different code
   package* to find out what colour was behind it.

4. **Today's find was one I'd have missed entirely:** a button's outline was defined as a *blend*
   of two colours — "40% blue, mixed with the divider grey". Fixing the plain cases would have made
   this one **worse than before**: the button's edge would have got fainter at the exact moment you
   selected something in it. It's invisible to any search for the obvious pattern, because the bad
   colour is buried inside a formula.

## What "locking it with a test" means, and why it takes the time it does

Each fix comes with an automated test that reads the actual stylesheet, works out the real colours,
and does the contrast arithmetic. If someone reverts the fix later, the test fails with a number.

Then — and this is the part that takes the time — I **deliberately break my own fix**, one way at a
time, and check the test actually catches it. A test that passes proves nothing on its own; a test
that fails when you sabotage the thing it's watching is a test that works. Today that was 12
deliberate breakages plus 2 controls. Nine were caught. The five that weren't were *predicted* not
to be, for reasons written down in advance.

One of those sabotage runs is the reason I trust today's batch: I broke a helper the test depends on
and the test **stayed green** on a genuinely broken button. That's exactly the kind of quietly
useless test this codebase has been bitten by before, and the only way to find it is to try.

## Where it stands

- **Started from** a list of ~57 suspect places.
- **35 left.** The shared component library is finished as of today.
- Roughly **two in three** of the problems found weren't on the list at all — the list was built by
  searching for a pattern, and it can't see, for example, a plain text input, which never matches
  that pattern. So the list is a floor, not a to-do list, and each screen gets read properly.

## What it needs from you

Nothing, except **the red delete-button question** in
[YOUR-DECISIONS.md](YOUR-DECISIONS.md) — that one's a palette change affecting seven screens, so
it's yours rather than mine.
