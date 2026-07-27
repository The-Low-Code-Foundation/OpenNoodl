# AIX-009: Project context documents

## Metadata

| Field | Value |
|-------|-------|
| **ID** | AIX-009 |
| **Phase** | Phase 15 — AI Collaboration Experience (Track C) |
| **Priority** | 🟠 High — the cheapest remaining quality lever on authored output, and the prerequisite for every project-scope flow |
| **Difficulty** | 🟡 Medium — the code is small; the design decisions (what a doc is *for*, what the budget will carry) are the work |
| **Prerequisites** | AIX-002 (landed), AIX-006 (landed — supplies the injection precedent) |
| **Blocks** | AIX-010, AIX-011, AIX-012 |
| **Blocked by** | [DEP-008](../phase-26-deployment/DEP-008-ARTIFACT-CONTENTS-AND-IGNORE.md) (phase 26) — see [Blocking point](#blocking-point-project-docs-currently-ship-to-production) |
| **Recommended executor** | 🔵 Fable 5 — this task fixes a file format and a context contract, and both are expensive to change once projects carry them |
| **Branch** | commit directly to `cline-dev` |

## Objective

Give a NodeGX project a `docs/` folder that the human owns, git tracks, and the
AI reads before it authors anything — and never ships to production.

## Background

The authoring loop works, and AIX-007 measured it at 8/8 first-attempt validity.
What it cannot do is be *consistent with this project* beyond what the graph
itself encodes. AIX-006 proved how much that is worth: exposing the project's
style tokens to `AuthoringContextBuilder` produced **2.4× more on-system
styling** for roughly a week of work. That is the entire thesis of this task
generalised — the agent is not short of capability, it is short of *your*
context.

Everything the graph can express, the graph already expresses, and Explain Mode
(AIX-004) narrates it on demand from the live artifact. So this task deliberately
does **not** produce markdown that describes the graph. A second description of
the graph is a second source of truth, it rots the moment a node moves, and it
quietly undoes the phase-15 premise that *the graph is the legible spec*.

What the graph structurally cannot hold is the reason for it: why this data shape
and not that one, which page is authoritative for a record, what the third-party
API guarantees, what was considered and rejected, and — most valuable of all —
the rules the assistant should follow the *next* time it is asked to build
something here. That last one is not documentation for a human at all. It is
agent context that happens to be readable, and it is the highest-value file in
the set.

## Current state

| Fact | Evidence |
|---|---|
| No project-level doc convention exists | Nothing in `ProjectModel` or the v2 file set (`nodegx.project.json`, `components/`, `nodegx.routes.json`, `nodegx.styles.json`) reserves a place for prose |
| The authoring agent's project context is: an overview line per component, plus ≤6 component reads | [`ContextBuilder.ts:32`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/ContextBuilder.ts#L32), [`ContextBuilder.ts:108`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/ContextBuilder.ts#L108) |
| Every context source is charged against a hard budget and logged | `charge()` at [`ContextBuilder.ts:93`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/ContextBuilder.ts#L93); refusals are recorded, not silent |
| There is an injection precedent to copy exactly | `styleVocabulary()` at [`ContextBuilder.ts:143`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/ContextBuilder.ts#L143) |
| A markdown **reader** already exists and is in use | `packages/noodl-core-ui/src/components/common/Markdown/` — consumed by `ExplainPanel` and `GitHubPanel` |
| A CodeMirror **editor** exists, with JS and JSON modes only | `packages/noodl-core-ui/src/components/code-editor/` — no `@codemirror/lang-markdown` yet |
| A file tree panel exists | `views/panels/FileExplorerPanel/` |
| MCP reaches project files directly off disk | `ProjectStore` at [`ProjectStore.ts:103`](../../../packages/noodl-mcp/src/project/ProjectStore.ts#L103) — `projectDir` + atomic JSON writes |

## Blocking point: project docs currently ship to production

**This task must not land before the deployment overhaul resolves it.**

`copyProjectFilesToFolder` copies the *entire* project folder into the deploy
output, filtered by a hardcoded five-name list plus two substring checks:

```ts
// packages/noodl-editor/src/editor/src/utils/compilation/build/copy.ts:6
// TODO: Load something like .noodlignore file list
const ignoreFiles = ['.DS_Store', '.gitignore', '.gitattributes', 'project.json', 'Dockerfile'];
...
if (f.fullPath.indexOf('.git') !== -1) return false;   // Ignore git files
if (f.fullPath.indexOf('.noodl') !== -1) return false; // Ignore noodl files
```

A `docs/` folder holding scoping notes, rejected approaches, backend contracts
and internal reasoning would therefore be published to the app's public origin
on the next deploy. The TODO asking for `.noodlignore` is already sitting on
line 6.

Three options were considered and two rejected:

- **Hide the folder** (`.nodegx/docs/`) so the existing `.noodl` substring check
  catches it. Rejected: it relies on a coincidence of substring matching, and it
  hides from the human a folder whose whole purpose is that they read and edit
  it in their normal editor.
- **Add `docs` to `ignoreFiles` here.** Rejected as the *permanent* answer — it
  is one more hardcoded name on a list that already needs replacing, and it
  leaves every other private file a user puts in their project still leaking.
- **Declare the dependency and let the deployment overhaul solve the general
  case.** Chosen. The correct fix is a real ignore mechanism with a sane
  default set, which is deployment's problem, not AI's.

**Owned as of 2026-07-27:** phase 26 (Deployment, Track K) has taken this as
[DEP-008 — Artifact contents & the ignore mechanism](../phase-26-deployment/DEP-008-ARTIFACT-CONTENTS-AND-IGNORE.md),
tier 1, alongside DEP-001. The original hand-off text is kept at
[`DEPLOY-HANDOFF-PROJECT-DOCS.md`](./DEPLOY-HANDOFF-PROJECT-DOCS.md) as the
record of what was asked for.

**Interim position if AIX-009 must start first:** implement everything, ship it
behind the docs folder existing, and do *not* mark the task complete until a
deploy of a project with a populated `docs/` is verified to contain no `docs/`
in its output. That verification is an acceptance criterion below.

## Scope

### 1. The format

A project's docs live in `docs/` at the project root, in plain markdown, with no
manifest file and no `project.json` involvement — git owns them, and a text
editor is a first-class way to work on them.

| File | Audience | Purpose |
|---|---|---|
| `docs/BRIEF.md` | human + AI | What this app is, who uses it, what is deliberately out of scope |
| `docs/ARCHITECTURE.md` | human + AI | Page map, data model, backend contracts, and the decisions behind them — *reasons*, not a node inventory |
| `docs/CONVENTIONS.md` | **AI first** | The rules the assistant must follow in this project. The clinerules equivalent |
| `docs/decisions/*.md` | human | Optional, free-form. One file per significant decision. Never auto-injected |

Only these four paths are known to the system. Any other markdown in `docs/` is
carried, listed and editable, but never injected into a prompt.

Detection: a project "has docs" iff `docs/CONVENTIONS.md` exists. That single
predicate drives the AIX-010 recommendation banner.

### 2. `ProjectDocsModel`

New model under `models/ProjectDocs/`, filesystem-backed, no schema migration:

- read/write the four known paths plus arbitrary `docs/**.md`
- create the folder and seed the three top-level files from templates
- watch for external edits (the user *will* edit these in VS Code — the panel
  must not hold a stale buffer and clobber them)
- writes go through the platform `filesystem` abstraction, atomically, in the
  same style as `ProjectStore`'s `writeJsonAtomic`

### 3. Context injection — the AIX-006 seam, reused verbatim

Add to `AuthoringContextBuilder`, each charged through `charge()` so budget
accounting and refusal logging stay honest:

- `projectConventions()` — `CONVENTIONS.md`, **injected by default** on every
  authoring turn, hard-capped (proposed: 4,000 chars). Over the cap the source
  is truncated at a heading boundary and the truncation is *stated in the
  injected text*, not silently dropped.
- `projectBrief()` — `BRIEF.md`, injected by default, capped lower (proposed:
  1,500 chars).
- `projectArchitecture()` — `ARCHITECTURE.md`, **pull-only** via a new
  `get_project_doc` tool. It is the largest file and is not needed on most
  turns; making the agent ask for it keeps the default turn cheap and keeps
  AIX-007's cache prefix stable.

Ordering matters and is not optional: these are stable per-project blocks, so
they belong in the **cache-stable prefix** established by AIX-007, ahead of the
varying request. Getting this wrong costs the 73% cache hit rate.

The system prompt gains one section (`PROJECT CONVENTIONS`) instructing the
agent that project conventions outrank its own defaults, and that a convention
it cannot satisfy must be *reported*, not silently ignored.

### 4. MCP tools

So that Claude Code / Claude Desktop driving a project through `noodl-mcp` are
first-class participants rather than second-class:

| Tool | Behaviour |
|---|---|
| `list_project_docs` | Paths, sizes, last-modified, plus which of the four known files are missing |
| `get_project_doc` | Read one doc by path (rejects paths outside `docs/`) |
| `write_project_doc` | Write one doc. **Whole-file replacement**, matching the whole-candidate contract used everywhere else in this phase |

Registered in a new `packages/noodl-mcp/src/tools/docsTools.ts`, following the
existing `server.registerTool` shape in `read.ts`.

### 5. Writes are reviewed, never automatic

An AI-proposed doc change is presented as a **diff the user accepts or
rejects**, in the same discipline as a component candidate — reject leaves no
trace, accept is one undoable step. An assistant that rewrites `ARCHITECTURE.md`
after every component lands produces changelog sludge that nobody reads and,
within a fortnight, nobody trusts.

### 6. The panel

A `DocsPanel` in the sidebar: file list on the left, `Markdown` render by
default, toggle to a CodeMirror source view. Needs `@codemirror/lang-markdown`
added to `noodl-core-ui` (the only new dependency in this task).

Deliberately **not** a markdown IDE. These are files on disk in git, and VS Code
exists. The panel earns its place as the surface where AI-proposed doc diffs are
reviewed and where the AIX-010 recommendation surfaces — not as a text editor.

### Out of scope

- Publishing docs anywhere, or any docs-to-website path (this is creator-facing only)
- Generating docs from an existing graph — that is AIX-010
- Multi-component authoring — that is AIX-011
- Fixing the deploy copy filter — that is the deployment overhaul, by design

## Acceptance

1. A project with `docs/CONVENTIONS.md` containing a stated rule (e.g. "every
   page's outermost node is a Group named `Page Root`") produces components
   obeying it, and a project without the file is unaffected.
2. A convention the agent *cannot* satisfy appears in its response as an
   explicit note. It is never silently dropped.
3. The context log shows `project-conventions` and `project-brief` charged with
   real character counts; an oversized `CONVENTIONS.md` is truncated with the
   truncation visible in the injected text.
4. AIX-007's cache behaviour is unregressed: cache reads still occur on turn 2+
   of a multi-turn session with docs present.
5. `list_project_docs` / `get_project_doc` / `write_project_doc` work against a
   real project directory from the MCP server, and reject paths outside `docs/`.
6. An AI-proposed doc change is shown as a diff; rejecting it leaves the file
   byte-identical; accepting it is a single undo step.
7. Editing `docs/BRIEF.md` in an external editor while the panel is open updates
   the panel and does not clobber the external edit.
8. **Deploy gate:** deploying a project with a populated `docs/` produces an
   output folder containing no `docs/` and no `.md` from it. *(Depends on the
   deployment overhaul; this criterion is the interlock.)*

## Risks

| Risk | Mitigation |
|---|---|
| Docs leak to the public origin | The blocking point above; acceptance criterion 8 is a hard gate |
| Context budget eaten by prose, squeezing out component reads | Hard per-source caps, charged through the existing budget, refusals logged — the same discipline that already governs component reads |
| Cache prefix destabilised, costs regress toward pre-AIX-007 | Docs go in the stable prefix; criterion 4 asserts it |
| Docs drift from reality and actively mislead the agent | Format excludes graph description by construction; AIX-010 supplies a re-review path |
| Two writers (panel and external editor) race | File watching + whole-file writes; criterion 7 |

## References

- [AIX-002 — The Authoring Loop](./AIX-002-AUTHORING-LOOP.md) — the loop this extends
- [AIX-006 — Style Vocabulary](./AIX-006-STYLE-VOCABULARY.md) — the injection precedent and its measured payoff
- [AIX-007 — Token Cost Reduction](./AIX-007-TOKEN-COST-REDUCTION.md) — the cache-prefix constraint
- [DEPLOY-HANDOFF-PROJECT-DOCS.md](./DEPLOY-HANDOFF-PROJECT-DOCS.md) — the blocking point, in paste-ready form
