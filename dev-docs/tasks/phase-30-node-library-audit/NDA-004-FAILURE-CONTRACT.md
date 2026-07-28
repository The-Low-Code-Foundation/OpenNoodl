# NDA-004: The Failure Contract

## Metadata

| Field | Value |
|-------|-------|
| **ID** | NDA-004 |
| **Phase** | Phase 30 — Node Library Audit & Remediation (Track O) |
| **Tier** | 2 |
| **Priority** | 🟠 High — "no information when it fucks up" is the second-most-reported complaint |
| **Difficulty** | 🟠 Medium — the channel is the design work; adding ports is mechanical |
| **Estimated Time** | 2–3 weeks |
| **Prerequisites** | NDA-001. Best after NDA-002, which will want this channel for cycle warnings |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** for §1, then 🟢 **Sonnet 5** for §2–3 |

## Objective

Give a node that went wrong somewhere to say so **at runtime**, and then give the 60 nodes that
currently cannot report failure a way to do it.

## The problem, in numbers

| | Count |
|---|---|
| Nodes with a signal input, signal outputs, and no `Failure`/`Error` output | **50** |
| Nodes with a signal input and **no signal output at all** | **10** |
| Of those 10 | `Send Event`, `Repeater`, `Function`, `Logic Builder`, `Close Popup`, `Pop Component Stack`, `Navigate To Path`, `Unique Id`, `External Link`, `Response` |

And where a node *does* detect a problem, it almost always routes to
`context.editorConnection.sendWarning`. That channel **only exists in the editor**. In a deployed app,
in cloud runtime, and in exported code it is absent or a no-op, so the diagnostic an author relied on
during development vanishes exactly when it matters.

## §1 — The runtime error channel (design work; decide first)

Requirements, in priority order:

1. **Works everywhere.** Browser, cloud runtime, SSR and exported code. This rules out anything that
   assumes an editor connection.
2. **Structured, not a string.** `{ nodeId, componentName, code, message, detail? }` at minimum, so
   the editor can keep showing rich warnings and a deployed app can log or surface them.
3. **Observable from a graph.** An author must be able to wire *something* to "an error happened" —
   otherwise this is a logging feature, not a node feature.
4. **Cheap when unobserved.** Most nodes never fail; the channel must not cost anything on the happy
   path.

The editor path stays: `sendWarning` becomes a *subscriber* to the channel rather than the channel
itself, so no editor behaviour regresses.

**Open question for Richard:** should there be a global "on error" node (one place to catch anything
unhandled, like a top-level error boundary), per-node `Failure` outputs, or both? Recommend **both** —
per-node outputs for the errors an author expects and wants to branch on, and one catch-all node for
the ones they do not, because 155 nodes will never all have complete failure ports.

## §2 — Per-node `Failure` outputs

Work the 50 from the register. For each, the questions are: *can it actually fail?*, and *does the
author need to branch on it, or only to know?*

Not every one of the 50 needs a port. `Boolean`, `Color`, `Number`, `String` cannot meaningfully fail
and should be marked 🔵 in the register rather than given a vestigial `Failure` output nobody wires.
The audit worksheet already asks this as check B1, so **NDA-012's Data and Cloud Services categories
are the right input to this task** — run those two before starting §2 if the sequencing allows.

Where a failure output is added it must carry the error, not just the fact of it. A bare `Failure`
signal reproduces the current problem one level up.

## §3 — The mute 10

Ten nodes take an action and emit nothing. Each needs a completion signal at minimum, so downstream
work can be sequenced. `Repeater` and `Function` are the two that matter most — a `Function` that
cannot say "done" forces authors into timing hacks, and a `Repeater` that cannot say "rendered"
makes every list-then-scroll interaction guesswork.

⚠️ Adding an output to `Function` interacts with the type work in NDA-014: its outputs are
author-declared, so a built-in completion signal needs a reserved name that cannot collide.

## Success criteria

1. Corpus rows F1–F3 green.
2. An error raised in a node is observable in: the editor, a deployed browser app, cloud runtime, and
   exported code. Demonstrate all four; the export path is the one that will be forgotten.
3. `sendWarning` still works and shows what it showed before.
4. Register updated: every one of the 50 is either ✅ (has a failure output) or 🔵 (cannot fail, noted).
5. No performance regression on the happy path — measure the QA fixture.

## Risks

- **Scope.** 60 nodes is a lot of small edits. Land §1 alone first; it is independently useful and it
  is what NDA-002 wants for cycle warnings.
- A per-node `Failure` output on a node that cannot fail is worse than nothing — it implies a
  failure mode that does not exist. Be willing to mark 🔵 and move on.
