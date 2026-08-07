# Can Noodl Be Saved? — A Viability Assessment Brief for Fable

**Audience:** A fresh Claude session running the **Fable** model.
**Author of brief:** Richard (via Claude Code, 2026-07-22)
**Deliverable:** One extensive written report — see [§5 Required Output](#5-required-output).
**Working directory:** repo root of OpenNoodl (the `dev-docs/` tree lives beside `packages/`).

> Read this whole brief before touching anything. Then do the investigation in [§4](#4-investigation-plan) and produce the report in [§5](#5-required-output). This is an **assessment, not an implementation task** — do not change product code. You may write your report and scratch notes only.

---

## 1. Why this exists (read this carefully — the framing is the point)

OpenNoodl is a fork/revival of Noodl, a visual low-code app builder: an Electron desktop **editor** where you wire up **nodes** on a canvas, which are saved as a big JSON graph (Richard calls it "JSONBase"; in the code it's `project.json` and friends), and a **runtime** that interprets that JSON in the browser and renders it as React at preview/deploy time. There is a large `dev-docs/` roadmap (phases 0–11) laying out a multi-quarter revival plan. Development stalled around **2026-02-18** and hasn't been touched in ~5 months.

The question is not "is this good code." The question is **"is the dream still alive, and can this specific codebase carry it?"** Those are two different questions and the report must answer both, separately and honestly.

### 1.1 The strategic tension (steelman AND stress-test this)

Richard's own framing, which you must engage with directly rather than rubber-stamp:

- **The threat.** AI "vibe coding" has largely eaten the original market for tools like Noodl. If you can ask Claude to build an app in whatever framework fits best, why drag nodes around a canvas? Building visually is *slower*.
- **The surviving case FOR Noodl (the thesis to test):**
  1. **Agency & comprehension.** Some people won't hand full authorship to an AI. They want to *know* what they built — which nodes are wired to what, how data flows — and be able to stand behind it, show it, and explain it. Noodl makes the architecture visible and legible in a way a wall of generated code does not.
  2. **Engineering discipline by construction.** In theory a visual graph nudges you toward sound structure — explicit state, explicit data flow, explicit events — so you end up with a system built on real engineering principles you chose, not vibes you accepted.
  3. **Pedagogy.** Imagine teaching kids (or any beginner) to build their first apps/automations *with* engineering logic and programming fundamentals intact — instead of learning to prompt an AI and never understanding the machine underneath. This may be the strongest surviving reason for the tool to exist. Weigh it seriously.
- **The counterweights / potential deal-breakers (test whether each is fatal, survivable, or already addressed in the roadmap):**
  1. **React lock-in.** You author visually but you're compiling to React in the browser via an interpreter. You can't easily say "actually build this in Svelte." Compare against "just ask Claude to pick the most sensible framework." Does the roadmap's **code export** (Phase 7) genuinely dissolve this, or only partially? Would successful code export also solve **Noodl lock-in** (export, walk away, keep going in Svelte with a human or AI coder)?
  2. **Monolithic project JSON.** The whole app is one giant JSON blob. That blocks a huge opportunity: letting an **AI code part of the app itself** — e.g. "AI, build this whole Noodl page" — because the AI would need to ingest the entire project to touch one page. If the JSON were **decomposed into smaller per-page/per-component files**, an AI (which already understands the node-graph "language") could look at just the parent page and author a child. Phase 10 (STRUCT-001…009) appears to be exactly this bet — assess whether that work actually delivers it.
  3. **The codebase itself.** Richard's blunt worry: it's "a mishmash of decades of different dev styles, directions, additions and subtractions that might be beyond saving. A mix of jQuery and TypeScript and who knows what all trying to live together in harmony. A monster of dependencies, most of which are dangerously out of date." Verify or refute this with evidence. Is it a fixable mess or a foundational liability?

Your job: given all of the above, tell Richard whether the roadmap in `dev-docs/` still makes sense **today** (mid-2026, post-vibe-coding), which specific pieces will and won't work, and whether the codebase can actually be saved. Be the person who tells him the dream isn't dead — **only if the evidence says so**. If parts of it are dead, say which parts and why, and what a smaller surviving version looks like.

---

## 2. Ground rules

- **No product-code changes.** Do not edit anything under `packages/`. Read, run read-only analysis, and write your report. (Building/running the app read-only to observe behaviour is fine and encouraged; see §4.)
- **Evidence over vibes.** Every strong claim ("dependencies are dangerously out of date", "the jQuery/React split is fatal", "code export is infeasible") must cite specific files, versions, `git`/`npm` output, or roadmap docs. Quote line references as `path:line`.
- **Separate "the dream" from "this codebase."** A conclusion like "the vision is sound but this implementation can't carry it" (or the reverse) is a valid and important outcome. Keep the two axes distinct throughout.
- **Assume the reader is Richard** — the person who wrote the roadmap and knows the product intimately, but wants an outside, current-day reality check. Don't over-explain what Noodl is; do challenge his assumptions.
- **Timebox depth to signal.** You don't need to read all ~1900 lines of every LEARNINGS file. Sample enough to characterise; go deep only where the verdict hinges on it (dependencies, the runtime/compile pipeline, code export feasibility, JSON decomposition).
- **Write the report incrementally** to a file as you go (see §5) so nothing is lost if the session is interrupted.

---

## 3. What already exists that you must ground yourself in

Orient using these before forming opinions. (Paths relative to repo root.)

**Roadmap / strategy**
- `dev-docs/README.md` — what the docs are and the intended workflow.
- `dev-docs/tasks/` — phases 0 through 11. Each phase has a `PROGRESS.md` and per-task folders. The phase list itself is the roadmap:
  - phase-0 foundation-stabilisation, phase-1 dependency-updates, phase-2 react-migration, phase-3 editor-ux-overhaul, phase-3.5 realtime-agentic-ui, phase-4 canvas-visualisation-views, phase-5 multi-target-deployment, phase-6 uba-system, phase-7 **code-export**, phase-8 distribution, phase-9 styles-overhaul, phase-10 **ai-powered-development** (the JSON decomposition / STRUCT work), phase-11 cloud-functions.
- `dev-docs/future-projects/CODE-EXPORT-STUDY.md` — the project's own honest writeup of *why code export is hard* and a proposed lesser alternative. **Central to the lock-in question — read in full.**
- `dev-docs/future-projects/` — also MULTI-PROJECT, NATIVE-BAAS-INTEGRATIONS, SSR-SUPPORT, CANVAS-MODERNISATION, PHASE-RUNTIME-REACT-19-MIGRATION.

**Architecture / codebase reality**
- `dev-docs/reference/CODEBASE-MAP.md` — package map (editor / runtime / viewer-react / core-ui / platform layers). The monorepo is Lerna-managed with `packages/*`.
- `dev-docs/reference/LEARNINGS.md` (+ LEARNINGS-RUNTIME, LEARNINGS-BLOCKLY, LEARNINGS-NODE-CREATION) — hard-won gotchas. The **editor/runtime window separation**, **dynamic code compilation**, and **React-over-canvas** entries tell you a lot about how fragile/coupled the architecture is. Skim for architectural constraints, not trivia.
- `dev-docs/reference/COMMON-ISSUES.md`, `DEBUG-INFRASTRUCTURE.md`.

**Current state of play (where the stall happened)**
- Latest branch is `cline-dev`, last commit ~2026-02-18. Multiple parallel dev branches exist (`cline-dev-richard`, `-dishant`, `-tara`, `feature/*`). Work was mid-flight across:
  - Phase 10 STRUCT-001…004 done (schemas + export/import engines + format detection); STRUCT-005…009 (lazy loading, save logic, migration wizard) **not started** — see `dev-docs/tasks/phase-10-ai-powered-development/PROGRESS-dishant.md`.
  - Phase 9 styles STYLE-005 left with pending wiring — `dev-docs/tasks/phase-9-styles-overhaul/PROGRESS-richard.md`.
  - Phase 6 UBA through UBA-009 — `dev-docs/tasks/phase-6-uba-system/PROGRESS-richard.md`.
  - Phase 11 cloud-functions through CF11-007.

**The three make-or-break subsystems — study these hardest:**
1. **The runtime/compile pipeline** (`packages/noodl-runtime`, `packages/noodl-viewer-react`) — how JSON becomes running React. This is the heart of the React-lock-in question.
2. **The project format & decomposition work** (`packages/noodl-editor/src/editor/src/io/` — `ProjectExporter.ts`, `ProjectImporter.ts`, `ProjectFormatDetector.ts` — and `.../schemas/`). This is Phase 10's bet on AI-authorable, per-file project structure.
3. **Code export** (`dev-docs/tasks/phase-7-code-export/` — `CODE-EXPORT-overview.md` and the CODE-00x tasks). Note whether any of it is implemented vs. purely planned.

---

## 4. Investigation plan

Work through these five workstreams. Each has concrete probes and a "what to conclude" target. Adapt as findings dictate, but cover all five.

### Workstream A — Dependency & build health ("monster of dependencies")
Goal: turn "dangerously out of date" into a measured fact.
- Enumerate the workspace: root `package.json`, `lerna.json`, every `packages/*/package.json`. Count packages and total direct deps.
- Run read-only audits: `npm ls --all 2>&1 | head`, `npm outdated` (root and per-package), `npm audit --production` if a lockfile resolves. Capture major-version gaps (React, TypeScript, webpack, Electron, Storybook, build toolchain).
- Identify pinned/abandoned/deprecated deps and native modules that pin old Node/Electron. Flag anything security-critical.
- Check whether the thing even **builds today** on this machine: `npm ci` (or `npm install`) and `npm run build` / `npm run dev` (Electron opens a desktop window — that's expected, not a browser). If it fails, capture the failure; a project that no longer builds is itself a headline finding.
- **Conclude:** Is dependency debt a weekend of upgrades, a multi-month slog, or a load-bearing wall you can't move without rewriting? Phase 1 already attempted a React 19 / dependency pass — did it land or stall?

### Workstream B — The jQuery↔TypeScript↔React "mishmash"
Goal: quantify the architectural heterogeneity and decide if it's tech-debt-you-live-with vs. foundational rot.
- Measure the mix. e.g. `grep -rl "jquery\|\$(" packages --include=*.js --include=*.ts | wc -l` vs. React/TSX counts; find the oldest untyped `.js` islands; locate where jQuery and React co-manage the same DOM (the LEARNINGS "React over canvas / legacy separation" entries point at the danger zones — the node graph canvas especially).
- Characterise the boundaries: editor vs runtime window separation, the canvas (HTML5 canvas + React overlays), PopupLayer, the property panels. Which subsystems are modern React and which are legacy islands?
- Judge coupling: are the legacy islands *contained* (coordinate via events, as LEARNINGS claims for VersionControlPanel/CommentLayer) or *entangled* (shared mutable DOM/state)? Contained mess is survivable; entangled mess is not.
- **Conclude:** Is this a codebase you can incrementally modernise island-by-island, or does the core (canvas + runtime) need a rewrite before anything else matters?

### Workstream C — The React-lock-in & code-export question (the big strategic one)
Goal: decide whether Noodl can shed "locked into React" and "locked into Noodl."
- Read `future-projects/CODE-EXPORT-STUDY.md` fully — it's the project's own argument for why true export is hard. Pressure-test it: is its pessimism still justified in 2026, when an AI could plausibly help transpile a node graph to idiomatic framework code?
- Inspect the runtime: how tightly is app logic bound to the React runtime interpreter? Is the node graph a *framework-agnostic* description of intent (state, data flow, events) that could target Svelte/Vue/plain TS — or is React semantics baked into the node model itself?
- Assess Phase 7 (`phase-7-code-export/`): how much is designed vs. built? Is the "nodegx core library" / per-node-type generator approach credible? Would it produce code a human/AI would actually want to inherit, or unreadable machine output?
- Reframe with today's tooling: does "the node graph is a clean, legible spec that an AI transpiles to whatever framework you want on export" turn the weakness into the *product*? Or is that hand-waving over real semantic gaps (runtime-only behaviours, dynamic ports, expression evaluation)?
- **Conclude:** Rank the outcome — (a) full multi-framework export is realistic, (b) React-only export is realistic and enough, (c) export stays a partial/handoff aid, (d) genuinely infeasible. Say which, with evidence, and whether it dissolves the lock-in objection.

### Workstream D — JSON decomposition for AI-authorable projects (Phase 10 STRUCT)
Goal: decide whether the "AI codes a whole Noodl page" vision is reachable on this foundation.
- Read the STRUCT work in `packages/noodl-editor/src/editor/src/io/` (`ProjectExporter.ts`, `ProjectImporter.ts`, `ProjectFormatDetector.ts`) and `.../schemas/*.schema.json`, plus `phase-10-ai-powered-development/PROGRESS-dishant.md` and `DRAFT-CONCEPT.md`.
- Verify the claim that the v2 format cleanly splits the monolith into per-component files (`components/<Name>/{component,nodes,connections}.json` + registry) with lossless round-trip (the docs claim 55 round-trip tests). Spot-check the tests actually assert round-trip fidelity, not just that code runs.
- Judge AI-authorability: given a decomposed page file + its parent, could an LLM plausibly author a valid child page **without** the whole project? What's still missing (STRUCT-005 lazy loading, STRUCT-006 save logic, STRUCT-007 migration wizard are unbuilt) before the editor can actually *use* the split format day-to-day?
- Consider whether the JSON schema is legible enough to be an "AI-native language" or whether it's an implementation-detail dump.
- **Conclude:** Is the AI-authoring vision (i) already substantially enabled by STRUCT-001…004, (ii) reachable with the remaining STRUCT tasks, or (iii) blocked by something deeper? Estimate the remaining distance.

### Workstream E — Does the vision still make sense in mid-2026? (roadmap vs. reality)
Goal: the honest strategic verdict, independent of code quality.
- Walk the phase list as a *product roadmap* and mark each phase: still-relevant / partially-obsoleted-by-AI-coding / dead. E.g. does phase-3.5 realtime-agentic-ui and phase-10 AI-powered-development reposition Noodl as an *AI-collaborative* visual tool rather than a vibe-coding competitor? Does that repositioning actually work?
- Engage the pedagogy thesis specifically (§1.1): is "learn real engineering visually, not by prompting" a defensible wedge for schools/beginners, and does the roadmap serve that user or a different (pro-dev) one? Is the product trying to be two things at once?
- Sanity-check scope vs. the stalled reality: 12 phases, multiple parallel dev branches, one recent contributor pair, 5-month stall. What's the *minimum* surviving product that's worth building, and which phases are it?
- **Conclude:** Is the dream dead, alive-but-needs-refocusing, or alive-as-is? If alive, what's the sharpened one-sentence reason-to-exist, and the 3–5 phases that matter.

---

## 5. Required output

Write a single markdown report to:

`dev-docs/reviews/NOODL-VIABILITY-REPORT.md`  *(create the `reviews/` folder)*

Write it **incrementally as you go**, not all at the end. Structure it exactly like this:

1. **Verdict up front (≤200 words).** Answer the title question — *Can Noodl be saved?* — in the first paragraph, with a clear disposition: **Dead / Salvageable-with-major-surgery / Alive-needs-refocus / Alive**. State separately whether it's *the dream* or *this codebase* that's the limiting factor. No hedging in this section.
2. **The strategic case, tested.** Your assessment of §1.1 — agency, engineering-discipline, and pedagogy theses vs. the vibe-coding threat. Which of the three surviving reasons-to-exist actually hold up in mid-2026, ranked.
3. **Codebase health scorecard.** A table scoring each of: dependency health, architectural coherence (jQuery/React/TS mix), runtime/compile pipeline, project-format/decomposition, code-export feasibility, test/build health. For each: a 1–5 score, one-line evidence-backed justification (`path:line` or command output), and disposition (fix / rewrite / leave).
4. **The deal-breaker details** — one subsection each for the four §1.1 counterweights (React lock-in, monolithic JSON, code export, the mishmash), each ending in **fatal / survivable / already-addressed** with evidence.
5. **Roadmap triage.** The full phase list (0–11) as a table: phase → still-worth-doing? (yes/partial/no) → one-line why → rough effort. Then name the **minimum viable surviving roadmap**: the 3–5 phases that constitute a product worth shipping, in order.
6. **What would have to be true.** The specific conditions under which the answer flips from your verdict to the opposite — i.e. what evidence, if found, would change your mind. (Keeps you honest.)
7. **Recommended next move.** One concrete recommendation for Richard: revive-as-is / revive-refocused / archive / rewrite-the-core-first. With the single highest-leverage first task.
8. **Appendix: evidence log.** The commands you ran and key raw output (dependency audits, grep counts, build result), so the report is reproducible.

Keep prose tight and load-bearing. Richard would rather read 8 sharp pages than 30 padded ones. Where you're uncertain, say so and say what you'd need to resolve it — don't fabricate confidence.

---

## 6. Suggested first moves for the new session

1. Read this brief, then `dev-docs/README.md`, `dev-docs/reference/CODEBASE-MAP.md`, and `dev-docs/future-projects/CODE-EXPORT-STUDY.md`.
2. Create `dev-docs/reviews/NOODL-VIABILITY-REPORT.md` with the §5 skeleton and fill the evidence log as you run probes.
3. Run Workstream A (dependency/build health) first — it's the cheapest way to learn whether the patient is breathing.
4. Then B→C→D→E, writing conclusions into the report as each workstream closes.
5. Finish by writing the Verdict (§5.1) **last**, but placing it first in the document.

Good luck. Tell Richard the truth — whichever way it falls.
