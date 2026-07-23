# OpenNoodl Development Documentation

Welcome to the OpenNoodl development docs. This folder contains everything needed for AI-assisted development with Cline and human contributors alike.

## ⚡ About OpenNoodl

**OpenNoodl is an Electron desktop application** for visual low-code development.

- The **editor** is a desktop app (Electron) where developers build applications
- The **viewer/runtime** creates web applications that run in browsers
- This documentation focuses on the **editor** (Electron app)

**Important:** When you run `npm run dev`, an Electron window opens automatically - you don't access it through a web browser. The webpack dev server at `localhost:8080` is internal to Electron and should not be opened in a browser.

## 📁 Structure

```
dev-docs/
├── .clinerules              # Project rules (copy to repo root)
├── README.md                # This file
├── CLINE-INSTRUCTIONS.md    # Custom instructions for Cline
├── TASK-TEMPLATE.md         # Template for creating new tasks
│
├── guidelines/              # Development standards
│   ├── CODING-STANDARDS.md  # Code style and patterns
│   ├── TESTING-GUIDE.md     # How to write tests
│   └── GIT-WORKFLOW.md      # Branch and commit conventions
│
├── reference/               # Quick reference materials
│   ├── CODEBASE-MAP.md      # Navigate the codebase
│   ├── NODE-PATTERNS.md     # How to create nodes
│   └── COMMON-ISSUES.md     # Troubleshooting guide
│
├── reviews/                 # Point-in-time assessments of the project
│   ├── NOODL-VIABILITY-REPORT.md   # 2026-07-22 viability assessment
│   └── NOODL-REVIVAL-ROADMAP.md    # The roadmap that assessment produced
│
└── tasks/                   # Task documentation — see the phase table below
```

### Phase structure (as it actually exists on disk)

The original plan was phases 1–3. It grew organically past that; the folders below
are what is actually on disk today. Each phase folder has its own `PROGRESS.md` —
that file, not this README, is the authoritative status source for its phase.

**Original roadmap (phases 0–11)** — built between project start and the
2026-02-18 sprint stall. Status verified and recorded per-phase during REV-006
(2026-07-23); see each phase's `PROGRESS.md` for the task-level table and evidence.

| Phase | Folder | Subject |
|-------|--------|---------|
| 0 | `phase-0-foundation-stabilisation` | Event dispatcher / React interop investigation, foundation health checks |
| 1 | `phase-1-dependency-updates` | Dependency updates, React 19 migration, TypeScript/Storybook upgrades |
| 2 | `phase-2-react-migration` | Runtime migration system, new node authoring in React, ComponentsPanel migration |
| 3 | `phase-3-editor-ux-overhaul` | Dashboard UX, GitHub integration, expressions overhaul, code editor, Blockly |
| 3.5 | `phase-3.5-realtime-agentic-ui` | SSE/WebSocket nodes, global state store, optimistic updates, action dispatcher |
| 4 | `phase-4-canvas-visualisation-views` | Canvas overlay views: topology map, component X-ray, trigger-chain debugger, data lineage |
| 5 | `phase-5-multi-target-deployment` | BYOB backend, Capacitor mobile, Electron desktop, Chrome extension targets |
| 6 | `phase-6-uba-system` | Universal Backend Adapter — schema parser, field renderers, config panel, client |
| 7 | `phase-7-code-export` | Code export design (nodegx core, generators, CLI) — design only, not built |
| 8 | `phase-8-distribution` | Rebrand, macOS signing, auto-update, Linux distribution, GitHub Actions |
| 9 | `phase-9-styles-overhaul` | Style token system, element configs, presets, property panel, suggestions |
| 10 | `phase-10-ai-powered-development` | v2 multi-file project format (schemas, export/import engines, format detector) |
| 11 | `phase-11-cloud-functions` | Logic/error/wait nodes, execution storage & logging, execution history panel |

**Revival roadmap (phases 12–20)** — added 2026-07-22 by the viability assessment
and roadmap above; these are the current, active plan.

| Phase | Folder | Subject |
|-------|--------|---------|
| 12 | `phase-12-reanimation` | Horizon 0 — green build, working tests, CI, current docs. Do this first. |
| 13 | `phase-13-format-ai-substrate` | Track A — wire the v2 format into the editor (`SUB-001`), round-trip fidelity |
| 14 | `phase-14-editor-platform-health` | Track B — canvas decomposition, retire jQuery islands, type the runtime, polish |
| 15 | `phase-15-ai-collaboration` | Track C — modern AI client, in-graph authoring loop, agentic UI nodes |
| 16 | `phase-16-runtime-deploy-health` | Track D — runtime React 19, SSR/SSG, finish UBA with a real reference backend |
| 17 | `phase-17-noodl-learn` | Track E — lessons engine, curriculum, web viewer/editor, classroom mode |
| 18 | `phase-18-code-export-v2` | Track F — funded execution of phase 7's design, AI-assisted logic translation |
| 19 | `phase-19-cloud-workflows` | Track G — bounded resurrection of phase 11: workflow runtime, nodes, managed deploy |
| 20 | `phase-20-ecosystem` | Horizon 3 — collaborative editing, marketplace, multi-project, hosted platform (gated behind G1–G3, see roadmap) |

There's also `TASK-REORG-documentation-cleanup/`, a one-off doc-restructuring task,
not a numbered phase.

## 🚀 Getting Started

### For Cline Users

1. **Copy `.clinerules` to repo root**

   ```bash
   cp dev-docs/.clinerules .clinerules
   ```

2. **Add custom instructions to Cline**

   - Open VSCode → Cline extension settings
   - Paste contents of `CLINE-INSTRUCTIONS.md` into Custom Instructions

3. **Pick a task**
   - Browse `tasks/` folders
   - Each task has its own folder with detailed instructions
   - Start with whatever `phase-12-reanimation/PROGRESS.md` shows as next — see
     [Current Priorities](#-current-priorities) below

### For Human Contributors

1. Read `guidelines/CODING-STANDARDS.md`
2. Check `reference/CODEBASE-MAP.md` to understand the project
3. Pick a task from `tasks/` and follow its documentation

## 📋 Task Workflow

### Starting a Task

1. **Read the task documentation completely**

   ```
   tasks/phase-X/TASK-XXX-name/
   ├── README.md           # Full task description
   ├── CHECKLIST.md        # Step-by-step checklist
   ├── CHANGELOG.md        # Track your changes here
   └── NOTES.md            # Your working notes
   ```

2. **Create a branch**

   ```bash
   git checkout -b task/XXX-short-name
   ```

3. **Follow the checklist**, checking off items as you go

4. **Document everything** in CHANGELOG.md

### Completing a Task

1. Ensure all checklist items are complete
2. Run tests: `npm run test:editor`
3. Run type check: `npx tsc --noEmit`
4. Update CHANGELOG.md with final summary
5. Create pull request with task ID in title

## 🎯 Current Priorities

This section used to hardcode a task checklist — that's exactly the kind of
second copy that goes stale while the real source of truth moves on (see
REV-006 below). It now just points at the live status instead of duplicating it.

**Live status:** [`phase-12-reanimation/PROGRESS.md`](tasks/phase-12-reanimation/PROGRESS.md)
is the phase actually in flight and the one place to check for current task-by-task
status. As of 2026-07-23 it's 80% done: green build, a working Electron test
harness, a real CI pipeline, and dependency hygiene are all landed; this docs
pass (REV-006) is landing now. **REV-007** (signed builds + auto-update) is next,
and is what blocks a real v0 release.

**After Phase 12 closes:** work moves to the revival tracks, phases 13–20, per
[`NOODL-REVIVAL-ROADMAP.md`](../reviews/NOODL-REVIVAL-ROADMAP.md). Track A
(`phase-13-format-ai-substrate`) is the best-scoped one to pick up first — it wires
the v2 project format (built and tested in Phase 10, but with zero call sites in
the app) into the editor.

**Picking up old phase 0–11 work:** don't assume a phase's status from memory —
several tasks previously reported "not started" turned out to be done, and at
least one reported as further along than it actually was. Check that phase's own
`PROGRESS.md`, which REV-006 rewrote against code and git evidence with commit-level
citations.

## 📚 Key Resources

| Resource                                           | Description           |
| -------------------------------------------------- | --------------------- |
| [Codebase Map](reference/CODEBASE-MAP.md)          | Navigate the monorepo |
| [Coding Standards](guidelines/CODING-STANDARDS.md) | Style and patterns    |
| [Node Patterns](reference/NODE-PATTERNS.md)        | Creating new nodes    |
| [Common Issues](reference/COMMON-ISSUES.md)        | Troubleshooting       |

## 🤝 Contributing

1. Pick an unassigned task or create a new one using `TASK-TEMPLATE.md`
2. Follow the task documentation precisely
3. Document all changes in the task's CHANGELOG.md
4. Submit PR with comprehensive description

## ❓ Questions?

- Check `reference/COMMON-ISSUES.md` first
- Search existing task documentation
- Open an issue on GitHub with the `question` label
