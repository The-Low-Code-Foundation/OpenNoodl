# NDA-017: A signal-driven node cannot tell a fresh input from a stale one

## Metadata

| Field | Value |
|-------|-------|
| **ID** | NDA-017 |
| **Phase** | Phase 30 — Node Library Audit & Remediation (Track O) |
| **Tier** | 2 |
| **Priority** | 🔴 Critical — the reporter abandoned a whole node over it, and the class covers twelve node families |
| **Difficulty** | 🟠 Medium–High — §0 is small, the remedy depends on a decision that may reach the runtime |
| **Estimated Time** | 2 days for §0 + the decision; 1–2 weeks for the chosen remedy |
| **Prerequisites** | NDA-001 (corpus row first), NDA-004 §1 (the error channel is the reporting surface) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔴 **Opus 5** for §0 and §1 (the decision is a runtime-shape question); Sonnet for the build |

> **✅ §0 is done** (`d6db6f39`, 2026-07-30). All four claims reproduce; the spec's mechanism
> survives contact, which is not what happened in NDA-008 §0 or NDA-016 §0. One correction and one
> addition are folded in below — see [§0 — result](#0--result). **§1 is now the blocker**, and it is
> Richard's decision, not a coding task.

## The report

Raised by the Noodl community, recorded 2026-07-30:

> The expression node, when its "Run" connected to some other node and it had ran successfully before
> with a clear output of say an expression A + B (where values of A and B is coming from other nodes
> like array or a func) it gives out the same previous output of A+B when its "Run" gets triggered
> again but the values coming for A or B from other nodes gets failed to run/couldn't run on time so
> it gives out the outdated value as an output which messed up the whole logic, so basically i was fed
> up with the memory mess of nodes, had to use function node many times in places where even a simple
> expression node would be suffice.

The last clause is the part worth keeping: the workaround was to stop using the node. And the
workaround does not work — the Function node has the identical idiom, and is *more* exposed to it,
because `runScript` is `async` so its own outputs land a turn late by construction.

## The defect

Every node in this class is built the same way: the value setters go passive the moment the control
signal is connected, and the signal handler evaluates whatever happens to be in the scope object.

`Expression` is the reported instance
([`expression.ts:120-125`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L120-L125)):

```ts
this.registerInput(name, {
  set: function (value) {
    this._internal.scope[name] = value;
    if (!this.isInputConnected('run')) this._scheduleEvaluateExpression();
  }
});
```

…with the same guard repeated at [`:286`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L286),
[`:312`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L312) and
[`:321`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L321), and `Run` doing
nothing but evaluating ([`:328-330`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L328-L330)).

The scope entry is *never wrong* in the sense the node can detect. It holds the last value that
arrived, which is either (a) the value the author meant, (b) a value from a previous cycle, or
(c) the seed. There is nothing in the node, and nothing in `Node`, that distinguishes the three.

**Three separate ways it goes wrong, and only the first is a first-run problem:**

1. **The seed is a plausible number.** `registerInputIfNeeded` seeds every discovered input to `0`
   before any value has arrived
   ([`expression.ts:117-118`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L117-L118)).
   A `Run` that fires before the producers have ever produced evaluates `A + B` as `0 + 0` and emits
   `0` — the exact NDA-004 class-B shape, a plausible value rather than a visibly broken one. Note
   that this seed is also what makes `Failure` *safe* on this node
   ([`FINDINGS.md` B-iii](./FINDINGS.md), and the comment at
   [`expression.ts:154-158`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L154-L158)) —
   the same design choice that closed one defect is what hides this one. Both readings are correct;
   they are answering different questions.
2. **A previous cycle's value, which is the reported case.** The producer is async — a Function that
   awaits, an HTTP Request, a record query — so on the tick `Run` fires, the port still holds the
   answer from last time. `scheduleAfterInputsHaveUpdated`
   ([`node.ts:767`](../../../packages/noodl-runtime/src/node.ts#L767)) drains the *synchronous*
   pending queue and then runs, which is why this is invisible for sync producers and unavoidable for
   async ones.
3. **The unchanged-output gate hides it downstream.** `_scheduleEvaluateExpression` only re-flags
   `result`/`isTrue`/`isFalse` when the value differs from the last one
   ([`expression.ts:133-139`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L133-L139)),
   while `On True`/`On False` fire on *every* evaluation
   ([`:140-141`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L140-L141)). So a
   stale evaluation still pulses a signal downstream while the value port stays quiet — the graph acts
   on a re-assertion of the old answer. This is what "messed up the whole logic" describes.

### The class is twelve node families, not one

The `connected control signal ⇒ passive setters` idiom, grepped across the runtime and the viewer:

| Node | Control signal | Guard |
|---|---|---|
| Expression | `run` | [`expression.ts:123`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L123) + 3 more |
| Function | `run` | [`simplejavascript.ts:156`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts#L156), [`:287`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts#L287) |
| Condition | `eval` | [`condition.ts:49`](../../../packages/noodl-runtime/src/nodes/std-library/condition.ts#L49) |
| User | `fetch` | [`user.ts:79`](../../../packages/noodl-runtime/src/nodes/std-library/user/user.ts#L79) |
| Variable | `saveValue` | [`variablebase.ts:115`](../../../packages/noodl-runtime/src/nodes/std-library/variables/variablebase.ts#L115) |
| Record (BYOB) | `fetch` | [`dbmodelnode2.ts:107`](../../../packages/noodl-runtime/src/nodes/std-library/data/dbmodelnode2.ts#L107), [`:201`](../../../packages/noodl-runtime/src/nodes/std-library/data/dbmodelnode2.ts#L201) |
| Filter Records | `filter` | [`filterdbmodelsnode.ts:97`](../../../packages/noodl-runtime/src/nodes/std-library/data/filterdbmodelsnode.ts#L97) + 8 more |
| Query Records | `storageFetch` | [`dbcollectionnode2.ts:149`](../../../packages/noodl-runtime/src/nodes/std-library/data/dbcollectionnode2.ts#L149) + 6 more |
| Object | `fetch` | [`modelnode2.ts:83`](../../../packages/noodl-runtime/src/nodes/std-library/data/modelnode2.ts#L83), [`:171`](../../../packages/noodl-runtime/src/nodes/std-library/data/modelnode2.ts#L171) |
| Text Input | `set` | [`text-input.ts:114`](../../../packages/noodl-viewer-react/src/nodes/controls/text-input.ts#L114) |
| Component Object | `fetch` | [`componentobject.ts:46`](../../../packages/noodl-viewer-react/src/nodes/std-library/componentutils/componentobject.ts#L46) |
| Parent Component Object | `fetch` | [`parentcomponentobject.ts:86`](../../../packages/noodl-viewer-react/src/nodes/std-library/componentutils/parentcomponentobject.ts#L86), [`:106`](../../../packages/noodl-viewer-react/src/nodes/std-library/componentutils/parentcomponentobject.ts#L106) |

The idiom itself is right — "don't fire on every keystroke, fire when I say" is the whole point of a
control signal. What is missing is any account of what the node should do when it is told to fire and
its inputs are not ready.

## §0 — Reproduce it, three ways (blocking)

Build the corpus rows before anything else. Each is a distinct claim above and each must go red on
its own:

1. **Seed.** Expression `A + B`, both inputs fed by a Function that resolves after a tick, `Run`
   pulsed immediately. Assert the emitted `Result` is not `0`. *(Fails today.)*
2. **Previous cycle.** Same graph, run twice with different upstream values, the second `Run` fired
   before the producers settle. Assert the second `Result` reflects the second inputs. *(Fails
   today.)*
3. **Signal without value.** Same graph, upstream unchanged. Assert `On True`/`On False` does not
   pulse a re-assertion downstream while `Result` stays quiet — or, if that is deliberate, that the
   two agree. *(Reproduce, then decide; this one may be a documentation fix, not a code one.)*

Do row 2 against the **Function** node as well, not only Expression. If it reproduces there, the
reporter's workaround is not a workaround and the finding is a class, not a node.

## §0 — result

Done in `d6db6f39`. Ten rows in
[`packages/noodl-runtime/test/corpus/nda-017-signal-input-freshness.test.ts`](../../../packages/noodl-runtime/test/corpus/nda-017-signal-input-freshness.test.ts);
four `test.failing`, six pinned.

**Every claim above reproduced, including the one about the Function node.** Row 4 is the one that
changes the shape of the task: the reporter said they had "to use function node many times in places
where even a simple expression node would be suffice", and Function re-publishes the previous cycle's
answer under identical conditions. The workaround bought nothing, and "twelve families, not one node"
is measured rather than grepped.

**The frame discipline is the reusable half.** `graph.update()` is synchronous — it drains the dirty
list and the after-update callbacks without yielding — while `settle()` awaits the macrotask queue
between frames. A producer that lands its value from a `setTimeout` therefore *cannot* have landed
across an `update()`, which is exactly the real timing: `Run` on one frame, the async answer some
frames later. **A row written with `settle()` lets the producer win the race and reports this defect
as absent.** Anything else in this class needs the same care.

**Discrimination, against the mechanism rather than a fix** (a §0 has no fix to revert). Dropping the
`run` guard from Expression's two value setters reddens exactly the passivity control and the "never
corrects it" characterisation, and moves neither Function row. Dropping it from
`setScriptInputValue` reddens exactly the two Function rows and moves nothing in Expression. The
guard is therefore the mechanism, and the two nodes are independent instances rather than one
measurement leaking into the other.

### The correction: a fifth route to the plausible value, with no signal involved

§0 predicted the seed reaches the graph through an early `Run`. It also reaches it **with no `Run` at
all**.

With the control signal connected, the node never evaluates at boot — `signalsFor('expr')` is empty
for the whole of it, because `isTrueEv`/`isFalseEv` fire on *every* evaluation and neither appears.
Yet a downstream node still receives a confident `0`: `connectInput` pushes the source's current
output when the wire is made, and `result`'s getter answers over the initial `cachedValue`.

That is row 1's shape — a plausible value standing in for "no answer yet" — arriving by a route the
spec did not consider, and it matters for §1: **option A as written does not reach it.** "On the
control signal, if any connected input is still on its seed, report" cannot fire when no control
signal is involved. Whatever §1 chooses has to say what a signal-driven node publishes before its
first evaluation, or the remedy closes three of four doors. Pinned by its own row so the decision is
made against the whole surface.

### Row 3, measured

The asymmetry is real and is observable only downstream: two `Run` pulses with nothing changed
upstream deliver **two** signal pulses and **one** value. `_scheduleEvaluateExpression` re-flags
`result`/`isTrue`/`isFalse` only when the value differs (`expression.ts:133-139`) while
`isTrueEv`/`isFalseEv` fire unconditionally (`:140-141`). Reading the node's own outputs shows the
cached value and misses this entirely. Left as a characterisation row, not a `test.failing` one —
whether the two ports *should* agree is §1's call, and the row exists so that call is made against a
measurement.

## §1 — The decision (put to Richard before building)

The remedy is not obvious and the options differ by an order of magnitude in cost.

- **A — never-arrived detection.** Track, per discovered input, whether a value has ever been
  received. On the control signal, if any *connected* input is still on its seed, report
  `expression/inputs-never-arrived` through the NDA-004 channel and pulse `Failure` instead of
  evaluating. **Closes case 1 only.** Cheap, local, and reuses machinery that exists.
  - ⚠️ **Amended by §0.** As written this closes case 1 only *on the control signal*. §0 measured a
    second way the seed reaches the graph — the connect-time push of `result`'s getter, before any
    evaluation has ever happened — which no control-signal check can intercept. If A is chosen it
    needs a companion answer for what the node publishes before its first evaluation (candidates: no
    push until evaluated, or a declared "not yet evaluated" value). Otherwise the seed keeps its
    quietest route.
- **B — an upstream-pending notion in the runtime.** Async nodes declare themselves in flight; a
  signal-driven consumer that evaluates while a connected producer is pending reports it. **Closes
  case 2, which is the reported one.** Costs a new runtime-wide concept and an opt-in from every
  async node. This is the honest fix and the expensive one.
- **C — sequencing, made discoverable.** The correct dataflow answer already exists: trigger `Run`
  from the producer's *completion* signal, which NDA-004 §3 has now given to Function, HTTP Request
  and the record nodes. This is a documentation and AI-authoring-loop fix (NDA-005, and the semantic
  validator can flag "a `Run` driven by something other than its inputs' producers"). **Closes
  nothing at runtime, prevents the graph being built wrong in the first place.**
- **D — do nothing and say so.** Declare stale-on-signal the documented semantics of the class.

**Recommendation: A + C now, B as a separate decision.** A is small and closes a genuine
class-B-shaped defect. C is where the reporter's actual case gets solved, and it is cheap because the
completion signals already exist — what is missing is that nothing tells an author to use them. B
should not be smuggled in as an implementation detail of this task; a pending/in-flight concept in the
runtime is a phase-sized decision on its own and wants Richard's yes before a line of it is written.

Note that A and D are in tension with the NDA-004 §2 reasoning for this node, which relied on the `0`
seed meaning "there is no window in which the ports exist but hold nothing". Whichever way this goes,
the comment at [`expression.ts:154-158`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L154-L158)
needs updating so the next reader does not re-derive the opposite conclusion.

## §2 — Build the chosen remedy

Scope depends on §1. Whatever is chosen applies to **the whole table above**, not to Expression alone;
a fix that lands only on the reported node leaves eleven families with the same hole and the next
report will read the same.

## Success criteria

1. ✅ The §0 corpus rows exist and each reddens only its own claim (`d6db6f39`; discrimination run
   twice, against Expression's guard and against Function's).
2. Richard's §1 decision is recorded in this file, with the veto window closed.
3. The chosen remedy is applied across every node family in the table, or the exceptions are named
   with a reason.
4. The reported graph — Expression driven by `Run`, inputs from an async producer — behaves as
   decided, verified in the running editor and not only in jest.
5. `expression.ts:154-158` and the NDA-004 register entry agree with whatever §1 decided.
6. If C is in scope: the port docs for every control signal in the table say what happens when the
   inputs are not ready, and the semantic validator flags the mis-sequenced graph.

## Out of scope

- A general async/await model for the node graph. B's pending notion, if taken, is a *diagnostic*,
  not a scheduler — it reports that a node evaluated too early, it does not delay the evaluation.
- Reactivity (NDA-002). This is not a missing notification; the notification arrives, just later than
  the signal that consumed the value.
