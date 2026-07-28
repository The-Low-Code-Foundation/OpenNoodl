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

**Three contracts are missing, and their absence is what makes 155 nodes feel individually broken.**

1. **The reactivity contract.** What is a change, who is told, and when. Today the answer differs
   between `Model` (correct), `Collection` (five verbs out of fifteen), `Variable` (swallows the
   first), and `States` (coalesces, then discards).
2. **The empty-value contract.** What `null` means versus `undefined`. Four layers currently guard on
   different things and none of them agree — so clearing a value is unreliable across the whole library.
3. **The failure contract.** How a node that went wrong says so *at runtime*, not just to the editor.
   `editorConnection.sendWarning` does not exist in a deployed app, in cloud runtime, or in export.

Write those three down, make the runtime enforce them, and most of the eight complaints stop being
separate bugs. The per-node work that remains is then genuinely per-node.

## Sequencing, and why the first task is not a fix

The eight named nodes are tempting to go straight at. They should not be first. A reactivity change
touches every stateful node in the library, and there is currently **no behavioural test corpus** that
would catch a regression — so the first task builds one, from the reported symptoms, as failing tests.
Everything after it is measured against that corpus.

## Tasks

Tier 1 is specced. Tier 2 and 3 are briefed here from the findings and need their own task files
before execution — the row's Focus column is the brief, not the spec.

| ID | Title | Tier | Focus |
|---|---|---|---|
| [NDA-001](./NDA-001-NODE-BEHAVIOUR-CORPUS.md) | Node behaviour corpus | 1 | Failing tests for every symptom in `FINDINGS.md`, before any fix |
| [NDA-002](./NDA-002-REACTIVITY-CONTRACT.md) | The reactivity contract | 1 | Define it; make `Collection` notify on all mutations; `Variable`/`States` obey it |
| [NDA-003](./NDA-003-EMPTY-VALUE-CONTRACT.md) | The empty-value contract | 1 | `null` clears, `undefined` abstains; fix the four disagreeing layers and the casts |
| NDA-004 | The failure contract | 2 | A runtime error channel; `Failure` outputs on the 50; signals on the mute 10 |
| NDA-005 | Port documentation sweep | 2 | 2,508 undocumented ports — the AI authoring loop's biggest single input |
| NDA-006 | Columns: breakpoints, repeaters, masonry | 2 | Fix the in-place `pop()`; wrap repeater children; then masonry |
| NDA-007 | Icon: a set model that isn't an icon font | 2 | SVG sprites and inline sets; one registration path for editor + viewer |
| NDA-008 | Component Stack | 2 | Unify replace/stack; animation on both; **reproduce the scroll jump first** |
| NDA-009 | Run Tasks | 2 | Kill the string-matched `Do`/`Success`/`Failure` contract; validate and warn |
| NDA-010 | Popups: data flow and stack policy | 2 | Typed params/results; find the closer by scope explicitly; de-duplicate shows |
| NDA-011 | REST → HTTP consolidation | 3 | Confirm `httpnode` is a superset; deprecate the DSL rather than improve it |
| NDA-012 | The remaining 147 nodes | 3 | Work the register; one verdict per node against the three contracts |

**Tiers are stopping points.** Tier 1 (NDA-001…003) is the reactivity and empty-value work — it is
the highest-value slice and it stands alone; if the phase stops there it has still fixed the thing
Richard described as cutting across everything. Tier 2 is the named nodes plus the two library-wide
sweeps. Tier 3 is the long tail.

## The register

[`NODE-REGISTER.md`](./NODE-REGISTER.md) lists all 155 nodes with machine-derived smell columns and a
hand-written `Verdict` column. Regenerate with `node scripts/node-audit/register.js` — it preserves
verdicts across runs, so it stays accurate as the library changes. The register is the phase's
denominator: NDA-012 is done when every row has a verdict.

## What this phase is not

It is not a rewrite of the node library, and it is not a redesign of the visual nodes. It is three
contracts, the eight nodes that most visibly violate them, and a systematic pass over the rest.
Deprecated-node dispositions (23 nodes) and the node picker's four stale entries are in scope for
NDA-012 only as a disposition decision, not as work.
