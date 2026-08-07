# OPS-008: The Project Journal & `query_context`

## Metadata

| Field | Value |
|-------|-------|
| **ID** | OPS-008 |
| **Phase** | Phase 31 — Readiness & Operations (Track P) |
| **Tier** | 4 — the narrative |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | ~1 wk |
| **Prerequisites** | none (AIX-002 makes it write itself; without it the journal is authored by hand) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** — what gets written down, and what must never be, is the decision |

## Objective

The half of the Project Brain that NodeGX does not already have: a small, queryable record of
*decisions, gotchas and what happened*, written as work is done and read back by the AI as a few
relevant sentences rather than a whole file.

## Background

The [project-brain chapter](../../../../ai-coding-docs/docs/part-5/project-brain.md) proposes three
layers — an MCP spine plus `.brain/` data, a per-agent enforcement adapter, and a standalone viewer —
to give a code project a live visual model plus an authored narrative.

Its central principle is the one that makes this task small:

> "**Put each fact in the layer that actually knows it.** The schema knows the schema — don't ask the
> agent to restate it. Only the human-and-agent conversation knows *why* — so that's the only part
> anyone authors."

Its derived views are API surface (from OpenAPI), database schema (from migrations), and workflow
graphs (from graph exports). **NodeGX has all three natively**: the graph *is* the model, the schema
manager owns the schema, and WFA-004 renders workflows on the canvas. The viewer layer is the editor.
The adapter layer is unnecessary — the agent is ours.

What is left is the authored quarter: decisions, timeline, tests, gotchas. NodeGX has none of it, and
its absence shows up as the same rediscovery loop the chapter describes — a fresh AI session that has
no idea why this project polls instead of subscribing.

The chapter's economics are the reason to bother:

> "Write cost is small and constant. […] Read savings compound. […] An older project is where a fresh
> session would waste the most time rediscovering things — and that's exactly where `query_context`
> saves the most."

## Current State

| Piece | State |
|---|---|
| Derived structure | the graph, the schema manager, the workflow canvas — all live, none drift |
| Authored narrative | nothing |
| MCP tools | `packages/noodl-mcp/src/tools/` — author, review, plan, docs, catalog, validate, backend, style |
| Search substrate | BAK-008 shipped FTS5 on `node:sqlite`; the pattern is proven in this codebase |
| Findings | OPS-003 — observations about the *app*, deliberately separate from decisions about the *project* |

## Desired State

### 1. Four entry kinds, and no fifth

```ts
type JournalEntry =
  | { kind: 'decision'; area: string[]; what: string; why: string; alternatives?: string }
  | { kind: 'gotcha';   area: string[]; symptom: string; cause: string; avoid: string }
  | { kind: 'event';    area: string[]; what: string }          // shipped, deployed, tested, reverted
  | { kind: 'coverage'; area: string[]; tested: string; notTested: string };
```

`area` is what makes retrieval cheap: component names, node types, backend collections, workflow names
— the vocabulary the project already uses, so a query can be scoped without embeddings.

**Nothing structural is authored.** If an entry restates something the graph knows, it is a bug in the
entry, and the panel should be able to say so for the obvious cases (an entry naming only node types
and containing no *why* is a candidate for deletion).

### 2. The 30-minute test, enforced

The [project-memory chapter](../../../../ai-coding-docs/docs/part-5/project-memory.md)'s litmus test is
the thing that keeps this file useful rather than a dumping ground:

> "Would a fresh session hitting this same problem waste 30+ minutes without this entry?"

Applied here as: gotchas carry a `cost` estimate and a cap on active entries, with a **graduation**
path — an entry whose cause was fixed architecturally moves to an archived set rather than being
deleted. The chapter's list of what does *not* belong (general knowledge, progress notes, preferences)
goes in the tool description, where the model will actually read it.

### 3. Written as work completes

- The AIX-002 authoring loop appends on accept: what changed and why, one entry, no essay.
- A user can add one by hand from a panel, in two fields.
- **Soft enforcement, per the chapter's recommendation.** A rule that the loop writes, not a hook that
  blocks. The chapter is explicit that hard enforcement is "the fix for a problem you've *measured*."
  If entries turn out to be routinely skipped, that is a follow-up with evidence.

### 4. `query_context` is the point

An MCP tool taking areas and returning a handful of entries, not a file:

```
query_context({ area: ['CheckoutForm', 'cloud:createOrder'] })
  → 2 decisions + 1 gotcha
```

Ranked by area overlap and recency, capped hard — a tool that can return forty entries will return
forty entries and the token argument evaporates. FTS5 over `node:sqlite` (BAK-008's engine) for text
search; no embeddings in this task.

### 5. A panel, because the human needs it too

A timeline view: decisions and gotchas by area, filterable, with the archived set behind a toggle. This
is also where the chapter's comprehension argument lands for NodeGX — not "render the graph" (we have
that) but "why is the graph like this."

### 6. It travels with the project

Stored in the project, committed by default (unlike findings). A project handed to someone else, or
reopened in a year, carries its reasons. DEP-008 must exclude it from deployed artifacts.

## Implementation Steps

1. Schema, store, FTS5 index, graduation/archive semantics.
2. `journal_add`, `query_context`, `journal_graduate` MCP tools, with the do-not-write list in the tool
   description.
3. AIX-002 append-on-accept.
4. The panel + manual entry.
5. The "this entry restates the graph" heuristic, reported, never auto-deleting.
6. Project storage; DEP-008 exclusion.
7. **Live pass**: make a real decision in a real session (pick one from this phase), record it, start a
   fresh session, and confirm `query_context` surfaces it before the agent rediscovers it.

## Success Criteria

- [ ] Four entry kinds, stored, searchable, and travelling with the project.
- [ ] `query_context` returns a capped handful ranked by area, never a file dump.
- [ ] AIX-002 appends one entry on accept without being asked.
- [ ] Graduation archives rather than deletes.
- [ ] The restates-the-graph heuristic flags an obvious case in the fixture.
- [ ] Journal content is excluded from deployed artifacts.
- [ ] A fresh session demonstrably benefits — recorded in `OPS-008-NOTES.md` with the before/after.

## Out of Scope

- **Derived views.** NodeGX has them. Do not build a second representation of the graph.
- **An enforcement adapter.** The chapter needs one because the agent is third-party. Ours is not.
- **A standalone viewer.** The editor is the viewer.
- **Cross-project global memory.** The chapter's `~/.cline/global_memory.db` tier is a user-level
  concern, not a project feature. Noted, not built.
- **Embeddings / semantic search.** FTS5 first. The chapter itself says SQLite covers 95% of cases.
- **Session logging.** "What happened in this chat" belongs to the agent harness, not the project file.

## Traps

- **This file's failure mode is bloat, and it is the default.** Models love writing entries. Without
  the cap, the graduation path and the do-not-write list *in the tool description*, this is a
  `LEARNINGS.md` that nobody reads within two months.
- **An entry that restates the graph is worse than no entry** — it can go stale, where the graph
  cannot. That is precisely the drift the derived/authored split exists to prevent.
- **Do not merge with findings (OPS-003).** Findings are observations about the running app and mostly
  get resolved and forgotten; journal entries are reasons and mostly do not. Merging them buries the
  four decisions that matter under three hundred "this button was confusing."
- **Committed by default means it can leak.** A decision entry explaining "we use this vendor because
  their key is in the ops config" has put something in git. Run journal writes through `ops/redact.ts`
  and say so in the tool description.
- **`query_context` will be tempting to call with no area.** Make the unscoped call return the *most
  recent few* and say it is unscoped, rather than everything.
</content>
