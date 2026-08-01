# The Outcome Contract

**Status:** decided 2026-08-01 by Richard. Sixth contract in the phase-30 series, after
[`REACTIVITY-CONTRACT.md`](./REACTIVITY-CONTRACT.md),
[`EMPTY-VALUE-CONTRACT.md`](./EMPTY-VALUE-CONTRACT.md),
[`FAILURE-CONTRACT.md`](./FAILURE-CONTRACT.md), [`PORT-TYPE-CONTRACT.md`](./PORT-TYPE-CONTRACT.md)
and [`BINDING-CONTRACT.md`](./BINDING-CONTRACT.md).

**Build task:** phase 35 `ERG-001`.

---

## The problem this contract exists to solve

Phase 30 audited 136 nodes against twelve checks and the same shape kept coming back under
different names:

- **An action node has more possible outcomes than it has ports.** `Insert Object Into Array`
  reports `Done` both when it inserted something and when the item was already there. `Done` means
  two different things and no port distinguishes them, so "add to cart, then animate the new row"
  animates a row that did not appear.
- **Some action nodes emit nothing at all.** Seven of the eight Visual nodes with action inputs
  cannot tell a graph the action finished (FINDINGS **DV-viii**). `Run Tasks` fired `Done` on one of
  four terminal paths, so an empty list — the common case — stopped a graph dead.
- **Each node decided for itself**, so no author can predict from the outside whether a wire will
  ever carry a pulse.

Richard named the consequence precisely:

> some workflows are wired up as a series of input and output signals, and the workflow breaks at
> the point that one of the nodes doesn't output anything because of a duplicate you didn't plan
> for, where you'd actually like it to carry on running regardless.

**A node that emits nothing is a dead chain with no diagnostic.** That is the class this contract
closes.

---

## The contract

### Rule 1 — exactly one terminal signal, always

Every **action** — anything reached by a signal input that does work — ends by emitting exactly one
of three signals:

| Signal | Meaning |
|---|---|
| **`Done`** | The action happened and changed something |
| **`Unchanged`** | The action was valid and the post-condition already held. Nothing needed doing |
| **`Failure`** | The action could not be performed. Always accompanied by a reason on the NDA-004 error channel |

There is no silent path out of an action. "Exactly one" is the load-bearing half: not *at least*
one, so a node cannot report both `Done` and `Failure` for one invocation and leave an author
guessing which arrived first.

**`Unchanged` is not a failure and not a success.** It is the outcome the library has been
collapsing into one or the other, and both collapses cost something: folded into `Done` it lies (the
duplicate-insert case), folded into `Failure` it breaks chains for a state the author explicitly
asked for.

### Rule 2 — a universal `Completed` signal

Alongside the specific outcome, every action also emits **`Completed`** — unconditionally, after any
of the three.

This is how "carry on regardless" is expressed, and it is deliberately **a port rather than a
setting**:

- It is **visible on the canvas.** Someone reading the graph — a person in six months, or the AI
  authoring loop — can see that this chain continues unconditionally. A config checkbox is invisible
  until you click the node.
- It **cannot hide an error.** `Failure` still fires, still carries its reason, still reaches
  `On App Error`. A configuration option that rerouted failures into `Done` would silently swallow
  them, which is how the next generation of this defect gets built.

Strict sequencing wires `Done`. Carry-on-regardless wires `Completed`. Neither requires
configuration.

### Rule 3 — port over setting

> **Prefer a port over a setting whenever both would work. Use a setting only for policy that is
> genuinely project-wide.**

Where a setting *is* right, it follows the shape NDA-003 already shipped on the Variables nodes —
a `Treat empty as` input, because the correct answer really does differ per project. The equivalent
here is:

```
Treat Unchanged as:  Unchanged (default) | Done | Failure
```

That is the escape hatch for a project whose whole idiom is "a duplicate is a bug", and it is one
option on one port, not a panel of signal-routing switches.

⚠️ **Three measured reasons not to reach for configuration first:**

1. **Every option multiplies the test surface and the search space the AI authoring loop reasons
   over.** The loop has to consider each combination as a distinct node behaviour.
2. **A default is a hidden behaviour.** Not theoretical: phase 30's Data pass found `Global Store`,
   `Subscribe to Store` and `State History` **did nothing at all** until an author touched an input,
   because a declared `default` never runs its setter — and the property panel cheerfully displayed
   the default the whole time. FINDINGS **A-D1**.
3. **Wires are visible; settings are not.** An author debugging a graph they did not build should be
   able to read the sequencing off the canvas.

### Rule 4 — connecting a port never changes what other ports do

Stated here because it is the same failure at a different altitude, and it is what
[`NDA-017`](../tasks/phase-30-node-library-audit/NDA-017-SIGNAL-INPUT-FRESHNESS.md) turned out to be
about. Wiring `Run` on an Expression silently flips the node from "recalculate whenever an input
changes" to "never recalculate", with nothing in the panel saying so — which is why authors
hand-build a `Value Changed` node behind `Run` to get the old behaviour back.

**A port's behaviour must not depend on whether a different port happens to be connected.** Where
two modes are genuinely needed, the mode is declared, visible and author-chosen.

---

## What this contract does *not* require

- **A node that cannot fail gets no `Failure` port.** NDA-004 established this and it stands:
  `Create New Array` builds its own collection and cannot fail to find one. Adding a `Failure` to a
  node that cannot fail is the mistake this phase made once already and corrected.
- **A node that cannot be a no-op gets no `Unchanged` port.** Most actions genuinely always change
  something.
- **`Completed` is universal, and it is the one port with no exemption** — because its whole value
  is that an author can rely on it being there.

### The one real exception

**Navigation destroys the graph that would observe the signal.** `Navigate` and friends may complete
in a context where no downstream node still exists. The contract's answer is that they emit on the
paths that *do not* navigate (a drop, a failure, a no-op re-selection of the current page) and
document the successful path as terminal. This is not a licence for other nodes; it is a property of
leaving the page.

---

## Traps, inherited

- ⚠️ **Adding a universally-named port collides with existing ones.** NDA-004 §3 predicted a
  reserved-name cost of adding completion signals and was **right about the wrong node**: on
  `Logic Builder`, which registers block names verbatim, the collision was *already live and silent*
  against the node's existing `error` output and `run` input. FINDINGS **SR-ix**. Sweep for existing
  `Completed` / `Unchanged` / `Done` port names — including dynamic and user-authored ones — before
  the names are reserved.
- ⚠️ **`flagOutputDirty` on a signal output is not a pulse.** It sends a *value* of `undefined`, so
  `Date To String`'s `Invalid Date` had never once fired. FINDINGS **SR-v**. Use
  `sendSignalOnOutput`.
- ⚠️ **Announce after you update.** The phase's most-repeated defect shape is a signal emitted
  *before* the values it is about. Four nodes did it. Send the outcome signal last.
- ⚠️ **One-shot state must be cleared.** `Close Popup` and `Pop Component Stack` latch their first
  outcome and report it again on every later use. FINDINGS **NV-iii**. An outcome is per-invocation.
- ⚠️ **`graph-harness` does not call a module's `setup`.** Three findings this phase lived there.
  If the port set is derived in `setup`, no corpus test sees it.

---

## What it opens up

Recorded because it is the reason to do this as a contract rather than a set of patches:

1. **The semantic validator gains a real check** — "every outcome of this action is unwired" is a
   dead end in a chain, and it becomes machine-detectable.
2. **The AI authoring loop can sequence.** It currently has to guess which port means "then".
3. **Retry becomes expressible generically**, because failure is a declared outcome rather than a
   per-node accident.
4. **The front end and the workflow canvas speak one language.** Phase 27's backend steps are
   already a DAG with outcomes; giving front-end nodes the same vocabulary means a workflow and a
   graph describe sequencing the same way. This is the largest downstream win and it is why the
   contract is worth more than the bug fixes.
