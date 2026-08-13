# VFN-011 — The bench: sandbox values, and a Run button

**Status:** 🟡 **built, not driven** · ⭐ Tier 1 — the flagship · no dependencies
**Branch:** `vfn-bench` (`4420812e`, `e1219147`, `8d4bf513`) · **findings and the owed drive:**
[NOTES-bench.md](./NOTES-bench.md)

> All eight acceptance criteria are implemented. Four of them are proved by spec (4, 5, 8, and the
> reporting half of 6); the rest are proved *as far as a headless runner reaches* and are owed a
> live drive, which this worktree could not do. **Read NOTES-bench.md §"Owed a live drive" before
> calling anything here done** — in particular that no bench frame has ever reached the badge layer,
> and that criterion 8 is proved on the workspace string rather than on `project.json`.
>
> The gate is `cd packages/noodl-editor && npx jest`: **160 suites / 2310 passing**, from a baseline
> of 157 / 2265.
>
> 🔴 The drift gate found a runtime defect while being written: a reserved `send signal` makes the
> node pulse **Failure and Success** for the same run and clears its own `error` output. Mirrored by
> the bench rather than corrected — see NOTES-bench.md.

## The report

> *"When I run the logic node, open the editor, it still says 'No runs yet' at the bottom so I can't
> inspect the live values that passed through it. Also it would make sense if you could set sandbox
> values for any variables or inputs, then manually trigger the run signal from the left 'inputs'
> menu to see the sandbox values evaluated into outputs right there in the editor without having to
> click stuff on the node canvas."*

Two things, and they are worth keeping apart. The first is a defect with a pinned mechanism. The
second is the single largest change to what this node *is* — a visual function you can exercise is a
different tool from one you can only watch.

## Part 1 — why it says "No runs yet", and it is not broken

The trace path is **complete end to end** and was read in full:

| Step | Where |
|---|---|
| Editor arms one node on open | [`BlockTraceClient.ts:146`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlockTraceClient.ts) — `sendSetBlockTracing({ nodeId, enabled: true })` |
| Runtime records the node | [`nodecontext.ts:1066`](../../../packages/noodl-runtime/src/nodecontext.ts) — `setBlockTracing` |
| Each run allocates a recorder, or not | `:1078-1086` — `beginBlockRun` returns `undefined` unless armed |
| Probes fill it | `logic-builder.ts:324-357` — `__p`/`__s`, the 9th and 10th compiled parameters |
| The frame goes back | `:1095-1112` — `endBlockRun` → `sendBlockValues` |
| The editor receives it | [`ViewerConnection.ts:259`](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts) → `BlockValues` |
| The strip renders it | [`BlockValueController.ts:242-247`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlockValueController.ts) |

**Two reasons it can be empty, both of them correct behaviour producing a wrong impression:**

1. 🔴 **Tracing arms when the editor opens.** The report's own sequence — *"When I run the logic
   node, open the editor"* — records nothing, because there was nothing armed when it ran. Every
   subsequent run is captured; a builder who never triggers another one sees "No runs yet" forever.
2. 🔴 **A node whose `generatedCode` predates LGC-003 emits no probes**, and it regenerates only on
   its **own next edit** — measured in LGC-007 §6, not assumed. So an older Visual Function traces
   nothing until it is touched.

Neither is a bug in the trace. Both are the same reporting failure: **the strip says "No runs yet"
when it should say why there are none.** `STATUS_COPY`
([`:29-35`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlockValueController.ts))
already has five reasons and renders them — but "attached, armed, and nothing has run since you
opened this" is not one of them, and it is the commonest.

**Fix in Part 1:**

- A sixth status: *"Watching. Nothing has run since you opened this — trigger it, or press Run
  below."* Attached and empty is a different state from waiting for a viewer.
- Detect the no-probe case: if `generatedCode` mentions neither `__p` nor `__s` while blocks exist,
  say *"These blocks were generated before value tracing; make any edit to bring them up to date."*
  The runtime already has this exact check on its compile path and its comment explains the shape.
- 🔴 Do **not** regenerate the node silently to fix it. That writes to disk on open, which breaks
  LGC-002 §2's criterion that opening a program and closing it again changes no bytes.

## Part 2 — the bench

### ✅ Ruled 2026-08-13: it runs in the editor

Compile the blocks in the editor process and run them against sandbox values with a stubbed Noodl
API. No preview needed, works with the app stopped, instant.

**The cost is accepted and must be stated in the UI, not hidden:** this is a second execution context
and it can drift from the runtime's, and `Variables`/`Objects`/`Arrays` are stubs rather than live app
state. The bench says *"sandbox — not your app's data"* wherever it shows a value.

### The shape

The **inputs rail is already the right surface**. LGC-004 built it: rows derived from
`detectInterface`, a projection of `detectIO`'s own traversal, with no second store
([`interfaceRails.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/interfaceRails.ts)).
Every input, signal and inferred port the program has is already listed there, live.

Add to each row:

- **a value cell** for a data input — the sandbox value, typed by the row's declared type;
- **a ▶ trigger** for a signal input — run the program as if that signal fired.

And the outputs rail, which already lists the outputs, shows what the run produced.

🔴 **Read the rails' existing projection. Do not build a second list of ports.** That is the phase-59
standing constraint and it is the one this task is most likely to break, because a bench "needs the
inputs" and it is one line to enumerate them again.

### The runner

The runtime's own compile is the specification, and it is short enough to mirror exactly
([`logic-builder.ts:490-535`](../../../packages/noodl-runtime/src/nodes/std-library/logic-builder.ts)):
a `new Function` over `generatedCode` with a fixed parameter list ending in `__p`, `__s`.

The editor-side runner must:

1. compile the **same** `generatedCode` the flush produced — never a separately generated string, or
   the bench is grading a program the node does not have;
2. pass real probe functions for `__p`/`__s`, producing a `BlockRunFrame` **of the same shape the
   viewer sends**, so it feeds `BlockRunHistory` and the badges through the existing path and not a
   parallel one;
3. supply a stub context: `Inputs` from the sandbox values, `Outputs` collected, `Noodl.Variables`/
   `Objects`/`Arrays` as in-memory stubs seeded from the sandbox, `__triggerSignal__` set to the
   signal that was pressed, and `sendSignalOnOutput` recording which signals fired;
4. catch and **report** a throw as a failed run with the block that threw, rather than losing it.

⚠️ **`__triggerSignal__` is the eighth parameter and has a history**: it was built and then not
passed, so it read as `undefined` inside every block program ever run. Pass it, and gate that it
arrives.

⚠️ **`sendSignalOnOutput` must refuse the reserved output names**, exactly as the runtime does
(`RESERVED_OUTPUTS`) — a bench that lets a program pulse the node's own completion signal teaches a
program that will be refused in the app.

### 🔴 The drift gate

The whole risk of an editor-side runner is that it slowly stops agreeing with the runtime. Pay for it
once, with a gate rather than a promise:

**A spec that runs the same `generatedCode` through the editor runner and the runtime's own compile
path, and asserts identical outputs.** `noodl-runtime` is importable from the editor's test bundle,
and `logic-builder.ts` is already structured with `_compileFunction` and `_probeFragment` as separate
methods for exactly this kind of reach. A fixture of ~6 programs — arithmetic, a loop, a conditional,
a variable read, a signal, a thrown error — is enough to catch drift the day it happens.

Without this gate the bench becomes a second truth about what a program does, and this register
already has a name for that shape.

## Acceptance criteria

1. With the app stopped, setting a sandbox value and pressing a signal's ▶ produces values on the
   badges and outputs in the right-hand rail.
2. The frame produced is the same shape as a viewer frame, and drives the same `BlockRunHistory` —
   the scrubber works over sandbox runs.
3. Every sandbox surface is marked as sandbox, and no sandbox run mutates real app state.
4. The drift gate passes over the whole fixture.
5. A program that throws reports the block that threw and does not take the editor with it.
6. The strip's empty state names its reason, including the two in Part 1.
7. With a preview running, live frames still arrive and are not confused with sandbox frames — a
   sandbox run is distinguishable in the scrubber.
8. 🔴 Nothing about pressing Run writes to `project.json`. Sandbox values are editor state, not
   program state — a bench that serialises its inputs into the saved workspace changes the program by
   testing it.

## How to prove it

The runner and the drift gate are specs, and they are the substance of the task.

A drive for the surface: open a Visual Function with the app **stopped**, type a sandbox value, press
▶, screenshot the badges and the outputs rail. Then check `project.json` is byte-identical, which is
criterion 8 and is the one most likely to be quietly false.

⚠️ Verify the *consequence*: assert the output value in the rail, not that a run event was emitted.
