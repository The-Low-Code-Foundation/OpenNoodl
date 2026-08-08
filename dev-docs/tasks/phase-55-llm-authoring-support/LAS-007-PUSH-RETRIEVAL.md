# LAS-007 — Push, not pull: retrieval into the failure moment

**Status:** 📋 open · **Track 2 (surface)** · depends on LAS-001/002/003 (the rejections it
decorates) · implements README candidate direction 5, the clearest weak-model finding

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

## Register

| # | Finding | State |
|---|---|---|
| — | | |
