# RUN-002: Server-Side Rendering & Static Generation

## Metadata

| Field | Value |
|-------|-------|
| **ID** | RUN-002 |
| **Phase** | Phase 16 — Runtime & Deploy Health (Revival Track D) |
| **Priority** | 🟡 Medium |
| **Difficulty** | 🔴 Hard |
| **Estimated Time** | 4–6 weeks |
| **Prerequisites** | RUN-001 (React 19 runtime) |
| **Branch** | `task/run-002-ssr-ssg` |
| **Recommended executor** | 🟠 **Opus 4.8** — genuinely hard (hydration correctness, data loading, node-by-node server compatibility) but with an existing design document and a well-understood problem shape in the React ecosystem. |

## Objective

Give projects a choice of rendering mode — client-side, server-side, or statically generated — so apps built with OpenNoodl can compete on SEO, social previews, and first-paint performance.

## Background

Everything built with OpenNoodl today is a client-rendered single-page application: the browser downloads the runtime and the project graph, then renders. That is fine for internal tools and applications behind a login, and poor for anything public. Search engines index such pages unevenly, social platforms generate no useful link previews, and first paint waits on a JavaScript download and interpretation step.

For a tool whose users often build marketing sites, portfolios, and small public products, this is a real ceiling — and one that users hit late, after they have built something they now cannot rank or share well.

The interesting historical detail, recorded in `dev-docs/future-projects/SSR-SUPPORT.md`, is that the original Noodl team built substantial SSR infrastructure that was never shipped or exposed. So this task may be less about inventing server rendering than about finishing and surfacing work that partially exists — the first implementation step is finding out which.

The prerequisite that blocked this is now clearing: the design document names the React 19 migration as its dependency, and RUN-001 delivers it.

## Current State

- All deployed projects are client-rendered SPAs.
- `dev-docs/future-projects/SSR-SUPPORT.md` describes the goal and notes pre-existing unshipped SSR infrastructure from the original team — **audit what actually exists before designing anything**.
- `packages/noodl-viewer-cloud` provides a cloud runtime that may offer a server-side execution context to build on.
- The runtime's node model is framework-neutral, but individual visual nodes make browser assumptions (DOM measurement, window APIs) that will not hold on a server.
- Data nodes fetch at runtime in the browser; server rendering requires resolving data before render.

## Desired State

- A project setting choosing CSR (default, unchanged), SSR, or SSG.
- SSR: pages rendered on the server and hydrated in the browser, with data resolved server-side.
- SSG: pages pre-rendered at build time for static hosting.
- Per-page control where a project mixes modes.
- Clear reporting of which nodes are server-incompatible, ideally before deploy rather than at runtime.

## Scope

### In Scope
- [ ] Audit and assess the existing unshipped SSR infrastructure
- [ ] Server rendering path for the React 19 runtime
- [ ] Hydration that reconciles cleanly with the client runtime
- [ ] Server-side data resolution for data/query nodes
- [ ] SSG build mode producing static output
- [ ] Project/page-level rendering-mode setting
- [ ] Node server-compatibility audit and reporting
- [ ] Deployment documentation for each mode

### Out of Scope
- Incremental static regeneration or streaming SSR (later refinements)
- A hosting product (ECO-004, Phase 20)
- Migrating existing projects to SSR automatically — opt-in only
- Edge-runtime targets

## Technical Approach

### Design notes

**Node server-compatibility is the crux.** A node that measures DOM, reads `window`, or starts an animation cannot run server-side. Some can be made isomorphic; others must be deferred to hydration. This audit determines the shape of everything else, so do it early — and encode the results in the node catalog (SUB-004/005), so both the editor and any future export path know which nodes are server-safe.

**Hydration mismatches are the classic failure mode**, and they will be worse here than in hand-written React because the graph is interpreted: a node that produces different output on server and client causes a mismatch the user did not write and cannot easily debug. Prefer deterministic server rendering, and where a node cannot be deterministic, defer it to client-only rendering explicitly rather than hoping.

**Data loading** is the second hard part. Client-side, data nodes fetch when they run. Server-side, the render must wait for data. This needs a data-resolution pass before render, which in turn needs to know which queries a page depends on — knowable from the graph, which is a genuine advantage of the format.

## Implementation Steps

1. **Audit the existing infrastructure.** Determine what the original team built, whether it still functions, and whether it is a foundation or an artifact. Record the finding — it may substantially change the estimate in either direction.
2. **Node compatibility audit** — classify every node as server-safe, adaptable, or client-only; record in the catalog.
3. **Server render path** for a trivial project (static content only), proving the pipeline end to end.
4. **Hydration** reconciling with the client runtime.
5. **Data resolution** before render, driven by the page's graph.
6. **SSG mode** — pre-render at build time.
7. **Project/page settings** and editor UI.
8. **Deployment docs** per mode.

## Testing Plan

- Rendered HTML contains meaningful content before JavaScript executes (verify with JS disabled).
- No hydration mismatch warnings across the test corpus.
- Data-dependent pages render with data server-side.
- SSG output is fully static and hosts correctly on a static host.
- Client-only nodes degrade gracefully rather than breaking the render.
- SEO sanity: meta tags and content visible to a crawler; social preview generation works.

## Success Criteria

- [ ] Existing SSR infrastructure audited with a recorded finding
- [ ] Every node classified for server compatibility, recorded in the catalog
- [ ] SSR renders meaningful HTML pre-JavaScript and hydrates without mismatches
- [ ] Server-side data resolution works for data-dependent pages
- [ ] SSG produces deployable static output
- [ ] Rendering mode selectable per project and per page
- [ ] Deployment documentation for all three modes

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Hydration mismatches that users cannot debug | Deterministic server rendering; explicit client-only deferral for non-deterministic nodes; mismatch detection in development builds |
| Many nodes turn out to be server-incompatible, limiting usefulness | The step-2 audit surfaces this early; if the compatible subset is too small, that is a finding worth reporting before spending the full estimate |
| The pre-existing infrastructure is a dead end | Step 1 is explicitly an assessment with a recorded outcome, not an assumption |
| Scope drifts into building a hosting product | Deployment docs only; hosting is ECO-004 |

## References

- [`dev-docs/future-projects/SSR-SUPPORT.md`](../../future-projects/SSR-SUPPORT.md) — the design and the note about unshipped infrastructure
- Depends on: RUN-001. Related: SUB-004/005 (catalog records server compatibility), Phase 18 (export benefits from the same node classification)

## Checklist

- [ ] Branch `task/run-002-ssr-ssg`; confirm RUN-001 landed
- [ ] Audit existing SSR infrastructure; record the finding
- [ ] Classify node server compatibility; record in catalog
- [ ] Server render path → hydration → data resolution
- [ ] SSG mode; project/page settings
- [ ] Deployment docs; CHANGELOG; open PR
