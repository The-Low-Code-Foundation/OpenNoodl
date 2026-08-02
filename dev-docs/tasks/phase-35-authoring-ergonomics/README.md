# Phase 35 — Authoring Contracts & Ergonomics (Track T)

**Created:** 2026-08-01
**Origin:** not the roadmap. Phase 30's audit finished, Richard read the five open decisions, and his
answers turned three of them into design work bigger than the defects that raised them.

## What this phase is

Phase 30 was an audit: 136 nodes, twelve checks each, 188 defects. It closed on 2026-08-01 having
established five missing contracts and fixed most of what they governed. **Phase 35 is what the
audit's own open questions turned into once Richard answered them** — one new contract and four
ergonomics gaps that no per-node fix reaches.

The through-line is the same as phase 30's: *the nodes are not individually bad so much as
individually inconsistent, because nobody wrote down the rule they all had to satisfy.* Three of the
five tasks here are a rule being written down for the first time.

## Where the decisions came from

Recorded because the reasoning matters more than the conclusions, and because two of the
conclusions **overrode my recommendation** and were better for it.

| Question | Richard's answer | What changed |
|---|---|---|
| How do we stop triggered nodes evaluating stale inputs? (phase 30 NDA-017 §1) | **A per-input "Run on value change" affordance in the node panel** | Overrode the recommended "detect and warn". The recommendation treated staleness as the defect; Richard identified the real one — *connecting `Run` silently changes what every other port does* — and his fix removes it rather than reporting it. Stays in phase 30 as NDA-017 §2 |
| Should `Insert Object Into Array` report a duplicate as failure? | **Neither. It needs a third outcome** — and the same is true library-wide | Became `ERG-001`, the Outcome Contract. Richard's framing: a chain breaks when a node emits nothing, and the author wanted it to carry on |
| Should a Repeater clear when its data goes empty? | **Yes — empty array, `null`, anything falsy** | Phase 30 remediation, no caveats. "We're not catering to existing projects anymore" |
| Should `shortDesc` exist? | **Delete it** | Phase 30 remediation |
| What about the 30 deprecated nodes? | **No revivals.** The only one whose *capability* is missed is `Script Downloader`, and it gets solved properly instead | Became `ERG-002` |

## Tasks

| ID | Title | Tier | Focus |
|---|---|---|---|
| [ERG-001](./ERG-001-OUTCOME-CONTRACT.md) | The outcome contract | 1 | `Done` / `Unchanged` / `Failure` — exactly one — plus a universal `Completed`. The sixth contract |
| ↳ [ERG-001 §0](./ERG-001-S0-MEASUREMENT.md) | **§0 measurement — done 2026-08-02** | — | 82 live actions, the collision sweep, the `Unchanged` register. **§0 was blocking; it is now the scope** |
| [ERG-002](./ERG-002-EXTERNAL-LIBRARIES.md) | External libraries in app config | 1 | Pulling in PocketBase or tinyMCE without knowing what a UMD build is. **The module system already does this; nothing surfaces it** |
| [ERG-003](./ERG-003-LIST-INPUT-EDITOR.md) | One editor for every list input | 2 | The visual JSON builder already in core-ui, applied to all 69 list-shaped ports. Three-way: visual / code / connect |
| [ERG-004](./ERG-004-CHANGE-DETECTION.md) | Change detection inside objects and arrays | 2 | `Value Changed` compares identity, so editing an object in place is invisible. **Four of the five signals wanted are already broadcast and nothing listens** |
| [ERG-005](./ERG-005-COMPONENT-INTERFACE.md) | Component Inputs / Outputs | 2 | The nodes that define every component's public interface, and the only mechanism in the library that **cannot be documented at all** |

**Tiers are stopping points.** Tier 1 is the two that unblock other things — ERG-001 because the
workflow canvas and the validator both want it, ERG-002 because it is a capability the product does
not currently have. Tier 2 is ergonomics: real, bounded, and none of it blocking.

## The one thing to confirm before starting

⚠️ **The deprecated-node reading.** Richard said *"The only deprecated node I'm thinking about is the
Script Downloader"*, which reads as **no revivals**. But the audit found four capabilities with
**no live equivalent at all**, and they are recorded here so the decision is deliberate rather than
inherited:

| Capability | Deprecated node | Live equivalent |
|---|---|---|
| Blend N numbers by a 0–1 value (multi-stop lerp) | `Number Blend` | **None.** Interpolation ships `Color Blend` and nothing for numbers |
| "Which of these N signals fired?" → an index | `Signal To Index` | **None** |
| A real HTML `<form>` with a `Submit` signal, and field grouping | `Form`, `Field Set` | **None.** The control kit has Button/Checkbox/Dropdown/Slider/Text Input but nothing that makes them a form — so native submit-on-enter, autofill grouping and native validation are unreachable |
| Device gyroscope → rotation X/Y/Z | `Device Orientation` | **None.** ⚠️ Reviving it needs a browser permission flow, not just un-deprecating |

These are **capability gaps, not node revivals**. Nothing in this phase depends on the answer.

## Corrections this phase carries in

⚠️ **`Script Downloader` has no replacement, and an earlier session's claim that it did was wrong.**
The Script node's *External File* mode looks like the replacement and is not: it fetches a URL and
parses it as **that node's own body**, scanning it for the node's declared inputs and outputs
(`javascript.ts:692-694` → `JavascriptNodeParser.createFromURL`). It cannot load an arbitrary
third-party library. So the deprecated `Script Downloader` was the only node that did that job, and
the two remaining routes are both project-level: `headCode` and `noodl_modules/`. See ERG-002 §0.

⚠️ **Two of phase 30's twelve checks were being read wrongly and were corrected mid-phase** (`B1`
last, `B3` on the final day). Before comparing any two categories' find rates, check which pre-fill
each was audited under. Visual's and Navigation's numbers are not comparable with the rest.

## Corrections this phase carries *out*

🔴 **ERG-001 broke NDA-017 criterion 6, and phase 30's file has been corrected to say so.**
Measured 2026-08-02 during closeout. The outcome contract made `Done`/`Completed` universal, which
is exactly the signal NDA-017's `signal-driven-stale-input` rule read as *"this producer is
asynchronous"*. Node types carrying a completion signal went **53 → 97 of 153**; the rule started
firing on four shipped examples — including the canonical latched counter, where its suggested fix
is an infinite loop — and `catalog:examples` went red in CI.

The rule is now `defaultEnabled: false`, its tests read the **real** catalog instead of a
hand-built one (which is why a green unit suite missed this), and re-enabling needs a structured
asynchrony marker in the catalog. **That marker is open work and wants a decision on where it
lives.** See
[NDA-017 § The asynchrony proxy is dead](../phase-30-node-library-audit/NDA-017-SIGNAL-INPUT-FRESHNESS.md#-the-asynchrony-proxy-is-dead-2026-08-02).

The lesson generalises past this phase: **a contract that makes a port universal destroys the
information value of that port for everything that was reading it as a discriminator.** Worth
checking before the next library-wide port addition.
