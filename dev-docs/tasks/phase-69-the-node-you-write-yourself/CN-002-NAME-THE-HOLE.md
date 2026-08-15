# CN-002 — Name the hole

| Field | Value |
|---|---|
| **Tier** | 0 |
| **Effort** | S |
| **Surface** | `editor` (`validation/`) |
| **Rulings** | none |
| **Depends on** | nothing — deliberately lands **before** CN-003 |
| **Blocks** | nothing, but it is what makes CN-003's arrival measurable |

## The defect, measured

When validation meets a node type it cannot resolve, it does the right thing at the top level —
`unknown-node-type` is a **warning**, and `diagnostics.ts:26-29` explains why in the source:

> *"an unknown node type is a warning by default because real projects legitimately use
> module-provided or version-specific nodes the catalog cannot enumerate; erroring on those would
> 'cry wolf'."*

That policy is correct and this task does not change it. The defect is what happens **downstream**:

- `parameterValues.ts:726` — *"a node whose **type** is unknown is skipped entirely"*.
- unknown-parameter checking is skipped for dynamic-port nodes.

So for a custom node, the checks do not merely soften — **they do not run**, and the result is
reported as a pass. A project full of kit nodes with wrong parameters validates clean.

`diagnostics.ts:30-32` already describes the tool for this and it is currently unused here:

> *`info` — a note, never a failure: e.g. a port skipped because the node creates it at runtime.
> **Surfaced so the user knows a check was deliberately *not* performed, rather than silently
> passing.***

The mechanism, the severity, and the justification all already exist. Nobody wired this case to it.

## What to build

An `info` diagnostic at every point where a check is skipped **because a type could not be
resolved**, naming three things:

1. the node (id + label, the way sibling diagnostics do),
2. the **specific check that did not run** — "parameter values", "unknown ports" — not a generic
   "skipped",
3. the reason, phrased as a fact about our knowledge rather than about the node: *"type
   `mykit.Chip` is not in the catalog"*, never *"invalid node"*. A kit node is not wrong; we are
   uninformed.

Emit one per (node, check) pair. Do **not** collapse to one per project — the point is that a reader
can see which nodes are unverified.

## Acceptance criteria

1. Validating `NodeGX test projects/cashflow-command-centre` emits `info` diagnostics naming the
   five kit node types and the checks skipped for each.
2. `summary.errors` and `summary.warnings` are **unchanged** by this task. `info` never fails
   anything; a CI gate that starts failing means the severity was implemented wrong.
3. The messages name the check, so the diff after CN-004 is legible: those `info` lines should
   **disappear** and be replaced by real results.

## Why it is worth a task of its own

Two reasons, and the second is the real one.

**It is the honest state today.** Until CN-003 lands, custom nodes are unverified, and a tool that
knows it skipped a check and says nothing is the exact failure this repo tracks under *"a probe that
silently exonerates"*.

**It is the instrument that measures CN-003.** After the overlay lands, the number of these `info`
lines for a kit project should go to zero. That is a far better acceptance signal for CN-003 than
"validation seems to work now" — it is a count, taken before and after, of a thing that was
previously invisible. Landing this task first is what makes that measurement possible; landing it
afterwards throws the baseline away.

## Out of scope

- Changing any severity. `unknown-node-type` stays a warning until CN-004, and CN-004 changes it
  only for types the overlay resolves.
- The overlay itself (CN-003).
