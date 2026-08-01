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
> addition are folded in below — see [§0 — result](#0--result).
>
> **✅ §1 was decided by Richard on 2026-08-01, and with none of the four options below.** See
> [§1 — the decision as taken](#1--the-decision-as-taken). ⚠️ **The options and the
> recommendation further down are kept as the record of what was proposed and rejected. Do not
> build from them.**
>
> **✅ §2 is built and live-verified** (`213cf337`, `b6dc078a`, `21eda2b0`, + the live-QA fixes,
> 2026-08-01) — fifteen node families, the twelve in the table plus three the table missed.
> **All six criteria are met as of 2026-08-01.** Criterion 6's semantic-validator half landed as
> the `signal-driven-stale-input` rule — ⚠️ **narrowed from the criterion's literal wording, which
> would flag the canonical correct graph.** See [Success criteria](#success-criteria) 6.
>
> ⚠️ **Live QA found three defects that every jest row missed, and two of them predate this
> task.** See [§3 — live QA](#3--live-qa). If you take one thing from this file: the corpus set
> checkboxes with `setInputValue` on a graph that was already built, and a *saved project*
> applies the parameter first. That single ordering difference was the whole gap.

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

## §1 — the decision as taken

**Richard, 2026-08-01. A fifth option: a per-input "Run on value change" checkbox in the node's
config panel.**

⚠️ **The four options below were all rejected, and the reason is worth more than the choice.**
A, B and C treat *staleness* as the defect. Richard identified the one underneath it:
**connecting `Run` silently changes what every other port does.** The node flips from
"recalculate on any input change" to "never recalculate" and nothing says so — which is why
authors hand-build a `Value Changed` node behind `Run`, restoring a behaviour that wiring an
unrelated port took away. A only *reports* that trap. The checkbox removes it.

Five constraints, each of which is a way the build can reintroduce what it was meant to fix:

1. **`Run` is purely additive.** The checkboxes are the only thing governing auto-run. Wiring
   `Run` never un-ticks anything — auto-clearing would make the trap visible rather than remove
   it.
2. **Default is every input ticked**, which is today's behaviour for a node with no `Run`. And a
   declared `default` never runs its setter (A-D1), so absent must *read* as ticked; the default
   cannot live on the port.
3. **Several ticked inputs changing in one frame produce one run, not three.**
4. **A node that has never evaluated reports `null`**, not the confident value its getter pushes
   at connect time. This answers §0's companion question.
5. **Keep the `Run` port.** An async re-fetch returning an identical value fires no change, so a
   node that must re-run per fetch still wires `Run` to a completion signal. That is option C's
   correct dataflow, now coexisting with the checkboxes instead of fighting them.

### What §2 actually built

`packages/noodl-runtime/src/run-on-value-change.ts` owns the mechanism and the reasoning. One
`boolean` `runOnChange-<input>` port per governed input, grouped and `allowEditOnly`;
`shouldRunOnValueChange()` on `Node.prototype`; a `runOnValueChange` field on the node definition
so a family with declared inputs joins the class in three lines.

**Fifteen families, not twelve.** The table below was built by grepping the guard; grepping it
again found three more creatable non-deprecated nodes — Array, Variable (viewer) and Array
Filter — one of which the code already calls a twin of a node that *is* in the table.

**⚠️ The table's "same idiom" claim does not survive reading it.** Only five families suppress a
value *setter*. The rest suppress a *subscription*: `onModelChangedCallback` opens with
`if (isInputConnected('fetch')) return;`, so the control signal stops the node reacting to the
record it is displaying. Same trap, no port to hang a checkbox on. Hence `sources` alongside
`inputs` in the definition field.

**⚠️ One place the build does not follow the decision word for word, and it is deliberate.** The
*definition* port — `expression`, `functionScript` — keeps the old
`!isInputConnected('<control signal>')` guard. It is not a value input, it is set at load on
every node in the project, and dropping it would run every `Run`-driven script once at load,
including the ones that POST. Recorded at both call sites and here rather than buried.

**⚠️ And one thing no remedy could have done.** A `Run` fired while the producers are in flight
still reads the previous cycle's values, because nothing in a dataflow graph can read a value
that has not arrived. What it no longer does is *stay* there. Only option B could even have
reported it, and B was not taken. Pinned as a characterisation row.

### The regression the fix caused, and what caught it

Seeding discovered inputs to `undefined` instead of `0` made `a.missing.deeper` **throw at
load** — before anything had arrived — and `_reportFailure` duly raised `expression/threw` and
pulsed `Failure`. That is the exact state the Failure Contract forbids: *an unset input is not a
failure.* The old `0` seed hid it by making the boot evaluation succeed on a value nobody
supplied — the same trade this whole task is about, one level down.

Caught by the **NDA-004 §2 corpus**, not by NDA-017's own rows. Fixed with a gate on *automatic*
evaluation, keyed to the ports the expression **references** rather than the ports that happen to
be registered: `2 + 2` with a stray connection has one registered input, references none, and
must not abstain forever waiting for it.

That corpus row's premise — *"inputs are seeded to 0, so there is no values-have-not-arrived
state to fail in"* — is withdrawn in place, in the corpus and in the comment at `expression.ts`
that stated it. Both readings were right about their own question.

---

## §1 — the options as proposed, and rejected

⚠️ **Kept as a record only.** Richard chose none of these; see above.

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

## §2 — the remedy, built

`213cf337` (mechanism + Expression + Function), `b6dc078a` (the remaining ten of the table),
`21eda2b0` (the three the table missed). Fifteen families.

### Discrimination

Three cuts against Expression, each predicted before running:

| Reverted | Predicted red | Actual |
|---|---|---|
| the value-setter guard | 4 | **4** — row 2 settled, ticked-default, per-input, coalescing |
| the `undefined` seed | 2 | **2** — row 1 and its `NaN` characterisation |
| the abstaining getters | 3 | **4** — I missed that the untick control also asserts the abstention |

Function's rows move under none of Expression's cuts: two instances, not one measurement leaking
into the other.

⚠️ **The untick control stays green when the guard is reverted, and that is not a bug in the
row.** A reverted guard and an unticked box produce the *same reading* — this is stream B's
"both outcomes coincide in the fixture's state", met again. The row that discriminates is the
**ticked-default** one beside it, and the pair is what proves the mechanism rather than either
alone.

## §3 — live QA

Fixture generator: `scripts/nda-live-qa/make-run-on-change-fixture.js`. Four sections, one per
claim; nothing sets a `runOnChange-…` parameter except the one node that exists to prove
unticking works, because every claim here is about a port the author has **not** touched.

### Measured, in the running editor and its preview

| Claim | Reading |
|---|---|
| Constraints 1+2 — `Run` wired, never pressed, nothing unticked | Typing into `a` re-ran the node: `cached: "182"`, `scope: {a:"18", b:"2"}`. Before §2 it would have sat on its boot value |
| Constraint 2, per-input | With `a` unticked, typing into `a` moved `scope.a` to `"19"` and left `cached` at `"12"`. Typing into `b` then re-ran and picked up **both**: `"1927"` |
| Constraint 4 | The never-fed Expression: `hasEvaluated: false`, `cached: null`, and its Text renders **blank** rather than `0` |
| The reporter's node | Function published `6` from `Inputs.p = '3'` with no `Run` press |
| The panel | A "Run On Value Change" group renders with one checkbox per input, ticked, and unticked where authored |

No editor warnings, no runtime errors in `.logs/dev.log`.

### Three defects live QA found, and why jest could not

⚠️ **1 — the checkboxes rendered *unticked* on a node that was running ticked.** The runtime
reads absent-as-ticked; the panel reads the port's declared `default`, and there wasn't one. So
the affordance said "off" while the node ran on — worse than the trap it replaced, because the
old trap was at least silent rather than actively wrong. Fixed by declaring `default: true`
*as well as* keeping the absent-as-ticked rule. The two are needed together **because** A-D1 is
true: the default never runs its setter, which is exactly what makes it safe as a panel-only
declaration and exactly why the runtime cannot rely on it.

⚠️ **2 — unticking a box broke the Expression node outright.** A saved `runOnChange-a`
parameter is applied *before* the port it governs exists, so it reached
`registerInputIfNeeded`, and Expression's override mints any unrecognised name as a discovered
expression input. The `false` landed in `_internal.scope`; the real checkbox was then never
registered; and `_compileFunction` builds its argument list from `Object.keys(scope)`, so
`Function` was constructed with a parameter called `runOnChange-a`, threw, and **the node
evaluated to `0` for the rest of the session.** Measured as `cached: 0` on a node whose inputs
were `'1'` and `'2'`.

**The corpus could not have caught it, and the reason is worth carrying: a test sets a
parameter with `setInputValue` on a graph that has already been built, so the port always
exists first. Only a saved project applies the parameter first.** There is now a row that loads
the parameter from `data.components[].nodes[].parameters`, which is the only shape that
reproduces it.

⚠️ **3 — two older bugs in `defineNode`, surfaced by fixing 2.** Wrapping
`registerInputIfNeeded` centrally (the same "wrap, don't replace" pattern `registerNumberedInput`
already uses) was impossible, because:

- `Object.create` defaults a descriptor to non-writable and non-configurable, so **every method
  declared in `methods:` landed on the prototype frozen.** `registerNumberedInput` and
  `makeNodeInert` both assign over `registerInputIfNeeded`, so they worked only on nodes that
  did not declare one. `eventsender.ts` hits the same thing in a second spelling — it writes its
  method as a hand-rolled `{ value: fn }` descriptor.
- and the normalisation loop **mutated `opts.prototypeExtensions` in place**, so `defineNode`
  was not idempotent: a second call on the same module object — which the corpus does whenever
  two graphs register the same node — reused the frozen descriptors.

Both fixed. Neither is NDA-017's, and neither had a symptom until something tried to wrap a
method.

## Success criteria

1. ✅ The §0 corpus rows exist and each reddens only its own claim (`d6db6f39`; discrimination run
   twice, against Expression's guard and against Function's).
2. ✅ Richard's §1 decision is recorded in this file (see [§1 — the decision as
   taken](#1--the-decision-as-taken)), with the veto window closed.
3. ✅ The chosen remedy is applied across every node family in the table — and three more the
   table did not have. No exceptions at family level. One *site* is excepted with a reason: the
   definition port, above.
4. ✅ The reported graph — Expression driven by `Run`, inputs from a producer — verified in the
   running editor, and the Function node beside it. See [§3](#3--live-qa). It found three
   defects, one of which made unticking a box break the node.
5. ✅ `expression.ts`'s NDA-004 comment is rewritten in place, and so is the corpus row that
   asserted the same premise.
6. ✅ **Both halves, 2026-08-01.** Every control signal in the class says in its `description`
   that it is *additional* and points at the checkbox group — seven descriptions that stated the
   trap as if it were the design are gone. The semantic-validator half is now built as
   `signal-driven-stale-input`
   ([`rules/signalDrivenStaleInput.ts`](../../../packages/noodl-editor/src/editor/src/validation/rules/signalDrivenStaleInput.ts)),
   `warning`, on by default, 7 rows in `rules.test.ts`.

   ⚠️ **It is deliberately not the rule this criterion asks for, and the literal one is
   unbuildable.** The criterion says *"a `Run` driven by something other than its inputs'
   producers"*. A Button driving `Run` while the values come from Text Inputs is the single most
   common **correct** graph in the library — it is the reporter's own working graph — and the
   literal reading flags every one of them. This module treats false positives as its primary
   risk, and a rule that fires on the canonical correct pattern is a rule nobody leaves on.

   The rule narrows to the condition that actually makes a `Run` unsafe: **the value comes from
   an asynchronous producer and the signal does not wait for it.** All three must hold — the
   consumer is in one of §2's families (derived from the catalog's `runOnChange-*` ports, not
   listed in the validator); a connected value input comes from a producer publishing a
   *completion* signal (`Success`/`Done`/…, which is what "asynchronous" means here — `Failure`
   alone does not qualify, or most of the library would); and no connected signal input is
   reachable backwards over signal wires from that producer's completion. When the third fails,
   the graph is the correct dataflow answer `run-on-value-change.ts` names as the reason `Run` is
   kept, and nothing is reported.

   **Measured against the false-positive corpus before it was written up: 12 firings, all in one
   legacy project (`git-repo-utf8`), 0 in the other eight, 0 errors introduced.** Every firing is
   the reported defect's own shape — a `Condition` reading `net.noodl.user.User`'s value with
   `eval` driven by something that does not wait for `fetched`, and a `Function` reading a
   collection the same way. Three of the seven test rows are controls, each a graph the literal
   reading would have flagged.

## Out of scope

- A general async/await model for the node graph. B's pending notion, if taken, is a *diagnostic*,
  not a scheduler — it reports that a node evaluated too early, it does not delay the evaluation.
- Reactivity (NDA-002). This is not a missing notification; the notification arrives, just later than
  the signal that consumed the value.
