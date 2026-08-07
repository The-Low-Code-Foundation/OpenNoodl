# AIX-012: AI project creation

## Metadata

| Field | Value |
|-------|-------|
| **ID** | AIX-012 |
| **Phase** | Phase 15 — AI Collaboration Experience (Track C) |
| **Priority** | 🟠 High — this is the on-ramp the G2 demo is judged on; it is also the moment scoping is cheapest |
| **Difficulty** | 🟡 Medium — the hard parts belong to AIX-011; this is the entry point and the conversation |
| **Prerequisites** | AIX-011, AIX-009 |
| **Recommended executor** | 🔵 Fable 5 — the scoping conversation's shape *is* the product here |
| **Branch** | commit directly to `cline-dev` |

## Objective

Let someone describe the app they want at the launcher, discuss the scope, and
get a documented boilerplate project — before they touch a canvas.

## Background

Project creation today collects a name, a location and a style preset, then
calls `newProject` with `projectTemplate: ''`
([`ProjectsPage.tsx:382`](../../../packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx#L382)).
There is no AI path at all.

That is the wrong moment to have no assistance, for a reason that is not about
convenience. The decisions taken in the first hour — what the pages are, what
the data model looks like, what this app is *not* — are the ones that constrain
everything after, and they are exactly the decisions the graph cannot record and
a later reader cannot recover. A scoping conversation at creation is the cheapest
documentation that will ever be written about the project, because it is being
had anyway; the only question is whether anything captures it.

It also sequences the AI work correctly. Going straight to "build me a CRM" and
watching thirty nodes appear is a demo. Discussing what the CRM is for, agreeing
five pages and a data model, writing that down, and *then* building page by page
against it is a working method — and each page still goes through AIX-002's
per-component accept/reject gate.

## Current state

| Fact | Evidence |
|---|---|
| Creation takes name + location + style preset only | `ProjectsPage.tsx:382-410` |
| Templates are plumbed but unused (`projectTemplate: ''`) | `ProjectsPage.tsx:407` |
| The modal lives in core-ui, previewable in isolation | `packages/noodl-core-ui/src/preview/launcher/Launcher/components/CreateProjectModal/` |
| New projects had a real "no Home component" failure mode once already | `EmbeddedTemplateProvider` root-node resolution; `setRootComponent` no-ops when the node library is not loaded |
| Lesson templates already fetch and instantiate hosted projects | `models/lessontemplatesmodel`, `ProjectsPage.tsx:487` |
| AI settings/credentials are configured inside the editor, not the launcher | `views/panels/AiSettings/` |

## Scope

### 1. The entry point

A third option alongside blank and preset in `CreateProjectModal`: **Start with
AI**. Chosen, it opens a scoping conversation instead of creating immediately.

Precondition: a configured provider. The launcher does not currently host AI
settings, so the option must either route to settings or be shown disabled with
the reason stated — never present and silently inert. (`IconSize` being a no-op
at 130 call sites is the standing reminder of what "present but inert" costs.)

### 2. The scoping conversation

A conversation, not a form. It is the one part of this phase that is *not* an
authoring turn, and it should not be built as one.

The agent's job is to reach a scope both parties agree on. It should ask about
the audience, the core objects and their relationships, what the pages are, what
the app deliberately will not do, and whether there is a backend. It should push
back on scope that will not survive a first build, and it must be able to end
the conversation with *less* than was asked for, explicitly stated.

Two rules:

- **It is not allowed to build during this phase.** No components, no nodes. The
  conversation's only output is prose and a plan.
- **It must be exitable at any point** with whatever has been agreed so far. A
  user who loses patience gets a project with a short brief, not nothing.

### 3. The output

On agreement, three artifacts:

1. **The project**, created through the existing `newProject` path — same style
   preset handling, same root-component resolution. No second creation path.
2. **`docs/BRIEF.md` and `docs/ARCHITECTURE.md`**, written from the conversation
   through AIX-009's write path. `docs/CONVENTIONS.md` is seeded from the
   template plus anything the conversation actually established, and is not
   invented wholesale.
3. **An AIX-011 plan**, presented but *not* executed — the handover point. The
   user reviews the plan in the editor, with the docs already on disk, and
   starts the build when they choose to.

Creating the project and writing the docs while *stopping short of building* is
the deliberate line. It means a user can walk away from a scoping session with
something durable and no half-built graph.

### 4. The scoping transcript

The conversation itself is written to `docs/decisions/000-initial-scope.md`:
what was asked, what was decided, and — the part with the longest shelf life —
what was considered and rejected. This is the single highest-value document the
project will ever have, and it exists for free at exactly this moment.

### 5. MCP parity

`create_project` on the MCP server, taking a brief and producing project + docs
+ plan, so the same on-ramp works from Claude Code. Note that `ProjectStore`
currently requires an existing v2 project directory
([`ProjectStore.ts:109`](../../../packages/noodl-mcp/src/project/ProjectStore.ts#L109))
— creation is a genuinely new capability there, not a new tool over old
plumbing.

### Out of scope

- Executing the plan (AIX-011 owns it)
- Hosted or shared project templates (`lessontemplatesmodel` territory)
- Any claim that the generated boilerplate is production-ready

## Acceptance

1. From the launcher, *"a reading list app where I track books and mark them
   finished"* yields: a real project that opens, `BRIEF.md`, `ARCHITECTURE.md`
   with a Book data model, `decisions/000-initial-scope.md`, and a plan — with
   **no components authored**.
2. Abandoning the conversation midway still produces a project and whatever docs
   were agreed. It never produces a half-built graph.
3. The created project opens with a resolved root component (the new-project
   no-Home regression does not return) and the chosen style preset applied.
4. With no AI provider configured, the option is disabled with the reason shown
   and a route to configure it. It is never present and inert.
5. Handing the plan to AIX-011 and executing it builds the described pages, and
   they honour the `CONVENTIONS.md` written minutes earlier — the end-to-end
   proof that AIX-009 through AIX-012 are one feature.
6. `docs/` in the created project does not appear in a deploy of it (inherits
   AIX-009's interlock with the deployment overhaul).

## Risks

| Risk | Mitigation |
|---|---|
| The conversation becomes an interrogation and people bail | Exitable at any point with partial output (criterion 2); the agent must be able to stop asking and propose |
| Generated boilerplate sets a low quality ceiling people never escape | It produces a *plan*, not a graph; every component still goes through the normal review gate |
| A second project-creation path diverges from the real one | Reuse `newProject` verbatim; criterion 3 tests the known failure mode |
| Confident scoping docs that are wrong | Inherits AIX-010's `> TODO:` labelling discipline for anything not actually agreed in conversation |
| Grand demo, no daily use | The scoping transcript and docs are the durable output; the graph is not the point |

## References

- [AIX-011 — Project-scope authoring](./AIX-011-PROJECT-SCOPE-AUTHORING.md) — the plan model and executor
- [AIX-009 — Project context documents](./AIX-009-PROJECT-CONTEXT-DOCS.md) — the doc format and write path
- [AIX-010 — Project review & docs retrofit](./AIX-010-PROJECT-REVIEW-AND-DOCS-RETROFIT.md) — the equivalent on-ramp for projects that already exist
- `packages/noodl-core-ui/src/preview/launcher/Launcher/components/CreateProjectModal/`
