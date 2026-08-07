# SPR-004: Record's dead end

| Field | Value |
|-------|-------|
| **ID** | SPR-004 |
| **Phase** | 42bis — The alpha driving sprint |
| **Tier** | 2 |
| **Findings** | F90, F91 |
| **Measured** | 2026-08-06 against `91fcd680` |
| **Branch** | commit directly to `cline-dev` |

## Objective

Record is phase 36's observability work reaching the canvas. Driven for the first time by
someone building an app, it produced two findings: it broke, and when it worked it went
nowhere.

## §1 — F91: nodes fire, and then what?

**Richard:**

> *"When I'm doing 'record' and I'm watching the nodes fire, there should be a clearer
> link to go to the provenance tab to see the results, otherwise the UX is just 'ok, it
> shows me which nodes fire, nice, now what'"*

This is the more important of the two, and it is a design finding rather than a bug.

The Record button sits bottom-right on the canvas (visible in his screenshots). The
provenance walk lives in a **different panel**, reached from the left rail. Nothing
connects them: the moment the recording has something to show is the moment the user is
looking at the canvas, and the affordance to go and look is on the other side of the
window with no relationship to what just happened.

**Wanted:** from the recording control, a route to the results — the count of what was
captured, and one click to the provenance view of it. The end of a recording is a moment
with an obvious next action, and the product currently has no opinion about it.

⚠️ **Read the HUD decision before designing.** `TALK-003` settled the recording HUD's
shape, and it carries a constraint that is easy to violate here: **an agent's
`start_trace` destroys a human's recording.** Whatever this adds must not widen that.

Related, already known and **unfixed**: `OBS-003`'s live-drive notes record that the
HUD's one-shot states passed in **dark theme only**. Check light theme as part of this.

## §2 — F90: the provenance pane sticks on a preview warning

**Richard:**

> *"The recording thing broke at one point. I wanted to test a Create Record node, and I
> was on the same page as what was in the canvas, but the left provenance menu is now
> stuck on a warning message about instantiating the preview"*

**Status: reported, not reproduced.** The stack was stopped before this could be driven.

What is known from phase 36: provenance delivery is **queued, not a call stack**
(`OBS-001`), and `cause` **prunes** the tree (`OBS-002`). A pane that is "stuck" on a
warning is therefore as likely to be a delivery-ordering problem as a rendering one.

⚠️ **This one has a specific trap attached, and it has already cost this project an
hour.** From the ALPHA-001 driving notes:

> *An occluded preview repaints late; reading its DOM is not measuring the graph. The
> Counter read 5 while the DOM read 0.*

and

> *An occluded Electron window clamps timers ~1000×.*

Richard's report says he *"was on the same page as what was in the canvas"* — i.e. he had
made the preview current, which is exactly the state where these interact. **Do not
diagnose this by reading the preview's DOM.** Drive it with the preview genuinely
visible, and pace anything scripted with `MessagePort`.

Reproduction to attempt: open a project with a backend, put a Create Record node on the
canvas, start Record, exercise the node from the preview, then open the provenance pane.
Note whether the warning is stale (recording succeeded, pane never re-rendered) or live
(the pane genuinely never received a trace).

## Acceptance criteria

1. F90 reproduced and its mechanism named, or **explicitly recorded as not reproducible**
   with what was tried — a phase that quietly drops an unreproduced report is how F62
   happened.
2. A route from the recording control to the captured results, in one click.
3. Driven in a real editor, in **both themes**, with the preview genuinely visible.
4. `TALK-003`'s constraint re-checked: nothing here lets an agent's trace destroy a
   human's recording.

## What would make this task fail

Fixing F91 without reproducing F90. A better route into the provenance pane is worth
nothing if the pane shows a stale warning when you arrive.
