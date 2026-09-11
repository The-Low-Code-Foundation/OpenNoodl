# CN-002 — Name the hole

| Field | Value |
|---|---|
| **Tier** | 0 |
| **Effort** | S |
| **Surface** | `editor` (`validation/`) |
| **Rulings** | none |
| **Depends on** | nothing — deliberately lands **before** CN-003 |
| **Blocks** | nothing, but it is what makes CN-003's arrival measurable |
| **Status** | ✅ **CLOSED 2026-08-16.** |

## ✅ Closed 2026-08-16 — the hole, sized

**The size of the silence, measured on `cashflow-command-centre` before anything changed:**

| | |
|---|---|
| kit nodes | 5 |
| parameters carried by them | **26 — verified by nothing** |
| connection endpoints on them | **10 of the project's 28 (36%)** — skipped |
| what the validator printed | `0 error(s), 5 warning(s), 0 info — 19 nodes, 18 endpoints checked` |

The summary line does technically leak it — 18 endpoints checked against 28 in the file — but only
to a reader who counts the project's connections by hand first. Nobody does.

**After:** `0 error(s), 5 warning(s), 8 info`. Errors and warnings **unchanged**, which is
criterion 2.

### What landed

`DiagnosticCode.UnknownTypeCheckSkipped` (`unknown-type-check-skipped`), emitted from
`validation/unknownTypeSkip.ts` at **the three sites that do the skipping**:

| Site | Check named in the message |
|---|---|
| `rules/nonexistentPort.ts` | `connection port existence` |
| `rules/typeIncompatibleConnection.ts` | `connection type compatibility` |
| `parameterValues.ts` | `parameter values` |

⚠️ **Emitted from the skip sites, deliberately, rather than from one new rule that lists what other
rules skip.** A standalone rule would have to restate that knowledge and could drift — it would go on
claiming a check was skipped after that check stopped skipping. Emitting from the code that performs
the skip makes the notice unable to lie about what happened.

One per **(node, check)**, deduped per node — four connections to one unresolvable node are one fact
about that node, not four.

### 🔴 Two findings this task turned up

**1. `checkParameterValues` is not in the project validator at all.** It has exactly one caller,
`authoredPreconditionDiagnostics`, so `npm run validate:project` / MCP `validate_project` never check
parameter values for **any** node — kit or built-in. That is why the `parameter values` info appears
on the AI-authoring path (MCP `validate_component`, the editor's authoring loop) and not in the CLI
output above. This spec's criterion 1 assumed one pipeline where there are two. Not fixed here —
widening the project gate is a scope call, not a tier-0 task — but it should be ruled on, because the
26 unverified parameters are unverified at project level *for everyone*, not only for kit nodes.

**2. `DayAxis` correctly gets no notice, and that is the diagnostic being honest.** It has zero
connections, so the two connection checks skipped nothing for it. The message claims a skip that
*happened*, never one that could have — there is a test pinning exactly this, because the tempting
version of this feature ("warn for every unresolvable node") would have been indistinguishable on
this project and wrong.

### Acceptance criteria

1. ⚠️ **Partly, and the gap is finding 1, not an omission.** Four of the five kit types draw `info`
   lines naming the checks skipped; `DayAxis` correctly draws none (it has no connections). The
   `parameter values` skip fires on the authoring path, which is the only path that runs that check.
2. ✅ `summary.errors` and `summary.warnings` unchanged — `0 / 5` before and after. Pinned by a test
   using a known-type twin as its control, plus a tripwire asserting the code is not in
   `AUTHORED_BLOCKING_WARNINGS`.
3. ✅ Each message names its check, so CN-003's diff is legible line by line.

### Tests

`packages/noodl-editor/tests-unit/cn-002/` — 12, under `npm run test:main`. Three are controls: a
known-type twin that must produce **zero** of these (so a rule firing unconditionally would look
different), an unresolvable node with no connections, and an unresolvable node with no parameters.

⚠️ **One existing test changed, and the change is worth reading.** `tests-unit/aib-001/parameterValues.test.ts`
asserted `checkParameterValues(...)` returns `[]` for an unknown type, under the heading *"what it
deliberately lets through"*. Its **intent** is preserved exactly — an unresolvable type still raises
no problem — but `toEqual([])` would have re-hidden the announcement, so it now asserts the property
(*nothing above `info`, and the one code is this one*) rather than the shape.

`test:main`: **205 suites / 3157 tests**, all passing. No token cost to the MCP surface —
`toolDisclosure.test.ts` green, and no tool schema enumerates `DiagnosticCode`.

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
