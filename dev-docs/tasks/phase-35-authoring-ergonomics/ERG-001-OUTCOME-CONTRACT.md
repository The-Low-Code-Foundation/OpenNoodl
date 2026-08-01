# ERG-001 — The outcome contract

| Field | Value |
|---|---|
| **Tier** | 1 |
| **Prerequisites** | NDA-004 (the error channel and per-node `Failure` outputs — done) |
| **Contract** | [`OUTCOME-CONTRACT.md`](../../reference/OUTCOME-CONTRACT.md) — read it first; it is the decision, this is the build |
| **Recommended executor** | 🔴 Opus for §0 and §1 (a library-wide port addition with a naming collision risk); Sonnet for the per-node sweep |
| **Blast radius** | Every action node in the library. Treat as phase-sized |

## Objective

Make every action in the node library end in exactly one of `Done` / `Unchanged` / `Failure`, and
give every action a universal `Completed` signal, so that a signal chain can never break in silence.

## Why this is not a set of patches

Phase 30 fixed this defect one node at a time, eleven times, under four different task numbers, and
the eleventh (`Run Tasks`, 2026-08-01) was still finding new instances — two of them permanently
disabling the node for the life of the page. The per-node approach was measured and it does not
converge. FINDINGS **DC-i**'s lesson stated generally: *a node audited for one contract is not an
audited node.*

## §0 — Measure the ground first (blocking)

Every section below assumes facts that must be re-derived, not inherited. Three of phase 30's
sessions lost time to a handover figure that was stale by the work that wrote it.

1. **Enumerate the actions.** A node with at least one signal input that does work. Expected to be
   roughly the ~50 NDA-004 §2 swept plus the mute set §3 closed, but derive it from the catalog
   (`packages/noodl-types/src/node-catalog.json`) rather than from either register.
2. **⚠️ Sweep for name collisions before reserving anything.** `Completed`, `Unchanged` and `Done` as
   existing port names — **including dynamic and user-authored ports.** NDA-004 §3 predicted this
   cost and was right about the wrong node: on `Logic Builder`, which registers block names
   verbatim, the collision was *already live and silent* against the node's own `error` output and
   `run` input. FINDINGS **SR-ix**. The lesson recorded there is the one to apply: **check whether a
   stated cost is already being paid.**
3. **Classify each action's real outcome set.** Three columns: can it fail, can it legitimately
   no-op, does it already emit anything. ⚠️ **Do not derive "can it fail" from the port names** —
   `worksheets.js:55` did exactly that (matching `/fail|error/i` against output *names*, so a plain
   string port called `Error` satisfied it) and **fifteen categories were audited from that column.**
4. **Write the corpus rows before the ports.** Each new signal needs a row that is red now, and a
   control row beside it that must stay green. The discrimination standard this phase settled on:
   predict which rows a revert reddens *before* running it.

**§0 output:** a table of every action, its outcome set, its existing signals and its collisions. That
table is the task's scope and nothing should be built before it exists.

## §1 — The runtime shape

The three-outcome emit and the universal `Completed` must exist in **one** place, not per node. Phase
30's clearest structural finding is that a rule implemented per node diverges: `NDA-015` claimed to
have de-duplicated a helper and had in fact done **1 of 4 call sites**, leaving a reader and a writer
of the same state resolving to different components (FINDINGS **F-i′**).

Requirements:

- One helper that an action calls to report its outcome. It emits the specific signal, then
  `Completed`, in that order.
- **Exactly one**, enforced — a second call for the same invocation is a defect the helper can catch,
  and should.
- `Failure` continues to raise on the NDA-004 channel with a code and a message. `Unchanged` does
  **not** raise; it is not an error.
- ⚠️ **Use `sendSignalOnOutput`, never `flagOutputDirty`.** On a signal output the latter sends a
  *value* of `undefined` rather than a pulse, which is why `Date To String`'s `Invalid Date` had
  never once fired. FINDINGS **SR-v**, and PLAT-003 NOTES §25 had written the line down and correctly
  left it alone.
- ⚠️ **Emit last.** The most-repeated shape in the phase is a signal sent *before* the values it
  describes, found in four nodes. The outcome signal is the last thing an action does.
- ⚠️ **Outcome state is per-invocation and must be cleared.** `Close Popup` and `Pop Component Stack`
  latch their first result and report it again on every later use — invisible to any test that
  exercises the node once. FINDINGS **NV-iii**.

## §2 — The `Unchanged` outcome, and the node that raised it

`Insert Object Into Array` is the worked example and should be built first as the reference
implementation.

**Facts, measured:** `Array.prototype.add` early-returns when the array already contains the item
(`collection.ts:590-604`). Two `Do` pulses with the same `Object Id` leave the array at size 1 and
signal `Done` both times.

**The verdict:** `Unchanged`. Not `Done` (it is a lie, and it is why "add to cart then animate the new
row" animates a row that did not appear); not `Failure` (it overstates a state the author explicitly
asked for, *and* it breaks the chain — the exact problem Richard raised).

**Do not confuse it with `Remove Object From Array`**, which phase 30 already changed (DA-vi) and for
a different reason: there the operation *cannot* succeed, because `Model.get` mints a record on read
so an unloaded id produces an object that is by construction not in the array. That is impossible,
not redundant. The distinction is the one that makes `Unchanged` a real third category rather than a
softer `Failure`.

## §3 — `Treat Unchanged as`

The per-node policy input, following the shape NDA-003 shipped on the Variables nodes:

```
Treat Unchanged as:  Unchanged (default) | Done | Failure
```

⚠️ **A declared `default` does not run its setter.** Phase 30's Data pass found `Global Store`,
`Subscribe to Store` and `State History` did nothing at all until an author touched an input for
exactly this reason, and the panel displayed the default the whole time (FINDINGS **A-D1**). The
default behaviour must be correct *without* the setter having run.

## §4 — The per-node sweep

Apply the contract to every action in §0's table. Batchable, and phase 30's parallel-batch experience
says how:

- **Disjoint file sets per worker**, with the catalog, the enrichment layer and any shared worksheet
  taken away from workers entirely and merged centrally. Four workers, four disjoint sets, **zero
  merge conflicts** on 2026-08-01.
- ⚠️ **A parallel batch is only as safe as its last commit.** Three Visual workers were terminated
  mid-task by a spend limit having committed nothing; the work was salvageable only because the
  orchestrator reviewed and pinned it by hand. FINDINGS **DC-iv**.

## §5 — Documentation and the loop

- Every new port gets a `description`. **`description` is canonical** (Richard, 2026-08-01):
  enrichment `ports` may only add what the source cannot know, and `tooltip` is display-only and
  derived. Write it into `NDA-005-PORT-DOCUMENTATION.md` if it is not already there.
- The semantic validator gains the dead-end check: *every outcome of this action is unwired.*
- ⚠️ **A node whose ports arrive via `sendDynamicPorts`, `numberedInputs` or the Port Editor panel has
  no `description` channel at all** (FINDINGS **SR-ii**). If any action's outcome ports arrive that
  way, this task inherits ERG-005's problem — check before assuming the sentence lands anywhere.

## Success criteria

1. §0's table exists and is derived from the catalog, not from a handover.
2. No action node in the library can complete without emitting exactly one of the three outcomes.
   Demonstrated by corpus rows, with controls, and by a revert whose reddened rows were predicted
   in advance.
3. `Completed` exists on every action and fires after all three outcomes.
4. The collision sweep ran, and its result is recorded even if it was empty.
5. `Insert Object Into Array` reports `Unchanged` for a duplicate, and a corpus row pins that
   `Completed` still fires.
6. The validator flags an action with every outcome unwired.
7. Every new port carries a `description`; the catalog is regenerated and all three catalog gates
   pass. ⚠️ `catalog:check` can pass while `catalog:merge` and `cloud-library:check` are stale — run
   all three.
8. Live QA: one graph in the running editor where a duplicate insert continues through `Completed`
   and stops at `Done`. A static measurement cannot establish this — see DV-ii's rule: *a mechanism
   defect and its consequence are two different claims.*
