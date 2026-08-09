# VER-011 — Coverage is information; only failure is a warning

**Status:** 📋 specced, not started · **Est. 3 d** · depends on **VER-009**

> Richard, 2026-08-09: *"If you don't make a test, the component has an error warning or something
> on it."*

## The instinct is right and the mechanism would backfire

The instinct — *the editor should tell you which components are unproven* — is correct, and it is the
thing that turns a feature into a habit. But **an error badge on every untested component would be
wrong on day one and harmful by day three**, for a reason this repo has already paid for once.

Turn it on against any existing project and every component lights up at once. A warning that is
present on everything carries no information, and the cost is not that it is ignored — it is that
**people learn to ignore the colour**, and the same colour is already carrying real defects. The
warning dot (F62) is a scarce channel. Spending it on "you have not written a test yet" devalues it
for "this connection points at a port that does not exist".

The related lesson is `muted-button-was-never-a-control`: a visual signal applied indiscriminately
stops being a signal. Same mechanism, different surface.

## The rule

| State | What it means | How it shows |
|---|---|---|
| **Failing** | A pinned scenario ran and its expectation did not hold | ⚠️ **Warning.** This is a defect and it earns the existing dot |
| **Passing** | Every pinned scenario holds | A quiet positive — `success`, or nothing at all |
| **Untested** | The component has an assertable interface and no pinned scenario | **Information, never a warning.** Visible in a coverage view; silent on the canvas |
| **Not testable** | No declared outputs — a layout wrapper, a pure container | **Nothing.** Not counted in coverage, not nagged, not listed as a gap |
| **Stale** | Scenarios exist but have not run since the component changed | Information, phrased as *"not run since you changed this"* — never as a failure |

**The fourth row is the one that makes the third row bearable.** Most components in any real project
are layout. A coverage number that counts them is a number that can never approach 100%, so it is a
number nobody looks at. Only components with a declared output interface — something to assert — are
eligible, and the coverage denominator says so out loud: *"12 of 19 testable components have
scenarios"*, with a way to see which 19 and why the other 34 are not counted.

⚠️ **"No declared outputs" is not the same as "not worth testing".** A purely visual card with three
inputs and no outputs is testable *structurally* (VER-010 §5: something was drawn, the bound text
appears, no overflow at the declared width). Decide explicitly whether structural-only components are
eligible, and record the decision here. **Recommendation: eligible, but only once VER-010 §5 ships**
— an eligibility rule that points at an assertion the runner cannot yet make would produce a
permanent, unfixable coverage gap, which is its own kind of noise.

## What already exists

- **`WarningsModel.setWarning(ref, warning)`**
  ([warningsmodel.ts:38](../../../packages/noodl-editor/src/editor/src/models/warningsmodel.ts#L38)) —
  keyed by component name at the first level, `warning.level` defaulting to `'warning'` at
  [:43](../../../packages/noodl-editor/src/editor/src/models/warningsmodel.ts#L43).
- **Levels are already plural.** `error`, `warning`, `info` and `success` are all in use across the
  editor, and `getWarnings` filters on them
  ([:116](../../../packages/noodl-editor/src/editor/src/models/warningsmodel.ts#L116),
  [:142](../../../packages/noodl-editor/src/editor/src/models/warningsmodel.ts#L142)).

So the whole of this task's model layer is *"emit at the right level"*. There is no new mechanism to
build, which is why it is three days and not a week.

⚠️ **Probe before building:** confirm what the components panel and the canvas dot actually *read* —
whether they filter by level or render anything present. If they render anything present, an `info`
row would put a dot on every untested component and this task would ship the exact failure it exists
to prevent. **Check the render path, do not trust the level.**

## Where the coverage view lives

Not a new panel. VER-004's Tests panel is the surface, and component scenarios are a second section
in it beside cloud-function cases — the same one-report argument VER-010 §4 makes for the CLI.

The per-component affordance is in the bench itself, where the scenarios already are: a run button
and a verdict strip. A builder who is looking at a component sees whether it holds up; a builder who
wants the whole picture opens the panel.

## Not in scope

- **Blocking anything on coverage.** No gate, no "you cannot mark this done", no refusal to export.
  This task reports; VER-012 acts. Coupling them would mean the first project to adopt scenarios is
  the first project that cannot ship.
- **A coverage percentage in the launcher or on the project card.** A number that leaves the editor
  becomes a target, and a coverage target is how suites full of assertion-free tests get written.

## Acceptance

- [ ] An untested component produces **no canvas warning and no dot** — asserted, on a project with
      zero scenarios, by reading what the panel renders rather than what the model holds.
- [ ] A failing scenario produces a warning at `warning` level, naming the scenario and the port.
- [ ] A component with no declared outputs is absent from the coverage denominator.
- [ ] The denominator is explained in the UI — a builder can see *which* components are counted.
- [ ] Fixing the component clears the warning without an editor restart.
- [ ] **Live:** on a real project, open it cold with scenarios present and confirm the canvas looks
      exactly as it did before this task, except where something genuinely fails.

## Risks

| Risk | Mitigation |
|---|---|
| The dot appears everywhere and gets tuned out | Only `failing` warns; the render path is probed before build, not after |
| Coverage becomes a target | No number outside the editor, no gate in this task |
| Stale results read as failures | `stale` is its own state with its own wording |
| Untestable components read as neglected | They are excluded from the denominator and the UI says why |
