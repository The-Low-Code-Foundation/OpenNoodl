# Phase 70 — next session

**State (2026-08-18):** the phase is **scoped, not started**. README (concept, three principles,
mapped seams, prior-art reconciliation, rulings queue D1–D7), TASKS.md and nine task files
(EL-001 – EL-009) were written this session from two targeted exploration reports plus the P67/P68
/P69 docs. **No code, no templates, no kit exists yet.** Nothing is committed.

## The first moves, in order

1. **Put the rulings queue (README §5, D1–D7) to Richard in one sitting.** Only D2 (vocabulary)
   hard-blocks early work, but P67's history favours emptying queues before the work they gate.
   Every row carries a recommendation; none is exotic.
2. **EL-009** (the multi-page render instrument) — small, self-contained, and every later
   verification depends on it. Coordinate with the P67 lane first (it is UNI-010 F4's instrument;
   CN-001's ordering lesson applies), and watch the MCP surface bar (8,280; 57 free) if the tool
   schema changes.
3. **EL-002** (the learning kit) once D2/D3 are ruled — it is the spine, and EL-001's create-flow
   work can proceed in parallel behind `experimental.elearning`.

## What the specs are built on (re-verify on arrival)

- Two Explore reports (2026-08-18) mapped: the create wizard
  (`ProjectCreationWizard`, `handleCreateProjectConfirm` hardcodes `projectTemplate: ''`),
  `EmbeddedTemplateProvider` (content-only templates — **but `STARTER_ASSETS` already ships two
  kits into every project**, which is D4's route), `ProjectModel` metadata (the `lesson`/
  `isLesson()` precedent), `DeployPopup`'s literal one-element tabs array, `deployer.ts`,
  the experimental-flags pattern, and MCP `create_project`'s **separate skeleton writer**.
- Kit mechanics per P69: plain-folder kits, `@nodegx/module-inject` scanner, viewer-gift picker
  (nodes appear after first preview), kit JS unsandboxed in the browser (xAPI fetch fine),
  🔴 **no kit loader in the cloud runtime** (CN-012), SSR/SSG unproven (CN-013 open).
- The P66 discipline applies to *this phase's own specs*: they cite an exploration snapshot, and
  seams move. Re-read the named files before building against them.

## Standing cross-phase facts that bite here

- **"lesson" is reserved** (P67 D13) — phase-70 vocabulary awaits D2; drafts say course/activity/
  learner/cohort.
- **SCORM/LTI was deferred to here by name** — UNI-006 (~line 193) and P68 README (~line 135).
- **P67 D9**: the hosted shared backend is record-capped — EL-006 is self-hosted only.
- The learning kit must be **in-repo and gated** (the CN-007 out-of-repo kit drifted within a
  day; `a-package-in-no-gate-runs-no-tests` — four registrations **plus the lockfile**).
