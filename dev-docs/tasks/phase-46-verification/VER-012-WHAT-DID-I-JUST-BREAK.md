# VER-012 — What did I just break

**Status:** 📋 specced, not started · **Est. 1 wk** · depends on **VER-010**, **VER-011**

> Richard, 2026-08-09: *"Months down the line when I add a 'discount code' feature and for whatever
> reason its blast radius hits the add to cart logic… all the hundreds of tests run to make sure
> there's no regression, the add to cart test will fail and we can debug what's wrong."*

That is the whole reason the rest of this tier exists, and it is the task that makes the others pay
off. It is also **the one place where a graph beats a codebase outright**, which is worth building
deliberately rather than arriving at.

## The ordinary half

Run every scenario and every case; report what failed. VER-010 gives the run, VER-011 gives the
per-component state. What this task adds is the thing that makes a red suite *actionable* rather than
merely alarming:

**A result is compared against the last green run, not against nothing.** Three outcomes, and the
middle one is the point:

| | Meaning |
|---|---|
| **Newly failing** | Passed at the last green run, fails now. **This is what you just broke.** |
| **Still failing** | Was already red. Not your problem right now, and it must not drown the first row |
| **Newly passing** | Fixed — worth showing, because it is how a builder learns the suite is real |

Without that split, the twentieth red run shows twenty failures and the one caused by the last ten
minutes of work is invisible in the middle of them. Suites die of this.

### Where the baseline lives

⚠️ **Not in `project.json`, and not in component metadata.** Results change on every run; scenarios
change when a human decides something. Putting results where scenarios live would mean every test run
dirties the project, arms the 1s autosave
([projectmodel.ts:1516](../../../packages/noodl-editor/src/editor/src/models/projectmodel.ts#L1516))
and produces a git diff — turning "I ran the tests" into a commit. That is a very fast way to make
people stop running the tests.

Results go in a **local, git-ignored cache** keyed by project. The optional second half — a committed
baseline, so *the team* agrees on what is green — is a real feature and a separate decision; file it,
do not assume it.

## The differentiated half: the blast radius is computable

In a codebase, a test suite can tell you *what failed*. It cannot tell you *what was downstream of
your edit* without static analysis nobody has set up. **In a node graph, that reachability is already
written down**, and one direction of the walk is already implemented:

`componentClosure(project, component)`
([sandboxExport.ts](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/sandboxExport.ts))
walks *downward* — what a component reaches — and BEN-006 already uses it to decide what to sample
([componentBench.ts:450](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/componentBench.ts#L450)).

What this task needs is **the inverse walk over the same edges**: which components instantiate the
one you changed, transitively. A node instantiating a project component *uses its legacyName as its
node type*, so the reverse index is a scan over node types — cheap, exact, and already the mechanism
every other part of the platform relies on.

That gives the sentence a code suite cannot produce:

> You changed **Card**. 14 components embed it, 6 of those have scenarios, **2 now fail** — and 8
> embed it with no scenario at all, so nothing was checked there.

⚠️ **The last clause is the honest half and it must not be dropped.** Reporting "2 failed" alone
implies the other 12 were verified. They were not: 6 were checked and 8 were not looked at. A blast
radius that reports only its tested subset is a green-for-the-wrong-reason machine, which is the
failure mode this entire phase was created in response to.

### Landmines in the walk

- ⚠️ **`MAX_CLOSURE_DEPTH = 4`** in `sandboxExport.ts`. The existing downward walk is depth-capped
  for good reasons (a self-referencing component must not hang the sandbox). **A blast-radius walk
  capped at 4 silently under-reports**, and under-reporting here reads as "nothing else was
  affected". Either the reverse walk is uncapped with cycle detection, or the cap is reported in the
  output. Do not inherit the constant without deciding.
- ⚠️ **Cycles are legal.** Component A can embed B which embeds A. Cycle detection, not a depth cap,
  is the correct guard for a walk whose completeness is the product.
- ⚠️ **A component referenced only by a router page** is reachable without being instantiated by any
  node. Check whether the reverse index catches it; a page is exactly the kind of thing whose
  breakage matters.
- ⚠️ **`NodeGraphModel.forEachNode` treats a truthy return as "stop"** — a walk written against it
  will terminate early if a visitor returns anything.

## The "declare it done" moment

Richard's fourth bullet is a workflow, not a button: *when you finish a piece of work, everything
runs and you find out what moved.*

Two entry points, one report:

1. **In the editor** — a Run all in VER-004's Tests panel, and the blast-radius summary above shown
   against the changed components since the last green run.
2. **In CI / from an agent** — `nodegx test`, exit code, TAP + JSON. Same runner, same verdicts.

**Not a gate.** Nothing refuses to save, export or deploy because a scenario is red. Phase 46's exit
criteria are about *proving* things, and a platform that blocks on its own young test feature will
have that feature switched off within a week. Reporting earns the right to gate later; it does not
start there.

## What "changed since" means

⚠️ **Not git.** A NodeGX project's meaningful unit of change is a component, and a builder may not be
using version control at all. The comparison is *"which components differ from the state at the last
green run"*, which the result cache can answer from a per-component fingerprint recorded alongside
each verdict.

That fingerprint is also what makes VER-011's **stale** state real: a component whose fingerprint has
moved since its last verdict has not been checked, whatever its last verdict said.

⚠️ **Fingerprint the component's *meaning*, not its bytes.** A v2 save deletes `description` (BEN
register B23 / AWP-002) and node coordinates change when someone tidies the canvas — both would
invalidate every fingerprint in a project for no reason. Fingerprint nodes, types, parameters and
connections; exclude layout and prose. Get this wrong and the suite reports everything as stale
forever, which is the same as reporting nothing.

## Not in scope

- **Gating anything.** Above.
- **Bisecting to find the change that broke it.** The blast radius narrows it to a component; that is
  enough for a first version, and history-walking needs a history this task cannot assume.
- **Flake detection / retries.** Deliberately absent. An auto-retry is how a flaky suite becomes an
  invisible flaky suite. If scenarios turn out to be flaky, that is a defect in VER-009's settle
  logic or VER-002's determinism seams, and it should be fixed there where it is visible.

## Acceptance

- [ ] Newly-failing is distinguished from still-failing, and the report leads with the former.
- [ ] Running the suite writes **nothing** to the project — mtimes on all project files unchanged
      across a full run, past the autosave debounce. (BEN-005 closed R5 with exactly this
      measurement; reuse the method.)
- [ ] The blast-radius summary reports the **unchecked** count alongside the failed count.
- [ ] A cyclic component pair terminates the walk and reports both.
- [ ] A component reached only through a router page appears in the radius, or its absence is a
      documented, deliberate limit stated in the output.
- [ ] Tidying a canvas — moving nodes, no logic change — marks **nothing** stale.
- [ ] **Live:** change a shared component so a *consumer's* scenario breaks, run, and confirm the
      report names the consumer and the change. This is the task's entire thesis and it is the one
      criterion that cannot be met by reading code.

## Risks

| Risk | Mitigation |
|---|---|
| Red-suite fatigue | Newly-failing leads the report; still-failing is collapsed |
| The radius implies coverage it does not have | The unchecked count is mandatory in the output |
| Fingerprints churn on cosmetic edits | Fingerprint meaning, not bytes; a canvas-tidy case in acceptance |
| Results in the project dirty git on every run | Git-ignored local cache; a committed baseline is a separate decision |
| A depth cap hides half the radius | Cycle detection instead of a cap, or the cap is reported |
