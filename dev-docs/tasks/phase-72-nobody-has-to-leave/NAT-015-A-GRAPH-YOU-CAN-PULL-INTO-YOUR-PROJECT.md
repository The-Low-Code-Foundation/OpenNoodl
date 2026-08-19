# NAT-015 — A graph you can pull into your project

| Field | Value |
|---|---|
| **Tier** | 3 |
| **Effort** | S/M |
| **Surface** | `editor` |
| **Rulings** | inherits **D15**; the redaction rule from P67's *"a port name is user content whenever its type is"* |
| **Depends on** | **NAT-007** — and 🔴 **do it in the same session**, on the renderer it builds |
| **Promoted** | Was **UNI-018** in phase 67b. Moved here 2026-08-19: it is the closing sentence of this phase, and it is the second half of a seam NAT-007 opens anyway |

## The job

`AskAboutNodeDialog` publishes a redacted graph fragment with a question. NAT-007 makes that
fragment **render** in the editor. This task makes it **arrive**: the answer to *"why doesn't this
work"* is often a corrected graph, and today the only way to act on one is to read it and retype it.

Pull it into your own project — as a selection you place, not as a file you import.

## Acceptance criteria

1. A rendered attachment offers **one verb**: put this in my project. It lands where a paste lands,
   selected, undoable in one step.
2. **Node types the local install does not have are handled before anything is written**, not
   after. A fragment from someone running a kit you have not installed is the normal case, and the
   answer is a named list and a refusal to half-apply — 🔴 never a graph with holes in it. A
   partially-applied pull is worse than a refused one because it looks like it worked.
3. The pull **round-trips**: attach a fragment from project A, pull it into project B, and B's
   graph is functionally the fragment. Driven in the real editor with two real projects, not
   asserted over serialised JSON. ⚠️ Round-trip specs on this codebase have passed *around* dropped
   per-connection fields before.
4. **Nothing is written to a project without an explicit action.** Opening a thread must not touch
   the graph; the editor's own history has a case where merely opening a project dirtied every
   component, and this is the same shape.
5. It works from **both** thread surfaces — rail panel (inside a project) and launcher tab (not
   inside one). 🔴 From the launcher there is no project to pull into: that state is designed, not
   discovered at runtime.
6. D15: a refused viewer never reaches an attachment, so never reaches this verb.

## Traps

- 🔴 **Do not grow an "edit and repost" affordance.** NAT-007's trap says rendering is safe because
  the publish path redacted the fragment on the way out. A pull brings that fragment *into* a
  project; if the same UI then offers to send it back, user content round-trips out without
  passing the redaction a second time. **In is not a licence for out.**
- 🔴 **`forEachNode` stops on a truthy return.** Any traversal written to collect node types or
  rewrite ids will silently visit part of the graph. This has bitten this codebase before.
- ⚠️ **Ids must be rewritten, and connections rewritten with them.** A fragment carries ids that
  may already exist in the target project. Per-connection fields are the ones that get dropped.
- ⚠️ **This is the verb that makes the community worth having in the editor at all** — and it is
  also the smallest task in Tier 3. If it slips, the phase still closes; say so rather than letting
  it hold NAT-007.
