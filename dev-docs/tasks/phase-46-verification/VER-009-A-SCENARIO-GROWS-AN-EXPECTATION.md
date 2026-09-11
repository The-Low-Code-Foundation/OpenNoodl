# VER-009 — A scenario grows an expectation

**Status:** 📋 specced, not started · **Est. 1 wk** · depends on **BEN-005** (built), **VER-001**
(the matcher vocabulary)

> Richard, 2026-08-09: *"When you build a new visual or logic component, part of the 'checklist' of
> that component is to design and run a test to make sure the component does what you intended it to
> do."*

## The premise

[BEN-005](../phase-56-component-bench/BEN-005-SCENARIOS.md) already persists, on the component,
an ordered list of named input sets:

```ts
{ name: string; inputs: Record<string, unknown>; frame?: BenchFrame; stretch?: boolean }
```

([benchScenarios.ts:55](../../../packages/noodl-editor/src/editor/src/views/VisualCanvas/benchScenarios.ts#L55),
stored under `bench.scenarios` at
[:53](../../../packages/noodl-editor/src/editor/src/views/VisualCanvas/benchScenarios.ts#L53))

**A scenario is a test case missing exactly one field.** It has a name, it has inputs, it survives a
save/load round trip, it diffs and merges with the component it belongs to. It does not have an
`expect`. This task adds one.

BEN-005 §4 filed this itself — *"Running scenarios as automated tests. Tempting, and a real
follow-up, but it needs an assertion language this task does not have."* That is the correct read,
and it is why this is a separate task rather than a bigger BEN-005. What follows is the assertion
language, and it is deliberately the **same one VER-001 defines for cloud-function cases**. One
dialect, two hosts. A second dialect is the BCN-003 mistake.

## ⚠️ §1 first: the channel the bench reads outputs on **cannot carry an expectation**

**Read this before designing anything else in this task.** It was measured in source, and it
invalidates the obvious implementation.

[BEN-003](../phase-56-component-bench/BEN-003-OUTPUT-READOUT.md) settled the outputs read-out on the
**trace**, not on `getPortValues`, and that was the right call — a tail read loses nothing between
polls and it carries signals, which `getPortValues` structurally cannot
([benchOutputs.ts:9-31](../../../packages/noodl-editor/src/editor/src/views/VisualCanvas/benchOutputs.ts#L9-L31)).

But every value on that channel has already been through the runtime's `previewValue`
([tracebuffer.ts:129](../../../packages/noodl-runtime/src/tracebuffer.ts#L129)), which is a
**bounded display string, not JSON**:

| the real value | what arrives at the bench |
|---|---|
| `'emitter'` | `"emitter"` — quotes it did not have |
| `6` | `6` — bare, indistinguishable from the string `"6"`… which arrives as `"6"`. Distinguishable, but only by parsing the dialect |
| `undefined` | the **word** `undefined` |
| `NaN` | `NaN` — not valid JSON |
| a `Date` | its ISO string |
| a function | `<function foo>` |
| a runtime `Node` | `<Node> name` |
| nested deeper than 6 | `…` |
| a cycle | `[Circular]` |

And the part that kills naive pinning outright:

> ⚠️ **`DEFAULT_VALUE_CAP = 200`** ([tracebuffer.ts:108](../../../packages/noodl-runtime/src/tracebuffer.ts#L108)).
> `previewValue` stops writing the moment it is over budget and returns the truncated prefix.

So **a 300-character string and a 3,000-character string produce the identical value on this
channel**, and so do two different 40-row collections that agree on their first 200 characters. An
expectation pinned against that is a test that passes on values it has never seen. That is precisely
the *green-for-the-wrong-reason* failure this phase exists to prevent, and it would arrive inside the
verification feature itself.

The cap is not a defect. `previewValue` is documented as a bounded walker specifically so that trace
mode on a repeater bound to 10,000 rows does not serialise the collection on every fire
([tracebuffer.ts:120-128](../../../packages/noodl-runtime/src/tracebuffer.ts#L120-L128)). It is the
right design **for a diagnostic channel**. It is the wrong channel for an assertion.

### What this task must therefore do first

**Add a fidelity read path used only when a scenario is being run or pinned**, and do not widen the
trace channel to serve it. Two candidate shapes, and the probe that decides between them is §2:

| | Shape | Cost | Risk |
|---|---|---|---|
| **A** | A per-run `traceValueCap` override — `_traceValueCap` is already an instance field ([nodecontext.ts:88](../../../packages/noodl-runtime/src/nodecontext.ts#L88), set at [:209](../../../packages/noodl-runtime/src/nodecontext.ts#L209)) — raised for the duration of a scenario run | Very small | Still the display dialect. `undefined` vs `"undefined"` vs `NaN` still need un-parsing, and un-parsing a display format is how you get a comparison that is subtly wrong forever |
| **B** | A separate `getPortValuesJSON`-shaped request that `JSON.stringify`s the declared output ports only, on demand, at pin time and at assert time | Small, bounded by the *declared interface* rather than by the graph | A value that is not JSON-serialisable must fail loudly rather than degrade — the same rule BEN-005 already applies to scenario **inputs** at save time ([benchScenarios.ts:29-37](../../../packages/noodl-editor/src/editor/src/views/VisualCanvas/benchScenarios.ts#L29-L37)) |

**Recommendation: B**, because it makes the two halves symmetric — inputs are already JSON-constrained
at save time and refused with a message if they are not, and an expectation should be held to the
same standard as the input that produced it. A is a smaller change that leaves a dialect-parsing
seam in the assert path forever.

⚠️ **B does not replace the trace channel for signals.** A signal has no state to read; the trace is
the only thing that can witness one, and BEN-003 measured that. So the assert path is *two* sources:
the trace for "did `Pressed` fire, and how many times", JSON fidelity for "what value did `Count`
hold". Design the `expect` shape around that split from the start rather than discovering it.

## §2 The probe to run before building

One driving session, on `/Components/BenchProbe` and `/Components/BenchEmitter` in *Puppy test 3*
(the fixtures session 3 and session 5 authored — they are the only components in the corpus with
typed inputs and a signal output).

1. Set a `Text` output to a 500-character string. Read it off the bench. **Confirm the truncation** —
   this doc's central claim, measured rather than inherited.
2. Set the same output to `{a: 1}` and to `[{a: 1}]`. Record exactly what arrives.
3. Raise `_traceValueCap` at runtime and re-read. Confirm shape A is *possible* before ruling on it.
4. Fire `Pressed` three times in one second. Confirm the trace reports three events with distinct
   `seq`, because "fired exactly twice" is an assertion this task will be asked for.

Write the four measurements into this file before writing code. Every one of them can invalidate a
section above, and the phase-56 house rule — *read it in source, then confirm it live* — is what
made that phase's task files worth reading.

## §3 The format

```ts
interface BenchScenario {
  name: string;
  inputs: Record<string, unknown>;
  frame?: BenchFrame;
  stretch?: boolean;
  expect?: {
    /** By declared output port name. Absent key = not asserted, never "expected empty". */
    outputs?: Record<string, Matcher>;
    /** By declared signal output name. `{ fired: false }` is the way to assert silence. */
    signals?: Record<string, { fired: boolean; count?: number }>;
  };
}
```

**`Matcher` is VER-001's, imported, not re-specified here.** Exact value, subset for objects,
`~number` with a tolerance, `*` for any, `!undefined` for present-and-not-unset. That is the whole
vocabulary and this task adds nothing to it.

### The three rules that keep it honest

1. **An absent key asserts nothing.** It does not mean "expected empty". A scenario that pins one of
   four outputs is a scenario that pins one of four outputs, and the read-out should say so — three
   greys and a green, not three greens.
2. **`{ fired: false }` is the only way to assert a signal did not fire**, and it can only be
   honoured over a declared window (the run's settle period, §4). Absence of evidence over an
   unbounded window is not an assertion.
3. **Pinning is explicit, exactly as saving is.** R5's lineage: typing does not save, and running
   does not pin. Only the pin affordance writes, and it goes through the one existing
   `ComponentBench.persistScenarios` → `setMetaData`
   ([componentmodel.ts:344](../../../packages/noodl-editor/src/editor/src/models/componentmodel.ts#L344))
   call, not a second one. **The whole surface must still contain exactly one `setMetaData` call** —
   BEN-005 closed an acceptance criterion on that count and this task must not be what breaks it.

## §4 Authoring by approval, not by typing

This is the half that decides whether the feature is ever used, and it is where the platform has an
advantage a code IDE does not.

> Run the scenario → the outputs read-out already shows what the component emitted → press
> **Pin these as expected**.

The builder does not write an expectation. They *look at* the outputs BEN-003 already renders and
say "yes, that's right". The bench writes what it observed. Nobody types a matcher, nobody learns a
DSL, and the failure mode of "I wrote a test that doesn't check what I thought" is structurally
unavailable — you approved the actual values.

Once pinned, the same read-out gains a verdict column: each asserted row shows ✓ / ✗ / not asserted
against the pinned value, live, as you interact with the component.

⚠️ **The settle period is the hard part, and it must be declared rather than guessed.** A run is
"apply inputs, wait, read". Wait for what? A fixed delay is a flake generator on a slow machine and
a slow suite on a fast one. Ship with: **run until the trace has been quiet for N ms, cap at a
declared timeout, and record in the result which of those two ended it.** A scenario that hit the
timeout is reported as `timed out`, never as a pass — and never silently as a fail either, because
"the machine was busy" and "the component is broken" are different findings.

### What the AI's role is here, and is not

VER-013 lets an agent propose scenario *names and inputs* — the states worth having (`Empty`,
`Loaded`, `Long name`, `Error`). It does **not** author the expectation. An AI that writes both the
component and the assertion that blesses it has proved that the graph does what the graph does. The
value is entirely in a human confirming the output is what they **wanted**, and pinning is the whole
of that confirmation. Keep the split.

## §5 Not in scope

- **Pixel assertions.** Deferred to VER-010 §5, where the argument against them is made properly.
- **Asserting on internal wires.** A scenario asserts the component's *declared interface*. The
  moment it can assert an internal edge, every refactor of the inside breaks the tests of the
  outside, which is how a suite becomes something people delete.
- **Scenarios on page components.** A page has no meaningful input interface; VER-005's recorded
  traces are the story there, not this.

## Landmines

Each of these has already cost a session somewhere in this repo.

- ⚠️ **`getPorts()` derives type from connections** ([componentmodel.ts:91](../../../packages/noodl-editor/src/editor/src/models/componentmodel.ts#L91)).
  An output wired to nothing comes back `'*'`. It is still a *declared* output and must be listable
  as assertable — the form degrades, it does not guess.
- ⚠️ **A component output that nothing is wired to emits nothing**, and BEN-003 says so explicitly
  ([benchOutputs.ts:44](../../../packages/noodl-editor/src/editor/src/views/VisualCanvas/benchOutputs.ts#L44)).
  Pinning `{ fired: false }` on such a port produces a test that passes forever and means nothing.
  Warn at pin time.
- ⚠️ **A component input port is declared `plug: 'output'`** and the inversion is *two* inversions
  (BEN register B5). Anything in this task that walks the interface inherits that.
- ⚠️ **The runtime's `t` is not a wall clock** — it is `performance.now()` since *its* page loaded
  ([benchOutputs.ts:252-258](../../../packages/noodl-editor/src/editor/src/views/VisualCanvas/benchOutputs.ts#L252-L258)).
  A result record must not present it as a timestamp.
- ⚠️ **A signal is two updates, not one** (BEN register B12). Counting emissions naively double-counts.
- ⚠️ **A v2 save deletes `description`** (BEN register B23 / AWP-002). Any test that round-trips a
  component to check `expect` survived will trip over this and must not misattribute it.
- ⚠️ **`metadataChanged` is in `projectSaveTriggers`** ([projectmodel.ts:1516](../../../packages/noodl-editor/src/editor/src/models/projectmodel.ts#L1516)) —
  one allowlist entry is the entire persistence story, and an allowlist can only fail by omission.
  BEN-005 planted a disk-reading case in `projectsavetriggers.js` for exactly this; extend it to
  cover `expect` rather than trusting the existing one to.

## Acceptance

**Spec**

- [ ] A scenario with `expect` survives a save/load round trip **on disk**, asserted against the
      bytes of `components/**`, not through `toJSON` — v2 is the format that matters
      (BEN-005's acceptance found this the hard way).
- [ ] The matcher module is *imported from* VER-001 and this task defines no matcher of its own.
      A grep for a second matcher implementation returns nothing.
- [ ] An unpinned output reports `not asserted`, never `pass`.
- [ ] A value that cannot survive JSON round-tripping is refused at pin time with a message.
- [ ] Still **exactly one** `setMetaData` call in the bench surface.

**Live** (the phase-56 rule: every number from a running editor)

- [ ] Pin three outputs on `BenchProbe`, change an input, watch one go red.
- [ ] Change the component so an output is genuinely wrong; the scenario fails. **Then fix it and
      watch it go green.** Red-then-green, on the feature itself — a pinned expectation that has
      never been observed failing is an unchecked claim.
- [ ] A 500-character output value asserts correctly — i.e. §1 is actually closed and not merely
      described.
- [ ] Pinning does not reload the bench and does not disturb the app preview.
- [ ] `{ fired: false }` on a wired signal passes when it does not fire and fails when it does.

## Risks

| Risk | Mitigation |
|---|---|
| The fidelity path becomes a second trace channel and the two drift | It reads the **declared interface** on demand, never the graph, and it is not on the propagation path at all |
| Settle detection makes the suite flaky | Quiet-period + declared timeout, and `timed out` is its own outcome, never folded into pass or fail |
| An expectation pinned against a stale interface | Same rule BEN-005 already ships for inputs: apply what resolves, name what did not, never throw |
| Builders pin everything and the suite becomes noise | The read-out defaults to pinning nothing; pinning is per-row, not "pin all" |
