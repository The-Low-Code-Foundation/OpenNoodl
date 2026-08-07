# BCN-010: Capability Gating & the Node-Library Reconciliation

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BCN-010 |
| **Phase** | Phase 34 — One Backend Contract (Track S) |
| **Tier** | 3 — the surface |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🟠 Medium-Hard — small mechanism, wide blast radius, and it is the task that makes or breaks the phase's central claim |
| **Estimated Time** | 1–1.5 weeks |
| **Prerequisites** | all preceding BCN tasks |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** |

## Objective

Turn BCN-001's capability descriptor into what the user actually sees — disabled ports and nodes
carrying the reason they are disabled — then reconcile the node catalog, the enrichment corpus, the
semantic validator, the MCP surface and the docs with the settled node list, **and hand Phase 30 a
library it can finally audit.**

## Objective in one sentence, for whoever is tempted to cut it

The phase's justification is that merging two node families is *better* than keeping them apart. That is
only true if the gaps are visible. **A merged family with silent gaps is worse than what we started
with**, and this task is the difference.

## Background

Phase 30 stopped short of auditing the data nodes deliberately. Its audit files carry **46 entries in
[`audit/data.md`](../phase-30-node-library-audit/audit/data.md)** and **22 in `audit/cloud-services.md`**
— against a node set this phase reshapes. Auditing before this lands documents a library that is about
to change; auditing after it lands documents the real one.

Phase 30 also found the symptom that started the whole conversation
([FINDINGS.md](../phase-30-node-library-audit/FINDINGS.md)): grouping all 156 registered types by picker
label leaves **eleven duplicated labels**, ten of them a deprecated node shadowing its replacement, and
one — "Delete Record" — with two *creatable* entries. Its own generalisable lesson applies directly to
this task:

> **a criterion that says "no two nodes should read the same" is a property of the *registry***, and
> checking it by reading the nodes one spec named will find only the instances that spec knew about. The
> check costs one `reduce` over `nodetypes`.

That check belongs in this task, permanently, as a test.

## Current State

| Piece | State after BCN-001…009 |
|---|---|
| Capability descriptor | exists, populated, verified — and consumed by nothing user-facing |
| BYOB node types | all five retired (BCN-004, BCN-008) |
| Node names | still padded — "Create **New** Record", "**Set** Record Properties", "Query **Records**" |
| Node catalog | `packages/noodl-types/src/node-catalog.json` + enriched — stale |
| Enrichment corpus | `docs/node-catalog/enrichment/` includes `noodl.byob.*` entries for deleted types |
| Semantic validator | unknown-type = warning; dynamic-port nodes skip port checks |
| MCP server | exposes the node library to external agents |
| Duplicate-label check | does not exist |
| Phase 30 data audit | **deliberately not started** |

## Desired State

### 1. Gating that a builder can act on

For each of the four descriptor states:

| State | Node picker | Property editor / ports | Canvas |
|---|---|---|---|
| `supported` | normal | normal | normal |
| `unsupported` | node visible, marked | port disabled, **reason on it** | node marked, reason on hover |
| `conditional` | as `unsupported` until probed | as `unsupported` until probed | probe result shown |
| `degraded` | normal | normal, caveat in the property editor | normal |

The reason string is BCN-001's builder-facing text. **A disabled port with no reason is a bug in this
task**, not a cosmetic gap — it converts "this backend cannot do that" into "this is broken."

An unsupported node stays *visible* rather than hidden. Hiding it answers the question "why can't I do
X on Directus?" with silence; showing it disabled answers it in place.

### 2. Names, unpadded

With the BYOB types gone, the padding that avoided collisions can go:

| Now | After |
|---|---|
| Create New Record | **Create Record** |
| Set Record Properties | **Update Record** |
| Query Records | Query Records *(unchanged)* |
| Delete Record | Delete Record *(now unambiguous)* |

Type names (`NewDbModelProperties`, `SetDbModelProperties`) are a separate question from display labels.
Renaming types churns every saved project; renaming labels does not. **Change labels; leave type names
alone** unless a later task has a reason.

### 3. The registry-wide duplicate check, as a test

One `reduce` over the registered node types asserting no two *creatable* types share a picker label.
Deprecated-shadowing-modern pairs are the known exception and are enumerated explicitly rather than
excluded by a rule that could hide a real collision.

### 4. Everything downstream reconciled

Catalog regenerated; enrichment entries for the five deleted types removed and their replacements'
entries updated; examples that reference retired types fixed; the semantic validator's corpus
error-clean; MCP exposing the settled library; `docs/runtime/BACKEND-SERVICES.md` rewritten for one
family and six backends.

### 5. Phase 30 is unblocked, explicitly

A note in this task's completion record telling phase 30 that `audit/data.md` and
`audit/cloud-services.md` can proceed, and what changed under them.

## Implementation Steps

1. Wire the descriptor into port and node rendering for all four states, with reasons.
2. Probe resolution for `conditional` at connect time, cached per backend, re-probed on reconnect.
3. Relabel the record nodes; leave type names alone.
4. Write the registry-wide duplicate-label test with the deprecated pairs enumerated.
5. Regenerate the catalog; fix enrichment, examples and validator corpus; verify `catalog:check` and
   `catalog:merge:check` green.
6. Update MCP and the user docs.
7. **Live pass**: a project on Directus showing `Request Magic Link` disabled with its reason; the same
   project switched to Supabase showing it enabled; a Parse project showing realtime `conditional` and
   resolving to disabled after a probe.
8. Record phase 30's unblocking.

## Success Criteria

- [ ] All four descriptor states render distinctly, and **every disabled port carries a reason string**.
- [ ] Unsupported nodes are visible-and-marked, not hidden.
- [ ] `conditional` capabilities are probed at connect and cached; a stale probe cannot claim support.
- [ ] Record node labels are unpadded; type names unchanged.
- [ ] A registry-wide test asserts no two creatable types share a picker label; the deprecated exceptions
      are enumerated, not rule-excluded.
- [ ] Catalog, enrichment, examples and validator corpus are clean; `catalog:check` and
      `catalog:merge:check` green.
- [ ] MCP exposes the settled library; `docs/runtime/BACKEND-SERVICES.md` describes one family.
- [ ] The live pass has shown the same node enabled on one backend and disabled with a reason on another.
- [ ] Phase 30's data and cloud-services audits are explicitly unblocked, with a note on what changed.

## Out of Scope

- **The phase-30 audit itself.** This task unblocks it; it does not do it.
- **The other ten duplicate labels.** Deprecated-shadowing-modern pairs are phase 30's
  [NDA-011 criterion 3](../phase-30-node-library-audit/) territory. This task adds the *check* that would
  have found them and fixes only the one it created the conditions to fix.
- **Documenting the 2,650 ports.** Phase 30's headline item, and the reason it wants a settled library.
- **New capabilities.** If gating reveals a gap worth closing, that is a finding for a later task.

## Traps

- **A disabled port with no reason is the failure mode this whole phase was meant to prevent.** It is
  indistinguishable from a bug to the person looking at it. Treat a missing reason string as a build
  failure, not a copy task.
- **`conditional` probes go stale.** A Directus instance with WebSockets switched off after the probe
  will claim realtime works. Re-probe on reconnect, and prefer a fast negative over a cached positive.
- **Renaming a type name is not the same as renaming a label**, and the two are easy to conflate in a
  file that does both. Type names appear in every saved project; labels appear in the picker.
- **The enrichment corpus references node types by name** and a deleted type leaves a dangling entry that
  `catalog:check` may or may not catch depending on which check runs. Run both `catalog:check` and
  `catalog:merge:check`.
- **`cloud-byob-crud`'s wrong `class` parameter passed for months** because dynamic-port nodes skip port
  checks in the validator — RUN-003 slice 8 found and fixed it. The same blind spot covers every node in
  this phase, so the validator being green is weaker evidence here than elsewhere.
- **The editor's node registry survives HMR.** After touching registrations or labels, relaunch rather
  than reloading, or the picker will show the previous build's library and the live pass will grade the
  wrong thing.
- **Phase 30's audit files are partly hand-written prose.** Regenerating the catalog does not regenerate
  them. Say clearly what changed so the audit does not inherit stale entries as if they were verified.