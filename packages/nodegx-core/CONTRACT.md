# The behaviour contract `@nodegx/core` must satisfy

This is step 1 of EXP-001: the semantics of the interpreted NodeGX runtime, written down from the
source, so the companion library can be judged against something rather than against a memory of
how the runtime feels.

Every clause cites the code it was read from. EXP-003's trace harness will compare an interpreted
graph against its exported equivalent event by event, so a clause that is wrong here becomes a
mismatch nobody can explain later.

**A note on why this document exists at all.** The EXP-001 task doc says the library must reproduce
"Noodl's per-frame de-duplication" of signals. It reads well and it is not what the runtime does —
see [C4](#c4-a-signal-is-an-edge-triggered-pulse-and-every-pulse-fires). Two other assumptions that
would have seemed safe (values coalesce; identical writes are cheap) are also false. The contract is
read from `packages/noodl-runtime/src`, and where it contradicts the task doc, the code wins.

---

## Part 1 — What the interpreted runtime does

### C1. Ports push notification and pull value

An output port stores nothing. `OutputProperty.value` calls the owning node's getter on every read:

> `value: { get: function () { return this.getter.call(this.owner); } }`
> — [outputproperty.ts:53-57](../noodl-runtime/src/outputproperty.ts#L53-L57)

Propagation is the other direction: `sendValue` walks the connection list and hands the value to
each receiver ([outputproperty.ts:151-168](../noodl-runtime/src/outputproperty.ts#L151-L168)), and
`_performDirtyUpdate` marks everything downstream dirty
([node.ts:674-680](../noodl-runtime/src/node.ts#L674-L680)).

So the model is **push the notification, pull the value** — not a stored-value graph. This is the
single most load-bearing observation for the library's design: a lazily-computed, memoised derived
value *is* an output port, and needs no translation layer.

### C2. Every send is delivered, in order — nothing is coalesced and nothing is skipped

Two separate mechanisms would have to exist for coalescing, and neither does:

- **No equality check.** `setInputValue` writes and invokes the setter unconditionally; there is no
  comparison against the previous value anywhere in the path
  ([node.ts:331-354](../noodl-runtime/src/node.ts#L331-L354)). Writing `5` over `5` re-runs the
  setter and, for most library nodes, re-sends downstream.
- **No collapsing.** Inputs are queued per port, and `update` shifts entries one at a time
  ([node.ts:568-609](../noodl-runtime/src/node.ts#L568-L609)). If a source sends `1` then `2` inside
  one frame, the receiver processes `1` and then `2`, and anything downstream of it sees both.

A reactive library that short-circuits identical writes, or that keeps only the newest value per
turn, is therefore **not** trace-equivalent to this runtime. Both are the conventional default. Both
are wrong here.

### C3. `undefined` is never sent

`Node.sendValue` returns before touching the port when the value is `undefined`
([node.ts:688-690](../noodl-runtime/src/node.ts#L688-L690)). A node cannot clear a downstream input
by sending `undefined`; the receiver keeps whatever it last received.

### C4. A signal is an edge-triggered pulse, and every pulse fires

The task doc's "per-frame de-duplication" does not exist. What exists is edge triggering:

> `if (nextValue && currentValue === false) { args.valueChangedToTrue.call(this); }`
> — [edgetriggeredinput.ts:16-23](../noodl-runtime/src/edgetriggeredinput.ts#L16-L23)

and a pulse that carries its own reset. `sendPulse` queues one `SIGNAL_PULSE` entry per receiver
([outputproperty.ts:182-214](../noodl-runtime/src/outputproperty.ts#L182-L214)), and the receiver
applies both edges inside the same drain pass:

> `this.setInputValue(inputName, true); this.setInputValue(inputName, false);`
> — [node.ts:592-600](../noodl-runtime/src/node.ts#L592-L600)

Because the port is returned to `false` before the next queue entry is read, **two pulses in one
frame fire the handler twice.** They are not merged. `_signalsSentThisUpdate`
([node.ts:711-728](../noodl-runtime/src/node.ts#L711-L728)) is not a de-duplicator either — it is
the replay flag for connections created mid-update, and C12 covers it.

The rising edge is the event; the falling edge only re-arms the detector. Splitting the two across
passes is what used to desynchronise a signal from the value it was paired with, which is why the
single-entry `SIGNAL_PULSE` form exists.

### C5. Dirty flagging is idempotent, and the drain is deferred

`flagDirty` returns immediately if the node is already dirty
([node.ts:659-672](../noodl-runtime/src/node.ts#L659-L672)), so a node scheduled ten times in one
turn drains once. The drain itself is the context's, not the node's:
`nodeIsDirty` pushes onto `_dirtyNodes` and asks for an update
([nodecontext.ts:436-439](../noodl-runtime/src/nodecontext.ts#L436-L439)), and `updateDirtyNodes`
processes the list, then the after-update callbacks, then repeats while either produced more work —
up to ten rounds ([nodecontext.ts:355-395](../noodl-runtime/src/nodecontext.ts#L355-L395)).

The observable consequence: **work is batched into a turn**, and observers see the graph settled
rather than mid-cascade. What is batched is *when* the work runs, not *what* — C2 still holds inside
the turn.

### C6. A node pulls its upstream before processing its own inputs

`update` calls `_updateDependencies` first, which calls `update()` on every node feeding an input
([node.ts:562-563](../noodl-runtime/src/node.ts#L562-L563),
[node.ts:650-657](../noodl-runtime/src/node.ts#L650-L657)). A node therefore never computes from a
half-updated upstream, regardless of the order the dirty list happened to be built in. This is what
makes the graph glitch-free, and it is a pull, not a topological sort.

### C7. Multiple input ports advance in lockstep

The drain loop is round-robin across port names, one entry per port per pass
([node.ts:572-609](../noodl-runtime/src/node.ts#L572-L609)). A node fed `[a1, a2]` on one port and
`[b1, b2]` on another sees `(a1, b1)` and then `(a2, b2)` — never `(a1, b1)`, `(a2, b1)`,
`(a2, b2)`. Values that were sent together stay together.

### C8. The first update consolidates

While `_isFirstUpdate` is set, a newly queued value clears the port's queue rather than appending to
it, so a startup cascade settles to one value per port instead of replaying every intermediate
([node.ts:1017-1045](../noodl-runtime/src/node.ts#L1017-L1045)). Signals are exempt, and a unit
carried by the value being overwritten is preserved onto the replacement.

This is the one place the runtime *does* coalesce, and it applies only to a node's first update.

### C9. Runaway work is broken, not thrown

Three limits, all of which yield the frame rather than raising:

| Limit | Where | Effect |
|---|---|---|
| 500 sends on one output within a context iteration | [outputproperty.ts:130-137](../noodl-runtime/src/outputproperty.ts#L130-L137) | `_cyclicLoop`, naming the port |
| 100 update iterations on one node | [node.ts:619-622](../noodl-runtime/src/node.ts#L619-L622) | `_cyclicLoop` |
| 10 rounds of the context drain | [nodecontext.ts:365](../noodl-runtime/src/nodecontext.ts#L365) | remaining work waits for the next frame |

A tripped node is re-flagged for the next frame ([node.ts:629-644](../noodl-runtime/src/node.ts#L629-L644))
so the app degrades instead of freezing.

### C10. Unit-carrying values travel as objects

A value with a unit is `{ value, unit }`, and a bare number written over one inherits the existing
unit rather than dropping it ([node.ts:341-348](../noodl-runtime/src/node.ts#L341-L348),
[node.ts:1031-1040](../noodl-runtime/src/node.ts#L1031-L1040)). Exported code that flattens
`{value: 12, unit: 'px'}` to `12` loses the unit permanently.

### C11. A connection made late catches up

`connectInput` replays: if the source sent a signal during this update the receiver gets the pulse,
otherwise it gets the source's current value unless that value is `undefined`
([node.ts:479-497](../noodl-runtime/src/node.ts#L479-L497)). A subscriber joining after the fact is
therefore not starved — the current value arrives on subscribe.

---

## Part 2 — What `@nodegx/core` implements, and what it deliberately does not

| Clause | In the library | How |
|---|---|---|
| C1 push-notify / pull-value | ✅ | `derived()` is lazy and memoised — it recomputes on read when stale, exactly as `OutputProperty.value` calls its getter |
| C2 every send delivered, no equality short-circuit | ✅ | `Value.set` notifies unconditionally. React's own `Object.is` bail-out in `useSyncExternalStore` absorbs the redundant renders, so faithfulness costs nothing |
| C3 `undefined` is never sent | ❌ by design | A `Value<T \| undefined>` holding `undefined` is ordinary React. The rule is a node-port rule, and EXP-002 applies it at the port boundary it belongs to |
| C4 edge-triggered pulses, each fires | ✅ | `Signal.emit()` invokes subscribers once per emit, synchronously, in subscription order. No merging |
| C5 idempotent dirty flag, deferred drain | ✅ | `batch()` and the turn scheduler; a value written ten times in a turn schedules one observer flush |
| C6 upstream pulled before use | ✅ | Falls out of lazy `derived` — reading a stale derived recomputes it, so a reader can never observe a half-updated chain |
| C7 lockstep across ports | ⚠️ partial | Holds whenever a turn carries one value per source, which is every graph that is not driving a queue at frame rate. The interpreter's per-port queues are **not** reproduced: generating them is precisely the `useEffect`-chain output this phase exists to avoid. EXP-003's harness is where the residue shows up |
| C8 first-update consolidation | ❌ | A startup artefact of interpretation. Exported components initialise once, from props and initial values |
| C9 runaway breakers | ⚠️ dev-only | `configureRuntime({ maxTurnDepth })` throws a named error in development instead of silently yielding. A generated app should not contain a cycle the interpreter had to break |
| C10 unit-carrying values | ❌ | A port-level concern. EXP-002 emits `12px` as a string in the style object, which is what a React developer expects to read |
| C11 late connections catch up | ✅ | `subscribe()` does not fire on subscribe (that would double-fire React's own initial read); `useValue` reads the current value on mount, which is the same guarantee through the idiomatic door |

### The one intentional divergence worth arguing about

**C7.** Reproducing the interpreter's per-port input queues would make exported code trace-identical
and unreadable — it is the "chain of `useEffect` hooks simulating signals" that
`CODE-EXPORT-STUDY.md` identified as the failure mode this whole design avoids. The library instead
delivers synchronously and in order, which agrees with the interpreter for every graph that sends at
most one value per source per turn.

This is a known, bounded, measured gap rather than an oversight, and EXP-003's harness measures it
on real projects. If it turns out to matter outside frame-rate loops, the fix is a generator-side
opt-in queue on the specific ports that need one — not a queue everywhere.

## Part 3 — The turn

The interpreter's turn is a frame: the viewer wires `scheduleUpdate` to `requestAnimationFrame`.
The library's default turn is a microtask, because a React app that waits a frame to reflect a click
feels broken, and because React batches its own event handlers the same way.

The sequence of values and signals observed is identical under both, which is what the trace harness
compares. The scheduler is pluggable exactly so EXP-003 can install a frame scheduler and remove
even that difference:

```ts
import { configureRuntime } from '@nodegx/core';
configureRuntime({ schedule: (flush) => requestAnimationFrame(flush) });
```

---

## Verifying this document

The parity suite in `tests/parity.test.ts` asserts each implemented clause against the library, and
names the clause in the test title. When the trace harness lands, a divergence should be traceable
to a clause here — and if the clause turns out to be wrong about the runtime, this file is what gets
fixed first.
