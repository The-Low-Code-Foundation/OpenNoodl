# LAS-007 — Push, not pull: retrieval into the failure moment

**Status:** ✅ **done** 2026-08-08 (session 4) · **Track 2 (surface)** · depended on LAS-001/002/003
(the rejections it decorates) · implements README candidate direction 5, the clearest weak-model
finding

## The evidence

Haiku **never once** called `list_examples`, `get_example`, or any project doc — across a 42-turn
build including 7 turns stuck on validation rejections it could have looked up. The recipes that
show exactly its two fatal patterns (Component Inputs + instance, Columns modes) sat unread.
Sonnet retrieved everything (5× `list_examples`, 3+ `get_example`) and used it. The mid-tier model
acts on what is **pushed** (it read the doctrine in `get_project_info` and decomposed correctly);
it retrieves nothing optional. Advice to retrieve is dead weight; attachment works.

## Build

### 1. Rejections carry their recipe

One mapping table, `DiagnosticCode → example id(s)`, living beside the shared validate/formatting
module (one substrate — both clients read it):

| Rejection | Attached |
|---|---|
| LAS-001 interface diagnostics | the Component-Inputs-plus-instance pattern (from the existing `comp-*`/`ui-*` set — pick the smallest fragment that shows the inputs node + a wired instance; verify which example that actually is before hardcoding an id) |
| LAS-003 `layoutString` | the two Columns modes (autoFit vs layoutString+breakpoints) — `ui-card-grid-repeater` / `vis-columns-media-cards`, verified |
| `repeated-sibling-subtree` (blocking after LAS-004) | `data-static-array-filter-repeater` — the Static Data → For Each shape |
| encoding rejections (`invalid-parameter-value`) | cite the recipe id only (these already self-correct; don't bloat) |

Attachment = the example's JSON fragment rendered small, inline in the rejection payload
(structured entry per LAS-002's shape), capped — attach the fragment for the first rejection of a
code per plan, the id-only citation thereafter (a stuck loop must not re-send 2KB every retry).

### 2. Verify the `get_node_type` cross-references carry weight

Phase 54 cross-referenced `ui-*` recipes from nine node types; the audit verified the citation
exists, **not its sufficiency** — and haiku fetched node types without following citations.
Check what `get_node_type` actually inlines for `net.noodl.visual.columns`, `Group`, `For Each`,
`Static Data`, `Component Inputs`; where it is a bare id, inline the one-line "when to use"
sentence per cited example. Regenerating the enriched catalog means running all three catalog
gates (phase-54 F1's lesson — the gates read the working tree).

### 3. The traps preamble

`get_project_info`'s doctrine payload gains a ~10-line **"the traps"** block ahead of the
doctrine (the pushed channel that measurably gets read): Component Inputs are the interface and
instance parameters must match them; `Static Data` is the inline-JSON array primitive; `Columns`
is the only thing that reflows and its layout string is integers-and-spaces; an unsized absolute
Group fills its parent; images must be verified by looking (`render_report`). Source it as a
constant in the same module as the doctrine exports (`design.ts`/`decomposition.ts` shape) so both
clients speak it — content drawn from the audit's measured failures, phrased in Richard's register
(short declaratives, no hedging).

## Acceptance

- A cold haiku replay's transcript shows: interface rejection arrives with the fragment → next
  attempt exposes `Component Inputs` (the audit's F2 failure becomes a one-retry recovery). This
  is the task's real test and it is measurable.
- Rejection payloads stay bounded (spec the first-full/then-cite behaviour).
- `npm run catalog:examples` + `catalog:check` + `catalog:merge:check` green; noodl-mcp jest pins
  the mapping table (an entry naming a nonexistent example id must fail the suite).

## What shipped

| § | Where | What |
|---|---|---|
| 1 | `validation/diagnosticExamples.ts` (shared) + `noodl-mcp/tools/attachments.ts` | `DIAGNOSTIC_EXAMPLES`, keyed on **code + nodeType + port**; `exampleAttachments()` with the first-full/then-cite budget; attached to every `create_component`, `update_component`, `stage_plan_operation` and `apply_plan` rejection |
| 2 | `catalog.ts` | `exampleIds: string[]` → `examples: [{id, title}]`. A bare id says nothing about which of four to spend a call on, so the rational move was to spend none |
| 3 | `prompts/traps.ts` → `get_project_info.authoringTraps` | seven silent failures, ahead of both doctrines, in the one channel the audit measured a mid-tier model actually reading |

**Gates at close:** `noodl-mcp` jest **24 suites / 250 specs**; `catalog:examples` **57/57** under the
new interface checks; `catalog:check` / `catalog:merge:check` green.

## Register

| # | Finding | State |
|---|---|---|
| F23 ⭐ | **The recipe library taught the exact defect LAS-001 blocks.** All **11** `Component Inputs` ports in the three phase-54 composition recipes (`ui-card-grid-repeater`, `ui-icon-feature-strip`, `ui-stat-tile-row`) were declared `plug: "input"` — backwards, so the ports join no interface and the **12** connections drawn out of them are dropped by the exporter as unhealthy. This is F8 verbatim, sitting in the graphs an agent is told to imitate; attaching one to an interface rejection would have taught the defect it was being refused for. Only 3 of 57 examples declare interface ports at all, and all 3 were wrong | ✅ **CLOSED** — 11 ports corrected, enriched catalog regenerated. Measured consequence: the 11 `component-port-direction` **and** the 2 `interfaceless-instance` findings both cleared (13 of 24, one edit) |
| F24 ⭐ | **`catalog:examples` could not have caught F23, and reported `57/57 clean` throughout.** It ran the `rules/` validator only (the F14 shape) and its `toNormProject` mapped every port to `instancePorts: [name]`, discarding `plug` before any check could read it — its `ExampleFile` type did not even declare the field. A gate cannot find what its own model deletes | ✅ **CLOSED** — the gate now runs `checkInstancePorts` + `checkComponentPortDirection` + `checkInstanceInterfaces` and carries `plug`. Watched failing at 54/57 on the pre-fix recipes before the fix landed |
| F29 | **A `Map<DiagnosticCode, exampleId>` would have been wrong.** The `layoutString` grammar error (LAS-003/1) is reported as the generic `InvalidParameterValue`, shared with every unit, enum and encoding problem in `parameterValues.ts` — keyed on code alone, a Columns recipe gets stapled to "opacity must be between 0 and 1". Entries narrow by `nodeType` and `port`, most-specific wins | ✅ designed that way, specced both directions |
| F30 | Scope of the example gate chosen from a measurement, not ambition: the full precondition set would also surface **7** `inactive-conditional-parameter` (`ctl-settings-form`, `logic-consent-gate`, `ui-empty-state`, `ui-split-hero`), **2** `invalid-parameter-value` (`cloud-record-crud`), **1** `unsized-absolute-box` (`ui-card-grid-repeater`) and **1** `raw-color-literal` (`var-avatar-picker-responsive`) | 🔴 **OPEN, filed not fixed** — real, pre-existing, a different task's blast radius (the F14 argument). 11 findings across 7 examples |
| F31 | The plug tripwire reads the **enriched** catalog (what the attachment actually serves), not `docs/node-catalog/examples/`. A source-only regression is caught by `catalog:merge:check` instead — the chain is source → merge:check → enriched → tripwire, and it is only complete because all three run | ✅ verified by breaking each end in turn |
