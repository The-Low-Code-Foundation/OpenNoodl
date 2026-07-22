# LEARN-004: Web Editor Feasibility Spike

## Metadata

| Field | Value |
|-------|-------|
| **ID** | LEARN-004 |
| **Phase** | Phase 17 — Noodl Learn (Revival Track E) |
| **Priority** | 🟡 Medium |
| **Difficulty** | 🟡 Medium (as a spike) |
| **Estimated Time** | **4 weeks, hard time-box** |
| **Prerequisites** | LEARN-003 |
| **Branch** | `task/learn-004-web-editor-spike` |
| **Recommended executor** | 🔵 **Fable 5** — the deliverable is a recommendation that could commit the project to a 6–12 month effort. Its value is in the quality of the judgement and the honesty of the estimate, not in code. |

## Objective

Determine, on evidence and within four weeks, whether the OpenNoodl editor can be run in a browser — and produce an explicit go/no-go recommendation with a costed plan.

**The deliverable of this task is a decision document, not a web editor.**

## Background

LEARN-003 makes graphs *viewable* in a browser. The obvious next question is whether they can be *editable* there, and for the education wedge the answer matters a great deal: a viewer lets a class look at what the teacher built, but only an editor lets thirty students on managed Chromebooks actually build anything.

The question is worth asking properly rather than assuming either answer. The optimistic case is real: the editor's renderer is already a webpack-built React application, and the Electron-specific surface is comparatively contained — the main process, and a platform abstraction layer that exists precisely because the project anticipated multiple hosts. The pessimistic case is equally real: filesystem access, Git integration via a native binary, the local backend's native SQLite module, project storage, and the preview/runtime window separation all assume a desktop.

With an unlimited budget the question becomes askable, but it should not be answered by enthusiasm. A web editor is plausibly a 6–12 month project that would dominate the roadmap, and committing to it on a hunch is exactly the kind of decision the viability assessment criticised in the original twelve-phase plan. Hence: a hard four-week time-box, a written recommendation, and an explicit decision.

## Current State

- The editor is Electron: renderer (webpack + React) plus a main process, with `@noodl/platform` abstracting host services and `@noodl/platform-electron` implementing them for desktop.
- `@noodl/platform-node` exists as a second implementation, which is evidence the abstraction is real rather than aspirational — assess how complete it is.
- Desktop-coupled subsystems to assess: filesystem/project storage, Git (`packages/noodl-git`, dugite native binary), local backend (`better-sqlite3` native module), preview/runtime window separation, native menus and dialogs, deployment, and auto-update.
- SUB-001 (v2 files) and LEARN-003 (web rendering) will both have landed, which materially changes the assessment — project data is now web-fetchable and graph rendering in a browser is proven.

## Desired State (of the spike, not the product)

A written recommendation containing:

- An honest verdict: **go / no-go / go-with-reduced-scope**
- A subsystem-by-subsystem assessment of what ports cleanly, what needs a web equivalent, and what cannot come along
- A costed plan if the answer is go, with phasing and a realistic range
- The alternatives considered, and why they were rejected or deferred
- What would change the answer

Plus a throwaway prototype exercising the riskiest assumption — enough to make the recommendation evidence-based, and explicitly not a foundation to build on.

## Scope

### In Scope
- [ ] Subsystem-by-subsystem porting assessment
- [ ] Evaluate the completeness of the platform abstraction (`@noodl/platform` and its two implementations)
- [ ] Identify web equivalents: File System Access API or server storage, Git via an HTTP-based approach or `isomorphic-git`, backend via UBA rather than local SQLite
- [ ] A throwaway prototype of the single riskiest unknown
- [ ] Assess the reduced-scope option: a browser editor for *learning* only (no Git, no deploy, no local backend) — plausibly far cheaper and sufficient for the classroom
- [ ] Costed plan and phasing if go
- [ ] Written recommendation
- [ ] A statement of what evidence would reverse the recommendation

### Out of Scope
- Building the web editor (that is the follow-on project the recommendation may propose)
- Making the prototype production-quality — it is a probe, and should be deleted afterwards
- Hosting infrastructure (ECO-004)
- Exceeding four weeks under any circumstances

## Approach

### Ask the reduced-scope question seriously

The most likely useful outcome is not "port the whole editor" but "a browser editor for learners, with a deliberately smaller feature set." A student working through the curriculum needs the canvas, the node picker, the property panel, preview, and project save. They do not need Git integration, deployment pipelines, cloud functions, or a local SQL backend. That subset may be a small fraction of the cost of a full port while delivering nearly all of the educational value — and it is also the version that would not compete with or fragment the desktop product.

Assess this option explicitly and cost it separately. A recommendation that offers only "all or nothing" has probably not done its job.

### Prototype the riskiest thing only

Identify the single assumption whose failure would most change the answer, and probe just that. Likely candidates: whether the canvas and interaction layer function acceptably in a browser without Electron, or whether project storage and save can work sensibly under a browser's constraints. One probe, four weeks, then stop.

## Implementation Steps

1. **Inventory Electron coupling** across the editor; classify each dependency as portable, needs-web-equivalent, or blocking.
2. **Assess the platform abstraction** — how much already routes through it, and how much bypasses it.
3. **Identify the riskiest assumption** and prototype only that.
4. **Cost the full port** and, separately, **the learner-scoped editor.**
5. **Consider alternatives**: progressive web app wrapping the desktop build, remote/streamed desktop sessions, or staying viewer-only and investing elsewhere.
6. **Write the recommendation** with the evidence, the costing, and the reversal conditions.
7. **Delete the prototype**, or archive it explicitly as throwaway so nobody mistakes it for a foundation.

## Deliverables

- `dev-docs/reviews/WEB-EDITOR-FEASIBILITY.md` — the recommendation document
- A subsystem assessment table
- Prototype findings (the code itself is disposable)
- A costed plan if the verdict is go

## Success Criteria

- [ ] Completed within the four-week time-box
- [ ] Every Electron-coupled subsystem assessed and classified
- [ ] Riskiest assumption prototyped and its result recorded
- [ ] Both the full port and the learner-scoped option costed separately
- [ ] Alternatives considered and addressed
- [ ] A clear go / no-go / reduced-scope recommendation with reasoning
- [ ] Reversal conditions stated
- [ ] Prototype deleted or clearly marked throwaway

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| The spike becomes the project and consumes months | Hard four-week time-box; the deliverable is a document, and the prototype is explicitly disposable |
| Optimism produces a "go" that costs a year and fails | Cost honestly with ranges; state reversal conditions; consider that "no-go, invest in the viewer and desktop distribution instead" is a perfectly good outcome |
| The prototype becomes an unmaintained half-editor in the tree | Delete it, or archive it outside the main source with a README saying what it is |
| Reduced-scope option is overlooked in favour of a heroic full port | It is an explicit scope item, costed separately — do not skip it |

## References

- [Revival roadmap — Track E (E-04, explicitly a spike with a go/no-go)](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- [Viability report — §2.2 (education distribution)](../../reviews/NOODL-VIABILITY-REPORT.md)
- `packages/noodl-platform`, `packages/noodl-platform-electron`, `packages/noodl-platform-node` — the abstraction under assessment
- Depends on: LEARN-003

## Checklist

- [ ] Branch `task/learn-004-web-editor-spike`; **set the four-week deadline explicitly**
- [ ] Inventory and classify Electron coupling; assess the platform abstraction
- [ ] Prototype the single riskiest assumption
- [ ] Cost full port and learner-scoped option separately
- [ ] Consider and address alternatives
- [ ] Write `WEB-EDITOR-FEASIBILITY.md` with verdict and reversal conditions
- [ ] Dispose of the prototype; present the recommendation
