# LEARN-003: Browser-Based Read-Only Graph Viewer

## Metadata

| Field | Value |
|-------|-------|
| **ID** | LEARN-003 |
| **Phase** | Phase 17 — Noodl Learn (Revival Track E) |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 6–8 weeks |
| **Prerequisites** | SUB-001 (v2 per-component files) |
| **Branch** | `task/learn-003-web-viewer` |
| **Recommended executor** | 🟠 **Opus 4.8** — a self-contained web application with a clear spec, whose main design question (reuse the canvas renderer or write a light one) is answerable by investigation rather than judgement about the product. |

## Objective

Build a browser-based, read-only viewer for Noodl graphs, so a project can be looked at, shared, and discussed via a link — without installing the Electron editor.

## Background

OpenNoodl's editor is a desktop application, and for the professional user that is fine. For the education wedge it is close to disqualifying. Schools run managed Chromebooks and locked-down lab machines where installing a desktop application requires IT involvement that most teachers will not undertake for a tool they are evaluating. "Download this Electron app" is where the classroom conversation ends.

A read-only web viewer sidesteps this at roughly a tenth of the cost of a web editor. It does not let anyone build in the browser — that is LEARN-004's separate and much larger question — but it makes everything else shareable. A teacher can send students a link to the graph they are about to build. A student can share what they made without their peers installing anything. A lesson can reference a live example. And, usefully beyond education, an AI-authored page can be reviewed by someone who does not have the editor at all.

There is a second, less obvious argument. The product's central claim is that a node graph is *legible* in a way generated code is not. That claim is much easier to make when the graph can be looked at from a link than when looking requires a desktop install and a project file.

## Current State

- The editor is Electron-only. There is no browser-accessible view of a project's graphs.
- `noodl-viewer-react` runs deployed *applications* in the browser, but that renders the app, not the graph.
- SUB-001 makes projects into per-component JSON files, which are straightforward to serve and fetch — this is what makes a light viewer feasible.
- SUB-004's node catalog provides display names, port names, and categories needed to render nodes meaningfully.
- The editor's canvas rendering lives in `nodegrapheditor.ts` and its associated code; PLAT-001 is decomposing it, which may make parts reusable.

## Desired State

- Open a URL, see a project's component graphs rendered accurately.
- Navigate between components; follow component references.
- Inspect a node: its type, parameters, and connections.
- Pan and zoom, on desktop and touch.
- Works on a Chromebook, with no install and no account.
- Loads only the components it needs (the payoff of decomposition).

## Scope

### In Scope
- [ ] Web application rendering v2 component graphs read-only
- [ ] Component navigation and cross-references
- [ ] Node inspection (type, parameters, connections)
- [ ] Pan/zoom with touch support
- [ ] Lazy loading per component
- [ ] Static hosting compatible (no server-side execution required)
- [ ] Sharing model: a project (or component) is publishable to a URL
- [ ] Visual parity with the editor canvas sufficient that a learner recognises what they are looking at
- [ ] Accessibility basics: keyboard navigation and readable contrast

### Out of Scope
- Editing of any kind (LEARN-004 assesses whether that is feasible)
- Running the application (that is the deployed app, a different thing)
- Authentication, accounts, or private sharing (start public-link only)
- Real-time collaboration (ECO-001)

## Technical Approach

### The main decision

**Reuse the editor's canvas renderer, or write a lightweight one?** Reuse gives exact visual parity and avoids two renderers drifting; a fresh renderer is likely far smaller, has no Electron assumptions, and no coupling to editor internals. Investigate this in the first week and record the decision — it determines the shape of everything else.

The pragmatic expectation: the editor's renderer is entangled with editor state, interaction, and (until PLAT-001 lands) a 3,481-line host file, so a purpose-built read-only renderer is probably faster and cleaner. But if PLAT-001 has extracted a clean rendering module, reuse becomes genuinely attractive. Coordinate with that task before deciding.

Visual parity matters more than it might seem. If the web view looks materially different from the editor, a learner following a lesson will not recognise the correspondence, and the viewer's teaching value drops sharply. Same layout, same node shapes, same colour semantics.

### Hosting

Keep it static. A viewer that requires a server is a viewer that requires someone to run a server, which reintroduces the friction this task exists to remove. Serving a directory of v2 JSON files plus a static bundle should be enough.

## Implementation Steps

1. **Decide the renderer approach** (reuse vs. purpose-built) and record the reasoning; coordinate with PLAT-001.
2. **Render one component graph** from v2 files — nodes, connections, layout — proving the pipeline.
3. **Pan/zoom and touch interaction.**
4. **Node inspection panel** using catalog metadata.
5. **Component navigation** including following component-reference nodes.
6. **Lazy loading** so large projects open fast.
7. **Publish/share flow**: how a project becomes a URL (this may be as simple as exporting a static bundle the user hosts).
8. **Chromebook and tablet testing** on real devices, not emulation.

## Testing Plan

- Visual comparison against the editor for a corpus of real components — a learner should recognise the correspondence immediately.
- Large project: open time and interaction smoothness with lazy loading.
- Real-device testing on a Chromebook and a tablet.
- Static hosting verification (no server-side dependency).
- Accessibility: keyboard navigation and contrast checks.

## Success Criteria

- [ ] Renderer approach decided and recorded
- [ ] v2 component graphs render accurately with visual parity to the editor
- [ ] Component navigation and node inspection work
- [ ] Pan/zoom smooth on desktop and touch
- [ ] Lazy loading keeps large projects fast
- [ ] Runs from static hosting with no install and no account
- [ ] Verified on a real Chromebook
- [ ] Keyboard navigation and contrast pass basic accessibility checks

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Two renderers drift, and the web view stops matching the editor | Visual-parity test corpus run in CI; if PLAT-001 produces a clean rendering module, reconsider reuse |
| Scope creeps toward editing | Explicitly read-only; editing is LEARN-004's question and its own project |
| Performance on low-end Chromebooks | Lazy loading in scope from the start; test on real hardware, not a fast laptop's emulation |
| Sharing implies hosting, which implies a product | Static-bundle publishing only; a hosted platform is ECO-004 |

## References

- [Revival roadmap — Track E (E-03)](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- [Viability report — §2.2 (education distribution is unaddressed)](../../reviews/NOODL-VIABILITY-REPORT.md)
- Depends on: SUB-001, SUB-004. Related: PLAT-001 (renderer extraction), LEARN-004 (the editor question)

## Checklist

- [ ] Branch `task/learn-003-web-viewer`
- [ ] Decide and record the renderer approach; coordinate with PLAT-001
- [ ] Render a component graph from v2 files; add pan/zoom/touch
- [ ] Node inspection; component navigation; lazy loading
- [ ] Static publish/share flow
- [ ] Real Chromebook and tablet testing; accessibility checks
- [ ] CHANGELOG; open PR
