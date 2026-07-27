# AIX-010: Project review & docs retrofit

## Metadata

| Field | Value |
|-------|-------|
| **ID** | AIX-010 |
| **Phase** | Phase 15 — AI Collaboration Experience (Track C) |
| **Priority** | 🟡 Medium — nothing is broken without it, but without it AIX-009 only ever helps projects started *after* AIX-009 |
| **Difficulty** | 🟡 Medium — the machinery mostly exists; the risk is output quality, not plumbing |
| **Prerequisites** | AIX-009, AIX-004 (landed) |
| **Recommended executor** | 🟠 Opus 4.8 — a clear target built from two shipped subsystems |
| **Branch** | commit directly to `cline-dev` |

## Objective

Point the assistant at a project that was built by hand, have it read the whole
graph and draft the `docs/` set for review — and surface that offer where the
user will actually see it.

## Background

AIX-009 is worth most to a project that has docs. Every project that exists
today has none, and telling someone "write three markdown files and then the AI
gets better" is a cost with a deferred, invisible payoff — the classic reason
context files never get written.

The retrofit inverts it: the AI drafts them from what is already on the canvas,
the human corrects rather than composes, and the payoff is immediate on the next
authoring turn.

Both halves of the machinery are already shipped. Explain Mode (AIX-004) reads a
graph and narrates it against a real-project corpus, with bounded context
assembly and citations. `AuthoringContextBuilder` renders a project overview and
individual components under a charged budget. What is missing is a scope above
`component` and an output target that is a file rather than a panel.

The care needed is in *what it writes*. A retrofit that emits a node inventory
in prose is worse than nothing: it is the exact rot-prone graph restatement
AIX-009 exists to avoid, dressed up as a deliverable.

## Current state

| Fact | Evidence |
|---|---|
| Explain Mode tops out at component scope | `ExplainScope = 'node' \| 'subgraph' \| 'component'` — [`explain/types.ts:16`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/explain/types.ts#L16) |
| Explain assembles bounded context and cites nodes | `models/AiAssistant/explain/` — `assemble.ts`, `citations.ts`, `prompts.ts` |
| A project overview renderer exists (one line per component + interface) | [`ContextBuilder.ts:108`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/ContextBuilder.ts#L108) |
| MCP already exposes project-wide reads | `get_project_info`, `list_components`, `search_project`, `explain_component` — `packages/noodl-mcp/src/tools/read.ts` |
| Backend schema extraction exists | `models/AiAssistant/DatabaseSchemaExtractor.ts` |
| Nothing surfaces a recommendation to the user anywhere | No banner/nudge surface in the sidebar panels today |

## Scope

### 1. A project scope for reading

Extend Explain's context assembly with a `project` scope, or add a sibling
assembler if the prompt shapes diverge enough to make one function dishonest.
Either way it must obey the same charged-budget discipline as the authoring
builder, because a large project cannot be read whole and pretending otherwise
is how this task fails silently on the only projects that matter.

Proposed assembly, cheapest first:

1. Project overview — every component, name, type, interface
2. Routes (`nodegx.routes.json`) — the page graph as declared, not inferred
3. Backend schema via `DatabaseSchemaExtractor`, and configured backend services
4. Style vocabulary (already rendered by AIX-006's `buildStyleVocabulary`)
5. Full reads of the *highest-signal* components only, under a budget — root/home
   component, then by inbound reference count

Step 5's selection rule is the interesting decision. Record what was chosen and
what was refused in the context log, and show it in the review UI: the user
should be able to see that the draft was written without reading 40 of their 55
components, rather than assume completeness.

### 2. What it drafts

Three files, each with a stated job and an explicit anti-goal:

| File | Drafts | Must not contain |
|---|---|---|
| `BRIEF.md` | What the app appears to be for, inferred from routes, page names, and data model; who the users appear to be | Invented product goals stated as fact |
| `ARCHITECTURE.md` | Page map, data model and collections, backend contracts, integration points, observed patterns | A node-by-node inventory, or anything Explain Mode already answers live |
| `CONVENTIONS.md` | Patterns actually observed and worth keeping — naming, page structure, how data is fetched, style token usage | Aspirational rules the project does not follow |

**Inference must be labelled as inference.** Anything the agent could not
determine from the graph is written as an explicit `> TODO:` line addressed to
the human, not smoothed over. A retrofit's value is that a person corrects it in
ten minutes; that only works if the parts needing correction are marked.

### 3. Review before write

Reuses AIX-009's doc-diff review path. Three files, each independently
accept/reject, against `docs/` as it stands (empty or partial). Re-running on a
project that already has docs proposes a diff against the existing files, never
a blind overwrite — this is also the "our docs have drifted" path, not only a
first-run path.

### 4. The recommendation surface

A dismissible banner, shown when a project has no `docs/CONVENTIONS.md`, in the
AI authoring panel and the docs panel:

> *This project has no AI context docs. Review the project and draft them →*

Rules, so this does not become the thing everyone learns to ignore:

- **Two surfaces only** — the AI panel and the docs panel. Never the canvas,
  never a modal, never on project open.
- **Dismissal is per-project and permanent**, stored in editor settings, not
  project files (it is a preference, not a project fact).
- **Never auto-runs.** The banner offers; the user starts it.
- It is a recommendation, not a warning: neutral styling, not amber, not red.
  Phase 23's palette law is that red means danger, and there is no danger here.

### 5. MCP parity

One tool, `review_project`, returning the assembled project context — so an
external agent can do this work with the same material and write back through
AIX-009's `write_project_doc`. It returns context, not prose: the drafting is
the calling agent's job, and duplicating the prompt in two places would let the
two drift.

### Out of scope

- Authoring or modifying components — read-only, entirely
- Keeping docs current as the project changes (that is AIX-011's plan step)
- Any accuracy claim about very large projects beyond what the context log admits

## Acceptance

1. Run against `project-examples/agent-chat` (262 nodes, 15 node types): the
   three drafts are produced, and `ARCHITECTURE.md` correctly identifies the
   streaming/state architecture without listing nodes.
2. Run against a project with a configured backend: `ARCHITECTURE.md` names the
   real collections and fields from `DatabaseSchemaExtractor`, not guesses.
3. Every uncertain claim carries a `> TODO:` marker. Spot-check: no confident
   assertion of a product goal the graph cannot support.
4. The context log shows what was read and what was refused, and the review UI
   shows the user that summary before they accept.
5. Re-running on a project that already has docs proposes a diff and never
   overwrites blind.
6. The banner appears only without `docs/CONVENTIONS.md`, only on the two named
   surfaces, dismisses per-project and stays dismissed across restarts.
7. Rejecting all three drafts leaves the project byte-identical.

## Risks

| Risk | Mitigation |
|---|---|
| Confident, wrong docs are worse than none | `> TODO:` labelling is an acceptance criterion, not a nicety; review is mandatory |
| The draft restates the graph and rots | Anti-goals in the table above; criterion 1 tests for it specifically |
| Large projects silently under-read | Charged budget + visible context log + criterion 4 |
| Banner fatigue | Two surfaces, permanent per-project dismissal, neutral styling, never auto-runs |

## References

- [AIX-009 — Project context documents](./AIX-009-PROJECT-CONTEXT-DOCS.md) — the format and the write path
- [AIX-004 — Explain Mode](./AIX-004-EXPLAIN-MODE.md) — the graph-reading machinery being lifted
- `models/AiAssistant/DatabaseSchemaExtractor.ts`
