# Phase 30 — Node Library Audit & Remediation (Track O)

**Created:** 2026-07-28
**Origin:** not the roadmap. Richard listed eight nodes he considers broken, described a cross-cutting
reactivity failure, and asked for an audit of all of them.

## The observation that started it

> "The whole series of Array nodes are a nightmare. When you use the nodes and nothing else it works
> ok and triggers change signals whenever something changes. But there's a bunch of cases where
> nothing is triggered […] essentially you don't know if the array changed output signal is going to
> fire or not depending on how you're manipulating the array."

That is the phase in one paragraph. The nodes are not individually bad so much as **individually
inconsistent**, because no contract was ever written down that all of them had to satisfy. Every node
decided for itself what counts as a change, what counts as empty, and whether failure is something
the author gets told about.

The first-pass evidence is in [`FINDINGS.md`](./FINDINGS.md). Every claim there carries a file:line
citation. The short version:

| | |
|---|---|
| **5%** of the library's 2,650 ports carry a description | 112 of 155 nodes document nothing |
| **32%** of action nodes have no failure output | 10 more emit no signal at all |
| `Array.prototype.push` does not notify | only 5 of ~15 mutating operations do |
| `null` into a String variable stores the text `"null"` | and `Number(null)` is an indistinguishable `0` |
| A `States` node can change state twice in a frame and signal **zero** times | `states.ts:416-434` |

## The thesis

**Five contracts are missing, and their absence is what makes 155 nodes feel individually broken.**

1. **The reactivity contract.** What is a change, who is told, and when. Today the answer differs
   between `Model` (correct), `Collection` (five verbs out of fifteen), `Variable` (swallows the
   first), and `States` (coalesces, then discards).
2. **The empty-value contract.** What `null` means versus `undefined`. Four layers currently guard on
   different things and none of them agree — so clearing a value is unreliable across the whole library.
3. **The failure contract.** How a node that went wrong says so *at runtime*, not just to the editor.
   `editorConnection.sendWarning` does not exist in a deployed app, in cloud runtime, or in export.
4. **The type contract.** What a port type promises. `object` casts to nothing and reaches 4 of the
   library's 1,750 input ports, so declaring an output's true type makes it *less* connectable than
   leaving it `*`. Added in the second pass.
5. **The binding contract.** How a node that targets another node says which one. Parent Component
   Object and Close Popup both walk up to a nearest ancestor, with no way to name the target and no
   visible record of what was found. Added in the second pass.

Write those down, make the runtime enforce them, and most of the reported complaints stop being
separate bugs. The per-node work that remains is then genuinely per-node.

## A note on how much is still unfound

Contracts 4 and 5 were **not** in the first pass. That pass read the eight nodes Richard named and
swept the other 147 structurally — ports, signals, documentation coverage — which cannot find
"works until you add a second one". Richard then reported five more defects from memory; four
confirmed against source, and confirming one of them turned up contract 4.

Five real defects in the next six nodes anyone looked at closely. Treat the register's 142 unread
rows as *unaudited*, not as clean.

## Sequencing, and why the first task is not a fix

The eight named nodes are tempting to go straight at. They should not be first. A reactivity change
touches every stateful node in the library, and there is currently **no behavioural test corpus** that
would catch a regression — so the first task builds one, from the reported symptoms, as failing tests.
Everything after it is measured against that corpus.

## Tasks

| ID | Title | Tier | Focus |
|---|---|---|---|
| [NDA-001](./NDA-001-NODE-BEHAVIOUR-CORPUS.md) | Node behaviour corpus | 1 | Failing tests for every symptom in `FINDINGS.md`, before any fix |
| [NDA-002](./NDA-002-REACTIVITY-CONTRACT.md) | The reactivity contract | 1 | Define it; make `Collection` notify on all mutations; `Variable`/`States` obey it |
| [NDA-003](./NDA-003-EMPTY-VALUE-CONTRACT.md) | The empty-value contract | 1 | `null` clears, `undefined` abstains; fix the four disagreeing layers and the casts |
| [NDA-013](./NDA-013-REPEATER-REFRESH.md) | Repeater re-reads its source on Refresh | **1** | `refresh()` rebuilds from a stale private copy. Small, standalone, and restores a working escape hatch *before* NDA-002 |
| [NDA-004](./NDA-004-FAILURE-CONTRACT.md) | The failure contract | 2 | A runtime error channel; `Failure` outputs on the 50; signals on the mute 10 |
| [NDA-005](./NDA-005-PORT-DOCUMENTATION.md) | Port documentation sweep | 2 | 2,508 undocumented ports — the AI authoring loop's biggest single input |
| [NDA-006](./NDA-006-COLUMNS.md) | Columns: breakpoints, repeaters, masonry | 2 | Fix the in-place `pop()`; lay out repeater children at all; then masonry |
| [NDA-007](./NDA-007-ICON-SETS.md) | Icon: a set model that isn't an icon font | 2 | SVG sprites and inline sets; one registration path for editor + viewer |
| [NDA-008](./NDA-008-COMPONENT-STACK.md) | Component Stack | 2 | Unify replace/stack; animate both; **§0 reproduces the scroll jump first** |
| [NDA-009](./NDA-009-RUN-TASKS.md) | Run Tasks | 2 | Kill the string-matched `Do`/`Success`/`Failure` contract; validate and warn |
| [NDA-010](./NDA-010-POPUPS.md) | Popups: data flow and stack policy | 2 | Derive params/results from the target component; one modal slot; §2 shared with NDA-015 |
| [NDA-014](./NDA-014-TYPE-DEAD-ENDS.md) | `object`/`array`/`color` are type dead ends | 2 | `object` casts to nothing and reaches 4 of 1,750 input ports; picking the right type is worse than leaving `*` |
| [NDA-015](./NDA-015-EXPLICIT-BINDING.md) | Explicit targeting for scope-resolved nodes | 2 | Parent Component Object and Close Popup both bind to a nearest ancestor with no way to name it |
| [NDA-016](./NDA-016-LAYOUT-SIZEMODE.md) | `Layout.size` has no unset-`sizeMode` branch | 2 | The Text width defect; one file, 29-node blast radius; **§0 blocking** |
| [NDA-011](./NDA-011-REST-TO-HTTP.md) | REST → HTTP consolidation | 3 | Confirm `httpnode` is a superset; deprecate the DSL rather than improve it |
| [NDA-012](./NDA-012-PER-NODE-AUDIT.md) | **Per-node audit — all 155, one at a time** | 3 (optional) | Twelve checks per node, pre-filled worksheets per category. The only thing that bounds the unknown |

**Tiers are stopping points.** Tier 1 (NDA-001, 002, 003, 013) is the reactivity and empty-value work
— the highest-value slice, and it stands alone; if the phase stops there it has still fixed the thing
Richard described as cutting across everything, and NDA-013 gives the Repeater a working escape hatch
on the way. Tier 2 is the named nodes plus the library-wide sweeps. Tier 3 is consolidation and the
optional per-node audit.

**NDA-012 is opt-in and resumable.** It is the only task that bounds how much is still unfound, but
it is ~155 × 30 minutes and its expected value declines as it goes. It is written to be stopped
early: audit by category, record the find rate, stop when the rate drops. Do not treat 155/155 as the
goal.

## The register

[`NODE-REGISTER.md`](./NODE-REGISTER.md) lists all 155 nodes with machine-derived smell columns and a
hand-written `Verdict` column. Regenerate with `node scripts/node-audit/register.js` — it preserves
verdicts across runs, so it stays accurate as the library changes. The register is the phase's
denominator: NDA-012 is done when every row has a verdict.

## Legacy projects are not a constraint on this phase

Standing decision, 2026-07-30 — [`COMPATIBILITY-POLICY.md`](../../reference/COMPATIBILITY-POLICY.md):
**NodeGX is a fresh start and existing Noodl projects will not reliably import.** This phase is
where the old constraint hurt most, because fixing a contract *is* a behaviour change by
definition — and half the specs here were written to avoid exactly that.

So, for every NDA task:

- Ship the correct behaviour. Do not default a contract fix to the wrong-but-familiar branch, and do
  not dual-path it, in order to leave old projects untouched.
- Deleting a node, a port, or a deprecated entry is on the table. Argue it on maintenance cost.
- The **QA fixture is the compatibility target that remains** — and it is ours to edit. "Verify
  against the QA fixture" in these specs means *keep it green*, which includes updating it when a
  contract fix legitimately changes what the fixture should assert. Say so in the commit.
- Record every behaviour change in the task notes. Speed, not silence.

Clauses in NDA-007/009/010/011/014 have been amended in place; any remaining "existing projects are
unaffected" wording elsewhere in this phase predates the decision and is void.

## What this phase is not

It is not a rewrite of the node library, and it is not a redesign of the visual nodes. It is three
contracts, the eight nodes that most visibly violate them, and a systematic pass over the rest.
Deprecated-node dispositions (23 nodes) and the node picker's four stale entries are in scope for
NDA-012 only as a disposition decision, not as work.
