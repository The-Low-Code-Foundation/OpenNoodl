# TALK-006 — Done / Completed / Unchanged: the semantics are fine, the surface is missing

Covers reported item **0**. A brainstorm doc, because the fix is partly a vocabulary decision.

## What was reported

> The new 'Done' and 'Completed' signals being on all logic nodes is great, but the semantics aren't
> clear at all. Sometimes you see 'Done', 'Completed', 'Unchanged' which I think is doubling up
> because I thought Done meant the node ran and it outputs a signal no matter if it changed or not?
> And Completed is only when the node took some action?

## First: the actual semantics, as decided and as built

Your own decision record (`dev-docs/reference/OUTCOME-CONTRACT.md`, decided 2026-08-01) — and the
guess above is **backwards**:

| Port | Means | Enforced at |
|---|---|---|
| **Done** | The action happened **and changed something** | `node.ts:882-883` |
| **Unchanged** | The action was valid and the post-condition already held — nothing needed doing | explicit no-op guards, e.g. `switch.ts:119-122`, `counter.ts:51-53` |
| **Failure** | Could not be performed; reason on the error channel | `node.ts:868-880` |
| **Completed** | Fires after **every** invocation, whatever the outcome — "carry on regardless" | `node.ts:894-895`, unconditional, single emit site |

Exactly one of Done/Unchanged/Failure per invocation (duplicate-report raises at `node.ts:856-865`),
then Completed, always. There is a `Treat Unchanged as` advanced input on the four Variables nodes.
The contract exists because of your own words in it: *"the workflow breaks at the point that one of
the nodes doesn't output anything because of a duplicate you didn't plan for, where you'd actually
like it to carry on running regardless"* — Completed is that carry-on wire.

So no, it is not doubling up **where Unchanged exists** — the three are cleanly disjoint there.

## Why it reads as unclear anyway — three real findings

**1. The descriptions exist and render nowhere.** Every one of the 82 adopting nodes has a bespoke,
correct `Done` description in the catalog — and signal ports have no property row by design, and the
canvas port hover renders nothing. `ERG-004-NOTES.md:596-598` already names this: *"a signal port's
description now exists, is correct, and still has nowhere to appear."* You are guessing at three
unexplained pulse ports because the editor gives you literally zero words about any of them.

**2. On 48 of the 82 nodes the distinction genuinely collapses.** Only 34 nodes have an `Unchanged`
port (they're the ones with a real no-op guard). On the other 48, `Done` degenerates into "it
worked" and adds nothing over `Completed` except excluding Failure. On **8 nodes** — including
`Condition`, a Logic node — there is no Unchanged *and* no Failure, so `Done` and `Completed` are
literally the same pulse: `Collection2`, `CollectionNew`, `Condition`, `NewModel`, `Page`,
`Unique Id`, `ComponentObject`, `SetComponentObjectProperties`.

**3. `Condition` is a semantic outlier by design.** Its `Done` means "an Evaluate you triggered
finished", not "something changed" (`condition.ts:136-145` argues this deliberately — testing a
condition always needs doing). The contract's headline sentence does not describe it. Also noted in
passing: `Counter.Reset` has a kept-verbatim defect (`counter.ts:84-98` reads `this.currentValue`
instead of `_internal`) so Reset can never report Unchanged.

## The conversation

**Q1 — Do the 8 double-pulse nodes keep both ports?** Options:

- **(a) Keep both everywhere (status quo).** Uniformity: an author can always wire Completed without
  checking whether this node has failure modes. Cost: on 8 nodes the two ports fire identically and
  invite exactly your confusion.
- **(b) Drop `Done` where a node has neither Unchanged nor Failure.** Honest per-node, but breaks
  the "every action has Done" regularity the AI vocabulary and docs now assume, and ERG-001 already
  measured that universality itself destroyed a validator rule's information value — pruning would
  partially restore it.
- My lean: **(a)**, and fix the comprehension problem with words (Q2) rather than port surgery —
  the contract's value is that wiring Completed is *never* a per-node decision. But this is your
  vocabulary, hence the talk.

**Q2 — Where do signal descriptions render?** This is the actual missing feature. Candidates:
canvas port hover tooltip (the surface `ERG-004` says renders nothing today — build it), and/or a
small legend row in the ports section of the property panel for signal outputs. Making port hover
work fixes this for all 153 nodes at once, not just the outcome trio. This becomes a task doc the
moment you pick a surface.

**Q3 — Rename?** If `Done` keeps confusing (it reads like "finished", i.e. what Completed means),
the honest names might be `Changed` / `Unchanged` / `Failed` / `Completed`. That's a big rename
across 82 nodes, docs, and the AI vocabulary — probably not worth it — but it's cheaper *now* than
it will ever be again, so it deserves one explicit yes/no from you.

## Related

Item 0.1 (array watchers) is answered in the README — `Array Changed`/`Object Changed` exist and
are richer than remembered. The `Condition`/`Counter.Reset` oddities above can ride along with
whatever Q1 decides.
