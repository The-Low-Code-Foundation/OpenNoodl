# SUB-008: Noodl MCP Server

## Metadata

| Field | Value |
|-------|-------|
| **ID** | SUB-008 |
| **Phase** | Phase 13 — Format & AI Substrate (Revival Track A) |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 3–4 weeks |
| **Prerequisites** | SUB-001, SUB-004, SUB-006 (read-only surface possible earlier) |
| **Branch** | `task/sub-008-mcp-server` |
| **Recommended executor** | 🔵 **Fable 5** — the protocol plumbing is routine, but the tool surface *is* the public API through which every external agent will ever perceive Noodl. Granularity, naming, and error design determine whether agents succeed or flail. Implementation delegable to Opus once the surface is designed. |

## Objective

Expose Noodl projects to external AI agents through a Model Context Protocol server: open, inspect, author, and validate projects programmatically, without the agent needing the editor or the whole project in context.

## Background

The obvious way to add AI to a visual builder is to build an assistant into the editor. Phase 15 does exactly that, and it should. But building *only* that would repeat the strategic mistake the viability assessment identified in the original roadmap: assuming the product must supply every capability itself.

By 2026 the leverage is elsewhere. Developers already work with capable agents — in their terminal, their IDE, their CI. Those agents can read files, run tools, and iterate against feedback. What they cannot do is understand a Noodl project, because the format is opaque, monolithic, and semantically undocumented. Phase 13 fixes precisely those three things. An MCP server is the small remaining step that turns the work into an interface: it makes Noodl a **first-class target for the entire agent ecosystem** rather than a walled garden with one in-house assistant.

The strategic bet is that "any agent you already use can build Noodl pages, and you can read exactly what it built" is a stronger position than "our editor has a chat panel." It also hedges the AI-experience risk: if the in-editor assistant disappoints, the substrate still has value.

This task is the practical realisation of Gate G1 in the revival roadmap — the demonstration that an external agent can author a valid page without ingesting the whole project.

## Current State

- No programmatic interface to Noodl projects exists. The only ways in are the editor UI and hand-editing JSON.
- After SUB-001/004/006 the necessary pieces exist as libraries: per-component file access, a node catalog, and a semantic validator. None is exposed outside the editor process.
- The editor is Electron and holds project state in memory; a server needs to operate on project files directly rather than through the running editor (at least initially).

## Desired State

An MCP server, runnable standalone (`npx` or a bundled binary), offering tools roughly along these lines:

**Read**: list components; read a component's graph; read project metadata and settings; search the project for node types or patterns; get the node catalog (full or filtered).

**Author**: create a component; modify a component's nodes and connections; delete a component — each returning validation results rather than silently accepting bad input.

**Validate**: validate a component or the whole project, returning SUB-006 diagnostics.

**Explain**: given a component, return a structured description of its graph suitable for summarisation.

The essential property: an agent should be able to author a correct child page having read only that page's parent, the catalog, and the validator's feedback — never the entire project.

## Scope

### In Scope
- [ ] MCP server implementation with the tool surface above
- [ ] Operate directly on v2 project files on disk (no running editor required)
- [ ] Every mutating tool runs semantic validation and returns diagnostics
- [ ] Catalog access with filtering, so agents can fetch only relevant node types
- [ ] File locking or conflict detection if the editor has the project open simultaneously
- [ ] Read-only mode as the default; writes require explicit opt-in
- [ ] Documentation and example agent sessions
- [ ] Distribution: publishable package plus setup instructions for common agent hosts

### Out of Scope
- The in-editor AI assistant (Phase 15 — different surface, shares the substrate)
- Authentication/multi-tenant hosting (local-first tool for now)
- Live editor state synchronisation (file-based initially; a running-editor bridge can come later)
- Agent-side prompting strategy (that belongs to whoever writes the agent)

## Technical Approach

### New Files to Create

| File | Purpose |
|------|---------|
| `packages/noodl-mcp/` | New package: MCP server |
| `packages/noodl-mcp/src/tools/*.ts` | One file per tool |
| `packages/noodl-mcp/src/project/` | File-based project access built on the io/ engines |
| `packages/noodl-mcp/README.md` | Setup, tool reference, example sessions |

### Design notes

The io/ engines are already pure and filesystem-free, which makes them directly reusable here — this is the payoff for that design choice. The main structural question is where shared code should live: `ProjectExporter`/`ProjectImporter`/the validator currently sit inside `noodl-editor`. If reuse proves awkward, extract them into a shared package rather than duplicating logic; two copies of the format engines would be a serious long-term liability.

**Tool granularity is the key design decision.** Too coarse ("modify project") and agents make sweeping unreviewable changes; too fine ("set one parameter") and every task becomes a hundred round trips. Aim for component-level operations, since that granularity matches both the file layout and how humans think about the work — and it is the unit Phase 15's review UI can display.

Error responses matter as much as success responses: a rejected write should return diagnostics precise enough that the agent's next attempt is informed, exactly as SUB-006 specifies.

## Implementation Steps

1. **Design the tool surface** and review it against realistic agent transcripts before implementing — write out, by hand, the sequence of calls an agent would make to add a page to an existing app. Revise the surface until that sequence reads sensibly.
2. **Resolve code sharing** with the editor (reuse in place, or extract a shared package).
3. **Read-only tools first** — list, read, catalog, search. These alone deliver real value and are safe.
4. **Validation tool** wrapping SUB-006.
5. **Authoring tools** with mandatory validation on every write, opt-in enabled, and clear diagnostics on rejection.
6. **Concurrency safety** — detect an editor holding the project; never write into an inconsistent state.
7. **Documentation and example sessions**, then the Gate G1 demonstration: an external agent authors a valid new page in a real project using only the MCP surface.

## Testing Plan

- Tool-level tests against fixture projects.
- Round-trip: author a component via MCP, open it in the editor, confirm it loads and behaves.
- Rejection path: attempt invalid authoring; confirm diagnostics are actionable and nothing was written.
- Concurrency: editor open + MCP write attempt behaves safely.
- **Gate G1 acceptance:** a real external agent, given only the MCP tools, adds a working page to a real project without reading the whole project. Record the transcript.

## Success Criteria

- [ ] Server runs standalone against a v2 project directory
- [ ] Read, author, validate, and explain tools implemented
- [ ] Every write validated; rejections return actionable diagnostics
- [ ] Read-only by default; writes explicitly opted into
- [ ] Concurrent editor access handled safely
- [ ] Format engine logic shared with the editor, not duplicated
- [ ] Documentation with example sessions published
- [ ] **Gate G1 demonstration passes and is recorded**

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| An agent corrupts a project through the write tools | Read-only default; validation on every write; component-level granularity; recommend Git-tracked projects so any change is reviewable and revertible |
| Tool surface proves wrong once real agents use it, and is hard to change | Design against hand-written agent transcripts first; version the tool surface; treat the Gate G1 exercise as design feedback, not just acceptance |
| Format logic gets duplicated between editor and server | Decide the sharing strategy in step 2, before writing any project access code |
| Writes collide with a running editor | Lock detection; refuse rather than race |

## References

- [Revival roadmap — Track A (A-08) and Gate G1](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- [Viability report — §2.1, §4.2](../../reviews/NOODL-VIABILITY-REPORT.md)
- Depends on: SUB-001, SUB-004, SUB-006. Related: Phase 15 (shares the substrate)
- Model Context Protocol specification

## Checklist

- [x] ~~Branch `task/sub-008-mcp-server`~~ (work committed directly to `cline-dev` per workflow)
- [x] Design tool surface against hand-written agent transcripts (`packages/noodl-mcp/docs/DESIGN.md`)
- [x] Resolve editor/server code sharing (import editor's pure modules by path, esbuild-bundle; zero duplication)
- [x] Implement read-only tools, then validation, then authoring (14 tools; writes behind `--allow-writes`)
- [x] Concurrency safety with a running editor (revision tokens + drift detection + atomic writes — conflict *detection*, documented)
- [x] Documentation + example sessions (`packages/noodl-mcp/README.md`, `examples/call-tool.mjs`)
- [x] Run and record the Gate G1 demonstration (`../g1/GATE-G1-DEMONSTRATION.md` + transcript) — passed; surfaced and fixed one real bug (legacy id-less components)
- [x] CHANGELOG (phase PROGRESS.md change log, 2026-07-23)

**Status: ✅ Complete (2026-07-23).** Deferred to future work: project-settings/styles/routes
writes, asset + model tools, npm publish, live running-editor bridge (SUB-009/Phase 15).
