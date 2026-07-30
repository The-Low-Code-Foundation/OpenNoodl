# RCK-003: The Blind Driver — Screenshot In, Coordinate Out

## Metadata

| Field | Value |
|-------|-------|
| **ID** | RCK-003 |
| **Phase** | Phase 32 — Reality Check (Track Q) |
| **Tier** | 2 — synthetic |
| **Priority** | 🔴 Critical — the epistemic wall the whole synthetic layer stands on |
| **Difficulty** | 🟠 Medium–High |
| **Estimated Time** | 1.5–2 wks |
| **Prerequisites** | RCK-002 (the driver) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** — this defines what a synthetic tester is permitted to know. Getting it wrong invalidates every result the phase produces |

## Objective

A driving mode in which the agent perceives the app **only as pixels** and acts **only by coordinate** —
so that "I couldn't tell that was clickable" becomes an observable outcome rather than an impossibility.

## Background

This is the single design decision that determines whether the synthetic layer is worth anything.

If the agent can read the DOM, it sees `id="submit-booking"` and clicks it by selector. It sails
through an app that would baffle a human, produces a green result, and proves nothing — while looking
exactly like proof. That is worse than not running it, because it manufactures the false confidence
this entire phase was created to prevent.

A real user sees pixels. They do not know your node is called `PrimaryCTA`. They do not know the grey
rectangle is a button, and the most common usability failure in the world is exactly that: an
affordance that does not read as one. **A DOM-driven test can never produce that finding.**

So the wall is: *perception is a screenshot; nothing else crosses.*

There is a real engineering tension here, and it must be resolved deliberately rather than by drift.
Pure coordinate clicking is flaky and expensive — a 3px miss kills a 40-step run and the tokens spent
getting there. The resolution is to separate the **epistemic** wall from the **mechanical** one:

> The persona never *learns* a name. The harness may *use* one to make a click land.

A coordinate may snap to the nearest hit target within a small radius. That is a mechanical aid and it
is recorded. What must never happen is a name, a role, a label or a selector reaching the persona's
context.

## Current State

| Piece | State |
|---|---|
| The driver | RCK-002 — one code path, capability-parameterised, expecting this task to add a mode |
| Screenshot capture | available through the CDP harness (RUN-001) and preview |
| AI client | AIX-001 — provider-agnostic, capabilities not model ids; vision capability must be declared |
| Anything blind | nothing. Every existing harness in the repo drives by selector or by node id |

## Desired State

### 1. The capability, and what it forbids

A `blind` capability on RCK-002's driver. In blind mode, the driver's API surface exposes:

**Available**
- `screenshot()` — the current viewport, as an image
- `click(x, y)`, `type(text)`, `scroll(dx, dy)`, `key(name)`, `back()`
- `wait()` — advance time and re-observe
- `viewport` dimensions, device pixel ratio

**Absent — not filtered, absent**
- DOM, accessibility tree, roles, labels, `alt` text
- node ids, component names, port values
- the graph, the journey, the catalog
- console output, network log, backend responses

The distinction between *absent* and *filtered* matters: a filtered field is one refactor away from
leaking, and the leak would be silent. The blind driver must not be able to obtain these, so the
capability check belongs at the driver boundary with a test that asserts the exposed surface.

### 2. The snap, recorded

A click at `(x, y)` resolves to the nearest interactive target within a configured radius (default
small — single-digit CSS pixels). Every snap is recorded on the session:

```
click(412, 288) → snapped 4px → hit target
click(150, 640) → no target within radius → nothing happened
```

The second line is not an error. **A click that hits nothing is a finding**, and one of the most
valuable ones: the persona believed something was there. Never auto-correct a miss into a hit by
widening the radius at runtime.

### 3. Scale and legibility are part of perception

A persona reading a downscaled screenshot is not reading what a user reads. Capture at the device's
actual pixel ratio, and record the viewport with every observation — RCK-004's device archetypes (a
thumb on a 390px phone) depend on this being honest.

Where an image must be resized for the model, resize once, record the factor, and translate coordinates
back — never let the persona reason in one coordinate space and act in another.

### 4. A leak test that runs in CI

The wall needs a test that would fail if someone helpfully added a field:

- assert the blind driver's exposed surface, exactly
- run a session against a fixture whose button label is a nonsense token (`zqx-4417`), and assert the
  token appears nowhere in the persona's context or transcript

The second is the real test. A structural assertion catches the obvious addition; the token catches the
subtle one — an accessibility snapshot slipped into a screenshot pipeline, a page title in a wrapper, a
filename that contains a component name.

### 5. It is the same app

Blind mode must drive the same three run modes as RCK-002 — preview, local full-stack, deployed. A
synthetic session against a deployed URL is the highest-fidelity signal the phase can produce short of
a human.

## Implementation Steps

1. Define the capability surface and write the assertion test **before** implementing the mode.
2. Blind capability on RCK-002's driver; verify no shared helper reaches back into DOM state.
3. Snap-with-radius + recording, including the honest no-target case.
4. Pixel-ratio-correct capture; resize/translate discipline.
5. The `zqx-4417` leak test, wired into CI alongside the editor suites.
6. All three run modes.
7. **Live pass**: drive the QA fixture blind, by hand, with a human choosing coordinates from
   screenshots only. If a person cannot complete the journey that way, the harness is wrong before any
   model is involved.

## Success Criteria

- [ ] The blind surface is asserted by a test; DOM, ids, names and network are **absent**, not filtered.
- [ ] The nonsense-token leak test passes and is in CI.
- [ ] Snaps are recorded with their distance; a click that hits nothing is recorded as such and is not
      auto-corrected.
- [ ] Capture is pixel-ratio correct; resize factors recorded; coordinates translate correctly.
- [ ] All three run modes work blind.
- [ ] A human can complete a fixture journey using only the blind API — recorded in `RCK-003-NOTES.md`
      as the harness's own sanity check.

## Out of Scope

- **Personas, intents, reasoning, reports.** RCK-004/005. This task ships the eyes and hands only.
- **Accessibility auditing.** Tempting — the accessibility tree is right there and deliberately not
  used. A screen-reader-based audit is a genuinely good future task and it needs a *different* driver
  mode, not a weakening of this one.
- **Recording video.** Screenshots per step. Video is RCK-005's problem if it wants it.
- **Text extraction via OCR.** The persona reads the screenshot with a vision model. Adding an OCR
  channel is a second perception path that will diverge from what the model sees.

## Traps

- **The wall will erode helpfully.** Someone will add "just the page title" to aid debugging, or a
  filename containing the component name, or an error string from a failed click. Every one is
  reasonable and every one weakens the result. The token test is the defence; keep it in CI.
- **Snap radius is a correctness dial, not a reliability dial.** Widen it and flaky runs get greener
  while findings disappear. Fix the default, record it on every session, and never tune it per-run.
- **Coordinate spaces will disagree.** Device pixel ratio, model-side resizing, and scroll offset each
  introduce a transform. This is where silent wrongness lives — a persona that clicks 40px below what
  it intended looks like a confused user and is actually a broken harness.
- **A blind run is slow and every step costs money.** Step budgets belong to RCK-004, but the driver
  must expose step count and elapsed time so that task can enforce them. Ship the counters here.
- **Scroll is where blind driving usually breaks.** A persona that cannot tell whether the page moved
  will scroll forever. Give it the same evidence a human has — a screenshot after the scroll — and let
  the failure be visible rather than papering over it with a scroll-position readout.
- **`--target=editor` attaches to the preview window** and the other CDP traps in RUN-003's notes apply
  unchanged. Blind mode does not exempt you from them.
</content>
